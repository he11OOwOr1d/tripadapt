export const concepts = [
  {
    id: "return-path",
    name: "Return path",
    description:
      "A welcoming forest-green plane, with a calm paper form beside it.",
  },
  {
    id: "open-door",
    name: "Open door",
    description:
      "One focused entrance. A quieter, central space to begin or return.",
  },
  {
    id: "little-room",
    name: "A little room",
    description:
      "An open, horizontal welcome that gives the form room to breathe.",
  },
] as const;
export type AuthConcept = (typeof concepts)[number]["id"];
