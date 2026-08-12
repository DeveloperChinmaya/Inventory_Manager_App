/**
 * Menu/edit/[id].tsx
 *
 * Loads the menu item for the route param and renders MenuItemForm in edit
 * mode. All form behaviour lives in MenuItemForm.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import MenuItemForm from '../components/MenuItemForm';
import { COLORS } from '../utils/theme';
import { fetchMenuItemById } from '../utils/menu.data';
import type { MenuItem } from '../utils/menu.types';

export default function EditMenuItemScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const result = await fetchMenuItemById(String(id));
        if (!isMounted) return;
        if (result) {
          setItem(result);
        } else {
          setNotFound(true);
        }
      } catch {
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.state} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (notFound || !item) {
    return (
      <SafeAreaView style={styles.state} edges={['top']}>
        <Text style={styles.stateText}>Menu item not found.</Text>
      </SafeAreaView>
    );
  }

  return <MenuItemForm mode="edit" initialItem={item} />;
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  stateText: { fontSize: 15, fontWeight: '500', color: COLORS.textMuted },
});