/**
 * Dashboard quota headroom: the quota page's provider strip, fed from the
 * shared quota cache. Loading stays explicit (one button) — upstream usage
 * endpoints are rate-sensitive, so the dashboard never fetches on its own.
 */

import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import { useNow } from '@/hooks/useNow';
import { useQuotaStore } from '@/stores';
import type { AuthFileItem, ResolvedTheme } from '@/types';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { QuotaSummaryStrip } from '@/features/quota/components/QuotaSummaryStrip';
import { QUOTA_PAGE_SIZE, QUOTA_TAB_ORDER, type QuotaTabId } from '@/features/quota/constants';
import { classifyQuotaFiles } from '@/features/quota/logic';
import { useQuotaBatchLoader } from '@/features/quota/hooks/useQuotaBatchLoader';
import type { QuotaCardState } from '@/features/quota/providers';
import type { QuotaProviderType } from '@/features/quota/providers/types';
import { summarizeProvider } from '@/features/quota/quotaLedgerModel';
import { writeQuotaUiState } from '@/features/quota/uiState';
import styles from '../dashboard.module.scss';

interface DashboardQuotaPanelProps {
  authFiles: AuthFileItem[] | null;
  connected: boolean;
  resolvedTheme: ResolvedTheme;
}

export function DashboardQuotaPanel({ authFiles, connected, resolvedTheme }: DashboardQuotaPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const now = useNow();
  const { batchLoading, loadQuota } = useQuotaBatchLoader();

  const antigravityQuota = useQuotaStore((state) => state.antigravityQuota);
  const claudeQuota = useQuotaStore((state) => state.claudeQuota);
  const codexQuota = useQuotaStore((state) => state.codexQuota);
  const devinQuota = useQuotaStore((state) => state.devinQuota);
  const kimiQuota = useQuotaStore((state) => state.kimiQuota);
  const metaQuota = useQuotaStore((state) => state.metaQuota);
  const xaiQuota = useQuotaStore((state) => state.xaiQuota);

  const entries = useMemo(
    () => classifyQuotaFiles(authFiles ?? []).filter((entry) => !entry.file.disabled),
    [authFiles]
  );

  const summaries = useMemo(() => {
    const byType = {
      antigravity: antigravityQuota,
      claude: claudeQuota,
      codex: codexQuota,
      devin: devinQuota,
      kimi: kimiQuota,
      meta: metaQuota,
      xai: xaiQuota,
    } as unknown as Record<QuotaProviderType, Record<string, QuotaCardState>>;
    const inputs = entries.map((entry) => ({
      key: getQuotaCacheKey(entry.file),
      name: entry.file.name,
      type: entry.type,
      quota: byType[entry.type][getQuotaCacheKey(entry.file)],
    }));
    return QUOTA_TAB_ORDER.filter((type) => inputs.some((input) => input.type === type)).map(
      (type) => summarizeProvider(type, inputs)
    );
  }, [
    entries,
    antigravityQuota,
    claudeQuota,
    codexQuota,
    devinQuota,
    kimiQuota,
    metaQuota,
    xaiQuota,
  ]);

  const openProvider = useCallback(
    (type: string) => {
      writeQuotaUiState({ tab: type as QuotaTabId });
      navigate('/quota');
    },
    [navigate]
  );

  if (summaries.length === 0) return null;

  return (
    <section className={styles.providerSection} aria-labelledby="dashboard-quota-title">
      <header className={styles.sectionHeader}>
        <div>
          <h2 id="dashboard-quota-title" className={styles.sectionTitle}>
            {t('dashboard.quota_title')}
          </h2>
          <p className={styles.sectionDescription}>{t('dashboard.quota_subtitle')}</p>
        </div>
        <div className={styles.quotaPanelActions}>
          <Button
            variant="secondary"
            size="sm"
            className={styles.quotaLoadButton}
            disabled={!connected || batchLoading}
            loading={batchLoading}
            onClick={() => void loadQuota(entries.slice(0, QUOTA_PAGE_SIZE))}
          >
            {!batchLoading && <IconRefreshCw size={14} />}
            {t('dashboard.quota_load_all')}
          </Button>
          <Link to="/quota" className={styles.textLink}>
            {t('dashboard.quota_open')}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <QuotaSummaryStrip
        summaries={summaries}
        resolvedTheme={resolvedTheme}
        now={now}
        onSelect={openProvider}
      />
    </section>
  );
}
