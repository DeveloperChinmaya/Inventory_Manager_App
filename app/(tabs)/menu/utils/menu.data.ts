/**
 * Mock data layer for the Menu module.
 *
 * Replace each function body with the real API call — every screen and
 * component consumes only these functions, so no UI changes are needed.
 */

import type { InventoryItem, MenuItem, MenuItemPayload } from './menu.types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let menuItems: MenuItem[] = [
  {
    id: 'menu_1',
    name: 'Chicken Burger',
    price: 220,
    image: null,
    rawMaterials: [
      { inventoryItemId: 'inv_1', inventoryName: 'Chicken Breast', metricType: 'weight', baseQuantity: 150 },
      { inventoryItemId: 'inv_2', inventoryName: 'Burger Bun', metricType: 'pieces', baseQuantity: 2 },
      { inventoryItemId: 'inv_3', inventoryName: 'Mayonnaise', metricType: 'volume', baseQuantity: 30 },
    ],
  },
  {
    id: 'menu_2',
    name: 'Cold Coffee',
    price: 140,
    image: null,
    rawMaterials: [
      { inventoryItemId: 'inv_4', inventoryName: 'Milk', metricType: 'volume', baseQuantity: 200 },
      { inventoryItemId: 'inv_5', inventoryName: 'Coffee Beans', metricType: 'weight', baseQuantity: 18 },
    ],
  },
];

const inventoryItems: InventoryItem[] = [
  { id: 'inv_1', name: 'Chicken Breast', metricType: 'weight', image: null },
  { id: 'inv_2', name: 'Burger Bun', metricType: 'pieces', image: null },
  { id: 'inv_3', name: 'Mayonnaise', metricType: 'volume', image: null },
  { id: 'inv_4', name: 'Milk', metricType: 'volume', image: null },
  { id: 'inv_5', name: 'Coffee Beans', metricType: 'weight', image: null },
  { id: 'inv_6', name: 'Cheese Slice', metricType: 'pieces', image: null },
  { id: 'inv_7', name: 'Olive Oil', metricType: 'volume', image: null },
  { id: 'inv_8', name: 'Flour', metricType: 'weight', image: null },
];

export async function fetchMenuItems(): Promise<MenuItem[]> {
  await delay(600);
  return [...menuItems];
}

export async function fetchMenuItemById(id: string): Promise<MenuItem | null> {
  await delay(300);
  return menuItems.find((item) => item.id === id) ?? null;
}

export async function createMenuItem(payload: MenuItemPayload): Promise<MenuItem> {
  await delay(900);
  const created: MenuItem = { ...payload, id: `menu_${Date.now()}` };
  menuItems = [created, ...menuItems];
  return created;
}

export async function updateMenuItem(id: string, payload: MenuItemPayload): Promise<MenuItem> {
  await delay(900);
  const updated: MenuItem = { ...payload, id };
  menuItems = menuItems.map((item) => (item.id === id ? updated : item));
  return updated;
}

export async function deleteMenuItem(id: string): Promise<void> {
  await delay(700);
  menuItems = menuItems.filter((item) => item.id !== id);
}

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  await delay(400);
  return [...inventoryItems];
}