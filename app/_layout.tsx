import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Grain } from '@/components/Paper';
import { ThemeProvider, useTheme } from '@/design/theme';
import { motion } from '@/design/tokens';
import { DiaryProvider, useDiary } from '@/store/DiaryProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Navigation = () => {
  const { ready } = useDiary();
  const { c, scheme, reduceMotion } = useTheme();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.canvas).catch(() => {});
  }, [c.canvas]);

  return (
    <View style={[styles.root, { backgroundColor: c.canvas }]}>
      {/* Drawn once for the session rather than per screen. */}
      <Grain />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: reduceMotion ? 'fade' : 'slide_from_right',
          animationDuration: motion.screen,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="compose-orb"
          options={{
            presentation: 'modal',
            animation: reduceMotion ? 'fade' : 'slide_from_bottom',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="day/[day]"
          options={{
            presentation: 'modal',
            animation: reduceMotion ? 'fade' : 'slide_from_bottom',
            gestureEnabled: true,
          }}
        />
      </Stack>
    </View>
  );
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DiaryProvider>
            <Navigation />
          </DiaryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
