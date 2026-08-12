/**
 * components/TopBar.tsx
 *
 * Reusable floating top bar with three icon-only actions:
 *   Back (router.back()) · Store Manager (placeholder) · Profile (placeholder)
 *
 * Rendered manually inside each tab's index.tsx — intentionally not mounted
 * from any layout file.
 */

import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, CircleUserRound, Store } from 'lucide-react-native';


const COLORS = {
  surface: '#FFFFFF',
  track: '#F7F1E9',
  primarySoft: '#FDEBD7',
  primaryDark: '#E2832F',
  text: '#2D2926',
  border: '#EFE8DF',
} as const;

/* ------------------------------ Icon button -------------------------------- */

interface TopBarButtonProps {
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'default' | 'highlight';
  children: React.ReactNode;
}



function TopBarButton({
  accessibilityLabel,
  onPress,
  variant = 'default',
  children,
}: TopBarButtonProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(scale, {
        toValue,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }).start();
    },
    [scale],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.88)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.button,
          variant === 'highlight' && styles.buttonHighlight,
          { transform: [{ scale }] },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* --------------------------------- TopBar ---------------------------------- */

export interface TopBarProps {
  /** Store Manager action — wired to navigation later. */
  onStorePress?: () => void;
  /** Profile action — wired to navigation later. */
  onProfilePress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function TopBar({ onStorePress, onProfilePress, style }: TopBarProps): React.JSX.Element {
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  return (
    <View style={[styles.bar, style]}>
      <TopBarButton accessibilityLabel="Go back" onPress={handleBack}>
        <ChevronLeft size={22} color={COLORS.text} strokeWidth={2.2} />
      </TopBarButton>

      <TopBarButton
        accessibilityLabel="Store manager"
        onPress={() => onStorePress?.()}
        variant="highlight"
      >
        <Store size={21} color={COLORS.primaryDark} strokeWidth={2.2} />
      </TopBarButton>

      <TopBarButton accessibilityLabel="Profile" onPress={() => router.push('/UserProfile')}>
        <CircleUserRound size={22} color={COLORS.text} strokeWidth={2} />
      </TopBarButton>
    </View>
  );
}

/* ---------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#8A6D4A',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.track,
  },
  buttonHighlight: {
    backgroundColor: COLORS.primarySoft,
  },
});

export default TopBar;