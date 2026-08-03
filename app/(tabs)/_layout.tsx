import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '@/components/TabBar';
import { emotionColor } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import { spectrum } from '@/theme';

export default function TabsLayout() {
  const { todayMood } = useDiary();
  const accent = todayMood ? emotionColor(todayMood.emotion) : spectrum.confidence;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      tabBar={(props) => <TabBar {...props} accent={accent} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="globe" options={{ title: 'Globe' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
