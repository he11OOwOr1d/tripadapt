import {
  dateLabel,
  datePlus,
  currency,
  sampleSummary,
  type SampleTrip,
} from "./sample-trip";
export function RoutePreview({ trip }: { trip: SampleTrip }) {
  return (
    <div className="ep-route" aria-label="Sample route">
      <span className="ep-origin">
        Delhi<small>Start & return</small>
      </span>
      <div className="ep-route-stops">
        {trip.stops.map((stop, i) => (
          <div key={stop.id}>
            <i aria-hidden="true" />
            <span>{stop.name}</span>
            <small>
              {stop.nights} {stop.nights === 1 ? "night" : "nights"}
            </small>
            {i < trip.stops.length - 1 ? <b aria-hidden="true">↝</b> : null}
          </div>
        ))}
      </div>
      <span className="ep-route-return" aria-hidden="true">
        ↶
      </span>
    </div>
  );
}
export function DatePreview({ trip }: { trip: SampleTrip }) {
  let offset = trip.transport === "shared" ? 1 : 0;
  return (
    <div className="ep-date-strip" aria-label="Stay and transfer allocation">
      {trip.transport === "shared" ? (
        <div className="ep-transfer">
          <small>{dateLabel(trip.start)}</small>
          <strong>On the way</strong>
          <span>1 travel night</span>
        </div>
      ) : null}
      {trip.stops.map((stop) => {
        const arrival = datePlus(trip.start, offset);
        offset += stop.nights;
        return (
          <div key={stop.id}>
            <small>
              {dateLabel(arrival)} – {dateLabel(datePlus(trip.start, offset))}
            </small>
            <strong>{stop.name}</strong>
            <span>
              {stop.nights} {stop.nights === 1 ? "night" : "nights"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
export function TripPass({
  trip,
  compact = false,
}: {
  trip: SampleTrip;
  compact?: boolean;
}) {
  const s = sampleSummary(trip);
  return (
    <article className={`ep-trip-pass ${compact ? "ep-pass-compact" : ""}`}>
      <header>
        <span>elsewhere.</span>
        <small>Sample trip overview</small>
      </header>
      <div className="ep-pass-main">
        <span>A little mountain escape</span>
        <h3>{trip.stops.map((stop) => stop.name).join(" & ")}</h3>
        <p>Leave from Delhi. Come back with a different view.</p>
      </div>
      <div className="ep-pass-stats">
        <div>
          <span>When</span>
          <strong>
            {dateLabel(trip.start)} — {dateLabel(s.finish)}
          </strong>
        </div>
        <div>
          <span>Who</span>
          <strong>2 travelers</strong>
        </div>
        <div>
          <span>Stays</span>
          <strong>
            {s.nights} {s.nights === 1 ? "night" : "nights"} · {trip.stops.length} {trip.stops.length === 1 ? "stop" : "stops"}
          </strong>
        </div>
        <div>
          <span>Allowance</span>
          <strong>{currency(s.total)}</strong>
        </div>
      </div>
      <footer>
        <span>
          {trip.accepted
            ? "Indoor morning added · transfer kept fixed"
            : "An editable plan. A little room to wander."}
        </span>
        <small>Illustrative · not a booking</small>
      </footer>
    </article>
  );
}
