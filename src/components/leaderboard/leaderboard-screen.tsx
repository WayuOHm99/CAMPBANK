"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

import { MotionRankingItem } from "@/components/shared/motion";
import { ScreenState } from "@/components/shared/screen-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { getGroupDisplayName } from "@/lib/groups/get-group-display-name";
import { formatScore } from "@/lib/score/format-score";
import { useCampLiveSync } from "@/lib/realtime/use-camp-live-sync";
import { ensureAnonymousSession } from "@/lib/supabase/client";
import { isRpcFailure, type LeaderboardSnapshot } from "@/types/domain";

export function LeaderboardScreen({ publicCode }: { publicCode: string }) {
  const [campId, setCampId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    async function join() {
      try {
        const client = await ensureAnonymousSession();
        const { data, error: rpcError } = await client.rpc(
          "join_public_leaderboard",
          {
            p_public_code: publicCode,
          },
        );
        if (rpcError) throw rpcError;
        if (isRpcFailure(data)) throw new Error(data.error.message);
        if (active) setCampId((data as { camp_id: string }).camp_id);
      } catch (joinError) {
        if (active) {
          setError(
            joinError instanceof Error
              ? joinError.message
              : "ไม่สามารถเปิดอันดับได้",
          );
        }
      }
    }

    void join();
    return () => {
      active = false;
    };
  }, [publicCode]);

  if (error) {
    return (
      <ScreenState backHref="/" title="ยังไม่เปิดแสดงอันดับ" message={error} />
    );
  }
  if (!campId) {
    return (
      <ScreenState
        backHref="/"
        busy
        title="กำลังเปิด Leaderboard"
        message="ดึงอันดับล่าสุดจากค่าย"
      />
    );
  }
  return <LiveLeaderboard campId={campId} />;
}

function LiveLeaderboard({ campId }: { campId: string }) {
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const client = await ensureAnonymousSession();
    const { data, error: rpcError } = await client.rpc(
      "get_leaderboard_snapshot",
      {
        p_camp_id: campId,
      },
    );
    if (rpcError) throw rpcError;
    if (isRpcFailure(data)) throw new Error(data.error.message);
    startTransition(() => {
      setSnapshot(data as LeaderboardSnapshot);
      setError(undefined);
    });
  }, [campId]);

  const handleError = useCallback((syncError: unknown) => {
    setSnapshot(undefined);
    setError(
      syncError instanceof Error
        ? syncError.message
        : "ไม่สามารถอัปเดตอันดับได้",
    );
  }, []);

  const live = useCampLiveSync({
    alwaysPoll: true,
    campId,
    onError: handleError,
    refresh,
  });

  if (error) {
    return (
      <ScreenState backHref="/" title="ยังไม่เปิดแสดงอันดับ" message={error} />
    );
  }
  if (!snapshot) {
    return (
      <ScreenState
        backHref="/"
        busy
        title="กำลังจัดอันดับ"
        message="คำนวณจากคะแนนล่าสุด"
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--eq-canvas-soft)] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[var(--eq-ink)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="eq-app-header flex items-start justify-between gap-4 py-4">
          <div>
            <Link
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--eq-brand-deep)]"
              href="/"
            >
              ← กลับหน้าแรก
            </Link>
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--eq-brand-deep)]">
              EQ-BANK
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {snapshot.camp.name}
            </h1>
            <p className="mt-2 text-sm text-[var(--eq-muted)]">
              อันดับคะแนนล่าสุด
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--eq-brand-deep)]">
              แสดง {snapshot.camp.public_result_limit} อันดับแรก
            </p>
          </div>
          <div className="flex flex-col items-end gap-2" aria-live="polite">
            <StatusBadge axis="camp" status={snapshot.camp.status} />
            <StatusBadge axis="connection" status={live.state} />
          </div>
        </header>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          {snapshot.ranking.slice(0, 3).map((group, index) => (
            <MotionRankingItem id={group.id} key={group.id}>
              <article
                className={`eq-ranking-item relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ${
                  index === 0
                    ? `border-[var(--eq-border-strong)] ${snapshot.camp.status === "closed" ? "eq-closed-winner" : ""}`
                    : "border-[var(--eq-border)]"
                }`}
                data-rank={index + 1}
              >
                <span
                  className={`text-4xl font-bold ${index === 0 ? "text-[var(--eq-brand-deep)]" : "text-[var(--eq-muted)]"}`}
                >
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute right-5 top-5 h-12 w-3 rounded-full eq-swatch"
                  style={{ backgroundColor: group.color_hex }}
                />
                <p className="mt-5 text-sm font-semibold text-[var(--eq-muted)]">
                  {group.color_name}
                </p>
                <h2 className="text-2xl font-bold">
                  {getGroupDisplayName(group.color_name, group.custom_name)}
                </h2>
                <p className="mt-5 text-3xl font-bold tabular-nums">
                  {formatScore(group.current_score)}
                </p>
              </article>
            </MotionRankingItem>
          ))}
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--eq-border)] bg-white p-3 shadow-sm">
          {snapshot.ranking.slice(3).map((group) => (
            <MotionRankingItem id={group.id} key={group.id}>
              <div
                className="eq-ranking-item flex min-h-14 items-center gap-3 border-b border-[var(--eq-border)] px-3 last:border-0"
                data-rank={group.rank}
              >
                <span className="w-7 font-bold text-[var(--eq-muted)]">
                  {group.rank}
                </span>
                <span
                  aria-hidden="true"
                  className="h-7 w-2 rounded-full eq-swatch"
                  style={{ backgroundColor: group.color_hex }}
                />
                <span className="min-w-0 flex-1 font-semibold">
                  {group.color_name} —{" "}
                  {getGroupDisplayName(group.color_name, group.custom_name)}
                </span>
                <span className="font-bold tabular-nums">
                  {formatScore(group.current_score)}
                </span>
              </div>
            </MotionRankingItem>
          ))}
        </section>

        {snapshot.camp.status === "closed" ? (
          <p className="mt-5 text-center text-sm font-semibold text-[var(--eq-muted)]">
            ผลคะแนนเมื่อปิดค่าย
          </p>
        ) : null}
      </div>
    </main>
  );
}
