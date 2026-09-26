import type { ReactNode } from "react";

import { ScreenState } from "@/components/shared/screen-state";

export function OnlineAccessGate({ children }: { children: ReactNode }) {
  if (process.env.EQCAMP_ACCESS_ENABLED === "false") {
    return (
      <ScreenState
        backHref="/"
        title="ยังไม่เปิดให้เข้าใช้งาน"
        message="เว็บไซต์ออนไลน์แล้ว ขณะนี้ยังไม่เปิดการเข้าสู่ระบบและการให้คะแนน กรุณารอประกาศจากผู้ดูแล"
      />
    );
  }

  return children;
}
