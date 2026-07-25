"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/supabase/profile";
import {
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  signUpSchema,
} from "@/lib/validations";
import type { ActionResult, Profile } from "@/types";

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.full_name,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data.user) {
    await ensureUserProfile(supabase, data.user);
  }

  redirect("/dashboard");
}

export async function login(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data.user) {
    await ensureUserProfile(supabase, data.user);
  }

  redirect("/dashboard");
}

export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://teamsync-chi.vercel.app";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/login`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: undefined,
  };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const { getCachedProfile } = await import("@/lib/data");
  return getCachedProfile();
}

export async function updateProfile(formData: FormData): Promise<ActionResult<Profile>> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true, data: data as Profile };
}
