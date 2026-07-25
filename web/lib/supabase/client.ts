import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (singleton). Explicit so Realtime shares one socket. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  );
}
