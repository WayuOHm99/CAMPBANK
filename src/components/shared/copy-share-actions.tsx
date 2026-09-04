"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

type CopyShareActionsProps = {
  campName: string;
  label: string;
  path: string;
  showUrl?: boolean;
};

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  if (!copied) throw new Error("clipboard-unavailable");
}

function subscribeToOrigin() {
  return () => undefined;
}

export function CopyShareActions({
  campName,
  label,
  path,
  showUrl = true,
}: CopyShareActionsProps) {
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    () => window.location.origin,
    () => "",
  );
  const url = origin ? new URL(path, origin).toString() : path;
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState(false);

  async function copy() {
    setFailed(false);
    try {
      await copyText(url);
      setMessage(`คัดลอก${label}แล้ว`);
    } catch {
      setFailed(true);
      setMessage("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือก URL แล้วคัดลอกเอง");
    }
  }

  async function share() {
    setFailed(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${campName} — ${label}`,
          text: `${campName}\n${label}`,
          url,
        });
        setMessage(`เปิดเมนูแชร์${label}แล้ว`);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }

    await copy();
    setMessage(`อุปกรณ์นี้ไม่มีเมนูแชร์ จึงคัดลอก${label}ให้แล้ว`);
  }

  return (
    <div className="grid min-w-0 gap-2">
      {showUrl ? (
        <input
          aria-label={`URL ${label}`}
          className="min-h-11 w-full min-w-0 rounded-xl border border-[var(--eq-border)] bg-[var(--eq-canvas-soft)] px-3 text-sm font-bold"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={url}
        />
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <Link
          aria-label={`เปิด${label}`}
          className="eq-action-primary inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--eq-brand-deep)] px-3 text-sm font-semibold text-white"
          href={path}
        >
          เปิด
        </Link>
        <button
          aria-label={`คัดลอก${label}`}
          className="min-h-11 rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-blue-soft)] px-2 text-sm font-bold text-[var(--eq-brand-deep)]"
          onClick={() => void copy()}
          type="button"
        >
          คัดลอก
        </button>
        <button
          aria-label={`แชร์${label}`}
          className="min-h-11 rounded-xl border border-[var(--eq-border-strong)] bg-white px-2 text-sm font-bold text-[var(--eq-brand-deep)]"
          onClick={() => void share()}
          type="button"
        >
          แชร์
        </button>
      </div>
      {message ? (
        <p
          className={`text-xs font-semibold ${failed ? "text-[var(--eq-ink)]" : "text-[var(--eq-green-dark)]"}`}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
