import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  colors: typeof lightColors;
}

const lightColors = {
  primary:        '#FF6B6B',
  primaryLight:   '#FFE8E8',
  secondary:      '#4ECDC4',
  secondaryLight: '#E0F7F6',
  accent:         '#FFE66D',
  success:        '#22C55E',
  successLight:   '#DCFCE7',
  warning:        '#F97316',
  warningLight:   '#FFF0E6',
  danger:         '#EF4444',
  dangerLight:    '#FEE2E2',
  muted:          '#94A3B8',
  mutedLight:     '#F1F5F9',
  text:           '#1E293B',
  textSecondary:  '#64748B',
  textMuted:      '#94A3B8',
  border:         '#E2E8F0',
  surface:        '#F8FAFC',
  background:     '#F0F4FF',
  card:           '#FFFFFF',
  white:          '#FFFFFF',
  gradientStart:  '#FF6B6B',
  gradientEnd:    '#FF8E53',
  morning:        '#FFB347',
  noon:           '#87CEEB',
  evening:        '#9B59B6',
  extra:          '#2ECC71',
  tabBar:         '#FFFFFF',
  tabBarBorder:   '#F1F5F9',
  inputBg:        '#F8FAFC',
};

const darkColors: typeof lightColors = {
  primary:        '#FF6B6B',
  primaryLight:   '#3D1515',
  secondary:      '#4ECDC4',
  secondaryLight: '#0D2E2C',
  accent:         '#FFE66D',
  success:        '#22C55E',
  successLight:   '#052E16',
  warning:        '#F97316',
  warningLight:   '#2C1500',
  danger:         '#EF4444',
  dangerLight:    '#2D0707',
  muted:          '#64748B',
  mutedLight:     '#1E293B',
  text:           '#F1F5F9',
  textSecondary:  '#94A3B8',
  textMuted:      '#64748B',
  border:         '#334155',
  surface:        '#1E293B',
  background:     '#0F172A',
  card:           '#1E293B',
  white:          '#FFFFFF',
  gradientStart:  '#FF6B6B',
  gradientEnd:    '#FF8E53',
  morning:        '#C07A20',
  noon:           '#1E6B8C',
  evening:        '#6B3580',
  extra:          '#1A8A45',
  tabBar:         '#1E293B',
  tabBarBorder:   '#334155',
  inputBg:        '#0F172A',
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  isDark: false,
  setMode: () => {},
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem('theme_mode', newMode);
  };

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;

export { lightColors, darkColors };
