import type { ReactNode } from "react";
import { OnlineAccessGate } from "@/components/shared/online-access-gate";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <OnlineAccessGate>{children}</OnlineAccessGate>;
}
