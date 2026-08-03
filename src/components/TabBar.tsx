import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clay, motion, palette, radius, space, type } from '@/theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'home', off: 'home-outline' },
  journal: { on: 'book', off: 'book-outline' },
  globe: { on: 'planet', off: 'planet-outline' },
  calendar: { on: 'calendar', off: 'calendar-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

const LABELS: Record<string, string> = {
  index: 'Home',
  journal: 'Journal',
  globe: 'Globe',
  calendar: 'Calendar',
  profile: 'Profile',
};

const TabButton = ({
  focused,
  routeName,
  onPress,
  onLongPress,
  accent,
}: {
  focused: boolean;
  routeName: string;
  onPress: () => void;
  onLongPress: () => void;
  accent: string;
}) => {
  const a = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    a.value = withSpring(focused ? 1 : 0, motion.spring);
  }, [focused, a]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -a.value * 2 }, { scale: 1 + a.value * 0.06 }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: a.value,
    transform: [{ scale: 0.4 + a.value * 0.6 }],
  }));

  const icon = ICONS[routeName] ?? ICONS.index;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={LABELS[routeName]}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
      hitSlop={6}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? icon.on : icon.off}
          size={21}
          color={focused ? accent : palette.inkFaint}
        />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[
          type.caption,
          styles.label,
          focused && { color: palette.ink, fontWeight: '700' },
        ]}
      >
        {LABELS[routeName]}
      </Text>
      <Animated.View style={[styles.dot, { backgroundColor: accent }, dotStyle]} />
    </Pressable>
  );
};

/** Floating glass tab bar. `accent` follows today's emotion colour. */
export const TabBar = ({ state, navigation, accent }: BottomTabBarProps & { accent: string }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={[clay, styles.bar]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 46 : 0}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.wash]} />
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <TabButton
              key={route.key}
              routeName={route.name}
              focused={focused}
              accent={accent}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(route.name);
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 66,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  wash: { backgroundColor: 'rgba(255,255,255,0.62)' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontSize: 10 },
  dot: { position: 'absolute', bottom: 7, width: 4, height: 4, borderRadius: 2 },
});
