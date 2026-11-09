import { useId } from "react";
import type { ReactNode } from "react";
export function Drawing({
  children,
  label,
  className = "",
  viewBox = "0 0 600 500",
}: {
  children: ReactNode;
  label: string;
  className?: string;
  viewBox?: string;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={label}
      className={`sx-drawing ${className}`}
    >
      <defs>
        <pattern
          id={`${id}h`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(28)"
        >
          <path
            d="M0 0V7"
            stroke="currentColor"
            strokeOpacity=".13"
            strokeWidth="1"
          />
        </pattern>
        <filter id={`${id}p`} x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".035"
            numOctaves="2"
            seed="7"
          />
          <feDisplacementMap in="SourceGraphic" scale="1.4" />
        </filter>
      </defs>
      <g
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter={`url(#${id}p)`}
      >
        {children}
      </g>
    </svg>
  );
}
export function Sun({
  x = 450,
  y = 75,
  r = 30,
}: {
  x?: number;
  y?: number;
  r?: number;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--sx-yellow,#efd37a)" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i * Math.PI) / 5;
        return (
          <path
            key={i}
            d={`M${(x + Math.cos(a) * (r + 12)).toFixed(2)} ${(y + Math.sin(a) * (r + 12)).toFixed(2)}l${(Math.cos(a) * 12).toFixed(2)} ${(Math.sin(a) * 12).toFixed(2)}`}
          />
        );
      })}
      <path d={`M${x - 11} ${y}q4 5 8 0m8 0q4 5 8 0m-20 10q9 8 18 0`} />
    </g>
  );
}
export function Peaks({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M8 191L116 25l111 166M141 190L235 63l89 128"
        fill="var(--sx-leaf,#afc4a6)"
      />
      <path
        d="M85 72l29-47 30 47-19-8-13 14-12-13ZM205 104l30-41 29 42-20-6-9 11-10-12"
        fill="var(--sx-paper,#fffdf4)"
      />
      <path
        d="M18 196q88-15 176 0t138 0M62 135l33-50m-20 72 15-22m75-8 28 42m67-48 23 32"
        opacity=".45"
      />
    </g>
  );
}
export function Sea({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M5 150q55-45 108-21t99 12q34-10 80 8"
        fill="var(--sx-blue,#bbd8de)"
      />
      <path d="M16 169q20-12 40 0t40 0m28 0q20-12 40 0t40 0m28 0q20-12 40 0M35 192q20-12 40 0t40 0m45 0q20-12 40 0t40 0M190 141l17-93m-17 13q-10-38-51-19 40 5 51 19m0 0q40-42 66-2-39-14-66 2m0 0q-22 20-37 30 6-34 37-30" />
      <path d="M4 224q120-36 280 0" />
    </g>
  );
}
export function Town({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M12 181V74l61-42 57 43v106M134 181V46h93v135M234 181V96l39-29 42 29v85"
        fill="var(--sx-pink,#e8b6b4)"
      />
      <path d="M3 183h322M9 77h123M151 66h59m-59 22h59m-59 23h59M30 99h24v27H30zm54 0h24v27H84zM57 181v-35h30v35m99 0v-38h24v38m38-64h18v23h-18zm37 0h18v23h-18zM175 46V24h20v22" />
      <path d="M20 201q90-7 189 0" opacity=".4" />
    </g>
  );
}
export function Person({
  x = 0,
  y = 0,
  scale = 1,
  rest = false,
}: {
  x?: number;
  y?: number;
  scale?: number;
  rest?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d={
          rest
            ? "M23 80q37 13 66 9l40-45 32 4-28 61-57 14-61-10Z"
            : "M40 79q-21 14-23 68l57 4-3-66Z"
        }
        fill="var(--sx-yellow,#efd37a)"
      />
      <path
        d={
          rest
            ? "M72 117l63-8 31 24 25-6-40-39-60 1"
            : "M25 151l-7 70 23 1 12-50 9 51h22l-8-73Z"
        }
        fill="var(--sx-blue,#bbd8de)"
      />
      <ellipse cx="49" cy="55" rx="26" ry="28" fill="var(--sx-paper,#fffdf4)" />
      <path
        d="M20 44q4-35 38-28 22 4 21 30l-60 1m8-18 45 2m-35 26 3 1m19-1 3-1m-22 14q8 7 16-1M25 36l52 2"
        fill="var(--sx-pink,#e8b6b4)"
      />
      <path
        d={
          rest
            ? "M22 89 0 60l20-19m0 68-19-6"
            : "M19 91 0 116l-21-11m88-7 22 19 21-36"
        }
      />
      {!rest && (
        <path d="M17 223H7q-8 13 6 14h28v-15m22 1-1 14h32q13-12-11-14" />
      )}
    </g>
  );
}
export function Cup({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M19 44h68l-6 65q-28 15-55-1ZM88 53q37-3 28 25-5 14-32 13M9 120q49 16 91-1M40 31q-14-14 1-27m20 26q13-15-1-27"
        fill="var(--sx-paper,#fffdf4)"
      />
      <path d="M34 72q18-9 37 0m-29 15q12-7 24 0" />
    </g>
  );
}
export function Backpack({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M60 47Q47 3 93 6q50 0 40 42M33 77q-21-11-25 17l-7 97 25 2m143-116q23-11 26 19l6 97-24 2" />
      <path
        d="M29 65q1-28 71-29 69 0 72 30l13 160q-76 31-167 0Z"
        fill="var(--sx-yellow,#efd37a)"
      />
      <path d="M32 88q77 20 139-2M29 144q68-15 146-1l2 65q-68 18-149-2ZM74 47l1 68h16V50m35-3 1 67h16V50M48 158h107M100 167v23" />
      <path d="m64 180 13-8 13 8-13 15Z" fill="var(--sx-pink,#e8b6b4)" />
    </g>
  );
}
export function Plane({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="m0 35 116-35-36 75-29-28-18 23 1-30Z"
        fill="var(--sx-paper,#fffdf4)"
      />
      <path d="M35 40 116 0 51 47m0 0-18 23" />
    </g>
  );
}
export function HeroArt({
  kind,
}: {
  kind: "mail" | "club" | "night" | "comic" | "sunday" | "journal";
}) {
  if (kind === "mail")
    return (
      <Drawing label="An open airmail envelope with a handwritten invitation, a mountain postcard and a pencil">
        <g transform="rotate(-8 300 250)">
          <path d="M60 186 292 39l239 146v268H60Z" fill="var(--sx-blue)" />
          <path d="M102 78h385v302H102Z" fill="var(--sx-paper)" />
          <path d="M125 99h336v263H125Z" strokeDasharray="5 6" />
          <text x="147" y="132" className="sx-svg-hand">
            Dear future me,
          </text>
          <Peaks x={148} y={145} scale={0.7} />
          <path d="M150 310h250m-250 18h202m-202 18h229" opacity=".5" />
          <path d="m60 187 232 151 239-151v267H60Z" fill="var(--sx-pink)" />
          <path d="m60 454 221-178q12-11 25 0l225 178" fill="var(--sx-paper)" />
          <path
            d="M72 444h445"
            strokeWidth="9"
            strokeDasharray="19 15"
            stroke="var(--sx-accent)"
          />
          <text x="188" y="399" className="sx-svg-hand">
            somewhere lovely.
          </text>
          <circle cx="449" cy="375" r="29" strokeDasharray="3 4" />
          <text x="426" y="384" className="sx-svg-hand">
            away
          </text>
        </g>
        <Plane x={433} y={27} scale={0.75} />
        <path d="M435 48q-69-33-74 14t-76-3" strokeDasharray="4 8" />
        <path d="m549 271-18 161 8 22 13-20 12-162Z" fill="var(--sx-yellow)" />
      </Drawing>
    );
  if (kind === "club")
    return (
      <Drawing label="A doodled travel backpack surrounded by a mountain patch, camera, coffee and a sun sticker">
        <path
          d="M61 109q-24 183 84 299 141 99 322-1 111-85 41-240Q400-9 219 40 104 30 61 109Z"
          strokeDasharray="4 9"
          opacity=".3"
        />
        <g transform="rotate(-7 290 270)">
          <Backpack x={180} y={130} scale={1.4} />
        </g>
        <g transform="rotate(-12 96 128)">
          <path d="M18 29h169v152H18Z" fill="var(--sx-paper)" />
          <Peaks x={30} y={40} scale={0.45} />
          <text x="43" y="163" className="sx-svg-hand">
            higher, please.
          </text>
        </g>
        <g transform="rotate(12 475 302)">
          <path d="M412 258h139v100H412Z" fill="var(--sx-pink)" />
          <circle cx="479" cy="307" r="33" />
          <circle cx="479" cy="307" r="23" />
          <path d="M429 258v-17h39v17m62 14h10" />
        </g>
        <Sun x={480} y={90} r={38} />
        <Cup x={24} y={337} scale={0.8} />
        <path
          d="m128 272 12 26 29 4-21 20 5 30-26-14-26 13 6-30-20-21 29-3Z"
          fill="var(--sx-yellow)"
        />
        <Plane x={394} y={402} scale={0.8} />
        <text x="154" y="54" className="sx-svg-hand">
          good things go in here ↓
        </text>
      </Drawing>
    );
  if (kind === "night")
    return (
      <Drawing label="A white pencil star atlas with three travel constellations, a crescent moon and a traveler looking up">
        <path
          d="M52 327q140-292 469-152M39 352q194-177 494-99M159 48q-9 248 212 400M312 30q-61 224 55 395"
          opacity=".2"
        />
        <path d="M61 318 157 191l121 60 131-136 106 87" strokeDasharray="4 9" />
        {[
          [61, 318],
          [157, 191],
          [278, 251],
          [409, 115],
          [515, 202],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="8" fill="var(--sx-yellow)" />
            <circle cx={x} cy={y} r="16" opacity=".4" />
          </g>
        ))}
        <path
          d="M461 29q-51 56 25 78-74 18-79-32-5-42 54-46Z"
          fill="var(--sx-yellow)"
        />
        <Peaks x={56} y={292} scale={0.6} />
        <Sea x={358} y={228} scale={0.6} />
        <text x="75" y="166" className="sx-svg-hand">
          a little higher
        </text>
        <text x="318" y="112" className="sx-svg-hand">
          a little further
        </text>
        <text x="340" y="404" className="sx-svg-hand">
          follow the feeling
        </text>
        {[
          [40, 57],
          [217, 87],
          [300, 134],
          [557, 365],
          [500, 447],
          [112, 427],
          [29, 222],
          [352, 46],
        ].map(([x, y], i) => (
          <path key={i} d={`M${x - 5} ${y}h10m-5-5v10`} />
        ))}
        <Person x={206} y={345} scale={0.49} />
      </Drawing>
    );
  if (kind === "comic")
    return (
      <Drawing label="Comic panels of a traveler escaping their desk, catching a train and relaxing in a hammock">
        <path d="M12 26 273 20l-7 212-254 6Z" fill="var(--sx-paper)" />
        <path d="m290 14 298 15-8 202-288-5Z" fill="var(--sx-blue)" />
        <path d="M12 257 583 245l5 233-572 8Z" fill="var(--sx-leaf)" />
        <path d="M46 145h137v69M64 145V89h80v54m-69-40h58M71 168v44m43-41v41" />
        <Person x={191} y={82} scale={0.55} />
        <path
          d="M41 51q68-23 132 0v30H70l-17 17V81H41Z"
          fill="var(--sx-yellow)"
        />
        <text x="52" y="73" className="sx-svg-hand" style={{ fontSize: 18 }}>
          too many tabs.
        </text>
        <path d="M325 87q102-18 220 0v89H325Z" fill="var(--sx-paper)" />
        <path d="M334 101h43v38h-43zm60 0h44v38h-44zm62 0h44v38h-44zM313 192h248m-224-10 14 20m41-20 14 20m41-20 14 20m41-20 14 20M338 70h187" />
        <Sun x={524} y={54} r={14} />
        <path d="m61 463 23-174m-9 67q117 147 350 19m3 88-13-179M43 303l39-16 29 18m279-11 25-13 27 17" />
        <Person x={195} y={334} scale={0.9} rest />
        <text x="68" y="284" className="sx-svg-hand">
          much better.
        </text>
        <path
          d="M444 303q65-23 109 5v43h-35l-18 18 2-18h-58Z"
          fill="var(--sx-paper)"
        />
        <text x="455" y="333" className="sx-svg-hand" style={{ fontSize: 18 }}>
          aaand exhale.
        </text>
      </Drawing>
    );
  if (kind === "sunday")
    return (
      <Drawing label="An oversized smiling sun with reading glasses, reclining on a striped deckchair beside a coffee">
        <g transform="rotate(-9 300 270)">
          <path
            d="M152 407 416 161m-213 84 165 176m-183-42 150-114m-47 54 78 106M165 230l72 64 160-102 25 46-173 118-111-91Z"
            fill="var(--sx-paper)"
          />
          <path
            d="m159 242 85 70 164-105m-257 49 92 76 172-111"
            stroke="var(--sx-accent)"
          />
          <Sun x={278} y={176} r={82} />
          <path d="M214 167q20-7 48 0v25h-43Zm77 0q25-8 48-1l-4 25h-42Zm-29 3h29m-52 42q36 27 69 0M211 244q-47 30-70 8m170-4q33 21 58 2M232 298l-40 67-32 2m132-84 65 47 18 37" />
          <path
            d="M155 371q-28-4-29 9 24 11 44 0m203-9q-6 20 17 23l8-9"
            fill="var(--sx-blue)"
          />
        </g>
        <Cup x={449} y={350} scale={0.9} />
        <path d="M50 444q235-28 510 0" />
        <text x="404" y="89" className="sx-svg-hand">
          no alarms.
        </text>
        <text x="417" y="115" className="sx-svg-hand">
          just this.
        </text>
        <path d="M408 125q-27 2-36 35m-2-10 2 12 13-6" />
      </Drawing>
    );
  return (
    <Drawing label="A hand-drawn trail between mountain towns with a resting traveler and journal notes">
      <Peaks x={40} y={34} scale={0.8} />
      <Town x={274} y={241} scale={0.7} />
      <path d="M160 230q-92 60 48 72t101 85" strokeDasharray="4 8" />
      <Person x={72} y={357} rest scale={0.7} />
      <Sun x={453} y={107} />
      <text x="297" y="219" className="sx-svg-hand">
        stay a little longer.
      </text>
      <text x="40" y="467" className="sx-svg-hand">
        no rush whatsoever.
      </text>
    </Drawing>
  );
}
export function MiniArt({
  kind,
}: {
  kind: "mountains" | "sea" | "town" | "cup" | "bag";
}) {
  return (
    <Drawing
      viewBox="0 0 350 260"
      label={
        kind === "mountains"
          ? "Pencil-drawn mountain peaks"
          : kind === "sea"
            ? "A sketched palm and sea"
            : kind === "town"
              ? "A row of colourful little houses"
              : kind === "cup"
                ? "A steaming coffee cup"
                : "A travel backpack"
      }
    >
      {kind === "mountains" ? (
        <>
          <Sun x={275} y={48} r={18} />
          <Peaks x={8} y={30} />
        </>
      ) : kind === "sea" ? (
        <Sea x={25} y={5} />
      ) : kind === "town" ? (
        <Town x={10} y={40} />
      ) : kind === "cup" ? (
        <Cup x={106} y={60} scale={1.1} />
      ) : (
        <Backpack x={80} y={10} />
      )}
    </Drawing>
  );
}
