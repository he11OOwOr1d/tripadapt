export type Palette = "original" | "alpine" | "dusk" | "peach";
const choices: {
  id: Palette;
  name: string;
  note: string;
  colours: string[];
}[] = [
  {
    id: "original",
    name: "Field notes",
    note: "Beige & green · postcards",
    colours: ["#f3ecd7", "#bdcf9b", "#365643"],
  },
  {
    id: "alpine",
    name: "Alpine daylight",
    note: "Cloud white · blue · pine",
    colours: ["#eef5f7", "#a9c5d6", "#294d48"],
  },
  {
    id: "dusk",
    name: "Lavender dusk",
    note: "Mist · lavender · indigo",
    colours: ["#f1eef8", "#b8aad8", "#393b65"],
  },
  {
    id: "peach",
    name: "Peach horizon",
    note: "Warm white · peach · slate",
    colours: ["#fff2ed", "#e9b3a4", "#3c4e65"],
  },
];
export default function PaletteSwitcher({
  value,
  onChange,
}: {
  value: Palette;
  onChange: (value: Palette) => void;
}) {
  return (
    <section className="ep-palette-review" aria-label="Landing colour studies">
      <div>
        <span>Design directions</span>
        <small>Colour and composition, considered together.</small>
      </div>
      <div role="group" aria-label="Choose a colour direction">
        {choices.map((p) => (
          <button
            key={p.id}
            aria-pressed={value === p.id}
            onClick={() => onChange(p.id)}
          >
            <span className="ep-palette-swatches" aria-hidden="true">
              {p.colours.map((colour) => (
                <i key={colour} style={{ background: colour }} />
              ))}
            </span>
            <span>
              <strong>{p.name}</strong>
              <small>{p.note}</small>
            </span>
            <b aria-hidden="true">{value === p.id ? "✓" : ""}</b>
          </button>
        ))}
      </div>
      <a href={`/design/fieldtrip/${value}#about`}>Open this direction ↗</a>
    </section>
  );
}
