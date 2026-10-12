/**
 * Provider headroom strip: one card per provider that has credentials.
 *
 * Each card leads with the binding window (summed remaining percent over the
 * provider's capacity, e.g. `409% of 500%`), a segmented meter with one segment
 * per credential, and the soonest reset. Shared by the quota page and the
 * dashboard; both feed it from the same quota cache.
 */

import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import { QUOTA_PROGRESS_HIGH_THRESHOLD, QUOTA_PROGRESS_MEDIUM_THRESHOLD } from './QuotaMeter';
import type { LedgerHeadline, LedgerSegment, ProviderLedgerSummary } from '../quotaLedgerModel';
import styles from './QuotaSummaryStrip.module.scss';

export type QuotaSummaryStripProps = {
  summaries: ProviderLedgerSummary[];
  resolvedTheme: ResolvedTheme;
  now: number;
  /** Called with a provider type when its card is activated (e.g. filter or navigate). */
  onSelect?: (type: string) => void;
};

const toneOf = (remaining: number | null) =>
  remaining === null
    ? 'none'
    : remaining >= QUOTA_PROGRESS_HIGH_THRESHOLD
      ? 'high'
      : remaining >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
        ? 'medium'
        : 'low';

function headlineLabel(t: (key: string) => string, headline: LedgerHeadline) {
  return headline.label || (headline.labelKey ? t(headline.labelKey) : headline.id);
}

function Segments({ segments, label }: { segments: LedgerSegment[]; label: string }) {
  return (
    <div className={styles.segments} role="img" aria-label={label}>
      {segments.map((segment) => (
        <span key={segment.key} className={styles.segment} title={segment.name}>
          <span
            className={styles.segmentFill}
            data-tone={toneOf(segment.remaining)}
            style={{ width: `${segment.remaining ?? 0}%` }}
          />
        </span>
      ))}
    </div>
  );
}

export function QuotaSummaryStrip({
  summaries,
  resolvedTheme,
  now,
  onSelect,
}: QuotaSummaryStripProps) {
  const { t, i18n } = useTranslation();
  if (summaries.length === 0) return null;

  return (
    <section className={styles.strip} aria-label={t('quota_management.ledger_summary_label')}>
      {summaries.map((summary) => {
        const { type, headline, secondary } = summary;
        const typeLabel = getTypeLabel(t, type);
        const iconSrc = getAuthFileIcon(type, resolvedTheme);
        const reset = headline
          ? buildResetDisplay(null, headline.nextResetMs, now, i18n.resolvedLanguage)
          : null;
        const title = headline ? headlineLabel(t, headline) : t('quota_management.ledger_no_data');
        const percent = headline ? Math.round((headline.remainingSum / headline.capacity) * 100) : null;
        const Tag = onSelect ? 'button' : 'div';

        return (
          <Tag
            key={type}
            className={styles.card}
            data-tone={toneOf(percent)}
            {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(type) } : {})}
          >
            <header className={styles.head}>
              <span
                className={styles.iconWrap}
                style={
                  isThemeSurfaceIconProvider(type)
                    ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
                    : undefined
                }
              >
                {iconSrc ? (
                  <img src={iconSrc} alt="" className={styles.icon} />
                ) : (
                  <span className={styles.iconFallback}>{typeLabel.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <span className={styles.provider}>{typeLabel}</span>
              <span className={styles.count}>
                {t('quota_management.ledger_credentials', { count: summary.credentialCount })}
              </span>
            </header>

            <span className={styles.windowLabel}>{title}</span>
            <span className={styles.figure}>
              <strong className={styles.value}>
                {headline ? `${headline.remainingSum}%` : '--'}
              </strong>
              <span className={styles.capacity}>
                {t('quota_management.ledger_of', {
                  capacity: `${headline ? headline.capacity : summary.credentialCount * 100}%`,
                })}
              </span>
            </span>

            {headline ? (
              <Segments
                segments={headline.segments}
                label={t('quota_management.ledger_segments_label', {
                  window: title,
                  loaded: summary.loadedCount,
                  total: summary.credentialCount,
                })}
              />
            ) : (
              <div className={styles.segments} aria-hidden="true">
                {Array.from({ length: Math.max(1, summary.credentialCount) }, (_, index) => (
                  <span key={index} className={styles.segment} />
                ))}
              </div>
            )}

            <span className={styles.reset}>
              {reset ? (
                <>
                  <span className={styles.resetRelative}>{reset.relative}</span>
                  <span className={styles.resetAbsolute}>{reset.absolute}</span>
                </>
              ) : summary.loadedCount === 0 ? (
                summary.errorCount > 0 ? (
                  <span className={styles.attention}>
                    {t('quota_management.meta_attention', { count: summary.errorCount })}
                  </span>
                ) : (
                  t('quota_management.ledger_not_loaded')
                )
              ) : (
                t('quota_management.ledger_no_reset')
              )}
            </span>

            {secondary && (
              <footer className={styles.secondary}>
                <span>{headlineLabel(t, secondary)}</span>
                <strong>{secondary.remainingSum}%</strong>
              </footer>
            )}
          </Tag>
        );
      })}
    </section>
  );
}
