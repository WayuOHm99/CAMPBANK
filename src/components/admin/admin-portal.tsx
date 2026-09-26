"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { BrandLockup } from "@/components/shared/brand-lockup";
import { ScreenState } from "@/components/shared/screen-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatScore } from "@/lib/score/format-score";
import {
  ensureAnonymousSession,
  isStaleAnonymousSessionError,
  renewAnonymousSession,
} from "@/lib/supabase/client";
import {
  isRpcFailure,
  type AdminCampSummary,
  type AdminIdentity,
} from "@/types/domain";

type PortalView = "loading" | "login" | "pin-change" | "camps" | "create";
type CampStatusFilter = "all" | AdminCampSummary["status"];

type LoginOption = Pick<AdminIdentity, "id" | "display_name">;

const ADMIN_PIN_LENGTH = 4;

function formatCampDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export function AdminPortal() {
  const router = useRouter();
  const [view, setView] = useState<PortalView>("loading");
  const [admin, setAdmin] = useState<AdminIdentity>();
  const [options, setOptions] = useState<LoginOption[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [camps, setCamps] = useState<AdminCampSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [campSearch, setCampSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampStatusFilter>("all");
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string>();
  const archivedCount = camps.filter((camp) => camp.archived_at).length;
  const visibleCamps = camps.filter(
    (camp) => showArchived || !camp.archived_at,
  );
  const normalizedCampSearch = campSearch.trim().toLocaleLowerCase("th-TH");
  const filteredCamps = visibleCamps.filter((camp) => {
    const matchesStatus =
      statusFilter === "all" || camp.status === statusFilter;
    const searchText = [camp.name, camp.code, camp.location_name ?? ""]
      .join(" ")
      .toLocaleLowerCase("th-TH");
    return (
      matchesStatus &&
      (!normalizedCampSearch || searchText.includes(normalizedCampSearch))
    );
  });
  const statusCounts = {
    draft: camps.filter((camp) => camp.status === "draft").length,
    active: camps.filter((camp) => camp.status === "active").length,
    closed: camps.filter((camp) => camp.status === "closed").length,
  };
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const loadCamps = useCallback(async () => {
    const client = await ensureAnonymousSession();
    const { data, error: rpcError } = await client.rpc("get_admin_camps");
    if (rpcError) throw rpcError;
    if (isRpcFailure(data)) throw new Error(data.error.message);

    const result = data as {
      ok: true;
      admin: Pick<AdminIdentity, "id" | "display_name">;
      camps: AdminCampSummary[];
    };
    setAdmin((current) => ({
      id: result.admin.id,
      display_name: result.admin.display_name,
      must_change_pin: current?.must_change_pin ?? false,
    }));
    setCamps(result.camps);
    setSelectedCampIds([]);
    setView("camps");
  }, []);

  const selectedCamps = camps.filter((camp) =>
    selectedCampIds.includes(camp.id),
  );
  const canBulkArchive =
    selectedCamps.length > 0 &&
    selectedCamps.every(
      (camp) => camp.status === "closed" && !camp.archived_at,
    );
  const canBulkUnarchive =
    selectedCamps.length > 0 &&
    selectedCamps.every(
      (camp) => camp.status === "closed" && Boolean(camp.archived_at),
    );

  function toggleCampSelection(campId: string) {
    setSelectedCampIds((current) =>
      current.includes(campId)
        ? current.filter((id) => id !== campId)
        : [...current, campId],
    );
  }

  async function bulkArchive(archived: boolean) {
    if ((!archived && !canBulkUnarchive) || (archived && !canBulkArchive)) {
      setBulkMessage("เลือกเฉพาะค่าย Closed ที่อยู่สถานะเดียวกัน");
      return;
    }

    const action = archived ? "เก็บค่ายที่เลือกเข้าคลัง" : "นำค่ายที่เลือกออกจากคลัง";
    if (!window.confirm(`ยืนยัน${action}จำนวน ${selectedCamps.length} รายการ?`)) {
      return;
    }

    setBulkPending(true);
    setBulkMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      for (const camp of selectedCamps) {
        const { data, error: rpcError } = await client.rpc(
          "set_camp_archived",
          { p_archived: archived, p_camp_id: camp.id },
        );
        if (rpcError) throw rpcError;
        if (isRpcFailure(data)) throw new Error(data.error.message);
      }
      setBulkMessage(
        archived
          ? `เก็บค่ายเข้าคลังแล้ว ${selectedCamps.length} รายการ`
          : `นำค่ายออกจากคลังแล้ว ${selectedCamps.length} รายการ`,
      );
      await loadCamps();
    } catch (bulkError) {
      setBulkMessage(
        bulkError instanceof Error ? bulkError.message : "ทำรายการไม่สำเร็จ",
      );
    } finally {
      setBulkPending(false);
    }
  }

  const loadLogin = useCallback(async () => {
    const client = await ensureAnonymousSession();
    const { data, error: rpcError } = await client.rpc(
      "get_admin_login_options",
    );
    if (rpcError) throw rpcError;

    const loginOptions =
      (data as { admins?: LoginOption[] } | null)?.admins ?? [];
    setOptions(loginOptions);
    setSelectedAdminId((current) => current || loginOptions[0]?.id || "");
    setView("login");
  }, []);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const client = await ensureAnonymousSession();
        const { data, error: rpcError } = await client.rpc(
          "get_current_admin_session",
        );
        if (rpcError) throw rpcError;
        if (!active) return;

        if (!isRpcFailure(data)) {
          const restored = data as { ok: true; admin: AdminIdentity };
          setAdmin(restored.admin);
          if (restored.admin.must_change_pin) {
            setView("pin-change");
          } else {
            await loadCamps();
          }
        } else {
          await loadLogin();
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "ไม่สามารถเปิดระบบ Admin ได้",
          );
          setView("login");
        }
      }
    }

    void restore();
    return () => {
      active = false;
    };
  }, [loadCamps, loadLogin]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAdminId || pending) return;

    setPending(true);
    setError(undefined);
    try {
      let client = await ensureAnonymousSession();
      let response = await client.rpc("login_admin", {
        p_admin_account_id: selectedAdminId,
        p_pin: pin,
      });

      if (isStaleAnonymousSessionError(response.error)) {
        client = await renewAnonymousSession();
        response = await client.rpc("login_admin", {
          p_admin_account_id: selectedAdminId,
          p_pin: pin,
        });
      }

      const { data, error: rpcError } = response;
      if (rpcError) throw new Error(rpcError.message);
      if (isRpcFailure(data)) throw new Error(data.error.message);

      const result = data as { ok: true; admin: AdminIdentity };
      setAdmin(result.admin);
      setPin("");
      if (result.admin.must_change_pin) {
        setView("pin-change");
      } else {
        await loadCamps();
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "เข้าสู่ระบบไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  async function submitPinChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (newPin !== confirmPin) {
      setError("PIN ใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc("change_admin_pin", {
        p_current_pin: currentPin,
        p_new_pin: newPin,
      });
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);

      const result = data as { ok: true; admin: AdminIdentity };
      setAdmin(result.admin);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      await loadCamps();
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "เปลี่ยน PIN ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { error: rpcError } = await client.rpc("logout_admin");
      if (rpcError) throw rpcError;
      setAdmin(undefined);
      setCamps([]);
      await loadLogin();
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "ออกจากระบบไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  if (view === "loading") {
    return (
      <ScreenState
        backHref="/"
        busy
        title="กำลังเปิดระบบ Admin"
        message="ตรวจสอบสิทธิ์อย่างปลอดภัย"
      />
    );
  }

  if (view === "login") {
    return (
      <AdminShell
        title="เข้าสู่ระบบ Admin"
        subtitle="เลือกชื่อและกรอก PIN 4 หลัก"
      >
        <form className="grid gap-4" onSubmit={submitLogin}>
          <label
            className="grid gap-2 text-sm font-semibold"
            htmlFor="admin-name"
          >
            ชื่อ Admin
            <select
              className="min-h-14 rounded-2xl border border-[var(--eq-border)] bg-white px-4 text-base"
              id="admin-name"
              onChange={(event) => setSelectedAdminId(event.target.value)}
              required
              value={selectedAdminId}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.display_name}
                </option>
              ))}
            </select>
          </label>

          <PinInput
            autoComplete="current-password"
            id="admin-pin"
            label="PIN"
            onChange={setPin}
            value={pin}
          />

          <AdminError message={error} />
          <button
            className="min-h-14 rounded-2xl eq-action-primary bg-[var(--eq-brand-deep)] px-5 font-bold text-white disabled:opacity-50"
            disabled={pending || options.length === 0}
            type="submit"
          >
            {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
          </button>
          <Link
            className="min-h-12 py-3 text-center font-bold text-[var(--eq-muted)]"
            href="/"
          >
            กลับหน้าแรก
          </Link>
        </form>
      </AdminShell>
    );
  }

  if (view === "pin-change") {
    return (
      <AdminShell
        title="ตั้ง PIN ใหม่"
        subtitle={`${admin?.display_name ?? "Admin"} · PIN ชั่วคราวต้องเปลี่ยนก่อนจัดการค่าย`}
      >
        <form className="grid gap-4" onSubmit={submitPinChange}>
          <PinInput
            id="current-pin"
            label="PIN ชั่วคราว"
            onChange={setCurrentPin}
            value={currentPin}
          />
          <PinInput
            id="new-pin"
            label="PIN ใหม่"
            onChange={setNewPin}
            value={newPin}
          />
          <PinInput
            id="confirm-pin"
            label="ยืนยัน PIN ใหม่"
            onChange={setConfirmPin}
            value={confirmPin}
          />
          <AdminError message={error} />
          <button
            className="min-h-14 rounded-2xl eq-action-primary bg-[var(--eq-brand-deep)] px-5 font-bold text-white disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? "กำลังบันทึก…" : "บันทึก PIN ใหม่"}
          </button>
        </form>
      </AdminShell>
    );
  }

  if (view === "create") {
    return (
      <CreateCampWizard
        onCancel={() => {
          setError(undefined);
          setView("camps");
        }}
        onCreated={(campId) => router.push(`/admin/camps/${campId}`)}
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--eq-canvas-soft)] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[var(--eq-ink)]">
      <div className="mx-auto max-w-6xl">
        <header className="eq-app-header flex items-start justify-between gap-4 py-3">
          <div>
            <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
              EQ-BANK ADMIN
            </p>
            <h1 className="mt-1 text-3xl font-bold">ค่ายของฉัน</h1>
            <p className="mt-1 text-sm text-[var(--eq-muted)]">
              {admin?.display_name}
            </p>
          </div>
          <button
            className="min-h-11 rounded-xl border border-[var(--eq-border)] bg-white px-4 text-sm font-semibold"
            disabled={pending}
            onClick={() => void logout()}
            type="button"
          >
            ออกจากระบบ
          </button>
        </header>

        <button
          className="mt-5 min-h-14 w-full rounded-2xl eq-action-primary bg-[var(--eq-brand-deep)] px-5 font-bold text-white shadow-sm"
          onClick={() => setView("create")}
          type="button"
        >
          + สร้าง Camp ใหม่
        </button>

        <AdminError message={error} />
        <section
          aria-label="สรุปและค้นหาค่าย"
          className="mt-5 grid gap-3 rounded-2xl border border-[var(--eq-border)] bg-white p-4"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CampCount label="Draft" value={statusCounts.draft} />
            <CampCount label="Active" value={statusCounts.active} />
            <CampCount label="Closed" value={statusCounts.closed} />
            <CampCount label="ในคลัง" value={archivedCount} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="grid gap-1 text-sm font-semibold" htmlFor="camp-search">
              ค้นหาค่าย
              <input
                className="min-h-11 rounded-xl border border-[var(--eq-border)] bg-white px-3 font-normal"
                id="camp-search"
                onChange={(event) => setCampSearch(event.target.value)}
                placeholder="ชื่อค่าย รหัส หรือสถานที่"
                type="search"
                value={campSearch}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold" htmlFor="camp-status-filter">
              สถานะ
              <select
                className="min-h-11 rounded-xl border border-[var(--eq-border)] bg-white px-3 font-normal"
                id="camp-status-filter"
                onChange={(event) =>
                  setStatusFilter(event.target.value as CampStatusFilter)
                }
                value={statusFilter}
              >
                <option value="all">ทุกสถานะ</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
        </section>
        {selectedCampIds.length > 0 ? (
          <section
            aria-label="จัดการค่ายที่เลือก"
            className="mt-4 grid gap-3 rounded-2xl border border-[var(--eq-border-strong)] bg-white p-4 sm:flex sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-bold">เลือกแล้ว {selectedCampIds.length} ค่าย</p>
              {!canBulkArchive && !canBulkUnarchive ? (
                <p className="mt-1 text-sm text-[var(--eq-muted)]">
                  เลือกเฉพาะค่าย Closed ที่อยู่สถานะเดียวกันเพื่อจัดการคลัง
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:flex">
              <button
                className="min-h-11 rounded-xl border border-[var(--eq-border)] px-3 text-sm font-bold disabled:opacity-40"
                disabled={bulkPending || !canBulkArchive}
                onClick={() => void bulkArchive(true)}
                type="button"
              >
                เก็บเข้าคลัง
              </button>
              <button
                className="min-h-11 rounded-xl border border-[var(--eq-border)] px-3 text-sm font-bold disabled:opacity-40"
                disabled={bulkPending || !canBulkUnarchive}
                onClick={() => void bulkArchive(false)}
                type="button"
              >
                นำออกจากคลัง
              </button>
              <button
                className="min-h-11 rounded-xl px-3 text-sm font-bold text-[var(--eq-muted)]"
                disabled={bulkPending}
                onClick={() => setSelectedCampIds([])}
                type="button"
              >
                ยกเลิกการเลือก
              </button>
            </div>
          </section>
        ) : null}
        {bulkMessage ? (
          <p aria-live="polite" className="mt-3 text-sm font-bold" role="status">
            {bulkMessage}
          </p>
        ) : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCamps.map((camp) => (
            <article
              className="rounded-2xl border border-[var(--eq-border)] bg-white p-5 shadow-sm"
              key={camp.id}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
                  {camp.code}
                </p>
                {camp.status === "closed" ? (
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--eq-muted)]">
                    <input
                      aria-label={`เลือกค่าย ${camp.name}`}
                      checked={selectedCampIds.includes(camp.id)}
                      disabled={bulkPending}
                      onChange={() => toggleCampSelection(camp.id)}
                      type="checkbox"
                    />
                    เลือก
                  </label>
                ) : null}
              </div>
              <Link
                className="block rounded-xl transition hover:bg-[var(--eq-canvas-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--eq-brand-deep)]"
                href={`/admin/camps/${camp.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-bold">
                      {camp.name}
                    </h2>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge axis="camp" status={camp.status} />
                    {camp.archived_at ? (
                      <span className="rounded-lg bg-[var(--eq-canvas-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--eq-muted)]">
                        เก็บเข้าคลังแล้ว
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--eq-muted)]">
                  {formatCampDate(camp.camp_date)}
                  {camp.location_name ? ` · ${camp.location_name}` : ""}
                </p>
                <p className="mt-5 text-sm font-bold text-[var(--eq-muted)]">
                  งบคงเหลือ
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatScore(camp.remaining_budget)} /{" "}
                  {formatScore(camp.total_budget)}
                </p>
              </Link>
            </article>
          ))}
        </div>

        {archivedCount > 0 ? (
          <button
            aria-pressed={showArchived}
            className="mt-4 min-h-11 rounded-xl border border-[var(--eq-border)] bg-white px-4 text-sm font-semibold"
            onClick={() => setShowArchived((current) => !current)}
            type="button"
          >
            {showArchived
              ? "ซ่อนค่ายที่เก็บเข้าคลัง"
              : `แสดงค่ายที่เก็บเข้าคลัง (${archivedCount})`}
          </button>
        ) : null}

        {filteredCamps.length === 0 ? (
          <section className="mt-5 rounded-2xl border border-dashed border-[var(--eq-border)] p-8 text-center text-[var(--eq-muted)]">
            {camps.length === 0 ? (
              "ยังไม่มี Camp เริ่มสร้าง Camp แรกได้เลย"
            ) : visibleCamps.length === 0 ? (
              <>
                <p>ไม่มีค่ายที่กำลังแสดงอยู่</p>
                <p className="mt-2 text-sm">
                  มีค่ายในคลัง {archivedCount} รายการ
                </p>
                <button
                  className="mt-4 min-h-11 rounded-xl border border-[var(--eq-border-strong)] bg-white px-4 font-bold text-[var(--eq-brand-deep)]"
                  onClick={() => setShowArchived(true)}
                  type="button"
                >
                  แสดงค่ายที่เก็บเข้าคลัง
                </button>
              </>
            ) : (
              <>
                <p>ไม่พบค่ายที่ตรงกับตัวกรอง</p>
                <p className="mt-2 text-sm">ลองเปลี่ยนคำค้นหาหรือสถานะ</p>
                <button
                  className="mt-4 min-h-11 rounded-xl border border-[var(--eq-border-strong)] bg-white px-4 font-bold"
                  onClick={() => {
                    setCampSearch("");
                    setStatusFilter("all");
                  }}
                  type="button"
                >
                  ล้างตัวกรอง
                </button>
              </>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function CampCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--eq-canvas-soft)] px-3 py-2">
      <p className="text-xs font-semibold text-[var(--eq-muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function AdminShell({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--eq-canvas)] px-4 py-[calc(1rem+env(safe-area-inset-top))] text-[var(--eq-ink)] sm:px-6 sm:py-[calc(2rem+env(safe-area-inset-top))]">
      <section className="eq-card w-full max-w-md p-5 sm:p-8">
        <BrandLockup compact />
        <div className="my-5 border-t border-[var(--eq-border)]" />
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--eq-brand-deep)]">
          ADMIN
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-[var(--eq-muted)] sm:text-base">
          {subtitle}
        </p>
        {children}
      </section>
    </main>
  );
}

function PinInput({
  autoComplete = "new-password",
  id,
  label,
  onChange,
  value,
}: {
  autoComplete?: "current-password" | "new-password";
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <label className="grid gap-2 text-sm font-semibold" htmlFor={id}>
      <span>{label}</span>
      <span className="relative block">
        <input
          aria-label={label}
          aria-describedby={`${id}-progress`}
          autoComplete={autoComplete}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          id={id}
          inputMode="numeric"
          maxLength={ADMIN_PIN_LENGTH}
          onBlur={() => setFocused(false)}
          onChange={(event) =>
            onChange(
              event.target.value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH),
            )
          }
          onFocus={() => setFocused(true)}
          pattern="[0-9]{4}"
          required
          type="password"
          value={value}
        />
        <ol
          aria-label={`${label} ${ADMIN_PIN_LENGTH} หลัก`}
          className="grid grid-cols-4 gap-3"
        >
          {Array.from({ length: ADMIN_PIN_LENGTH }, (_, index) => {
            const filled = index < value.length;
            const current =
              value.length < ADMIN_PIN_LENGTH && index === value.length;

            return (
              <li
                aria-current={current ? "step" : undefined}
                aria-label={`หลักที่ ${index + 1}: ${
                  filled
                    ? "กรอกแล้ว"
                    : current && focused
                      ? "กำลังกรอก"
                      : current
                        ? "ตำแหน่งถัดไป"
                        : "ยังไม่ได้กรอก"
                }`}
                className={`grid min-h-14 place-items-center rounded-2xl border text-3xl font-bold transition ${
                  filled
                    ? "border-[var(--eq-brand-deep)] bg-[var(--eq-canvas-soft)] text-[var(--eq-brand-deep)]"
                    : current && focused
                      ? "border-[var(--eq-brand-deep)] bg-[var(--eq-blue-soft)] ring-2 ring-[var(--eq-brand-deep)]"
                      : current
                        ? "border-[var(--eq-border-strong)] bg-white"
                        : "border-[var(--eq-border)] bg-white text-[var(--eq-brand-deep)]"
                }`}
                key={index}
              >
                {filled ? (
                  "•"
                ) : current && focused ? (
                  <span
                    aria-hidden="true"
                    className="h-8 w-0.5 animate-pulse rounded-full bg-[var(--eq-brand-deep)]"
                    data-pin-caret
                  />
                ) : (
                  ""
                )}
              </li>
            );
          })}
        </ol>
      </span>
      <span
        aria-live="polite"
        className="text-center text-xs font-bold text-[var(--eq-muted)]"
        id={`${id}-progress`}
      >
        กรอกแล้ว {value.length} จาก {ADMIN_PIN_LENGTH} หลัก
      </span>
    </label>
  );
}

function AdminError({ message }: { message?: string }) {
  return message ? (
    <p
      className="mt-4 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 text-sm font-bold text-[var(--eq-ink)]"
      role="alert"
    >
      {message}
    </p>
  ) : null;
}

function CreateCampWizard({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (campId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  // Default to today in Bangkok time so most Admins only confirm the date.
  const [campDate, setCampDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
      new Date(),
    ),
  );
  const [budget, setBudget] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function create() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc("create_draft_camp", {
        p_camp_date: campDate,
        p_location_name: location,
        p_name: name,
        p_total_budget: Number(budget),
      });
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);

      onCreated((data as { camp: { id: string } }).camp.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "สร้าง Camp ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="สร้าง Camp ใหม่"
      subtitle={`ขั้นตอน ${step} จาก 3 · บันทึกเป็น Draft ก่อนเปิดใช้งาน`}
    >
      {step === 1 ? (
        <div className="grid gap-4">
          <label
            className="grid gap-2 text-sm font-semibold"
            htmlFor="camp-name"
          >
            ชื่อ Camp
            <input
              className="min-h-14 rounded-2xl border border-[var(--eq-border)] px-4 text-base"
              id="camp-name"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label
            className="grid gap-2 text-sm font-semibold"
            htmlFor="camp-location"
          >
            สถานที่ (ไม่บังคับ)
            <input
              className="min-h-14 rounded-2xl border border-[var(--eq-border)] px-4 text-base"
              id="camp-location"
              onChange={(event) => setLocation(event.target.value)}
              value={location}
            />
          </label>
          <label
            className="grid gap-2 text-sm font-semibold"
            htmlFor="camp-date"
          >
            วันที่ Camp
            <input
              className="min-h-14 rounded-2xl border border-[var(--eq-border)] px-4 text-base"
              id="camp-date"
              onChange={(event) => setCampDate(event.target.value)}
              required
              type="date"
              value={campDate}
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <label
          className="grid gap-2 text-sm font-semibold"
          htmlFor="camp-budget"
        >
          งบกิจกรรมทั้งหมด
          <input
            autoComplete="off"
            className="min-h-14 rounded-2xl border border-[var(--eq-border)] px-4 text-2xl font-bold tabular-nums"
            id="camp-budget"
            inputMode="numeric"
            onChange={(event) =>
              setBudget(event.target.value.replace(/\D/g, ""))
            }
            pattern="[0-9,]*"
            required
            type="text"
            value={budget ? formatScore(Number(budget)) : ""}
          />
          <span className="font-medium text-[var(--eq-muted)]">
            เงินกิจกรรมจำลอง = คะแนน
          </span>
        </label>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl bg-[var(--eq-canvas-soft)] p-4">
          <p className="text-sm font-bold text-[var(--eq-muted)]">
            ตรวจสอบก่อนสร้าง Draft
          </p>
          <h2 className="mt-2 text-xl font-bold">{name}</h2>
          <p className="mt-1 text-sm text-[var(--eq-muted)]">
            {campDate ? formatCampDate(campDate) : "ยังไม่ระบุวันที่"}
            {location ? ` · ${location}` : ""}
          </p>
          <p className="mt-4 text-2xl font-bold">
            {formatScore(Number(budget))} คะแนน
          </p>
        </section>
      ) : null}

      <AdminError message={error} />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-4 font-semibold"
          onClick={
            step === 1 ? onCancel : () => setStep((current) => current - 1)
          }
          type="button"
        >
          {step === 1 ? "ยกเลิก" : "ย้อนกลับ"}
        </button>
        {step < 3 ? (
          <button
            className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-semibold text-white disabled:opacity-45"
            disabled={
              (step === 1 && (!name.trim() || !campDate)) ||
              (step === 2 && Number(budget) <= 0)
            }
            onClick={() => setStep((current) => current + 1)}
            type="button"
          >
            ต่อไป
          </button>
        ) : (
          <button
            className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-semibold text-white disabled:opacity-45"
            disabled={pending}
            onClick={() => void create()}
            type="button"
          >
            {pending ? "กำลังสร้าง…" : "สร้าง Draft"}
          </button>
        )}
      </div>
    </AdminShell>
  );
}
