/**
 * Menu/create.tsx
 *
 * Thin wrapper — all form behaviour lives in MenuItemForm.
 */

import React from 'react';
import MenuItemForm from './components/MenuItemForm';

export default function CreateMenuItemScreen(): React.JSX.Element {
  return <MenuItemForm mode="create" />;
}