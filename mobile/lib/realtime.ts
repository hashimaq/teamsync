import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Drop any leaked channel with the same topic so `.on()` is never called after `subscribe()`. */
export function freshChannel(name: string): RealtimeChannel {
  const topic = `realtime:${name}`;
  for (const channel of supabase.getChannels()) {
    if (channel.topic === topic) {
      void supabase.removeChannel(channel);
    }
  }
  return supabase.channel(name);
}
