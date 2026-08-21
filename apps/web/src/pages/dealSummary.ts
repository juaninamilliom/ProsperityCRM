const TERMINAL = new Set(['signed', 'lost']);
const COLD_AFTER_DAYS = 7;

export interface SummarisableDeal {
  stage: string;
  /** Postgres numeric arrives as a string even where the DTO says number. */
  est_annual_value?: string | number | null;
  last_touch?: string | null;
}

export interface DealSummary {
  open: number;
  openValue: number;
  cold: number;
  signed: number;
}

export function dealSummary(deals: SummarisableDeal[], now: Date = new Date()): DealSummary {
  const open = deals.filter((deal) => !TERMINAL.has(deal.stage));
  const cutoff = now.getTime() - COLD_AFTER_DAYS * 24 * 60 * 60 * 1000;

  return {
    open: open.length,
    openValue: open.reduce((total, deal) => {
      const value =
        typeof deal.est_annual_value === 'number'
          ? deal.est_annual_value
          : Number(deal.est_annual_value ?? 0);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0),
    // A deal nobody has touched is only a problem while it is still winnable.
    cold: open.filter(
      (deal) => !deal.last_touch || new Date(deal.last_touch).getTime() < cutoff,
    ).length,
    signed: deals.filter((deal) => deal.stage === 'signed').length,
  };
}
