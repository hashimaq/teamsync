"use client";

import type { ReactNode } from "react";
import {
  Download,
  Eraser,
  Maximize2,
  Minimize2,
  Pencil,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { BrushSlider } from "@/components/whiteboard/BrushSlider";
import { ColorPicker } from "@/components/whiteboard/ColorPicker";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { WhiteboardTool } from "@/lib/whiteboard";
import { cn } from "@/utils";

interface ToolbarProps {
  tool: WhiteboardTool;
  color: string;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isFullscreen: boolean;
  onToolChange: (tool: WhiteboardTool) => void;
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: () => void;
  onSave: () => void;
  onToggleFullscreen: () => void;
}

export function Toolbar({
  tool,
  color,
  brushSize,
  canUndo,
  canRedo,
  isSaving,
  isDirty,
  isFullscreen,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onClear,
  onDownload,
  onSave,
  onToggleFullscreen,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
        <ToolButton
          label="Pencil"
          active={tool === "pencil"}
          onClick={() => onToolChange("pencil")}
        >
          <Pencil className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Eraser"
          active={tool === "eraser"}
          onClick={() => onToolChange("eraser")}
        >
          <Eraser className="h-4 w-4" />
        </ToolButton>
      </div>

      <Separator orientation="vertical" className="hidden h-8 sm:block" />

      <ColorPicker
        value={color}
        onChange={onColorChange}
        disabled={tool === "eraser"}
      />

      <Separator orientation="vertical" className="hidden h-8 sm:block" />

      <BrushSlider value={brushSize} onChange={onBrushSizeChange} />

      <Separator orientation="vertical" className="hidden h-8 sm:block" />

      <div className="flex items-center gap-1">
        <ToolButton label="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Clear canvas" onClick={onClear}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </ToolButton>
      </div>

      <Separator orientation="vertical" className="hidden h-8 sm:block" />

      <div className="flex flex-wrap items-center gap-1">
        <ToolButton label="Download PNG" onClick={onDownload}>
          <Download className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </ToolButton>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 rounded-lg"
          onClick={onSave}
          disabled={isSaving || !isDirty}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
