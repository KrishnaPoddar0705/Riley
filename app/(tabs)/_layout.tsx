import { Tabs } from 'expo-router';
import React from 'react';

import { BottomNavigation } from '@/components/BottomNavigation';

/** Four destinations. The calendar lives inside Journal, not in the bar. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      tabBar={(props) => <BottomNavigation {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="globe" options={{ title: 'Globe' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
