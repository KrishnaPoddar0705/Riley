import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import type { Emotion } from '@/emotions/catalog';
import { palette, radius, space, type } from '@/theme';

const ITEM_W = 92;

type ItemProps = {
  emotion: Emotion;
  index: number;
  scrollX: SharedValue<number>;
  /** 0..1 strength of the centred emotion; falls off as an item leaves centre. */
  strength: SharedValue<number>;
  active: boolean;
};

const DialItem = ({ emotion, index, scrollX, strength, active }: ItemProps) => {
  const wrap = useAnimatedStyle(() => {
    'worklet';
    const d = Math.abs(scrollX.value / ITEM_W - index);
    const near = Math.max(0, 1 - d);
    return {
      transform: [{ scale: 0.78 + near * 0.34 }, { translateY: near * -6 }],
      opacity: 0.34 + near * 0.66,
    };
  });

  const plate = useAnimatedStyle(() => {
    'worklet';
    const d = Math.abs(scrollX.value / ITEM_W - index);
    const near = Math.max(0, 1 - Math.min(1, d * 1.6));
    return { opacity: near };
  });

  const size = 26;

  return (
    <Animated.View style={[styles.item, wrap]}>
      <View style={styles.orbSlot}>
        <Animated.View style={[styles.plate, { borderColor: `${emotion.color}66` }, plate]} />
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: emotion.color,
            shadowColor: emotion.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.55,
            shadowRadius: 9,
          }}
        >
          <View style={styles.spec} />
        </View>
      </View>
      <Text
        numberOfLines={1}
        style={[
          type.caption,
          styles.label,
          active && { color: palette.ink, fontWeight: '700' },
        ]}
      >
        {emotion.label}
      </Text>
      <AnimatedPercent index={index} scrollX={scrollX} strength={strength} />
    </Animated.View>
  );
};

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * The little "99%" under each orb. Driven straight off shared values so the
 * strip stays smooth while you scrub — no React re-render per frame.
 */
const AnimatedPercent = ({
  index,
  scrollX,
  strength,
}: {
  index: number;
  scrollX: SharedValue<number>;
  strength: SharedValue<number>;
}) => {
  const props = useAnimatedProps(() => {
    'worklet';
    const d = Math.abs(scrollX.value / ITEM_W - index);
    const near = Math.max(0, 1 - Math.min(1, d));
    const pct = Math.round(near * near * strength.value * 100);
    return { text: `${pct}%`, defaultValue: `${pct}%` } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      animatedProps={props}
      style={styles.percent}
    />
  );
};

type DialProps = {
  emotions: Emotion[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Live intensity 0..1, shown as the percentage under the centred orb. */
  strength: SharedValue<number>;
};

/**
 * Snapping carousel of emotions. Whichever orb sits under the centre line is
 * the one the day gets tagged with.
 */
export const EmotionDial = ({ emotions, index, onIndexChange, strength }: DialProps) => {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(index * ITEM_W);
  const ref = useRef<Animated.ScrollView>(null);
  const lastReported = useRef(index);
  const sidePad = (width - ITEM_W) / 2;

  const report = (next: number) => {
    if (next === lastReported.current) return;
    lastReported.current = next;
    Haptics.selectionAsync().catch(() => {});
    onIndexChange(next);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      const next = Math.round(e.contentOffset.x / ITEM_W);
      runOnJS(report)(Math.max(0, Math.min(emotions.length - 1, next)));
    },
  });

  // Keep the strip in sync when the valence toggle swaps the whole list out.
  useEffect(() => {
    lastReported.current = index;
    scrollX.value = index * ITEM_W;
    ref.current?.scrollTo({ x: index * ITEM_W, animated: false });
  }, [emotions, index, scrollX]);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_W}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: sidePad }}
      >
        {emotions.map((e, i) => (
          <DialItem
            key={e.key}
            emotion={e}
            index={i}
            scrollX={scrollX}
            strength={strength}
            active={i === index}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { height: 118 },
  item: { width: ITEM_W, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12 },
  orbSlot: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  plate: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    shadowColor: palette.clayShadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  spec: {
    position: 'absolute',
    top: 4,
    left: 5,
    width: 10,
    height: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.65)',
    transform: [{ rotate: '-18deg' }],
  },
  label: { marginTop: space.sm, maxWidth: ITEM_W - 8, textAlign: 'center' },
  percent: {
    ...type.caption,
    fontSize: 11,
    color: palette.inkFaint,
    textAlign: 'center',
    width: ITEM_W - 8,
    paddingVertical: 0,
    marginTop: 1,
  },
});
