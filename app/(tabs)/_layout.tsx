/**
 * (tabs)/_layout.tsx
 *
 * Main tab navigator. Renders a custom floating "liquid glass" bottom tab bar
 * (frosted blur pill, soft shadows, animated active indicator, springy press
 * feedback) with exactly four tabs, each backed by its own Stack layout.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard,
  Package,
  Receipt,
  UtensilsCrossed,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

/* ---------------------------------- Theme --------------------------------- */

const COLORS = {
  background: '#FFFFFF',
  primary: '#F2A259',
  primaryDark: '#E2832F',
  primaryFaint: '#FDF4E8',
  text: '#2D2926',
  textMuted: '#9A9186',
} as const;

/* ------------------------------- Tab config ------------------------------- */

interface TabConfig {
  icon: LucideIcon;
  label: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  dashboard: { icon: LayoutDashboard, label: 'Dashboard' },
  billing: { icon: Receipt, label: 'Billing' },
  menu: { icon: UtensilsCrossed, label: 'Menu' },
  inventory: { icon: Package, label: 'Inventory' },
};

/* --------------------------------- Tab item -------------------------------- */

interface GlassTabItemProps {
  routeKey: string;
  routeName: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function GlassTabItem({
  routeKey,
  routeName,
  focused,
  onPress,
  onLongPress,
}: GlassTabItemProps): React.JSX.Element {
  const config = TAB_CONFIG[routeName] ?? { icon: LayoutDashboard, label: routeName };
  const Icon = config.icon;

  const activeAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 240,
      mass: 0.8,
    }).start();
  }, [focused, activeAnim]);

  const animatePress = useCallback(
    (toValue: number) => {
      Animated.spring(pressScale, {
        toValue,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    },
    [pressScale],
  );

  return (
    <Pressable
      key={routeKey}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animatePress(0.92)}
      onPressOut={() => animatePress(1)}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label}
    >
      <Animated.View style={[styles.tabItemInner, { transform: [{ scale: pressScale }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            {
              opacity: activeAnim,
              transform: [
                { scale: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              ],
            },
          ]}
        />
        <Icon
          size={22}
          color={focused ? COLORS.primaryDark : COLORS.textMuted}
          strokeWidth={focused ? 2.4 : 2}
        />
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------- Glass tab bar ----------------------------- */

function GlassTabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBarShadow,
        { bottom: Math.max(insets.bottom, 10) + 6 },
      ]}
    >
      <View style={styles.tabBarClip}>
        <BlurView
          intensity={55}
          tint="light"
          style={styles.blur}
          {...(Platform.OS === 'android'
            ? { experimentalBlurMethod: 'dimezisBlurView' as const }
            : {})}
        >
          {state.routes.map((route, index) => {
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <GlassTabItem
                key={route.key}
                routeKey={route.key}
                routeName={route.name}
                focused={focused}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

/* --------------------------------- Layout ---------------------------------- */

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{ headerShown: false }}
     
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
    </Tabs>
  );
}

/* ---------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  tabBarShadow: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 28,
    shadowColor: '#8A6D4A',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  tabBarClip: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.55)', // frosted fallback tint
  },
  blur: {
    flexDirection: 'row',
    height: 66,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  tabItem: {
    flex: 1,
    height: '100%',
  },
  tabItemInner: {
    flex: 1,
    margin: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: COLORS.primaryFaint,
  },
  tabLabel: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
});