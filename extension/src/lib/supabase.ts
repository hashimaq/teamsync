import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const WEB_URL =
  (import.meta.env.VITE_WEB_URL as string | undefined) ||
  "https://teamsync-chi.vercel.app";

function assertEnv(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy extension/.env.example to extension/.env"
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

/** Chrome storage-backed auth so the session survives service worker restarts. */
const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const result = await chrome.storage.local.get(key);
    const value = result[key];
    return typeof value === "string" ? value : null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { url, key } = assertEnv();
  client = createClient(url, key, {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}
