/**
 * Ledger view: credentials grouped by provider, one dense row each.
 *
 * A row reads left to right — credential and plan, then up to three windows
 * (longest first, remaining percent, meter, reset), then the refresh action.
 * Idle rows stay click-to-load like the card grid; nothing is fetched on mount.
 */

import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { buildResetDisplay, resolveQuotaErrorMessage } from '@/utils/quota';
import { getQuotaCacheKey, getQuotaDisplayName } from '@/utils/quota/identity';
import { getTypeLabel } from '@/features/authFiles/constants';
import { QUOTA_PROGRESS_HIGH_THRESHOLD, QUOTA_PROGRESS_MEDIUM_THRESHOLD } from './QuotaMeter';
import { QUOTA_TAB_ORDER } from '../constants';
import type { QuotaFileEntry } from '../logic';
import type { QuotaCardState } from '../providers';
import { ledgerRowWindows, ledgerWindows, type LedgerWindow } from '../quotaLedgerModel';
import styles from './QuotaLedger.module.scss';

export type QuotaLedgerProps = {
  entries: QuotaFileEntry[];
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  now: number;
  canRefresh: (entry: QuotaFileEntry) => boolean;
  onRefresh: (entry: QuotaFileEntry) => void;
};

const toneOf = (remaining: number | null) =>
  remaining === null
    ? 'none'
    : remaining >= QUOTA_PROGRESS_HIGH_THRESHOLD
      ? 'high'
      : remaining >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
        ? 'medium'
        : 'low';

const planOf = (quota: QuotaCardState | undefined): string | null => {
  const plan = (quota as { planType?: string | null } | undefined)?.planType;
  if (typeof plan !== 'string' || !plan.trim()) return null;
  // `plan_max` / `claude_pro` / `pro` → `Max` / `Pro` / `Pro`
  const words = plan
    .trim()
    .replace(/^(plan|claude)[_\s-]+/i, '')
    .split(/[_\s-]+/)
    .filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || null;
};

function WindowCell({ window, now }: { window: LedgerWindow; now: number }) {
  const { t, i18n } = useTranslation();
  const label = window.label || (window.labelKey ? t(window.labelKey) : window.id);
  const reset = buildResetDisplay(null, window.resetAtMs, now, i18n.resolvedLanguage);
  return (
    <div className={styles.window}>
      <div className={styles.windowHead}>
        <span className={styles.windowLabel} title={label}>
          {label}
        </span>
        <strong className={styles.windowValue}>
          {window.remaining === null ? '--' : `${Math.round(window.remaining)}%`}
        </strong>
      </div>
      <span className={styles.track}>
        <span
          className={styles.fill}
          data-tone={toneOf(window.remaining)}
          style={{ width: `${window.remaining ?? 0}%` }}
        />
      </span>
      <span className={styles.reset}>
        {reset ? (
          <>
            <span className={styles.resetRelative}>{reset.relative}</span>
            <span className={styles.resetAbsolute}>{reset.absolute}</span>
          </>
        ) : (
          t('quota_management.ledger_no_reset')
        )}
      </span>
    </div>
  );
}

export function QuotaLedger({ entries, quotaFor, now, canRefresh, onRefresh }: QuotaLedgerProps) {
  const { t } = useTranslation();

  const groups = QUOTA_TAB_ORDER.map((type) => ({
    type,
    items: entries.filter((entry) => entry.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <div className={styles.ledger}>
      {groups.map((group) => (
        <section
          key={group.type}
          className={styles.group}
          aria-label={getTypeLabel(t, group.type)}
        >
          <h2 className={styles.groupTitle}>
            {getTypeLabel(t, group.type)}
            <span className={styles.groupCount}>{group.items.length}</span>
          </h2>
          <ul className={styles.rows}>
            {group.items.map((entry) => {
              const quota = quotaFor(entry);
              const status = quota?.status ?? 'idle';
              const name = getQuotaDisplayName(entry.file);
              const plan = planOf(quota);
              const windows = ledgerRowWindows(ledgerWindows(entry.type, quota));
              const refreshable = canRefresh(entry) && status !== 'loading';
              return (
                <li key={`${entry.type}:${getQuotaCacheKey(entry.file)}`} className={styles.row}>
                  <div className={styles.identity}>
                    <span className={styles.name} title={name}>
                      {name}
                    </span>
                    <span className={styles.plan}>
                      {plan ?? (entry.file.disabled ? t('quota_management.ledger_disabled') : '')}
                    </span>
                  </div>

                  <div className={styles.windows} aria-busy={status === 'loading'}>
                    {status === 'success' && windows.length > 0 ? (
                      windows.map((window) => (
                        <WindowCell key={window.id} window={window} now={now} />
                      ))
                    ) : status === 'success' ? (
                      <span className={styles.note}>{t('quota_management.ledger_no_windows')}</span>
                    ) : status === 'error' ? (
                      <span className={styles.error} role="status">
                        {resolveQuotaErrorMessage(
                          t,
                          quota?.errorStatus,
                          quota?.error || t('common.unknown_error')
                        )}
                      </span>
                    ) : status === 'loading' ? (
                      <span className={styles.note}>{t('common.loading')}</span>
                    ) : (
                      <span className={styles.note}>{t('quota_management.ledger_not_loaded')}</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.refresh}
                    onClick={() => onRefresh(entry)}
                    disabled={!refreshable}
                  >
                    <IconRefreshCw
                      size={13}
                      className={status === 'loading' ? styles.spinning : undefined}
                      aria-hidden="true"
                    />
                    {status === 'idle'
                      ? t('quota_management.ledger_load')
                      : t('quota_management.ledger_refresh')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
