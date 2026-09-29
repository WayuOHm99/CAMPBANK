"use client";

import Link from "next/link";
import { CampManagement } from "@/components/admin/camp-management";
import { StaffInvitations } from "@/components/admin/staff-invitations";
import {
  type Dispatch,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ColorPickerDialog } from "@/components/shared/color-picker-dialog";
import { pickDistinctColors } from "@/lib/colors/color-distance";
import { MAX_GROUPS_PER_CAMP } from "@/lib/groups/limits";
import { MotionRankingItem } from "@/components/shared/motion";
import {
  copyText,
  CopyShareActions,
} from "@/components/shared/copy-share-actions";
import {
  ScoreActionContent,
  ScoreActionGlyph,
  scoreActionToneClass,
  scoreDirectionOptionClass,
} from "@/components/shared/score-action-visual";
import { ScreenState } from "@/components/shared/screen-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { downloadCsv } from "@/lib/csv/create-csv-download";
import { createClientUuid } from "@/lib/ids/create-client-uuid";
import {
  getGroupDisplayName,
  getGroupLabel,
} from "@/lib/groups/get-group-display-name";
import { createRankingShareText } from "@/lib/leaderboard/create-ranking-share-text";
import { formatScore } from "@/lib/score/format-score";
import {
  getAutomaticScoreButtonLabel,
  getSignedScoreAmount,
  MAX_SCORE_BUTTON_MAGNITUDE,
  normalizeScoreMagnitudeInput,
  type ScoreDirection,
} from "@/lib/score/signed-score-button";
import { useCampLiveSync } from "@/lib/realtime/use-camp-live-sync";
import { rankGroups } from "@/lib/ranking/rank-groups";
import { ensureAnonymousSession } from "@/lib/supabase/client";
import { isRpcFailure, type AdminCampSnapshot } from "@/types/domain";

type AdminCampScreenProps = {
  campId: string;
};

const ADMIN_PIN_LENGTH = 4;

type ColorPreset = {
  key: string;
  name_th: string;
  hex: string;
  text_color: string;
  sort_order: number;
  name_en?: string;
  family?: string;
};

type DraftGroup = {
  color_key: string;
  custom_name: string;
  sort_order: number;
};

type SavedDraft = {
  groups: DraftGroup[];
  staffNames: string[];
  step: number;
};

const DRAFT_STEP_TITLES = [
  "กำหนดจำนวนกลุ่ม",
  "กำหนดสีและชื่อกลุ่ม",
  "เพิ่มรายชื่อ Staff",
  "ตรวจสอบก่อนบันทึก",
] as const;

export function AdminCampScreen({ campId }: AdminCampScreenProps) {
  const [snapshot, setSnapshot] = useState<AdminCampSnapshot>();
  const [colors, setColors] = useState<ColorPreset[]>([]);
  const [error, setError] = useState<string>();
  const [justActivated, setJustActivated] = useState(false);
  const latestRefreshId = useRef(0);
  const previousStatus = useRef<string>(undefined);
  const campStatus = snapshot?.camp.status;
  useEffect(() => {
    // Activation swaps the wizard for the dashboard; greet the Admin at the top.
    if (previousStatus.current === "draft" && campStatus === "active") {
      setJustActivated(true);
      window.scrollTo({ top: 0 });
    }
    previousStatus.current = campStatus;
  }, [campStatus]);

  const refresh = useCallback(async () => {
    const refreshId = latestRefreshId.current + 1;
    latestRefreshId.current = refreshId;
    const client = await ensureAnonymousSession();
    const [snapshotResult, colorResult] = await Promise.all([
      client.rpc("get_admin_camp_snapshot", { p_camp_id: campId }),
      client
        .from("color_presets")
        .select("*")
        .order("sort_order"),
    ]);

    if (refreshId !== latestRefreshId.current) {
      return;
    }

    if (snapshotResult.error) throw snapshotResult.error;
    if (colorResult.error) throw colorResult.error;
    if (isRpcFailure(snapshotResult.data)) {
      throw new Error(snapshotResult.data.error.message);
    }

    startTransition(() => {
      setSnapshot(snapshotResult.data as AdminCampSnapshot);
      setColors((colorResult.data ?? []) as ColorPreset[]);
      setError(undefined);
    });
  }, [campId]);

  const handleSyncError = useCallback((syncError: unknown) => {
    setError(
      syncError instanceof Error
        ? syncError.message
        : "ไม่สามารถเปิดข้อมูล Camp ได้",
    );
  }, []);
  const live = useCampLiveSync({ campId, onError: handleSyncError, refresh });

  if (error && !snapshot) {
    return (
      <ScreenState
        backHref="/admin"
        backLabel="กลับไปค่ายของฉัน"
        title="เปิด Camp ไม่ได้"
        message={error}
        tone="danger"
      />
    );
  }
  if (!snapshot || colors.length === 0) {
    return (
      <ScreenState
        backHref="/admin"
        backLabel="กลับไปค่ายของฉัน"
        busy
        title="กำลังโหลด Camp"
        message="ดึงข้อมูลและตรวจสอบสิทธิ์"
      />
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--eq-canvas-soft)] pb-[calc(3rem+env(safe-area-inset-bottom))] text-[var(--eq-ink)]">
      <header className="eq-app-header border-b border-[var(--eq-border)] bg-white px-4 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="mx-auto max-w-7xl">
          <Link
            className="inline-flex min-h-11 items-center font-bold text-[var(--eq-muted)]"
            href="/admin"
          >
            ← ค่ายของฉัน
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
                EQ-BANK · {snapshot.camp.code}
              </p>
              <h1 className="mt-1 text-3xl font-bold">{snapshot.camp.name}</h1>
            </div>
            <div
              className="flex max-w-[min(100%,24rem)] flex-wrap justify-end gap-2"
              aria-live="polite"
            >
              <StatusBadge axis="camp" status={snapshot.camp.status} />
              <StatusBadge axis="connection" status={live.state} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        {error ? (
          <p
            className="mb-4 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 font-bold text-[var(--eq-ink)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {justActivated ? (
          <p
            className="mb-4 rounded-2xl border border-[var(--eq-green-dark)] bg-white px-4 py-3 font-bold"
            role="status"
          >
            เปิด Camp แล้ว ส่งลิงก์ให้ Staff แต่ละคนได้ที่{" "}
            <a className="text-[var(--eq-brand-deep)] underline" href="#camp-links">
              ส่วนลิงก์
            </a>
          </p>
        ) : null}

        {snapshot.camp.status !== "closed" ? (
          <CampDetailsSettings
            key={`${snapshot.camp.name}:${snapshot.camp.location_name}:${snapshot.camp.camp_date}`}
            onRefresh={refresh}
            snapshot={snapshot}
          />
        ) : null}

        {snapshot.camp.status === "draft" ? (
          <DraftSetupWizard
            campId={campId}
            colors={colors}
            onRefresh={refresh}
            snapshot={snapshot}
          />
        ) : (
          <ActiveCampDashboard
            colors={colors}
            onRefresh={refresh}
            snapshot={snapshot}
          />
        )}

        <CampManagement onRefresh={refresh} snapshot={snapshot} />
      </div>
    </main>
  );
}

function CampDetailsSettings({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [name, setName] = useState(snapshot.camp.name);
  const [locationName, setLocationName] = useState(
    snapshot.camp.location_name ?? "",
  );
  const [campDate, setCampDate] = useState(snapshot.camp.camp_date);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save() {
    if (!name.trim()) {
      setMessage("กรุณาระบุชื่อค่าย");
      return;
    }
    if (!campDate) {
      setMessage("กรุณาระบุวันที่ค่าย");
      return;
    }

    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("update_camp_details", {
        p_camp_date: campDate,
        p_camp_id: snapshot.camp.id,
        p_location_name: locationName,
        p_name: name,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      setMessage("บันทึกรายละเอียดค่ายแล้ว");
      await onRefresh();
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกรายละเอียดค่ายไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure mb-5 rounded-2xl bg-white p-5 shadow-sm">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        รายละเอียดค่าย
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-3 sm:grid-cols-2">
        <label
          className="grid gap-1 text-xs font-bold sm:col-span-2"
          htmlFor="camp-name"
        >
          ชื่อค่าย
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base"
            id="camp-name"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold" htmlFor="camp-location">
          สถานที่ (ไม่บังคับ)
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base"
            id="camp-location"
            maxLength={120}
            onChange={(event) => setLocationName(event.target.value)}
            value={locationName}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold" htmlFor="camp-date">
          วันที่ค่าย
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base"
            id="camp-date"
            onChange={(event) => setCampDate(event.target.value)}
            type="date"
            value={campDate}
          />
        </label>
        {message ? (
          <p
            className="text-sm font-bold text-[var(--eq-muted)] sm:col-span-2"
            role="status"
          >
            {message}
          </p>
        ) : null}
        <button
          className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45 sm:col-span-2"
          disabled={pending}
          onClick={() => void save()}
          type="button"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกรายละเอียด"}
        </button>
      </div>
    </details>
  );
}

function readSavedDraft(
  campId: string,
  snapshot: AdminCampSnapshot,
): SavedDraft {
  const existingGroups = snapshot.groups.map((group) => ({
    color_key: group.color_key,
    custom_name: group.custom_name,
    sort_order: group.sort_order,
  }));
  const existingStaff = snapshot.members
    .filter((member) => member.role === "staff")
    .map((member) => member.display_name);

  const fallback: SavedDraft = {
    groups: existingGroups,
    staffNames: existingStaff.length ? existingStaff : [""],
    step: 1,
  };

  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(`eqcamp:admin-draft:${campId}`);
  if (!raw) return fallback;

  try {
    const saved = JSON.parse(raw) as Partial<SavedDraft>;
    if (!Array.isArray(saved.groups) || !Array.isArray(saved.staffNames)) {
      return fallback;
    }
    return {
      groups: saved.groups,
      staffNames: saved.staffNames,
      step: Math.min(4, Math.max(1, saved.step ?? 1)),
    };
  } catch {
    window.localStorage.removeItem(`eqcamp:admin-draft:${campId}`);
    return fallback;
  }
}

function DraftSetupWizard({
  campId,
  colors,
  onRefresh,
  snapshot,
}: {
  campId: string;
  colors: ColorPreset[];
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [initial] = useState(() => readSavedDraft(campId, snapshot));
  const [step, setStep] = useState(initial.step);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(initial.step);
  useEffect(() => {
    // A long step leaves the Admin at the page bottom; start each step at its title.
    if (shownStep.current === step) return;
    shownStep.current = step;
    stepHeadingRef.current?.scrollIntoView({ block: "start" });
  }, [step]);
  const [groups, setGroups] = useState(initial.groups);
  const [staffNames, setStaffNames] = useState(initial.staffNames);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    window.localStorage.setItem(
      `eqcamp:admin-draft:${campId}`,
      JSON.stringify({ groups, staffNames, step }),
    );
  }, [campId, groups, staffNames, step]);

  const maxGroups = Math.min(MAX_GROUPS_PER_CAMP, colors.length);
  const duplicateColor = useMemo(() => {
    const selectedColors = groups
      .map((group) => group.color_key)
      .filter(Boolean);
    return new Set(selectedColors).size !== selectedColors.length;
  }, [groups]);
  const selectedColorCount = groups.filter((group) => group.color_key).length;
  const missingColor = selectedColorCount !== groups.length;
  const trimmedStaffNames = staffNames
    .map((name) => name.trim())
    .filter(Boolean);
  const staffNamesReady =
    trimmedStaffNames.length > 0 &&
    new Set(trimmedStaffNames.map((name) => name.toLocaleLowerCase("th")))
      .size === trimmedStaffNames.length;
  const readinessItems = [
    {
      actionLabel: "แก้ไขจำนวนกลุ่ม",
      label: `จำนวนกลุ่มอยู่ระหว่าง 1–${maxGroups} กลุ่ม`,
      ready: groups.length >= 1 && groups.length <= maxGroups,
      step: 1,
    },
    {
      actionLabel: "แก้ไขสี",
      label: "เลือกสีครบทุกกลุ่มและไม่ซ้ำกัน",
      ready: !missingColor && !duplicateColor,
      step: 2,
    },
    {
      actionLabel: "แก้ไข Staff",
      label: "Staff อย่างน้อย 1 คนและชื่อไม่ซ้ำ",
      ready: staffNamesReady,
      step: 3,
    },
    {
      label: "งบค่ายมากกว่า 0",
      ready: snapshot.camp.total_budget > 0,
    },
    {
      label: "มีปุ่มเพิ่มและลดคะแนนที่เปิดใช้งาน",
      ready:
        snapshot.score_buttons.some(
          (button) => button.enabled && button.amount > 0,
        ) &&
        snapshot.score_buttons.some(
          (button) => button.enabled && button.amount < 0,
        ),
    },
  ] satisfies Array<{
    actionLabel?: string;
    label: string;
    ready: boolean;
    step?: number;
  }>;
  const setupReady = readinessItems.every((item) => item.ready);

  function changeGroupCount(requestedCount: number) {
    const maximum = maxGroups;
    const nextCount = Math.min(
      maximum,
      Math.max(0, Math.trunc(requestedCount)),
    );
    if (nextCount === groups.length) return;

    if (nextCount < groups.length) {
      const removedGroups = groups.slice(nextCount);
      const removesConfiguredGroup = removedGroups.some(
        (group) => group.color_key || group.custom_name.trim(),
      );
      if (
        removesConfiguredGroup &&
        !window.confirm(
          `ลดเหลือ ${nextCount} กลุ่ม? สีหรือชื่อของ ${removedGroups.length} กลุ่มท้ายจะถูกลบ`,
        )
      ) {
        return;
      }
      setGroups(groups.slice(0, nextCount));
      return;
    }

    setGroups([
      ...groups,
      ...Array.from({ length: nextCount - groups.length }, (_, index) => ({
        color_key: "",
        custom_name: "",
        sort_order: groups.length + index + 1,
      })),
    ]);
  }

  function updateGroup(index: number, patch: Partial<DraftGroup>) {
    setGroups((current) =>
      current.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...patch } : group,
      ),
    );
  }

  function fillUnusedColors() {
    setGroups((current) => {
      const kept = new Set<string>();
      const keepsColor = current.map((group) => {
        const valid =
          Boolean(group.color_key) &&
          colors.some((color) => color.key === group.color_key) &&
          !kept.has(group.color_key);
        if (valid) kept.add(group.color_key);
        return valid;
      });
      // Pick the most distinct remaining colors, not simply the next in list.
      const fresh = pickDistinctColors(
        colors,
        colors.filter((color) => kept.has(color.key)),
        keepsColor.filter((keeps) => !keeps).length,
      );
      let nextFresh = 0;
      return current.map((group, index) =>
        keepsColor[index]
          ? group
          : { ...group, color_key: fresh[nextFresh++]?.key ?? "" },
      );
    });
    setError(undefined);
  }

  function clearGroupColors() {
    setGroups((current) =>
      current.map((group) => ({ ...group, color_key: "" })),
    );
    setError(undefined);
  }

  function updateStaff(index: number, value: string) {
    setStaffNames((current) =>
      current.map((staffName, staffIndex) =>
        staffIndex === index ? value : staffName,
      ),
    );
  }

  function validate() {
    if (groups.length < 1 || groups.length > maxGroups)
      return `ต้องมี 1–${maxGroups} กลุ่ม`;
    if (duplicateColor || groups.some((group) => !group.color_key)) {
      return "แต่ละกลุ่มต้องใช้สีไม่ซ้ำกัน";
    }
    const trimmedStaff = staffNames.map((name) => name.trim()).filter(Boolean);
    if (trimmedStaff.length === 0) return "กรุณาเพิ่ม Staff อย่างน้อย 1 คน";
    if (
      new Set(trimmedStaff.map((name) => name.toLocaleLowerCase("th"))).size !==
      trimmedStaff.length
    ) {
      return "ชื่อ Staff ต้องไม่ซ้ำกัน";
    }
    return undefined;
  }

  async function save(activate: boolean) {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (
      activate &&
      !window.confirm("ยืนยันเปิด Camp? หลังเปิดแล้ว Staff จะเริ่มให้คะแนนได้")
    ) {
      return;
    }

    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const client = await ensureAnonymousSession();
      const setupResult = await client.rpc("save_draft_setup", {
        p_camp_id: campId,
        p_groups: groups.map((group, index) => ({
          ...group,
          custom_name: group.custom_name.trim(),
          sort_order: index + 1,
        })),
        p_staff_names: staffNames.map((name) => name.trim()).filter(Boolean),
      });
      if (setupResult.error) throw setupResult.error;
      if (isRpcFailure(setupResult.data)) {
        throw new Error(setupResult.data.error.message);
      }

      if (activate) {
        const activation = await client.rpc("activate_camp", {
          p_camp_id: campId,
        });
        if (activation.error) throw activation.error;
        if (isRpcFailure(activation.data)) {
          throw new Error(activation.data.error.message);
        }
        window.localStorage.removeItem(`eqcamp:admin-draft:${campId}`);
      } else {
        setNotice("บันทึก Draft แล้ว");
      }
      await onRefresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "บันทึก Camp ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--eq-border)] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
            ตั้งค่า Camp
          </p>
          <h2 className="mt-1 scroll-mt-4 text-2xl font-bold" ref={stepHeadingRef}>
            ขั้นตอน {step} จาก 4
          </h2>
          <p className="mt-1 text-sm font-bold text-[var(--eq-muted)]">
            {DRAFT_STEP_TITLES[step - 1]}
          </p>
        </div>
        <div className="flex gap-1" aria-label={`ขั้นตอน ${step} จาก 4`}>
          {[1, 2, 3, 4].map((item) => (
            <span
              aria-hidden="true"
              className={`h-2 w-6 rounded-full ${item <= step ? "bg-[var(--eq-brand-deep)]" : "bg-[var(--eq-border)]"}`}
              key={item}
            />
          ))}
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl bg-[var(--eq-canvas-soft)] p-4 sm:p-5">
            <div className="text-center">
              <p className="text-sm font-semibold">จำนวนกลุ่ม</p>
              <label className="mx-auto mt-3 grid max-w-44 gap-1 text-xs font-bold">
                กรอกจำนวนกลุ่ม
                <input
                  aria-describedby="group-count-status"
                  className="min-h-14 rounded-2xl border border-[var(--eq-border-strong)] bg-white px-3 text-center text-3xl font-bold tabular-nums"
                  inputMode="numeric"
                  max={maxGroups}
                  min={1}
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    changeGroupCount(
                      rawValue ? Number.parseInt(rawValue, 10) : 0,
                    );
                  }}
                  pattern="[0-9]*"
                  type="number"
                  value={groups.length || ""}
                />
              </label>
              <p
                aria-live="polite"
                className="mt-2 text-sm font-bold tabular-nums text-[var(--eq-muted)]"
                id="group-count-status"
              >
                {groups.length} กลุ่ม
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-3 font-semibold text-[var(--eq-muted)] disabled:opacity-40"
                disabled={groups.length === 0}
                onClick={() => changeGroupCount(groups.length - 1)}
                type="button"
              >
                − ลดจำนวนกลุ่ม
              </button>
              <button
                className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-3 font-semibold text-white disabled:opacity-40"
                disabled={groups.length >= maxGroups}
                onClick={() => changeGroupCount(groups.length + 1)}
                type="button"
              >
                + เพิ่มกลุ่ม
              </button>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--eq-muted)]">
            ขั้นตอนนี้กำหนดเฉพาะจำนวน 1–{maxGroups} กลุ่ม สีและชื่อจะกำหนดในขั้นตอนถัดไป
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <p
            aria-live="polite"
            className="rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 text-sm font-bold text-[var(--eq-brand-deep)] sm:col-span-2"
          >
            เลือกสีแล้ว {selectedColorCount} จาก {groups.length} กลุ่ม
          </p>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <button
              className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 text-sm font-bold text-white disabled:opacity-40"
              disabled={selectedColorCount === groups.length && !duplicateColor}
              onClick={fillUnusedColors}
              type="button"
            >
              เติมสีที่ยังไม่ใช้ให้อัตโนมัติ
            </button>
            <button
              className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-4 text-sm font-bold text-[var(--eq-ink)] disabled:opacity-40"
              disabled={selectedColorCount === 0}
              onClick={clearGroupColors}
              type="button"
            >
              ล้างสีทั้งหมด
            </button>
          </div>
          {groups.map((group, index) => (
            <fieldset
              className="rounded-2xl bg-[var(--eq-canvas-soft)] px-3 pb-3 pt-1"
              key={index}
            >
              <legend className="px-1 text-sm font-bold">
                กลุ่ม {index + 1}
              </legend>
              <div className="mt-1 grid gap-1 text-xs font-bold">
                <span className="sr-only">สี</span>
                <ColorPickerDialog
                  colors={colors}
                  disabledBy={Object.fromEntries(
                    groups.flatMap((candidate, candidateIndex) =>
                      candidateIndex !== index && candidate.color_key
                        ? [
                            [
                              candidate.color_key,
                              `ใช้โดยกลุ่ม ${candidateIndex + 1}`,
                            ],
                          ]
                        : [],
                    ),
                  )}
                  groupLabel={`กลุ่ม ${index + 1}`}
                  id={`group-color-${index}`}
                  onChange={(colorKey) =>
                    updateGroup(index, { color_key: colorKey })
                  }
                  takenColors={groups.flatMap((candidate, candidateIndex) => {
                    const color = colors.find(
                      (item) => item.key === candidate.color_key,
                    );
                    return candidateIndex !== index && color
                      ? [
                          {
                            key: color.key,
                            hex: color.hex,
                            label: `กลุ่ม ${candidateIndex + 1}`,
                          },
                        ]
                      : [];
                  })}
                  value={group.color_key}
                />
              </div>
              <label
                className="mt-2 grid gap-1 text-xs font-bold"
                htmlFor={`group-name-${index}`}
              >
                <span className="sr-only">ชื่อกลุ่ม (ไม่บังคับ)</span>
                <input
                  className="min-h-11 rounded-xl border border-[var(--eq-border)] bg-white px-3 text-base font-bold"
                  id={`group-name-${index}`}
                  maxLength={80}
                  onChange={(event) =>
                    updateGroup(index, { custom_name: event.target.value })
                  }
                  placeholder="ชื่อกลุ่ม (ไม่บังคับ) เช่น Banana"
                  value={group.custom_name}
                />
              </label>
            </fieldset>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-6 grid gap-3">
          {staffNames.map((staffName, index) => (
            <div className="flex gap-2" key={index}>
              <label
                className="grid flex-1 gap-1 text-xs font-bold"
                htmlFor={`staff-${index}`}
              >
                Staff {index + 1}
                <input
                  className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base font-bold"
                  id={`staff-${index}`}
                  maxLength={80}
                  onChange={(event) => updateStaff(index, event.target.value)}
                  value={staffName}
                />
              </label>
              {staffNames.length > 1 ? (
                <button
                  aria-label={`ลบ Staff ${index + 1}`}
                  className="mt-5 min-h-12 min-w-12 rounded-xl border border-[var(--eq-border)] text-[var(--eq-ink)]"
                  onClick={() =>
                    setStaffNames((current) =>
                      current.filter((_, item) => item !== index),
                    )
                  }
                  type="button"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <button
            className="min-h-12 rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] font-semibold text-[var(--eq-brand-deep)]"
            onClick={() => setStaffNames((current) => [...current, ""])}
            type="button"
          >
            + เพิ่ม Staff
          </button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-6 grid gap-4">
          <section className="rounded-2xl border border-[var(--eq-border)] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">ตรวจความพร้อมก่อนเปิด Camp</p>
                <p className="mt-1 text-xs leading-5 text-[var(--eq-muted)]">
                  รายการที่ยังไม่พร้อมจะบอกขั้นตอนที่ต้องกลับไปแก้
                </p>
              </div>
              <span
                className={`shrink-0 rounded-lg border border-[var(--eq-border)] px-3 py-1 text-xs font-semibold ${
                  setupReady
                    ? "bg-[var(--eq-canvas-soft)] text-[var(--eq-brand-deep)]"
                    : "bg-white text-[var(--eq-orange-dark)]"
                }`}
              >
                {setupReady ? "พร้อมเปิด" : "ยังไม่ครบ"}
              </span>
            </div>
            <ul aria-label="รายการตรวจความพร้อม" className="mt-4 grid gap-2">
              {readinessItems.map((item) => (
                <li
                  className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--eq-canvas-soft)] px-3 py-2"
                  key={item.label}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-bold ${
                      item.ready
                        ? "bg-[var(--eq-canvas-soft)] text-[var(--eq-green-dark)]"
                        : "bg-white text-[var(--eq-orange-dark)]"
                    }`}
                  >
                    {item.ready ? "✓" : "!"}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold">
                    {item.label}
                  </span>
                  <span className="text-xs font-bold text-[var(--eq-muted)]">
                    {item.ready ? "พร้อม" : "ยังไม่พร้อม"}
                  </span>
                  {item.step && item.actionLabel ? (
                    <button
                      className="min-h-11 shrink-0 rounded-xl border border-[var(--eq-border-strong)] bg-white px-3 text-xs font-bold text-[var(--eq-brand-deep)]"
                      onClick={() => {
                        setError(undefined);
                        setStep(item.step!);
                      }}
                      type="button"
                    >
                      {item.actionLabel}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-[var(--eq-canvas-soft)] p-4">
            <p className="text-sm font-bold text-[var(--eq-muted)]">
              ตรวจสอบก่อนเปิด Camp
            </p>
            <p className="mt-2 text-xl font-bold">{groups.length} กลุ่ม</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {groups.map((group) => {
                const color = colors.find(
                  (item) => item.key === group.color_key,
                );
                return (
                  <span
                    className="rounded-full bg-white px-3 py-2 text-sm font-bold"
                    key={group.sort_order}
                  >
                    {group.sort_order}.{" "}
                    {getGroupLabel(color?.name_th ?? "ไม่ระบุ", group.custom_name)}
                  </span>
                );
              })}
            </div>
          </section>
          <section className="rounded-2xl bg-[var(--eq-canvas-soft)] p-4">
            <p className="text-sm font-bold text-[var(--eq-muted)]">Staff</p>
            <p className="mt-2 font-bold">
              {staffNames
                .map((name) => name.trim())
                .filter(Boolean)
                .join(", ") || "ยังไม่มี Staff"}
            </p>
          </section>
          <section className="eq-notice eq-notice-attention p-4 text-sm leading-6 text-[var(--eq-orange-dark)]">
            ค่าเริ่มต้นมีปุ่ม -1,000, -500, +500 และ +1,000 หลังเปิด Camp แล้ว
            Staff จะใช้ลิงก์เฉพาะที่ระบบสร้างให้
          </section>
        </div>
      ) : null}

      {error ? (
        <p
          className="mt-5 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 text-sm font-bold text-[var(--eq-ink)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className="mt-5 rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 text-sm font-bold text-[var(--eq-brand-deep)]"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <div className="eq-sticky-actions sticky bottom-0 z-10 mt-6 grid grid-cols-2 gap-3 border-t border-[var(--eq-border)] bg-white/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {step === 1 ? (
          <Link
            className="grid min-h-12 place-items-center rounded-xl border border-[var(--eq-border)] bg-white px-4 font-semibold"
            href="/admin"
          >
            ยกเลิกการตั้งค่า
          </Link>
        ) : (
          <button
            className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-4 font-semibold disabled:opacity-40"
            disabled={pending}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            type="button"
          >
            ย้อนกลับ
          </button>
        )}
        {step < 4 ? (
          <button
            className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-semibold text-white disabled:opacity-40"
            disabled={
              pending ||
              (step === 1 && groups.length === 0) ||
              (step === 2 && (duplicateColor || missingColor))
            }
            onClick={() => {
              setError(undefined);
              setStep((current) => Math.min(4, current + 1));
            }}
            type="button"
          >
            ต่อไป
          </button>
        ) : (
          <button
            className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-semibold text-white disabled:opacity-45"
            disabled={pending || !setupReady}
            onClick={() => void save(true)}
            type="button"
          >
            {pending ? "กำลังเปิด…" : "บันทึกและเปิด Camp"}
          </button>
        )}
      </div>
      {step === 4 ? (
        <button
          className="mt-3 min-h-12 w-full rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] font-semibold text-[var(--eq-brand-deep)] disabled:opacity-45"
          disabled={pending}
          onClick={() => void save(false)}
          type="button"
        >
          บันทึกเป็น Draft ก่อน
        </button>
      ) : null}
    </section>
  );
}

function ActiveCampDashboard({
  colors = [],
  onRefresh,
  snapshot,
}: {
  colors?: ColorPreset[];
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const ranking = rankGroups(snapshot.groups);
  const [dashboardNotice, setDashboardNotice] = useState<string>();
  const [rankingNotice, setRankingNotice] = useState<string>();
  const [showFullRanking, setShowFullRanking] = useState(false);
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraft>({
    amount: "",
    reason: "",
  });
  const RANKING_PREVIEW = 5;
  const rankingText = createRankingShareText({
    campName: snapshot.camp.name,
    closed: snapshot.camp.status === "closed",
    ranking,
  });

  async function copyRanking() {
    try {
      await copyText(rankingText);
      setRankingNotice("คัดลอกอันดับทั้งหมดแล้ว");
    } catch {
      setRankingNotice(
        "คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความด้านล่างแล้วคัดลอกเอง",
      );
    }
  }
  const shortcuts = [
    { href: "#camp-overview", label: "ภาพรวม" },
    { href: "#camp-ranking", label: "อันดับ" },
    { href: "#camp-scoring", label: "คะแนน" },
    { href: "#camp-groups-people", label: "กลุ่มและคน" },
    { href: "#camp-links", label: "ลิงก์" },
    { href: "#camp-audit", label: "บันทึกตรวจสอบ" },
    ...(snapshot.camp.status === "active"
      ? [{ href: "#camp-close", label: "ปิดค่าย" }]
      : []),
    { href: "#camp-management", label: "จัดการค่าย" },
  ];

  return (
    <div className="grid min-w-0 gap-5">
      <nav
        aria-label="ทางลัดจัดการค่าย"
        className="min-w-0 max-w-full rounded-2xl border border-[var(--eq-border)] bg-white p-2 shadow-sm md:sticky md:top-2 md:z-10"
      >
        <div className="eq-scroll flex min-w-0 max-w-full gap-2 overflow-x-auto">
          {shortcuts.map((shortcut) => (
            <a
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-[var(--eq-canvas-soft)] px-4 text-sm font-bold text-[var(--eq-muted)]"
              href={shortcut.href}
              key={shortcut.href}
            >
              {shortcut.label}
            </a>
          ))}
        </div>
      </nav>

      {snapshot.camp.status === "closed" ? (
        <>
          <p className="rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 font-bold text-[var(--eq-ink)]">
            ค่ายนี้ปิดแล้ว
          </p>
          <ClosedCampSummary ranking={ranking} snapshot={snapshot} />
        </>
      ) : null}

      <section
        className="scroll-mt-24 grid gap-3 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]"
        id="camp-overview"
      >
        <BudgetMetric
          distributed={snapshot.camp.distributed_amount}
          remaining={snapshot.camp.remaining_budget}
          total={snapshot.camp.total_budget}
        />
        <Metric label="รายการคะแนน" value={snapshot.transaction_count} />
      </section>

      <nav className="grid grid-cols-2 gap-3">
        <Link
          className="flex min-h-12 items-center justify-center rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white"
          href={`/camp/${snapshot.camp.id}`}
        >
          ให้คะแนน
        </Link>
        <Link
          className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] px-4 font-bold text-[var(--eq-brand-deep)]"
          href={`/camp/${snapshot.camp.id}/history`}
        >
          ประวัติ
        </Link>
      </nav>

      <section
        aria-labelledby="admin-ranking-title"
        className="rounded-2xl border border-[var(--eq-border)] bg-white p-5 shadow-sm"
        id="camp-ranking"
      >
        <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
          {snapshot.camp.status === "closed"
            ? "ผลสรุปหลังปิดค่าย"
            : "อันดับล่าสุด"}
        </p>
        <h2 className="mt-1 text-2xl font-bold" id="admin-ranking-title">
          อันดับทั้งหมด
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--eq-muted)]">
          Admin เห็นครบ {ranking.length} กลุ่ม ส่วน Top 3, Top 5 หรือ Top 10
          มีผลเฉพาะหน้าสาธารณะ
        </p>
        <p className="mt-3 rounded-xl bg-[var(--eq-canvas-soft)] px-3 py-2 text-sm leading-6 text-[var(--eq-muted)]">
          เรียงจากคะแนนมากไปน้อย หากคะแนนเท่ากัน
          กลุ่มที่ได้คะแนนระดับนั้นก่อนจะอยู่สูงกว่า
          และหากเวลาเท่ากันอีกครั้งจะใช้ลำดับกลุ่มที่ตั้งไว้
          ระบบแสดงลำดับแยกโดยไม่มีอันดับร่วม
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-blue-soft)] px-4 text-sm font-bold text-[var(--eq-brand-deep)]"
            onClick={() => exportRankingCsv(snapshot, ranking)}
            type="button"
          >
            ดาวน์โหลดอันดับ CSV
          </button>
          <button
            className="min-h-11 rounded-xl bg-[var(--eq-brand-deep)] px-4 text-sm font-bold text-white"
            onClick={() => void copyRanking()}
            type="button"
          >
            คัดลอกอันดับทั้งหมด
          </button>
        </div>
        {rankingNotice ? (
          <p
            className="mt-2 text-sm font-bold text-[var(--eq-brand-deep)]"
            role="status"
          >
            {rankingNotice}
          </p>
        ) : null}
        <details className="eq-disclosure mt-3 rounded-xl border border-[var(--eq-border)] bg-white p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-[var(--eq-brand-deep)]">
            ดูข้อความพร้อมคัดลอก
          </summary>
          <textarea
            aria-label="ข้อความอันดับทั้งหมด"
            className="mt-2 min-h-52 w-full resize-y rounded-xl border border-[var(--eq-border)] bg-[var(--eq-canvas-soft)] p-3 text-sm leading-6"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={rankingText}
          />
        </details>
        <div className="mt-4 grid gap-2" role="list">
          {(showFullRanking
            ? ranking
            : ranking.slice(0, RANKING_PREVIEW)
          ).map((group, index) => (
            <MotionRankingItem id={group.id} key={group.id}>
              <div
                aria-label={`อันดับ ${index + 1} ${getGroupDisplayName(group.color_name, group.custom_name)}`}
                className={`eq-ranking-item flex items-center gap-3 rounded-2xl px-4 py-3 ${
                  index === 0
                    ? "bg-[var(--eq-blue-soft)]"
                    : "bg-[var(--eq-canvas-soft)]"
                }`}
                data-rank={index + 1}
                role="listitem"
              >
                <span className="w-7 text-xl font-bold">{index + 1}</span>
                <span
                  aria-hidden="true"
                  className="h-8 w-2 rounded-full eq-swatch"
                  style={{ backgroundColor: group.color_hex }}
                />
                <span className="min-w-0 flex-1 font-bold">
                  {getGroupLabel(group.color_name, group.custom_name)}
                </span>
                <span className="font-bold tabular-nums">
                  {formatScore(group.current_score)}
                </span>
              </div>
            </MotionRankingItem>
          ))}
        </div>
        {ranking.length > RANKING_PREVIEW ? (
          <button
            aria-expanded={showFullRanking}
            className="mt-3 min-h-11 w-full rounded-xl border border-[var(--eq-border-strong)] bg-white px-4 text-sm font-bold text-[var(--eq-brand-deep)]"
            onClick={() => setShowFullRanking((current) => !current)}
            type="button"
          >
            {showFullRanking
              ? "แสดงเฉพาะ 5 อันดับแรก"
              : `ดูอันดับทั้งหมด (${ranking.length} กลุ่ม)`}
          </button>
        ) : null}
      </section>

      <div className="scroll-mt-24 grid gap-5" id="camp-links">
        {snapshot.camp.status === "active" ? (
          <StaffInvitations
            campId={snapshot.camp.id}
            campName={snapshot.camp.name}
            membersVersion={snapshot.members
              .map((member) =>
                [member.id, member.active, member.display_name].join(":"),
              )
              .join("|")}
          />
        ) : null}

        <LeaderboardControl onRefresh={onRefresh} snapshot={snapshot} />
      </div>

      <div className="scroll-mt-24 grid gap-5" id="camp-scoring">
        {dashboardNotice ? (
          <p
            className="rounded-2xl bg-[var(--eq-canvas-soft)] px-4 py-3 font-bold text-[var(--eq-brand-deep)]"
            role="status"
          >
            {dashboardNotice}
          </p>
        ) : null}
        {snapshot.camp.status === "active" ? (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div className="grid content-start gap-4">
              <BudgetSettings
                key={`${snapshot.camp.total_budget}:${snapshot.camp.warning_amount}:${snapshot.camp.warning_percent}`}
                onRefresh={onRefresh}
                snapshot={snapshot}
              />
              <ScoreButtonSettings
                onRefresh={onRefresh}
                onSaved={() => setDashboardNotice("บันทึกปุ่มคะแนนแล้ว")}
                snapshot={snapshot}
              />
            </div>
            <div className="grid content-start gap-4">
              <ActivitySettings
                key={snapshot.activities
                  .map(
                    (activity) =>
                      `${activity.id}:${activity.name}:${activity.active}`,
                  )
                  .join("|")}
                onRefresh={onRefresh}
                snapshot={snapshot}
              />
              <AccessLinkSettings onRefresh={onRefresh} snapshot={snapshot} />
            </div>
          </div>
        ) : null}

        <AdjustmentPanel
          draft={adjustmentDraft}
          onDraftChange={setAdjustmentDraft}
          onRefresh={onRefresh}
          snapshot={snapshot}
        />
      </div>

      {snapshot.camp.status === "active" ? (
        <div
          className="scroll-mt-24 grid items-start gap-4 md:grid-cols-2"
          id="camp-groups-people"
        >
          <div className="grid content-start gap-4">
            <GroupMaintenance
              colors={colors}
              onRefresh={onRefresh}
              snapshot={snapshot}
            />
          </div>
          <div className="grid content-start gap-4">
            <StaffManagement onRefresh={onRefresh} snapshot={snapshot} />
            <AdminManagement onRefresh={onRefresh} snapshot={snapshot} />
          </div>
        </div>
      ) : (
        <span id="camp-groups-people" />
      )}

      <div className="scroll-mt-24" id="camp-audit">
        <AuditLogPanel campId={snapshot.camp.id} />
      </div>

      {snapshot.camp.status === "active" ? (
        <div className="scroll-mt-24" id="camp-close">
          <CloseCampPanel onRefresh={onRefresh} snapshot={snapshot} />
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {snapshot.groups.map((group) => (
          <article className="rounded-2xl bg-white p-4" key={group.id}>
            <span
              aria-hidden="true"
              className="block h-2 w-10 rounded-full eq-swatch"
              style={{ backgroundColor: group.color_hex }}
            />
            <p className="mt-3 text-xs font-bold text-[var(--eq-muted)]">
              {group.color_name}
            </p>
            <h3 className="font-bold">
              {getGroupDisplayName(group.color_name, group.custom_name)}
            </h3>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {formatScore(group.current_score)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function LeaderboardControl({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [pending, setPending] = useState(false);
  const [rangePending, setRangePending] = useState(false);
  const [error, setError] = useState<string>();

  async function setResultLimit(limit: 3 | 5 | 10) {
    if (rangePending || limit === snapshot.camp.public_result_limit) return;

    setRangePending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc(
        "set_public_result_limit",
        { p_camp_id: snapshot.camp.id, p_limit: limit },
      );
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      await onRefresh();
    } catch (rangeError) {
      setError(
        rangeError instanceof Error
          ? rangeError.message
          : "เปลี่ยนช่วงผลสาธารณะไม่สำเร็จ",
      );
    } finally {
      setRangePending(false);
    }
  }

  async function toggle() {
    const visible = !snapshot.camp.leaderboard_visible;
    const confirmed = window.confirm(
      visible
        ? "ยืนยันเปิดอันดับสาธารณะให้ผู้ถือลิงก์เห็นผล?"
        : "ยืนยันซ่อน Leaderboard จากหน้าสาธารณะ?",
    );
    if (!confirmed) return;

    setPending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc(
        "set_leaderboard_visibility",
        { p_camp_id: snapshot.camp.id, p_visible: visible },
      );
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      await onRefresh();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "เปลี่ยน Leaderboard ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--eq-border)] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[var(--eq-brand-deep)]">
            LEADERBOARD
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {snapshot.camp.leaderboard_visible
              ? "เปิดแสดงอันดับ"
              : "ซ่อนอันดับอยู่"}
          </h2>
        </div>
        <button
          aria-pressed={snapshot.camp.leaderboard_visible}
          className={`min-h-12 rounded-xl px-5 font-bold ${
            snapshot.camp.leaderboard_visible
              ? "border border-[var(--eq-border)] bg-white text-[var(--eq-ink)]"
              : "eq-action-primary bg-[var(--eq-brand-deep)] text-white"
          }`}
          disabled={pending}
          onClick={() => void toggle()}
          type="button"
        >
          {pending
            ? "กำลังบันทึก…"
            : snapshot.camp.leaderboard_visible
              ? "ปิด"
              : "เปิด"}
        </button>
      </div>
      <fieldset
        aria-label="ช่วงผลสาธารณะ"
        className="mt-4 rounded-2xl bg-[var(--eq-canvas-soft)] p-3"
      >
        <legend className="px-1 text-sm font-bold">ช่วงผลสาธารณะ</legend>
        <p className="mb-3 mt-1 text-xs leading-5 text-[var(--eq-muted)]">
          จำกัดเฉพาะหน้าสาธารณะ Admin ยังเห็นอันดับครบทุกกลุ่ม
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([3, 5, 10] as const).map((limit) => {
            const selected = snapshot.camp.public_result_limit === limit;
            return (
              <button
                aria-pressed={selected}
                className={`min-h-11 rounded-xl px-2 text-sm font-bold transition active:scale-[0.98] ${
                  selected
                    ? "eq-action-primary bg-[var(--eq-brand-deep)] text-white"
                    : "border border-[var(--eq-border)] bg-white text-[var(--eq-muted)]"
                }`}
                disabled={rangePending}
                key={limit}
                onClick={() => void setResultLimit(limit)}
                type="button"
              >
                Top {limit}
              </button>
            );
          })}
        </div>
      </fieldset>
      {snapshot.camp.public_leaderboard_code ? (
        <p className="mt-3 break-all text-sm font-bold text-[var(--eq-muted)]">
          /leaderboard/{snapshot.camp.public_leaderboard_code}
        </p>
      ) : null}
      {snapshot.camp.leaderboard_visible &&
      snapshot.camp.public_leaderboard_code ? (
        <Link
          className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--eq-brand-deep)]"
          href={`/leaderboard/${snapshot.camp.public_leaderboard_code}`}
        >
          เปิดหน้าสาธารณะ →
        </Link>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-bold text-[var(--eq-ink)]">{error}</p>
      ) : null}
    </section>
  );
}

function BudgetSettings({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [totalBudget, setTotalBudget] = useState(
    String(snapshot.camp.total_budget),
  );
  const [warningAmount, setWarningAmount] = useState(
    snapshot.camp.warning_amount === null
      ? ""
      : String(snapshot.camp.warning_amount),
  );
  const [warningPercent, setWarningPercent] = useState(
    snapshot.camp.warning_percent === null
      ? ""
      : String(snapshot.camp.warning_percent),
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function save() {
    const nextBudget = Number(totalBudget);
    if (nextBudget < snapshot.camp.distributed_amount) {
      setMessage("งบใหม่ต้องไม่น้อยกว่าคะแนนที่แจกแล้ว");
      return;
    }
    if (
      nextBudget !== snapshot.camp.total_budget &&
      !window.confirm(
        `ยืนยันเปลี่ยนงบเป็น ${formatScore(nextBudget)}? แจกแล้ว ${formatScore(snapshot.camp.distributed_amount)}`,
      )
    ) {
      return;
    }

    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("update_camp_budget", {
        p_camp_id: snapshot.camp.id,
        p_reason: reason,
        p_total_budget: nextBudget,
        p_warning_amount: warningAmount === "" ? null : Number(warningAmount),
        p_warning_percent:
          warningPercent === "" ? null : Number(warningPercent),
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      setReason("");
      setMessage("บันทึกงบและการเตือนแล้ว");
      await onRefresh();
    } catch (saveError) {
      setMessage(
        saveError instanceof Error ? saveError.message : "บันทึกงบไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        งบและการเตือน
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-3">
        <NumberField
          id="total-budget"
          label="งบทั้งหมด"
          onChange={setTotalBudget}
          value={totalBudget}
        />
        <NumberField
          allowEmpty
          id="warning-amount"
          label="เตือนเมื่อคงเหลือไม่เกินจำนวน"
          onChange={setWarningAmount}
          value={warningAmount}
        />
        <NumberField
          allowEmpty
          id="warning-percent"
          label="เตือนเมื่อคงเหลือไม่เกินเปอร์เซ็นต์"
          max={100}
          onChange={setWarningPercent}
          value={warningPercent}
        />
        <label className="grid gap-1 text-xs font-bold" htmlFor="budget-reason">
          เหตุผล (ต้องระบุเมื่อเปลี่ยนงบ)
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base"
            id="budget-reason"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
        {message ? (
          <p className="text-sm font-bold text-[var(--eq-muted)]">{message}</p>
        ) : null}
        <button
          className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45"
          disabled={pending}
          onClick={() => void save()}
          type="button"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกงบ"}
        </button>
      </div>
    </details>
  );
}

type EditableActivity = {
  id?: string;
  name: string;
  active: boolean;
  rounds: Array<{ id?: string; label: string; active: boolean }>;
};

function ActivitySettings({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [activities, setActivities] = useState<EditableActivity[]>(
    snapshot.activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      active: activity.active,
      rounds: activity.rounds.map((round) => ({
        id: round.id,
        label: round.label,
        active: round.active,
      })),
    })),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  function updateActivity(index: number, patch: Partial<EditableActivity>) {
    setActivities((current) =>
      current.map((activity, item) =>
        item === index ? { ...activity, ...patch } : activity,
      ),
    );
  }

  async function save() {
    if (activities.some((activity) => !activity.name.trim())) {
      setMessage("กรุณาระบุชื่อกิจกรรมทุกแถว");
      return;
    }
    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("save_activity_configuration", {
        p_activities: activities.map((activity, index) => ({
          ...activity,
          name: activity.name.trim(),
          sort_order: index + 1,
          rounds: activity.rounds.map((round, roundIndex) => ({
            ...round,
            label: round.label.trim(),
            sort_order: roundIndex + 1,
          })),
        })),
        p_camp_id: snapshot.camp.id,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      setMessage("บันทึกกิจกรรมแล้ว");
      await onRefresh();
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "บันทึกกิจกรรมไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        กิจกรรมและรอบ
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-4">
        {activities.map((activity, index) => (
          <fieldset
            className="rounded-2xl bg-[var(--eq-canvas-soft)] p-3"
            key={activity.id ?? index}
          >
            <label
              className="grid gap-1 text-xs font-bold"
              htmlFor={`activity-${index}`}
            >
              กิจกรรม {index + 1}
              <input
                className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base font-bold"
                id={`activity-${index}`}
                onChange={(event) =>
                  updateActivity(index, { name: event.target.value })
                }
                value={activity.name}
              />
            </label>
            <div className="mt-2 grid gap-2">
              {activity.rounds.map((round, roundIndex) => (
                <div className="flex gap-2" key={round.id ?? roundIndex}>
                  <input
                    aria-label={`รอบ ${roundIndex + 1} ของกิจกรรม ${index + 1}`}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--eq-border)] px-3"
                    onChange={(event) =>
                      updateActivity(index, {
                        rounds: activity.rounds.map((item, itemIndex) =>
                          itemIndex === roundIndex
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                    value={round.label}
                  />
                  <button
                    aria-label={`ลบรอบ ${roundIndex + 1}`}
                    className="min-h-11 min-w-11 rounded-xl border border-[var(--eq-border)] text-[var(--eq-ink)]"
                    onClick={() =>
                      updateActivity(index, {
                        rounds: activity.rounds.filter(
                          (_, item) => item !== roundIndex,
                        ),
                      })
                    }
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="min-h-11 rounded-xl border border-[var(--eq-border-strong)] text-sm font-bold text-[var(--eq-brand-deep)]"
                onClick={() =>
                  updateActivity(index, {
                    rounds: [...activity.rounds, { active: true, label: "" }],
                  })
                }
                type="button"
              >
                + เพิ่มรอบ
              </button>
              <button
                className="min-h-11 rounded-xl border border-[var(--eq-border)] text-sm font-bold text-[var(--eq-ink)]"
                onClick={() =>
                  setActivities((current) =>
                    current.filter((_, item) => item !== index),
                  )
                }
                type="button"
              >
                ลบกิจกรรม
              </button>
            </div>
          </fieldset>
        ))}
        <button
          className="min-h-12 rounded-xl border border-[var(--eq-border-strong)] bg-[var(--eq-canvas-soft)] font-bold text-[var(--eq-brand-deep)]"
          onClick={() =>
            setActivities((current) => [
              ...current,
              { active: true, name: "", rounds: [] },
            ])
          }
          type="button"
        >
          + เพิ่มกิจกรรม
        </button>
        {message ? (
          <p className="text-sm font-bold text-[var(--eq-muted)]">{message}</p>
        ) : null}
        <button
          className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45"
          disabled={pending}
          onClick={() => void save()}
          type="button"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกกิจกรรม"}
        </button>
      </div>
    </details>
  );
}

function NumberField({
  allowEmpty = false,
  id,
  label,
  max,
  onChange,
  value,
}: {
  allowEmpty?: boolean;
  id: string;
  label: string;
  max?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold" htmlFor={id}>
      {label}
      <input
        className="min-h-12 rounded-xl border border-[var(--eq-border)] px-3 text-base font-bold"
        id={id}
        inputMode="numeric"
        max={max}
        min={0}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "");
          if (allowEmpty || next !== "") onChange(next);
        }}
        type="number"
        value={value}
      />
    </label>
  );
}

type AdjustmentDraft = {
  amount: string;
  reason: string;
};

function AdjustmentPanel({
  draft,
  onDraftChange,
  onRefresh,
  snapshot,
}: {
  draft: AdjustmentDraft;
  onDraftChange: Dispatch<SetStateAction<AdjustmentDraft>>;
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [groupId, setGroupId] = useState(snapshot.groups[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const group = snapshot.groups.find((item) => item.id === groupId);

  async function adjust() {
    const signedAmount = Number(draft.amount);
    if (!group || !Number.isInteger(signedAmount) || signedAmount === 0) {
      setMessage("กรุณาระบุจำนวนที่ไม่เป็น 0");
      return;
    }
    if (draft.reason.trim().length < 3) {
      setMessage("กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
      return;
    }
    const nextScore = group.current_score + signedAmount;
    const nextRemaining = snapshot.camp.remaining_budget - signedAmount;
    if (
      !window.confirm(
        `ยืนยันการปรับคะแนน ${signedAmount > 0 ? "+" : "-"}${formatScore(Math.abs(signedAmount))} ที่ ${getGroupDisplayName(group.color_name, group.custom_name)}?\nคะแนนใหม่ ${formatScore(nextScore)} · งบคงเหลือ ${formatScore(nextRemaining)}`,
      )
    ) {
      return;
    }

    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("admin_adjust_score", {
        p_adjusts_transaction_id: null,
        p_amount: signedAmount,
        p_camp_id: snapshot.camp.id,
        p_client_action_id: createClientUuid(),
        p_group_id: group.id,
        p_reason: draft.reason.trim(),
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      onDraftChange({ amount: "", reason: "" });
      setMessage("บันทึกการปรับคะแนนแล้ว");
      await onRefresh();
    } catch (adjustError) {
      setMessage(
        adjustError instanceof Error
          ? adjustError.message
          : "ปรับคะแนนไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl border border-[var(--eq-border)] bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        ปรับคะแนนโดย Admin
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-3">
        <label
          className="grid gap-1 text-xs font-bold"
          htmlFor="adjustment-group"
        >
          กลุ่ม
          <select
            className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-3 font-bold"
            id="adjustment-group"
            onChange={(event) => setGroupId(event.target.value)}
            value={groupId}
          >
            {snapshot.groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.color_name} —{" "}
                {getGroupDisplayName(item.color_name, item.custom_name)} (
                {formatScore(item.current_score)})
              </option>
            ))}
          </select>
        </label>
        <label
          className="grid gap-1 text-xs font-bold"
          htmlFor="adjustment-amount"
        >
          จำนวนแบบมีเครื่องหมาย เช่น 500 หรือ -500
          <input
            className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-3 text-lg font-bold"
            id="adjustment-amount"
            inputMode="numeric"
            onChange={(event) => {
              const amount = event.target.value;
              onDraftChange((current) => ({ ...current, amount }));
            }}
            type="number"
            value={draft.amount}
          />
        </label>
        <label
          className="grid gap-1 text-xs font-bold"
          htmlFor="adjustment-reason"
        >
          เหตุผล
          <textarea
            className="min-h-20 rounded-xl border border-[var(--eq-border)] bg-white p-3"
            id="adjustment-reason"
            onChange={(event) => {
              const reason = event.target.value;
              onDraftChange((current) => ({ ...current, reason }));
            }}
            value={draft.reason}
          />
        </label>
        {message ? (
          <p className="text-sm font-semibold text-[var(--eq-muted)]">
            {message}
          </p>
        ) : null}
        <button
          className="eq-action-primary min-h-12 rounded-xl bg-[var(--eq-brand-deep)] px-4 font-semibold text-white disabled:opacity-45"
          disabled={pending}
          onClick={() => void adjust()}
          type="button"
        >
          {pending ? "กำลังบันทึก…" : "ตรวจสอบและบันทึกการปรับคะแนน"}
        </button>
      </div>
    </details>
  );
}

type EditableScoreButton = {
  id?: string;
  direction: ScoreDirection;
  amount: string;
  enabled: boolean;
  requires_confirmation: boolean;
};

type ScoreButtonEditorState = {
  buttons: EditableScoreButton[];
  dirty: boolean;
  serverSignature: string;
};

function editableScoreButtons(snapshot: AdminCampSnapshot) {
  return snapshot.score_buttons.map((button) => ({
    id: button.id,
    direction: button.amount > 0 ? ("add" as const) : ("subtract" as const),
    amount: String(Math.abs(button.amount)),
    enabled: button.enabled,
    requires_confirmation: button.requires_confirmation,
  }));
}

function scoreButtonServerSignature(snapshot: AdminCampSnapshot) {
  return JSON.stringify(
    snapshot.score_buttons.map((button) => [
      button.id,
      button.label,
      button.amount,
      button.enabled,
      button.requires_confirmation,
      button.sort_order,
    ]),
  );
}

function ScoreButtonSettings({
  onRefresh,
  onSaved,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  onSaved: () => void;
  snapshot: AdminCampSnapshot;
}) {
  const serverSignature = scoreButtonServerSignature(snapshot);
  const serverButtons = editableScoreButtons(snapshot);
  const [editor, setEditor] = useState<ScoreButtonEditorState>(() => ({
    buttons: serverButtons,
    dirty: false,
    serverSignature,
  }));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const buttons =
    !editor.dirty && editor.serverSignature !== serverSignature
      ? serverButtons
      : editor.buttons;

  function editButtons(
    transform: (current: EditableScoreButton[]) => EditableScoreButton[],
  ) {
    setEditor((current) => {
      const currentButtons =
        !current.dirty && current.serverSignature !== serverSignature
          ? serverButtons
          : current.buttons;

      return {
        buttons: transform(currentButtons),
        dirty: true,
        serverSignature,
      };
    });
  }

  function update(index: number, patch: Partial<EditableScoreButton>) {
    editButtons((current) =>
      current.map((button, item) =>
        item === index ? { ...button, ...patch } : button,
      ),
    );
  }

  async function save() {
    if (
      buttons.length === 0 ||
      buttons.some(
        (button) =>
          getSignedScoreAmount(button.direction, button.amount) === null,
      )
    ) {
      setMessage(
        `ทุกปุ่มต้องมีจำนวนเต็ม 1–${formatScore(MAX_SCORE_BUTTON_MAGNITUDE)} ระบบจะเติมเครื่องหมายให้อัตโนมัติ`,
      );
      return;
    }
    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("save_score_buttons", {
        p_buttons: buttons.map((button, index) => {
          const amount = getSignedScoreAmount(button.direction, button.amount)!;
          return {
            id: button.id,
            amount,
            enabled: button.enabled,
            label: getAutomaticScoreButtonLabel(
              button.direction,
              button.amount,
            ),
            requires_confirmation: button.requires_confirmation,
            sort_order: index + 1,
          };
        }),
        p_camp_id: snapshot.camp.id,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      setMessage("บันทึกปุ่มคะแนนแล้ว");
      onSaved();
      await onRefresh();
      setEditor((current) => ({ ...current, dirty: false }));
    } catch (saveError) {
      setMessage(
        saveError instanceof Error ? saveError.message : "บันทึกปุ่มไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        ปุ่มคะแนน
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-2">
        <section
          aria-label="ตัวอย่างปุ่มคะแนนหน้า Staff"
          className="rounded-2xl border border-[var(--eq-border)] bg-[var(--eq-canvas-soft)] p-3"
        >
          <p className="text-xs font-bold text-[var(--eq-muted)]">
            ตัวอย่างที่ Staff จะเห็น
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {buttons
              .filter((button) => button.enabled)
              .map((button, index) => {
                const magnitude = Number(button.amount);
                const automaticLabel =
                  getAutomaticScoreButtonLabel(
                    button.direction,
                    button.amount,
                  ) || "ยังไม่ระบุจำนวน";

                return (
                  <div
                    aria-label={`ตัวอย่าง ${button.direction === "add" ? "เพิ่ม" : "ลด"} ${
                      Number.isFinite(magnitude)
                        ? formatScore(Math.abs(magnitude))
                        : index + 1
                    }`}
                    className={`eq-score-action ${scoreActionToneClass(
                      button.direction,
                    )} flex min-h-[4.5rem] items-center justify-center rounded-xl px-3 py-2 font-bold`}
                    key={button.id ?? `preview-${index}`}
                  >
                    <ScoreActionContent
                      direction={button.direction}
                      secondaryText={
                        button.requires_confirmation
                          ? "ยืนยันก่อนบันทึก"
                          : undefined
                      }
                      value={automaticLabel}
                    />
                  </div>
                );
              })}
          </div>
        </section>
        {buttons.map((button, index) => (
          <div
            className="grid gap-3 rounded-2xl bg-[var(--eq-canvas-soft)] p-3"
            key={button.id ?? index}
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <fieldset className="grid gap-1">
                <legend className="text-xs font-bold">
                  ประเภทปุ่ม {index + 1}
                </legend>
                <div
                  className="grid grid-cols-2 gap-2"
                  role="group"
                  aria-label={`ประเภทคะแนนของปุ่ม ${index + 1}`}
                >
                  <button
                    aria-pressed={button.direction === "add"}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--eq-border)] bg-white px-2 text-sm font-bold ${scoreDirectionOptionClass(
                      "add",
                    )}`}
                    onClick={() => update(index, { direction: "add" })}
                    type="button"
                  >
                    <ScoreActionGlyph className="h-6 w-6" direction="add" />
                    เพิ่มคะแนน
                  </button>
                  <button
                    aria-pressed={button.direction === "subtract"}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--eq-border)] bg-white px-2 text-sm font-bold ${scoreDirectionOptionClass(
                      "subtract",
                    )}`}
                    onClick={() => update(index, { direction: "subtract" })}
                    type="button"
                  >
                    <ScoreActionGlyph
                      className="h-6 w-6"
                      direction="subtract"
                    />
                    ลดคะแนน
                  </button>
                </div>
              </fieldset>
              <label className="grid gap-1 text-xs font-bold">
                จำนวนคะแนน (กรอกเฉพาะตัวเลข)
                <div className="flex min-h-11 items-center rounded-xl border border-[var(--eq-border)] bg-white focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--eq-focus)]">
                  <span
                    aria-hidden="true"
                    className={`m-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg font-bold ${
                      button.direction === "add"
                        ? "eq-score-sign-add"
                        : "eq-score-sign-subtract"
                    }`}
                  >
                    {button.direction === "add" ? "+" : "−"}
                  </span>
                  <input
                    aria-label={`จำนวนคะแนนของปุ่ม ${index + 1}`}
                    className="min-h-11 min-w-0 flex-1 border-0 bg-transparent pr-3 text-base font-bold tabular-nums outline-none"
                    inputMode="numeric"
                    onChange={(event) =>
                      update(index, {
                        amount: normalizeScoreMagnitudeInput(
                          event.target.value,
                        ),
                      })
                    }
                    pattern="[0-9,]*"
                    type="text"
                    value={
                      button.amount ? formatScore(Number(button.amount)) : ""
                    }
                  />
                </div>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--eq-border)] bg-white px-3 text-xs font-bold">
                <input
                  aria-label={`เปิดใช้ปุ่ม ${index + 1}`}
                  checked={button.enabled}
                  className="h-5 w-5"
                  onChange={(event) =>
                    update(index, { enabled: event.target.checked })
                  }
                  type="checkbox"
                />
                เปิดใช้
              </label>
              <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-[var(--eq-border)] bg-white px-3 text-xs font-bold sm:flex-none">
                <input
                  aria-label={`ยืนยันก่อนให้คะแนนด้วยปุ่ม ${
                    button.amount
                      ? formatScore(
                          button.direction === "add"
                            ? Number(button.amount)
                            : -Number(button.amount),
                          { showSign: true },
                        )
                      : index + 1
                  }`}
                  checked={button.requires_confirmation}
                  className="h-5 w-5"
                  onChange={(event) =>
                    update(index, {
                      requires_confirmation: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                ยืนยันก่อนให้คะแนน
              </label>
              <button
                aria-label={`ลบปุ่ม ${index + 1}`}
                className="ml-auto min-h-11 min-w-11 rounded-xl border border-[var(--eq-border)] bg-white text-[var(--eq-ink)]"
                onClick={() => {
                  editButtons((current) =>
                    current.filter((_, item) => item !== index),
                  );
                }}
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        <button
          className="min-h-11 rounded-xl border border-[var(--eq-border-strong)] font-bold text-[var(--eq-brand-deep)]"
          onClick={() => {
            editButtons((current) => [
              ...current,
              {
                amount: "",
                direction: "add",
                enabled: true,
                requires_confirmation: false,
              },
            ]);
          }}
          type="button"
        >
          + เพิ่มปุ่ม
        </button>
        {message ? (
          <p className="text-sm font-bold text-[var(--eq-muted)]">{message}</p>
        ) : null}
        <button
          className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45"
          disabled={pending}
          onClick={() => void save()}
          type="button"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกปุ่มคะแนน"}
        </button>
      </div>
    </details>
  );
}

function AccessLinkSettings({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"staff" | "public">();
  const [message, setMessage] = useState<string>();

  async function rotate(surface: "staff" | "public") {
    if (reason.trim().length < 3) {
      setMessage("กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (
      !window.confirm(
        surface === "staff"
          ? "ยืนยันเปลี่ยนลิงก์ Staff? เครื่อง Staff ที่เปิดอยู่จะหมดสิทธิ์"
          : "ยืนยันเปลี่ยนลิงก์อันดับสาธารณะ? ลิงก์เดิมจะใช้ไม่ได้",
      )
    ) {
      return;
    }

    setPending(surface);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("rotate_camp_access_code", {
        p_camp_id: snapshot.camp.id,
        p_reason: reason.trim(),
        p_surface: surface,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      setReason("");
      setMessage("สร้างลิงก์ใหม่และยกเลิกลิงก์เดิมแล้ว");
      await onRefresh();
    } catch (rotateError) {
      setMessage(
        rotateError instanceof Error
          ? rotateError.message
          : "เปลี่ยนลิงก์ไม่สำเร็จ",
      );
    } finally {
      setPending(undefined);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        ลิงก์และการยกเลิกสิทธิ์
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-3">
        <div className="rounded-xl bg-[var(--eq-canvas-soft)] p-3">
          <p className="text-xs font-bold text-[var(--eq-muted)]">
            ลิงก์สาธารณะ
          </p>
          {snapshot.camp.public_leaderboard_code ? (
            <div className="mt-2">
              <CopyShareActions
                campName={snapshot.camp.name}
                label="ลิงก์อันดับสาธารณะ"
                path={`/leaderboard/${snapshot.camp.public_leaderboard_code}`}
              />
            </div>
          ) : null}
        </div>
        <label className="grid gap-1 text-xs font-bold" htmlFor="rotate-reason">
          เหตุผลที่เปลี่ยนลิงก์
          <input
            className="min-h-11 rounded-xl border border-[var(--eq-border)] px-3"
            id="rotate-reason"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="min-h-11 rounded-xl border border-[var(--eq-border)] text-sm font-bold text-[var(--eq-ink)]"
            disabled={Boolean(pending)}
            onClick={() => void rotate("public")}
            type="button"
          >
            {pending === "public" ? "กำลังสร้าง…" : "สร้างลิงก์สาธารณะใหม่"}
          </button>
        </div>
        {message ? (
          <p className="text-sm font-bold text-[var(--eq-muted)]">{message}</p>
        ) : null}
      </div>
    </details>
  );
}

function GroupMaintenance({
  colors,
  onRefresh,
  snapshot,
}: {
  colors: ColorPreset[];
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [notice, setNotice] = useState<string>();

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        ชื่อและสีกลุ่ม
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-3">
        <p className="eq-notice eq-notice-attention px-3 py-2 text-sm font-semibold leading-6 text-[var(--eq-orange-dark)]">
          การแก้ไขมีผลกับหน้าปัจจุบันและรายการใหม่ ประวัติเก่าจะยังใช้ชื่อและสี
          ณ เวลาที่บันทึกรายการ เพื่อให้ตรวจสอบย้อนหลังได้ตรงกับเหตุการณ์จริง
        </p>
        {notice ? (
          <p
            className="rounded-xl bg-[var(--eq-canvas-soft)] px-3 py-2 text-sm font-bold text-[var(--eq-brand-deep)]"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {snapshot.groups.map((group) => (
          <GroupIdentityRow
            colors={colors}
            group={group}
            key={`${group.id}:${group.color_key}:${group.custom_name}`}
            onRefresh={onRefresh}
            onSaved={() =>
              setNotice(
                "บันทึกกลุ่มแล้ว ประวัติเก่ายังคงชื่อและสีเดิม ณ เวลาที่เกิดรายการ",
              )
            }
            snapshot={snapshot}
          />
        ))}
      </div>
    </details>
  );
}

function GroupIdentityRow({
  colors,
  group,
  onRefresh,
  onSaved,
  snapshot,
}: {
  colors: ColorPreset[];
  group: AdminCampSnapshot["groups"][number];
  onRefresh: () => Promise<void>;
  onSaved: () => void;
  snapshot: AdminCampSnapshot;
}) {
  const [name, setName] = useState(group.custom_name);
  const [colorKey, setColorKey] = useState(group.color_key);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const selectedColor = colors.find((color) => color.key === colorKey);

  async function save() {
    setPending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc(
        "update_group_identity",
        {
          p_camp_id: snapshot.camp.id,
          p_color_key: colorKey,
          p_custom_name: name,
          p_group_id: group.id,
        },
      );
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      await onRefresh();
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "แก้กลุ่มไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-2xl bg-[var(--eq-canvas-soft)] p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="grid gap-1 text-xs font-bold">
        <span>
          สีของ {getGroupDisplayName(group.color_name, group.custom_name)}
        </span>
        <ColorPickerDialog
          colors={colors}
          disabledBy={Object.fromEntries(
            snapshot.groups.flatMap((item) =>
              item.id !== group.id
                ? [
                    [
                      item.color_key,
                      `ใช้โดย ${getGroupDisplayName(item.color_name, item.custom_name)}`,
                    ],
                  ]
                : [],
            ),
          )}
          groupLabel={getGroupDisplayName(group.color_name, group.custom_name)}
          id={`active-group-color-${group.id}`}
          onChange={setColorKey}
          takenColors={snapshot.groups
            .filter((item) => item.id !== group.id)
            .map((item) => ({
              key: item.color_key,
              hex: item.color_hex,
              label: getGroupDisplayName(item.color_name, item.custom_name),
            }))}
          value={colorKey}
        />
      </div>
      <label className="grid gap-1 text-xs font-bold">
        ชื่อกลุ่ม (ไม่บังคับ)
        <input
          aria-label={`ชื่อกลุ่มของ ${getGroupDisplayName(group.color_name, group.custom_name)}`}
          className="min-h-11 min-w-0 rounded-xl border border-[var(--eq-border)] bg-white px-3 text-base font-bold"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder={`เว้นว่างเพื่อใช้ “กลุ่มสี${selectedColor?.name_th ?? group.color_name}”`}
          value={name}
        />
      </label>
      <button
        className="min-h-11 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 text-sm font-bold text-white disabled:opacity-45"
        disabled={
          pending ||
          (name === group.custom_name && colorKey === group.color_key)
        }
        onClick={() => void save()}
        type="button"
      >
        บันทึกกลุ่ม
      </button>
      {error ? (
        <p className="text-xs font-bold text-[var(--eq-ink)] sm:col-span-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StaffManagement({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const staff = snapshot.members.filter((member) => member.role === "staff");

  async function add() {
    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("add_staff_member", {
        p_camp_id: snapshot.camp.id,
        p_display_name: name,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      setName("");
      await onRefresh();
    } catch (addError) {
      setMessage(
        addError instanceof Error ? addError.message : "เพิ่ม Staff ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  async function setActive(memberId: string, active: boolean) {
    if (
      !active &&
      !window.confirm("ยืนยันปิดใช้งาน Staff? เครื่องที่เปิดอยู่จะหมดสิทธิ์")
    )
      return;
    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("set_camp_member_active", {
        p_active: active,
        p_camp_id: snapshot.camp.id,
        p_member_id: memberId,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      await onRefresh();
    } catch (statusError) {
      setMessage(
        statusError instanceof Error
          ? statusError.message
          : "เปลี่ยนสถานะ Staff ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        Staff
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-2">
        {staff.map((member) => (
          <div
            className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl bg-[var(--eq-canvas-soft)] px-3 py-2"
            key={member.id}
          >
            <span className="min-w-0 flex-1 font-bold">
              {member.display_name}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--eq-border)] bg-white px-2 py-1 text-[0.68rem] font-bold text-[var(--eq-muted)]">
              <span
                aria-hidden="true"
                className={
                  member.active
                    ? "text-[var(--eq-green-dark)]"
                    : "text-[var(--eq-gray)]"
                }
              >
                {member.active ? "●" : "■"}
              </span>
              {member.active ? "ใช้งานอยู่" : "ปิดใช้งานแล้ว"}
            </span>
            <button
              className={`min-h-11 rounded-lg px-3 text-sm font-bold ${
                member.active
                  ? "text-[var(--eq-ink)]"
                  : "text-[var(--eq-brand-deep)]"
              }`}
              disabled={pending}
              onClick={() => void setActive(member.id, !member.active)}
              type="button"
            >
              {member.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <input
            aria-label="ชื่อ Staff ใหม่"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--eq-border)] px-3"
            onChange={(event) => setName(event.target.value)}
            placeholder="ชื่อ Staff ใหม่"
            value={name}
          />
          <button
            className="min-h-12 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45"
            disabled={pending || !name.trim()}
            onClick={() => void add()}
            type="button"
          >
            เพิ่ม
          </button>
        </div>
        {message ? (
          <p className="text-sm font-bold text-[var(--eq-ink)]">{message}</p>
        ) : null}
      </div>
    </details>
  );
}

function AdminManagement({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [name, setName] = useState("");
  const [temporaryPin, setTemporaryPin] = useState("");
  const [resetTarget, setResetTarget] = useState<{
    adminAccountId: string;
    displayName: string;
  }>();
  const [resetPinValue, setResetPinValue] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const admins = snapshot.members.filter((member) => member.role === "admin");

  async function add() {
    if (!/^\d{4}$/.test(temporaryPin)) {
      setMessage("PIN ชั่วคราวต้องเป็นตัวเลข 4 หลัก");
      return;
    }
    if (!window.confirm(`ยืนยันเพิ่ม Admin ${name.trim()} ด้วย PIN ชั่วคราว?`))
      return;

    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("add_admin_to_camp", {
        p_camp_id: snapshot.camp.id,
        p_display_name: name.trim(),
        p_temporary_pin: temporaryPin,
      });
      setTemporaryPin("");
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      setName("");
      await onRefresh();
    } catch (addError) {
      setMessage(
        addError instanceof Error ? addError.message : "เพิ่ม Admin ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  async function setActive(memberId: string, active: boolean) {
    if (!active && !window.confirm("ยืนยันปิดใช้งาน Admin?")) return;
    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("set_camp_member_active", {
        p_active: active,
        p_camp_id: snapshot.camp.id,
        p_member_id: memberId,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      await onRefresh();
    } catch (statusError) {
      setMessage(
        statusError instanceof Error
          ? statusError.message
          : "เปลี่ยนสถานะ Admin ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  function startResetPin(adminAccountId: string, displayName: string) {
    setResetTarget({ adminAccountId, displayName });
    setResetPinValue("");
    setResetReason("");
    setMessage(undefined);
  }

  function cancelResetPin() {
    setResetTarget(undefined);
    setResetPinValue("");
    setResetReason("");
  }

  async function resetPin() {
    if (!resetTarget) return;
    if (!/^\d{4}$/.test(resetPinValue)) {
      setMessage("PIN ชั่วคราวต้องเป็นตัวเลข 4 หลัก");
      return;
    }
    const reason = resetReason.trim();
    if (!reason || reason.length < 3) {
      setMessage("กรุณาระบุเหตุผลการรีเซ็ต PIN");
      return;
    }
    if (
      !window.confirm(
        `ยืนยันรีเซ็ต PIN ของ ${resetTarget.displayName} และยกเลิก session เดิม?`,
      )
    ) {
      return;
    }

    setPending(true);
    setMessage(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error } = await client.rpc("reset_admin_pin", {
        p_admin_account_id: resetTarget.adminAccountId,
        p_camp_id: snapshot.camp.id,
        p_reason: reason,
        p_temporary_pin: resetPinValue,
      });
      if (error) throw error;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      cancelResetPin();
      setMessage(
        "รีเซ็ต PIN แล้ว Admin ต้องเปลี่ยน PIN เมื่อเข้าสู่ระบบครั้งถัดไป",
      );
    } catch (resetError) {
      setMessage(
        resetError instanceof Error
          ? resetError.message
          : "รีเซ็ต PIN ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        Admin
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-2">
        {admins.map((member) => (
          <div
            className="rounded-xl bg-[var(--eq-canvas-soft)] p-3"
            key={member.id}
          >
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 font-bold">
                {member.display_name}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--eq-border)] bg-white px-2 py-1 text-[0.68rem] font-bold text-[var(--eq-muted)]">
                <span
                  aria-hidden="true"
                  className={
                    member.active
                      ? "text-[var(--eq-green-dark)]"
                      : "text-[var(--eq-gray)]"
                  }
                >
                  {member.active ? "●" : "■"}
                </span>
                {member.active ? "ใช้งานอยู่" : "ปิดใช้งานแล้ว"}
              </span>
              {member.admin_account_id ? (
                <button
                  className="min-h-11 px-2 text-xs font-bold text-[var(--eq-orange-dark)]"
                  disabled={pending}
                  onClick={() =>
                    startResetPin(member.admin_account_id!, member.display_name)
                  }
                  type="button"
                >
                  รีเซ็ต PIN
                </button>
              ) : null}
              <button
                className={`min-h-11 px-2 text-xs font-bold ${member.active ? "text-[var(--eq-ink)]" : "text-[var(--eq-brand-deep)]"}`}
                disabled={pending}
                onClick={() => void setActive(member.id, !member.active)}
                type="button"
              >
                {member.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
            </div>
            {resetTarget?.adminAccountId === member.admin_account_id ? (
              <div className="mt-3 grid gap-3 rounded-xl border border-[var(--eq-border)] bg-white p-3">
                <p className="text-sm font-bold">
                  ตั้ง PIN ชั่วคราวใหม่ให้ {resetTarget.displayName}
                </p>
                <label className="grid gap-1 text-sm font-bold">
                  PIN ชั่วคราวใหม่ 4 หลัก
                  <input
                    autoComplete="new-password"
                    className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-3 text-center text-xl font-bold tracking-[0.25em]"
                    inputMode="numeric"
                    maxLength={ADMIN_PIN_LENGTH}
                    onChange={(event) =>
                      setResetPinValue(event.target.value.replace(/\D/g, ""))
                    }
                    pattern="[0-9]{4}"
                    required
                    type="password"
                    value={resetPinValue}
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  เหตุผลการรีเซ็ต
                  <input
                    className="min-h-12 rounded-xl border border-[var(--eq-border)] bg-white px-3"
                    minLength={3}
                    onChange={(event) => setResetReason(event.target.value)}
                    placeholder="เช่น Admin ลืม PIN"
                    required
                    value={resetReason}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="min-h-11 rounded-xl border border-[var(--eq-border)] bg-white font-bold"
                    disabled={pending}
                    onClick={cancelResetPin}
                    type="button"
                  >
                    ยกเลิก
                  </button>
                  <button
                    className="min-h-11 rounded-xl bg-[var(--eq-ink)] px-3 font-semibold text-white disabled:opacity-45"
                    disabled={
                      pending ||
                      resetPinValue.length !== ADMIN_PIN_LENGTH ||
                      resetReason.trim().length < 3
                    }
                    onClick={() => void resetPin()}
                    type="button"
                  >
                    {pending ? "กำลังบันทึก…" : "ยืนยันรีเซ็ต"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        <input
          aria-label="ชื่อ Admin ใหม่"
          className="min-h-11 rounded-xl border border-[var(--eq-border)] px-3"
          onChange={(event) => setName(event.target.value)}
          placeholder="ชื่อ Admin ใหม่"
          value={name}
        />
        <input
          aria-label="PIN ชั่วคราวของ Admin ใหม่"
          autoComplete="new-password"
          className="min-h-11 rounded-xl border border-[var(--eq-border)] px-3 text-center font-bold tracking-[0.25em]"
          inputMode="numeric"
          maxLength={ADMIN_PIN_LENGTH}
          onChange={(event) =>
            setTemporaryPin(event.target.value.replace(/\D/g, ""))
          }
          pattern="[0-9]{4}"
          placeholder="PIN ชั่วคราว 4 หลัก"
          type="password"
          value={temporaryPin}
        />
        <button
          className="min-h-11 rounded-xl eq-action-primary bg-[var(--eq-brand-deep)] px-4 font-bold text-white disabled:opacity-45"
          disabled={
            pending || !name.trim() || temporaryPin.length !== ADMIN_PIN_LENGTH
          }
          onClick={() => void add()}
          type="button"
        >
          เพิ่ม Admin
        </button>
        {message ? (
          <p className="text-sm font-bold text-[var(--eq-muted)]">{message}</p>
        ) : null}
      </div>
    </details>
  );
}

type AuditItem = {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  before_data: unknown;
  after_data: unknown;
  reason: string | null;
  created_at: string;
};

function AuditLogPanel({ campId }: { campId: string }) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<{
    created_at: string;
    id: string;
  } | null>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (
      nextCursor?: { created_at: string; id: string } | null,
      append = false,
    ) => {
      setPending(true);
      setError(undefined);
      try {
        const client = await ensureAnonymousSession();
        const { data, error: rpcError } = await client.rpc("get_audit_log", {
          p_before_created_at: nextCursor?.created_at ?? null,
          p_before_id: nextCursor?.id ?? null,
          p_camp_id: campId,
          p_limit: 50,
        });
        if (rpcError) throw rpcError;
        if (isRpcFailure(data)) throw new Error(data.error.message);
        const result = data as {
          items: AuditItem[];
          next_cursor: { created_at: string; id: string } | null;
        };
        setItems((current) =>
          append ? [...current, ...result.items] : result.items,
        );
        setCursor(result.next_cursor);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "โหลด Audit ไม่สำเร็จ",
        );
      } finally {
        setPending(false);
      }
    },
    [campId],
  );

  useEffect(() => {
    async function loadInitial() {
      await load(null, false);
    }
    void loadInitial();
  }, [load]);

  return (
    <details className="eq-disclosure rounded-2xl bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold">
        บันทึกตรวจสอบ
      </summary>
      <div className="eq-disclosure-body mt-4 grid gap-2">
        {items.map((item) => (
          <details
            className="eq-disclosure rounded-xl bg-[var(--eq-canvas-soft)] p-3"
            key={item.id}
          >
            <summary className="cursor-pointer font-bold">
              {auditActionLabel(item.action)} · {item.actor_name}
              <span className="block text-xs font-medium text-[var(--eq-muted)]">
                {formatBangkokTimestamp(item.created_at)}
              </span>
            </summary>
            <p className="mt-2 text-xs font-bold">
              {auditEntityLabel(item.entity_type)}
            </p>
            {item.reason ? (
              <p className="mt-1 text-sm">เหตุผล: {item.reason}</p>
            ) : null}
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-[var(--eq-muted)]">
              {JSON.stringify(
                { before: item.before_data, after: item.after_data },
                null,
                2,
              )}
            </pre>
          </details>
        ))}
        {error ? (
          <p className="text-sm font-bold text-[var(--eq-ink)]">{error}</p>
        ) : null}
        {cursor ? (
          <button
            className="min-h-11 rounded-xl border border-[var(--eq-border-strong)] font-bold text-[var(--eq-brand-deep)]"
            disabled={pending}
            onClick={() => void load(cursor, true)}
            type="button"
          >
            โหลด Audit เพิ่ม
          </button>
        ) : null}
      </div>
    </details>
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    access_sessions_revoked: "ยกเลิกสิทธิ์การใช้งานเดิม",
    admin_added: "เพิ่ม Admin",
    admin_login_locked: "ล็อกบัญชี Admin ชั่วคราว",
    admin_login_success: "Admin เข้าสู่ระบบ",
    admin_logout: "Admin ออกจากระบบ",
    admin_pin_changed: "เปลี่ยน PIN Admin",
    admin_pin_reset: "รีเซ็ต PIN Admin",
    budget_changed: "แก้ไขงบและการเตือน",
    camp_access_code_rotated: "เปลี่ยนลิงก์เข้าใช้งาน",
    camp_activated: "เปิดใช้งานค่าย",
    camp_closed: "ปิดค่าย",
    camp_created: "สร้างค่าย",
    camp_details_changed: "แก้ไขรายละเอียดค่าย",
    camp_member_status_changed: "เปลี่ยนสถานะสมาชิกค่าย",
    draft_setup_saved: "บันทึกการตั้งค่าค่ายฉบับร่าง",
    group_identity_changed: "แก้ไขชื่อหรือสีกลุ่ม",
    leaderboard_visibility_changed: "เปลี่ยนการแสดงอันดับสาธารณะ",
    score_adjusted: "ปรับคะแนนโดย Admin",
    score_buttons_changed: "แก้ไขปุ่มคะแนน",
    staff_added: "เพิ่ม Staff",
    staff_group_name_changed: "Staff แก้ไขชื่อกลุ่ม",
  };

  return labels[action] ?? action;
}

function auditEntityLabel(entityType: string) {
  const labels: Record<string, string> = {
    access_session: "สิทธิ์การใช้งาน",
    admin_account: "บัญชี Admin",
    camp: "ค่าย",
    camp_member: "สมาชิกค่าย",
    group: "กลุ่ม",
    transaction: "รายการคะแนน",
  };

  return labels[entityType] ?? entityType;
}

function CloseCampPanel({
  onRefresh,
  snapshot,
}: {
  onRefresh: () => Promise<void>;
  snapshot: AdminCampSnapshot;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const ranking = rankGroups(snapshot.groups);
  const leader = ranking[0];

  async function close() {
    if (reason.trim().length < 3) {
      setError("กรุณาระบุเหตุผลการปิดค่าย");
      return;
    }
    if (!window.confirm("ยืนยันปิด Camp ถาวร? V1 ไม่สามารถเปิดกลับได้")) return;

    setPending(true);
    setError(undefined);
    try {
      const client = await ensureAnonymousSession();
      const { data, error: rpcError } = await client.rpc("close_camp", {
        p_camp_id: snapshot.camp.id,
        p_reason: reason.trim(),
      });
      if (rpcError) throw rpcError;
      if (isRpcFailure(data)) throw new Error(data.error.message);
      await onRefresh();
    } catch (closeError) {
      setError(
        closeError instanceof Error ? closeError.message : "ปิด Camp ไม่สำเร็จ",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="eq-disclosure rounded-2xl border border-[var(--eq-border)] bg-[var(--eq-canvas-soft)] p-5">
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-bold text-[var(--eq-ink)]">
        ปิด Camp
      </summary>
      <p className="mt-3 text-sm leading-6 text-[var(--eq-muted)]">
        การปิดค่ายเป็นขั้นตอนถาวรในระบบรุ่นนี้
        โปรดตรวจผลและผลกระทบด้านล่างก่อนยืนยัน
      </p>
      <ul className="mt-3 grid gap-1.5 pl-5 text-sm leading-6 text-[var(--eq-muted)] marker:text-[var(--eq-ink)]">
        <li>ปุ่มให้คะแนนและการตั้งค่าค่ายจะถูกล็อกทันที</li>
        <li>สิทธิ์ Staff ที่เปิดอยู่จะหมดอายุและไม่สามารถให้คะแนนเพิ่มได้</li>
        <li>ประวัติและอันดับจะถูกเก็บไว้ตรวจสอบย้อนหลัง</li>
        <li>Admin ยังปรับคะแนนพร้อมเหตุผลได้ โดยระบบบันทึกเป็นรายการใหม่</li>
        <li>ค่ายที่ปิดแล้วไม่สามารถเปิดกลับได้ในระบบรุ่นนี้</li>
      </ul>
      <section
        aria-label="ตัวอย่างสรุปก่อนปิดค่าย"
        className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--eq-border)] bg-white p-3 text-sm"
      >
        <p className="col-span-2 font-bold text-[var(--eq-ink)]">
          ตรวจสอบสรุปก่อนปิดค่าย
        </p>
        <SummaryFact
          label="อันดับนำ"
          value={
            leader
              ? `${leader.color_name} — ${getGroupDisplayName(
                  leader.color_name,
                  leader.custom_name,
                )}`
              : "ยังไม่มีกลุ่ม"
          }
        />
        <SummaryFact
          label="คะแนนนำ"
          value={formatScore(leader?.current_score ?? 0)}
        />
        <SummaryFact label="จำนวนกลุ่ม" value={`${ranking.length} กลุ่ม`} />
        <SummaryFact
          label="จำนวนรายการ"
          value={`${snapshot.transaction_count} รายการ`}
        />
        <SummaryFact
          label="การแสดงผลสาธารณะ"
          value={`${
            snapshot.camp.leaderboard_visible ? "เปิดอยู่" : "ปิดอยู่"
          } · Top ${snapshot.camp.public_result_limit}`}
        />
        <SummaryFact
          label="งบแจกแล้ว"
          value={formatScore(snapshot.camp.distributed_amount)}
        />
      </section>
      <label
        className="mt-3 grid gap-1 text-xs font-bold"
        htmlFor="close-reason"
      >
        เหตุผล
        <textarea
          className="min-h-20 rounded-xl border border-[var(--eq-border)] bg-white p-3"
          id="close-reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </label>
      {error ? (
        <p className="mt-2 text-sm font-bold text-[var(--eq-ink)]">{error}</p>
      ) : null}
      <button
        className="mt-3 min-h-12 w-full rounded-xl bg-[var(--eq-ink)] px-4 font-bold text-white disabled:opacity-45"
        disabled={pending}
        onClick={() => void close()}
        type="button"
      >
        {pending ? "กำลังปิด…" : "ตรวจสอบและปิด Camp"}
      </button>
    </details>
  );
}

type RankedAdminGroup = AdminCampSnapshot["groups"][number] & {
  rank: number;
};

function ClosedCampSummary({
  ranking,
  snapshot,
}: {
  ranking: RankedAdminGroup[];
  snapshot: AdminCampSnapshot;
}) {
  const winner = ranking[0];

  return (
    <section
      aria-label="สรุปค่ายที่ปิดแล้ว"
      className="eq-closed-winner rounded-2xl border border-[var(--eq-border)] bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-semibold text-[var(--eq-brand-deep)]">
        ผลสรุปค่าย
      </p>
      <h2 className="mt-1 text-2xl font-bold">ผู้ชนะ</h2>
      <p className="mt-2 text-lg font-bold text-[var(--eq-brand-deep)]">
        {winner
          ? `${winner.color_name} — ${getGroupDisplayName(
              winner.color_name,
              winner.custom_name,
            )}`
          : "ยังไม่มีกลุ่ม"}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums">
        {formatScore(winner?.current_score ?? 0)} คะแนน
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <SummaryFact label="กลุ่มทั้งหมด" value={`${ranking.length} กลุ่ม`} />
        <SummaryFact
          label="รายการคะแนน"
          value={`${snapshot.transaction_count} รายการ`}
        />
        <SummaryFact
          label="งบแจกแล้ว"
          value={formatScore(snapshot.camp.distributed_amount)}
        />
        <SummaryFact
          label="ปิดเมื่อ"
          value={
            snapshot.camp.closed_at
              ? formatBangkokTimestamp(snapshot.camp.closed_at)
              : "—"
          }
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--eq-muted)]">
        รายการด้านล่างคืออันดับครบทุกกลุ่ม ส่วนหน้าสาธารณะใช้ช่วง Top{" "}
        {snapshot.camp.public_result_limit} ตามค่าที่ตั้งไว้
      </p>
    </section>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--eq-canvas-soft)] px-3 py-2">
      <p className="text-xs font-bold text-[var(--eq-muted)]">{label}</p>
      <p className="mt-0.5 break-words font-bold text-[var(--eq-muted)]">
        {value}
      </p>
    </div>
  );
}

function exportRankingCsv(
  snapshot: AdminCampSnapshot,
  ranking: RankedAdminGroup[],
) {
  downloadCsv(
    `eqcamp-ranking-${snapshot.camp.name}-${snapshot.camp.camp_date}`,
    [
      [
        "อันดับ",
        "สี",
        "ชื่อกลุ่ม",
        "คะแนน",
        "เวลาที่ได้คะแนนระดับปัจจุบัน",
        "ลำดับกลุ่มที่ตั้งไว้",
      ],
      ...ranking.map((group) => [
        group.rank,
        group.color_name,
        getGroupDisplayName(group.color_name, group.custom_name),
        group.current_score,
        group.score_reached_at
          ? formatBangkokTimestamp(group.score_reached_at)
          : "",
        group.sort_order,
      ]),
    ],
  );
}

function formatBangkokTimestamp(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function BudgetMetric({
  distributed,
  remaining,
  total,
}: {
  distributed: number;
  remaining: number;
  total: number;
}) {
  const distributedPercent =
    total > 0 ? Math.min(100, Math.round((distributed / total) * 100)) : 0;

  return (
    <section className="rounded-2xl border border-[var(--eq-border)] bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xs font-semibold text-[var(--eq-muted)]">งบค่าย</p>
        <p className="tnum text-2xl font-bold">{formatScore(total)}</p>
      </div>
      <div
        aria-hidden="true"
        className="mt-3 flex h-2.5 overflow-hidden rounded-full border border-[var(--eq-border)]"
      >
        <span
          className="bg-[var(--eq-brand-deep)]"
          style={{ width: `${distributedPercent}%` }}
        />
        <span className="flex-1 bg-[var(--eq-blue-soft)]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <p className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-sm bg-[var(--eq-brand-deep)]"
          />
          <span className="font-semibold text-[var(--eq-muted)]">แจกแล้ว</span>
          <span className="tnum font-bold">{formatScore(distributed)}</span>
        </p>
        <p className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-sm border border-[var(--eq-border-strong)] bg-[var(--eq-blue-soft)]"
          />
          <span className="font-semibold text-[var(--eq-muted)]">คงเหลือ</span>
          <span className="tnum font-bold">{formatScore(remaining)}</span>
        </p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-2xl border border-[var(--eq-border)] bg-white p-4">
      <p className="text-xs font-semibold text-[var(--eq-muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {formatScore(value)}
      </p>
    </section>
  );
}
