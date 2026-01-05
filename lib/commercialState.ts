export type AvailabilityState = "available" | "quote_only" | "unavailable" | "discontinued";

type AvailabilityInput = {
  merchandiseId?: string | null;
  requiresQuote?: boolean | null;
  discontinued?: boolean | null;
};

export function getAvailabilityState({ merchandiseId, requiresQuote, discontinued }: AvailabilityInput): AvailabilityState {
  if (discontinued) return "discontinued";
  if (requiresQuote) return "quote_only";
  if (merchandiseId) return "available";
  return "unavailable";
}

export function canAddToCart(state: AvailabilityState): boolean {
  return state === "available";
}
