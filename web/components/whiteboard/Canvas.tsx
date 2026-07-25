"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { cn } from "@/utils";

interface CanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  cursor: string;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  overlay?: ReactNode;
  className?: string;
}

/**
 * Presentational canvas surface. Drawing state lives in useCanvas — not React state.
 */
export function Canvas({
  canvasRef,
  containerRef,
  cursor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  overlay,
  className,
}: CanvasProps) {
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border",
        "bg-card shadow-[0_8px_30px_rgba(15,23,42,0.06)]",
        "dark:bg-slate-950 dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        "bg-[linear-gradient(to_right,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.14)_1px,transparent_1px)]",
        "bg-[size:24px_24px]",
        "dark:bg-[linear-gradient(to_right,rgba(51,65,85,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(51,65,85,0.5)_1px,transparent_1px)]",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 h-full w-full touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerCancel}
      />
      {overlay}
    </div>
  );
}
