"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClientUuid } from "@/lib/ids/create-client-uuid";
import { ensureAnonymousSession } from "@/lib/supabase/client";

type LiveSyncState = "connecting" | "live" | "degraded" | "offline";

export function useCampLiveSync({
  alwaysPoll = false,
  campId,
  onError,
  refresh,
}: {
  alwaysPoll?: boolean;
  campId: string;
  onError: (error: unknown) => void;
  refresh: () => Promise<void>;
}) {
  const [online, setOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine,
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number>();
  const [synced, setSynced] = useState(false);
  const [state, setState] = useState<LiveSyncState>("connecting");
  const syncPromise = useRef<Promise<void> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    if (syncPromise.current) {
      return syncPromise.current;
    }

    const request = refresh()
      .then(() => {
        setSynced(true);
        setLastSyncedAt(Date.now());
      })
      .catch((error: unknown) => {
        setSynced(false);
        onError(error);
        throw error;
      })
      .finally(() => {
        syncPromise.current = null;
      });
    syncPromise.current = request;
    return request;
  }, [onError, refresh]);

  useEffect(() => {
    let active = true;
    let realtimeReady = false;
    let channel: RealtimeChannel | undefined;

    function scheduleSync() {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void sync().catch(() => undefined);
      }, 80);
    }

    async function connect() {
      try {
        await sync();
        if (!active) return;

        const client = await ensureAnonymousSession();
        channel = client
          .channel(`camp:${campId}:${createClientUuid()}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              filter: `camp_id=eq.${campId}`,
              schema: "public",
              table: "groups",
            },
            scheduleSync,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              filter: `id=eq.${campId}`,
              schema: "public",
              table: "camps",
            },
            scheduleSync,
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              filter: `camp_id=eq.${campId}`,
              schema: "public",
              table: "transactions",
            },
            scheduleSync,
          )
          .subscribe((status) => {
            if (!active) return;
            if (status === "SUBSCRIBED") {
              realtimeReady = true;
              setState("live");
              void sync().catch(() => undefined);
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              realtimeReady = false;
              setState(window.navigator.onLine ? "degraded" : "offline");
            }
          });
      } catch {
        if (active) {
          setState(window.navigator.onLine ? "degraded" : "offline");
        }
      }
    }

    async function handleOnline() {
      setOnline(true);
      setState(realtimeReady ? "live" : "degraded");
      try {
        await sync();
      } catch {
        // The hook remains unsynced until the next two-second retry succeeds.
      }
    }

    function handleOffline() {
      setOnline(false);
      setSynced(false);
      setState("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const fallback = window.setInterval(() => {
      if (window.navigator.onLine && (alwaysPoll || !realtimeReady)) {
        void sync().catch(() => undefined);
      }
    }, 2_000);
    void connect();

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(fallback);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (channel) {
        const subscribedChannel = channel;
        void ensureAnonymousSession().then((client) => client.removeChannel(subscribedChannel));
      }
    };
  }, [alwaysPoll, campId, sync]);

  return {
    canWrite: online && synced,
    lastSyncedAt,
    online,
    refreshNow: sync,
    state,
    synced,
  };
}
