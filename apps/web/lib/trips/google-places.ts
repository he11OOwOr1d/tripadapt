import { accountRequest } from "./account-adapter";
export type GoogleMatch = { id: string; name: string; address: string; latitude: number; longitude: number };
export type GoogleCheck = {
  place: GoogleMatch;
  retrieved_at: string;
  status: string;
  explanation: string;
  hours: string[];
  hours_basis: "current" | "regular" | "unavailable";
  price_level: string | null;
  price_range: { startPrice?: {currencyCode?: string; units?: string; nanos?: number}; endPrice?: {currencyCode?: string; units?: string; nanos?: number} } | null;
  attributions: string[];
};
export const googlePlacesAdapter = {
  async matches(sourcePlaceId: string, signal: AbortSignal) {
    return (await accountRequest<GoogleMatch[]>("/google-places/matches", {method:"POST", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), body:JSON.stringify({source_place_id:sourcePlaceId})})).data;
  },
  async check(sourcePlaceId: string, googlePlaceId: string, date: string, start: string, minutes: number, signal: AbortSignal) {
    return (await accountRequest<GoogleCheck>("/google-places/check", {method:"POST", signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]), body:JSON.stringify({source_place_id:sourcePlaceId,google_place_id:googlePlaceId,visit_date:date||null,start,duration_minutes:minutes})})).data;
  },
};
export const googleMapLink = (id: string) => `https://www.google.com/maps/search/?api=1&query=Place&query_place_id=${encodeURIComponent(id)}`;
export function googlePrice(check: GoogleCheck) {
  const left=check.price_range?.startPrice, right=check.price_range?.endPrice;
  const amount=(value: typeof left) => value && Number(value.units ?? 0)+(value.nanos ?? 0)/1e9;
  const a=amount(left),b=amount(right);
  if (left?.currencyCode && /^[A-Z]{3}$/.test(left.currencyCode) && left.currencyCode === right?.currencyCode && typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b) && a>=0 && b>=a) return `${left.currencyCode} ${a.toLocaleString()}–${b.toLocaleString()}`;
  const levels: Record<string,string>={PRICE_LEVEL_FREE:"Free",PRICE_LEVEL_INEXPENSIVE:"Inexpensive",PRICE_LEVEL_MODERATE:"Moderate",PRICE_LEVEL_EXPENSIVE:"Expensive",PRICE_LEVEL_VERY_EXPENSIVE:"Very expensive"};
  return levels[check.price_level ?? ""] ?? "Not provided";
}
