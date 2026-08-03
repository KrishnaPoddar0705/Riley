import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/design/theme';
import { MIN_TARGET, motion, space } from '@/design/tokens';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'ellipse', off: 'ellipse-outline' },
  globe: { on: 'planet', off: 'planet-outline' },
  journal: { on: 'book', off: 'book-outline' },
  settings: { on: 'ellipsis-horizontal', off: 'ellipsis-horizontal' },
};

const LABELS: Record<string, string> = {
  index: 'Today',
  globe: 'Globe',
  journal: 'Journal',
  settings: 'Settings',
};

const Tab = ({
  routeName,
  focused,
  onPress,
}: {
  routeName: string;
  focused: boolean;
  onPress: () => void;
}) => {
  const { c, t, reduceMotion } = useTheme();
  const a = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    a.value = withTiming(focused ? 1 : 0, { duration: reduceMotion ? 0 : motion.control });
  }, [focused, a, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + a.value * 0.45,
    transform: [{ scale: 1 + a.value * 0.04 }],
  }));

  const icon = ICONS[routeName] ?? ICONS.index;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={LABELS[routeName]}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? icon.on : icon.off}
          size={routeName === 'index' ? 15 : 19}
          color={focused ? c.ink : c.inkFaint}
        />
      </Animated.View>
      <Text
        style={t('caption', {
          fontSize: 11,
          color: focused ? c.ink : c.inkFaint,
          fontWeight: focused ? '600' : '400',
        })}
      >
        {LABELS[routeName]}
      </Text>
    </Pressable>
  );
};

/**
 * Four destinations, flat on the page. No floating glass slab, no creation
 * buttons hiding underneath it — making an orb happens on Today, where it
 * belongs.
 */
export const BottomNavigation = ({ state, navigation }: BottomTabBarProps) => {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.canvas,
          borderTopColor: c.line,
          paddingBottom: Math.max(insets.bottom, space.sm),
        },
      ]}
    >
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        return (
          <Tab
            key={route.key}
            routeName={route.name}
            focused={focused}
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
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: MIN_TARGET,
  },
});
