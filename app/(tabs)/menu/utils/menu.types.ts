/** Data models for the Menu Management module. */

export type MetricType = 'pieces' | 'weight' | 'volume';

export type Unit = 'PCS' | 'GRAM' | 'KG' | 'ML' | 'L';

export interface InventoryItem {
  id: string;
  name: string;
  metricType: MetricType;
  image: string | null;
}

/**
 * Raw material stored on a menu item. Quantity is always normalized to the
 * metric's base unit (grams / ml / pcs) before saving.
 */
export interface RawMaterial {
  inventoryItemId: string;
  /** Denormalized for display without an extra lookup. */
  inventoryName?: string;
  metricType?: MetricType;
  baseQuantity: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string | null;
  rawMaterials: RawMaterial[];
}

export type MenuItemPayload = Omit<MenuItem, 'id'>;