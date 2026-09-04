import type { ScoreDirection } from "@/lib/score/signed-score-button";

type ScoreActionContentProps = {
  direction: ScoreDirection;
  pending?: boolean;
  secondaryText?: string;
  value: string;
};

export function scoreActionDirectionFromAmount(amount: number): ScoreDirection {
  return amount > 0 ? "add" : "subtract";
}

export function scoreActionToneClass(direction: ScoreDirection) {
  return direction === "add"
    ? "eq-score-action-add"
    : "eq-score-action-subtract";
}

export function scoreDirectionOptionClass(direction: ScoreDirection) {
  return direction === "add"
    ? "eq-score-direction-add"
    : "eq-score-direction-subtract";
}

export function ScoreActionGlyph({
  className = "h-8 w-8",
  direction,
}: {
  className?: string;
  direction: ScoreDirection;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 32 32"
    >
      <circle cx="16" cy="16" fill="currentColor" opacity="0.16" r="15" />
      <path
        d="M10 16h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      {direction === "add" ? (
        <path
          d="M16 10v12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      ) : null}
    </svg>
  );
}

export function ScoreActionContent({
  direction,
  pending = false,
  secondaryText,
  value,
}: ScoreActionContentProps) {
  if (pending) {
    return (
      <span className="inline-flex items-center justify-center gap-2">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
        กำลังบันทึก…
      </span>
    );
  }

  return (
    <span className="inline-grid grid-cols-[auto_minmax(0,1fr)] items-center justify-center gap-2">
      <ScoreActionGlyph className="h-8 w-8 shrink-0" direction={direction} />
      <span className="grid min-w-0 text-left leading-tight">
        <span className="text-[0.7rem] font-semibold opacity-90 sm:text-xs">
          {direction === "add" ? "เพิ่มคะแนน" : "ลดคะแนน"}
        </span>
        <span className="text-base font-bold tabular-nums sm:text-lg">
          {value}
        </span>
        {secondaryText ? (
          <span className="mt-0.5 text-[0.65rem] font-semibold opacity-85">
            {secondaryText}
          </span>
        ) : null}
      </span>
    </span>
  );
}
