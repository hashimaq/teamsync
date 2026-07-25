import { getCachedProfile, getCachedUser } from "@/lib/data";
import { AppChrome } from "@/components/layout/app-chrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, user] = await Promise.all([
    getCachedProfile(),
    getCachedUser(),
  ]);

  return (
    <AppChrome userName={profile?.full_name} userId={user?.id ?? null}>
      {children}
    </AppChrome>
  );
}
