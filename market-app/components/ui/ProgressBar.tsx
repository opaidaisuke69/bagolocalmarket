import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

interface ProgressBarProps {
  visible: boolean;
}

/**
 * Progress bar illusion — shows a smooth animation at the top
 * that gives feedback during loading states.
 */
export function ProgressBar({ visible }: ProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      widthAnim.setValue(0);
      Animated.sequence([
        Animated.timing(widthAnim, { toValue: 0.7, duration: 1500, useNativeDriver: false }),
        Animated.timing(widthAnim, { toValue: 0.85, duration: 3000, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.timing(widthAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start(() => {
        setTimeout(() => widthAnim.setValue(0), 200);
      });
    }
  }, [visible, widthAnim]);

  if (!visible && (widthAnim as any).__getValue?.() === 0) return null;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.bar,
          {
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  bar: {
    height: '100%',
    backgroundColor: COLORS.accent[400],
    borderRadius: 2,
  },
});
