"use client";

import { ProductWalkthroughHost } from "@/features/onboarding/product-walkthrough";

/** Client mount point for first-visit tour inside the server dashboard layout. */
export function DashboardOnboarding() {
  return <ProductWalkthroughHost />;
}
