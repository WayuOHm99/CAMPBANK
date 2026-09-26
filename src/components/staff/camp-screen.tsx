"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ScoreActionContent,
  ScoreActionGlyph,
  ScoreDirectionHeading,
  scoreActionDirectionFromAmount,
  scoreActionToneClass,
} from "@/components/shared/score-action-visual";
import { ScreenState } from "@/components/shared/screen-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { getGroupDisplayName } from "@/lib/groups/get-group-display-name";
import { createClientUuid } from "@/lib/ids/create-client-uuid";
import { formatScore } from "@/lib/score/format-score";
import { remoteScoreChanges } from "@/lib/score/score-feedback";
import { useCampLiveSync } from "@/lib/realtime/use-camp-live-sync";
import { ensureAnonymousSession } from "@/lib/supabase/client";
import {
  isRpcFailure,
  type CampSnapshot,
  type ScoreResult,
} from "@/types/domain";

type CampScreenProps = {
  campId: string;
};

type Toast = {
  id: string;
  message: string;
  transactionId: string;
  createdAt: string;
  feedbackDeadline: number;
  exiting?: boolean;
};

type ScoreConfirmation = {
  amount: number;
  buttonId: string;
  groupId: string;
  groupLabel: string;
};

type ActivityPreference = {
  activityId: string;
  roundId: string;
};

type GroupLayout = "auto" | "single" | "double" | "rail";

type GroupFeedback = {
  groupId: string;
  id: string;
  kind: "local" | "remote";
  message: string;
};

function subscribeToStoredJoinCode(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const GROUP_LAYOUTS: Array<{ id: GroupLayout; label: string }> = [
  { id: "auto", label: "อัตโนมัติ" },
  { id: "single", label: "1 คอลัมน์" },
  { id: "double", label: "2 คอลัมน์" },
  { id: "rail", label: "แถวเลื่อน" },
];

function readActivityPreference(campId: string): ActivityPreference {
  if (typeof window === "undefined") {
    return { activityId: "", roundId: "" };
  }

  const memberId = window.localStorage.getItem(`eqcamp:last-staff:${campId}`);
  if (!memberId) {
    return { activityId: "", roundId: "" };
  }

  const preferenceKey = `eqcamp:activity:${campId}:${memberId}`;
  const saved = window.localStorage.getItem(preferenceKey);
  if (!saved) {
    return { activityId: "", roundId: "" };
  }

  try {
    const value = JSON.parse(saved) as Partial<ActivityPreference>;
    return {
      activityId: value.activityId ?? "",
      roundId: value.roundId ?? "",
    };
  } catch {
    window.localStorage.removeItem(preferenceKey);
    return { activityId: "", roundId: "" };
  }
}

export function CampScreen({ campId }: CampScreenProps) {
  const [snapshot, setSnapshot] = useState<CampSnapshot>();
  const [error, setError] = useState<string>();
  const [pendingActions, setPendingActions] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingGroupId, setEditingGroupId] = useState<string>();
  const [editingGroupName, setEditingGroupName] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const [search, setSearch] = useState("");
  const [groupLayout, setGroupLayout] = useState<GroupLayout>("auto");
  const [activityPreference, setActivityPreference] = useState(() =>
    readActivityPreference(campId),
  );
  const [toast, setToast] = useState<Toast>();
  const [scoreConfirmation, setScoreConfirmation] =
    useState<ScoreConfirmation>();
  const [groupFeedback, setGroupFeedback] = useState<
    Record<string, GroupFeedback>
  >({});
  const latestRefreshId = useRef(0);
  const groupScoreBaseline = useRef(new Map<string, number>());
  const localTransactionIds = useRef(new Set<string>());
  const scoreBaselineReady = useRef(false);
  const editButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const joinCode = useSyncExternalStore(
    subscribeToStoredJoinCode,
    () => window.localStorage.getItem(`eqcamp:staff-link:${campId}`) ?? "",
    () => "",
  );
  const { activityId, roundId } = activityPreference;

  const refresh = useCallback(async () => {
    const refreshId = latestRefreshId.current + 1;
    latestRefreshId.current = refreshId;
    const client = await ensureAnonymousSession();
    const { data, error: rpcError } = await client.rpc("get_camp_snapshot", {
      p_camp_id: campId,
    });

    if (rpcError) {
      throw rpcError;
    }

    if (isRpcFailure(data)) {
      throw new Error(data.error.message);
    }

    if (refreshId !== latestRefreshId.current) return;
    const nextSnapshot = data as CampSnapshot;
    const changedGroups = scoreBaselineReady.current
      ? remoteScoreChanges(
          nextSnapshot.groups,
          groupScoreBaseline.current,
          nextSnapshot.recent_transactions,
          localTransactionIds.current,
        )
      : [];

    if (changedGroups.length > 0) {
      setGroupFeedback((current) => ({
        ...current,
        ...Object.fromEntries(
          changedGroups.map((group) => [
            group.id,
            {
              groupId: group.id,
              id: `${group.id}:${group.current_score}`,
              kind: "remote" as const,
              message: `คะแนนล่าสุดของ ${getGroupDisplayName(group.color_name, group.custom_name)} อัปเดตเป็น ${formatScore(group.current_score)} คะแนน`,
            },
          ]),
        ),
      }));
    }
    for (const transaction of nextSnapshot.recent_transactions)
      localTransactionIds.current.delete(transaction.id);

    groupScoreBaseline.current = new Map(
      nextSnapshot.groups.map((group) => [group.id, group.current_score]),
    );
    scoreBaselineReady.current = true;
    setSnapshot(nextSnapshot);
    setError(undefined);
  }, [campId]);

  useEffect(() => {
    if (Object.keys(groupFeedback).length === 0) return;

    const timeout = window.setTimeout(() => setGroupFeedback({}), 2_400);
    return () => window.clearTimeout(timeout);
  }, [groupFeedback]);

  useEffect(() => {
    if (!toast) return;
    const delay = toast.exiting
      ? 160
      : Math.max(0, toast.feedbackDeadline - performance.now());
    const timeout = window.setTimeout(() => {
      setToast((current) =>
        current?.id !== toast.id
          ? current
          : toast.exiting
            ? undefined
            : { ...current, exiting: true },
      );
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSyncError = useCallback((syncError: unknown) => {
    setError(
      syncError instanceof Error
        ? syncError.message
        : "ไม่สามารถโหลดข้อมูลค่ายได้",
    );
  }, []);
  const live = useCampLiveSync({
    campId,
    onError: handleSyncError,
    pollIntervalMs: 10_000,
    refresh,
  });

  const selectedActivity = snapshot?.activities.find(
    (activity) => activity.id === activityId,
  );
  const selectedRound = selectedActivity?.rounds.find(
    (round) => round.id === roundId,
  );

  const filteredGroups = useMemo(() => {
    if (!snapshot) return [];
    const query = search.trim().toLocaleLowerCase("th");
    if (!query) return snapshot.groups;

    // A bare number jumps to that Group number, not to every number containing it.
    if (/^\d+$/.test(query)) {
      return snapshot.groups.filter(
        (group) => group.sort_order === Number(query),
      );
    }

    return snapshot.groups.filter((group) =>
      `${group.color_name} ${getGroupDisplayName(group.color_name, group.custom_name)}`
        .toLocaleLowerCase("th")
        .includes(query),
    );
  }, [search, snapshot]);

  // One label per direction beats the same Thai word repeated inside every
  // button on every card. Splitting by direction also survives any Admin
  // button set, including an uneven number of add and subtract buttons.
  const scoreButtonSections = useMemo(() => {
    if (!snapshot) return [];

    return (["add", "subtract"] as const)
      .map((direction) => ({
        direction,
        buttons: snapshot.score_buttons.filter(
          (button) =>
            scoreActionDirectionFromAmount(button.amount) === direction,
        ),
      }))
      .filter((section) => section.buttons.length > 0);
  }, [snapshot]);

  async function renameGroup(groupId: string) {
    if (!snapshot || renamePending || snapshot.camp.status !== "active") return;

    setRenamePending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc(
        "update_staff_group_name",
        {
          p_camp_id: campId,
          p_custom_name: editingGroupName,
          p_group_id: groupId,
        },
      );
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);

      const updated = (data as { group: { id: string; custom_name: string } })
        .group;
      setSnapshot((current) =>
        current
          ? {
              ...current,
              groups: current.groups.map((group) =>
                group.id === updated.id
                  ? { ...group, custom_name: updated.custom_name }
                  : group,
              ),
            }
          : current,
      );
      setEditingGroupId(undefined);
      setEditingGroupName("");
      void refresh().catch(handleSyncError);
      window.requestAnimationFrame(() =>
        editButtonRefs.current[groupId]?.focus(),
      );
    } catch (renameError) {
      setError(
        renameError instanceof Error
          ? renameError.message
          : "บันทึกชื่อกลุ่มไม่สำเร็จ",
      );
    } finally {
      setRenamePending(false);
    }
  }

  function saveActivity(nextActivityId: string, nextRoundId = "") {
    setActivityPreference({
      activityId: nextActivityId,
      roundId: nextRoundId,
    });
    const memberId = window.localStorage.getItem(`eqcamp:last-staff:${campId}`);
    if (!memberId) return;

    window.localStorage.setItem(
      `eqcamp:activity:${campId}:${memberId}`,
      JSON.stringify({ activityId: nextActivityId, roundId: nextRoundId }),
    );
  }

  async function refreshNow() {
    if (refreshPending) return;

    setRefreshPending(true);
    setError(undefined);
    try {
      await live.refreshNow();
    } catch {
      // useCampLiveSync forwards the actionable error through handleSyncError.
    } finally {
      setRefreshPending(false);
    }
  }

  async function score(groupId: string, buttonId: string, amount: number) {
    const actionKey = `${groupId}:${buttonId}`;
    if (
      !snapshot ||
      pendingActions.has(actionKey) ||
      !live.canWrite ||
      snapshot.camp.status !== "active"
    )
      return;

    const clientActionId = createClientUuid();
    setPendingActions((current) => new Set(current).add(actionKey));
    setGroupFeedback({});
    setError(undefined);

    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc(
        "apply_score_transaction",
        {
          p_activity_id: activityId || null,
          p_camp_id: campId,
          p_client_action_id: clientActionId,
          p_group_id: groupId,
          p_round_id: roundId || null,
          p_score_button_id: buttonId,
        },
      );

      if (rpcError) {
        throw rpcError;
      }

      if (isRpcFailure(data)) {
        throw new Error(data.error.message);
      }

      const result = data as ScoreResult;
      const group = snapshot.groups.find((item) => item.id === groupId);
      localTransactionIds.current.add(result.transaction.id);
      groupScoreBaseline.current.set(groupId, result.group.current_score);
      setGroupFeedback((current) => ({
        ...current,
        [groupId]: {
          groupId,
          id: result.transaction.id,
          kind: "local",
          message: `บันทึกคะแนนของ ${
            group
              ? getGroupDisplayName(group.color_name, group.custom_name)
              : "กลุ่ม"
          } แล้ว`,
        },
      }));
      setSnapshot((current) => {
        if (!current) return current;
        return {
          ...current,
          camp: {
            ...current.camp,
            ...result.camp,
          },
          groups: current.groups.map((item) =>
            item.id === groupId
              ? {
                  ...item,
                  current_score: result.group.current_score,
                  score_reached_at: result.group.score_reached_at,
                }
              : item,
          ),
          recent_transactions: [
            {
              id: result.transaction.id,
              group_id: groupId,
              amount: result.transaction.amount,
              transaction_type: result.transaction.transaction_type,
              group_color_name_snapshot: group?.color_name ?? "",
              group_color_hex_snapshot: group?.color_hex ?? "#5c5c5c",
              group_custom_name_snapshot: group?.custom_name ?? "",
              actor_name_snapshot: snapshot.actor.display_name,
              activity_name_snapshot: selectedActivity?.name ?? null,
              round_label_snapshot:
                selectedActivity?.rounds.find((round) => round.id === roundId)
                  ?.label ?? null,
              created_at: result.transaction.created_at,
            },
            ...current.recent_transactions,
          ].slice(0, 50),
        };
      });

      setToast((current) => {
        if (current && current.createdAt > result.transaction.created_at)
          return current;
        return {
          id: result.transaction.id,
          message: `${snapshot.actor.display_name} · ${
            amount > 0 ? "เพิ่ม" : "ลด"
          } ${formatScore(Math.abs(amount))} คะแนน${
            amount > 0 ? "ให้" : "จาก"
          } ${
            group
              ? `${group.color_name} — ${getGroupDisplayName(
                  group.color_name,
                  group.custom_name,
                )}`
              : "กลุ่ม"
          } แล้ว`,
          transactionId: result.transaction.id,
          createdAt: result.transaction.created_at,
          feedbackDeadline: performance.now() + 15_000,
        };
      });
      void refresh().catch(handleSyncError);
      triggerSuccessfulScoreHaptic();
    } catch (scoreError) {
      setError(
        scoreError instanceof Error
          ? scoreError.message
          : "ไม่สามารถบันทึกคะแนนได้",
      );
    } finally {
      setPendingActions((current) => {
        const next = new Set(current);
        next.delete(actionKey);
        return next;
      });
    }
  }

  function requestScore(
    group: CampSnapshot["groups"][number],
    button: CampSnapshot["score_buttons"][number],
  ) {
    if (
      !snapshot ||
      pendingActions.has(`${group.id}:${button.id}`) ||
      !live.canWrite ||
      snapshot.camp.status !== "active"
    ) {
      return;
    }

    if (button.requires_confirmation) {
      setScoreConfirmation({
        amount: button.amount,
        buttonId: button.id,
        groupId: group.id,
        groupLabel: `${group.color_name} — ${getGroupDisplayName(
          group.color_name,
          group.custom_name,
        )}`,
      });
      return;
    }

    void score(group.id, button.id, button.amount);
  }

  async function undo() {
    const actionKey = toast ? `undo:${toast.transactionId}` : "";
    if (!toast || toast.exiting || pendingActions.size > 0 || !live.canWrite)
      return;

    setPendingActions((current) => new Set(current).add(actionKey));
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc("quick_undo", {
        p_camp_id: campId,
        p_client_action_id: createClientUuid(),
        p_transaction_id: toast.transactionId,
      });
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);

      const result = data as ScoreResult;
      localTransactionIds.current.add(result.transaction.id);
      groupScoreBaseline.current.set(
        result.group.id,
        result.group.current_score,
      );
      setToast((current) =>
        current ? { ...current, exiting: true } : current,
      );
      void refresh().catch(handleSyncError);
    } catch (undoError) {
      setError(
        undoError instanceof Error
          ? undoError.message
          : "ไม่สามารถย้อนกลับรายการได้",
      );
    } finally {
      setPendingActions((current) => {
        const next = new Set(current);
        next.delete(actionKey);
        return next;
      });
    }
  }

  if (error && !snapshot) {
    return (
      <ScreenState
        backHref={joinCode ? `/join/${joinCode}` : "/"}
        backLabel={joinCode ? "กลับหน้าลิงก์เชิญ" : "กลับหน้าแรก"}
        title="เปิดข้อมูลค่ายไม่ได้"
        message={error}
        tone="danger"
      />
    );
  }

  if (!snapshot) {
    return (
      <ScreenState
        backHref={joinCode ? `/join/${joinCode}` : "/"}
        backLabel={joinCode ? "กลับหน้าลิงก์เชิญ" : "กลับหน้าแรก"}
        busy
        title="กำลังโหลดคะแนน"
        message="ดึงข้อมูลล่าสุดจากค่าย"
      />
    );
  }

  const scoringDisabled = !live.canWrite || snapshot.camp.status !== "active";
  const groupLayoutClass = {
    auto: "grid items-start grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
    single: "grid items-start max-w-3xl grid-cols-1 gap-4",
    double: "grid items-start grid-cols-2 gap-3 sm:gap-4",
    rail: "eq-scroll relative grid items-start snap-x snap-mandatory grid-flow-col auto-cols-[minmax(17.5rem,85vw)] gap-4 overflow-x-auto pb-3 sm:auto-cols-[minmax(19rem,44vw)] xl:auto-cols-[minmax(20rem,30vw)]",
  } satisfies Record<GroupLayout, string>;

  return (
    <main className="min-h-dvh bg-[var(--eq-canvas-soft)] pb-[calc(6rem+env(safe-area-inset-bottom))] text-[var(--eq-ink)]">
      <header className="eq-app-header sticky top-0 z-20 border-b border-[var(--eq-border)] bg-[var(--eq-canvas-soft)] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
                EQ-BANK
              </p>
              <h1 className="mt-1 text-xl font-bold">{snapshot.camp.name}</h1>
            </div>
            <div
              className="flex max-w-[min(100%,24rem)] flex-wrap justify-end gap-2"
              aria-live="polite"
            >
              <StatusBadge axis="camp" status={snapshot.camp.status} />
              <StatusBadge axis="connection" status={live.state} />
            </div>
          </div>

          <div className="eq-scroll mt-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold text-[var(--eq-muted)]">
            <span className="whitespace-nowrap rounded-full bg-[var(--eq-blue-soft)] px-3 py-1.5">
              ผู้ใช้งาน{" "}
              <strong className="font-bold">
                {snapshot.actor.display_name}
              </strong>
            </span>
            <span className="whitespace-nowrap rounded-full bg-white px-3 py-1.5">
              {selectedActivity?.name ?? "ยังไม่ระบุกิจกรรม"}
            </span>
            <span className="whitespace-nowrap rounded-full bg-white px-3 py-1.5">
              {selectedRound?.label ?? "ยังไม่ระบุรอบ"}
            </span>
            <span className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 tabular-nums">
              {live.lastSyncedAt
                ? `อัปเดตล่าสุด ${formatStaffSyncTime(live.lastSyncedAt)}`
                : "กำลังตรวจข้อมูลล่าสุด"}
            </span>
            <button
              aria-label="รีเฟรชข้อมูล"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-[var(--eq-border)] bg-white text-[var(--eq-brand-deep)] disabled:opacity-45"
              disabled={refreshPending}
              onClick={() => void refreshNow()}
              title="รีเฟรชข้อมูล"
              type="button"
            >
              <RefreshIcon pending={refreshPending} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <section aria-label="ทางลัดและงบค่าย" className="mb-3">
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-2.5 ${
              snapshot.camp.warning_active
                ? "border-[var(--eq-orange-dark)]"
                : "border-[var(--eq-border)]"
            }`}
          >
            <div className="min-w-0">
              <p
                className={`text-xs font-semibold ${
                  snapshot.camp.warning_active
                    ? "text-[var(--eq-orange-dark)]"
                    : "text-[var(--eq-muted)]"
                }`}
              >
                งบคงเหลือ
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatScore(snapshot.camp.remaining_budget)} /{" "}
                {formatScore(snapshot.camp.total_budget)}
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-2 text-sm font-bold text-[var(--eq-brand-deep)]"
              href={`/camp/${campId}/history`}
            >
              ดูประวัติ →
            </Link>
          </div>
        </section>

        {snapshot.camp.status === "closed" ? (
          <p className="mb-4 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 font-semibold text-[var(--eq-ink)]">
            ค่ายนี้ปิดแล้ว
          </p>
        ) : null}

        {
          <p
            hidden={live.online}
            className="eq-notice eq-notice-critical mb-4 px-4 py-3 text-sm font-semibold text-[var(--eq-ink)]"
            role="alert"
          >
            การเชื่อมต่อขาดหาย ให้คะแนนไม่ได้
            และระบบจะไม่เก็บรายการไว้ส่งภายหลัง
          </p>
        }

        {
          <p
            hidden={!live.online || live.state !== "degraded"}
            className="eq-notice eq-notice-attention mb-4 px-4 py-3 text-sm font-semibold text-[var(--eq-orange-dark)]"
          >
            การอัปเดตข้อมูลทันทีขัดข้องชั่วคราว ระบบกำลังดึงข้อมูลล่าสุดทุก 2
            วินาที
          </p>
        }

        {error ? (
          <p
            className="mb-4 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 text-sm font-bold text-[var(--eq-ink)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-4">
            <section className="eq-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3">
              <label className="text-sm font-semibold" htmlFor="activity">
                กิจกรรม
              </label>
              <select
                className="min-h-11 rounded-xl border border-[var(--eq-border)] bg-white px-3 font-semibold"
                id="activity"
                onChange={(event) => saveActivity(event.target.value)}
                value={activityId}
              >
                <option value="">ไม่ระบุ</option>
                {snapshot.activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </select>

              {selectedActivity?.rounds.length ? (
                <>
                  <label className="text-sm font-semibold" htmlFor="round">
                    รอบ
                  </label>
                  <select
                    className="min-h-11 rounded-xl border border-[var(--eq-border)] bg-white px-3 font-semibold"
                    id="round"
                    onChange={(event) =>
                      saveActivity(activityId, event.target.value)
                    }
                    value={roundId}
                  >
                    <option value="">ไม่ระบุ</option>
                    {selectedActivity.rounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        {round.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </section>

            <div className="flex flex-wrap items-stretch gap-2">
              <label className="block min-w-32 flex-1" htmlFor="group-search">
                <span className="sr-only">ค้นหากลุ่ม</span>
                <input
                  className="min-h-12 w-full rounded-2xl border border-[var(--eq-border)] bg-white px-4 font-semibold placeholder:text-[var(--eq-muted)]"
                  id="group-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหาเลข สี หรือชื่อกลุ่ม"
                  type="search"
                  value={search}
                />
              </label>

              <fieldset
                aria-label="รูปแบบการแสดงกลุ่ม"
                className="shrink-0 rounded-2xl border border-[var(--eq-border)] bg-white p-1"
              >
                <legend className="sr-only">รูปแบบการแสดงกลุ่ม</legend>
                <div className="grid grid-cols-4 gap-1">
                  {GROUP_LAYOUTS.map((layout) => {
                    const selected = groupLayout === layout.id;

                    return (
                      <button
                        aria-label={layout.label}
                        aria-pressed={selected}
                        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl transition active:scale-[0.98] ${
                          selected
                            ? "eq-action-primary bg-[var(--eq-brand-deep)] text-white "
                            : "bg-[var(--eq-canvas-soft)] text-[var(--eq-muted)]"
                        }`}
                        key={layout.id}
                        onClick={() => setGroupLayout(layout.id)}
                        title={layout.label}
                        type="button"
                      >
                        <GroupLayoutIcon layout={layout.id} />
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>

          <div
            aria-label="กลุ่มคะแนน"
            className={`${groupLayoutClass[groupLayout]} min-w-0`}
            role="list"
          >
            {filteredGroups.map((group) => {
              const displayName = getGroupDisplayName(
                group.color_name,
                group.custom_name,
              );
              const editing = editingGroupId === group.id;

              return (
                <article
                  aria-label={`${group.color_name} — ${displayName}`}
                  className="eq-group-card scroll-mt-32 flex min-w-0 self-start snap-start flex-row overflow-hidden rounded-2xl border border-[var(--eq-border)] bg-white shadow-sm"
                  data-motion-feedback={groupFeedback[group.id]?.kind}
                  key={group.id}
                  role="listitem"
                >
                  {groupFeedback[group.id] ? (
                    <span
                      aria-hidden="true"
                      className="eq-group-feedback"
                      data-kind={groupFeedback[group.id].kind}
                      key={groupFeedback[group.id].id}
                    />
                  ) : null}
                  <span
                    aria-hidden="true"
                    className="w-1 shrink-0 self-stretch eq-swatch"
                    style={{ backgroundColor: group.color_hex }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                      <p className="text-xs font-semibold text-[var(--eq-muted)] sm:text-sm">
                        <span className="tabular-nums">
                          กลุ่ม {group.sort_order}
                        </span>{" "}
                        · {group.color_name}
                      </p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2">
                        <h2 className="min-w-0 flex-1 break-words text-lg font-bold sm:text-2xl">
                          {displayName}
                        </h2>
                        {snapshot.camp.status === "active" ? (
                          <button
                            aria-controls={`staff-group-editor-${group.id}`}
                            aria-expanded={editing}
                            aria-label={
                              editing
                                ? `ยกเลิกเปลี่ยนชื่อกลุ่ม ${displayName}`
                                : `เปลี่ยนชื่อกลุ่ม ${displayName}`
                            }
                            className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.98] ${
                              editing
                                ? "border-[var(--eq-border)] bg-[var(--eq-canvas-soft)] text-[var(--eq-ink)]"
                                : "border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] text-[var(--eq-brand-deep)]"
                            }`}
                            onClick={() => {
                              setEditingGroupId(editing ? undefined : group.id);
                              setEditingGroupName(
                                editing ? "" : group.custom_name,
                              );
                            }}
                            ref={(element) => {
                              editButtonRefs.current[group.id] = element;
                            }}
                            title={
                              editing ? "ยกเลิกเปลี่ยนชื่อ" : "เปลี่ยนชื่อกลุ่ม"
                            }
                            type="button"
                          >
                            {editing ? <CloseIcon /> : <EditIcon />}
                          </button>
                        ) : null}
                      </div>
                      {editing ? (
                        <div
                          aria-label={`แก้ชื่อกลุ่ม ${displayName}`}
                          className="mt-3 grid gap-2 rounded-2xl bg-[var(--eq-canvas-soft)] p-3"
                          id={`staff-group-editor-${group.id}`}
                        >
                          <label
                            className="grid gap-1 text-xs font-semibold"
                            htmlFor={`staff-group-name-${group.id}`}
                          >
                            ชื่อกลุ่มใหม่
                            <input
                              autoFocus
                              className="min-h-12 rounded-xl border border-[var(--eq-border-strong)] bg-white px-3 text-base font-bold"
                              id={`staff-group-name-${group.id}`}
                              maxLength={80}
                              onChange={(event) =>
                                setEditingGroupName(event.target.value)
                              }
                              placeholder={`เว้นว่างเพื่อใช้ “กลุ่มสี${group.color_name}”`}
                              value={editingGroupName}
                            />
                          </label>
                          <button
                            className="min-h-11 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-3 text-sm font-bold text-white disabled:opacity-45"
                            disabled={renamePending}
                            onClick={() => void renameGroup(group.id)}
                            type="button"
                          >
                            {renamePending ? "กำลังบันทึก…" : "บันทึกชื่อกลุ่ม"}
                          </button>
                        </div>
                      ) : null}
                      <p className="tnum mt-2 text-[1.75rem] font-bold leading-none sm:text-3xl">
                        {formatScore(group.current_score)}
                        <span className="sr-only"> คะแนน</span>
                      </p>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 bg-[var(--eq-canvas-soft)] p-2.5 pt-3 sm:p-3">
                      {scoreButtonSections.map((section) => (
                        <div className="grid gap-1.5" key={section.direction}>
                          <ScoreDirectionHeading
                            direction={section.direction}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            {section.buttons.map((button) => {
                              const actionKey = `${group.id}:${button.id}`;
                              const pending = pendingActions.has(actionKey);

                              return (
                                <button
                                  aria-busy={pending}
                                  aria-label={`${section.direction === "add" ? "เพิ่มคะแนน" : "ลดคะแนน"} ${formatScore(Math.abs(button.amount))}`}
                                  className={`eq-score-action ${scoreActionToneClass(section.direction)} min-h-14 rounded-xl px-2 py-2 font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-16 sm:px-3`}
                                  disabled={scoringDisabled || pending}
                                  key={button.id}
                                  onClick={() => requestScore(group, button)}
                                  type="button"
                                >
                                  <ScoreActionContent
                                    compact
                                    direction={section.direction}
                                    pending={pending}
                                    value={formatScore(button.amount, {
                                      showSign: true,
                                    })}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <span aria-live="polite" className="sr-only">
        {Object.values(groupFeedback)
          .filter((feedback) => feedback.kind === "remote")
          .map((feedback) => feedback.message)
          .join(" · ")}
      </span>

      {toast ? (
        <div
          className="eq-toast fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 overflow-hidden rounded-2xl bg-[var(--eq-brand-deep)] px-5 py-4 font-semibold text-white shadow-lg"
          key={toast.id}
          data-exiting={toast.exiting || undefined}
          aria-hidden={toast.exiting || undefined}
          data-toast-id={toast.id}
          role={toast.exiting ? undefined : "status"}
        >
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span>{toast.message}</span>
            <span className="text-xs font-medium text-white/80">
              ย้อนกลับได้ภายใน 15 วินาที
            </span>
          </span>
          <button
            className="min-h-11 rounded-xl border border-white/50 bg-transparent px-4 font-semibold disabled:opacity-50"
            disabled={
              toast.exiting || pendingActions.size > 0 || !live.canWrite
            }
            onClick={() => void undo()}
            type="button"
          >
            {pendingActions.has(`undo:${toast.transactionId}`)
              ? "กำลังย้อน…"
              : "ย้อนกลับ"}
          </button>
        </div>
      ) : null}

      {scoreConfirmation ? (
        <ScoreConfirmationDialog
          confirmation={scoreConfirmation}
          onCancel={() => setScoreConfirmation(undefined)}
          onConfirm={() => {
            const confirmation = scoreConfirmation;
            setScoreConfirmation(undefined);
            void score(
              confirmation.groupId,
              confirmation.buttonId,
              confirmation.amount,
            );
          }}
        />
      ) : null}
    </main>
  );
}

const staffSyncTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Bangkok",
});

function formatStaffSyncTime(timestamp: number) {
  return staffSyncTimeFormatter.format(timestamp);
}

function triggerSuccessfulScoreHaptic() {
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof window.navigator.vibrate !== "function"
  ) {
    return;
  }

  window.navigator.vibrate(35);
}

function RefreshIcon({ pending }: { pending: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${pending ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M19 8a7.5 7.5 0 1 0 .2 7.6M19 8V3m0 5h-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function GroupLayoutIcon({ layout }: { layout: GroupLayout }) {
  if (layout === "single") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <rect
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          width="14"
          x="5"
          y="4"
        />
      </svg>
    );
  }

  if (layout === "double") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <rect
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          width="7"
          x="3"
          y="4"
        />
        <rect
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          width="7"
          x="14"
          y="4"
        />
      </svg>
    );
  }

  if (layout === "rail") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <rect
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          width="9"
          x="1.5"
          y="6"
        />
        <rect
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
          width="9"
          x="13.5"
          y="6"
        />
        <path
          d="m10 3 2-2 2 2M14 21l-2 2-2-2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <rect
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        width="8"
        x="2"
        y="3"
      />
      <rect
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        width="8"
        x="14"
        y="3"
      />
      <rect
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
        width="8"
        x="2"
        y="14"
      />
      <path
        d="M15 17.5h6M18 14.5v6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 16-.8 4.8L8 20l10.7-10.7a2.1 2.1 0 0 0-3-3L5 17Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="m14.5 7.5 3 3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ScoreConfirmationDialog({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: ScoreConfirmation;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const positive = confirmation.amount > 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      aria-labelledby="score-confirmation-title"
      className="eq-dialog m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-[var(--eq-border)] bg-white p-0 text-[var(--eq-ink)] shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <div className="p-5 sm:p-6">
        <p
          className={`text-xs font-bold ${
            positive
              ? "text-[var(--eq-score-add)]"
              : "text-[var(--eq-score-subtract)]"
          }`}
        >
          ตรวจสอบก่อนบันทึก
        </p>
        <h2 className="mt-1 text-2xl font-bold" id="score-confirmation-title">
          ยืนยันการให้คะแนน
        </h2>
        <p className="mt-3 text-base font-bold leading-7 text-[var(--eq-muted)]">
          {positive ? "เพิ่ม" : "ลด"}{" "}
          {formatScore(Math.abs(confirmation.amount))} คะแนน
          {positive ? "ให้" : "จาก"} {confirmation.groupLabel}
        </p>
        <p className="mt-2 text-sm text-[var(--eq-muted)]">
          ปุ่มนี้ถูกตั้งค่าให้ตรวจสอบก่อนบันทึก
          รายการจะยังไม่เกิดขึ้นจนกว่าจะยืนยัน
        </p>
        <div className="mt-6 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
          <button
            autoFocus
            className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-4 font-bold text-[var(--eq-muted)] transition active:scale-[0.98]"
            onClick={onCancel}
            type="button"
          >
            ยกเลิก
          </button>
          <button
            className={`eq-score-action ${scoreActionToneClass(
              positive ? "add" : "subtract",
            )} inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition active:scale-[0.98] sm:px-4 sm:text-base`}
            onClick={onConfirm}
            type="button"
          >
            <ScoreActionGlyph
              className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
              direction={positive ? "add" : "subtract"}
            />
            {positive ? "ยืนยันเพิ่มคะแนน" : "ยืนยันลดคะแนน"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
