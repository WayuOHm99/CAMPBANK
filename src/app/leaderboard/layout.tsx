import type { ReactNode } from "react";
import { OnlineAccessGate } from "@/components/shared/online-access-gate";

export default function LeaderboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <OnlineAccessGate>{children}</OnlineAccessGate>;
}
