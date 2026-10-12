import { describe, expect, test } from 'bun:test';
import {
  ledgerRowWindows,
  ledgerWindows,
  summarizeProvider,
  type LedgerEntryInput,
} from '../src/features/quota/quotaLedgerModel';

const HOUR = 60 * 60 * 1000;

const claude = (fable: number, session: number, weekly: number, resetAtMs: number) => ({
  status: 'success',
  planType: 'max',
  windows: [
    { id: 'five-hour', label: '5-hour limit', usedPercent: session, resetAtMs: null, periodHours: 5 },
    { id: 'seven-day', label: '7-day limit', usedPercent: weekly, resetAtMs, periodHours: 168 },
    { id: 'seven-day-fable', label: '7-day Fable 5', usedPercent: fable, resetAtMs, periodHours: 168 },
  ],
});

describe('quota ledger model', () => {
  test('converts used percent to remaining and keeps reset instants', () => {
    const windows = ledgerWindows('claude', claude(42, 0, 21, 5 * HOUR));
    expect(windows.map((window) => [window.id, window.remaining, window.resetAtMs])).toEqual([
      ['five-hour', 100, null],
      ['seven-day', 79, 5 * HOUR],
      ['seven-day-fable', 58, 5 * HOUR],
    ]);
  });

  test('returns no windows until the quota has loaded', () => {
    expect(ledgerWindows('claude', undefined)).toEqual([]);
    expect(ledgerWindows('claude', { status: 'error' })).toEqual([]);
  });

  test('row windows lead with the longest period', () => {
    const windows = ledgerRowWindows(ledgerWindows('claude', claude(42, 0, 21, HOUR)));
    expect(windows.map((window) => window.id)).toEqual(['seven-day', 'seven-day-fable', 'five-hour']);
  });

  test('reads Antigravity remaining fractions and Kimi counts', () => {
    const antigravity = ledgerWindows('antigravity', {
      status: 'success',
      groups: [{ buckets: [{ id: 'b', label: 'Gemini', remainingFraction: 0.25, resetAtMs: HOUR }] }],
    } as { status: string });
    expect(antigravity[0].remaining).toBe(25);

    const kimi = ledgerWindows('kimi', {
      status: 'success',
      rows: [{ label: 'Weekly', used: 30, limit: 120, resetAtMs: HOUR, periodHours: 168 }],
    } as { status: string });
    expect(kimi[0].remaining).toBe(75);
  });

  test('summary headline is the most constrained longest window', () => {
    const entries: LedgerEntryInput[] = [
      { key: 'a', name: 'a.json', type: 'claude', quota: claude(42, 0, 21, 30 * HOUR) },
      { key: 'b', name: 'b.json', type: 'claude', quota: claude(0, 0, 0, 90 * HOUR) },
      { key: 'c', name: 'c.json', type: 'claude', quota: { status: 'error' } },
      { key: 'd', name: 'd.json', type: 'claude', quota: undefined },
      { key: 'x', name: 'x.json', type: 'codex', quota: undefined },
    ];
    const summary = summarizeProvider('claude', entries);

    expect(summary.credentialCount).toBe(4);
    expect(summary.loadedCount).toBe(2);
    expect(summary.errorCount).toBe(1);
    expect(summary.headline?.id).toBe('seven-day-fable');
    expect(summary.headline?.remainingSum).toBe(158);
    expect(summary.headline?.capacity).toBe(200);
    expect(summary.headline?.nextResetMs).toBe(30 * HOUR);
    expect(summary.headline?.segments.map((segment) => [segment.key, segment.status, segment.remaining])).toEqual([
      ['a', 'success', 58],
      ['b', 'success', 100],
      ['c', 'error', null],
      ['d', 'idle', null],
    ]);
    expect(summary.secondary?.id).toBe('seven-day');
    expect(summary.secondary?.remainingSum).toBe(179);
  });

  test('summary without loaded quota has no headline', () => {
    const summary = summarizeProvider('codex', [
      { key: 'x', name: 'x.json', type: 'codex', quota: undefined },
    ]);
    expect(summary.credentialCount).toBe(1);
    expect(summary.headline).toBeNull();
    expect(summary.secondary).toBeNull();
  });
});
