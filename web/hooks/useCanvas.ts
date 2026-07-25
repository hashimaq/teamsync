"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import {
  createStrokeId,
  mapPointToSurface,
  mapSizeToSurface,
  mapStrokeToSurface,
  paintAllStrokes,
  paintSegment,
  paintStroke,
  quantizePoint,
  type WhiteboardBroadcastEvent,
  type WhiteboardDrawingData,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardSurface,
  type WhiteboardTool,
} from "@/lib/whiteboard";

export interface UseCanvasOptions {
  initialDrawing?: WhiteboardDrawingData | null;
  color: string;
  brushSize: number;
  tool: WhiteboardTool;
  userId: string | null;
  workspaceId: string;
  /** Broadcast local segment / stroke / clear / undo / redo */
  onLocalEvent?: (event: WhiteboardBroadcastEvent) => void;
  onDrawingChange?: (isDrawing: boolean) => void;
  onCursorMove?: (point: WhiteboardPoint) => void;
}

export interface UseCanvasResult {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isDrawing: boolean;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  strokes: WhiteboardStroke[];
  markClean: () => void;
  getDrawingData: () => WhiteboardDrawingData;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  loadDrawing: (data: WhiteboardDrawingData) => void;
  downloadPng: (filename?: string) => void;
  /** Apply a remote broadcast without echoing back */
  applyRemoteEvent: (event: WhiteboardBroadcastEvent) => void;
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerLeave: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  };
}

function getCssPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): WhiteboardPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/**
 * Collaborative canvas engine.
 * Local drawing paints immediately and broadcasts segments.
 * Remote segments paint concurrently without clobbering local strokes.
 */
export function useCanvas(options: UseCanvasOptions): UseCanvasResult {
  const {
    initialDrawing,
    color,
    brushSize,
    tool,
    userId,
    workspaceId,
    onLocalEvent,
    onDrawingChange,
    onCursorMove,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dprRef = useRef(1);
  const cssSizeRef = useRef({ width: 0, height: 0 });

  const colorRef = useRef(color);
  const brushSizeRef = useRef(brushSize);
  const toolRef = useRef(tool);
  const userIdRef = useRef(userId);
  const workspaceIdRef = useRef(workspaceId);
  const onLocalEventRef = useRef(onLocalEvent);
  const onDrawingChangeRef = useRef(onDrawingChange);
  const onCursorMoveRef = useRef(onCursorMove);

  colorRef.current = color;
  brushSizeRef.current = brushSize;
  toolRef.current = tool;
  userIdRef.current = userId;
  workspaceIdRef.current = workspaceId;
  onLocalEventRef.current = onLocalEvent;
  onDrawingChangeRef.current = onDrawingChange;
  onCursorMoveRef.current = onCursorMove;

  const history = useUndoRedo<WhiteboardStroke[]>(
    initialDrawing?.strokes ?? []
  );

  /** In-progress remote strokes (concurrent with local drawing) */
  const remoteLiveRef = useRef<Map<string, WhiteboardStroke>>(new Map());
  /** Local strokes we own — for undo scope */
  const localStrokeIdsRef = useRef<string[]>([]);
  const undoneLocalRef = useRef<WhiteboardStroke[]>([]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const lastPointRef = useRef<WhiteboardPoint | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPointRef = useRef<WhiteboardPoint | null>(null);

  const syncUndoFlags = useCallback(() => {
    setCanUndo(localStrokeIdsRef.current.length > 0);
    setCanRedo(undoneLocalRef.current.length > 0);
  }, []);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
    return { canvas, ctx };
  }, []);

  const redrawCommitted = useCallback(
    (strokes: WhiteboardStroke[]) => {
      const surface = getCtx();
      if (!surface) return;
      const { canvas, ctx } = surface;
      paintAllStrokes(ctx, strokes, canvas.width, canvas.height);

      // Re-paint any in-progress remote strokes after clear
      for (const live of remoteLiveRef.current.values()) {
        paintStroke(ctx, live);
      }
    },
    [getCtx]
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const strokes = history.getPresent();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(container.clientWidth));
    const height = Math.max(1, Math.floor(container.clientHeight));

    dprRef.current = dpr;
    cssSizeRef.current = { width, height };

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paintAllStrokes(ctx, strokes, canvas.width, canvas.height);
    for (const live of remoteLiveRef.current.values()) {
      paintStroke(ctx, live);
    }
  }, [history]);

  useEffect(() => {
    resizeCanvas();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(container);
    window.addEventListener("orientationchange", resizeCanvas);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", resizeCanvas);
    };
  }, [resizeCanvas]);

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (didLoadRef.current) return;
    if (!initialDrawing) return;
    didLoadRef.current = true;
    history.replace(initialDrawing.strokes);
    requestAnimationFrame(() => redrawCommitted(initialDrawing.strokes));
  }, [initialDrawing, history, redrawCommitted]);

  const emit = useCallback((event: WhiteboardBroadcastEvent) => {
    onLocalEventRef.current?.(event);
  }, []);

  const localSurface = useCallback((): WhiteboardSurface => {
    const size = cssSizeRef.current;
    return {
      w: Math.max(1, size.width),
      h: Math.max(1, size.height),
    };
  }, []);

  const lastBroadcastAtRef = useRef(0);
  const BROADCAST_MIN_MS = 24;

  const flushPendingPoint = useCallback(() => {
    rafRef.current = null;
    const stroke = currentStrokeRef.current;
    const point = pendingPointRef.current;
    const surface = getCtx();
    if (!stroke || !point || !surface) return;

    const from = lastPointRef.current ?? stroke.points[stroke.points.length - 1]!;
    const to = quantizePoint(point);
    pendingPointRef.current = null;

    if (from.x === to.x && from.y === to.y) return;

    stroke.points.push(to);
    lastPointRef.current = to;
    paintSegment(
      surface.ctx,
      stroke.tool,
      stroke.color,
      stroke.size,
      from,
      to
    );

    const uid = userIdRef.current;
    if (!uid) return;

    const now = performance.now();
    // Throttle network; local paint stays full-rate. stroke_end reconciles gaps.
    if (now - lastBroadcastAtRef.current < BROADCAST_MIN_MS) return;
    lastBroadcastAtRef.current = now;

    emit({
      type: stroke.tool === "eraser" ? "erase" : "draw",
      strokeId: stroke.id,
      tool: stroke.tool,
      color: stroke.color,
      size: stroke.size,
      from,
      to,
      surface: localSurface(),
      userId: uid,
      workspaceId: workspaceIdRef.current,
    });
  }, [emit, getCtx, localSurface]);

  const endStroke = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      setIsDrawing(false);
      onDrawingChangeRef.current?.(false);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        flushPendingPoint();
      }

      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      lastPointRef.current = null;
      lastBroadcastAtRef.current = 0;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }

      if (!stroke || stroke.points.length === 0) return;

      const next = [...history.getPresent(), stroke];
      history.set(next);
      localStrokeIdsRef.current = [...localStrokeIdsRef.current, stroke.id];
      undoneLocalRef.current = [];
      syncUndoFlags();
      setIsDirty(true);

      const uid = userIdRef.current;
      if (uid) {
        // Always send the complete stroke so peers can reconcile dropped segments
        emit({
          type: "stroke_end",
          stroke,
          surface: localSurface(),
          userId: uid,
          workspaceId: workspaceIdRef.current,
        });
      }
    },
    [emit, flushPendingPoint, history, localSurface, syncUndoFlags]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      // Touch/pen often report button as -1 or 0; only ignore non-primary mouse buttons
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);

      const point = quantizePoint(
        getCssPoint(canvas, event.clientX, event.clientY)
      );
      const stroke: WhiteboardStroke = {
        id: createStrokeId(),
        tool: toolRef.current,
        color: colorRef.current,
        size: brushSizeRef.current,
        points: [point],
        userId: userIdRef.current ?? undefined,
      };

      currentStrokeRef.current = stroke;
      lastPointRef.current = point;
      lastBroadcastAtRef.current = 0;
      drawingRef.current = true;
      setIsDrawing(true);
      onDrawingChangeRef.current?.(true);

      const ctxSurface = getCtx();
      if (ctxSurface) {
        paintStroke(ctxSurface.ctx, stroke);
      }

      onCursorMoveRef.current?.(point);

      const uid = userIdRef.current;
      if (uid) {
        emit({
          type: stroke.tool === "eraser" ? "erase" : "draw",
          strokeId: stroke.id,
          tool: stroke.tool,
          color: stroke.color,
          size: stroke.size,
          from: point,
          to: { x: point.x + 0.01, y: point.y + 0.01 },
          surface: localSurface(),
          userId: uid,
          workspaceId: workspaceIdRef.current,
        });
      }
    },
    [emit, getCtx, localSurface]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const point = getCssPoint(canvas, event.clientX, event.clientY);
      onCursorMoveRef.current?.(quantizePoint(point));

      if (!drawingRef.current) return;
      event.preventDefault();
      pendingPointRef.current = point;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPendingPoint);
      }
    },
    [flushPendingPoint]
  );

  const undo = useCallback(() => {
    const ids = localStrokeIdsRef.current;
    if (ids.length === 0) return;
    const strokeId = ids[ids.length - 1]!;
    const present = history.getPresent();
    const stroke = present.find((s) => s.id === strokeId);
    if (!stroke) {
      localStrokeIdsRef.current = ids.slice(0, -1);
      return;
    }

    const next = present.filter((s) => s.id !== strokeId);
    history.set(next);
    localStrokeIdsRef.current = ids.slice(0, -1);
    undoneLocalRef.current = [...undoneLocalRef.current, stroke];
    syncUndoFlags();
    redrawCommitted(next);
    setIsDirty(true);

    const uid = userIdRef.current;
    if (uid) {
      emit({
        type: "undo",
        strokeId,
        userId: uid,
        workspaceId: workspaceIdRef.current,
      });
    }
  }, [emit, history, redrawCommitted, syncUndoFlags]);

  const redo = useCallback(() => {
    const stack = undoneLocalRef.current;
    if (stack.length === 0) return;
    const stroke = stack[stack.length - 1]!;
    undoneLocalRef.current = stack.slice(0, -1);

    const next = [...history.getPresent(), stroke];
    history.set(next);
    localStrokeIdsRef.current = [...localStrokeIdsRef.current, stroke.id];
    syncUndoFlags();
    redrawCommitted(next);
    setIsDirty(true);

    const uid = userIdRef.current;
    if (uid) {
      emit({
        type: "redo",
        stroke,
        surface: localSurface(),
        userId: uid,
        workspaceId: workspaceIdRef.current,
      });
    }
  }, [emit, history, localSurface, redrawCommitted, syncUndoFlags]);

  const clear = useCallback(() => {
    history.set([]);
    remoteLiveRef.current.clear();
    localStrokeIdsRef.current = [];
    undoneLocalRef.current = [];
    syncUndoFlags();
    redrawCommitted([]);
    setIsDirty(true);

    const uid = userIdRef.current;
    if (uid) {
      emit({
        type: "clear",
        userId: uid,
        workspaceId: workspaceIdRef.current,
      });
    }
  }, [emit, history, redrawCommitted, syncUndoFlags]);

  const loadDrawing = useCallback(
    (data: WhiteboardDrawingData) => {
      remoteLiveRef.current.clear();
      localStrokeIdsRef.current = [];
      undoneLocalRef.current = [];
      syncUndoFlags();

      const target = localSurface();
      const source: WhiteboardSurface | null =
        data.width && data.height && data.width > 0 && data.height > 0
          ? { w: data.width, h: data.height }
          : null;

      const strokes =
        source && (source.w !== target.w || source.h !== target.h)
          ? data.strokes.map((stroke) => mapStrokeToSurface(stroke, source, target))
          : data.strokes;

      history.replace(strokes);
      redrawCommitted(strokes);
      setIsDirty(false);
    },
    [history, localSurface, redrawCommitted, syncUndoFlags]
  );

  const applyRemoteEvent = useCallback(
    (event: WhiteboardBroadcastEvent) => {
      const ctxSurface = getCtx();
      const target = localSurface();

      if (event.type === "draw" || event.type === "erase") {
        const fromSurface = event.surface ?? target;
        const from = mapPointToSurface(event.from, fromSurface, target);
        const to = mapPointToSurface(event.to, fromSurface, target);
        const size = mapSizeToSurface(event.size, fromSurface, target);

        const live =
          remoteLiveRef.current.get(event.strokeId) ??
          ({
            id: event.strokeId,
            tool: event.tool,
            color: event.color,
            size,
            points: [from],
            userId: event.userId,
          } satisfies WhiteboardStroke);

        live.size = size;
        live.points.push(to);
        remoteLiveRef.current.set(event.strokeId, live);

        if (ctxSurface) {
          paintSegment(ctxSurface.ctx, event.tool, event.color, size, from, to);
        }
        return;
      }

      if (event.type === "stroke_end") {
        remoteLiveRef.current.delete(event.stroke.id);
        const fromSurface = event.surface ?? target;
        const mapped = mapStrokeToSurface(event.stroke, fromSurface, target);
        const present = history.getPresent();
        const without = present.filter((s) => s.id !== mapped.id);
        const next = [...without, mapped];
        history.set(next, { skipHistory: true });
        setIsDirty(true);
        // Always full redraw — reconciles any segments dropped by the network
        redrawCommitted(next);
        return;
      }

      if (event.type === "clear") {
        remoteLiveRef.current.clear();
        history.replace([]);
        localStrokeIdsRef.current = [];
        undoneLocalRef.current = [];
        syncUndoFlags();
        redrawCommitted([]);
        setIsDirty(true);
        return;
      }

      if (event.type === "undo") {
        remoteLiveRef.current.delete(event.strokeId);
        const next = history.getPresent().filter((s) => s.id !== event.strokeId);
        history.replace(next);
        redrawCommitted(next);
        setIsDirty(true);
        return;
      }

      if (event.type === "redo") {
        const fromSurface = event.surface ?? target;
        const mapped = mapStrokeToSurface(event.stroke, fromSurface, target);
        const present = history.getPresent();
        if (present.some((s) => s.id === mapped.id)) return;
        const next = [...present, mapped];
        history.replace(next);
        redrawCommitted(next);
        setIsDirty(true);
      }
    },
    [getCtx, history, localSurface, redrawCommitted, syncUndoFlags]
  );

  const getDrawingData = useCallback((): WhiteboardDrawingData => {
    const { width, height } = cssSizeRef.current;
    return {
      version: 1,
      strokes: history.getPresent(),
      width,
      height,
    };
  }, [history]);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const downloadPng = useCallback((filename = "whiteboard.png") => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    const isDark = document.documentElement.classList.contains("dark");
    exportCtx.fillStyle = isDark ? "#0f172a" : "#ffffff";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = filename;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }, []);

  return {
    canvasRef,
    containerRef,
    isDrawing,
    isDirty,
    canUndo,
    canRedo,
    strokes: history.present,
    markClean,
    getDrawingData,
    undo,
    redo,
    clear,
    loadDrawing,
    downloadPng,
    applyRemoteEvent,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endStroke,
      // Do NOT end on leave — pointer capture continues; leave aborts mid-stroke on some devices
      onPointerLeave: (_event: ReactPointerEvent<HTMLCanvasElement>) => {
        // Keep stroke alive while pointer is captured (touch/pen leave is noisy)
      },
      onPointerCancel: endStroke,
    },
  };
}
