import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-foreground border border-border",
        accent: "bg-accent-gradient text-white border-0",
        outline: "border border-border text-foreground bg-transparent",
        success:
          "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.3)]",
        warning:
          "bg-amber-500/12 text-amber-500 border border-amber-500/30",
        destructive:
          "bg-destructive/12 text-destructive border border-destructive/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
