import React, { memo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { fill } from '@/theme';
import { clamp } from '@/utils/id';

type OrbProps = {
  size: number;
  color: string;
  /** 0..1 — drives glow spread and inner saturation. */
  intensity?: number;
  /** Hollow, desaturated orb for days with nothing logged. */
  ghost?: boolean;
  style?: ViewStyle;
};

/**
 * The lightweight orb: two plain Views. Used by the hundreds on the globe, so
 * it deliberately avoids SVG and blur.
 */
export const Orb = memo(({ size, color, intensity = 0.8, ghost = false, style }: OrbProps) => {
  const i = clamp(intensity, 0, 1);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ghost ? 'rgba(255,255,255,0.55)' : color,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: ghost ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
          shadowColor: ghost ? 'rgba(140,130,175,1)' : color,
          shadowOffset: { width: 0, height: size * 0.14 },
          shadowOpacity: ghost ? 0.18 : 0.32 + i * 0.34,
          shadowRadius: size * (ghost ? 0.24 : 0.34 + i * 0.2),
        },
        style,
      ]}
    >
      {/* specular highlight — the thing that reads as "glass" */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.13,
          left: size * 0.19,
          width: size * 0.42,
          height: size * 0.32,
          borderRadius: size * 0.21,
          backgroundColor: ghost ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.62)',
          transform: [{ rotate: '-18deg' }],
        }}
      />
      {/* bounce light along the lower rim */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.08,
          alignSelf: 'center',
          width: size * 0.5,
          height: size * 0.16,
          borderRadius: size * 0.1,
          backgroundColor: 'rgba(255,255,255,0.22)',
        }}
      />
    </View>
  );
});

Orb.displayName = 'Orb';

type HeroOrbProps = {
  size: number;
  color: string;
  intensity?: number;
  /** Slow inhale/exhale scale. Off for static contexts. */
  breathing?: boolean;
};

/**
 * The showpiece orb — real radial gradient, layered halo, and a slow breath.
 * Only ever one or two on screen.
 */
export const HeroOrb = ({ size, color, intensity = 0.85, breathing = true }: HeroOrbProps) => {
  const breath = useSharedValue(0);

  React.useEffect(() => {
    if (!breathing) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breathing, breath]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.035 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + breath.value * 0.22,
    transform: [{ scale: 1.02 + breath.value * 0.1 }],
  }));

  const i = clamp(intensity, 0, 1);
  const r = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          fill,
          {
            borderRadius: r,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.55,
            shadowRadius: 46 + i * 26,
          },
          haloStyle,
        ]}
      />
      <Animated.View style={bodyStyle}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="orbBody" cx="38%" cy="30%" r="78%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.92} />
              <Stop offset="26%" stopColor={color} stopOpacity={0.55 + i * 0.25} />
              <Stop offset="76%" stopColor={color} stopOpacity={0.95} />
              <Stop offset="100%" stopColor={color} stopOpacity={1} />
            </RadialGradient>
            <RadialGradient id="orbRim" cx="50%" cy="50%" r="50%">
              <Stop offset="82%" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.7} />
            </RadialGradient>
            <RadialGradient id="orbSpec" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={r} cy={r} r={r - 1} fill="url(#orbBody)" />
          <Circle cx={r} cy={r} r={r - 1} fill="url(#orbRim)" />
          <Circle cx={r * 0.72} cy={r * 0.58} r={r * 0.3} fill="url(#orbSpec)" />
        </Svg>
      </Animated.View>
    </View>
  );
};
