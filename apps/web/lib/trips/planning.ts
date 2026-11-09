import type { Trip } from "./adapter";

/** Browser draft calculations only; not server validation or route feasibility. */
export function routeLegs(trip: Trip) {
  const points = [
    { id: `origin:${trip.origin}`, name: trip.origin || "Starting point" },
    ...trip.stops,
  ];
  if (trip.returnToOrigin !== false)
    points.push({
      id: `finish:${trip.origin}`,
      name: trip.origin || "Starting point",
    });
  else if (trip.finish)
    points.push({ id: `finish:${trip.finish}`, name: trip.finish });
  return trip.stops.length
    ? points.slice(1).map((point, i) => ({
        key: JSON.stringify([points[i].id, point.id]),
        from: points[i].name,
        to: point.name,
      }))
    : [];
}
export function timeAllocation(trip: Trip) {
  const stays = trip.stops.reduce((n, s) => n + s.nights, 0);
  const legs = routeLegs(trip);
  const travelNights = legs.reduce(
    (n, l) => n + (trip.travelPreferences?.[l.key]?.overnight ?? 0),
    0,
  );
  const hours = legs.reduce(
    (n, l) => n + Number(trip.travelPreferences?.[l.key]?.hours || 0),
    0,
  );
  const allHours =
    legs.length > 0 &&
    legs.every(
      (l) =>
        trip.travelPreferences?.[l.key]?.hours !== undefined &&
        trip.travelPreferences[l.key].hours !== "",
    );
  const windowDays =
    trip.start && trip.end && trip.end >= trip.start
      ? Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 86400000) +
        1
      : null;
  const days = trip.mode === "exact" ? windowDays : trip.days || null;
  const available = days === null ? null : days - 1;
  return {
    stays,
    travelNights,
    hours,
    allHours,
    windowDays,
    days,
    available,
    allocated: stays + travelNights,
    remaining: available === null ? null : available - stays - travelNights,
  };
}
export function planningProblems(trip: Trip) {
  const t = timeAllocation(trip);
  const problems: string[] = [];
  if (trip.stops.some((s) => !Number.isSafeInteger(s.nights) || s.nights < 0))
    problems.push("Stay nights must be whole numbers of zero or more.");
  if (
    routeLegs(trip).some((l) => {
      const p = trip.travelPreferences?.[l.key];
      return (
        p &&
        (!Number.isSafeInteger(p.overnight) ||
          p.overnight < 0 ||
          (p.hours !== "" &&
            (!Number.isFinite(Number(p.hours)) || Number(p.hours) < 0)))
      );
    })
  )
    problems.push("Enter nonnegative journey hours and whole travel nights.");
  if (t.remaining !== null && t.remaining < 0)
    problems.push(
      `Your route needs ${t.allocated} nights, but your trip has ${t.available}. Shorten stays, reduce overnight travel or extend the trip.`,
    );
  if (
    trip.mode === "window" &&
    t.windowDays !== null &&
    trip.days > t.windowDays
  )
    problems.push(
      `Your ${trip.days}-day trip does not fit in the ${t.windowDays}-day window. Widen the window or reduce the desired duration.`,
    );
  return problems;
}
export function suggestedSplit(trip: Trip) {
  const t = timeAllocation(trip);
  const nights = Math.max(
    0,
    t.available === null
      ? trip.stops.length * (trip.pace === "relaxed" ? 3 : 2)
      : t.available - t.travelNights,
  );
  return trip.stops.map((s, i) => ({
    ...s,
    nights:
      Math.floor(nights / trip.stops.length) +
      (i < nights % trip.stops.length ? 1 : 0),
  }));
}
export function planningCosts(trip: Trip) {
  const stays = trip.stops
    .filter((s) => s.nights > 0)
    .map((s) => {
      const p = trip.stayPreferences?.[s.id];
      const quantity =
        s.nights * (p?.basis === "bed" ? trip.travelers : trip.rooms);
      return {
        label: s.name,
        rate: p?.rate ?? "",
        quantity,
        basis: p?.basis === "bed" ? "bed-nights" : "room-nights",
        amount:
          p?.rate !== undefined && p.rate !== ""
            ? (Math.round(Number(p.rate) * 100) * quantity) / 100
            : null,
      };
    });
  const travel = routeLegs(trip).map((l) => {
    const p = trip.travelPreferences?.[l.key];
    const quantity = p?.basis === "vehicle" ? 1 : trip.travelers;
    return {
      label: `${l.from} → ${l.to}`,
      rate: p?.rate ?? "",
      quantity,
      basis: p?.basis === "vehicle" ? "vehicle" : "travelers",
      amount:
        p?.rate !== undefined && p.rate !== ""
          ? (Math.round(Number(p.rate) * 100) * quantity) / 100
          : null,
    };
  });
  const rows = [...stays, ...travel];
  return {
    stays,
    travel,
    known: rows.filter((r) => r.amount !== null).length,
    unknown: rows.filter((r) => r.amount === null).length,
    total:
      rows.reduce((n, r) => n + Math.round((r.amount ?? 0) * 100), 0) / 100,
  };
}
