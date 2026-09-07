import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import {
  ensureAnonymousUser,
  markAlertSafe,
  sendEmergencyAlert,
  subscribeToAlert,
  type AlertStatus,
  type UserAlert,
} from '@/lib/alerts';
import { findNearestShelter, type Shelter } from '@/lib/shelters';
import { firebaseConfigured } from '@/lib/firebase';
import colorTokens from '@/constants/colors';

const colors = colorTokens.light;
const DUPLICATE_WINDOW_MS = 4000;

const dos = [
  'Stay calm.',
  'Follow official emergency instructions.',
  'Move toward a verified safe shelter when evacuation is advised.',
  'Keep your phone charged and conserve battery.',
  'Keep emergency contacts informed when possible.',
  'Stay with your family or group when it is safe to do so.',
  'Follow instructions from authorized rescue personnel.',
];

const donts = [
  "Don't panic or rush into dangerous areas.",
  "Don't enter damaged buildings.",
  "Don't spread unverified emergency information.",
  "Don't block roads needed by emergency vehicles.",
  "Don't unnecessarily drain your phone battery.",
  "Don't return to a dangerous area until authorities declare it safe.",
];

type LocationStatus = 'idle' | 'checking' | 'ready' | 'unavailable';

function formatDate(value: Date | string | undefined | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function statusTitle(status: AlertStatus) {
  if (status === 'active') return 'Waiting for response';
  if (status === 'acknowledged') return 'Acknowledged';
  if (status === 'safe') return 'User marked SAFE';
  return 'Resolved';
}

function statusColor(status: AlertStatus) {
  if (status === 'safe') return colors.success;
  if (status === 'resolved') return colors.mutedForeground;
  if (status === 'acknowledged') return colors.accent;
  return colors.primary;
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code === 'permission-denied' || /missing or insufficient permissions/i.test(message)) {
    return 'This alert action was blocked by Firestore permissions. Publish the latest firestore.rules, then try again.';
  }

  return message || fallback;
}

function BrandHeader() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandMark}>
        <Feather name="shield" size={20} color={colors.primaryForeground} />
      </View>
      <Text style={styles.brand}>Emergency response</Text>
    </View>
  );
}

function BuzzerHome({
  sending,
  sent,
  error,
  onPress,
}: {
  sending: boolean;
  sent: boolean;
  error: string;
  onPress: () => void;
}) {
  return (
    <>
      <View style={styles.signalIcon}>
        <Feather name="radio" size={28} color={colors.accent} />
      </View>
      <Text style={styles.eyebrow}>HELP IS ONE TAP AWAY</Text>
      <Text style={styles.title}>Need immediate assistance?</Text>
      <Text style={styles.subtitle}>
        Press the buzzer once. Your alert will be sent to the response team
        with your secure user ID.
      </Text>

      <Pressable
        accessibilityLabel="Emergency buzzer"
        accessibilityRole="button"
        disabled={sending || sent || !firebaseConfigured}
        onPress={onPress}
        style={({ pressed }) => [
          styles.buzzer,
          pressed && !sending && !sent && styles.buzzerPressed,
          (sending || sent || !firebaseConfigured) && styles.buzzerDisabled,
        ]}
        testID="emergency-buzzer"
      >
        {sending ? (
          <ActivityIndicator color={colors.primaryForeground} size="large" />
        ) : (
          <>
            <Feather
              name={sent ? 'check' : 'alert-circle'}
              size={34}
              color={colors.primaryForeground}
            />
            <Text style={styles.buzzerText}>
              {sent ? 'ALERT SENT' : 'EMERGENCY BUZZER'}
            </Text>
          </>
        )}
      </Pressable>

      {sent ? (
        <View style={styles.confirmation}>
          <Feather name="check-circle" size={18} color={colors.success} />
          <Text style={styles.confirmationText}>Emergency alert sent.</Text>
        </View>
      ) : null}
      {!firebaseConfigured ? (
        <Text style={styles.errorText}>
          Add the Firebase configuration to this app before sending alerts.
        </Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );
}

function StatusRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function ShelterCard({
  status,
  shelter,
  message,
  canAskAgain,
  onRetry,
}: {
  status: LocationStatus;
  shelter: Shelter | null;
  message: string;
  canAskAgain: boolean;
  onRetry: () => void;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Feather name="map-pin" size={18} color={colors.accent} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionEyebrow}>NEAREST SAFE SHELTER</Text>
          <Text style={styles.sectionTitle}>Verified location guidance</Text>
        </View>
      </View>
      {status === 'checking' ? (
        <View style={styles.inlineState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.bodyText}>Checking your location and verified shelter data…</Text>
        </View>
      ) : shelter ? (
        <View style={styles.shelterResult}>
          <Text style={styles.shelterName}>{shelter.name}</Text>
          <Text style={styles.bodyText}>{shelter.distanceKm.toFixed(1)} km away</Text>
          <Text style={styles.bodyText}>{shelter.address}</Text>
        </View>
      ) : (
        <View>
          <Text style={styles.bodyText}>{message}</Text>
          <Text style={styles.helperText}>
            This app will only show shelter names and distances from a verified shelter source.
          </Text>
          {!canAskAgain ? (
            <Text style={styles.permissionNotice}>
              Location permission is missing or insufficient. Enable location access in Android Settings to retry.
            </Text>
          ) : null}
          <View style={styles.shelterActions}>
            <Pressable style={styles.secondaryButton} onPress={onRetry} testID="button-retry-location">
              <Feather name="refresh-cw" size={15} color={colors.foreground} />
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
            {!canAskAgain && Platform.OS !== 'web' ? (
              <Pressable style={styles.linkButton} onPress={() => void Linking.openSettings()}>
                <Text style={styles.linkButtonText}>Open settings</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

function GuidanceScreen({
  alert,
  cooldownRemaining,
  savingSafe,
  error,
  locationStatus,
  shelter,
  shelterMessage,
  locationCanAskAgain,
  onMarkSafe,
  onSendAnother,
  onRetryLocation,
}: {
  alert: UserAlert;
  cooldownRemaining: number;
  savingSafe: boolean;
  error: string;
  locationStatus: LocationStatus;
  shelter: Shelter | null;
  shelterMessage: string;
  locationCanAskAgain: boolean;
  onMarkSafe: () => void;
  onSendAnother: () => void;
  onRetryLocation: () => void;
}) {
  const safe = alert.status === 'safe';
  const responseAcknowledged = Boolean(alert.acknowledgedAt);

  return (
    <ScrollView
      contentContainerStyle={styles.guidanceContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.guidanceHero}>
        <View style={styles.guidanceIcon}>
          <Feather name={safe ? 'shield' : 'check'} size={30} color={colors.primaryForeground} />
        </View>
        <Text style={styles.eyebrow}>{safe ? 'STATUS UPDATED' : 'SOS SUCCESSFULLY SENT'}</Text>
        <Text style={styles.guidanceTitle}>{safe ? 'You marked yourself safe.' : 'Help is on the way.'}</Text>
        <Text style={styles.subtitle}>
          {safe
            ? 'Your response team can see that you are safe. Keep following official instructions.'
            : 'Stay calm and use the guidance below while the response network reviews your alert.'}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Feather name="activity" size={18} color={colors.primary} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionEyebrow}>SOS STATUS</Text>
            <Text style={styles.sectionTitle}>Your alert is being tracked</Text>
          </View>
        </View>
        <StatusRow label="Status" value={statusTitle(alert.status)} valueColor={statusColor(alert.status)} />
        <StatusRow label="Alert ID" value={alert.id} />
        <StatusRow label="Time sent" value={formatDate(alert.createdAt)} />
        <StatusRow
          label="Response network"
          value={responseAcknowledged ? `Acknowledged ${formatDate(alert.acknowledgedAt)}` : 'Waiting for acknowledgement'}
          valueColor={responseAcknowledged ? colors.success : colors.accent}
        />
        {alert.safeAt ? <StatusRow label="Marked safe" value={formatDate(alert.safeAt)} valueColor={colors.success} /> : null}
      </View>

      <ShelterCard
        status={locationStatus}
        shelter={shelter}
        message={shelterMessage}
        canAskAgain={locationCanAskAgain}
        onRetry={onRetryLocation}
      />

      <View style={styles.instructionsGrid}>
        <View style={styles.instructionCard}>
          <View style={styles.instructionHeader}>
            <Feather name="check-circle" size={18} color={colors.success} />
            <Text style={styles.instructionTitle}>DO</Text>
          </View>
          {dos.map((item) => (
            <View key={item} style={styles.instructionRow}>
              <View style={[styles.bullet, { backgroundColor: colors.success }]} />
              <Text style={styles.instructionText}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.instructionCard}>
          <View style={styles.instructionHeader}>
            <Feather name="alert-triangle" size={18} color={colors.primary} />
            <Text style={styles.instructionTitle}>DON&apos;T</Text>
          </View>
          {donts.map((item) => (
            <View key={item} style={styles.instructionRow}>
              <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
              <Text style={styles.instructionText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {!safe ? (
        <Pressable
          accessibilityLabel="I am safe"
          accessibilityRole="button"
          disabled={savingSafe}
          onPress={onMarkSafe}
          style={[styles.safeButton, savingSafe && styles.buttonDisabled]}
          testID="button-i-am-safe"
        >
          {savingSafe ? <ActivityIndicator color={colors.background} /> : <Feather name="shield" size={20} color={colors.background} />}
          <Text style={styles.safeButtonText}>{savingSafe ? 'UPDATING STATUS…' : 'I AM SAFE'}</Text>
        </Pressable>
      ) : (
        <View style={styles.safeConfirmation}>
          <Feather name="check-circle" size={20} color={colors.success} />
          <Text style={styles.safeConfirmationText}>You have marked yourself safe.</Text>
        </View>
      )}

      <Pressable
        accessibilityLabel="Send another SOS"
        accessibilityRole="button"
        disabled={cooldownRemaining > 0}
        onPress={onSendAnother}
        style={[styles.secondaryButton, styles.anotherButton, cooldownRemaining > 0 && styles.buttonDisabled]}
        testID="button-send-another"
      >
        <Feather name="radio" size={16} color={colors.foreground} />
        <Text style={styles.secondaryButtonText}>
          {cooldownRemaining > 0 ? `Send another SOS in ${cooldownRemaining}s` : 'Send another SOS if still needed'}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Text style={styles.disclaimer}>
        SOS Sent means this device created an alert in Firestore. It does not claim that rescue authorities have accepted the request until the response network acknowledges it.
      </Text>
    </ScrollView>
  );
}

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savingSafe, setSavingSafe] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [currentAlert, setCurrentAlert] = useState<UserAlert | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationCanAskAgain, setLocationCanAskAgain] = useState(true);
  const [shelter, setShelter] = useState<Shelter | null>(null);
  const [shelterMessage, setShelterMessage] = useState('Shelter information is unavailable until a verified shelter source is connected.');

  useEffect(() => {
    if (!firebaseConfigured) return;
    ensureAnonymousUser()
      .then((user) => setUserId(user.uid))
      .catch(() => setError('Unable to connect to the alert service.'));
  }, []);

  useEffect(() => {
    if (!sent) return;
    const timeout = setTimeout(() => setSent(false), 4500);
    return () => clearTimeout(timeout);
  }, [sent]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownRemaining(seconds);
      if (seconds === 0) setCooldownUntil(0);
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!currentAlert?.id) return;
    return subscribeToAlert(
      currentAlert.id,
      (nextAlert) => setCurrentAlert(nextAlert),
      (nextError) => setError(friendlyError(nextError, 'Unable to read the current alert status.')),
    );
  }, [currentAlert?.id]);

  async function loadShelterInfo() {
    setLocationStatus('checking');
    setShelter(null);
    setShelterMessage('Checking your location and verified shelter data…');
    try {
      if (Platform.OS === 'web') {
        setLocationCanAskAgain(false);
        setLocationStatus('unavailable');
        setShelterMessage('GPS shelter lookup is available in the Android app. This web preview does not have the native location capability.');
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationCanAskAgain(permission.canAskAgain);
      if (permission.status !== 'granted') {
        setLocationStatus('unavailable');
        setShelterMessage('Location permission is missing or insufficient, so a nearest shelter cannot be calculated.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nearestShelter = await findNearestShelter({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (nearestShelter) {
        setShelter(nearestShelter);
        setLocationStatus('ready');
        setShelterMessage('');
      } else {
        setLocationStatus('unavailable');
        setShelterMessage('GPS location is available, but verified shelter information is not connected yet.');
      }
    } catch {
      setLocationStatus('unavailable');
      setShelterMessage('Shelter information is unavailable because the location could not be read.');
    }
  }

  useEffect(() => {
    if (!currentAlert) return;
    void loadShelterInfo();
  }, [currentAlert?.id]);

  async function handleEmergencyPress() {
    if (sending || sent || cooldownRemaining > 0) return;
    setSending(true);
    setError('');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    try {
      const result = await sendEmergencyAlert();
      const createdAt = new Date();
      setUserId(result.userId);
      setCurrentAlert({
        id: result.alertId,
        userId: result.userId,
        createdAt,
        status: 'active',
      });
      setCooldownUntil(Date.now() + DUPLICATE_WINDOW_MS);
      setSent(true);
    } catch (caught) {
      setError(friendlyError(caught, 'Unable to send the alert.'));
    } finally {
      setSending(false);
    }
  }

  async function handleMarkSafe() {
    if (!currentAlert || currentAlert.status === 'safe') return;
    setSavingSafe(true);
    setError('');
    try {
      await markAlertSafe(currentAlert.id);
      setCurrentAlert((previous) => previous ? { ...previous, status: 'safe', safeAt: new Date() } : previous);
    } catch (caught) {
      setError(friendlyError(caught, 'Unable to mark this alert safe.'));
    } finally {
      setSavingSafe(false);
    }
  }

  const showGuidance = Boolean(currentAlert);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar style="light" />
      <BrandHeader />
      {showGuidance && currentAlert ? (
        <GuidanceScreen
          alert={currentAlert}
          cooldownRemaining={cooldownRemaining}
          savingSafe={savingSafe}
          error={error}
          locationStatus={locationStatus}
          shelter={shelter}
          shelterMessage={shelterMessage}
          locationCanAskAgain={locationCanAskAgain}
          onMarkSafe={() => void handleMarkSafe()}
          onSendAnother={() => void handleEmergencyPress()}
          onRetryLocation={() => void loadShelterInfo()}
        />
      ) : (
        <View style={styles.content}>
          <BuzzerHome
            sending={sending}
            sent={sent}
            error={error}
            onPress={() => void handleEmergencyPress()}
          />
        </View>
      )}
      <View style={styles.footer}>
        <View style={styles.secureRow}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={styles.footerText}>Secure connection</Text>
        </View>
        {userId ? <Text style={styles.userText}>User ID · {userId.slice(0, 12)}…</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  brand: {
    color: colors.foreground,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalIcon: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    marginBottom: 22,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  title: {
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    maxWidth: 320,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
    maxWidth: 330,
    textAlign: 'center',
  },
  buzzer: {
    width: '100%',
    minHeight: 142,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 30,
    backgroundColor: colors.primary,
    marginTop: 32,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 8,
  },
  buzzerPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buzzerDisabled: {
    backgroundColor: colors.primaryMuted,
    shadowOpacity: 0,
  },
  buzzerText: {
    color: colors.primaryForeground,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  confirmationText: {
    color: colors.success,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  errorText: {
    color: colors.error,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 18,
    textAlign: 'center',
  },
  guidanceContent: {
    paddingTop: 30,
    paddingBottom: 18,
  },
  guidanceHero: {
    alignItems: 'center',
    paddingBottom: 22,
  },
  guidanceIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: colors.success,
    marginBottom: 17,
  },
  guidanceTitle: {
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    lineHeight: 33,
    textAlign: 'center',
    maxWidth: 330,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 18,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionEyebrow: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.3,
  },
  sectionTitle: {
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginTop: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 11,
  },
  statusLabel: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  statusValue: {
    flex: 1,
    color: colors.foreground,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textAlign: 'right',
  },
  bodyText: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  helperText: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
    opacity: 0.8,
  },
  permissionNotice: {
    color: colors.error,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shelterResult: {
    gap: 5,
  },
  shelterName: {
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  shelterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    backgroundColor: colors.secondary,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  linkButton: {
    paddingVertical: 10,
  },
  linkButtonText: {
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  instructionsGrid: {
    gap: 14,
  },
  instructionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 18,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  instructionTitle: {
    color: colors.foreground,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 1.2,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 11,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  instructionText: {
    flex: 1,
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  safeButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.success,
    marginTop: 16,
  },
  safeButtonText: {
    color: colors.background,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: 0.7,
  },
  safeConfirmation: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    marginTop: 16,
  },
  safeConfirmationText: {
    color: colors.success,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  anotherButton: {
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  disclaimer: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  userText: {
    color: colors.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
});