import { firstName } from "@teamsync/shared";
import type { ExtensionUser } from "@/hooks/useExtensionData";
import { cn } from "@/lib/utils";

export function UserHeader({
  user,
  online,
}: {
  user: ExtensionUser;
  online: boolean;
}) {
  const name = user.profile?.full_name?.trim() || user.email || "User";
  const initials = firstName(name).slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        {user.profile?.avatar_url ? (
          <img
            src={user.profile.avatar_url}
            alt=""
            className="h-10 w-10 rounded-full border border-slate-700 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/30 text-xs font-bold text-blue-300">
            {initials}
          </div>
        )}
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950",
            online ? "bg-emerald-400" : "bg-slate-500"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-50">{name}</p>
        <p className="text-[11px] text-slate-400">
          {online ? "Online · synced" : "Connecting…"}
        </p>
      </div>
    </div>
  );
}
