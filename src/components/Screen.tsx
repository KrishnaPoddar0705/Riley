import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useMemo } from 'react';
import { Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/theme';
import { hashUnit } from '@/utils/id';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Faint dust of stars, exactly like the reference. Static and cheap. */
const Starfield = memo(({ count = 46, seed = 'riley' }: { count?: number; seed?: string }) => {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = hashUnit(`${seed}:${i}:x`);
        const b = hashUnit(`${seed}:${i}:y`);
        const c = hashUnit(`${seed}:${i}:s`);
        return {
          left: a * SCREEN_W,
          top: b * SCREEN_H,
          size: 1 + c * 1.8,
          opacity: 0.18 + c * 0.34,
        };
      }),
    [count, seed]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: '#FFFFFF',
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
});
Starfield.displayName = 'Starfield';

/**
 * Soft colour blooms drifting behind the haze — the "subtle blue / pink / green"
 * that keeps the grey gradient from going flat.
 */
const Blooms = memo(({ tint }: { tint?: string }) => {
  const blobs = [
    { color: tint ?? '#8FA6FF', size: 340, left: -110, top: -80, opacity: 0.2 },
    { color: '#FF9EC4', size: 300, left: SCREEN_W - 190, top: 60, opacity: 0.16 },
    { color: '#8CE0C8', size: 260, left: -70, top: SCREEN_H * 0.52, opacity: 0.13 },
    { color: '#B79BFF', size: 320, left: SCREEN_W - 210, top: SCREEN_H * 0.68, opacity: 0.15 },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {blobs.map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            borderRadius: b.size / 2,
            backgroundColor: b.color,
            opacity: b.opacity,
            // A big soft shadow of the same hue does the blurring for us.
            shadowColor: b.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: b.size * 0.42,
          }}
        />
      ))}
    </View>
  );
});
Blooms.displayName = 'Blooms';

type ScreenProps = {
  children: React.ReactNode;
  /** Pull the accent blooms toward the day's emotion colour. */
  tint?: string;
  stars?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  /** Set for full-bleed screens (the globe) that handle their own insets. */
  bleed?: boolean;
};

export const Screen = ({
  children,
  tint,
  stars = true,
  edges = ['top'],
  style,
  bleed = false,
}: ScreenProps) => {
  const insets = useSafeAreaInsets();
  const Body = bleed ? View : SafeAreaView;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...palette.haze]}
        locations={[0, 0.28, 0.55, 0.8, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Blooms tint={tint} />
      {stars ? <Starfield /> : null}
      <Body
        style={[styles.body, bleed && { paddingTop: insets.top }, style]}
        {...(bleed ? {} : { edges })}
      >
        {children}
      </Body>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.haze[0] },
  body: { flex: 1 },
});

export { Starfield };
