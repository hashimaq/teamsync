"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/utils";

interface BrushSliderProps {
  value: number;
  onChange: (size: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}

export function BrushSlider({
  value,
  onChange,
  min = 1,
  max = 48,
  disabled,
  className,
}: BrushSliderProps) {
  return (
    <div className={cn("flex min-w-[140px] items-center gap-2", className)}>
      <Label htmlFor="brush-size" className="shrink-0 text-xs text-muted-foreground">
        Size
      </Label>
      <input
        id="brush-size"
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label="Brush size"
      />
      <span className="w-7 text-right text-xs tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}
