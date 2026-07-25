"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Folders,
  UserRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { logout } from "@/actions/auth";
import { BrandMark } from "@/components/layout/brand-mark";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Workspaces", icon: Folders },
  { href: "/profile", label: "Profile", icon: UserRound },
];

interface SidebarProps {
  userName?: string | null;
  userId?: string | null;
}

export function Sidebar({ userName, userId = null }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Prefetch siblings when sidebar mounts / route changes
  void pathname;

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight">TeamSync</p>
            <p className="text-xs text-muted-foreground">Stay in sync</p>
          </div>
        </div>
        <NotificationBell userId={userId} />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-border p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName ?? "Account"}</p>
            <p className="text-xs text-muted-foreground">Signed in</p>
          </div>
          <ThemeToggle />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          disabled={isPending}
          onClick={() => startTransition(() => logout())}
        >
          <LogOut className="h-4 w-4" />
          {isPending ? "Signing out..." : "Logout"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        {content}
      </aside>

      <div className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <BrandMark className="h-8 w-8" iconClassName="h-4 w-4" />
          <span className="font-display font-semibold">TeamSync</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Toggle menu"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-30 bg-background pt-14 lg:hidden">{content}</div>
      ) : null}
    </>
  );
}
