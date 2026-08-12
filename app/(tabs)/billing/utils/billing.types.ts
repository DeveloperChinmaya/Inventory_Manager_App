/** Data models for the Billing module. */

export type BillType = 'sale' | 'purchase';

export type MetricType = 'pieces' | 'weight' | 'volume';

export type Unit = 'PCS' | 'GRAM' | 'KG' | 'ML' | 'L';

/** One line on an invoice. */
export interface BillLine {
  /** Menu item id (sale) or inventory item id (purchase). */
  refId: string;
  name: string;
  image: string | null;
  quantity: number;
  /** Unit price in ₹ (sale: selling price; purchase: purchase price, 0 if untracked). */
  unitPrice: number;
  /** Present on purchase lines only; quantity already normalized to base units. */
  metricType?: MetricType;
  baseQuantity?: number;
}

export interface Bill {
  id: string;
  type: BillType;
  /** Customer name (sale) — defaults to "Walk-in Customer". */
  partyName: string;
  lines: BillLine[];
  total: number;
  status: 'completed';
  /** ISO datetime. */
  createdAt: string;
}

/** Menu item as consumed by the billing screen. */
export interface BillingMenuItem {
  id: string;
  name: string;
  price: number;
  image: string | null;
}

/** Inventory item as consumed by the billing screen. */
export interface BillingInventoryItem {
  id: string;
  name: string;
  image: string | null;
  metricType: MetricType;
  perishable: boolean;
  expiryDurationDays: number | null;
  /** Last tracked purchase price per base unit (₹). Optional. */
  purchasePrice?: number;
}

export interface BillSection {
  key: string;
  title: string;
  total: number;
  bills: Bill[];
}