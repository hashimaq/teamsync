import { Layers3 } from "lucide-react";
import { cn } from "@/utils";

interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
}

export function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className
      )}
    >
      <Layers3 className={cn("h-5 w-5", iconClassName)} />
    </div>
  );
}
