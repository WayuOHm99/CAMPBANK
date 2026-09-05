/// <reference types="react/canary" />

"use client";

import * as React from "react";

type MotionBoundaryProps = {
  children: React.ReactNode;
};

function subscribeToBrowserSupport() {
  return () => undefined;
}

function getViewTransitionSupport() {
  const webKitEngine =
    navigator.userAgent.includes("AppleWebKit") &&
    !/(Chrome|Chromium|Edg)/.test(navigator.userAgent);
  return (
    !webKitEngine &&
    "startViewTransition" in document &&
    CSS.supports("view-transition-class: none")
  );
}

function useViewTransitionSupport() {
  return React.useSyncExternalStore(
    subscribeToBrowserSupport,
    getViewTransitionSupport,
    () => false,
  );
}

/**
 * Next.js 16 supplies React's canary ViewTransition at runtime, while unit
 * tests and unsupported renderers may expose only stable React. Keeping the
 * fallback here makes motion a progressive enhancement rather than a routing
 * dependency.
 */
export function MotionPage({ children }: MotionBoundaryProps) {
  const ViewTransition = React.ViewTransition;
  const supported = useViewTransitionSupport();

  if (!ViewTransition || !supported) {
    return <>{children}</>;
  }

  return (
    <ViewTransition default="none" enter="eq-page-enter" exit="eq-page-exit">
      {children}
    </ViewTransition>
  );
}

export function MotionRankingItem({
  children,
  id,
}: MotionBoundaryProps & { id: string }) {
  const ViewTransition = React.ViewTransition;
  const supported = useViewTransitionSupport();

  if (!ViewTransition || !supported) {
    return <>{children}</>;
  }

  return (
    <ViewTransition
      default="none"
      name={`eq-ranking-${id}`}
      update="eq-ranking-move"
    >
      {children}
    </ViewTransition>
  );
}
