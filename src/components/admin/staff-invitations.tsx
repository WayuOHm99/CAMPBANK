"use client";

import { useCallback, useEffect, useState } from "react";
import {
  copyText,
  CopyShareActions,
} from "@/components/shared/copy-share-actions";
import { LinkQrCode } from "@/components/shared/link-qr-code";
import { ensureAnonymousSession } from "@/lib/supabase/client";
import { isRpcFailure } from "@/types/domain";

type Invitation = { member_id: string; display_name: string; code: string };

export function StaffInvitations({
  campId,
  campName,
  membersVersion,
}: {
  campId: string;
  campName: string;
  membersVersion: string;
}) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function copyAllLinks() {
    const lines = invitations.map(
      (invite) =>
        `${invite.display_name}: ${new URL(`/join/${invite.code}`, window.location.origin)}`,
    );
    try {
      await copyText([`ลิงก์ Staff ค่าย ${campName}`, ...lines].join("\n"));
      setError("");
      setMessage("คัดลอกลิงก์ทุกคนแล้ว ส่งเป็นข้อความส่วนตัวให้แต่ละคน");
    } catch {
      setError("คัดลอกไม่สำเร็จ ใช้ปุ่มคัดลอกของแต่ละคนแทน");
    }
  }

  const refresh = useCallback(async () => {
    const client = await ensureAnonymousSession();
    const { data, error } = await client.rpc("get_staff_invitations", {
      p_camp_id: campId,
    });
    if (error) throw new Error(error.message);
    if (isRpcFailure(data)) throw new Error(data.error.message);
    return (data as { invitations: Invitation[] }).invitations;
  }, [campId]);

  useEffect(() => {
    let active = true;
    void refresh()
      .then((items) => {
        if (active) {
          setInvitations(items);
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setInvitations([]);
          setError("โหลดลิงก์เชิญไม่ได้ กรุณาลองเปิดหน้านี้อีกครั้ง");
        }
      });
    return () => {
      active = false;
    };
  }, [refresh, membersVersion]);

  async function rotate() {
    if (!selected || pending || reason.trim().length < 3) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("rotate_staff_invitation", {
        p_camp_id: campId,
        p_member_id: selected,
        p_reason: reason.trim(),
      });
      if (error) throw new Error(error.message);
      if (isRpcFailure(data)) throw new Error(data.error.message);
      // Remove the invalidated link even if the subsequent read fails.
      setInvitations((items) =>
        items.map((item) =>
          item.member_id === selected
            ? { ...item, code: data.code as string }
            : item,
        ),
      );
      setSelected(undefined);
      setReason("");
      setMessage(
        "ออกลิงก์ใหม่แล้ว ลิงก์เดิมและอุปกรณ์เดิมของ Staff คนนี้ถูกยกเลิกสิทธิ์แล้ว",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "ออกลิงก์ใหม่ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="ลิงก์เชิญ Staff รายคน"
      className="rounded-2xl border border-[var(--eq-border)] bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold">ลิงก์เชิญ Staff รายคน</h2>
      <p className="mt-2 text-sm text-[var(--eq-muted)]">
        ส่งให้เจ้าของชื่อเท่านั้น
        ผู้ที่มีลิงก์เข้าใช้งานในชื่อนั้นได้โดยไม่ต้องสมัครบัญชี
        หน้างานให้ Staff สแกน QR code จากจอนี้ได้เลย
      </p>
      {invitations.length > 1 ? (
        <button
          className="mt-3 min-h-11 w-full rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-blue-soft)] px-4 text-sm font-bold text-[var(--eq-brand-deep)]"
          onClick={() => void copyAllLinks()}
          type="button"
        >
          คัดลอกลิงก์ทุกคน ({invitations.length} คน)
        </button>
      ) : null}
      <div className="mt-4 grid gap-4">
        {invitations.map((invite) => (
          <div
            key={invite.member_id}
            className="rounded-xl border border-[var(--eq-border)] p-3"
          >
            <p className="mb-2 font-bold">{invite.display_name}</p>
            <CopyShareActions
              campName={campName}
              label={`ลิงก์ ${invite.display_name}`}
              path={`/join/${invite.code}`}
            />
            <details className="eq-disclosure mt-2 rounded-xl bg-[var(--eq-canvas-soft)] px-3">
              <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-bold text-[var(--eq-brand-deep)]">
                แสดง QR code ของ {invite.display_name}
              </summary>
              <div className="pb-3">
                <LinkQrCode
                  label={invite.display_name}
                  path={`/join/${invite.code}`}
                />
              </div>
            </details>
            <button
              type="button"
              disabled={pending}
              className="mt-2 min-h-11 rounded-xl border px-3 text-sm font-semibold"
              onClick={() => {
                setSelected(invite.member_id);
                setReason("");
              }}
            >
              ออกลิงก์ใหม่ให้ {invite.display_name}
            </button>
            {selected === invite.member_id ? (
              <div className="mt-3 grid gap-2">
                <p className="text-sm">
                  ลิงก์เก่าจะใช้ไม่ได้ และอุปกรณ์เดิมของคนนี้จะหมดสิทธิ์ทันที
                </p>
                <label className="grid gap-1 text-sm">
                  เหตุผลที่ออกลิงก์ใหม่
                  <input
                    className="min-h-11 rounded-xl border px-3"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={pending}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    className="min-h-11 rounded-xl border px-3 disabled:opacity-50"
                    type="button"
                    disabled={pending || reason.trim().length < 3}
                    onClick={() => void rotate()}
                  >
                    {pending ? "กำลังออกลิงก์…" : "ยืนยันออกลิงก์ใหม่"}
                  </button>
                  <button
                    className="min-h-11 px-3"
                    type="button"
                    disabled={pending}
                    onClick={() => setSelected(undefined)}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
