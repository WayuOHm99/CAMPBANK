import Image from "next/image";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
  name?: string;
  onDark?: boolean;
};

/**
 * The EQCAMP mark, keyed to transparency so it sits on any surface. The full
 * wordmark lockup is deliberately not used here: its letters run from deep to
 * bright blue and only read on a light background.
 */
export function BrandLockup({
  compact = false,
  className = "",
  name = "EQ-BANK",
  onDark = false,
}: BrandLockupProps) {
  if (compact) {
    return (
      <div
        aria-label={name}
        className={`flex items-center gap-2.5 ${className}`}
      >
        <Image
          alt=""
          className="h-7 w-7 shrink-0 object-contain"
          height={28}
          priority
          src="/brand/eqcamp-mark.png"
          width={28}
        />
        <p
          className={`text-base font-bold ${onDark ? "text-white" : "text-[var(--eq-brand-deep)]"}`}
        >
          {name}
        </p>
      </div>
    );
  }

  return (
    <div aria-label={name} className={`flex items-center gap-4 ${className}`}>
      <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_-14px_rgb(6_22_38/0.6)] sm:h-20 sm:w-20">
        <Image
          alt="โลโก้ EQCAMP"
          className="h-11 w-11 object-contain sm:h-14 sm:w-14"
          height={56}
          priority
          src="/brand/eqcamp-mark.png"
          width={56}
        />
      </span>
      <div className="min-w-0">
        <p
          className={`text-xl font-bold sm:text-2xl ${onDark ? "text-white" : "text-[var(--eq-ink)]"}`}
        >
          {name}
        </p>
        <p
          className={`text-xs font-semibold tracking-[0.14em] ${onDark ? "text-sky-lift" : "text-[var(--eq-muted)]"}`}
        >
          ระบบคะแนนกิจกรรมค่าย
        </p>
      </div>
    </div>
  );
}
