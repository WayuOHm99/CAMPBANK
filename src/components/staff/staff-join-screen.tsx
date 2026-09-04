"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BrandLockup } from "@/components/shared/brand-lockup";
import { ScreenState } from "@/components/shared/screen-state";
import {
  ensureAnonymousSession,
  isStaleAnonymousSessionError,
  renewAnonymousSession,
} from "@/lib/supabase/client";
import { isRpcFailure, type StaffJoinOptions } from "@/types/domain";

type StaffJoinScreenProps = {
  campCode: string;
};

export function StaffJoinScreen({ campCode }: StaffJoinScreenProps) {
  const router = useRouter();
  const [options, setOptions] = useState<StaffJoinOptions>();
  const [error, setError] = useState<string>();
  const [pendingMemberId, setPendingMemberId] = useState<string>();
  const [rememberedMemberId, setRememberedMemberId] = useState<string>();

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const client = await ensureAnonymousSession();
        const { data, error: rpcError } = await client.rpc(
          "get_staff_join_options",
          {
            p_staff_join_code: campCode,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        if (isRpcFailure(data)) {
          throw new Error(data.error.message);
        }

        if (!active) {
          return;
        }

        const result = data as StaffJoinOptions;
        setOptions(result);
        window.localStorage.setItem(
          `eqcamp:staff-link:${result.camp.id}`,
          campCode,
        );
        setRememberedMemberId(
          window.localStorage.getItem(`eqcamp:last-staff:${result.camp.id}`) ??
            undefined,
        );
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "ไม่สามารถเปิดลิงก์ค่ายได้",
          );
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [campCode]);

  const orderedStaff = useMemo(() => {
    if (!options) {
      return [];
    }

    return [...options.staff].sort((left, right) => {
      if (left.id === rememberedMemberId) return -1;
      if (right.id === rememberedMemberId) return 1;
      return left.sort_order - right.sort_order;
    });
  }, [options, rememberedMemberId]);

  async function selectStaff(memberId: string) {
    if (!options || pendingMemberId) {
      return;
    }

    setPendingMemberId(memberId);
    setError(undefined);

    try {
      let client = await ensureAnonymousSession();
      let response = await client.rpc("join_staff_camp", {
        p_member_id: memberId,
        p_staff_join_code: campCode,
      });

      if (isStaleAnonymousSessionError(response.error)) {
        client = await renewAnonymousSession();
        response = await client.rpc("join_staff_camp", {
          p_member_id: memberId,
          p_staff_join_code: campCode,
        });
      }

      const { data, error: rpcError } = response;

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (isRpcFailure(data)) {
        throw new Error(data.error.message);
      }

      window.localStorage.setItem(
        `eqcamp:last-staff:${options.camp.id}`,
        memberId,
      );
      window.localStorage.setItem(
        `eqcamp:staff-link:${options.camp.id}`,
        campCode,
      );
      router.replace(`/camp/${options.camp.id}`);
    } catch (joinError) {
      setPendingMemberId(undefined);
      setError(
        joinError instanceof Error
          ? joinError.message
          : "ไม่สามารถเลือก Staff ได้",
      );
    }
  }

  if (error && !options) {
    return (
      <ScreenState
        backHref="/"
        title="เปิดค่ายไม่ได้"
        message={error}
        tone="danger"
      />
    );
  }

  if (!options) {
    return (
      <ScreenState
        backHref="/"
        title="กำลังเปิดค่าย"
        message="ตรวจสอบลิงก์และการเชื่อมต่อ"
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--eq-canvas-soft)] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] text-[var(--eq-ink)]">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8">
          <Link
            className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--eq-brand-deep)]"
            href="/"
          >
            ← กลับหน้าแรก
          </Link>
          <BrandLockup className="mt-3 max-w-md" compact />
          <h1 className="mt-3 text-3xl font-bold">เลือกชื่อ Staff</h1>
          <p className="mt-2 text-[var(--eq-muted)]">
            {options.camp.name}
            {options.camp.location_name
              ? ` · ${options.camp.location_name}`
              : ""}
          </p>
        </header>

        {error ? (
          <p
            className="mb-4 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 text-sm font-semibold text-[var(--eq-ink)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedStaff.map((staff) => {
            const remembered = staff.id === rememberedMemberId;
            const pending = staff.id === pendingMemberId;

            return (
              <button
                className="flex min-h-16 w-full items-center justify-between rounded-2xl border border-[var(--eq-border)] bg-white px-5 py-4 text-left text-lg font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                disabled={Boolean(pendingMemberId)}
                key={staff.id}
                onClick={() => void selectStaff(staff.id)}
                type="button"
              >
                <span>{staff.display_name}</span>
                <span className="text-sm font-bold text-[var(--eq-muted)]">
                  {pending ? "กำลังเข้า…" : remembered ? "ล่าสุด" : "เลือก"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
