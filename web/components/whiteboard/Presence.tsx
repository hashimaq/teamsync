"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  firstName,
  initialsFromName,
  type WhiteboardPresenceMeta,
} from "@/lib/whiteboard";
import { cn } from "@/utils";

interface PresenceProps {
  peers: WhiteboardPresenceMeta[];
  isConnected: boolean;
  className?: string;
}

export function Presence({ peers, isConnected, className }: PresenceProps) {
  if (peers.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          className
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isConnected ? "bg-emerald-500" : "bg-muted-foreground/50"
          )}
        />
        {isConnected ? "Only you on the board" : "Connecting…"}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex -space-x-2">
        {peers.slice(0, 6).map((peer) => (
          <Avatar
            key={peer.userId}
            className="h-7 w-7 border-2 border-card"
            style={{ boxShadow: `0 0 0 2px ${peer.color}` }}
            title={`${peer.userName} · ${peer.status}`}
          >
            {peer.avatarUrl ? (
              <AvatarImage src={peer.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback
              className="text-[9px] font-semibold text-white"
              style={{ backgroundColor: peer.color }}
            >
              {initialsFromName(peer.userName)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="min-w-0 text-xs text-muted-foreground">
        {peers.map((peer) => (
          <span key={peer.userId} className="mr-2 inline-block">
            <span className="font-medium text-foreground">
              {firstName(peer.userName)}
            </span>{" "}
            {peer.status === "drawing" ? "drawing…" : "viewing…"}
          </span>
        ))}
      </div>
    </div>
  );
}
