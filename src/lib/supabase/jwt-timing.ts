import type { SupabaseClient } from "@supabase/supabase-js";

export async function waitUntilAccessTokenIsCurrent(accessToken: string) {
  const payloadPart = accessToken.split(".")[1];
  if (!payloadPart) return;

  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { iat?: number };
    if (typeof payload.iat !== "number") return;

    const waitMs = payload.iat * 1_000 - Date.now() + 25;
    if (waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
  } catch {
    // Supabase validates the token authoritatively; decoding here only avoids a local clock edge.
  }
}

export async function waitUntilPostgrestAcceptsSession(client: SupabaseClient) {
  const deadline = Date.now() + 5_000;

  while (true) {
    const { error } = await client.rpc("get_admin_login_options");
    if (!error) return;
    if (error.code !== "PGRST303" || Date.now() >= deadline) {
      throw error;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
}
