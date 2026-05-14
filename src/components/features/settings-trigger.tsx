"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsSheet } from "./settings-sheet";

export function SettingsTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Abrir ajustes"
        onClick={() => setOpen(true)}
        className="rounded-full border border-border/60"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </Button>
      <SettingsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
