import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { clay, clayTight, motion, palette, radius, space, type } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Frosted, softly-lit surface. The building block for nearly every panel. */
export const ClayCard = ({
  children,
  style,
  tight = false,
  intensity = 34,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tight?: boolean;
  intensity?: number;
}) => (
  <View style={[tight ? clayTight : clay, styles.cardShell, style]}>
    <BlurView
      intensity={Platform.OS === 'ios' ? intensity : 0}
      tint="light"
      style={StyleSheet.absoluteFill}
    />
    <View style={[StyleSheet.absoluteFill, styles.cardWash]} />
    <View style={styles.cardInner}>{children}</View>
  </View>
);

/** Card that responds to touch with a small, springy give. */
export const PressableCard = ({
  children,
  style,
  onPress,
  haptic = true,
  ...rest
}: Omit<PressableProps, 'style'> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) => {
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
    opacity: 1 - press.value * 0.08,
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        press.value = withSpring(1, motion.springSnappy);
      }}
      onPressOut={() => {
        press.value = withSpring(0, motion.springSnappy);
      }}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      style={[animated, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

/** The wide, glassy CTA at the bottom of a flow. */
export const PrimaryButton = ({
  label,
  onPress,
  disabled = false,
  tint,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.02 }],
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        press.value = withSpring(1, motion.springSnappy);
      }}
      onPressOut={() => {
        press.value = withSpring(0, motion.springSnappy);
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      style={[
        clay,
        styles.primary,
        { opacity: disabled ? 0.42 : 1 },
        tint
          ? { shadowColor: tint, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } }
          : null,
        animated,
        style,
      ]}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 24 : 0} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.primaryWash]} />
      {tint ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.14, borderRadius: radius.pill }]}
        />
      ) : null}
      <Text style={styles.primaryLabel}>{label}</Text>
    </AnimatedPressable>
  );
};

/** Small circular glass control — the X, the undo arrow, the bell. */
export const GlassButton = ({
  children,
  onPress,
  size = 44,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) => (
  <PressableCard
    onPress={onPress}
    style={[
      clayTight,
      styles.glass,
      { width: size, height: size, borderRadius: size / 2 },
      style,
    ]}
  >
    {children}
  </PressableCard>
);

/** Positive / Negative style segmented control. */
export const SegmentedPills = <T extends string>({
  options,
  value,
  onChange,
  tint,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  tint?: string;
}) => (
  <View style={styles.pillRow}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <Pill
          key={o.value}
          label={o.label}
          active={active}
          tint={tint}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onChange(o.value);
          }}
        />
      );
    })}
  </View>
);

export const Pill = ({
  label,
  active,
  onPress,
  tint,
  style,
  textStyle,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tint?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) => {
  const a = useSharedValue(active ? 1 : 0);
  React.useEffect(() => {
    a.value = withTiming(active ? 1 : 0, { duration: motion.fast });
  }, [active, a]);

  const animated = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,255,255,${0.34 + a.value * 0.55})`,
    shadowOpacity: 0.2 + a.value * 0.8,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        clayTight,
        styles.pill,
        tint && active ? { borderColor: `${tint}55` } : null,
        animated,
        style,
      ]}
    >
      <Text
        style={[
          type.label,
          { color: active ? palette.ink : palette.inkFaint, fontWeight: active ? '700' : '600' },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

/** Section heading: clean sans word + a script word, like the reference. */
export const ScriptHeading = ({
  plain,
  script,
  align = 'center',
  size = 26,
}: {
  plain?: string;
  script?: string;
  align?: 'center' | 'left';
  size?: number;
}) => (
  <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
    {plain ? (
      <Text style={[type.title, { fontSize: size, textAlign: align }]}>{plain}</Text>
    ) : null}
    {script ? (
      <Text style={[type.scriptSoft(size * 0.95), { marginTop: -2 }]}>{script}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  cardShell: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  cardWash: { backgroundColor: 'rgba(255,255,255,0.56)' },
  glass: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    overflow: 'hidden',
  },
  cardInner: { padding: space.lg },
  primary: {
    height: 58,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  primaryWash: { backgroundColor: 'rgba(255,255,255,0.6)' },
  primaryLabel: {
    ...type.heading,
    fontSize: 16.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pillRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  pill: {
    paddingHorizontal: 20,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
});
