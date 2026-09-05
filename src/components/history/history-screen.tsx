"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ScreenState } from "@/components/shared/screen-state";
import { downloadCsv } from "@/lib/csv/create-csv-download";
import { getGroupDisplayName } from "@/lib/groups/get-group-display-name";
import { createClientUuid } from "@/lib/ids/create-client-uuid";
import { formatScore } from "@/lib/score/format-score";
import { ensureAnonymousSession } from "@/lib/supabase/client";
import {
  isRpcFailure,
  type AdminCampSnapshot,
  type CampSnapshot,
} from "@/types/domain";

type HistoryItem = CampSnapshot["recent_transactions"][number] & {
  member_id: string;
  activity_id: string | null;
  reason: string | null;
  reverses_transaction_id: string | null;
  adjusts_transaction_id: string | null;
};

type Cursor = { created_at: string; id: string };

export function HistoryScreen({ campId }: { campId: string }) {
  const [camp, setCamp] = useState<CampSnapshot["camp"]>();
  const [adminSnapshot, setAdminSnapshot] = useState<AdminCampSnapshot>();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>();
  const [groupId, setGroupId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [adjustmentTarget, setAdjustmentTarget] = useState<HistoryItem>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [error, setError] = useState<string>();

  const loadPage = useCallback(
    async (nextCursor?: Cursor | null, append = false) => {
      setPending(true);
      setError(undefined);
      try {
        const client = await ensureAnonymousSession();
        const { data, error: rpcError } = await client.rpc(
          "get_transaction_history",
          {
            p_activity_id: activityId || null,
            p_before_created_at: nextCursor?.created_at ?? null,
            p_before_id: nextCursor?.id ?? null,
            p_camp_id: campId,
            p_group_id: groupId || null,
            p_limit: 50,
            p_member_id: memberId || null,
            p_transaction_type: transactionType || null,
          },
        );
        if (rpcError) throw rpcError;
        if (isRpcFailure(data)) throw new Error(data.error.message);

        const result = data as {
          ok: true;
          items: HistoryItem[];
          next_cursor: Cursor | null;
        };
        setItems((current) =>
          append ? [...current, ...result.items] : result.items,
        );
        setCursor(result.next_cursor);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "ไม่สามารถโหลดประวัติได้",
        );
      } finally {
        setPending(false);
      }
    },
    [activityId, campId, groupId, memberId, transactionType],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const client = await ensureAnonymousSession();
        const [campResult, adminResult] = await Promise.all([
          client.rpc("get_camp_snapshot", { p_camp_id: campId }),
          client.rpc("get_admin_camp_snapshot", { p_camp_id: campId }),
        ]);
        if (campResult.error) throw campResult.error;
        if (isRpcFailure(campResult.data)) {
          throw new Error(campResult.data.error.message);
        }
        if (!active) return;
        setCamp((campResult.data as CampSnapshot).camp);
        if (!adminResult.error && !isRpcFailure(adminResult.data)) {
          setAdminSnapshot(adminResult.data as AdminCampSnapshot);
        }
        await loadPage(null, false);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "ไม่สามารถเปิดประวัติได้",
          );
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [campId, loadPage]);

  async function exportFilteredHistory() {
    if (!adminSnapshot || !camp || exportPending) return;

    setExportPending(true);
    setError(undefined);
    setNotice("กำลังรวบรวมประวัติทั้งหมดตามตัวกรอง…");
    try {
      const client = await ensureAnonymousSession();
      const exportedItems: HistoryItem[] = [];
      const seenCursors = new Set<string>();
      let nextCursor: Cursor | null = null;

      do {
        const { data, error: rpcError } = await client.rpc(
          "get_transaction_history",
          {
            p_activity_id: activityId || null,
            p_before_created_at: nextCursor?.created_at ?? null,
            p_before_id: nextCursor?.id ?? null,
            p_camp_id: campId,
            p_group_id: groupId || null,
            p_limit: 50,
            p_member_id: memberId || null,
            p_transaction_type: transactionType || null,
          },
        );
        if (rpcError) throw rpcError;
        if (isRpcFailure(data)) throw new Error(data.error.message);

        const page = data as {
          items: HistoryItem[];
          next_cursor: Cursor | null;
          ok: true;
        };
        exportedItems.push(...page.items);
        nextCursor = page.next_cursor;

        if (nextCursor) {
          const cursorKey = `${nextCursor.created_at}:${nextCursor.id}`;
          if (seenCursors.has(cursorKey)) {
            throw new Error("พบตัวชี้หน้าประวัติซ้ำ กรุณาลองส่งออกใหม่");
          }
          seenCursors.add(cursorKey);
        }
      } while (nextCursor);

      downloadCsv(`eqcamp-history-${camp.name}-${camp.camp_date}`, [
        [
          "วันที่และเวลา",
          "ประเภท",
          "สี ณ เวลารายการ",
          "ชื่อกลุ่ม ณ เวลารายการ",
          "ผู้ทำรายการ",
          "คะแนน",
          "กิจกรรม",
          "รอบ",
          "เหตุผล",
          "รหัสรายการ",
          "รหัสรายการที่ย้อนกลับ",
          "รหัสรายการที่ปรับ",
        ],
        ...exportedItems.map((item) => [
          formatBangkokTime(item.created_at),
          historyTypeLabel(item.transaction_type),
          item.group_color_name_snapshot,
          getGroupDisplayName(
            item.group_color_name_snapshot,
            item.group_custom_name_snapshot,
          ),
          item.actor_name_snapshot,
          item.amount,
          item.activity_name_snapshot ?? "",
          item.round_label_snapshot ?? "",
          item.reason ?? "",
          item.id,
          item.reverses_transaction_id ?? "",
          item.adjusts_transaction_id ?? "",
        ]),
      ]);
      setNotice(`ดาวน์โหลดประวัติ ${exportedItems.length} รายการแล้ว`);
    } catch (exportError) {
      setNotice(undefined);
      setError(
        exportError instanceof Error
          ? exportError.message
          : "ส่งออกประวัติไม่สำเร็จ",
      );
    } finally {
      setExportPending(false);
    }
  }

  if (!camp && !error) {
    return (
      <ScreenState
        backHref={`/camp/${campId}`}
        backLabel="กลับไปที่ Camp"
        busy
        title="กำลังโหลดประวัติ"
        message="ดึงรายการล่าสุด 50 รายการ"
      />
    );
  }
  if (!camp) {
    return (
      <ScreenState
        backHref={`/camp/${campId}`}
        backLabel="กลับไปที่ Camp"
        title="เปิดประวัติไม่ได้"
        message={error}
        tone="danger"
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--eq-canvas-soft)] px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[var(--eq-ink)]">
      <div className="mx-auto max-w-6xl">
        <Link
          className="inline-flex min-h-11 items-center font-bold text-[var(--eq-muted)]"
          href={adminSnapshot ? `/admin/camps/${campId}` : `/camp/${campId}`}
        >
          ← กลับไปที่ Camp
        </Link>
        <header className="eq-app-header mt-3">
          <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
            EQ-BANK · HISTORY
          </p>
          <h1 className="mt-1 text-3xl font-bold">ประวัติคะแนน</h1>
          <p className="mt-1 text-sm text-[var(--eq-muted)]">{camp.name}</p>
        </header>

        <p className="eq-notice eq-notice-attention mt-4 px-4 py-3 text-sm font-semibold leading-6 text-[var(--eq-orange-dark)]">
          ชื่อและสีในหน้านี้เป็น snapshot ณ เวลาที่เกิดรายการ
          การแก้ชื่อหรือสีของกลุ่มภายหลัง จะไม่เปลี่ยนประวัติเก่า
        </p>

        {adminSnapshot ? (
          <section className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 sm:grid-cols-4">
            <HistorySelect label="กลุ่ม" onChange={setGroupId} value={groupId}>
              {adminSnapshot.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.color_name} —{" "}
                  {getGroupDisplayName(group.color_name, group.custom_name)}
                </option>
              ))}
            </HistorySelect>
            <HistorySelect
              label="Staff/Admin"
              onChange={setMemberId}
              value={memberId}
            >
              {adminSnapshot.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </HistorySelect>
            <HistorySelect
              label="กิจกรรม"
              onChange={setActivityId}
              value={activityId}
            >
              {adminSnapshot.activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </HistorySelect>
            <HistorySelect
              label="ประเภท"
              onChange={setTransactionType}
              value={transactionType}
            >
              <option value="award">เพิ่มคะแนน</option>
              <option value="deduction">ลดคะแนน</option>
              <option value="quick_undo">ย้อนกลับ</option>
              <option value="adjustment">การปรับคะแนนโดย Admin</option>
            </HistorySelect>
            <div className="col-span-2 grid gap-2 sm:col-span-4 sm:grid-cols-2">
              <button
                className="min-h-11 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45"
                disabled={pending || exportPending}
                onClick={() => void loadPage(null, false)}
                type="button"
              >
                ใช้ตัวกรอง
              </button>
              <button
                className="min-h-11 rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] px-4 font-bold text-[var(--eq-brand-deep)] disabled:opacity-45"
                disabled={pending || exportPending}
                onClick={() => void exportFilteredHistory()}
                type="button"
              >
                {exportPending
                  ? "กำลังรวบรวมประวัติ…"
                  : "ดาวน์โหลด CSV ตามตัวกรอง"}
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <p
            className="mt-4 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 font-bold text-[var(--eq-ink)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {notice ? (
          <p
            className="mt-4 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 font-bold text-[var(--eq-brand-deep)]"
            role="status"
          >
            {notice}
          </p>
        ) : null}

        {adminSnapshot && adjustmentTarget ? (
          <LinkedAdjustmentPanel
            onCancel={() => setAdjustmentTarget(undefined)}
            onSuccess={async (result) => {
              setAdminSnapshot((current) => {
                if (!current) return current;
                return {
                  ...current,
                  camp: {
                    ...current.camp,
                    ...result.camp,
                  },
                  groups: current.groups.map((group) =>
                    group.id === result.group.id
                      ? {
                          ...group,
                          current_score: result.group.current_score,
                          score_reached_at: result.group.score_reached_at,
                        }
                      : group,
                  ),
                };
              });
              setCamp((current) =>
                current
                  ? {
                      ...current,
                      ...result.camp,
                    }
                  : current,
              );
              setAdjustmentTarget(undefined);
              setNotice("บันทึกการปรับคะแนนที่เชื่อมรายการแล้ว");
              await loadPage(null, false);
            }}
            snapshot={adminSnapshot}
            target={adjustmentTarget}
          />
        ) : null}

        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <article className="rounded-2xl bg-white p-4" key={item.id}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-9 w-2 rounded-full"
                  style={{ backgroundColor: item.group_color_hex_snapshot }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold">
                        {item.group_color_name_snapshot} —{" "}
                        {getGroupDisplayName(
                          item.group_color_name_snapshot,
                          item.group_custom_name_snapshot,
                        )}
                      </h2>
                      <p className="mt-1 text-xs font-bold text-[var(--eq-muted)]">
                        {item.actor_name_snapshot} ·{" "}
                        {formatBangkokTime(item.created_at)}
                      </p>
                    </div>
                    <p
                      className={`text-xl font-bold tabular-nums ${item.amount > 0 ? "text-[var(--eq-green-dark)]" : "text-[var(--eq-ink)]"}`}
                    >
                      {item.amount > 0 ? "+" : "-"}
                      {formatScore(Math.abs(item.amount))}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--eq-muted)]">
                    {historyTypeLabel(item.transaction_type)}
                    {item.activity_name_snapshot
                      ? ` · ${item.activity_name_snapshot}`
                      : ""}
                    {item.round_label_snapshot
                      ? ` · ${item.round_label_snapshot}`
                      : ""}
                  </p>
                  {item.reason ? (
                    <p className="mt-2 text-sm font-semibold">
                      เหตุผล: {item.reason}
                    </p>
                  ) : null}
                  {item.reverses_transaction_id ? (
                    <p className="mt-1 text-xs text-[var(--eq-muted)]">
                      เชื่อมกับรายการที่ย้อนกลับ
                    </p>
                  ) : null}
                  {item.adjusts_transaction_id ? (
                    <p className="mt-1 text-xs text-[var(--eq-muted)]">
                      เชื่อมกับรายการที่แก้ไข
                    </p>
                  ) : null}
                  {adminSnapshot ? (
                    <button
                      className="mt-3 min-h-11 rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] px-4 text-sm font-bold text-[var(--eq-brand-deep)]"
                      onClick={() => {
                        setNotice(undefined);
                        setAdjustmentTarget(item);
                      }}
                      type="button"
                    >
                      ปรับคะแนนจากรายการนี้
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>

        {items.length === 0 && !pending ? (
          <p className="mt-5 rounded-2xl border border-dashed border-[var(--eq-border)] p-8 text-center text-[var(--eq-muted)]">
            ยังไม่มีรายการตามตัวกรองนี้
          </p>
        ) : null}

        {cursor ? (
          <button
            className="mt-5 min-h-12 w-full rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] font-bold text-[var(--eq-brand-deep)] disabled:opacity-45"
            disabled={pending}
            onClick={() => void loadPage(cursor, true)}
            type="button"
          >
            {pending ? "กำลังโหลด…" : "โหลดเพิ่ม"}
          </button>
        ) : null}
      </div>
    </main>
  );
}

type LinkedAdjustmentResult = {
  camp: {
    distributed_amount: number;
    remaining_budget: number;
    total_budget: number;
  };
  group: {
    current_score: number;
    id: string;
    score_reached_at: string;
  };
};

function LinkedAdjustmentPanel({
  onCancel,
  onSuccess,
  snapshot,
  target,
}: {
  onCancel: () => void;
  onSuccess: (result: LinkedAdjustmentResult) => Promise<void>;
  snapshot: AdminCampSnapshot;
  target: HistoryItem;
}) {
  const group = snapshot.groups.find((item) => item.id === target.group_id);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const numericAmount = Number(amount);
  const nextScore = (group?.current_score ?? 0) + numericAmount;
  const nextRemaining = snapshot.camp.remaining_budget - numericAmount;

  async function submit() {
    if (!Number.isSafeInteger(numericAmount) || numericAmount === 0) {
      setError("จำนวนที่ปรับต้องเป็นจำนวนเต็มและไม่เท่ากับ 0");
      return;
    }
    if (reason.trim().length < 3) {
      setError("กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (
      !window.confirm(
        `ยืนยันปรับ ${group?.color_name ?? target.group_color_name_snapshot} — ${
          group
            ? getGroupDisplayName(group.color_name, group.custom_name)
            : getGroupDisplayName(
                target.group_color_name_snapshot,
                target.group_custom_name_snapshot,
              )
        } ${numericAmount > 0 ? "+" : ""}${formatScore(numericAmount)}\nคะแนน: ${formatScore(
          group?.current_score ?? 0,
        )} → ${formatScore(nextScore)}\nงบคงเหลือ: ${formatScore(
          snapshot.camp.remaining_budget,
        )} → ${formatScore(nextRemaining)}`,
      )
    ) {
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc("admin_adjust_score", {
        p_adjusts_transaction_id: target.id,
        p_amount: numericAmount,
        p_camp_id: snapshot.camp.id,
        p_client_action_id: createClientUuid(),
        p_group_id: target.group_id,
        p_reason: reason.trim(),
      });
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      await onSuccess(data as LinkedAdjustmentResult);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "บันทึกการปรับคะแนนไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[var(--eq-border-strong)] bg-white p-5">
      <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
        ปรับคะแนนโดย ADMIN
      </p>
      <h2 className="mt-1 text-xl font-bold">ปรับคะแนนจากรายการ</h2>
      <p className="mt-1 text-sm text-[var(--eq-muted)]">
        {target.group_color_name_snapshot} —{" "}
        {getGroupDisplayName(
          target.group_color_name_snapshot,
          target.group_custom_name_snapshot,
        )}{" "}
        · {target.amount > 0 ? "+" : ""}
        {formatScore(target.amount)}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label
          className="grid gap-1 text-xs font-bold"
          htmlFor="linked-adjustment-amount"
        >
          จำนวนแบบมีเครื่องหมาย
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base"
            id="linked-adjustment-amount"
            inputMode="numeric"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="เช่น 500 หรือ -500"
            value={amount}
          />
        </label>
        <label
          className="grid gap-1 text-xs font-bold"
          htmlFor="linked-adjustment-reason"
        >
          เหตุผล
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base"
            id="linked-adjustment-reason"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
        {error ? (
          <p
            className="text-sm font-bold text-[var(--eq-ink)] sm:col-span-2"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <button
            className="min-h-12 rounded-xl border border-[var(--eq-border)] font-bold text-[var(--eq-muted)]"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            ยกเลิก
          </button>
          <button
            className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45"
            disabled={pending}
            onClick={() => void submit()}
            type="button"
          >
            {pending ? "กำลังบันทึก…" : "บันทึกการปรับคะแนนที่เชื่อมรายการ"}
          </button>
        </div>
      </div>
    </section>
  );
}

function HistorySelect({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold">
      {label}
      <select
        className="min-h-11 min-w-0 rounded-xl border border-[var(--eq-border)] bg-white px-2"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">ทั้งหมด</option>
        {children}
      </select>
    </label>
  );
}

function historyTypeLabel(type: HistoryItem["transaction_type"]) {
  return {
    adjustment: "การปรับคะแนนโดย Admin",
    award: "เพิ่มคะแนน",
    deduction: "ลดคะแนน",
    quick_undo: "ย้อนกลับ",
  }[type];
}

function formatBangkokTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}
