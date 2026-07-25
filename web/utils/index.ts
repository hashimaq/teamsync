import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TaskPriority, TaskStatus } from "@/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null): string {
  if (!date) return "No due date";
  // Prefer calendar parts for date-only values to avoid SSR/client TZ shifts.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.slice(0, 10));
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-lime-500/20 text-lime-800 dark:text-lime-300 border-lime-500/40",
  medium: "bg-amber-400/25 text-amber-800 dark:text-amber-300 border-amber-500/40",
  high: "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35",
  in_progress: "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/40",
  done: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40",
};
