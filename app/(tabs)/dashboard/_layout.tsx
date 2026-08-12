/**
 * Dashboard tab stack — future Dashboard screens push onto this stack
 * independently of the other tabs.
 */

import React from 'react';
import { Stack } from 'expo-router';

export default function DashboardLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}