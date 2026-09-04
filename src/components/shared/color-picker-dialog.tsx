"use client";

import { useEffect, useRef, useState } from "react";

export type ColorOption = {
  key: string;
  name_th: string;
  hex: string;
};

type ColorPickerDialogProps = {
  colors: ColorOption[];
  disabledBy?: Record<string, string>;
  groupLabel: string;
  id: string;
  onChange: (key: string) => void;
  value: string;
};

export function ColorPickerDialog({
  colors,
  disabledBy = {},
  groupLabel,
  id,
  onChange,
  value,
}: ColorPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [announcement, setAnnouncement] = useState("");
  const [openState, setOpenState] = useState(false);
  const selected = colors.find((color) => color.key === value);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function close() {
    dialogRef.current?.close();
    setOpenState(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function open() {
    dialogRef.current?.showModal();
    setOpenState(true);
    window.requestAnimationFrame(() => {
      const selectedIndex = Math.max(
        0,
        colors.findIndex((color) => color.key === value),
      );
      const firstEnabled = colors.findIndex((color) => !disabledBy[color.key]);
      const preferred = disabledBy[colors[selectedIndex]?.key]
        ? firstEnabled
        : selectedIndex;
      optionRefs.current[preferred]?.focus();
    });
  }

  function choose(color: ColorOption) {
    onChange(color.key);
    setAnnouncement(`เลือกสี${color.name_th}ให้${groupLabel}แล้ว`);
    close();
  }

  function moveFocus(currentIndex: number, key: string) {
    const enabled = colors
      .map((color, index) => ({ color, index }))
      .filter(({ color }) => !disabledBy[color.key]);
    if (!enabled.length) return;
    const position = enabled.findIndex(({ index }) => index === currentIndex);
    let nextPosition = position;
    if (key === "Home") nextPosition = 0;
    if (key === "End") nextPosition = enabled.length - 1;
    if (key === "ArrowRight" || key === "ArrowDown")
      nextPosition = (position + 1) % enabled.length;
    if (key === "ArrowLeft" || key === "ArrowUp")
      nextPosition = (position - 1 + enabled.length) % enabled.length;
    optionRefs.current[enabled[nextPosition]?.index]?.focus();
  }

  return (
    <div className="grid gap-1">
      <button
        aria-controls={`${id}-dialog`}
        aria-expanded={openState}
        aria-label={`เลือกสีของ${groupLabel}: ${selected ? `สี${selected.name_th}` : "ยังไม่เลือกสี"}`}
        aria-haspopup="dialog"
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[var(--eq-border-strong)] bg-white px-3 text-left text-base font-semibold text-[var(--eq-ink)] hover:bg-[var(--eq-canvas-soft)]"
        id={id}
        onClick={open}
        ref={triggerRef}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`h-8 w-8 shrink-0 rounded-lg border border-[var(--eq-border)] ${selected ? "" : "bg-white"}`}
          style={selected ? { backgroundColor: selected.hex } : undefined}
        />
        <span className="min-w-0 flex-1">
          {selected ? `สี${selected.name_th}` : "ยังไม่เลือกสี"}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <dialog
        aria-labelledby={`${id}-title`}
        className="eq-dialog eq-color-dialog m-auto max-h-[min(46rem,calc(100dvh-2rem))] w-[min(46rem,calc(100%-2rem))] overflow-hidden rounded-2xl border border-[var(--eq-border)] bg-white p-0 text-[var(--eq-ink)] shadow-xl backdrop:bg-black/40"
        id={`${id}-dialog`}
        onClose={() => setOpenState(false)}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        ref={dialogRef}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--eq-border)] bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--eq-brand-deep)]">
              {groupLabel}
            </p>
            <h2 className="text-xl font-bold" id={`${id}-title`}>
              เลือกสีของกลุ่ม
            </h2>
          </div>
          <button
            aria-label="ปิดตัวเลือกสี"
            className="min-h-11 min-w-11 rounded-xl border border-[var(--eq-border)] bg-white text-xl font-semibold hover:bg-[var(--eq-canvas-soft)]"
            onClick={close}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="eq-scroll max-h-[min(38rem,calc(100dvh-7rem))] overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div
            aria-label={`สีสำหรับ${groupLabel}`}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
            role="radiogroup"
          >
            {colors.map((color, index) => {
              const unavailable = disabledBy[color.key];
              const checked = color.key === value;
              return (
                <button
                  aria-checked={checked}
                  className={`min-h-20 rounded-xl border p-2 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
                    checked
                      ? "border-[var(--eq-brand-deep)] bg-[var(--eq-blue-soft)]"
                      : "border-[var(--eq-border)] bg-white"
                  }`}
                  disabled={Boolean(unavailable)}
                  key={color.key}
                  onClick={() => choose(color)}
                  onKeyDown={(event) => {
                    if (
                      [
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                        "Home",
                        "End",
                      ].includes(event.key)
                    ) {
                      event.preventDefault();
                      moveFocus(index, event.key);
                    }
                  }}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  role="radio"
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="mb-2 block h-9 w-full rounded-lg border border-[var(--eq-border)]"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="flex items-start justify-between gap-1">
                    <span>สี{color.name_th}</span>
                    {checked ? <span aria-hidden="true">✓</span> : null}
                  </span>
                  <span className="mt-0.5 block text-[0.68rem] font-bold text-[var(--eq-muted)]">
                    {unavailable
                      ? unavailable
                      : checked
                        ? "เลือกแล้ว"
                        : "เลือกสีนี้"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </dialog>
    </div>
  );
}
