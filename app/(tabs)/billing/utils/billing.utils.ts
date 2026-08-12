/** Formatting, unit conversion and grouping helpers for Billing. */

import type { Bill, BillSection, BillType, MetricType, Unit } from './billing.types';

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

/** Indian-style currency formatting, e.g. 248650 → ₹2,48,650. */
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatBillDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatBillTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function billTypeLabel(type: BillType): string {
  return type === 'sale' ? 'Sale Invoice' : 'Purchase Invoice';
}

/* ------------------------------ Time grouping ------------------------------ */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
}

function monthTitle(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Groups bills (assumed sorted newest-first) into:
 *   Today → This Month (excluding today) → one section per previous month.
 * Section totals respect whatever filtering was applied beforehand.
 */
export function groupBills(bills: Bill[], now: Date = new Date()): BillSection[] {
  const todayStart = startOfDay(now).getTime();
  const monthStart = startOfMonth(now).getTime();

  const sections: BillSection[] = [];
  const monthIndex = new Map<string, BillSection>();

  const pushSection = (key: string, title: string): BillSection => {
    const section: BillSection = { key, title, total: 0, bills: [] };
    sections.push(section);
    return section;
  };

  for (const bill of bills) {
    const time = new Date(bill.createdAt).getTime();
    let section: BillSection;

    if (time >= todayStart) {
      section = sections.find((s) => s.key === 'today') ?? pushSection('today', 'Today');
    } else if (time >= monthStart) {
      section =
        sections.find((s) => s.key === 'thisMonth') ?? pushSection('thisMonth', 'This Month');
    } else {
      const key = monthKey(new Date(bill.createdAt));
      let existing = monthIndex.get(key);
      if (!existing) {
        existing = pushSection(key, monthTitle(new Date(bill.createdAt)));
        monthIndex.set(key, existing);
      }
      section = existing;
    }

    section.bills.push(bill);
    section.total += bill.total;
  }

  return sections;
}