export type TripLifecycle = "planning" | "active" | "completed" | "archived";
export function tripCapabilities(value: unknown) {
  const lifecycle = ["planning", "active", "completed", "archived"].includes(String(value))
    ? value as TripLifecycle : undefined;
  return {
    lifecycle,
    generate: lifecycle === "planning",
    chat: lifecycle === "planning" || lifecycle === "active",
    remaining: lifecycle === "planning" || lifecycle === "active",
    title: lifecycle === "planning" ? "Planning your trip" : lifecycle === "active" ? "Trip underway" : lifecycle === "completed" ? "Trip completed" : lifecycle === "archived" ? "Trip archived" : "Trip status unavailable",
    description: lifecycle === "planning" ? "Shape your days and review AI suggestions before accepting them."
      : lifecycle === "active" ? "Start with where you are now. Confirm your time and location before reviewing the rest of today."
      : lifecycle ? "Your plan and conversation history are here. New AI planning requests are closed."
      : "Reload your saved trip to check which planning actions are available.",
    choices: lifecycle === "planning" ? ["Replan the rest of today", "Explain this day", "Summarize my route", "Suggest a rest break"]
      : lifecycle === "active" ? ["Replan the rest of today", "Explain this day", "Summarize my route"] : [],
  };
}
