export const studies = [
  {
    id: "sentence",
    name: "In a sentence",
    description:
      "A trip begins as a thought. Fill in the words and let the plan emerge.",
  },
  {
    id: "contour",
    name: "Contour desk",
    description:
      "An open work surface, framed by the quiet rhythm of the mountains.",
  },
  {
    id: "loom",
    name: "Day loom",
    description: "Weave places and journeys into the time you have.",
  },
  {
    id: "round",
    name: "Round trip",
    description: "Start with your people. Build a journey around them.",
  },
  {
    id: "horizons",
    name: "Three horizons",
    description: "From here, through a little time, to somewhere new.",
  },
  {
    id: "unfolding",
    name: "Unfolding",
    description:
      "One decision opens the next. The whole trip stays within reach.",
  },
] as const;
export type Study = (typeof studies)[number]["id"];
