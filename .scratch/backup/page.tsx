import Link from "next/link";

import { BrandLockup } from "@/components/shared/brand-lockup";

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[var(--eq-canvas)] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[var(--eq-ink)] sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--eq-border)] py-3">
          <BrandLockup compact name="EQ-BANK" />
          <span className="text-xs font-medium text-[var(--eq-muted)]">
            ระบบภายในค่าย
          </span>
        </header>

        <section className="mx-auto w-full max-w-md py-14 sm:py-20">
          <h1 className="text-3xl font-bold sm:text-4xl">
            เข้าใช้งาน <span className="whitespace-nowrap">EQ-BANK</span>
          </h1>
          <p className="mt-3 max-w-[42ch] text-pretty text-[clamp(0.9375rem,0.9rem+0.2vw,1.0625rem)] leading-[1.75] text-[var(--eq-muted)]">
            Staff เปิดลิงก์ที่ได้รับจากผู้ดูแลค่าย{" "}
            <span className="mt-0.5 block">
              ส่วน Admin เข้าจัดการระบบด้านล่าง
            </span>
          </p>

          <div className="mt-7 grid gap-3">
            <Link
              className="eq-action-primary flex min-h-14 items-center justify-between rounded-xl bg-[var(--eq-brand-deep)] px-5 py-4 font-semibold text-white"
              href="/admin"
            >
              <span>เข้าสู่ระบบ Admin</span>
              <span aria-hidden="true">→</span>
            </Link>

            {process.env.NODE_ENV === "development" ? (
              <Link
                className="flex min-h-14 items-center justify-between rounded-xl border border-[var(--eq-border-strong)] bg-white px-5 py-4 font-semibold text-[var(--eq-brand-deep)] hover:bg-[var(--eq-blue-soft)]"
                href="/join/DEMO-STAFF-2026"
              >
                <span>เปิด EQCAMP Demo</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
