/**
 * Whiteboard domain: stroke geometry, broadcast events, presence helpers.
 * Shared one board per workspace — live sync via Supabase Broadcast.
 */

export type WhiteboardTool = "pencil" | "eraser";

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  tool: WhiteboardTool;
  color: string;
  size: number;
  points: WhiteboardPoint[];
  /** Author — used for concurrent undo / presence */
  userId?: string;
}

export interface WhiteboardDrawingData {
  version: 1;
  strokes: WhiteboardStroke[];
  width?: number;
  height?: number;
}

export const EMPTY_DRAWING: WhiteboardDrawingData = {
  version: 1,
  strokes: [],
};

export const WHITEBOARD_COLORS = [
  "#0f172a",
  "#1d4ed8",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#e11d48",
  "#9333ea",
  "#ffffff",
] as const;

export type WhiteboardPresetColor = (typeof WHITEBOARD_COLORS)[number];

/** Presence / cursor palette — one stable color per user id */
export const PRESENCE_PALETTE = [
  "#2563eb",
  "#db2777",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#e11d48",
  "#4f46e5",
] as const;

export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_PALETTE[hash % PRESENCE_PALETTE.length]!;
}

export const WORKSPACE_WHITEBOARD_CHANNEL = (workspaceId: string) =>
  `whiteboard:${workspaceId}`;

export const WB_EVENT = "whiteboard" as const;

export type WhiteboardPresenceStatus = "viewing" | "drawing";

export interface WhiteboardPresenceMeta {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  color: string;
  status: WhiteboardPresenceStatus;
  onlineAt: string;
}

/** Live segment while pointer moves (draw or erase). */
export interface WhiteboardSegmentEvent {
  type: "draw" | "erase";
  strokeId: string;
  tool: WhiteboardTool;
  color: string;
  size: number;
  from: WhiteboardPoint;
  to: WhiteboardPoint;
  /** Sender CSS canvas size — required to map onto peer surfaces */
  surface: WhiteboardSurface;
  userId: string;
  workspaceId: string;
}

export interface WhiteboardSurface {
  w: number;
  h: number;
}

export interface WhiteboardStrokeEndEvent {
  type: "stroke_end";
  stroke: WhiteboardStroke;
  surface: WhiteboardSurface;
  userId: string;
  workspaceId: string;
}

export interface WhiteboardClearEvent {
  type: "clear";
  userId: string;
  workspaceId: string;
}

export interface WhiteboardUndoEvent {
  type: "undo";
  strokeId: string;
  userId: string;
  workspaceId: string;
}

export interface WhiteboardRedoEvent {
  type: "redo";
  stroke: WhiteboardStroke;
  surface: WhiteboardSurface;
  userId: string;
  workspaceId: string;
}

export interface WhiteboardCursorEvent {
  type: "cursor";
  userId: string;
  workspaceId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  surface: WhiteboardSurface;
}

export type WhiteboardBroadcastEvent =
  | WhiteboardSegmentEvent
  | WhiteboardStrokeEndEvent
  | WhiteboardClearEvent
  | WhiteboardUndoEvent
  | WhiteboardRedoEvent
  | WhiteboardCursorEvent;

export function createStrokeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isWhiteboardDrawingData(
  value: unknown
): value is WhiteboardDrawingData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (data.version !== 1) return false;
  if (!Array.isArray(data.strokes)) return false;
  return true;
}

export function parseDrawingData(value: unknown): WhiteboardDrawingData {
  if (isWhiteboardDrawingData(value)) {
    return {
      version: 1,
      strokes: value.strokes.filter(
        (stroke): stroke is WhiteboardStroke =>
          Boolean(stroke) &&
          typeof stroke === "object" &&
          typeof stroke.id === "string" &&
          (stroke.tool === "pencil" || stroke.tool === "eraser") &&
          typeof stroke.color === "string" &&
          typeof stroke.size === "number" &&
          Array.isArray(stroke.points)
      ),
      width: typeof value.width === "number" ? value.width : undefined,
      height: typeof value.height === "number" ? value.height : undefined,
    };
  }
  return { ...EMPTY_DRAWING, strokes: [] };
}

export function serializeDrawingData(
  strokes: WhiteboardStroke[],
  size?: { width: number; height: number }
): WhiteboardDrawingData {
  return {
    version: 1,
    strokes,
    width: size?.width,
    height: size?.height,
  };
}

export function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Pick<WhiteboardStroke, "tool" | "color" | "size" | "points">
): void {
  if (stroke.points.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size;

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }

  ctx.beginPath();
  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);

  if (rest.length === 0) {
    ctx.lineTo(first.x + 0.01, first.y + 0.01);
  } else {
    for (const point of rest) {
      ctx.lineTo(point.x, point.y);
    }
  }

  ctx.stroke();
  ctx.restore();
}

export function paintSegment(
  ctx: CanvasRenderingContext2D,
  tool: WhiteboardTool,
  color: string,
  size: number,
  from: WhiteboardPoint,
  to: WhiteboardPoint
): void {
  paintStroke(ctx, {
    tool,
    color,
    size,
    points: [from, to],
  });
}

export function paintAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: WhiteboardStroke[],
  clearWidth: number,
  clearHeight: number
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, clearWidth, clearHeight);
  ctx.restore();

  for (const stroke of strokes) {
    paintStroke(ctx, stroke);
  }
}

export function firstName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "Someone";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function initialsFromName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Round coords to cut broadcast payload size without visible loss */
export function quantizePoint(point: WhiteboardPoint): WhiteboardPoint {
  return {
    x: Math.round(point.x * 10) / 10,
    y: Math.round(point.y * 10) / 10,
  };
}

export function mapPointToSurface(
  point: WhiteboardPoint,
  from: WhiteboardSurface,
  to: WhiteboardSurface
): WhiteboardPoint {
  if (from.w <= 0 || from.h <= 0 || to.w <= 0 || to.h <= 0) {
    return point;
  }
  return quantizePoint({
    x: (point.x / from.w) * to.w,
    y: (point.y / from.h) * to.h,
  });
}

export function mapSizeToSurface(
  size: number,
  from: WhiteboardSurface,
  to: WhiteboardSurface
): number {
  if (from.w <= 0 || to.w <= 0) return size;
  const scale = (to.w / from.w + to.h / from.h) / 2;
  return Math.max(1, Math.round(size * scale * 10) / 10);
}

export function mapStrokeToSurface(
  stroke: WhiteboardStroke,
  from: WhiteboardSurface,
  to: WhiteboardSurface
): WhiteboardStroke {
  return {
    ...stroke,
    size: mapSizeToSurface(stroke.size, from, to),
    points: stroke.points.map((point) => mapPointToSurface(point, from, to)),
  };
}

export function isValidSurface(value: unknown): value is WhiteboardSurface {
  if (!value || typeof value !== "object") return false;
  const surface = value as WhiteboardSurface;
  return (
    typeof surface.w === "number" &&
    typeof surface.h === "number" &&
    surface.w > 0 &&
    surface.h > 0
  );
}

export function isWhiteboardBroadcastEvent(
  value: unknown
): value is WhiteboardBroadcastEvent {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "draw" ||
    type === "erase" ||
    type === "stroke_end" ||
    type === "clear" ||
    type === "undo" ||
    type === "redo" ||
    type === "cursor"
  );
}
