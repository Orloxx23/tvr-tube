"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  percent: number;
  label?: string;
  indeterminate?: boolean;
  className?: string;
}

export function ProgressBar({
  percent,
  label,
  indeterminate,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          {!indeterminate ? (
            <span className="font-mono tabular-nums text-foreground/80">
              {clamped}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : clamped}
        aria-label={label}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        {indeterminate ? (
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-accent-gradient"
            animate={{ left: ["-33%", "100%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : (
          <motion.div
            className="h-full rounded-full bg-accent-gradient"
            initial={false}
            animate={{ width: `${clamped}%` }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          />
        )}
      </div>
    </div>
  );
}
