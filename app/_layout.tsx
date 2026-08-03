import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DiaryProvider, useDiary } from '@/store/DiaryProvider';
import { palette } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Navigation = () => {
  const { ready } = useDiary();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="check-in"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: true }}
      />
      <Stack.Screen
        name="compose"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: true }}
      />
      <Stack.Screen
        name="day/[day]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: true }}
      />
      <Stack.Screen
        name="entry/[id]"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: true }}
      />
    </Stack>
  );
};

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.haze[0]).catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <DiaryProvider>
          <StatusBar style="dark" />
          <Navigation />
        </DiaryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.haze[0] },
});
