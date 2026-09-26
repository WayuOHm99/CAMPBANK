import {
  getCampStatusLabel,
  type CampStatus,
} from "@/lib/camps/get-camp-status-label";

export type ConnectionStatus = "connecting" | "live" | "degraded" | "offline";

type StatusBadgeProps =
  | { axis: "camp"; status: CampStatus }
  | { axis: "connection"; status: ConnectionStatus };

const connectionLabels: Record<ConnectionStatus, string> = {
  connecting: "กำลังเชื่อมต่อ",
  live: "ข้อมูลสด",
  degraded: "อัปเดตสำรอง",
  offline: "การเชื่อมต่อขาดหาย",
};

const statusIconStyles: Record<CampStatus | ConnectionStatus, string> = {
  draft: "text-[var(--eq-brand-deep)]",
  active: "text-[var(--eq-green-dark)]",
  closed: "text-[var(--eq-gray)]",
  connecting: "text-[var(--eq-brand-deep)]",
  live: "text-[var(--eq-green-dark)]",
  degraded: "text-[var(--eq-orange-dark)]",
  offline: "text-[var(--eq-ink)]",
};

function StatusIcon({ status }: { status: CampStatus | ConnectionStatus }) {
  if (status === "connecting") {
    return (
      <svg
        aria-hidden="true"
        className={`h-3.5 w-3.5 animate-spin motion-reduce:animate-none ${statusIconStyles[status]}`}
        fill="none"
        viewBox="0 0 16 16"
      >
        <circle
          cx="8"
          cy="8"
          opacity=".25"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M14 8a6 6 0 0 0-6-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  const symbol =
    status === "active" || status === "live"
      ? "●"
      : status === "closed"
        ? "■"
        : status === "degraded"
          ? "▲"
          : status === "offline"
            ? "×"
            : "◆";

  return (
    <span aria-hidden="true" className={statusIconStyles[status]}>
      {symbol}
    </span>
  );
}

export function StatusBadge(props: StatusBadgeProps) {
  const label =
    props.axis === "camp"
      ? getCampStatusLabel(props.status)
      : connectionLabels[props.status];
  const prefix = props.axis === "camp" ? "สถานะ Camp" : "การเชื่อมต่อ";

  return (
    <span
      aria-label={`${prefix}: ${label}`}
      className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--eq-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--eq-ink)]"
    >
      <StatusIcon status={props.status} />
      <span>{label}</span>
    </span>
  );
}
