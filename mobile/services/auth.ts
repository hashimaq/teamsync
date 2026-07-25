import { WEB_URL, supabase } from "@/lib/supabase";
import type { Profile } from "@teamsync/shared";
import type { LoginInput, SignUpInput } from "@/lib/validations";

export async function ensureProfile(userId: string): Promise<Profile | null> {
  try {
    await supabase.rpc("ensure_profile", {
      p_full_name: null,
      p_avatar_url: null,
    });
  } catch {
    // Profile may already exist — continue.
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export async function signIn(input: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) throw new Error(error.message);
  if (data.user) await ensureProfile(data.user.id);
  return data;
}

export async function signUp(input: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: { full_name: input.full_name.trim() },
    },
  });
  if (error) throw new Error(error.message);
  if (data.user) await ensureProfile(data.user.id);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${WEB_URL}/login`,
  });
  if (error) throw new Error(error.message);
}

export async function getProfile(userId: string) {
  return ensureProfile(userId);
}

export async function updateProfile(
  userId: string,
  patch: { full_name: string; avatar_url?: string | null }
) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: patch.full_name,
      avatar_url: patch.avatar_url || null,
    })
    .eq("id", userId)
    .select("id, full_name, avatar_url, email, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}
