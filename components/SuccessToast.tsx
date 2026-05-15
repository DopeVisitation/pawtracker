import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useColors } from '../lib/theme-context';

export interface FeedSuccessData {
  foodEmoji?: string;
  foodName?: string;
  eatenEmoji?: string;
  eatenLabel?: string;
}

interface Props {
  message: string;
  visible: boolean;
  onHide: () => void;
  feedData?: FeedSuccessData;
}

export default function SuccessToast({ message, visible, onHide, feedData }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const colors = useColors();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 20, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 2400);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const hasDetail = feedData && (feedData.foodEmoji || feedData.eatenEmoji);

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }], backgroundColor: colors.card },
        styles.shadow,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.successLight }]}>
        <Text style={styles.checkIcon}>✓</Text>
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]}>{message}</Text>
        {hasDetail && (
          <View style={styles.detailRow}>
            {feedData.foodEmoji && (
              <Text style={styles.detailEmoji}>{feedData.foodEmoji}</Text>
            )}
            {feedData.foodName && (
              <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                {feedData.foodName}
              </Text>
            )}
            {feedData.eatenEmoji && (
              <Text style={styles.detailEmoji}>{feedData.eatenEmoji}</Text>
            )}
            {feedData.eatenLabel && (
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {feedData.eatenLabel}
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 108,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    zIndex: 9999,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  checkIcon:   { fontSize: 20, color: '#166534', fontWeight: '800' },
  textBlock:   { flex: 1 },
  title:       { fontSize: 15, fontWeight: '700' },
  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  detailEmoji: { fontSize: 16 },
  detailText:  { fontSize: 12, fontWeight: '500', flex: 1 },
});
