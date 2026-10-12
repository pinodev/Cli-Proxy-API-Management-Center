import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import {
  IconBot,
  IconFileText,
  IconFilterAll,
  IconRefreshCw,
  IconSidebarConfig,
  IconSidebarLogs,
  IconSidebarQuota,
  IconSidebarSystem,
} from '@/components/ui/icons';
import { getAuthFileIcon } from '@/features/authFiles/constants';
import type { AuthFileItem, Config, ConnectionStatus, ResolvedTheme } from '@/types';
import { formatCompactNumber, formatDateValue, formatPercent } from '@/utils/format';
import type { CredentialHealth, DashboardCounts, ProviderTraffic, TrafficWindow } from '../types';
import { providerLabel, splitWindowMinutes } from '../utils';
import { DashboardQuotaPanel } from './DashboardQuotaPanel';
import { Meter } from './Meter';
import { Sparkline } from './Sparkline';
import { ThroughputChart } from './ThroughputChart';
import styles from '../dashboard.module.scss';

const DASH = '-';

interface DashboardOverviewProps {
  connectionStatus: ConnectionStatus;
  connected: boolean;
  config: Config | null;
  counts: DashboardCounts;
  traffic: TrafficWindow;
  providers: ProviderTraffic[];
  credentials: CredentialHealth | null;
  authFiles: AuthFileItem[] | null;
  serverVersion: string | null;
  serverBuildDate: string | null;
  resolvedTheme: ResolvedTheme;
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
}

export function DashboardOverview({
  connectionStatus,
  connected,
  config,
  counts,
  traffic,
  providers,
  credentials,
  authFiles,
  serverVersion,
  serverBuildDate,
  resolvedTheme,
  refreshing,
  onRefresh,
}: DashboardOverviewProps) {
  const { t, i18n } = useTranslation();
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const selectedProvider = providers.find((provider) => provider.id === providerFilter);
  const visibleProviders = selectedProvider ? [selectedProvider] : providers;
  const unknownProviderLabel = t('dashboard.provider_unknown');

  const windowLabel = useMemo(() => {
    if (traffic.windowMinutes <= 0) return DASH;
    const { hours, minutes } = splitWindowMinutes(traffic.windowMinutes);
    if (hours === 0) return t('dashboard.window_m', { minutes });
    if (minutes === 0) return t('dashboard.window_h', { hours });
    return t('dashboard.window_hm', { hours, minutes });
  }, [traffic.windowMinutes, t]);

  const routingStrategy = useMemo(() => {
    const raw = config?.routingStrategy?.trim() ?? '';
    if (!raw) return DASH;
    if (raw === 'round-robin') return t('basic_settings.routing_strategy_round_robin');
    if (raw === 'weighted-round-robin') {
      return t('basic_settings.routing_strategy_weighted_round_robin');
    }
    if (raw === 'fill-first') return t('basic_settings.routing_strategy_fill_first');
    return raw;
  }, [config?.routingStrategy, t]);

  const connectionLabel = t(
    connectionStatus === 'connected'
      ? 'common.connected'
      : connectionStatus === 'connecting'
        ? 'common.connecting'
        : 'common.disconnected'
  );
  const versionLabel = serverVersion ? `v${serverVersion.trim().replace(/^[vV]+/, '')}` : DASH;
  const credentialCount = credentials ? credentials.total.toLocaleString() : DASH;

  const metricItems = [
    {
      label: t('dashboard.recent_requests'),
      value: connected && traffic.buckets.length > 0 ? traffic.total.toLocaleString() : DASH,
      hint:
        traffic.windowMinutes > 0
          ? t('dashboard.rolling_window', { window: windowLabel })
          : t('dashboard.no_window'),
    },
    {
      label: t('dashboard.success_rate'),
      value: traffic.successRate === null ? DASH : formatPercent(traffic.successRate),
      hint: t('dashboard.stat_success_hint', { total: traffic.total.toLocaleString() }),
    },
    {
      label: t('dashboard.stat_credentials'),
      value: credentialCount,
      hint: credentials
        ? t('dashboard.credentials_serving', { active: credentials.active })
        : t('dashboard.data_unavailable'),
    },
    {
      label: t('dashboard.stat_provider_keys'),
      value: counts.providerKeys === null ? DASH : counts.providerKeys.toLocaleString(),
      hint: t('dashboard.stat_provider_keys_hint'),
    },
    {
      label: t('dashboard.stat_models'),
      value: counts.models === null ? DASH : counts.models.toLocaleString(),
      hint: t('dashboard.stat_models_hint'),
    },
  ];

  const healthRows = credentials
    ? [
        {
          label: t('dashboard.health_active'),
          count: credentials.active,
          className: styles.healthActive,
        },
        {
          label: t('dashboard.health_unavailable'),
          count: credentials.unavailable,
          className: styles.healthUnavailable,
        },
        {
          label: t('dashboard.health_disabled'),
          count: credentials.disabled,
          className: styles.healthDisabled,
        },
      ]
    : [];

  const runtimeRows = [
    { label: t('dashboard.runtime_routing'), value: routingStrategy },
    {
      label: t('dashboard.runtime_retry'),
      value: config ? String(config.requestRetry ?? 0) : DASH,
    },
    {
      label: t('dashboard.runtime_client_keys'),
      value: counts.managementKeys === null ? DASH : String(counts.managementKeys),
    },
    { label: t('dashboard.runtime_version'), value: versionLabel },
    {
      label: t('dashboard.runtime_build'),
      value: formatDateValue(serverBuildDate, i18n.language) || DASH,
    },
    {
      label: t('dashboard.runtime_proxy'),
      value: config ? (config.proxyUrl?.trim() ? t('common.yes') : t('common.no')) : DASH,
    },
  ];

  const runtimeToggles = config
    ? [
        { label: t('dashboard.runtime_debug'), on: Boolean(config.debug) },
        { label: t('dashboard.runtime_file_logging'), on: Boolean(config.loggingToFile) },
        { label: t('dashboard.runtime_request_log'), on: Boolean(config.requestLog) },
        { label: t('dashboard.runtime_ws_auth'), on: Boolean(config.wsAuth) },
        { label: t('dashboard.runtime_model_prefix'), on: Boolean(config.forceModelPrefix) },
      ]
    : [];

  const shortcuts = [
    { to: '/ai-providers', icon: <IconBot size={17} />, label: t('nav.ai_providers') },
    { to: '/auth-files', icon: <IconFileText size={17} />, label: t('nav.auth_files') },
    { to: '/quota', icon: <IconSidebarQuota size={17} />, label: t('nav.quota_management') },
    { to: '/logs', icon: <IconSidebarLogs size={17} />, label: t('nav.logs') },
    { to: '/config', icon: <IconSidebarConfig size={17} />, label: t('nav.config_management') },
    { to: '/system', icon: <IconSidebarSystem size={17} />, label: t('nav.system_info') },
  ];

  const renderProviderIcon = (id: string) => {
    const icon = getAuthFileIcon(id, resolvedTheme);
    return icon ? <img src={icon} alt="" className={styles.providerIcon} /> : <IconBot size={18} />;
  };

  return (
    <div className={styles.page} aria-busy={refreshing}>
      <header className={styles.pageHeader}>
        <div className={styles.headingGroup}>
          <h1 className={styles.pageTitle}>{t('nav.dashboard')}</h1>
          <div className={styles.connectionLine}>
            <span className={styles.connectionState}>
              <span
                className={`${styles.statusDot} ${connected ? styles.statusConnected : ''}`}
                aria-hidden="true"
              />
              {connectionLabel}
            </span>
            <span className={styles.headerSeparator} aria-hidden="true" />
            <span>{t('dashboard.header_credentials', { value: credentialCount })}</span>
            {serverVersion && <span className={styles.version}>{versionLabel}</span>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link to="/quota" className={styles.quotaAction}>
            <IconSidebarQuota size={16} />
            {t('nav.quota_management')}
          </Link>
          <Button
            variant="secondary"
            className={styles.refreshButton}
            disabled={!connected}
            loading={refreshing}
            onClick={() => void onRefresh()}
          >
            {!refreshing && <IconRefreshCw size={16} />}
            {t('common.refresh')}
          </Button>
        </div>
      </header>

      <section className={styles.metricStrip} aria-label={t('dashboard.stats_aria')}>
        {metricItems.map((metric) => (
          <div className={styles.metric} key={metric.label}>
            <span className={styles.metricLabel}>{metric.label}</span>
            <strong className={styles.metricValue}>{metric.value}</strong>
            <span className={styles.metricHint}>{metric.hint}</span>
          </div>
        ))}
      </section>

      <DashboardQuotaPanel
        authFiles={authFiles}
        connected={connected}
        resolvedTheme={resolvedTheme}
      />

      <section className={styles.providerSection} aria-labelledby="dashboard-providers-title">
        <header className={styles.sectionHeader}>
          <div>
            <h2 id="dashboard-providers-title" className={styles.sectionTitle}>
              {t('dashboard.provider_overview')}
            </h2>
            <p className={styles.sectionDescription}>
              {t('dashboard.provider_overview_description')}
            </p>
          </div>
          <Link to="/ai-providers" className={styles.textLink}>
            {t('dashboard.cta_manage_providers')}
            <span aria-hidden="true">↗</span>
          </Link>
        </header>

        {providers.length > 0 ? (
          <>
            <div
              className={styles.providerFilters}
              role="group"
              aria-label={t('dashboard.provider_filters')}
            >
              <button
                type="button"
                className={styles.providerFilter}
                aria-pressed={!selectedProvider}
                onClick={() => setProviderFilter(null)}
              >
                <IconFilterAll size={17} />
                {t('dashboard.all_providers')}
                <span className={styles.filterCount}>{providers.length.toLocaleString()}</span>
              </button>
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={styles.providerFilter}
                  aria-pressed={selectedProvider?.id === provider.id}
                  onClick={() => setProviderFilter(provider.id)}
                >
                  {renderProviderIcon(provider.id)}
                  {providerLabel(provider.id, unknownProviderLabel)}
                  <span className={styles.filterCount}>
                    {provider.credentials.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>

            <div
              className={styles.providerSummary}
              role="region"
              aria-label={t('dashboard.provider_summary')}
              tabIndex={0}
            >
              {visibleProviders.map((provider) => (
                <article className={styles.providerColumn} key={provider.id}>
                  <div className={styles.providerColumnHeading}>
                    <h3 className={styles.providerName}>
                      {renderProviderIcon(provider.id)}
                      {providerLabel(provider.id, unknownProviderLabel)}
                    </h3>
                    <span className={styles.providerCredentialCount}>
                      {t('dashboard.header_credentials', {
                        value: provider.credentials.toLocaleString(),
                      })}
                    </span>
                  </div>
                  <span className={styles.summaryLabel}>{t('dashboard.recorded_requests')}</span>
                  <strong className={styles.providerFigure} title={provider.total.toLocaleString()}>
                    {formatCompactNumber(provider.total)}
                  </strong>
                  <div className={styles.providerRateLine}>
                    <span>{t('dashboard.success_rate')}</span>
                    <b>
                      {provider.successRate === null ? DASH : formatPercent(provider.successRate)}
                    </b>
                  </div>
                  <Meter
                    value={provider.successRate}
                    ariaLabel={t('dashboard.provider_success_rate', {
                      provider: providerLabel(provider.id, unknownProviderLabel),
                    })}
                    className={styles.summaryMeter}
                  />
                  <div className={styles.providerSplit}>
                    <span>
                      <i className={styles.successDot} aria-hidden="true" />
                      {t('stats.success')} <b>{provider.success.toLocaleString()}</b>
                    </span>
                    <span>
                      <i className={styles.failureDot} aria-hidden="true" />
                      {t('stats.failure')} <b>{provider.failure.toLocaleString()}</b>
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div
              className={styles.ledgerScroll}
              role="region"
              aria-label={t('dashboard.provider_ledger')}
              tabIndex={0}
            >
              <table className={styles.providerLedger}>
                <caption className={styles.srOnly}>{t('dashboard.provider_ledger')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('dashboard.provider_column')}</th>
                    <th scope="col">{t('dashboard.stat_credentials')}</th>
                    <th scope="col">{t('dashboard.recorded_requests')}</th>
                    <th scope="col">{t('stats.failure')}</th>
                    <th scope="col">{t('dashboard.success_rate')}</th>
                    <th scope="col">{t('dashboard.recent_trend')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProviders.map((provider) => (
                    <tr key={provider.id}>
                      <th scope="row">
                        <Link to="/quota" className={styles.providerLedgerName}>
                          {renderProviderIcon(provider.id)}
                          {providerLabel(provider.id, unknownProviderLabel)}
                        </Link>
                      </th>
                      <td>{provider.credentials.toLocaleString()}</td>
                      <td>{provider.total.toLocaleString()}</td>
                      <td>
                        <span className={provider.failure > 0 ? styles.failureValue : undefined}>
                          {provider.failure.toLocaleString()}
                        </span>
                      </td>
                      <td className={styles.ledgerRate}>
                        <span>
                          {provider.successRate === null
                            ? DASH
                            : formatPercent(provider.successRate)}
                        </span>
                        <Meter
                          value={provider.successRate}
                          ariaLabel={t('dashboard.provider_success_rate', {
                            provider: providerLabel(provider.id, unknownProviderLabel),
                          })}
                        />
                      </td>
                      <td className={styles.ledgerTrend}>
                        {provider.buckets.length > 0 ? (
                          <Sparkline
                            points={provider.buckets.map(
                              (bucket) => bucket.success + bucket.failed
                            )}
                            ariaLabel={t('dashboard.fleet_spark_label', {
                              provider: providerLabel(provider.id, unknownProviderLabel),
                            })}
                            className={styles.providerSpark}
                          />
                        ) : (
                          <span className={styles.noTrend}>{t('dashboard.no_window')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <IconBot size={24} />
            <p>
              {!connected || credentials === null
                ? t('dashboard.provider_data_unavailable')
                : t('dashboard.fleet_empty')}
            </p>
            <Link to="/ai-providers" className={styles.textLink}>
              {t('dashboard.cta_manage_providers')} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </section>

      <div className={styles.activityGrid}>
        <section className={styles.panel} aria-labelledby="dashboard-traffic-title">
          <header className={styles.panelHeader}>
            <h2 id="dashboard-traffic-title" className={styles.sectionTitle}>
              {t('dashboard.recent_traffic')}
            </h2>
            <span className={styles.panelMeta}>
              {traffic.windowMinutes > 0
                ? t('dashboard.rolling_window', { window: windowLabel })
                : t('dashboard.no_window')}
            </span>
          </header>
          <ThroughputChart traffic={traffic} />
        </section>

        <section className={styles.panel} aria-labelledby="dashboard-credentials-title">
          <header className={styles.panelHeader}>
            <h2 id="dashboard-credentials-title" className={styles.sectionTitle}>
              {t('dashboard.health_title')}
            </h2>
            <Link to="/auth-files" className={styles.textLink}>
              {t('dashboard.health_link')} <span aria-hidden="true">↗</span>
            </Link>
          </header>
          {!credentials || credentials.total === 0 ? (
            <p className={styles.emptyNote}>
              {credentials
                ? t('dashboard.health_empty')
                : t('dashboard.credential_data_unavailable')}
            </p>
          ) : (
            <>
              <div className={styles.healthSummary}>
                <strong>{credentials.active.toLocaleString()}</strong>
                <span>
                  {t('dashboard.credentials_active_of_total', { total: credentials.total })}
                </span>
              </div>
              <div className={styles.healthBar} aria-hidden="true">
                {healthRows
                  .filter((row) => row.count > 0)
                  .map((row) => (
                    <span
                      key={row.label}
                      className={row.className}
                      style={{ flexGrow: row.count }}
                    />
                  ))}
              </div>
              <dl className={styles.healthLedger}>
                {healthRows.map((row) => (
                  <div key={row.label}>
                    <dt>
                      <i className={row.className} aria-hidden="true" />
                      {row.label}
                    </dt>
                    <dd>{row.count.toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
              <div className={styles.credentialTypes}>
                <span className={styles.summaryLabel}>{t('dashboard.health_by_type')}</span>
                <ul>
                  {credentials.byType.map((entry) => (
                    <li key={entry.type}>
                      <span>
                        {renderProviderIcon(entry.type)}
                        {providerLabel(entry.type, unknownProviderLabel)}
                      </span>
                      <b>{entry.count.toLocaleString()}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>

      <section className={styles.runtimePanel} aria-labelledby="dashboard-runtime-title">
        <header className={styles.panelHeader}>
          <h2 id="dashboard-runtime-title" className={styles.sectionTitle}>
            {t('dashboard.runtime_title')}
          </h2>
          <Link to="/config" className={styles.textLink}>
            {t('dashboard.runtime_link')} <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <dl className={styles.runtimeGrid}>
          {runtimeRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        {runtimeToggles.length > 0 && (
          <ul className={styles.runtimeFlags}>
            {runtimeToggles.map((toggle) => (
              <li key={toggle.label}>
                <span
                  className={`${styles.flagDot} ${toggle.on ? styles.flagOn : ''}`}
                  aria-hidden="true"
                />
                {toggle.label}
                <span className={styles.flagValue}>
                  {toggle.on ? t('common.yes') : t('common.no')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className={styles.shortcuts} aria-label={t('dashboard.shortcuts')}>
        {shortcuts.map((shortcut) => (
          <Link key={shortcut.to} to={shortcut.to}>
            {shortcut.icon}
            {shortcut.label}
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
