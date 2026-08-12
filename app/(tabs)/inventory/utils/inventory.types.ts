/** Data models for the Inventory module. */

export type MetricType = 'pieces' | 'weight' | 'volume';

export type Unit = 'PCS' | 'GRAM' | 'KG' | 'ML' | 'L';

/* ------------------------------ Stock status ------------------------------- */

/**
 * Lifecycle status of a stock batch, derived from the current date:
 *   healthy  0% → 50%  of shelf life elapsed
 *   warning 50% → 99%  approaching expiry
 *   expired 100%+      past expiry
 */
export type StockStatus = 'healthy' | 'warning' | 'expired';

/** Computed status of a StockEntry at a given moment. */
export interface StockEntryStatus {
  status: StockStatus;
  /** Whole days until expiry (negative when expired). */
  daysLeft: number;
  /** elapsedDays / expiryDuration, clamped at 1 for display. */
  progress: number;
  isExpired: boolean;
}

/* ------------------------------ Inventory item ----------------------------- */

/**
 * Inventory Item — defines an ingredient and its rules ONLY.
 * It intentionally holds no stock transactions: stock is added exclusively
 * via Purchase Bills and consumed exclusively via Sales Bills. This module
 * is a read-only representation of definitions + current stock state.
 */
export interface InventoryItem {
  id: string;
  name: string;
  image: string | null;
  /** Fixed for the item; inherited by Menu Items and Purchase Bills. */
  metricType: MetricType;
  perishable: boolean;
  /** Shelf life in days per batch. Null when perishable is false. */
  expiryDurationDays: number | null;
}

/**
 * One purchase batch of a perishable item. Batches are NEVER merged (each
 * purchase carries its own expiry) and are consumed FIFO (oldest
 * non-expired first) by Sales Bills.
 */
export interface StockEntry {
  id: string;
  inventoryItemId: string;
  /** Quantity in the metric's base unit (g / ml / pcs). */
  quantity: number;
  unit: Unit;
  /** ISO date of purchase. */
  createdAt: string;
  /** ISO date of expiry. */
  expiryDate: string;
  expired: boolean;
}

/** Read model: an item definition plus its derived current stock state. */
export interface InventoryItemWithStock extends InventoryItem {
  /** Non-perishable only — running total in base units. */
  currentStock: number | null;
  /** Perishable only — batches sorted FIFO (oldest expiry first). */
  stockEntries: StockEntry[];
}

export type InventoryItemPayload = Omit<InventoryItem, 'id'>;