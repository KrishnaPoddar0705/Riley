import React, { memo, useMemo } from 'react';
import { Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { hashUnit } from '@/utils/id';

const { width: W, height: H } = Dimensions.get('screen');

/**
 * Paper grain. Static, drawn once behind the whole app, and barely there — if
 * you can consciously see it, it is too strong. Rendered at the root rather
 * than per screen so it costs one layout pass for the session.
 */
export const Grain = memo(() => {
  const { c } = useTheme();
  const specks = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        left: hashUnit(`g${i}x`) * W,
        top: hashUnit(`g${i}y`) * H,
        size: 0.8 + hashUnit(`g${i}s`) * 1.5,
      })),
    []
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {specks.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: c.grain,
          }}
        />
      ))}
    </View>
  );
});
Grain.displayName = 'Grain';

/**
 * A screen. Just paper and safe areas — no gradient, no blobs, no card. The
 * page is meant to disappear so the orbs are the only thing with colour.
 */
export const Paper = ({
  children,
  edges = ['top'],
  style,
  padded = true,
}: {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  padded?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: c.canvas }, padded && styles.padded, style]}
    >
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
});
