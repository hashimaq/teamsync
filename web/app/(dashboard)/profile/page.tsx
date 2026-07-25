import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCachedProfile, getCachedUser } from "@/lib/data";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const [user, profile] = await Promise.all([getCachedUser(), getCachedProfile()]);

  if (!user || !profile) {
    redirect("/login");
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Your profile
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Manage your personal details and how you appear across TeamSync.
        </p>
      </div>
      <ProfileForm profile={profile} email={user.email} />
    </div>
  );
}
