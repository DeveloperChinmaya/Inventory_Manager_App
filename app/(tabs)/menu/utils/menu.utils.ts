/** Formatting + unit conversion helpers for the Menu module. */

import type { MetricType, Unit } from './menu.types';

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
    return baseQuantity >= 1000 ? `${trimNumber(baseQuantity / 1000)} kg` : `${trimNumber(baseQuantity)} g`;
  }
  if (metricType === 'volume') {
    return baseQuantity >= 1000 ? `${trimNumber(baseQuantity / 1000)} L` : `${trimNumber(baseQuantity)} ml`;
  }
  return `${trimNumber(baseQuantity)} pcs`;
}

export function formatPrice(price: number): string {
  return `₹${trimNumber(price)}`;
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

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}