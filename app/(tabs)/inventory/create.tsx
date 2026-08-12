/**
 * Inventory/create.tsx
 *
 * Thin wrapper — all form behaviour lives in InventoryItemForm.
 */

import React from 'react';
import InventoryItemForm from './components/InventoryItemForm';

export default function CreateInventoryItemScreen(): React.JSX.Element {
  return <InventoryItemForm mode="create" />;
}