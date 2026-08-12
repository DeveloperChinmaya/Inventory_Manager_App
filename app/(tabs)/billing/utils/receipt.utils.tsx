/** Receipt-specific helpers (kept separate so billing.utils stays lean). */

import type { MetricType } from './billing.types';

/** Human-readable quantity from base units — receipt-safe (never throws). */
export function formatQuantitySafe(baseQuantity: number, metricType: MetricType): string {
  if (metricType === 'weight') {
    return baseQuantity >= 1000
      ? `${trim(baseQuantity / 1000)} kg`
      : `${trim(baseQuantity)} g`;
  }
  if (metricType === 'volume') {
    return baseQuantity >= 1000
      ? `${trim(baseQuantity / 1000)} L`
      : `${trim(baseQuantity)} ml`;
  }
  return `${trim(baseQuantity)} pcs`;
}

// Re-export the shared formatters so the receipt imports from one place.
export {
  billTypeLabel,
  formatBillDate,
  formatBillTime,
  formatINR,
} from './billing.utils';

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}