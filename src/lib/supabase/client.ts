import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  waitUntilAccessTokenIsCurrent,
  waitUntilPostgrestAcceptsSession,
} from "@/lib/supabase/jwt-timing";

let browserClient: SupabaseClient | undefined;
let anonymousSessionPromise: Promise<SupabaseClient> | undefined;
let lastValidatedUserId: string | undefined;
let lastValidatedAt = 0;

const SESSION_VALIDATION_MAX_AGE_MS = 30_000;

function isRecoverableAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { status?: unknown };
  return (
    candidate.status === 401 ||
    candidate.status === 403 ||
    candidate.status === 404
  );
}

export function isStaleAnonymousSessionError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };
  const details =
    typeof candidate.details === "string" ? candidate.details : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";

  return (
    candidate.code === "23503" &&
    (details.includes("Key (auth_user_id)") ||
      message.includes("access_sessions_auth_user_id_fkey"))
  );
}

export function resolveSupabaseBrowserUrl(
  configuredUrl: string,
  pageHostname = typeof window === "undefined" ? "" : window.location.hostname,
) {
  const url = new URL(configuredUrl);
  const configuredForThisMachine = ["127.0.0.1", "localhost", "::1"].includes(
    url.hostname,
  );
  const pageIsThisMachine = ["127.0.0.1", "localhost", "::1", ""].includes(
    pageHostname,
  );

  if (configuredForThisMachine && !pageIsThisMachine) {
    url.hostname = pageHostname;
  }

  return url.toString().replace(/\/$/, "");
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("ยังไม่ได้ตั้งค่า Local Supabase สำหรับเว็บนี้");
  }

  browserClient = createClient(resolveSupabaseBrowserUrl(url), key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });

  return browserClient;
}

async function signInAnonymously(client: SupabaseClient) {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session)
    throw new Error("ไม่สามารถสร้าง session สำหรับอุปกรณ์นี้ได้");

  await waitUntilAccessTokenIsCurrent(data.session.access_token);
  await waitUntilPostgrestAcceptsSession(client);
  lastValidatedUserId = data.session.user.id;
  lastValidatedAt = Date.now();
}

async function createValidatedAnonymousClient() {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.auth.getSession();

  if (error) throw error;

  if (data.session) {
    const recentlyValidated =
      lastValidatedUserId === data.session.user.id &&
      Date.now() - lastValidatedAt < SESSION_VALIDATION_MAX_AGE_MS;

    if (recentlyValidated) return client;

    const { data: userData, error: userError } = await client.auth.getUser();
    if (!userError && userData.user) {
      lastValidatedUserId = userData.user.id;
      lastValidatedAt = Date.now();
      return client;
    }

    if (!isRecoverableAuthError(userError)) throw userError;

    const { error: signOutError } = await client.auth.signOut({
      scope: "local",
    });
    if (signOutError) throw signOutError;
    lastValidatedUserId = undefined;
    lastValidatedAt = 0;
  }

  await signInAnonymously(client);
  return client;
}

export function ensureAnonymousSession(): Promise<SupabaseClient> {
  if (anonymousSessionPromise) {
    return anonymousSessionPromise;
  }

  const pending = createValidatedAnonymousClient();
  anonymousSessionPromise = pending;
  void pending.then(
    () => {
      if (anonymousSessionPromise === pending)
        anonymousSessionPromise = undefined;
    },
    () => {
      if (anonymousSessionPromise === pending)
        anonymousSessionPromise = undefined;
    },
  );

  return anonymousSessionPromise;
}

export async function renewAnonymousSession() {
  if (anonymousSessionPromise) {
    try {
      await anonymousSessionPromise;
    } catch {
      // A failed in-flight session check is replaced below.
    }
  }

  const client = getSupabaseBrowserClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;

  lastValidatedUserId = undefined;
  lastValidatedAt = 0;
  return ensureAnonymousSession();
}
