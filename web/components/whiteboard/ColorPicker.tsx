"use client";

import { WHITEBOARD_COLORS } from "@/lib/whiteboard";
import { cn } from "@/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Colors">
      {WHITEBOARD_COLORS.map((color) => {
        const active = value.toLowerCase() === color.toLowerCase();
        const isLight = color === "#ffffff";
        return (
          <button
            key={color}
            type="button"
            disabled={disabled}
            title={color}
            aria-label={`Color ${color}`}
            aria-pressed={active}
            onClick={() => onChange(color)}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "scale-110 border-primary shadow-sm"
                : "border-transparent hover:scale-105",
              isLight && "border-border"
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
      <label className="relative ml-0.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-sm">
        <span className="sr-only">Custom color</span>
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          className="h-4 w-4 rounded-full border border-border"
          style={{ backgroundColor: value }}
          aria-hidden
        />
      </label>
    </div>
  );
}
