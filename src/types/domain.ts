export type RpcError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type RpcFailure = {
  ok: false;
  error: RpcError;
};

export type StaffJoinOptions = {
  ok: true;
  camp: {
    id: string;
    name: string;
    location_name: string | null;
    camp_date: string;
    status: "active";
  };
  staff: Array<{
    id: string;
    display_name: string;
    sort_order: number;
  }>;
};

export type CampSnapshot = {
  actor: {
    id: string;
    display_name: string;
    role: "admin" | "staff";
  };
  camp: {
    id: string;
    name: string;
    location_name: string | null;
    camp_date: string;
    status: "draft" | "active" | "closed";
    total_budget: number;
    distributed_amount: number;
    remaining_budget: number;
    warning_amount: number | null;
    warning_percent: number | null;
    warning_active: boolean;
    leaderboard_visible: boolean;
    closed_at: string | null;
  };
  groups: Array<{
    id: string;
    color_key: string;
    color_name: string;
    color_hex: string;
    custom_name: string;
    current_score: number;
    score_reached_at: string;
    sort_order: number;
  }>;
  score_buttons: Array<{
    id: string;
    label: string;
    amount: number;
    requires_confirmation: boolean;
    sort_order: number;
  }>;
  activities: Array<{
    id: string;
    name: string;
    sort_order: number;
    rounds: Array<{
      id: string;
      label: string;
      sort_order: number;
    }>;
  }>;
  recent_transactions: Array<{
    id: string;
    group_id: string;
    amount: number;
    transaction_type: "award" | "deduction" | "quick_undo" | "adjustment";
    group_color_name_snapshot: string;
    group_color_hex_snapshot: string;
    group_custom_name_snapshot: string;
    actor_name_snapshot: string;
    activity_name_snapshot: string | null;
    round_label_snapshot: string | null;
    created_at: string;
  }>;
};

export type ScoreResult = {
  ok: true;
  transaction: {
    id: string;
    amount: number;
    transaction_type: "award" | "deduction";
    created_at: string;
  };
  group: {
    id: string;
    current_score: number;
    score_reached_at: string;
  };
  camp: {
    total_budget: number;
    distributed_amount: number;
    remaining_budget: number;
    warning_active: boolean;
  };
};

export type AdminIdentity = {
  id: string;
  display_name: string;
  must_change_pin: boolean;
};

export type AdminCampSummary = {
  id: string;
  name: string;
  location_name: string | null;
  camp_date: string;
  code: string;
  status: "draft" | "active" | "closed";
  total_budget: number;
  distributed_amount: number;
  remaining_budget: number;
  leaderboard_visible: boolean;
  updated_at: string;
  archived_at?: string | null;
};

export type AdminCampSnapshot = {
  ok: true;
  camp: Omit<AdminCampSummary, "updated_at"> & {
    archived_at: string | null;
    warning_amount: number | null;
    warning_percent: number | null;
    staff_join_code: string | null;
    public_leaderboard_code: string | null;
    public_result_limit: 3 | 5 | 10;
    closed_at: string | null;
  };
  groups: Array<{
    id: string;
    color_key: string;
    color_name: string;
    color_hex: string;
    custom_name: string;
    current_score: number;
    score_reached_at: string | null;
    active: boolean;
    sort_order: number;
  }>;
  members: Array<{
    id: string;
    display_name: string;
    role: "admin" | "staff";
    active: boolean;
    sort_order: number;
    admin_account_id: string | null;
  }>;
  score_buttons: Array<{
    id: string;
    label: string;
    amount: number;
    enabled: boolean;
    requires_confirmation: boolean;
    sort_order: number;
  }>;
  activities: Array<{
    id: string;
    name: string;
    active: boolean;
    sort_order: number;
    rounds: Array<{
      id: string;
      label: string;
      active: boolean;
      sort_order: number;
    }>;
  }>;
  transaction_count: number;
};

export type LeaderboardSnapshot = {
  ok: true;
  camp: {
    id: string;
    name: string;
    location_name: string | null;
    status: "active" | "closed";
    leaderboard_visible: true;
    public_result_limit: 3 | 5 | 10;
  };
  ranking: Array<{
    rank: number;
    id: string;
    color_name: string;
    color_hex: string;
    custom_name: string;
    current_score: number;
    score_reached_at: string;
    sort_order: number;
  }>;
};

export function isRpcFailure(value: unknown): value is RpcFailure {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RpcFailure>;
  return (
    candidate.ok === false &&
    typeof candidate.error?.code === "string" &&
    typeof candidate.error.message === "string"
  );
}
