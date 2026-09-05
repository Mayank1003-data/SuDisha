import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { ensureAnonymousUser, sendEmergencyAlert } from '@/lib/alerts';
import { firebaseConfigured } from '@/lib/firebase';
import colorTokens from '@/constants/colors';

const colors = colorTokens.light;

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

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

  async function handleEmergencyPress() {
    if (sending || sent) return;
    setSending(true);
    setError('');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    try {
      const result = await sendEmergencyAlert();
      setUserId(result.userId);
      setSent(true);
    } catch (caught) {
      const nextError =
        caught instanceof Error ? caught.message : 'Unable to send the alert.';
      setError(nextError);
    } finally {
      setSending(false);
    }
  }

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar style="light" />
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Feather name="shield" size={20} color={colors.primaryForeground} />
        </View>
        <Text style={styles.brand}>Emergency response</Text>
      </View>

      <View style={styles.content}>
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
          onPress={handleEmergencyPress}
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
                {sent ? 'ALERT SENT' : '🚨 EMERGENCY BUZZER'}
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
      </View>

      <View style={styles.footer}>
        <View style={styles.secureRow}>
          <Feather name="lock" size={14} color={colors.mutedForeground} />
          <Text style={styles.footerText}>Secure connection</Text>
        </View>
        {userId ? (
          <Text style={styles.userText}>User ID · {userId.slice(0, 12)}…</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
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
  footer: {
    alignItems: 'center',
    gap: 8,
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