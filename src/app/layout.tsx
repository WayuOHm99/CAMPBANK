import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import type { ReactNode } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { PwaRegistration } from "@/components/shared/pwa-registration";

import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-anuphan",
});

export const metadata: Metadata = {
  title: {
    default: "EQ-BANK",
    template: "%s | EQ-BANK",
  },
  description:
    "EQ-BANK ระบบจัดการคะแนนกิจกรรมค่าย โดยบริษัท อีคิวกรุ๊ป จำกัด (EQGROUP)",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EQ-BANK",
  },
  icons: {
    apple: "/brand/logo-eqcamp.jpg",
    icon: "/brand/logo-eqcamp.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#205E91",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={anuphan.variable} data-scroll-behavior="smooth" lang="th">
      <body>
        {children}
        <PwaRegistration />
        <SpeedInsights />
      </body>
    </html>
  );
}
