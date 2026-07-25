"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-border px-6 py-16 text-center">
      <h2 className="font-display text-2xl font-semibold">Workspace unavailable</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        {error.message || "We could not load this workspace."}
      </p>
      <div className="mt-6 flex gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
