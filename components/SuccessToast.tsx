import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useColors } from '../lib/theme-context';

interface Props {
  message: string;
  visible: boolean;
  onHide: () => void;
}

export default function SuccessToast({ message, visible, onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const colors = useColors();

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, backgroundColor: colors.success }]}>
      <Text style={styles.text}>✓ {message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
