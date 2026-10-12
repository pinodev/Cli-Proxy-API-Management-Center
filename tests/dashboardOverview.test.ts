import { describe, expect, test } from 'bun:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { DashboardOverview } from '../src/features/dashboard/components/DashboardOverview';
import en from '../src/i18n/locales/en.json';
import ru from '../src/i18n/locales/ru.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';

const i18n = createInstance();
await i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});

const baseProps: ComponentProps<typeof DashboardOverview> = {
  connectionStatus: 'connected',
  connected: true,
  config: null,
  counts: { managementKeys: null, providerKeys: null, credentials: null, models: null },
  traffic: {
    buckets: [],
    totalSuccess: 0,
    totalFailure: 0,
    total: 0,
    successRate: null,
    peakTotal: 0,
    peakIndex: -1,
    windowMinutes: 0,
  },
  providers: [],
  credentials: null,
  serverVersion: 'v8.2.0',
  serverBuildDate: null,
  resolvedTheme: 'dark',
  refreshing: false,
  onRefresh: () => {},
};

function renderOverview(overrides: Partial<typeof baseProps> = {}) {
  return renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        MemoryRouter,
        null,
        createElement(DashboardOverview, { ...baseProps, ...overrides })
      )
    )
  );
}

describe('DashboardOverview', () => {
  test('shows two proxy records while neither is serving', () => {
    const markup = renderOverview({
      credentials: {
        total: 2,
        active: 0,
        disabled: 0,
        unavailable: 2,
        byType: [{ type: 'claude', count: 1 }, { type: 'codex', count: 1 }],
      },
    });
    expect(markup).toContain('Credentials: 2');
    expect(markup).toContain('0 active');
    expect(markup).not.toContain('No credential files found.');
  });

  test('distinguishes unavailable credential data from a loaded empty result', () => {
    const pending = renderOverview();
    expect(pending).toContain('Credential status is not available yet.');
    expect(pending).toContain('Provider data is not available yet.');
    expect(pending).not.toContain('No credential files found.');
    expect(pending).not.toContain('aria-valuenow="100"');

    const empty = renderOverview({
      credentials: { total: 0, active: 0, disabled: 0, unavailable: 0, byType: [] },
    });
    expect(empty).toContain('No credential files found.');
    expect(empty).not.toContain('Credential status is not available yet.');
  });

  test('renders cumulative provider totals separately from recent-window traffic', () => {
    const markup = renderOverview({
      traffic: {
        buckets: [{ time: '13:00-13:10', success: 4, failed: 1 }],
        totalSuccess: 4,
        totalFailure: 1,
        total: 5,
        successRate: 80,
        peakTotal: 5,
        peakIndex: 0,
        windowMinutes: 10,
      },
      providers: [
        {
          id: 'codex',
          credentials: 1,
          success: 120,
          failure: 3,
          total: 123,
          successRate: (120 / 123) * 100,
          buckets: [{ time: '13:00-13:10', success: 4, failed: 1 }],
        },
      ],
      credentials: {
        total: 1,
        active: 1,
        disabled: 0,
        unavailable: 0,
        byType: [{ type: 'codex', count: 1 }],
      },
    });
    expect(markup).toContain('Recorded totals per provider. Trends show recent request activity.');
    expect(markup).toContain('title="123"');
    expect(markup).toContain('Credentials: 1');
    expect(markup).not.toContain('1 credentials');
    expect(markup).toContain('Last 10m');
    expect(markup).toContain('5 requests over the last 10 minutes: 4 succeeded, 1 failed.');
    expect(markup).toContain('aria-label="Codex success rate"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('role="region" aria-label="Provider summaries" tabindex="0"');
    expect(markup).toContain('role="region" aria-label="Provider traffic ledger" tabindex="0"');
    expect(markup).toContain('scope="row"');
  });

  test('keeps providers with no recorded requests neutral instead of inventing a success rate', () => {
    const markup = renderOverview({
      providers: [
        {
          id: 'claude',
          credentials: 1,
          success: 0,
          failure: 0,
          total: 0,
          successRate: null,
          buckets: [],
        },
      ],
    });
    expect(markup).toContain('Claude');
    expect(markup).toContain('No recent activity');
    expect(markup).not.toContain('aria-valuenow=');
    expect(markup).not.toContain('100%');
  });

  test('disables refresh when disconnected and during a refresh', () => {
    expect(renderOverview({ connected: false, connectionStatus: 'disconnected' })).toMatch(
      /<button[^>]+disabled=""[^>]*>/
    );
    const refreshing = renderOverview({ refreshing: true });
    expect(refreshing).toContain('aria-busy="true"');
    expect(refreshing).toMatch(/<button[^>]+disabled=""[^>]*>/);
  });

  test('does not print credentials from a configured upstream proxy URL', () => {
    const markup = renderOverview({
      config: { proxyUrl: 'http://fixture-user:fixture-password@proxy.example:8080' },
    });
    expect(markup).not.toContain('fixture-user');
    expect(markup).not.toContain('fixture-password');
  });

  test('keeps all dashboard translation keys available in every supported locale', () => {
    const englishKeys = Object.keys(en.dashboard).sort();
    for (const locale of [ru, zhCN, zhTW]) {
      expect(Object.keys(locale.dashboard).sort()).toEqual(englishKeys);
    }
  });
});
