"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition, type ComponentType } from "react";
import { cn } from "@/utils";

interface NavLinkProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onNavigate?: () => void;
}

export function NavLink({ href, label, icon: Icon, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        if (pathname === href) return;
        startTransition(() => {
          router.push(href);
        });
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150",
        active || isPending
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        isPending && !active && "opacity-80"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
