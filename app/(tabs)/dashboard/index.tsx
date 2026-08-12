/**
 * Dashboard — placeholder screen. Real content is implemented later.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import TopBar from '../../../screen_components/home_screen/TopBar';

export default function DashboardScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />
      <TopBar />
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard Screen</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#9A9186', letterSpacing: 0.2 },
});