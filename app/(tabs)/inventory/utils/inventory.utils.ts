/** Formatting, unit conversion and expiry-status helpers. */

import type {
  MetricType,
  StockEntry,
  StockEntryStatus,
  Unit,
} from './inventory.types';

// Re-exported for backward compatibility — canonical definitions live in
// inventory.types.ts. Existing imports from this file keep working.
export type { StockStatus, StockEntryStatus } from './inventory.types';

export const METRIC_UNITS: Record<MetricType, Unit[]> = {
  pieces: ['PCS'],
  weight: ['GRAM', 'KG'],
  volume: ['ML', 'L'],
};

const UNIT_TO_BASE: Record<Unit, number> = {
  PCS: 1,
  GRAM: 1,
  KG: 1000,
  ML: 1,
  L: 1000,
};

/** Units available for a metric type (metric is inherited, never chosen). */
export function unitsForMetric(metricType: MetricType): Unit[] {
  return METRIC_UNITS[metricType];
}

/** Convert a user-entered quantity into the metric's base unit (g / ml / pcs). */
export function toBaseQuantity(quantity: number, unit: Unit, metricType: MetricType): number {
  if (!METRIC_UNITS[metricType].includes(unit)) return quantity;
  return quantity * UNIT_TO_BASE[unit];
}

/** Render a base-unit quantity using the most readable unit. */
export function formatQuantity(baseQuantity: number, metricType: MetricType): string {
  if (metricType === 'weight') {
    return baseQuantity >= 1000
      ? `${trimNumber(baseQuantity / 1000)} kg`
      : `${trimNumber(baseQuantity)} g`;
  }
  if (metricType === 'volume') {
    return baseQuantity >= 1000
      ? `${trimNumber(baseQuantity / 1000)} L`
      : `${trimNumber(baseQuantity)} ml`;
  }
  return `${trimNumber(baseQuantity)} pcs`;
}

export function metricTypeLabel(metricType: MetricType): string {
  switch (metricType) {
    case 'weight':
      return 'Weight';
    case 'volume':
      return 'Volume';
    default:
      return 'Pieces';
  }
}

/* ------------------------------- Expiry logic ------------------------------ */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Batch status from the CURRENT date — recalculated on every render:
 *   green   0% → 50%   healthy
 *   orange 50% → 99%   approaching expiry
 *   red    100%+       expired
 */
export function getStockEntryStatus(
  entry: StockEntry,
  now: Date = new Date(),
): StockEntryStatus {
  const createdAt = new Date(entry.createdAt).getTime();
  const expiryDate = new Date(entry.expiryDate).getTime();
  const today = startOfDay(now).getTime();

  const total = Math.max(expiryDate - createdAt, 1);
  const elapsed = Math.max(today - createdAt, 0);
  const progress = Math.min(elapsed / total, 1);

  const daysLeft = Math.ceil((expiryDate - today) / MS_PER_DAY);
  const isExpired = entry.expired || daysLeft < 0;

  if (isExpired) return { status: 'expired', daysLeft, progress: 1, isExpired: true };
  if (progress >= 0.5) return { status: 'warning', daysLeft, progress, isExpired: false };
  return { status: 'healthy', daysLeft, progress, isExpired: false };
}

/** Total of active (non-expired) batches, in base units. */
export function totalActiveStock(entries: StockEntry[], now: Date = new Date()): number {
  return entries
    .filter((entry) => !getStockEntryStatus(entry, now).isExpired)
    .reduce((sum, entry) => sum + entry.quantity, 0);
}

export function formatExpiryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function remainingTimeLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    const daysAgo = Math.abs(daysLeft);
    return `Expired ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  }
  if (daysLeft === 0) return 'Expires today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}