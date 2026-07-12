export const PRODUCT_WALKTHROUGH_STORAGE_KEY = "inboxflow-product-walkthrough-v1";

export function hasCompletedProductWalkthrough(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(PRODUCT_WALKTHROUGH_STORAGE_KEY) === "done";
  } catch {
    return true;
  }
}

export function markProductWalkthroughComplete() {
  try {
    localStorage.setItem(PRODUCT_WALKTHROUGH_STORAGE_KEY, "done");
  } catch {
    /* ignore */
  }
}

export function resetProductWalkthrough() {
  try {
    localStorage.removeItem(PRODUCT_WALKTHROUGH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
