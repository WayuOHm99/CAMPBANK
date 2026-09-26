"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ensureAnonymousSession } from "@/lib/supabase/client";
import type { AdminCampSnapshot } from "@/types/domain";

type RpcResult =
  | { ok: true; camp?: { id: string }; archived_at?: string | null }
  | { ok: false; error: { code: string; message: string } };

/**
 * Camp-level actions that change whether a Camp exists or is listed.
 * Score history is never deleted: only a never-activated Draft can be removed,
 * and a Closed Camp is archived (hidden, reversible) instead.
 */
export function CampManagement({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const router = useRouter();
  const { camp } = snapshot;
  const [copyName, setCopyName] = useState(`${camp.name} (สำเนา)`);
  const [confirmName, setConfirmName] = useState("");
  const [pending, setPending] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function call(action: string, rpc: string, args: object) {
    setPending(action);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc(rpc, args);
      if (error) throw error;
      const result = data as RpcResult;
      if (!result.ok) throw new Error(result.error.message);
      return result;
    } catch (callError) {
      setMessage(
        callError instanceof Error ? callError.message : "ทำรายการไม่สำเร็จ",
      );
      return undefined;
    } finally {
      setPending(undefined);
    }
  }

  async function duplicate() {
    const result = await call("duplicate", "duplicate_camp", {
      p_camp_id: camp.id,
      p_name: copyName,
    });
    if (result?.ok && result.camp) router.push(`/admin/camps/${result.camp.id}`);
  }

  async function toggleArchive() {
    const result = await call("archive", "set_camp_archived", {
      p_archived: !camp.archived_at,
      p_camp_id: camp.id,
    });
    if (result?.ok) {
      setMessage(
        result.archived_at
          ? "เก็บค่ายเข้าคลังแล้ว ค่ายนี้จะไม่แสดงในรายการหลัก"
          : "นำค่ายออกจากคลังแล้ว",
      );
      await onRefresh();
    }
  }

  async function deleteDraft() {
    const result = await call("delete", "delete_draft_camp", {
      p_camp_id: camp.id,
      p_confirm_name: confirmName,
    });
    if (result?.ok) router.replace("/admin");
  }

  const nameMatches = confirmName.trim() === camp.name;

  return (
    <section
      aria-labelledby="camp-management-title"
      className="mt-6 grid gap-4 rounded-2xl bg-white p-5 shadow-sm"
      id="camp-management"
    >
      <div>
        <h2 className="text-xl font-bold" id="camp-management-title">
          จัดการค่าย
        </h2>
        <p className="mt-1 text-sm text-[var(--eq-muted)]">
          ประวัติคะแนนจะไม่ถูกลบ ลบได้เฉพาะค่าย Draft ที่ยังไม่เคยเปิดใช้งาน
        </p>
      </div>

      <div className="grid gap-2 rounded-2xl bg-[var(--eq-canvas-soft)] p-4">
        <label className="grid gap-1 text-sm font-bold" htmlFor="copy-name">
          ทำสำเนาค่าย
          <span className="text-xs font-normal text-[var(--eq-muted)]">
            คัดลอกกลุ่ม สี Staff กิจกรรม และปุ่มคะแนน เป็น Draft ใหม่ที่คะแนนเริ่มจาก 0
          </span>
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border-strong)] bg-white px-3 text-base font-semibold"
            id="copy-name"
            maxLength={120}
            onChange={(event) => setCopyName(event.target.value)}
            value={copyName}
          />
        </label>
        <button
          className="min-h-12 rounded-xl border border-[var(--eq-brand-deep)] bg-white px-4 font-bold text-[var(--eq-brand-deep)] disabled:opacity-40"
          disabled={Boolean(pending) || !copyName.trim()}
          onClick={() => void duplicate()}
          type="button"
        >
          {pending === "duplicate" ? "กำลังทำสำเนา…" : "ทำสำเนาเป็น Draft ใหม่"}
        </button>
      </div>

      {camp.status === "closed" ? (
        <div className="grid gap-2 rounded-2xl bg-[var(--eq-canvas-soft)] p-4">
          <p className="text-sm font-bold">
            {camp.archived_at ? "ค่ายนี้อยู่ในคลัง" : "เก็บเข้าคลัง"}
          </p>
          <p className="text-xs text-[var(--eq-muted)]">
            ซ่อนค่ายที่ปิดแล้วจากรายการหลัก ข้อมูลและประวัติยังอยู่ครบ และนำออกจากคลังได้ทุกเมื่อ
          </p>
          <button
            className="min-h-12 rounded-xl border border-[var(--eq-border-strong)] bg-white px-4 font-bold disabled:opacity-40"
            disabled={Boolean(pending)}
            onClick={() => void toggleArchive()}
            type="button"
          >
            {camp.archived_at ? "นำออกจากคลัง" : "เก็บเข้าคลัง"}
          </button>
        </div>
      ) : null}

      {camp.status === "draft" ? (
        <div className="grid gap-2 rounded-2xl border-2 border-[var(--eq-danger)] p-4">
          <label className="grid gap-1 text-sm font-bold" htmlFor="delete-confirm">
            ลบค่าย Draft นี้ถาวร
            <span className="text-xs font-normal text-[var(--eq-muted)]">
              พิมพ์ชื่อค่าย “{camp.name}” เพื่อยืนยัน การลบย้อนกลับไม่ได้
            </span>
            <input
              autoComplete="off"
              className="min-h-12 rounded-xl border border-[var(--eq-border-strong)] bg-white px-3 text-base"
              id="delete-confirm"
              onChange={(event) => setConfirmName(event.target.value)}
              value={confirmName}
            />
          </label>
          <button
            className="min-h-12 rounded-xl bg-[var(--eq-danger)] px-4 font-bold text-white disabled:opacity-40"
            disabled={Boolean(pending) || !nameMatches}
            onClick={() => void deleteDraft()}
            type="button"
          >
            {pending === "delete" ? "กำลังลบ…" : "ลบค่าย Draft"}
          </button>
        </div>
      ) : null}

      {message ? (
        <p aria-live="polite" className="text-sm font-bold" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
