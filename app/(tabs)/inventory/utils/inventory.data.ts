/**
 * Mock data layer for the Inventory module.
 *
 * IMPORTANT — read-only by design: this module exposes NO stock-mutation
 * functions. Purchase Bills will append batches / adjust non-perishable
 * stock; Sales Bills will deduct FIFO. Swap these bodies for real API calls
 * without touching any UI.
 */

import type {
  InventoryItemPayload,
  InventoryItemWithStock,
  StockEntry,
} from './inventory.types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

let items: InventoryItemWithStock[] = [
  {
    id: 'inv_1',
    name: 'Eggs',
    image: null,
    metricType: 'pieces',
    perishable: true,
    expiryDurationDays: 10,
    currentStock: null,
    stockEntries: [
      {
        id: 'se_1',
        inventoryItemId: 'inv_1',
        quantity: 5,
        unit: 'PCS',
        createdAt: daysFromNow(-5),
        expiryDate: daysFromNow(5),
        expired: false,
      },
      {
        id: 'se_2',
        inventoryItemId: 'inv_1',
        quantity: 10,
        unit: 'PCS',
        createdAt: daysFromNow(-8),
        expiryDate: daysFromNow(2),
        expired: false,
      },
      {
        id: 'se_3',
        inventoryItemId: 'inv_1',
        quantity: 3,
        unit: 'PCS',
        createdAt: daysFromNow(-12),
        expiryDate: daysFromNow(-2),
        expired: true,
      },
    ],
  },
  {
    id: 'inv_2',
    name: 'Tomato Ketchup',
    image: null,
    metricType: 'volume',
    perishable: false,
    expiryDurationDays: null,
    currentStock: 2750,
    stockEntries: [],
  },
  {
    id: 'inv_3',
    name: 'Chicken Breast',
    image: null,
    metricType: 'weight',
    perishable: true,
    expiryDurationDays: 4,
    currentStock: null,
    stockEntries: [
      {
        id: 'se_4',
        inventoryItemId: 'inv_3',
        quantity: 800,
        unit: 'GRAM',
        createdAt: daysFromNow(-1),
        expiryDate: daysFromNow(3),
        expired: false,
      },
    ],
  },
];

/** Fetch item definitions together with their current stock state. */
export async function fetchInventoryItems(): Promise<InventoryItemWithStock[]> {
  await delay(600);
  return items.map((item) => ({
    ...item,
    // FIFO: oldest expiry first, ready for future sales deduction.
    stockEntries: [...item.stockEntries].sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
    ),
  }));
}

export async function fetchInventoryItemById(id: string): Promise<InventoryItemWithStock | null> {
  await delay(300);
  const all = await fetchInventoryItems();
  return all.find((item) => item.id === id) ?? null;
}

export async function createInventoryItem(
  payload: InventoryItemPayload,
): Promise<InventoryItemWithStock> {
  await delay(900);
  const created: InventoryItemWithStock = {
    ...payload,
    id: `inv_${Date.now()}`,
    currentStock: payload.perishable ? null : 0,
    stockEntries: [],
  };
  items = [created, ...items];
  return created;
}

export async function updateInventoryItem(
  id: string,
  payload: InventoryItemPayload,
): Promise<InventoryItemWithStock> {
  await delay(900);
  let updated: InventoryItemWithStock | null = null;
  items = items.map((item) => {
    if (item.id !== id) return item;
    // Definitions change; stock state is preserved untouched.
    updated = { ...item, ...payload, currentStock: item.currentStock, stockEntries: item.stockEntries };
    return updated;
  });
  if (!updated) throw new Error('Inventory item not found');
  return updated;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await delay(700);
  items = items.filter((item) => item.id !== id);
}

/**
 * Remove an EXPIRED batch from local view state (audit cleanup — this never
 * touches active stock). Active batches are rejected defensively.
 */
export async function removeExpiredStockEntry(entry: StockEntry): Promise<void> {
  await delay(500);
  items = items.map((item) =>
    item.id === entry.inventoryItemId
      ? { ...item, stockEntries: item.stockEntries.filter((e) => e.id !== entry.id || !e.expired) }
      : item,
  );
}