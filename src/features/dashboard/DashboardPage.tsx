import { useCallback, useRef, useState } from 'react';
import { useAuthStore, useThemeStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { DashboardOverview } from './components/DashboardOverview';
import { useDashboardOverview } from './hooks/useDashboardOverview';

export function DashboardPage() {
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const overview = useDashboardOverview();
  const { connected, refresh } = overview;
  const refreshInFlight = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!connected || refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [connected, refresh]);

  useHeaderRefresh(handleRefresh, connected);

  return (
    <DashboardOverview
      {...overview}
      serverVersion={serverVersion}
      serverBuildDate={serverBuildDate}
      resolvedTheme={resolvedTheme}
      refreshing={refreshing}
      onRefresh={handleRefresh}
    />
  );
}
