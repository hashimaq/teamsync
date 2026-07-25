import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WorkspaceNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-border px-6 py-16 text-center">
      <h2 className="font-display text-2xl font-semibold">Workspace not found</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        This workspace does not exist or you do not have access to it.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
