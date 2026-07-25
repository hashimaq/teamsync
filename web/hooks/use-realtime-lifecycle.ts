"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps realtime UIs fresh across browsers when WebSockets stall
 * (common in Firefox/Safari after backgrounding or network blips).
 */
export function useRealtimeLifecycle(options: {
  enabled: boolean;
  onResume: () => void;
  /** Soft poll while the tab is visible (ms). 0 = off. */
  pollIntervalMs?: number;
}) {
  const { enabled, onResume, pollIntervalMs = 12_000 } = options;
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      onResumeRef.current();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);

    let pollId: number | null = null;
    if (pollIntervalMs > 0) {
      pollId = window.setInterval(() => {
        if (document.visibilityState === "visible") run();
      }, pollIntervalMs);
    }

    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
      if (pollId != null) window.clearInterval(pollId);
    };
  }, [enabled, pollIntervalMs]);
}
