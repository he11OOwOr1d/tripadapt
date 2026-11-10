"use client";

type SceneState = {
  revealed: boolean;
  focused: "email" | "password" | null;
  look: number;
};

/** Only interaction state enters the portrait; credentials never do. */
export default function CompanionScene({
  revealed,
  focused,
  look,
}: SceneState) {
  const hiding = focused === "password";
  const pose = revealed
    ? "turned"
    : hiding
      ? "covered"
      : focused === "email"
        ? "watching"
        : "resting";
  return (
    <svg
      className={`tc-goat tc-goat-${pose}`}
      viewBox="0 0 500 400"
      role="img"
      aria-label={
        revealed
          ? "The goat has turned around. Its face is completely hidden."
          : hiding
            ? "The goat covers both eyes with its hooves while you enter your password."
            : focused === "email"
              ? "The goat leans toward your email, following along with wide eyes."
              : "A cream mountain goat looks forward, ready to keep you company."
      }
    >
      <ellipse
        cx="250"
        cy="374"
        rx="112"
        ry="10"
        fill="#294d3d"
        opacity=".08"
      />
      <path d="M153 390 Q147 285 250 281 Q353 285 347 390" fill="#ded9be" />
      <path
        d="M174 316 Q250 352 326 316 L317 350 Q252 382 183 350Z"
        fill="#41634c"
      />
      <path d="M271 346 L305 353 L287 390 L255 390Z" fill="#63805b" />
      <g className="tc-goat-head">
        <path
          d="M192 143 Q151 72 185 31 Q198 18 205 32 Q178 81 220 133"
          fill="#92957c"
        />
        <path
          d="M280 134 Q320 77 298 33 Q307 17 319 34 Q349 84 311 144"
          fill="#92957c"
        />
        <g className="tc-goat-ear tc-goat-ear-left">
          <path d="M185 159 Q101 100 84 141 Q87 190 177 195Z" fill="#e0d7b9" />
          <path d="M163 164 Q113 132 108 148 Q117 172 166 176" fill="#b9b497" />
        </g>
        <g className="tc-goat-ear tc-goat-ear-right">
          <path
            d="M315 159 Q399 100 416 141 Q413 190 323 195Z"
            fill="#e0d7b9"
          />
          <path d="M337 164 Q387 132 392 148 Q383 172 334 176" fill="#b9b497" />
        </g>
        <path
          d="M150 201 Q151 108 250 111 Q349 108 350 201 L336 264 Q314 316 250 328 Q186 316 164 264Z"
          fill="#f7efd5"
          stroke="#d8d0b2"
          strokeWidth="2"
        />
        <path d="M227 308 L239 348 L251 337 L262 348 L276 307" fill="#eee4c8" />
        <path d="M223 126 L235 106 L249 116 L263 102 L276 126" fill="#f7efd5" />
        <g className="tc-goat-face">
          <g
            className="tc-goat-eyes"
            style={{
              transform: `translateX(${focused === "email" ? 7 + look * 9 : 0}px)`,
            }}
          >
            <ellipse cx="207" cy="209" rx="14" ry="19" fill="#294d3d" />
            <ellipse cx="293" cy="209" rx="14" ry="19" fill="#294d3d" />
            <circle cx="202" cy="202" r="4.5" fill="#fffaf0" />
            <circle cx="288" cy="202" r="4.5" fill="#fffaf0" />
          </g>
          <ellipse
            cx="185"
            cy="247"
            rx="18"
            ry="9"
            fill="#d9b69a"
            opacity=".45"
          />
          <ellipse
            cx="315"
            cy="247"
            rx="18"
            ry="9"
            fill="#d9b69a"
            opacity=".45"
          />
          <ellipse cx="250" cy="268" rx="43" ry="29" fill="#e9dfbf" />
          <path
            d="M237 256 Q250 248 263 256 Q260 269 250 270 Q240 269 237 256"
            fill="#6b735b"
          />
          <path
            d="M250 271 L250 280 M236 282 Q250 293 264 282"
            fill="none"
            stroke="#6b735b"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <g className="tc-goat-back">
          <path
            d="M179 199 Q250 161 322 199 M191 218 Q250 183 309 218 M203 237 Q250 209 297 237"
            fill="none"
            stroke="#e0d6b6"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M235 277 L246 289 L257 278 L268 288"
            fill="none"
            stroke="#e0d6b6"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      </g>
      <g className="tc-goat-hoof tc-goat-hoof-left">
        <path
          d="M170 370 Q156 322 183 284"
          fill="none"
          stroke="#e4dab9"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <rect
          x="163"
          y="257"
          width="43"
          height="57"
          rx="18"
          fill="#415441"
          transform="rotate(-12 185 285)"
        />
        <path d="M184 260 L184 276" stroke="#839077" strokeWidth="2" />
      </g>
      <g className="tc-goat-hoof tc-goat-hoof-right">
        <path
          d="M330 370 Q344 322 317 284"
          fill="none"
          stroke="#e4dab9"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <rect
          x="294"
          y="257"
          width="43"
          height="57"
          rx="18"
          fill="#415441"
          transform="rotate(12 315 285)"
        />
        <path d="M316 260 L316 276" stroke="#839077" strokeWidth="2" />
      </g>
    </svg>
  );
}
