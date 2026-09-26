"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * Renders a scannable QR code for a same-origin path, so Staff can join by
 * pointing their phone at the Admin's screen instead of typing a long link.
 */
export function LinkQrCode({ label, path }: { label: string; path: string }) {
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const url = new URL(path, window.location.origin).toString();
    void QRCode.toString(url, { margin: 1, type: "svg", width: 220 }).then(
      (markup) => {
        if (!cancelled) setSvg(markup);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <figure className="grid justify-items-center gap-2 rounded-xl bg-white p-3">
      <div
        aria-label={`QR code ${label}`}
        className="aspect-square w-full max-w-56"
        // qrcode returns a self-contained SVG built from the URL only.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        role="img"
      />
      <figcaption className="text-center text-xs text-[var(--eq-muted)]">
        ให้ {label} สแกนด้วยกล้องมือถือ
      </figcaption>
    </figure>
  );
}
