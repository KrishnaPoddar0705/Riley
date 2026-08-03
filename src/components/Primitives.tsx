import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  AccessibilityProps,
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
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { MIN_TARGET, motion, radius, space } from '@/design/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Every tappable thing in Riley responds the same way: a small, fast sink, no
 * bounce on release. Haptics fire only where something is actually committed.
 */
const usePress = (enabled = true) => {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - p.value * (reduceMotion ? 0 : 0.018) }],
    opacity: 1 - p.value * 0.06,
  }));
  const onPressIn = () => {
    if (enabled) p.value = withTiming(1, { duration: motion.press });
  };
  const onPressOut = () => {
    p.value = withTiming(0, { duration: motion.press });
  };
  return { style, onPressIn, onPressOut };
};

/* -------------------------------------------------------------------------- */

type NeuProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** `raised` presses out of the page; `inset` is a well you press into. */
  variant?: 'raised' | 'inset' | 'flat';
  level?: 'soft' | 'normal' | 'floating';
  round?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: 'none' | 'select' | 'commit';
} & AccessibilityProps;

/**
 * The one tactile surface. Used for the orb canvas, the save action, colour
 * wells and the selected calendar day — and nowhere else, so that "extruded"
 * keeps meaning "you can touch this".
 */
export const NeumorphicControl = ({
  children,
  onPress,
  onLongPress,
  variant = 'raised',
  level = 'normal',
  round = 'md',
  style,
  disabled,
  haptic = 'select',
  ...a11y
}: NeuProps) => {
  const { raised, inset } = useTheme();
  const press = usePress(!disabled && !!onPress);

  const surface =
    variant === 'raised' ? raised(level) : variant === 'inset' ? inset() : undefined;

  const body = (
    <Animated.View
      style={[
        surface,
        { borderRadius: radius[round], opacity: disabled ? 0.4 : 1 },
        onPress ? press.style : undefined,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!onPress && !onLongPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onLongPress={onLongPress}
      onPress={() => {
        if (haptic === 'commit') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else if (haptic === 'select') {
          Haptics.selectionAsync().catch(() => {});
        }
        onPress?.();
      }}
      {...a11y}
    >
      {body}
    </Pressable>
  );
};

/* -------------------------------------------------------------------------- */

type QuietButtonProps = {
  label: string;
  onPress?: () => void;
  /** `primary` is the one committed action on a screen. There is never a second. */
  tone?: 'primary' | 'plain' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export const QuietButton = ({
  label,
  onPress,
  tone = 'plain',
  disabled,
  style,
  accessibilityHint,
}: QuietButtonProps) => {
  const { c, t, raised } = useTheme();
  const press = usePress(!disabled);

  const primary = tone === 'primary';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        Haptics.impactAsync(
          primary ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        ).catch(() => {});
        onPress?.();
      }}
      style={[
        styles.button,
        primary ? raised('normal') : null,
        primary
          ? { backgroundColor: c.ink, borderColor: c.ink, shadowColor: c.drop }
          : { borderColor: c.line, backgroundColor: 'transparent' },
        { opacity: disabled ? 0.38 : 1 },
        press.style,
        style,
      ]}
    >
      <Text
        style={t('heading', {
          color: primary ? c.canvas : tone === 'danger' ? c.danger : c.ink,
        })}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

/* -------------------------------------------------------------------------- */

/** Bare icon-sized tap target. No chrome — chrome is reserved for real controls. */
export const IconButton = ({
  children,
  onPress,
  label,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const press = usePress();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={[styles.icon, press.style, style]}
    >
      {children}
    </AnimatedPressable>
  );
};

/* -------------------------------------------------------------------------- */

/**
 * The date line. Small, tracked caps and, at most, one serif word — this is the
 * only place the serif appears on most screens.
 */
export const DateHeader = ({
  meta,
  title,
  accent,
  style,
}: {
  meta: string;
  title?: string;
  /** Rendered in the serif italic. Keep it to a word or two. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const { c, t } = useTheme();
  return (
    <View style={style}>
      <Text style={t('meta', { color: c.inkFaint })} accessibilityRole="header">
        {meta.toUpperCase()}
      </Text>
      {title || accent ? (
        <Text style={[t('title'), { marginTop: space.xs }]}>
          {title}
          {title && accent ? ' ' : ''}
          {accent ? <Text style={t('display', { fontSize: 26, lineHeight: 32 })}>{accent}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
};

/* -------------------------------------------------------------------------- */

/** A hairline. Used instead of wrapping things in yet another rounded box. */
export const Rule = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }, style]} />;
};

/** Quiet inline text button, for subordinate actions. */
export const TextAction = ({
  label,
  onPress,
  align = 'left',
  style,
  textStyle,
}: {
  label: string;
  onPress?: () => void;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) => {
  const { c, t } = useTheme();
  const press = usePress();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={[
        { minHeight: MIN_TARGET, justifyContent: 'center', alignItems: align === 'center' ? 'center' : 'flex-start' },
        press.style,
        style,
      ]}
    >
      <Text style={[t('label', { color: c.inkSoft }), textStyle]}>{label}</Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    minWidth: MIN_TARGET,
    minHeight: MIN_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
