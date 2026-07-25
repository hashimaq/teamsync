"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getLatestWhiteboard,
  saveWhiteboard,
} from "@/actions/whiteboard";
import { Canvas } from "@/components/whiteboard/Canvas";
import { CursorOverlay } from "@/components/whiteboard/CursorOverlay";
import { Presence } from "@/components/whiteboard/Presence";
import { Toolbar } from "@/components/whiteboard/Toolbar";
import { useCanvas } from "@/hooks/useCanvas";
import { useWhiteboardRealtime } from "@/hooks/useWhiteboardRealtime";
import type {
  WhiteboardBroadcastEvent,
  WhiteboardDrawingData,
  WhiteboardTool,
} from "@/lib/whiteboard";
import type { WhiteboardRecord } from "@/types";
import { cn } from "@/utils";

const AUTO_SAVE_MS = 30_000;

interface WhiteboardProps {
  workspaceId: string;
  workspaceName?: string;
  userId: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  initialRecord?: WhiteboardRecord | null;
}

export function Whiteboard({
  workspaceId,
  workspaceName,
  userId,
  userName = null,
  userAvatar = null,
  initialRecord = null,
}: WhiteboardProps) {
  const [tool, setTool] = useState<WhiteboardTool>("pencil");
  const [color, setColor] = useState("#1d4ed8");
  const [brushSize, setBrushSize] = useState(4);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(
    initialRecord?.id ?? null
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialRecord?.updated_at ?? null
  );
  const [isSaving, startSave] = useTransition();
  const [isLoading, setIsLoading] = useState(!initialRecord);

  const rootRef = useRef<HTMLElement | null>(null);
  const savingLockRef = useRef(false);
  const recordIdRef = useRef<string | null>(recordId);
  recordIdRef.current = recordId;

  const applyRemoteRef = useRef<(event: WhiteboardBroadcastEvent) => void>(
    () => undefined
  );

  const localSurfaceRef = useRef({ w: 1, h: 1 });

  const realtime = useWhiteboardRealtime({
    workspaceId,
    userId,
    userName,
    avatarUrl: userAvatar,
    enabled: Boolean(userId),
    getLocalSurface: () => localSurfaceRef.current,
    onEvent: (event) => {
      applyRemoteRef.current(event);
    },
  });

  const canvas = useCanvas({
    initialDrawing: initialRecord?.drawing_data ?? null,
    color,
    brushSize,
    tool,
    userId,
    workspaceId,
    onLocalEvent: realtime.sendEvent,
    onDrawingChange: (drawing) => {
      realtime.setLocalStatus(drawing ? "drawing" : "viewing");
    },
    onCursorMove: (point) => {
      realtime.broadcastCursor(
        point.x,
        point.y,
        localSurfaceRef.current
      );
    },
  });

  useEffect(() => {
    const el = canvas.containerRef.current;
    if (!el) return;
    const sync = () => {
      localSurfaceRef.current = {
        w: Math.max(1, el.clientWidth),
        h: Math.max(1, el.clientHeight),
      };
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvas.containerRef]);

  applyRemoteRef.current = canvas.applyRemoteEvent;

  const isDirtyRef = useRef(canvas.isDirty);
  isDirtyRef.current = canvas.isDirty;
  const getDrawingDataRef = useRef(canvas.getDrawingData);
  getDrawingDataRef.current = canvas.getDrawingData;
  const markCleanRef = useRef(canvas.markClean);
  markCleanRef.current = canvas.markClean;

  useEffect(() => {
    if (initialRecord) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const latest = await getLatestWhiteboard(workspaceId);
        if (cancelled) return;
        if (latest) {
          setRecordId(latest.id);
          setLastSavedAt(latest.updated_at);
          canvas.loadDrawing(latest.drawing_data);
        }
      } catch {
        if (!cancelled) toast.error("Could not load whiteboard");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per workspace
  }, [workspaceId]);

  const persist = useCallback(
    async (reason: "manual" | "auto" | "leave") => {
      if (savingLockRef.current) return;
      if (!isDirtyRef.current && reason !== "manual") return;

      savingLockRef.current = true;
      const drawingData: WhiteboardDrawingData = getDrawingDataRef.current();

      try {
        const result = await saveWhiteboard(
          workspaceId,
          drawingData,
          recordIdRef.current
        );

        if (!result.success) {
          toast.error(result.error || "Failed to save whiteboard");
          return;
        }

        setRecordId(result.data.id);
        recordIdRef.current = result.data.id;
        setLastSavedAt(result.data.updated_at);
        markCleanRef.current();

        if (reason === "manual") {
          toast.success("Whiteboard saved");
        }
      } catch {
        toast.error("Failed to save whiteboard");
      } finally {
        savingLockRef.current = false;
      }
    },
    [workspaceId]
  );

  const handleSave = useCallback(() => {
    startSave(async () => {
      await persist("manual");
    });
  }, [persist]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isDirtyRef.current) void persist("auto");
    }, AUTO_SAVE_MS);
    return () => window.clearInterval(timer);
  }, [persist]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
      void persist("leave");
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden" && isDirtyRef.current) {
        void persist("leave");
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      if (isDirtyRef.current) void persist("leave");
    };
  }, [persist]);

  const toggleFullscreen = useCallback(async () => {
    const node = rootRef.current;
    if (!node) return;
    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("Fullscreen is not available");
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        canvas.undo();
      } else if (
        meta &&
        (event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        canvas.redo();
      } else if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canvas, handleSave]);

  const cursor = tool === "eraser" ? "cell" : "crosshair";

  const statusLabel = isLoading
    ? "Loading…"
    : !realtime.isConnected
      ? "Connecting live…"
      : isSaving
        ? "Saving…"
        : canvas.isDirty
          ? "Live · unsaved"
          : lastSavedAt
            ? `Live · saved ${formatRelative(lastSavedAt)}`
            : "Live";

  return (
    <section
      ref={rootRef}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-background",
        isFullscreen && "p-4"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">Whiteboard</h2>
          <p className="text-xs text-muted-foreground">
            Shared board{workspaceName ? ` · ${workspaceName}` : ""} ·{" "}
            {statusLabel}
          </p>
        </div>
        <Presence
          peers={realtime.peers}
          isConnected={realtime.isConnected}
          className="justify-end"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6">
        <Toolbar
          tool={tool}
          color={color}
          brushSize={brushSize}
          canUndo={canvas.canUndo}
          canRedo={canvas.canRedo}
          isSaving={isSaving}
          isDirty={canvas.isDirty}
          isFullscreen={isFullscreen}
          onToolChange={setTool}
          onColorChange={setColor}
          onBrushSizeChange={setBrushSize}
          onUndo={canvas.undo}
          onRedo={canvas.redo}
          onClear={() => {
            if (!confirm("Clear the board for everyone?")) return;
            canvas.clear();
          }}
          onDownload={() =>
            canvas.downloadPng(
              `${(workspaceName ?? "whiteboard")
                .replace(/\s+/g, "-")
                .toLowerCase()}.png`
            )
          }
          onSave={handleSave}
          onToggleFullscreen={() => {
            void toggleFullscreen();
          }}
        />

        <Canvas
          canvasRef={canvas.canvasRef}
          containerRef={canvas.containerRef}
          cursor={cursor}
          overlay={<CursorOverlay cursors={realtime.cursors} />}
          {...canvas.handlers}
        />
      </div>
    </section>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
