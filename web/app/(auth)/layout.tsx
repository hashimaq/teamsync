import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-background to-rose-50/60 dark:from-slate-950 dark:via-background dark:to-slate-950" />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-semibold">TeamSync</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center overflow-y-auto py-10 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </div>
  );
}
