// ============================================================
// PawTracker – Design Token System
// ============================================================

export const COLORS = {
  // Brand
  primary:        '#FF6B6B',  // Korallrot — Hauptfarbe
  primaryLight:   '#FFE8E8',
  secondary:      '#4ECDC4',  // Türkis
  secondaryLight: '#E0F7F6',
  accent:         '#FFE66D',  // Gelb (Punkte, Warnungen)

  // Status
  success:        '#22C55E',
  successLight:   '#DCFCE7',
  warning:        '#F97316',
  warningLight:   '#FFF0E6',
  danger:         '#EF4444',
  dangerLight:    '#FEE2E2',
  muted:          '#94A3B8',
  mutedLight:     '#F1F5F9',

  // Neutrals
  text:           '#1E293B',
  textSecondary:  '#64748B',
  textMuted:      '#94A3B8',
  border:         '#E2E8F0',
  surface:        '#F8FAFC',
  background:     '#F0F4FF',
  white:          '#FFFFFF',

  // Gradient
  gradientStart:  '#FF6B6B',
  gradientEnd:    '#FF8E53',

  // Meal type colors
  morning:        '#FFB347',  // Orange
  noon:           '#87CEEB',  // Sky blue
  evening:        '#9B59B6',  // Purple
  extra:          '#2ECC71',  // Green

  // Dark mode (prefix dm_)
  dm_background:  '#0F172A',
  dm_surface:     '#1E293B',
  dm_card:        '#1E293B',
  dm_text:        '#F1F5F9',
  dm_border:      '#334155',
};

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  full: 999,
};

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

export const FONTS = {
  regular:    { fontWeight: '400' as const },
  medium:     { fontWeight: '500' as const },
  semibold:   { fontWeight: '600' as const },
  bold:       { fontWeight: '700' as const },
  extrabold:  { fontWeight: '800' as const },
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const MEAL_COLORS: Record<string, string> = {
  morning: COLORS.morning,
  noon:    COLORS.noon,
  evening: COLORS.evening,
  extra:   COLORS.extra,
};
