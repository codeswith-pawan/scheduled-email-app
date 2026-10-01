'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Email } from '@/types';

const POLL_INTERVAL_MS = 10_000;

interface UseEmailsResult {
  scheduled: Email[];
  sent: Email[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Loads both lists and refreshes them in the background so status changes appear without a reload. */
export function useEmails(): UseEmailsResult {
  const [scheduled, setScheduled] = useState<Email[]>([]);
  const [sent, setSent] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [scheduledEmails, sentEmails] = await Promise.all([api.listScheduled(), api.listSent()]);
      setScheduled(scheduledEmails);
      setSent(sentEmails);
      setError(null);
      hasLoaded.current = true;
    } catch (caught) {
      // Keep showing existing data when a background refresh fails.
      if (!hasLoaded.current) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load your emails.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { scheduled, sent, loading, error, refresh };
}
