import type { ReactNode } from "react";
import { OnlineAccessGate } from "@/components/shared/online-access-gate";

export default function JoinLayout({ children }: { children: ReactNode }) {
  return <OnlineAccessGate>{children}</OnlineAccessGate>;
}
