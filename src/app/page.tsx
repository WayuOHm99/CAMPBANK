import Image from "next/image";
import Link from "next/link";

import { BrandLockup } from "@/components/shared/brand-lockup";
import { MotionPage } from "@/components/shared/motion";

/**
 * Group colours are Camp data, not product tokens, so this strip is a fixed
 * brand graphic rather than anything read from a Camp. It carries no numbers
 * for the same reason: nothing here should look like a real result.
 */
const BRAND_STRIP = [
  { color: "#e0322f", height: "42%" },
  { color: "#2563c9", height: "68%" },
  { color: "#80e800", height: "28%" },
  { color: "#f2c200", height: "84%" },
  { color: "#ff6f00", height: "54%" },
  { color: "#36b8f2", height: "100%" },
  { color: "#d6398a", height: "37%" },
  { color: "#7b3fbf", height: "62%" },
  { color: "#8a5a33", height: "21%" },
  { color: "#148f4b", height: "49%" },
];

const CAPABILITIES = [
  {
    body: "5–10 คนกดพร้อมกัน ฐานข้อมูลจัดลำดับให้เอง ไม่มีคะแนนหาย",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M18.5 19a5.6 5.6 0 0 0-2.2-4.5" />
      </>
    ),
    title: "ทีมงานให้คะแนนพร้อมกันได้",
  },
  {
    body: "ทุกเครื่องเห็นตรงกันภายใน 1–2 วินาที",
    icon: <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" />,
    title: "งบค่ายกับอันดับคำนวณสด",
  },
  {
    body: "การแก้ไขสร้างรายการใหม่เสมอ ย้อนดูได้ว่าใครทำอะไรเมื่อไร",
    icon: (
      <>
        <path d="M12 3.5 19.5 6v6c0 4-3.2 7.3-7.5 8.5C7.7 19.3 4.5 16 4.5 12V6Z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>
    ),
    title: "ทุกรายการแก้ไม่ได้",
  },
];

export default function HomePage() {
  return (
    <MotionPage>
      <main className="min-h-dvh bg-surface text-[var(--eq-ink)] lg:grid lg:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]">
        <section className="relative isolate flex flex-col overflow-hidden bg-[linear-gradient(158deg,#24699f_0%,#17456c_100%)] pt-[env(safe-area-inset-top)]">
          <Image
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-16 -z-10 w-64 opacity-[0.09] sm:w-96 lg:-right-28 lg:w-[34rem]"
            height={331}
            priority
            src="/brand/eqcamp-mark.png"
            width={320}
          />

          <div className="flex flex-1 flex-col gap-9 px-5 pt-8 sm:px-8 sm:pt-12 lg:gap-14 lg:px-16 lg:pt-14">
            <BrandLockup onDark />

            <div className="grid gap-5">
              <h1 className="text-[clamp(2.125rem,1.4rem+3vw,3.875rem)] font-semibold leading-[1.26] text-white">
                ให้คะแนนเร็ว
                <span className="block text-sky-lift">ตรวจสอบย้อนหลังได้</span>
              </h1>
              <p className="max-w-[34ch] text-pretty text-[clamp(0.9375rem,0.9rem+0.25vw,1.09375rem)] leading-[1.75] text-white/75">
                ระบบคะแนนกิจกรรมค่าย ที่ทีมงานหลายคนใช้พร้อมกันได้จากมือถือ
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="flex h-20 items-end gap-2 px-4 sm:h-28 sm:gap-3 sm:px-7 lg:h-36 lg:gap-3.5 lg:px-[3.625rem]"
          >
            {BRAND_STRIP.map((bar) => (
              <span
                className="w-full rounded-t-[3px]"
                key={bar.color}
                style={{ backgroundColor: bar.color, height: bar.height }}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6 px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 sm:px-8 sm:pt-10 lg:px-12 lg:pt-14">
          <p className="flex items-center gap-3 rounded-[var(--eq-radius-card)] px-4 py-3 elev-1">
            <Image
              alt=""
              className="h-7 w-auto shrink-0 object-contain"
              height={128}
              src="/brand/eqgroup-mark.png"
              style={{ width: "auto" }}
              width={239}
            />
            <span className="text-xs font-semibold leading-relaxed text-[var(--eq-muted)]">
              โดย บริษัท อีคิวกรุ๊ป จำกัด (EQGROUP)
            </span>
          </p>

          <h2 className="text-2xl font-bold sm:text-3xl">เข้าใช้งาน</h2>

          <div className="grid gap-3">
            <Link
              className="eq-action-primary flex min-h-14 items-center justify-between gap-3 rounded-xl bg-[var(--eq-brand-deep)] px-5 py-4 text-base font-bold text-white sm:min-h-[3.75rem] sm:text-[1.0625rem]"
              href="/admin"
            >
              <span>เข้าสู่ระบบผู้ดูแล</span>
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M5 12h13m0 0-5-5m5 5-5 5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              </svg>
            </Link>

            <p className="flex items-center gap-3 rounded-xl bg-[var(--eq-canvas-soft)] px-4 py-3.5 ring-1 ring-inset ring-[var(--eq-border)]">
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[var(--eq-brand-deep)]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <g
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.1"
                >
                  <path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
                  <path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
                </g>
              </svg>
              <span className="text-sm font-medium leading-relaxed">
                Staff เข้าผ่านลิงก์เฉพาะค่าย ไม่ต้องใช้รหัสผ่าน
              </span>
            </p>

            {process.env.NODE_ENV === "development" ? (
              <Link
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--eq-border-strong)] bg-white px-5 py-4 font-semibold text-[var(--eq-brand-deep)] hover:bg-[var(--eq-blue-soft)]"
                href="/join/DEMO-STAFF-2026"
              >
                <span>เปิด EQCAMP Demo</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>

          <hr className="border-[var(--eq-border)]" />

          <ul className="grid gap-5">
            {CAPABILITIES.map((capability) => (
              <li className="flex items-start gap-3.5" key={capability.title}>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--eq-blue-soft)] text-[var(--eq-brand-deep-pressed)]">
                  <svg
                    aria-hidden="true"
                    className="h-[1.125rem] w-[1.125rem]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <g
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.1"
                    >
                      {capability.icon}
                    </g>
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] font-semibold leading-snug">
                    {capability.title}
                  </span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[var(--eq-muted)]">
                    {capability.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </MotionPage>
  );
}
