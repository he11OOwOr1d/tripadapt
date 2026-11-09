export function PencilDefs() {
  return (
    <svg className="sk-defs" aria-hidden="true">
      <defs>
        <filter id="sk-pencil">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".035"
            numOctaves="2"
            seed="8"
            result="grain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grain"
            scale="1.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <pattern
          id="sk-green-hatch"
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-20)"
        >
          <path
            d="M2 0V9 M5 1V7"
            stroke="#587d55"
            strokeWidth=".7"
            opacity=".3"
          />
        </pattern>
        <pattern
          id="sk-blue-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(25)"
        >
          <path d="M2 0V8" stroke="#315cac" strokeWidth=".7" opacity=".2" />
        </pattern>
        <pattern
          id="sk-paper-lines"
          width="20"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 27H20" stroke="#315cac" opacity=".13" strokeWidth=".7" />
        </pattern>
        <filter id="sk-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".7"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
      </defs>
    </svg>
  );
}

function MountainMark({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      className="sk-pencil-mark"
    >
      <path d="M0 127 75 12 156 128Z" fill="#c8d5be" />
      <path d="M73 13 52 57 68 50 82 64 91 49 112 72" fill="#f8f8f0" />
      <path
        d="M0 128 75 12 156 128 M8 124 75 18 148 124"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.4"
      />
      <path
        d="M75 14 92 93 119 125 M52 57 68 50 82 64 91 49"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.2"
      />
      <path
        d="m20 119 11-17 m-2 21 9-15 m-1 17 12-19 m1 20 13-20 m-1 19 14-21 m-1 21 13-18 m20 17 6-11 m3 11 4-7"
        stroke="#5d8055"
        strokeWidth="1"
        opacity=".6"
      />
      <path
        d="M23 87 29 78 M29 91 35 82 M36 94 42 84 M42 98 48 89"
        stroke="#587d55"
        strokeWidth="1"
        opacity=".5"
      />
    </g>
  );
}
function TreeMark({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      className="sk-pencil-mark"
    >
      <path d="M0 70 18 32 11 34 30 0 50 35 43 32 61 69Z" fill="#a8bb90" />
      <path
        d="M0 70 18 32 11 34 30 0 50 35 43 32 61 69 M3 69 30 5 57 67 M30 11 29 88"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.5"
      />
      <path
        d="m13 57 11-8 m12 4 10 7 M21 36l9 6 10-5"
        fill="none"
        stroke="#587d55"
        strokeWidth="1.1"
      />
    </g>
  );
}
function HouseMark({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      className="sk-pencil-mark"
    >
      <path d="M12 36 43 7 84 34 83 91 14 92Z" fill="#eddbb5" />
      <path d="M5 38 42 0 91 35 82 43 42 15 13 47Z" fill="#b2c6c6" />
      <path
        d="m5 38 37-38 49 35-9 8-40-28-29 32Zm9 9 1 45 68-1 1-48 M44 90 44 60 61 60 62 91 M25 54 37 54 37 67 25 67Z M27 52V69 M31 53V68"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.5"
      />
      <path
        d="M67 18 67 1 77 1 77 25 M21 90H79"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.5"
      />
      <path
        d="m24 23 45 22 M29 18l47 20 m-42-25 46 19"
        stroke="#293b53"
        opacity=".3"
        strokeWidth="1"
      />
      <path
        d="M73-10q-10-8-2-15t0-13"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.2"
        opacity=".5"
        className="sk-house-smoke"
      />
    </g>
  );
}

export function Traveler({
  pose = "rest",
  className = "",
}: {
  pose?: "rest" | "point" | "umbrella";
  className?: string;
}) {
  const rest = pose === "rest";
  return (
    <svg
      width="250"
      height="250"
      className={`sk-traveler ${className}`}
      viewBox="0 0 250 250"
      aria-hidden="true"
    >
      <g
        className="sk-pencil-mark"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {rest ? (
          <>
            <path
              d="M26 197q79 11 200-1 M35 201q97 7 178-1"
              stroke="#839c73"
              opacity=".6"
            />
            <path
              d="M103 158q29-17 48-35 12-7 20 6l25 48-17 8-26-35-29 29Z"
              fill="#91afd0"
            />
            <path d="m118 171 57 6 38 11-4 18-49-7-54-12" fill="#a9bfda" />
            <path
              d="m192 176 12 3 10 10-5 10-18-6-11-9Z M209 187l18 3q13 9 1 17l-19-1Z"
              fill="#f4eee2"
            />
            <path
              d="m193 189 14 5 m7 6 15-1 M152 143l22 40 M128 179l33 12"
              opacity=".5"
            />
            <path
              d="M69 132q29-6 52 21l10 27q-29 11-66-13l-11-17Z"
              fill="#e5bc50"
            />
            <path
              d="M74 143q-39-10-34-28l16-12 12 11-14 6 25 10 M101 145q25-19 9-33l-18-9-8 12 18 5-13 12"
              fill="#e5bc50"
            />
            <path
              d="m48 111 13-10 8 9-13 11 M98 110l-10-9-7 13 14 7"
              fill="#efd6b6"
            />
            <path d="m78 160 21 9 m-13-7 3 10 M69 146q17 6 32 2" opacity=".4" />
            <g transform="rotate(-18 78 109)">
              <path
                d="M59 98q-3 26 19 30 23-1 20-26-9-23-39-4Z"
                fill="#efd6b6"
              />
              <path
                d="M58 101q-7-26 17-30 29-2 27 27l-12-8-14 2-7 11Z"
                fill="#d58368"
              />
              <path d="M57 94q21-10 45-1l1 9q-19-8-45 1Z" fill="#dc947c" />
              <path d="m67 83 2-7 m8 8v-9 m10 10-1-8" opacity=".5" />
              <path d="m68 109 5-2 m10 1 5 2 m-12 10q7 2 10-4 M80 110l2 4-3 1" />
              <path d="M69 105q4-2 7 0 M84 103q4 0 6 3" strokeWidth="1.2" />
            </g>
            <path
              d="m19 196 5-10 3 11 m9 1 7-11 m166 12 4-9 3 9"
              stroke="#839c73"
            />
          </>
        ) : (
          <>
            <path d="M83 235q44 6 92-2" stroke="#839c73" opacity=".6" />
            <path d="m105 153-7 63 19 2 13-49 9 49 18-1-5-65" fill="#a9bfda" />
            <path
              d="m97 215-9 12q-5 7 9 8l23-2-2-15 M140 216l-2 16 26 1q9-5-9-16"
              fill="#f4eee2"
            />
            <path d="m100 229 16-1 m28 0 14 1 M126 166l-5-11" opacity=".5" />
            <path d="M105 86q20-9 42 1l15 66q-35 16-65-1Z" fill="#e5bc50" />
            <path
              d="M104 91q-21 15-21 42l14 3 15-24 M143 91l25 21 25-14 8 12-33 21-27-15"
              fill="#e5bc50"
            />
            <path
              d="m83 130 13 3-1 15q-5 9-12 1ZM191 98l4-13 4-1 1 13 14-7q6 2-1 7l-9 5 14-1q4 5-10 8l-10 3Z"
              fill="#efd6b6"
            />
            <path d="M126 99v44m-10-6h22 M106 150q20 7 40-1" opacity=".5" />
            <path
              d="M108 54q-1 29 19 30 24-2 23-28-6-21-30-16Z"
              fill="#efd6b6"
            />
            <path
              d="M107 54q-7-26 17-30 28-3 29 28l-17-9-12 5-9 11Z"
              fill="#d58368"
            />
            <path d="M106 46q23-11 47 1l1 10q-25-11-47 1Z" fill="#dc947c" />
            <path d="m116 36 1-6 m9 6v-8 m10 9-1-7" opacity=".5" />
            <path d="m117 65 2 1 m18-1 2-1 M126 64l-2 7 5 1 M120 76q8 5 14-2 M114 60l7-2 m12 1 7 2" />
            {pose === "umbrella" ? (
              <g className="sk-umbrella">
                <path
                  d="M9 24q73-55 150 0l-21-2-20 5-20-5-20 6-24-5-22 6Z"
                  fill="#b2c9dc"
                />
                <path d="M9 24q73-55 150 0 M83-3q-24 7-27 28 M83-3q25 7 35 30 M83 24v112q0 15 10 7" />
                <path d="m24 19 8-4 m-1 8 8-5 m83-6 10 7" opacity=".4" />
              </g>
            ) : null}
          </>
        )}
      </g>
    </svg>
  );
}

export function FoldedMap() {
  return (
    <svg
      className="sk-hero-art"
      viewBox="0 0 760 585"
      role="img"
      aria-label="A pencil-drawn imaginary travel map with mountains, a seaside, a little house and a relaxed cartoon traveler"
    >
      <g
        className="sk-pencil-mark"
        stroke="#293b53"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M86 85 265 65 445 94 630 65 662 424 477 450 296 421 111 447Z"
          fill="#eef0dc"
        />
        <path
          d="M87 85 265 65 445 94 630 65 662 424 477 450 296 421 111 447Z M91 90 265 70 444 98 625 70 657 420 477 444 297 416 116 442"
          fill="none"
        />
        <path
          d="M265 66 296 421 M445 94 477 450"
          stroke="#9aa990"
          strokeDasharray="4 5"
        />
        <path
          d="M89 88 261 70 291 416 115 441"
          fill="#bfcfad"
          opacity=".28"
          stroke="none"
        />
        <path
          d="M450 101q67 35 95 107t102 71l14 145-184 26Z"
          fill="#bdd5e4"
          opacity=".7"
          stroke="none"
        />
        <path
          d="M450 101q67 35 95 107t102 71 M457 110q57 36 82 101t108 77"
          fill="none"
          stroke="#7e9eb4"
          strokeWidth="1.1"
        />
        <path
          d="m535 230 22-1 m-14 13 25 1 m17 29 23-2 m-71 48 18 2 m47 35 22-1 m-79 30 22 1 m25 24 18-1"
          stroke="#7e9eb4"
        />
        <path
          d="M89 88 261 70 291 416 115 441Z"
          fill="url(#sk-green-hatch)"
          opacity=".35"
          stroke="none"
        />
        <path
          d="M450 101q67 35 95 107t102 71l14 145-184 26Z"
          fill="url(#sk-blue-hatch)"
          opacity=".55"
          stroke="none"
        />
        <path
          d="M151 165Q242 178 307 245T459 313T582 201"
          className="sk-pencil-route"
          fill="none"
          stroke="#315cac"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        <g fill="#f8f8f0" stroke="#315cac">
          <circle cx="150" cy="164" r="7" />
          <circle cx="307" cy="245" r="7" />
          <circle cx="459" cy="313" r="7" />
          <circle cx="582" cy="201" r="7" />
        </g>
        <path d="m126 309 17-7 26 6 2 37-40 2Z" fill="#d58368" opacity=".6" />
        <path
          d="m124 307 20-16 27 16-39 6 M132 313v33h38v-36 M142 328h10v18 M157 320h7v9h-7Z"
          fill="none"
        />
        <path d="m183 297 20-15 20 17v38h-38Z" fill="#e5bc50" opacity=".7" />
        <path
          d="m180 299 23-25 24 25 M185 300v37h39v-37 m-29 18h10v19 M211 305h7v10h-7Z"
          fill="none"
        />
        <path
          d="M118 378q52-17 112-3t90-1 M119 384q68-12 113-1"
          fill="none"
          stroke="#839c73"
        />
        <path d="m495 158 32-19 29 2-27 11Z" fill="#f8f8f0" />
        <path d="m527 139 2 13 9 6 18-17 M529 152l-8 7" fill="none" />
        <g
          className="sk-plane-trail"
          fill="none"
          stroke="#839c73"
          strokeDasharray="3 5"
        >
          <path d="M548 160q50 18 75-3t49-35q46 2 37 39-13 29-32 5-14-23 21-42" />
        </g>
        <path d="M692 119 738 99 718 136 713 119 692 119Z" fill="#f8f8f0" />
        <path d="m713 119 25-20-20 37-5-17Z" fill="#cedbef" />
        <g transform="translate(617 343)">
          <path d="M0 0 1 47 M-14 31 0 0 17 30" fill="none" />
          <path d="M-10 38 11 38 M-7 42H9" stroke="#839c73" />
        </g>
        <g transform="translate(535 349) rotate(10)">
          <path d="M0 0q21-11 44 0v37q-22 11-44 0Z" fill="#e5bc50" />
          <path d="M10 0v42 M36 0v41 M17 12h11m-9 8h8" opacity=".5" />
        </g>
        <path
          d="M663 466q-8 19-32 22 M637 481l-9 8 13 1"
          fill="none"
          stroke="#315cac"
        />
        <path
          d="M69 237q-22-3-24 19t-9 35 M31 279l4 15 13-8"
          fill="none"
          stroke="#315cac"
        />
        <path
          d="m668 64 3-13 m-1 22 14-4 m-8 15 9 5"
          fill="none"
          stroke="#d58368"
        />
      </g>
      <MountainMark x={105} y={100} scale={0.68} />
      <MountainMark x={178} y={113} scale={0.45} />
      <TreeMark x={223} y={137} scale={0.55} />
      <TreeMark x={250} y={164} scale={0.4} />
      <HouseMark x={355} y={159} scale={0.7} />
      <g fill="#293b53" fontFamily="'Sketch Note',cursive" fontSize="18">
        <text x="110" y="64" transform="rotate(-7 110 64)">
          start with a little maybe
        </text>
        <text x="515" y="483" transform="rotate(5 515 483)">
          not an actual map.
        </text>
        <text x="517" y="504" transform="rotate(5 517 504)">
          just a very good feeling.
        </text>
        <text x="10" y="222" transform="rotate(-9 10 222)">
          this way?
        </text>
      </g>
      <g transform="translate(54 330) rotate(-7)">
        <Traveler />
      </g>
    </svg>
  );
}

export function LandscapeStrip({ active }: { active: number }) {
  return (
    <svg
      className="sk-landscape-strip"
      viewBox="0 0 1120 260"
      aria-hidden="true"
    >
      <g
        className="sk-pencil-mark"
        stroke="#293b53"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M5 235q89-40 168-14t179-8 202 9 163-4 191 7 203-13"
          fill="none"
        />
        <g opacity={active === 0 ? 1 : 0.55}>
          <path d="M22 218 139 56 237 215 302 104 371 217Z" fill="#b9cbab" />
          <path d="M22 218 139 56 237 215 M186 168l116-64 69 113" fill="none" />
          <path
            d="m139 56-31 61 23-8 18 16 12-18 27 31 M302 104l-15 31 20-6 12 15"
            fill="#f8f8f0"
          />
          <path d="M139 60 171 207 M302 107l22 105" fill="none" />
          <path
            d="m62 214 27-36 m-10 39 28-39 m-11 39 26-37 m-5 38 26-34 m-8 35 25-29 m35 28 12-17"
            stroke="#839c73"
            opacity=".7"
          />
          <path
            d="M65 78q-4-13 10-17 4-16 20-8 17-2 18 14 11 12-2 17Z"
            fill="#e5e9df"
          />
          <path d="m51 221 3-14 4 15 m256-2 6-13 1 12" stroke="#839c73" />
        </g>
        <g opacity={active === 1 ? 1 : 0.55}>
          <path d="M395 211q59-80 140-60t170 61" fill="#c1d9e5" stroke="none" />
          <path
            d="M398 207q19-9 37 0t39 0 38 0 39 0 38 0 39 0 39 0"
            fill="none"
            stroke="#6c91b2"
          />
          <path
            d="M405 223q21-7 42 0t42 0 42 0 42 0 42 0 42 0"
            fill="none"
            stroke="#6c91b2"
          />
          <circle cx="552" cy="91" r="28" fill="#ead07e" />
          <path
            d="m552 51v-9 m29 25 9-6 m-71 17-10-3 m40 50-2 10 m28-18 8 7"
            fill="none"
            stroke="#bd9c4d"
          />
          <path
            d="M464 192q19-62 4-109 M466 95q-27-20-44 0 19-4 38 9 M468 92q29-26 51-6-19-2-44 14 M470 91q-4-28-20-32 7 12 13 32"
            fill="#bad0a6"
          />
          <path d="m613 173 24 0-11 24Z" fill="#d58368" />
          <path d="M626 172v-39l22 30h-22 M626 137l-21 26h21" fill="#f8f8f0" />
        </g>
        <g opacity={active === 2 ? 1 : 0.55}>
          <path
            d="M755 211V101l24-19 24 19v110 M809 210V127l32-22 30 22v83 M878 210V70l28-29 29 29v140 M943 211V116l34-27 34 27v95 M1020 211V97h55v114"
            fill="#e8d3b5"
          />
          <path
            d="M748 103 779 75l31 28 M802 129l39-30 37 30 M870 74l37-41 35 41 M937 117l40-35 41 35 M1015 97h65"
            fill="none"
          />
          <path
            d="M769 211v-30h20v30 M829 211v-31h22v31 M896 211v-35h20v35 M964 211v-30h23v30 M1038 211v-32h19v32"
            fill="#c3d0dd"
          />
          <path
            d="M768 116h12v15h-12Z m15 0h12v15h-12Z M826 141h12v15h-12Z m17 0h12v15h-12Z M889 89h12v15h-12Z m18 0h12v15h-12Z M958 131h13v16h-13Z m20 0h13v16h-13Z M1030 114h12v16h-12Z m18 0h12v16h-12Z"
            fill="#f8f8f0"
          />
          <path
            d="m770 160 23-8 m40 15 20-8 m41-20 22-8 m45 36 23-8"
            opacity=".4"
          />
        </g>
      </g>
    </svg>
  );
}

export function UmbrellaScene() {
  return (
    <svg viewBox="0 0 330 350" className="sk-umbrella-scene" aria-hidden="true">
      <g
        className="sk-pencil-mark"
        fill="none"
        stroke="#293b53"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path
          d="M67 70q-16-20 6-31 5-22 25-15 19-26 39-6 27-6 34 20 26-2 24 22 16 19-4 29-58 13-124-3Z"
          fill="#d6deea"
        />
        <path d="M74 77q63 12 117-5" opacity=".4" />
        <g className="sk-rain-dashes" stroke="#7296b2">
          <path d="m81 104-4 11 m24-6-5 11 m24-13-5 12 m26-14-5 12 m28-14-5 12 m24-13-5 12" />
        </g>
        <path d="m240 51 4-15 m8 23 15-3 m-18 16 10 9" stroke="#d58368" />
        <path d="M45 321q133 11 251-2" stroke="#839c73" />
      </g>
      <g transform="translate(48 94)">
        <Traveler pose="umbrella" />
      </g>
      <text
        x="201"
        y="130"
        fontFamily="'Sketch Note',cursive"
        fontSize="18"
        fill="#315cac"
        transform="rotate(6 201 130)"
      >
        well, hello
      </text>
      <text
        x="214"
        y="151"
        fontFamily="'Sketch Note',cursive"
        fontSize="18"
        fill="#315cac"
        transform="rotate(6 214 151)"
      >
        plot twist.
      </text>
    </svg>
  );
}

export function MarginTrail() {
  return (
    <svg className="sk-margin-trail" viewBox="0 0 90 220" aria-hidden="true">
      <path
        d="M38 0Q9 44 48 69T48 139Q2 162 45 199"
        fill="none"
        stroke="#718798"
        strokeWidth="1.5"
        strokeDasharray="3 7"
      />
      <path
        d="m33 194 14 9 2-18"
        fill="none"
        stroke="#718798"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function SunDoodle() {
  return (
    <svg viewBox="0 0 100 100" className="sk-sun-doodle" aria-hidden="true">
      <g
        className="sk-pencil-mark"
        stroke="#a58130"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      >
        <path
          d="M71 29q24 26-2 45-31 16-43-13-10-32 24-38 11-1 21 6Z"
          fill="#ead07e"
        />
        <path d="m48 10 1-7 m28 15 6-7 m6 32 8-1 M78 76l6 7 M51 88l1 8 M22 76l-7 7 M12 49l-8-1 M23 21l-8-6" />
        <path d="m38 46 3 1 m18-2 3 1 M40 60q11 10 21-3" stroke="#293b53" />
      </g>
    </svg>
  );
}
