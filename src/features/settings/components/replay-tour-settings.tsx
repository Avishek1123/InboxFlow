"use client";

import { useState } from "react";
import { ProductWalkthrough } from "@/features/onboarding/product-walkthrough";
import { resetProductWalkthrough } from "@/lib/onboarding/product-walkthrough";

export function ReplayTourSettings() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border p-5">
      <h2 className="text-sm font-semibold">Product tour</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Replay the cinematic walkthrough of Ask AI, connections, and your ready
        sheet.
      </p>
      <button
        type="button"
        onClick={() => {
          resetProductWalkthrough();
          setOpen(true);
        }}
        className="mt-4 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
      >
        Replay product tour
      </button>
      {open && (
        <ProductWalkthrough forceOpen onClose={() => setOpen(false)} />
      )}
    </section>
  );
}
