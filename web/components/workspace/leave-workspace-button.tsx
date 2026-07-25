"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { leaveWorkspace } from "@/actions/members";
import { broadcastMemberLeft } from "@/lib/realtime/broadcast";
import { markLeavingWorkspace } from "@/lib/realtime/leave-intent";
import { Button } from "@/components/ui/button";

interface LeaveWorkspaceButtonProps {
  workspaceId: string;
  displayName: string;
  userId: string;
}

export function LeaveWorkspaceButton({
  workspaceId,
  displayName,
  userId,
}: LeaveWorkspaceButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Leave this workspace?")) return;
          setError(null);
          startTransition(async () => {
            markLeavingWorkspace(workspaceId);

            const firstName = displayName.trim().split(" ")[0] || "Someone";
            try {
              await broadcastMemberLeft(workspaceId, {
                user_id: userId,
                display_name: firstName,
              });
            } catch {
              // Broadcast is best-effort; membership leave still proceeds.
            }

            const result = await leaveWorkspace(workspaceId);
            if (!result.success) {
              setError(result.error);
              return;
            }

            toast.message("You left the workspace.");
            router.replace("/dashboard");
            router.refresh();
          });
        }}
      >
        <LogOut className="h-4 w-4" />
        {isPending ? "Leaving..." : "Leave Workspace"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
