import Link from "next/link";

import { BrandLockup } from "@/components/shared/brand-lockup";

type ScreenStateProps = {
  backHref?: string;
  backLabel?: string;
  title: string;
  message?: string;
  tone?: "neutral" | "danger";
};

export function ScreenState({
  backHref,
  backLabel = "กลับหน้าแรก",
  title,
  message,
  tone = "neutral",
}: ScreenStateProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--eq-canvas-soft)] px-6 py-[calc(2rem+env(safe-area-inset-top))] text-[var(--eq-ink)]">
      <section className="eq-card w-full max-w-lg p-6 text-center sm:p-8">
        <BrandLockup className="mb-3" compact />
        <div
          aria-hidden="true"
          className={`mx-auto mb-4 h-3 w-12 rounded-full ${
            tone === "danger"
              ? "bg-[var(--eq-ink)]"
              : "animate-pulse bg-[var(--eq-brand-deep)]"
          }`}
        />
        <h1 className="text-xl font-bold">{title}</h1>
        {message ? (
          <p className="mt-2 text-sm leading-6 text-[var(--eq-muted)]">
            {message}
          </p>
        ) : null}
        {backHref ? (
          <Link
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--eq-border)] bg-white px-4 text-sm font-bold text-[var(--eq-brand-deep)]"
            href={backHref}
          >
            ← {backLabel}
          </Link>
        ) : null}
      </section>
    </main>
  );
}
