"use client";
import { memo, useId } from "react";

export type Landscape = "mountain" | "coast" | "town";

function Tree({
  x,
  y,
  s = 1,
  pine = false,
}: {
  x: number;
  y: number;
  s?: number;
  pine?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="-9" cy="3" rx="22" ry="4" fill="#385946" opacity=".13" />
      <path
        d="M0 2L-1-48M0-23L-12-37M-1-29L12-43"
        stroke="#735d46"
        strokeWidth="3"
        fill="none"
      />
      {pine ? (
        <>
          <path d="M-1-82L-19-42H-12L-26-19H23L11-42H18Z" fill="#3e6c58" />
          <path d="M-1-82L-4-43L-12-21H-25L-12-42H-19Z" fill="#608167" />
        </>
      ) : (
        <>
          <path
            d="M-25-30C-39-39-30-57-19-56C-26-73-4-84 8-71C25-82 39-64 30-51C47-40 30-19 17-25C10-16-12-15-16-27Z"
            fill="#37634b"
          />
          <path
            d="M-25-34C-38-44-23-61-14-56C-20-70-4-77 4-68C-5-61-11-55-6-45C-14-48-25-45-25-34Z"
            fill="#65875b"
          />
          <path
            d="M12-60L17-63M22-46L28-48M-17-40L-11-43M-5-63L1-66M7-32L13-35"
            stroke="#bfcc8c"
            strokeWidth="2"
            opacity=".65"
          />
        </>
      )}
      {!pine ? Array.from({length:65},(_,i)=><ellipse key={i} cx={Math.sin(i*2.4)* (8+i%19)} cy={-47+Math.cos(i*1.7)*(8+i%17)} rx={1+i%3*.4} ry=".8" fill={i%3===0?"#bdc486":"#739361"} opacity=".7"/>) : null}
    </g>
  );
}
export function Cabin({
  x = 0,
  y = 0,
  s = 1,
  cosy = false,
}: {
  x?: number;
  y?: number;
  s?: number;
  cosy?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="2" cy="7" rx="63" ry="9" fill="#3e5b42" opacity=".17" />
      <path d="M-44-44L0-71L44-44V4H-44Z" fill="#eadcba" />
      <path d="M0-71L44-44V4H13V-47Z" fill="#d1bc94" />
      <path d="M-55-43L0-81L56-43L45-38L0-68L-46-36Z" fill="#645a51" />
      <path
        d="M-48-43L0-76L48-43M-34-45L0-67"
        stroke="#8a7862"
        strokeWidth="2"
        fill="none"
      />
      <path d="M27-63V-86H36V-57" fill="#947259" />
      <path d="M-11 4V-27H7V4" fill="#795c45" />
      <rect
        x="-33"
        y="-28"
        width="14"
        height="17"
        rx="1"
        fill={cosy ? "#f2cf72" : "#8aaeb0"}
        stroke="#826a51"
        strokeWidth="3"
      />
      <path d="M-26-28V-11M-33-20H-19" stroke="#826a51" strokeWidth="1.5" />
      <path d="M-49 5H49M-16 10H12" stroke="#a48e6c" strokeWidth="4" />
      <g opacity=".38" stroke="#9a8061" strokeWidth=".7">{[-35,-28,-21,-14,-7,0].map(y=><path key={y} d={`M-42 ${y}H-14M15 ${y}H42`}/>)}{Array.from({length:24},(_,i)=><path key={`tile-${i}`} d={`M${-35+(i%8)*10} ${-47-Math.floor(i/8)*7}l5-3`}/>)}</g>
      <path d="M-51 8q10-16 17-4m61 5q10-20 20-5" stroke="#79915e" strokeWidth="5" fill="none"/>
      {cosy ? (
        <g className="fw-chimney">
          <path
            d="M31-91C17-103 45-105 31-119C23-128 30-131 36-136"
            stroke="#c4c7b8"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            opacity=".7"
          />
        </g>
      ) : null}
    </g>
  );
}
function Clouds() {
  return (
    <g fill="#fff6df" opacity=".85" className="fw-cloud-drift">
      <path d="M70 91C81 77 98 81 108 70C120 54 139 60 148 73C168 67 184 79 188 88C157 96 106 94 70 91Z" />
      <path d="M639 67C654 54 673 59 681 45C692 30 717 38 724 52C741 45 765 60 770 68C732 74 674 74 639 67Z" />
      <path d="M839 121C852 107 869 115 877 101C892 87 911 99 917 109C934 104 950 116 951 122Z" />
    </g>
  );
}
const treePositions = Array.from({ length: 48 }, (_, i) => ({
  x: (i * 137.7 + 37) % 1000,
  y: 305 + ((i * 53.1) % 107),
  s: 0.27 + ((i * 17) % 40) / 100,
})).sort((a, b) => a.y - b.y);
const grassPositions = Array.from({ length: 185 }, (_, i) => ({
  x: (i * 67.31) % 1000,
  y: 424 + ((i * 23.13) % 129),
}));

export default memo(function TravelWorld({
  kind = "mountain",
  rainy = false,
  compact = false,
}: {
  kind?: Landscape;
  rainy?: boolean;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`fw-world ${rainy ? "fw-world-rain" : ""}`}
      viewBox="0 0 1000 560"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop stopColor={rainy ? "#9eafb1" : "#b9d7d6"} />
          <stop offset="1" stopColor={rainy ? "#e3e5d7" : "#f3ecd1"} />
        </linearGradient>
        <linearGradient id={`${id}-water`} x2="0" y2="1">
          <stop stopColor="#7fa9a4" />
          <stop offset="1" stopColor="#bed5be" />
        </linearGradient>
        <pattern
          id={`${id}-grain`}
          width="21"
          height="19"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="5" r=".65" fill="#f7efd0" />
          <circle cx="13" cy="12" r=".5" fill="#46634c" opacity=".4" />
          <path
            d="M7 16h1M18 3h1"
            stroke="#657b5d"
            strokeWidth=".6"
            opacity=".4"
          />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <path d="M0 36Q253 5 500 23T1000 36V514Q744 551 496 528T0 520Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <path d="M0 0H1000V560H0Z" fill={`url(#${id}-sky)`} />
        <circle
          cx="792"
          cy="105"
          r="33"
          fill={rainy ? "#d1d3ba" : "#faf0b9"}
          opacity=".8"
        />
        <Clouds />
        {kind === "mountain" ? (
          <>
            <path
              d="M-50 321L97 186L154 230L273 115L347 204L437 169L541 258L643 177L748 232L859 138L1050 316V560H-50Z"
              fill="#b5a49c"
            />
            <path
              d="M179 216L273 115L347 204L306 186L288 202L272 170L257 186L245 174L228 199Z M805 193L859 138L926 201L883 185L868 192L857 172L841 185Z"
              fill="#f7efdc"
            />
            <path
              d="M273 152L243 258L347 205L318 218L301 204Z M859 169L812 281L949 259Z"
              fill="#958d87"
              opacity=".6"
            />
            <path
              d="M-30 338Q125 231 267 294T519 328Q700 226 1050 289V560H-30Z"
              fill="#8ba489"
            />
            <path
              d="M-30 376Q139 284 337 345T683 335Q856 265 1030 330V560H-30Z"
              fill="#729371"
            />
            {treePositions.map((p, i) => (
              <Tree key={i} {...p} pine={i % 3 !== 0} />
            ))}
            <path
              d="M-30 422Q170 359 369 411T689 387Q866 352 1030 413V560H-30Z"
              fill="#b9ce8e"
            />
            <path
              d="M502 324Q472 341 514 358T538 394Q489 418 568 440T607 560H727Q742 496 632 455T602 407Q606 376 547 357T535 324Z"
              fill={`url(#${id}-water)`}
            />
            <path
              d="M-30 507C205 461 310 497 397 445S401 372 365 368"
              fill="none"
              stroke="#c3aa7b"
              strokeWidth="18"
            />
            <path
              d="M-30 507C205 461 310 497 397 445S401 372 365 368"
              fill="none"
              stroke="#e6d6ad"
              strokeWidth="11"
            />
            <Cabin x={339} y={382} s={0.86} cosy={rainy} />
            <Cabin x={386} y={361} s={0.38} />
            <Tree x={218} y={420} s={0.9} />
            <Tree x={182} y={438} s={0.74} />
            <Tree x={857} y={421} s={0.83} />
            <Tree x={908} y={447} s={1.04} />
            <path
              d="M474 462Q586 431 704 480"
              fill="none"
              stroke="#8c775d"
              strokeWidth="13"
            />
            <path
              d="M474 455Q586 424 704 473"
              fill="none"
              stroke="#d6c295"
              strokeWidth="6"
            />
            <path
              d="M479 447v15m24-21v15m24-20v15m25-18v15m25-15v15m25-12v15m25-9v15m25-6v15m25-2v15m24 2v15"
              stroke="#7b6b53"
              strokeWidth="2"
            />
          </>
        ) : kind === "coast" ? (
          <>
            <path
              d="M0 248Q345 228 1000 245V560H0Z"
              fill={`url(#${id}-water)`}
            />
            <g
              className="fw-water-flow"
              stroke="#ecf3de"
              opacity=".6"
              fill="none"
            >
              <path
                d="M0 293Q266 276 555 294T1030 291M-30 329Q260 307 521 330T1030 327M0 381Q267 351 530 377T1030 380"
                strokeWidth="3"
              />
            </g>
            <path
              d="M-20 338Q203 374 391 451Q608 524 1020 429V560H-20Z"
              fill="#d9c698"
            />
            <path
              d="M-20 374Q180 402 346 477Q628 573 1020 462V570H-20Z"
              fill="#b4c889"
            />
            <path
              d="M-20 364Q159 393 393 463Q698 538 1020 446"
              stroke="#f4e5bc"
              strokeWidth="8"
              fill="none"
            />
            <Cabin x={264} y={438} s={0.73} />
            <Cabin x={787} y={467} s={0.59} />
            {[75, 126, 842, 905, 959].map((x, i) => (
              <g key={x} transform={`translate(${x} ${423 + (i % 2) * 37})`}>
                <path
                  d="M0 0Q-10-44 11-108"
                  fill="none"
                  stroke="#826e4c"
                  strokeWidth="6"
                />
                <path
                  d="M11-108Q-29-137-48-100Q-15-117 11-108Q-5-149 29-149Q13-128 11-108Q52-146 68-114Q36-123 11-108Q44-106 54-77Q23-98 11-108"
                  fill="#37634b"
                />
              </g>
            ))}
            <path d="M529 300L565 299L556 309H537Z" fill="#655d4e" />
            <path d="M546 299V270L559 293H546" fill="#f1e4c3" />
          </>
        ) : (
          <>
            <path
              d="M0 271L145 236L315 267L546 229L729 263L1000 244V560H0Z"
              fill="#a7b89b"
            />
            <path d="M0 321Q378 285 1000 323V560H0Z" fill="#c8d4a7" />
            <path d="M438 320L569 320L736 560H202Z" fill="#d9c5a3" />
            <path
              d="M468 320L504 320L476 560H373Z"
              fill="#e6d5b3"
              opacity=".7"
            />
            {[
              { x: 222, y: 370, s: 1.3 },
              { x: 116, y: 418, s: 1.1 },
              { x: 721, y: 373, s: 1.4 },
              { x: 850, y: 429, s: 1.5 },
            ].map((p, i) => (
              <g key={i}>
                <Cabin {...p} cosy={rainy} />
                <path
                  d={`M${p.x - 42 * p.s} ${p.y - 18 * p.s}h${84 * p.s}l${8 * p.s} ${15 * p.s}h-${100 * p.s}Z`}
                  fill={i % 2 ? "#849d76" : "#b17f60"}
                />
              </g>
            ))}
            <Tree x={373} y={385} s={0.9} />
            <Tree x={633} y={419} s={1.1} />
            <Tree x={44} y={476} s={1.4} />
            <path d="M412 462h41v27h-41Z" fill="#47664b" />
            <circle cx="419" cy="494" r="6" fill="#636753" />
            <circle cx="449" cy="494" r="6" fill="#636753" />
            <path d="M406 459h52l-6-13h-41Z" fill="#c7a87a" />
          </>
        )}
        {!compact ? (
          <g className="fw-ground-breeze" strokeLinecap="round">
            {grassPositions.map((p, i) => (
              <path
                key={i}
                d={`M${p.x} ${p.y}q${i % 2 ? 3 : -2} -4 ${i % 2 ? 4 : -3} -${4 + (i % 6)}`}
                stroke={["#89a86a", "#a4be7d", "#d8dfa8"][i % 3]}
                strokeWidth="1.3"
                fill="none"
              />
            ))}
          </g>
        ) : null}
        <path d="M0 0H1000V560H0Z" fill={`url(#${id}-grain)`} opacity=".4" />
        {rainy ? (
          <g
            className="fw-rain-lines"
            stroke="#e8f0df"
            strokeWidth="1.5"
            opacity=".8"
          >
            {Array.from({ length: 48 }, (_, i) => (
              <path
                key={i}
                d={`M${(i * 73) % 1050} ${20 + ((i * 37) % 460)}l-9 24`}
              />
            ))}
          </g>
        ) : null}
        <g fill="none" stroke="#486a5a" strokeWidth="1.5" opacity=".7">
          <path d="M393 89q6-7 12 0q6-7 12 0M421 104q4-5 8 0q4-5 8 0" />
        </g>
      </g>
    </svg>
  );
});
