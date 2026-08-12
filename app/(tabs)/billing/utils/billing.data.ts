/**
 * Mock data layer for the Billing module — the ONLY layer allowed to mutate
 * inventory stock.
 *
 *   Sale invoice     → reads menu recipes → deducts stock FIFO
 *                      (oldest non-expired batch first; expired batches are
 *                      skipped, never consumed).
 *   Purchase invoice → non-perishable: currentStock += quantity
 *                      perishable: creates a NEW independent batch
 *                      (expiryDate = purchaseDate + expiryDurationDays);
 *                      batches are never merged.
 *
 * All quantities are normalized to base units (GRAM / ML / PCS) before any
 * stock math. Swap these bodies for real API calls without touching the UI.
 */

import type { Bill, BillLine, BillingInventoryItem, BillingMenuItem, BillType, Unit } from './billing.types';
import type { MetricType } from './billing.types';
import { toBaseQuantity } from './billing.utils';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

/* --------------------------- Internal inventory state ---------------------- */

interface StockBatch {
  id: string;
  quantity: number; // base units
  createdAt: string;
  expiryDate: string;
}

interface InventoryRecord extends BillingInventoryItem {
  currentStock: number; // non-perishable running total (base units)
  batches: StockBatch[]; // perishable, FIFO order (oldest expiry first)
}

const inventory: InventoryRecord[] = [
  {
    id: 'inv_1', name: 'Chicken Breast', image: null, metricType: 'weight',
    perishable: true, expiryDurationDays: 4, purchasePrice: 0.28,
    currentStock: 0,
    batches: [
      { id: 'b_1', quantity: 800, createdAt: daysFromNow(-1), expiryDate: daysFromNow(3) },
      { id: 'b_2', quantity: 1200, createdAt: daysFromNow(-3), expiryDate: daysFromNow(1) },
    ],
  },
  {
    id: 'inv_2', name: 'Burger Bun', image: null, metricType: 'pieces',
    perishable: true, expiryDurationDays: 5, purchasePrice: 12,
    currentStock: 0,
    batches: [{ id: 'b_3', quantity: 40, createdAt: daysFromNow(-2), expiryDate: daysFromNow(3) }],
  },
  {
    id: 'inv_3', name: 'Mayonnaise', image: null, metricType: 'volume',
    perishable: false, expiryDurationDays: null, purchasePrice: 0.35,
    currentStock: 2750, batches: [],
  },
  {
    id: 'inv_4', name: 'Potatoes', image: null, metricType: 'weight',
    perishable: false, expiryDurationDays: null, purchasePrice: 0.04,
    currentStock: 12000, batches: [],
  },
  {
    id: 'inv_5', name: 'Milk', image: null, metricType: 'volume',
    perishable: true, expiryDurationDays: 3, purchasePrice: 0.06,
    currentStock: 0,
    batches: [{ id: 'b_4', quantity: 5000, createdAt: daysFromNow(-1), expiryDate: daysFromNow(2) }],
  },
];

/* ------------------------------- Menu recipes ------------------------------ */

interface RecipeEntry {
  inventoryItemId: string;
  baseQuantity: number; // per single menu item sold
}

const menuItems: (BillingMenuItem & { recipe: RecipeEntry[] })[] = [
  {
    id: 'menu_1', name: 'Chicken Burger', price: 220, image: null,
    recipe: [
      { inventoryItemId: 'inv_1', baseQuantity: 150 },
      { inventoryItemId: 'inv_2', baseQuantity: 2 },
      { inventoryItemId: 'inv_3', baseQuantity: 30 },
    ],
  },
  {
    id: 'menu_2', name: 'French Fries', price: 120, image: null,
    recipe: [{ inventoryItemId: 'inv_4', baseQuantity: 180 }],
  },
  {
    id: 'menu_3', name: 'Cold Coffee', price: 140, image: null,
    recipe: [{ inventoryItemId: 'inv_5', baseQuantity: 200 }],
  },
];

/* -------------------------------- Bill store ------------------------------- */

let bills: Bill[] = [
  {
    id: 'inv-2041', type: 'sale', partyName: 'Walk-in Customer',
    lines: [
      { refId: 'menu_1', name: 'Chicken Burger', image: null, quantity: 2, unitPrice: 220 },
      { refId: 'menu_2', name: 'French Fries', image: null, quantity: 1, unitPrice: 120 },
    ],
    total: 560, status: 'completed', createdAt: new Date().toISOString(),
  },
  {
    id: 'inv-2040', type: 'purchase', partyName: 'Fresh Farms',
    lines: [
      {
        refId: 'inv_1', name: 'Chicken Breast', image: null, quantity: 5, unitPrice: 0.28,
        metricType: 'weight', baseQuantity: 5000,
      },
    ],
    total: 1400, status: 'completed',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

/* --------------------------------- Queries --------------------------------- */

const BILL_PAGE_SIZE = 10;

export async function fetchBillsPage(offset: number): Promise<{ bills: Bill[]; hasMore: boolean }> {
  await delay(500);
  const sorted = [...bills].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const page = sorted.slice(offset, offset + BILL_PAGE_SIZE);
  return { bills: page, hasMore: offset + BILL_PAGE_SIZE < sorted.length };
}

export async function fetchBillById(id: string): Promise<Bill | null> {
  await delay(250);
  return bills.find((bill) => bill.id === id) ?? null;
}

export async function fetchBillingMenuItems(): Promise<BillingMenuItem[]> {
  await delay(350);
  return menuItems.map(({ id, name, price, image }) => ({ id, name, price, image }));
}

export async function fetchBillingInventoryItems(): Promise<BillingInventoryItem[]> {
  await delay(350);
  return inventory.map(({ id, name, image, metricType, perishable, expiryDurationDays, purchasePrice }) => ({
    id, name, image, metricType, perishable, expiryDurationDays, purchasePrice,
  }));
}

/* --------------------------- Stock mutation engine ------------------------- */

/** FIFO deduction: oldest non-expired batch first. Throws on insufficient stock. */
function deductFIFO(item: InventoryRecord, required: number): void {
  if (!item.perishable) {
    if (item.currentStock < required) {
      throw new Error(`Insufficient stock for ${item.name}.`);
    }
    item.currentStock -= required;
    return;
  }

  const now = Date.now();
  const active = item.batches
    .filter((batch) => new Date(batch.expiryDate).getTime() >= now && batch.quantity > 0)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  const available = active.reduce((sum, batch) => sum + batch.quantity, 0);
  if (available < required) {
    throw new Error(`Insufficient fresh stock for ${item.name}.`);
  }

  let remaining = required;
  for (const batch of active) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    batch.quantity -= take;
    remaining -= take;
  }
}

function applySaleToInventory(lines: BillLine[]): void {
  // Stage every deduction first so a failure never partially applies.
  const staged: Array<{ item: InventoryRecord; required: number }> = [];

  for (const line of lines) {
    const menuItem = menuItems.find((m) => m.id === line.refId);
    if (!menuItem) continue;
    for (const entry of menuItem.recipe) {
      const item = inventory.find((inv) => inv.id === entry.inventoryItemId);
      if (!item) throw new Error(`Missing inventory for recipe of ${menuItem.name}.`);
      const required = entry.baseQuantity * line.quantity;
      const existing = staged.find((s) => s.item.id === item.id);
      if (existing) existing.required += required;
      else staged.push({ item, required });
    }
  }

  for (const { item, required } of staged) deductFIFO(item, required);
}

function applyPurchaseToInventory(lines: BillLine[]): void {
  for (const line of lines) {
    const item = inventory.find((inv) => inv.id === line.refId);
    if (!item || line.baseQuantity == null) continue;

    if (item.perishable) {
      const durationDays = item.expiryDurationDays ?? 0;
      const createdAt = new Date();
      item.batches.push({
        id: `b_${Date.now()}_${item.id}`,
        quantity: line.baseQuantity,
        createdAt: createdAt.toISOString(),
        expiryDate: new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
      });
    } else {
      item.currentStock += line.baseQuantity;
    }
  }
}

/* ------------------------------- Create bill ------------------------------- */

export interface CreateBillLineInput {
  refId: string;
  quantity: number;
  /** Purchase lines only — the unit the cashier picked. */
  unit?: Unit;
}

export async function createBill(
  type: BillType,
  partyName: string,
  rawLines: CreateBillLineInput[],
): Promise<Bill> {
  await delay(900);

  const lines: BillLine[] = [];

  if (type === 'sale') {
    for (const raw of rawLines) {
      const menuItem = menuItems.find((m) => m.id === raw.refId);
      if (!menuItem) throw new Error('Unknown menu item.');
      lines.push({
        refId: menuItem.id,
        name: menuItem.name,
        image: menuItem.image,
        quantity: raw.quantity,
        unitPrice: menuItem.price,
      });
    }
    applySaleToInventory(lines); // FIFO consumption
  } else {
    for (const raw of rawLines) {
      const item = inventory.find((inv) => inv.id === raw.refId);
      if (!item || !raw.unit) throw new Error('Unknown inventory item.');
      lines.push({
        refId: item.id,
        name: item.name,
        image: item.image,
        quantity: raw.quantity,
        unitPrice: item.purchasePrice ?? 0,
        metricType: item.metricType as MetricType,
        baseQuantity: toBaseQuantity(raw.quantity, raw.unit, item.metricType),
      });
    }
    applyPurchaseToInventory(lines); // stock in
  }

  const bill: Bill = {
    id: `inv-${Date.now().toString().slice(-6)}`,
    type,
    partyName:
      partyName.trim() || (type === 'sale' ? 'Walk-in Customer' : 'Unknown Supplier'),
    lines,
    total: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  bills = [bill, ...bills];
  return bill;
}