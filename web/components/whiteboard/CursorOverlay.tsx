"use client";

import type { WhiteboardPeerCursor } from "@/hooks/useWhiteboardRealtime";
import { cn } from "@/utils";

interface CursorOverlayProps {
  cursors: WhiteboardPeerCursor[];
  className?: string;
}

/** Live peer cursors — positioned in CSS pixel space over the canvas. */
export function CursorOverlay({ cursors, className }: CursorOverlayProps) {
  if (cursors.length === 0) return null;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-10 overflow-hidden", className)}
      aria-hidden
    >
      {cursors.map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
          }}
        >
          <svg
            width="18"
            height="22"
            viewBox="0 0 18 22"
            fill="none"
            className="drop-shadow-sm"
          >
            <path
              d="M1 1L16 10.5L9.2 12.2L6.5 20L1 1Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="mt-0.5 ml-3 inline-block max-w-[8rem] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.userName}
          </span>
        </div>
      ))}
    </div>
  );
}
