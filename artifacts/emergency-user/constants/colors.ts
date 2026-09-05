/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#F7F8FA',
    tint: '#F04444',

    // Core surfaces
    background: '#111417',
    foreground: '#F7F8FA',

    // Cards / elevated surfaces
    card: '#1A1F24',
    cardForeground: '#F7F8FA',

    // Primary action color (buttons, links, active states)
    primary: '#F04444',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#232A31',
    secondaryForeground: '#F7F8FA',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#20262C',
    mutedForeground: '#98A2AD',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#FFCF73',
    accentForeground: '#18120A',
    accentSoft: '#30291D',

    // Destructive actions (delete, error states)
    destructive: '#F04444',
    destructiveForeground: '#FFFFFF',
    primaryMuted: '#6D3235',
    success: '#73D5A2',
    error: '#FF9A9A',

    // Borders and input outlines
    border: '#2A333B',
    input: '#2A333B',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
