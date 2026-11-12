import type { ActivityPlace } from "../../lib/trips/activity-search";
export default function PlaceAttribution({ place }: { place: ActivityPlace }) {
  const hosted = place.external_id.startsWith("geoapify/");
  const link = hosted ? `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}` : `https://www.openstreetmap.org/${place.external_id}`;
  return <small className="activity-place-source">Place data: {hosted && <><a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>{" · "}</>}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>{" · "}<a href={link} target="_blank" rel="noreferrer">{hosted ? "View location" : "View source"} ↗</a><br />Fetched {new Date(place.retrieved_at).toLocaleDateString()}. Hours, prices and travel time unverified.</small>;
}
