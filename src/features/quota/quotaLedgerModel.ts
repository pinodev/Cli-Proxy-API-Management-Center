/**
 * Quota ledger: per-credential window rows and per-provider headroom summaries.
 *
 * Pure functions over cached quota states — no React, no clock of its own — so
 * tests/quotaLedgerModel.test.ts can consume them directly.
 *
 * Every percentage here is REMAINING capacity (100 = untouched), whatever the
 * provider reports natively, so rows from different providers read the same way.
 * Provider shapes are read structurally, mirroring buildTimelineLane: the state
 * types disagree about where a window lives and what its percentage means.
 */

import type { QuotaProviderType } from './providers/types';

export interface LedgerWindow {
  id: string;
  label: string;
  /** i18n key for the label when the provider stores one instead of text. */
  labelKey?: string;
  /** Remaining percent, 0..100; null when the provider gave no figure. */
  remaining: number | null;
  resetAtMs: number | null;
  periodHours: number | null;
}

export interface LedgerSegment {
  key: string;
  name: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  remaining: number | null;
}

export interface LedgerHeadline {
  id: string;
  label: string;
  labelKey?: string;
  /** Sum of remaining percent across the credentials that report this window. */
  remainingSum: number;
  /** 100 per reporting credential. */
  capacity: number;
  /** Soonest reset among reporting credentials. */
  nextResetMs: number | null;
  /** One segment per credential of the provider, in entry order. */
  segments: LedgerSegment[];
}

export interface ProviderLedgerSummary {
  type: QuotaProviderType;
  credentialCount: number;
  loadedCount: number;
  errorCount: number;
  headline: LedgerHeadline | null;
  secondary: LedgerHeadline | null;
}

export interface LedgerEntryInput {
  key: string;
  name: string;
  type: QuotaProviderType;
  quota: { status?: string } | undefined;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const remainingFromUsed = (used: unknown): number | null => {
  const value = finiteOrNull(used);
  return value === null ? null : clampPercent(100 - value);
};

interface UsedWindowLike {
  id?: string;
  label?: string;
  labelKey?: string;
  usedPercent?: number | null;
  resetAtMs?: number | null;
  periodHours?: number | null;
}

/** Windows of one credential, in the provider's own order. Empty unless loaded. */
export function ledgerWindows(
  provider: QuotaProviderType,
  quota: { status?: string } | undefined
): LedgerWindow[] {
  if (!quota || quota.status !== 'success') return [];

  if (provider === 'claude' || provider === 'codex') {
    return ((quota as { windows?: UsedWindowLike[] }).windows ?? []).map((window, index) => ({
      id: window.id ?? `window-${index}`,
      label: window.label ?? '',
      labelKey: window.labelKey,
      remaining: remainingFromUsed(window.usedPercent),
      resetAtMs: finiteOrNull(window.resetAtMs),
      periodHours: finiteOrNull(window.periodHours),
    }));
  }

  if (provider === 'devin') {
    const windows =
      (
        quota as {
          windows?: {
            id: string;
            label?: string;
            remainingPercent: number | null;
            resetAtMs: number | null;
            periodHours: number;
          }[];
        }
      ).windows ?? [];
    return windows.map((window) => ({
      id: window.id,
      label: window.label ?? window.id,
      remaining: finiteOrNull(window.remainingPercent),
      resetAtMs: finiteOrNull(window.resetAtMs),
      periodHours: finiteOrNull(window.periodHours),
    }));
  }

  if (provider === 'xai') {
    const billing = (
      quota as {
        billing?: {
          periodType?: string;
          usagePercent?: number | null;
          resetAtMs?: number | null;
          periodHours?: number | null;
        } | null;
      }
    ).billing;
    if (!billing) return [];
    const weekly = billing.periodType === 'weekly';
    return [
      {
        id: billing.periodType ?? 'billing',
        label: '',
        labelKey: weekly ? 'quota_management.ledger_weekly_limit' : 'quota_management.ledger_billing',
        remaining: remainingFromUsed(billing.usagePercent),
        resetAtMs: finiteOrNull(billing.resetAtMs),
        periodHours: finiteOrNull(billing.periodHours) ?? (weekly ? 24 * 7 : null),
      },
    ];
  }

  if (provider === 'antigravity') {
    const buckets = (
      (
        quota as {
          groups?: {
            buckets?: {
              id?: string;
              label?: string;
              remainingFraction?: number | null;
              resetAtMs?: number | null;
              periodHours?: number | null;
            }[];
          }[];
        }
      ).groups ?? []
    ).flatMap((group) => group.buckets ?? []);
    return buckets.map((bucket, index) => {
      const fraction = finiteOrNull(bucket.remainingFraction);
      return {
        id: bucket.id ?? bucket.label ?? `bucket-${index}`,
        label: bucket.label ?? '',
        // Antigravity reports the fraction REMAINING, not percent used.
        remaining: fraction === null ? null : clampPercent(Math.round(fraction * 100)),
        resetAtMs: finiteOrNull(bucket.resetAtMs),
        periodHours: finiteOrNull(bucket.periodHours),
      };
    });
  }

  if (provider === 'kimi') {
    const rows =
      (
        quota as {
          rows?: {
            id?: string;
            label?: string;
            labelKey?: string;
            used: number;
            limit: number;
            resetAtMs?: number | null;
            periodHours?: number | null;
          }[];
        }
      ).rows ?? [];
    return rows.map((row, index) => ({
      id: row.id ?? row.labelKey ?? row.label ?? `row-${index}`,
      label: row.label ?? '',
      labelKey: row.labelKey,
      // Kimi reports raw counts; remaining is derived.
      remaining:
        row.limit > 0 ? clampPercent(Math.round(((row.limit - row.used) / row.limit) * 100)) : null,
      resetAtMs: finiteOrNull(row.resetAtMs),
      periodHours: finiteOrNull(row.periodHours),
    }));
  }

  if (provider === 'meta') {
    const windows =
      (
        quota as {
          data?: {
            windows?: {
              id: 'window' | 'weekly';
              usedPercent: number | null;
              resetAt?: number;
              durationMinutes?: number;
            }[];
          };
        }
      ).data?.windows ?? [];
    return windows.map((window) => {
      const resetAt = finiteOrNull(window.resetAt);
      // The upstream weekly bucket has no duration field; its scope defines seven days.
      const minutes = window.id === 'weekly' ? 7 * 24 * 60 : finiteOrNull(window.durationMinutes);
      return {
        id: window.id,
        label: '',
        labelKey: `meta_quota.${window.id}`,
        remaining: remainingFromUsed(window.usedPercent),
        // Unix seconds from the upstream Meta contract.
        resetAtMs: resetAt === null ? null : resetAt * 1000,
        periodHours: minutes === null ? null : minutes / 60,
      };
    });
  }

  return [];
}

/**
 * The windows a ledger row shows: longest period first, so the binding weekly
 * limits lead and the rolling session window follows. Stable within a period.
 */
export function ledgerRowWindows(windows: LedgerWindow[], max = 3): LedgerWindow[] {
  return windows
    .map((window, index) => ({ window, index }))
    .sort(
      (a, b) =>
        (b.window.periodHours ?? -1) - (a.window.periodHours ?? -1) || a.index - b.index
    )
    .slice(0, max)
    .map(({ window }) => window);
}

interface WindowTally {
  id: string;
  label: string;
  labelKey?: string;
  periodHours: number;
  remainingSum: number;
  reporting: number;
  nextResetMs: number | null;
  byKey: Map<string, number | null>;
  order: number;
}

/**
 * Summarize one provider's credentials.
 *
 * The headline is the binding constraint: among the longest windows the
 * credentials report, the one with the least remaining capacity overall. The
 * secondary is the next most constrained window of any period, so a card can
 * show "7-day Fable 409% of 500%" and still mention the plain 7-day limit.
 */
export function summarizeProvider(
  type: QuotaProviderType,
  entries: LedgerEntryInput[]
): ProviderLedgerSummary {
  const own = entries.filter((entry) => entry.type === type);
  const tallies = new Map<string, WindowTally>();
  let loadedCount = 0;
  let errorCount = 0;

  own.forEach((entry) => {
    const status = entry.quota?.status;
    if (status === 'success') loadedCount += 1;
    else if (status === 'error') errorCount += 1;

    ledgerWindows(type, entry.quota).forEach((window) => {
      let tally = tallies.get(window.id);
      if (!tally) {
        tally = {
          id: window.id,
          label: window.label,
          labelKey: window.labelKey,
          periodHours: window.periodHours ?? 0,
          remainingSum: 0,
          reporting: 0,
          nextResetMs: null,
          byKey: new Map(),
          order: tallies.size,
        };
        tallies.set(window.id, tally);
      }
      tally.byKey.set(entry.key, window.remaining);
      if (window.remaining !== null) {
        tally.remainingSum += window.remaining;
        tally.reporting += 1;
      }
      if (
        window.resetAtMs !== null &&
        (tally.nextResetMs === null || window.resetAtMs < tally.nextResetMs)
      ) {
        tally.nextResetMs = window.resetAtMs;
      }
    });
  });

  const ratio = (tally: WindowTally) => tally.remainingSum / (tally.reporting * 100);
  const ranked = Array.from(tallies.values())
    .filter((tally) => tally.reporting > 0)
    .sort(
      (a, b) =>
        b.periodHours - a.periodHours || ratio(a) - ratio(b) || a.order - b.order
    );

  const toHeadline = (tally: WindowTally | undefined): LedgerHeadline | null => {
    if (!tally) return null;
    return {
      id: tally.id,
      label: tally.label,
      labelKey: tally.labelKey,
      remainingSum: Math.round(tally.remainingSum),
      capacity: tally.reporting * 100,
      nextResetMs: tally.nextResetMs,
      segments: own.map((entry) => ({
        key: entry.key,
        name: entry.name,
        status: (entry.quota?.status as LedgerSegment['status']) ?? 'idle',
        remaining: tally.byKey.get(entry.key) ?? null,
      })),
    };
  };

  const headline = ranked[0];
  const secondary = ranked
    .slice(1)
    .sort((a, b) => ratio(a) - ratio(b) || a.order - b.order)[0];

  return {
    type,
    credentialCount: own.length,
    loadedCount,
    errorCount,
    headline: toHeadline(headline),
    secondary: toHeadline(secondary),
  };
}
