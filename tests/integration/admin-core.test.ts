import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  waitUntilAccessTokenIsCurrent,
  waitUntilPostgrestAcceptsSession,
} from "@/lib/supabase/jwt-timing";

const DEMO_ADMIN_ID = "60000000-0000-4000-8000-000000000001";

function localCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Local Supabase credentials were not supplied to integration tests",
    );
  }

  return { key, url };
}

async function anonymousClient() {
  const { key, url } = localCredentials();
  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `eqcamp-admin-integration-${crypto.randomUUID()}`,
    },
  });
  const { data, error } = await client.auth.signInAnonymously();
  expect(error).toBeNull();
  if (data.session) {
    await waitUntilAccessTokenIsCurrent(data.session.access_token);
  }
  await waitUntilPostgrestAcceptsSession(client);
  return client;
}

async function login(client: SupabaseClient, pin: string) {
  const { data, error } = await client.rpc("login_admin", {
    p_admin_account_id: DEMO_ADMIN_ID,
    p_pin: pin,
  });
  expect(error).toBeNull();
  return data as {
    ok: boolean;
    admin?: { id: string; display_name: string; must_change_pin: boolean };
    error?: { code: string; message: string };
    expires_at?: string;
  };
}

describe
  .runIf(process.env.EQCAMP_INTEGRATION === "1")
  .sequential("secure Admin and Camp setup RPCs", () => {
    let configuredCampId = "";

    it("lists only safe Admin login fields and blocks table reads", async () => {
      const client = await anonymousClient();

      const forbiddenBootstrap = await client.rpc("bootstrap_first_admin", {
        p_display_name: "Browser Admin",
        p_temporary_pin: "9999",
      });
      expect(forbiddenBootstrap.data).toBeNull();
      expect(forbiddenBootstrap.error?.code).toBe("42501");

      const { data, error } = await client.rpc("get_admin_login_options");
      expect(error).toBeNull();
      expect(data).toEqual({
        admins: [{ id: DEMO_ADMIN_ID, display_name: "Admin Demo" }],
      });

      const directRead = await client.from("admin_accounts").select("*");
      expect(directRead.error).toMatchObject({ code: "42501" });
      expect(directRead.data).toBeNull();
    });

    it("returns a generic error for a wrong PIN without creating access", async () => {
      const client = await anonymousClient();
      expect(await login(client, "0000")).toMatchObject({
        ok: false,
        error: { code: "INVALID_CREDENTIALS" },
      });

      const { data, error } = await client.rpc("get_admin_camps");
      expect(error).toBeNull();
      expect(data).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });
    });

    it("accepts a four-digit Admin PIN and rejects the legacy six-digit PIN", async () => {
      const client = await anonymousClient();

      expect(await login(client, "123456")).toMatchObject({
        ok: false,
        error: { code: "INVALID_CREDENTIALS" },
      });
      expect(await login(client, "1234")).toMatchObject({
        ok: true,
        admin: { id: DEMO_ADMIN_ID, must_change_pin: true },
      });
    });

    it("creates a 12-hour session and requires a temporary PIN change", async () => {
      const client = await anonymousClient();
      const result = await login(client, "1234");
      expect(result).toMatchObject({
        ok: true,
        admin: {
          id: DEMO_ADMIN_ID,
          display_name: "Admin Demo",
          must_change_pin: true,
        },
      });

      const expiresAt = Date.parse(result.expires_at ?? "");
      expect(expiresAt).toBeGreaterThan(Date.now() + 11.9 * 60 * 60 * 1000);
      expect(expiresAt).toBeLessThan(Date.now() + 12.1 * 60 * 60 * 1000);

      const blocked = await client.rpc("get_admin_camps");
      expect(blocked.error).toBeNull();
      expect(blocked.data).toMatchObject({
        ok: false,
        error: { code: "PIN_CHANGE_REQUIRED" },
      });

      const changed = await client.rpc("change_admin_pin", {
        p_current_pin: "1234",
        p_new_pin: "6543",
      });
      expect(changed.error).toBeNull();
      expect(changed.data).toMatchObject({
        ok: true,
        admin: { must_change_pin: false },
      });

      const camps = await client.rpc("get_admin_camps");
      expect(camps.error).toBeNull();
      expect(camps.data).toMatchObject({ ok: true });
      expect(camps.data.camps).toHaveLength(2);
      expect(
        camps.data.camps.find(
          (camp: { id: string }) =>
            camp.id === "10000000-0000-4000-8000-000000000001",
        ),
      ).toMatchObject({
        total_budget: 100_000,
        distributed_amount: expect.any(Number),
        remaining_budget: expect.any(Number),
      });
    });

    it("creates, configures, activates, and reopens an isolated Camp", async () => {
      const client = await anonymousClient();
      expect(await login(client, "6543")).toMatchObject({ ok: true });

      const created = await client.rpc("create_draft_camp", {
        p_camp_date: "2026-08-23",
        p_location_name: "โรงเรียนทดสอบ",
        p_name: "ค่ายทดสอบ Admin",
        p_total_budget: 50_000,
      });
      expect(created.error).toBeNull();
      expect(created.data).toMatchObject({
        ok: true,
        camp: {
          name: "ค่ายทดสอบ Admin",
          status: "draft",
          total_budget: 50_000,
          leaderboard_visible: false,
        },
      });
      expect(created.data.camp.code).toMatch(/^[A-Z2-9-]{8,24}$/);
      const campId = created.data.camp.id as string;
      configuredCampId = campId;

      const campSummaries = await client.rpc("get_admin_camps");
      expect(campSummaries.error).toBeNull();
      expect(
        campSummaries.data.camps.find(
          (camp: { id: string }) => camp.id === campId,
        ),
      ).toMatchObject({
        total_budget: 50_000,
        distributed_amount: 0,
        remaining_budget: 50_000,
      });

      const groups = [
        ["yellow", "Banana"],
        ["blue", "Shark"],
        ["red", "Dragon"],
        ["green", "Forest"],
        ["purple", "Grape"],
        ["orange", "Orange"],
        ["sky", "Sky"],
        ["pink", "Pinky"],
      ].map(([color_key, custom_name], index) => ({
        color_key,
        custom_name,
        sort_order: index + 1,
      }));

      const configured = await client.rpc("save_draft_setup", {
        p_camp_id: campId,
        p_groups: groups,
        p_staff_names: ["Staff One", "Staff Two"],
      });
      expect(configured.error).toBeNull();
      expect(configured.data).toMatchObject({
        ok: true,
        group_count: 8,
        staff_count: 2,
      });

      const activated = await client.rpc("activate_camp", {
        p_camp_id: campId,
      });
      expect(activated.error).toBeNull();
      expect(activated.data).toMatchObject({
        ok: true,
        camp: { id: campId, status: "active" },
      });
      expect(activated.data.camp.staff_join_code).toMatch(/^[A-Z2-9-]{12,}$/);
      expect(activated.data.camp.public_leaderboard_code).toMatch(
        /^[A-Z2-9-]{12,}$/,
      );

      const snapshot = await client.rpc("get_admin_camp_snapshot", {
        p_camp_id: campId,
      });
      expect(snapshot.error).toBeNull();
      expect(snapshot.data.camp).toMatchObject({
        id: campId,
        status: "active",
      });
      expect(snapshot.data.groups).toHaveLength(8);
      expect(
        snapshot.data.members.filter(
          (member: { role: string }) => member.role === "staff",
        ),
      ).toHaveLength(2);
      expect(snapshot.data.score_buttons).toHaveLength(4);
      expect(
        snapshot.data.score_buttons.every(
          (button: { requires_confirmation?: boolean }) =>
            button.requires_confirmation === false,
        ),
      ).toBe(true);

      const outsider = await anonymousClient();
      const denied = await outsider.rpc("get_admin_camp_snapshot", {
        p_camp_id: campId,
      });
      expect(denied.error).toBeNull();
      expect(denied.data).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });
    });

    it("accepts 1–20 manually supplied Groups and allows activation before a Group Name is chosen", async () => {
      const client = await anonymousClient();
      expect(await login(client, "6543")).toMatchObject({ ok: true });

      const created = await client.rpc("create_draft_camp", {
        p_camp_date: "2026-08-24",
        p_location_name: "",
        p_name: "Flexible Groups Camp",
        p_total_budget: 10_000,
      });
      expect(created.error).toBeNull();
      const campId = created.data.camp.id as string;

      const empty = await client.rpc("save_draft_setup", {
        p_camp_id: campId,
        p_groups: [],
        p_staff_names: ["Flexible Staff"],
      });
      expect(empty.error).toBeNull();
      expect(empty.data).toMatchObject({
        ok: false,
        error: { code: "INVALID_GROUP_COUNT" },
      });

      const tooMany = await client.rpc("save_draft_setup", {
        p_camp_id: campId,
        p_groups: Array.from({ length: 21 }, (_, index) => ({
          color_key: "yellow",
          custom_name: "",
          sort_order: index + 1,
        })),
        p_staff_names: ["Flexible Staff"],
      });
      expect(tooMany.error).toBeNull();
      expect(tooMany.data).toMatchObject({
        ok: false,
        error: { code: "INVALID_GROUP_COUNT" },
      });

      const configured = await client.rpc("save_draft_setup", {
        p_camp_id: campId,
        p_groups: [{ color_key: "yellow", custom_name: "", sort_order: 1 }],
        p_staff_names: ["Flexible Staff"],
      });
      expect(configured.error).toBeNull();
      expect(configured.data).toMatchObject({ ok: true, group_count: 1 });

      const activated = await client.rpc("activate_camp", {
        p_camp_id: campId,
      });
      expect(activated.error).toBeNull();
      expect(activated.data).toMatchObject({
        ok: true,
        camp: { id: campId, status: "active" },
      });
    });

    it("configures Activities, Budget warnings, and public Leaderboard reveal", async () => {
      const client = await anonymousClient();
      expect(await login(client, "6543")).toMatchObject({ ok: true });

      const activities = await client.rpc("save_activity_configuration", {
        p_activities: [
          {
            name: "ฐานพลังทีม",
            active: true,
            sort_order: 1,
            rounds: [
              { label: "รอบ 1", active: true, sort_order: 1 },
              { label: "รอบ 2", active: true, sort_order: 2 },
            ],
          },
          { name: "ตอบคำถาม", active: true, sort_order: 2, rounds: [] },
        ],
        p_camp_id: configuredCampId,
      });
      expect(activities.error).toBeNull();
      expect(activities.data).toMatchObject({ ok: true, activity_count: 2 });

      const budget = await client.rpc("update_camp_budget", {
        p_camp_id: configuredCampId,
        p_reason: "เพิ่มงบสำหรับการทดสอบ",
        p_total_budget: 60_000,
        p_warning_amount: 60_000,
        p_warning_percent: null,
      });
      expect(budget.error).toBeNull();
      expect(budget.data).toMatchObject({
        ok: true,
        camp: {
          total_budget: 60_000,
          remaining_budget: 60_000,
          warning_active: true,
        },
      });

      const snapshot = await client.rpc("get_admin_camp_snapshot", {
        p_camp_id: configuredCampId,
      });
      expect(snapshot.error).toBeNull();
      expect(snapshot.data.camp.public_result_limit).toBe(3);
      expect(snapshot.data.activities).toHaveLength(2);
      expect(snapshot.data.groups).toHaveLength(8);

      const revealed = await client.rpc("set_leaderboard_visibility", {
        p_camp_id: configuredCampId,
        p_visible: true,
      });
      expect(revealed.error).toBeNull();
      expect(revealed.data).toMatchObject({
        ok: true,
        leaderboard_visible: true,
      });

      const publicClient = await anonymousClient();
      const publicCode = snapshot.data.camp.public_leaderboard_code as string;
      const joined = await publicClient.rpc("join_public_leaderboard", {
        p_public_code: publicCode,
      });
      expect(joined.error).toBeNull();
      expect(joined.data).toMatchObject({
        ok: true,
        camp_id: configuredCampId,
      });

      const leaderboard = await publicClient.rpc("get_leaderboard_snapshot", {
        p_camp_id: configuredCampId,
      });
      expect(leaderboard.error).toBeNull();
      expect(leaderboard.data).toMatchObject({ ok: true });
      expect(leaderboard.data.ranking).toHaveLength(3);

      const publicCannotSetRange = await publicClient.rpc(
        "set_public_result_limit",
        { p_camp_id: configuredCampId, p_limit: 5 },
      );
      expect(publicCannotSetRange.error).toBeNull();
      expect(publicCannotSetRange.data).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });

      const invalidRange = await client.rpc("set_public_result_limit", {
        p_camp_id: configuredCampId,
        p_limit: 4,
      });
      expect(invalidRange.error).toBeNull();
      expect(invalidRange.data).toMatchObject({
        ok: false,
        error: { code: "INVALID_PUBLIC_RESULT_LIMIT" },
      });

      const topFive = await client.rpc("set_public_result_limit", {
        p_camp_id: configuredCampId,
        p_limit: 5,
      });
      expect(topFive.error).toBeNull();
      expect(topFive.data).toMatchObject({
        ok: true,
        public_result_limit: 5,
      });
      const topFiveLeaderboard = await publicClient.rpc(
        "get_leaderboard_snapshot",
        { p_camp_id: configuredCampId },
      );
      expect(topFiveLeaderboard.error).toBeNull();
      expect(topFiveLeaderboard.data.camp.public_result_limit).toBe(5);
      expect(topFiveLeaderboard.data.ranking).toHaveLength(5);

      const completeAdminRanking = await client.rpc(
        "get_leaderboard_snapshot",
        { p_camp_id: configuredCampId },
      );
      expect(completeAdminRanking.error).toBeNull();
      expect(completeAdminRanking.data.ranking).toHaveLength(8);

      const forbiddenStaffCode = await publicClient
        .from("camps")
        .select("staff_join_code")
        .eq("id", configuredCampId);
      expect(forbiddenStaffCode.error).toMatchObject({ code: "42501" });
      const forbiddenFieldSnapshot = await publicClient.rpc(
        "get_camp_snapshot",
        {
          p_camp_id: configuredCampId,
        },
      );
      expect(forbiddenFieldSnapshot.error).toBeNull();
      expect(forbiddenFieldSnapshot.data).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });
      const hiddenActivities = await publicClient
        .from("activities")
        .select("id");
      expect(hiddenActivities.error).toBeNull();
      expect(hiddenActivities.data).toEqual([]);

      const hidden = await client.rpc("set_leaderboard_visibility", {
        p_camp_id: configuredCampId,
        p_visible: false,
      });
      expect(hidden.error).toBeNull();
      expect(hidden.data).toMatchObject({
        ok: true,
        leaderboard_visible: false,
      });

      const hiddenSnapshot = await publicClient.rpc(
        "get_leaderboard_snapshot",
        {
          p_camp_id: configuredCampId,
        },
      );
      expect(hiddenSnapshot.error).toBeNull();
      expect(hiddenSnapshot.data).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });
    });

    it("preserves History and Audit through maintenance, Adjustment, and Close Camp", async () => {
      const admin = await anonymousClient();
      expect(await login(admin, "6543")).toMatchObject({ ok: true });

      const initialSnapshot = await admin.rpc("get_admin_camp_snapshot", {
        p_camp_id: configuredCampId,
      });
      expect(initialSnapshot.error).toBeNull();
      const camp = initialSnapshot.data.camp as {
        staff_join_code: string;
        total_budget: number;
      };
      const group = initialSnapshot.data.groups[0] as {
        id: string;
        custom_name: string;
      };
      const staffMember = initialSnapshot.data.members.find(
        (member: { role: string }) => member.role === "staff",
      ) as { id: string; display_name: string };
      const plus500 = initialSnapshot.data.score_buttons.find(
        (button: { amount: number }) => button.amount === 500,
      ) as { id: string };

      const details = await admin.rpc("update_camp_details", {
        p_camp_date: "2026-08-24",
        p_camp_id: configuredCampId,
        p_location_name: "อาคารกิจกรรมใหม่",
        p_name: "Integration Camp Updated",
      });
      expect(details.error).toBeNull();
      expect(details.data).toMatchObject({
        ok: true,
        camp: {
          name: "Integration Camp Updated",
          location_name: "อาคารกิจกรรมใหม่",
          camp_date: "2026-08-24",
        },
      });

      let staff = await anonymousClient();
      const joined = await staff.rpc("join_staff_camp", {
        p_member_id: staffMember.id,
        p_staff_join_code: camp.staff_join_code,
      });
      expect(joined.error).toBeNull();
      expect(joined.data).toMatchObject({ ok: true });

      const awarded = await staff.rpc("apply_score_transaction", {
        p_activity_id: null,
        p_camp_id: configuredCampId,
        p_client_action_id: crypto.randomUUID(),
        p_group_id: group.id,
        p_round_id: null,
        p_score_button_id: plus500.id,
      });
      expect(awarded.error).toBeNull();
      expect(awarded.data).toMatchObject({ ok: true });

      const clearedByAdmin = await admin.rpc("update_group_identity", {
        p_camp_id: configuredCampId,
        p_color_key: "teal",
        p_custom_name: "",
        p_group_id: group.id,
      });
      expect(clearedByAdmin.error).toBeNull();
      expect(clearedByAdmin.data).toMatchObject({
        ok: true,
        group: { color_name: "เขียวอมฟ้า", custom_name: "" },
      });

      const renamed = await admin.rpc("update_group_identity", {
        p_camp_id: configuredCampId,
        p_color_key: "teal",
        p_custom_name: "Banana Prime",
        p_group_id: group.id,
      });
      expect(renamed.error).toBeNull();
      expect(renamed.data).toMatchObject({
        ok: true,
        group: { color_name: "เขียวอมฟ้า", custom_name: "Banana Prime" },
      });

      const adjustmentActionId = crypto.randomUUID();
      const adjusted = await admin.rpc("admin_adjust_score", {
        p_adjusts_transaction_id: awarded.data.transaction.id,
        p_amount: 200,
        p_camp_id: configuredCampId,
        p_client_action_id: adjustmentActionId,
        p_group_id: group.id,
        p_reason: "แก้คะแนนจากผลตรวจสอบ",
      });
      expect(adjusted.error).toBeNull();
      expect(adjusted.data).toMatchObject({
        ok: true,
        transaction: {
          amount: 200,
          transaction_type: "adjustment",
          adjusts_transaction_id: awarded.data.transaction.id,
        },
      });
      const adjustmentRetry = await admin.rpc("admin_adjust_score", {
        p_adjusts_transaction_id: awarded.data.transaction.id,
        p_amount: 200,
        p_camp_id: configuredCampId,
        p_client_action_id: adjustmentActionId,
        p_group_id: group.id,
        p_reason: "แก้คะแนนจากผลตรวจสอบ",
      });
      expect(adjustmentRetry.error).toBeNull();
      expect(adjustmentRetry.data).toEqual(adjusted.data);

      const firstPage = await admin.rpc("get_transaction_history", {
        p_camp_id: configuredCampId,
        p_limit: 1,
      });
      expect(firstPage.error).toBeNull();
      expect(firstPage.data.items).toHaveLength(1);
      expect(firstPage.data.items[0]).toMatchObject({
        transaction_type: "adjustment",
        group_custom_name_snapshot: "Banana Prime",
      });
      expect(firstPage.data.next_cursor).toBeTruthy();

      const secondPage = await admin.rpc("get_transaction_history", {
        p_before_created_at: firstPage.data.next_cursor.created_at,
        p_before_id: firstPage.data.next_cursor.id,
        p_camp_id: configuredCampId,
        p_limit: 1,
      });
      expect(secondPage.error).toBeNull();
      expect(secondPage.data.items).toHaveLength(1);
      expect(secondPage.data.items[0]).toMatchObject({
        id: awarded.data.transaction.id,
        group_custom_name_snapshot: group.custom_name,
      });

      const addedStaff = await admin.rpc("add_staff_member", {
        p_camp_id: configuredCampId,
        p_display_name: "Staff Added",
      });
      expect(addedStaff.error).toBeNull();
      expect(addedStaff.data).toMatchObject({ ok: true });
      const disabledStaff = await admin.rpc("set_camp_member_active", {
        p_active: false,
        p_camp_id: configuredCampId,
        p_member_id: addedStaff.data.member.id,
      });
      expect(disabledStaff.error).toBeNull();
      expect(disabledStaff.data).toMatchObject({
        ok: true,
        member: { active: false },
      });

      const savedButtons = await admin.rpc("save_score_buttons", {
        p_buttons: [
          ...initialSnapshot.data.score_buttons.map(
            (
              button: {
                id: string;
                label: string;
                amount: number;
                enabled: boolean;
              },
              index: number,
            ) => ({
              id: button.id,
              label: button.label,
              amount: button.amount,
              enabled: button.enabled,
              requires_confirmation: button.amount === 500,
              sort_order: index + 1,
            }),
          ),
          {
            label: "+250",
            amount: 250,
            enabled: true,
            requires_confirmation: false,
            sort_order: 5,
          },
        ],
        p_camp_id: configuredCampId,
      });
      expect(savedButtons.error).toBeNull();
      expect(savedButtons.data).toMatchObject({ ok: true, button_count: 5 });

      const savedButtonSnapshot = await admin.rpc("get_admin_camp_snapshot", {
        p_camp_id: configuredCampId,
      });
      expect(savedButtonSnapshot.error).toBeNull();
      expect(
        savedButtonSnapshot.data.score_buttons.find(
          (button: { amount: number }) => button.amount === 500,
        ),
      ).toMatchObject({ requires_confirmation: true });

      const legacyCompatibleSave = await admin.rpc("save_score_buttons", {
        p_buttons: savedButtonSnapshot.data.score_buttons.map(
          (
            button: {
              amount: number;
              enabled: boolean;
              id: string;
              label: string;
              sort_order: number;
            },
            index: number,
          ) => ({
            id: button.id,
            label: button.label,
            amount: button.amount,
            enabled: button.enabled,
            sort_order: index + 1,
          }),
        ),
        p_camp_id: configuredCampId,
      });
      expect(legacyCompatibleSave.error).toBeNull();
      expect(legacyCompatibleSave.data).toMatchObject({ ok: true });

      const preservedConfirmation = await admin.rpc("get_admin_camp_snapshot", {
        p_camp_id: configuredCampId,
      });
      expect(preservedConfirmation.error).toBeNull();
      expect(
        preservedConfirmation.data.score_buttons.find(
          (button: { amount: number }) => button.amount === 500,
        ),
      ).toMatchObject({ requires_confirmation: true });

      const addedAdmin = await admin.rpc("add_admin_to_camp", {
        p_camp_id: configuredCampId,
        p_display_name: "Admin Added",
        p_temporary_pin: "2222",
      });
      expect(addedAdmin.error).toBeNull();
      expect(addedAdmin.data).toMatchObject({
        ok: true,
        admin: { display_name: "Admin Added", must_change_pin: true },
      });

      const addedAdminClient = await anonymousClient();
      const addedLogin = await addedAdminClient.rpc("login_admin", {
        p_admin_account_id: addedAdmin.data.admin.id,
        p_pin: "2222",
      });
      expect(addedLogin.error).toBeNull();
      expect(addedLogin.data).toMatchObject({
        ok: true,
        admin: { must_change_pin: true },
      });

      const resetPin = await admin.rpc("reset_admin_pin", {
        p_admin_account_id: addedAdmin.data.admin.id,
        p_camp_id: configuredCampId,
        p_reason: "ทดสอบกระบวนการรีเซ็ต",
        p_temporary_pin: "3333",
      });
      expect(resetPin.error).toBeNull();
      expect(resetPin.data).toMatchObject({ ok: true });

      const rotatedStaffCode = await admin.rpc("rotate_camp_access_code", {
        p_camp_id: configuredCampId,
        p_reason: "ทดสอบยกเลิกลิงก์เดิม",
        p_surface: "staff",
      });
      expect(rotatedStaffCode.error).toBeNull();
      expect(rotatedStaffCode.data).toMatchObject({
        ok: true,
        surface: "staff",
      });
      expect(rotatedStaffCode.data.code).toMatch(/^ST-[A-Z2-9]{12}$/);

      const revokedAttempt = await staff.rpc("apply_score_transaction", {
        p_activity_id: null,
        p_camp_id: configuredCampId,
        p_client_action_id: crypto.randomUUID(),
        p_group_id: group.id,
        p_round_id: null,
        p_score_button_id: plus500.id,
      });
      expect(revokedAttempt.error).toBeNull();
      expect(revokedAttempt.data).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });

      staff = await anonymousClient();
      const rejoined = await staff.rpc("join_staff_camp", {
        p_member_id: staffMember.id,
        p_staff_join_code: rotatedStaffCode.data.code,
      });
      expect(rejoined.error).toBeNull();
      expect(rejoined.data).toMatchObject({ ok: true });

      const staffButtonSnapshot = await staff.rpc("get_camp_snapshot", {
        p_camp_id: configuredCampId,
      });
      expect(staffButtonSnapshot.error).toBeNull();
      expect(staffButtonSnapshot.data.actor).toEqual({
        id: staffMember.id,
        display_name: staffMember.display_name,
        role: "staff",
      });
      expect(
        staffButtonSnapshot.data.score_buttons.find(
          (button: { amount: number }) => button.amount === 500,
        ),
      ).toMatchObject({ requires_confirmation: true });

      const staffRenamed = await staff.rpc("update_staff_group_name", {
        p_camp_id: configuredCampId,
        p_custom_name: "Banana by Staff",
        p_group_id: group.id,
      });
      expect(staffRenamed.error).toBeNull();
      expect(staffRenamed.data).toMatchObject({
        ok: true,
        group: {
          id: group.id,
          color_name: "เขียวอมฟ้า",
          custom_name: "Banana by Staff",
        },
      });

      const clearedName = await staff.rpc("update_staff_group_name", {
        p_camp_id: configuredCampId,
        p_custom_name: "",
        p_group_id: group.id,
      });
      expect(clearedName.error).toBeNull();
      expect(clearedName.data).toMatchObject({
        ok: true,
        group: { id: group.id, custom_name: "" },
      });

      const adminCamps = await admin.rpc("get_admin_camps");
      expect(adminCamps.error).toBeNull();
      const otherCamp = adminCamps.data.camps.find(
        (item: { id: string }) => item.id !== configuredCampId,
      ) as { id: string };
      const otherSnapshot = await admin.rpc("get_admin_camp_snapshot", {
        p_camp_id: otherCamp.id,
      });
      expect(otherSnapshot.error).toBeNull();
      const crossCampRename = await staff.rpc("update_staff_group_name", {
        p_camp_id: configuredCampId,
        p_custom_name: "ข้ามค่ายไม่ได้",
        p_group_id: otherSnapshot.data.groups[0].id,
      });
      expect(crossCampRename.error).toBeNull();
      expect(crossCampRename.data).toMatchObject({
        ok: false,
        error: { code: "GROUP_NOT_FOUND" },
      });

      const audit = await admin.rpc("get_audit_log", {
        p_camp_id: configuredCampId,
        p_limit: 50,
      });
      expect(audit.error).toBeNull();
      expect(
        audit.data.items.map((item: { action: string }) => item.action),
      ).toEqual(
        expect.arrayContaining([
          "group_identity_changed",
          "camp_details_changed",
          "score_adjusted",
          "staff_added",
          "camp_member_status_changed",
          "score_buttons_changed",
          "admin_added",
          "admin_pin_reset",
          "camp_access_code_rotated",
          "public_result_limit_changed",
          "staff_group_name_changed",
        ]),
      );

      const [closed, staleScore] = await Promise.all([
        admin.rpc("close_camp", {
          p_camp_id: configuredCampId,
          p_reason: "สิ้นสุดกิจกรรมทดสอบ",
        }),
        staff.rpc("apply_score_transaction", {
          p_activity_id: null,
          p_camp_id: configuredCampId,
          p_client_action_id: crypto.randomUUID(),
          p_group_id: group.id,
          p_round_id: null,
          p_score_button_id: plus500.id,
        }),
      ]);
      expect(closed.error).toBeNull();
      expect(closed.data).toMatchObject({
        ok: true,
        camp: { status: "closed" },
      });
      expect(staleScore.error).toBeNull();
      if (!staleScore.data.ok) {
        expect(staleScore.data).toMatchObject({
          error: { code: "CAMP_CLOSED" },
        });
      }
      const closedRename = await staff.rpc("update_staff_group_name", {
        p_camp_id: configuredCampId,
        p_custom_name: "แก้หลังปิดไม่ได้",
        p_group_id: group.id,
      });
      expect(closedRename.error).toBeNull();
      expect(closedRename.data).toMatchObject({ ok: false });
      const closedTopTen = await admin.rpc("set_public_result_limit", {
        p_camp_id: configuredCampId,
        p_limit: 10,
      });
      expect(closedTopTen.error).toBeNull();
      expect(closedTopTen.data).toMatchObject({
        ok: true,
        public_result_limit: 10,
      });
      const closedSnapshot = await staff.rpc("get_camp_snapshot", {
        p_camp_id: configuredCampId,
      });
      expect(closedSnapshot.error).toBeNull();
      expect(closedSnapshot.data).toMatchObject({ camp: { status: "closed" } });
      expect(
        closedSnapshot.data.groups.reduce(
          (total: number, item: { current_score: number }) =>
            total + item.current_score,
          0,
        ),
      ).toBe(closedSnapshot.data.camp.distributed_amount);

      const postCloseAdjustment = await admin.rpc("admin_adjust_score", {
        p_adjusts_transaction_id: null,
        p_amount: -100,
        p_camp_id: configuredCampId,
        p_client_action_id: crypto.randomUUID(),
        p_group_id: group.id,
        p_reason: "แก้ไขผลสุดท้ายหลังปิดค่าย",
      });
      expect(postCloseAdjustment.error).toBeNull();
      expect(postCloseAdjustment.data).toMatchObject({ ok: true });
    });

    it("restores the current Admin session safely and revokes it on logout", async () => {
      const client = await anonymousClient();
      expect(await login(client, "6543")).toMatchObject({ ok: true });

      const current = await client.rpc("get_current_admin_session");
      expect(current.error).toBeNull();
      expect(current.data).toMatchObject({
        ok: true,
        admin: { id: DEMO_ADMIN_ID, must_change_pin: false },
      });

      const logout = await client.rpc("logout_admin");
      expect(logout.error).toBeNull();
      expect(logout.data).toEqual({ ok: true });

      const camps = await client.rpc("get_admin_camps");
      expect(camps.error).toBeNull();
      expect(camps.data).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });
    });

    it("locks the account for 15 minutes after five failed PIN attempts", async () => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const client = await anonymousClient();
        expect(await login(client, "1111")).toMatchObject({ ok: false });
      }

      const client = await anonymousClient();
      const locked = await login(client, "6543");
      expect(locked).toMatchObject({
        ok: false,
        error: { code: "ACCOUNT_LOCKED" },
      });
      const lockedUntil = Date.parse(
        (locked as { locked_until?: string }).locked_until ?? "",
      );
      expect(lockedUntil).toBeGreaterThan(Date.now() + 14.8 * 60 * 1000);
    });
  });
