"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
      <Toaster
        position="bottom-right"
        theme="system"
        toastOptions={{
          classNames: {
            toast:
              "!bg-surface-1 !text-foreground !border !border-border !shadow-lg !backdrop-blur",
            description: "!text-muted-foreground",
            actionButton: "!bg-accent-gradient !text-white",
            cancelButton: "!bg-muted !text-foreground",
          },
        }}
      />
    </ThemeProvider>
  );
}
