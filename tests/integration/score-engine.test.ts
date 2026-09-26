import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  waitUntilAccessTokenIsCurrent,
  waitUntilPostgrestAcceptsSession,
} from "@/lib/supabase/jwt-timing";

const DEMO_CAMP_ID = "10000000-0000-4000-8000-000000000001";
const DEMO_GROUP_ID = "20000000-0000-4000-8000-000000000001";
const DEMO_STAFF_A_ID = "30000000-0000-4000-8000-000000000001";
const DEMO_STAFF_B_ID = "30000000-0000-4000-8000-000000000002";
const DEMO_STAFF_C_ID = "30000000-0000-4000-8000-000000000003";
const DEMO_PLUS_500_ID = "40000000-0000-4000-8000-000000000001";
const DEMO_PLUS_1000_ID = "40000000-0000-4000-8000-000000000002";
const DEMO_MINUS_1000_ID = "40000000-0000-4000-8000-000000000004";
const DEMO_DANCE_ID = "50000000-0000-4000-8000-000000000001";
const DEMO_QUESTION_ID = "50000000-0000-4000-8000-000000000002";
const DEMO_DANCE_ROUND_2_ID = "51000000-0000-4000-8000-000000000002";

const RACE_CAMP_ID = "10000000-0000-4000-8000-000000000002";
const RACE_GROUP_A_ID = "21000000-0000-4000-8000-000000000001";
const RACE_GROUP_B_ID = "21000000-0000-4000-8000-000000000002";
const RACE_STAFF_A_ID = "31000000-0000-4000-8000-000000000001";
const RACE_STAFF_B_ID = "31000000-0000-4000-8000-000000000002";
const RACE_PLUS_1000_ID = "41000000-0000-4000-8000-000000000001";

type RpcResult = {
  ok: boolean;
  error?: { code: string; message: string };
  transaction?: {
    id: string;
    amount: number;
    transaction_type?: string;
    reverses_transaction_id?: string;
  };
  camp?: {
    distributed_amount: number;
    remaining_budget: number;
    total_budget: number;
  };
  group?: { id: string; current_score: number };
};

type CampSnapshot = {
  camp: {
    id: string;
    distributed_amount: number;
    remaining_budget: number;
    total_budget: number;
  };
  groups: Array<{ id: string; current_score: number }>;
  recent_transactions: Array<{
    id: string;
    amount: number;
    transaction_type: string;
    activity_name_snapshot: string | null;
    round_label_snapshot: string | null;
    reverses_transaction_id: string | null;
  }>;
};

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

async function joinStaff(
  _joinCode: string,
  memberId: string,
): Promise<SupabaseClient> {
  const { key, url } = localCredentials();
  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `eqcamp-integration-${crypto.randomUUID()}`,
    },
  });

  const { data: authData, error: authError } =
    await client.auth.signInAnonymously();
  expect(authError).toBeNull();
  if (authData.session) {
    await waitUntilAccessTokenIsCurrent(authData.session.access_token);
  }
  await waitUntilPostgrestAcceptsSession(client);

  const { data, error } = await client.rpc("join_staff_camp", {
    p_member_id: memberId,
    p_staff_join_code: `TEST-${memberId}`,
  });

  expect(error).toBeNull();
  expect(data).toMatchObject({ ok: true, member_id: memberId });

  return client;
}

async function applyScore(
  client: SupabaseClient,
  input: {
    campId: string;
    groupId: string;
    scoreButtonId: string;
    clientActionId?: string;
    activityId?: string;
    roundId?: string;
  },
) {
  const clientActionId = input.clientActionId ?? crypto.randomUUID();
  const { data, error } = await client.rpc("apply_score_transaction", {
    p_activity_id: input.activityId ?? null,
    p_camp_id: input.campId,
    p_client_action_id: clientActionId,
    p_group_id: input.groupId,
    p_round_id: input.roundId ?? null,
    p_score_button_id: input.scoreButtonId,
  });

  expect(error).toBeNull();
  return { clientActionId, result: data as RpcResult };
}

async function snapshot(client: SupabaseClient, campId: string) {
  const { data, error } = await client.rpc("get_camp_snapshot", {
    p_camp_id: campId,
  });

  expect(error).toBeNull();
  return data as CampSnapshot;
}

async function quickUndo(
  client: SupabaseClient,
  transactionId: string,
  clientActionId = crypto.randomUUID(),
) {
  const { data, error } = await client.rpc("quick_undo", {
    p_camp_id: DEMO_CAMP_ID,
    p_client_action_id: clientActionId,
    p_transaction_id: transactionId,
  });

  expect(error).toBeNull();
  return data as RpcResult;
}

describe
  .runIf(process.env.EQCAMP_INTEGRATION === "1")
  .sequential("authenticated Score RPC", () => {
    let demoStaffA: SupabaseClient;

    beforeAll(async () => {
      demoStaffA = await joinStaff("DEMO-STAFF-2026", DEMO_STAFF_A_ID);
    });

    it("awards +500 and updates Group Score and Camp Budget atomically", async () => {
      const { result } = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });

      expect(result).toMatchObject({
        ok: true,
        transaction: { amount: 500 },
        group: { id: DEMO_GROUP_ID, current_score: 500 },
        camp: {
          distributed_amount: 500,
          remaining_budget: 99_500,
          total_budget: 100_000,
        },
      });

      const current = await snapshot(demoStaffA, DEMO_CAMP_ID);
      expect(
        current.groups.find((group) => group.id === DEMO_GROUP_ID),
      ).toMatchObject({ current_score: 500 });
      expect(current.camp.remaining_budget).toBe(99_500);
    });

    it("returns the original result for an exact idempotent retry", async () => {
      const actionId = crypto.randomUUID();
      const first = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        clientActionId: actionId,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_1000_ID,
      });
      const retry = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        clientActionId: actionId,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_1000_ID,
      });

      expect(retry.result).toEqual(first.result);
      expect(retry.result.transaction?.id).toBe(first.result.transaction?.id);
      expect(
        (await snapshot(demoStaffA, DEMO_CAMP_ID)).groups[0]?.current_score,
      ).toBe(1_500);
    });

    it("rejects a changed payload that reuses a client action UUID", async () => {
      const actionId = crypto.randomUUID();
      await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        clientActionId: actionId,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });

      const conflict = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        clientActionId: actionId,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_MINUS_1000_ID,
      });

      expect(conflict.result).toMatchObject({
        ok: false,
        error: { code: "IDEMPOTENCY_CONFLICT" },
      });
    });

    it("stores Activity and Round snapshots and rejects mismatched context", async () => {
      const valid = await applyScore(demoStaffA, {
        activityId: DEMO_DANCE_ID,
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        roundId: DEMO_DANCE_ROUND_2_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });
      expect(valid.result).toMatchObject({ ok: true });

      const current = await snapshot(demoStaffA, DEMO_CAMP_ID);
      expect(current.recent_transactions[0]).toMatchObject({
        id: valid.result.transaction?.id,
        activity_name_snapshot: "เต้น",
        round_label_snapshot: "รอบ 2",
      });

      const invalid = await applyScore(demoStaffA, {
        activityId: DEMO_QUESTION_ID,
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        roundId: DEMO_DANCE_ROUND_2_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });
      expect(invalid.result).toMatchObject({
        ok: false,
        error: { code: "ROUND_NOT_AVAILABLE" },
      });
    });

    it("quick-undoes only the actor's latest ordinary action and is idempotent", async () => {
      const awarded = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });
      const actionId = crypto.randomUUID();
      const undoInput = {
        p_camp_id: DEMO_CAMP_ID,
        p_client_action_id: actionId,
        p_transaction_id: awarded.result.transaction?.id,
      };

      const first = await demoStaffA.rpc("quick_undo", undoInput);
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({
        ok: true,
        transaction: {
          amount: -500,
          transaction_type: "quick_undo",
          reverses_transaction_id: awarded.result.transaction?.id,
        },
      });

      const retry = await demoStaffA.rpc("quick_undo", undoInput);
      expect(retry.error).toBeNull();
      expect(retry.data).toEqual(first.data);
      const current = await snapshot(demoStaffA, DEMO_CAMP_ID);
      expect(current.recent_transactions[0]).toMatchObject({
        transaction_type: "quick_undo",
        reverses_transaction_id: awarded.result.transaction?.id,
      });
    });

    it("quick-undoes a deduction and preserves the linked opposite transaction", async () => {
      await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_1000_ID,
      });
      const deducted = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_MINUS_1000_ID,
      });
      expect(deducted.result).toMatchObject({
        ok: true,
        transaction: { amount: -1_000 },
      });

      const undone = await quickUndo(
        demoStaffA,
        deducted.result.transaction!.id,
      );
      expect(undone).toMatchObject({
        ok: true,
        transaction: {
          amount: 1_000,
          transaction_type: "quick_undo",
          reverses_transaction_id: deducted.result.transaction!.id,
        },
      });

      const current = await snapshot(demoStaffA, DEMO_CAMP_ID);
      expect(current.recent_transactions[0]).toMatchObject({
        amount: 1_000,
        transaction_type: "quick_undo",
        reverses_transaction_id: deducted.result.transaction!.id,
      });
    });

    it("rejects an older action and another Staff member's action", async () => {
      const older = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });
      const latest = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });

      expect(
        await quickUndo(demoStaffA, older.result.transaction!.id),
      ).toMatchObject({
        ok: false,
        error: { code: "UNDO_NOT_LATEST" },
      });

      const staffB = await joinStaff("DEMO-STAFF-2026", DEMO_STAFF_B_ID);
      expect(
        await quickUndo(staffB, latest.result.transaction!.id),
      ).toMatchObject({
        ok: false,
        error: { code: "UNDO_NOT_LATEST" },
      });
    });

    it("allows one winner when two Quick Undo requests race", async () => {
      const awarded = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });

      const outcomes = await Promise.all([
        quickUndo(demoStaffA, awarded.result.transaction!.id),
        quickUndo(demoStaffA, awarded.result.transaction!.id),
      ]);

      expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
      expect(outcomes.filter((result) => !result.ok)).toEqual([
        expect.objectContaining({
          error: expect.objectContaining({ code: "ALREADY_UNDONE" }),
        }),
      ]);
      const current = await snapshot(demoStaffA, DEMO_CAMP_ID);
      expect(
        current.recent_transactions.filter(
          (transaction) =>
            transaction.reverses_transaction_id ===
            awarded.result.transaction!.id,
        ),
      ).toHaveLength(1);
    });

    it("rejects Quick Undo after the database's 15-second window", async () => {
      const awarded = await applyScore(demoStaffA, {
        campId: DEMO_CAMP_ID,
        groupId: DEMO_GROUP_ID,
        scoreButtonId: DEMO_PLUS_500_ID,
      });

      await new Promise((resolve) => setTimeout(resolve, 15_250));

      expect(
        await quickUndo(demoStaffA, awarded.result.transaction!.id),
      ).toMatchObject({
        ok: false,
        error: { code: "UNDO_EXPIRED" },
      });
    }, 20_000);

    it("allows exactly one concurrent +1,000 action when Remaining Budget is 1,000", async () => {
      const [staffA, staffB] = await Promise.all([
        joinStaff("RACE-STAFF-2026", RACE_STAFF_A_ID),
        joinStaff("RACE-STAFF-2026", RACE_STAFF_B_ID),
      ]);

      const [requestA, requestB] = await Promise.all([
        applyScore(staffA, {
          campId: RACE_CAMP_ID,
          groupId: RACE_GROUP_A_ID,
          scoreButtonId: RACE_PLUS_1000_ID,
        }),
        applyScore(staffB, {
          campId: RACE_CAMP_ID,
          groupId: RACE_GROUP_B_ID,
          scoreButtonId: RACE_PLUS_1000_ID,
        }),
      ]);

      const outcomes = [requestA.result, requestB.result];
      expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
      expect(outcomes.filter((result) => !result.ok)).toEqual([
        expect.objectContaining({
          error: expect.objectContaining({ code: "INSUFFICIENT_BUDGET" }),
        }),
      ]);

      const current = await snapshot(staffA, RACE_CAMP_ID);
      expect(current.camp).toMatchObject({
        distributed_amount: 1_000,
        remaining_budget: 0,
      });
      expect(
        current.groups.reduce((total, group) => total + group.current_score, 0),
      ).toBe(1_000);
    });

    it("preserves all writes when five sessions score the same Group", async () => {
      const memberIds = [
        DEMO_STAFF_A_ID,
        DEMO_STAFF_B_ID,
        DEMO_STAFF_C_ID,
        DEMO_STAFF_A_ID,
        DEMO_STAFF_B_ID,
      ];
      const clients = await Promise.all(
        memberIds.map((memberId) => joinStaff("DEMO-STAFF-2026", memberId)),
      );
      const before = await snapshot(clients[0], DEMO_CAMP_ID);
      const targetGroupId = "20000000-0000-4000-8000-000000000002";
      const startingScore =
        before.groups.find((group) => group.id === targetGroupId)
          ?.current_score ?? 0;

      const outcomes = await Promise.all(
        clients.map((client) =>
          applyScore(client, {
            campId: DEMO_CAMP_ID,
            groupId: targetGroupId,
            scoreButtonId: DEMO_PLUS_500_ID,
          }),
        ),
      );
      expect(outcomes.every(({ result }) => result.ok)).toBe(true);

      const after = await snapshot(clients[0], DEMO_CAMP_ID);
      expect(
        after.groups.find((group) => group.id === targetGroupId)?.current_score,
      ).toBe(startingScore + 2_500);
    });

    it("preserves ten concurrent writes across multiple Groups", async () => {
      const memberIds = Array.from(
        { length: 10 },
        (_, index) =>
          [DEMO_STAFF_A_ID, DEMO_STAFF_B_ID, DEMO_STAFF_C_ID][index % 3],
      );
      const groupIds = Array.from(
        { length: 8 },
        (_, index) =>
          `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      );
      const clients = await Promise.all(
        memberIds.map((memberId) => joinStaff("DEMO-STAFF-2026", memberId)),
      );
      const before = await snapshot(clients[0], DEMO_CAMP_ID);

      const outcomes = await Promise.all(
        clients.map((client, index) =>
          applyScore(client, {
            campId: DEMO_CAMP_ID,
            groupId: groupIds[index % groupIds.length],
            scoreButtonId: DEMO_PLUS_500_ID,
          }),
        ),
      );
      expect(outcomes.every(({ result }) => result.ok)).toBe(true);

      const after = await snapshot(clients[0], DEMO_CAMP_ID);
      expect(after.camp.distributed_amount).toBe(
        before.camp.distributed_amount + 5_000,
      );
      expect(
        after.groups.reduce((total, group) => total + group.current_score, 0),
      ).toBe(after.camp.distributed_amount);
    });

    it("rejects a deduction that would make Group Score negative", async () => {
      const staffB = await joinStaff("DEMO-STAFF-2026", DEMO_STAFF_B_ID);
      const emptyGroupId = "20000000-0000-4000-8000-000000000008";
      const { result } = await applyScore(staffB, {
        campId: DEMO_CAMP_ID,
        groupId: emptyGroupId,
        scoreButtonId: DEMO_MINUS_1000_ID,
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INSUFFICIENT_GROUP_SCORE" },
      });
    });

    it("denies a Staff session from changing another Camp", async () => {
      const { result } = await applyScore(demoStaffA, {
        campId: RACE_CAMP_ID,
        groupId: RACE_GROUP_A_ID,
        scoreButtonId: RACE_PLUS_1000_ID,
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "ACCESS_DENIED" },
      });
    });
  });
