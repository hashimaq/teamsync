"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Check, Mail } from "lucide-react";
import { updateProfile } from "@/actions/auth";
import { profileSchema, type ProfileInput } from "@/lib/validations";
import type { Profile } from "@/types";
import { formatDate } from "@/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface ProfileFormProps {
  profile: Profile;
  email?: string;
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
    },
  });

  const fullName = watch("full_name");
  const initials = (fullName || profile.full_name || "TS")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onSubmit = handleSubmit((values) => {
    setError(null);
    setSuccess(false);
    const formData = new FormData();
    formData.set("full_name", values.full_name);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={fullName || "Profile"} />
            ) : null}
            <AvatarFallback className="bg-muted text-lg font-semibold text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {fullName || "Your name"}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <p className="mt-1 truncate text-sm font-medium">{email ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-border bg-background px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Member since
                </div>
                <p className="mt-1 text-sm font-medium">{formatDate(profile.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div>
          <h3 className="font-display text-lg font-semibold">Personal details</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your display name. Your avatar comes from your signed-in account.
          </p>
        </div>

        <Separator className="my-6" />

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="full_name">Display name</Label>
            <Input
              id="full_name"
              className="h-11 max-w-md"
              placeholder="Your full name"
              {...register("full_name")}
            />
            {errors.full_name ? (
              <p className="text-sm text-destructive">{errors.full_name.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                This name appears in the sidebar and across your workspaces.
              </p>
            )}
          </div>

          {error ? (
            <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="inline-flex items-center gap-2 text-sm text-foreground">
              <Check className="h-4 w-4" />
              Profile updated successfully
            </p>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={isPending || !isDirty}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
            {!isDirty && !success ? (
              <span className="text-xs text-muted-foreground">No unsaved changes</span>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
