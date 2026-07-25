import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function getProfileFieldsFromUser(user: User) {
  const metadata = user.user_metadata ?? {};

  const fullName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    "User";

  const avatarUrl =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata.picture === "string" && metadata.picture) ||
    null;

  return {
    full_name: fullName,
    avatar_url: avatarUrl,
    email: user.email ?? null,
  };
}

export async function ensureUserProfile(
  supabase: SupabaseServerClient,
  user: User
): Promise<Profile | null> {
  const fields = getProfileFieldsFromUser(user);

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingError && existing) {
    const needsUpdate =
      (!existing.full_name && fields.full_name) ||
      (!existing.avatar_url && fields.avatar_url) ||
      (!(existing as Profile).email && fields.email);

    if (!needsUpdate) {
      return existing as Profile;
    }
  }

  const { data: ensured, error: rpcError } = await supabase.rpc("ensure_profile", {
    p_full_name: fields.full_name,
    p_avatar_url: fields.avatar_url,
  });

  if (!rpcError && ensured) {
    return ensured as Profile;
  }

  const { data: upserted, error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fields.full_name,
        avatar_url: fields.avatar_url,
        email: fields.email,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (upsertError) {
    console.error(
      "Failed to ensure profile:",
      rpcError?.message ?? upsertError.message
    );
    return (existing as Profile | null) ?? null;
  }

  return upserted as Profile;
}
