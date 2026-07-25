import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-background to-rose-50/60 dark:from-slate-950 dark:via-background dark:to-slate-950" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-semibold">TeamSync</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
      </div>
    </div>
  );
}
