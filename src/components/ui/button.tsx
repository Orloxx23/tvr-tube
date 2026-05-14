import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-[transform,background,color,box-shadow] duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-gradient text-white shadow-[0_8px_24px_-12px_hsl(var(--accent-from)/0.6)] hover:shadow-[0_10px_32px_-10px_hsl(var(--accent-from)/0.7)]",
        secondary:
          "bg-surface-2 text-foreground border border-border hover:bg-surface-1",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-2",
        ghost:
          "bg-transparent text-foreground hover:bg-surface-2",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-foreground underline-offset-4 hover:underline px-0 py-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
