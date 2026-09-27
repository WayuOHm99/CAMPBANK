"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="th">
      <body>
        <main>
          <h1>เกิดข้อผิดพลาด</h1>
          <p>โปรดลองอีกครั้ง หากยังพบปัญหา กรุณาติดต่อผู้ดูแลระบบ</p>
          <button onClick={reset} type="button">
            ลองอีกครั้ง
          </button>
        </main>
      </body>
    </html>
  );
}
