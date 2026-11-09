"use client";
import { useEffect, useRef } from "react";
import { oak, mountain, rand, oval, stroke, shape } from "./Meadow";
type Scene = "discover" | "stay" | "weather" | "route";
export default function ChapterArt({
  scene = "discover",
  kind = "mountain",
  rain = false,
  paused = false,
  variant = 0,
  comfort = false,
}: {
  scene?: Scene;
  kind?: string;
  rain?: boolean;
  paused?: boolean;
  variant?: number;
  comfort?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const c = el.getContext("2d");
    if (!c) return;
    const layer = document.createElement("canvas");
    layer.width = 1200;
    layer.height = 700;
    const p = layer.getContext("2d")!;
    const r = rand((scene === "stay" ? 918 : 217) + variant * 73);
    const coast = kind === "coast";
    const sky = p.createLinearGradient(0, 0, 0, 520);
    sky.addColorStop(0, rain ? "#8295a6" : "#5377bd");
    sky.addColorStop(0.6, rain ? "#b2b9b7" : "#b7b1cf");
    sky.addColorStop(1, "#f1c4a2");
    p.fillStyle = sky;
    p.fillRect(0, 0, 1200, 700);
    oval(p, 940, 123, 36, 36, rain ? "#c3c7bc" : "#fae9b4");
    for (let y = 0; y < 500; y += 5)
      for (let x = 0; x < 1200; x += 5)
        oval(
          p,
          x + (y % 10 ? 2 : 0),
          y,
          0.5 + y / 1000,
          0.5 + y / 1000,
          "rgba(42,66,142,.13)",
        );
    if (coast) {
      p.fillStyle = "#92b7b3";
      p.fillRect(0, 330, 1200, 370);
      shape(
        p,
        [
          [0, 490],
          [190, 455],
          [440, 490],
          [700, 580],
          [1200, 590],
          [1200, 700],
          [0, 700],
        ],
        "#c4b28c",
      );
    } else {
      mountain(
        p,
        [
          [-100, 500],
          [70, 340],
          [190, 365],
          [365, 218],
          [485, 350],
          [630, 305],
          [790, 398],
          [980, 268],
          [1300, 480],
        ],
        "#a99a9c",
        70,
        false,
        210,
      );
      shape(
        p,
        [
          [282, 304],
          [365, 218],
          [431, 301],
          [390, 282],
          [373, 296],
          [355, 263],
          [338, 282],
          [322, 274],
        ],
        "#f0e4cf",
      );
      mountain(
        p,
        [
          [-100, 570],
          [115, 435],
          [340, 487],
          [560, 385],
          [790, 495],
          [1030, 397],
          [1300, 540],
        ],
        "#8b9186",
        81,
        false,
        380,
      );
    }
    const ground = new Path2D(
      "M-20 515Q180 430 395 520T790 510Q1010 465 1230 519V720H-20Z",
    );
    p.fillStyle = "#ad8463";
    p.fill(ground);
    p.save();
    p.clip(ground);
    for (let i = 0; i < 15000; i++) {
      const x = r() * 1200,
        y = 440 + r() * 270;
      const h = 2 + r() * 5;
      stroke(
        p,
        [
          [x, y],
          [x + (r() - 0.4) * 3, y - h],
        ],
        ["#b7d78c", "#9fbd7d", "#cbdda3", "#8eab70"][i % 4],
        0.7,
      );
    }
    p.restore();
    if (scene === "discover" || scene === "route") {
      const trees = Array.from({ length: variant === 2 ? 16 : 75 }, (_, i) => ({
        x: r() * 1300 - 50,
        y: 480 + r() * 130,
        s: 0.18 + r() * 0.47,
        seed: i + 21,
      })).sort((a, b) => a.y - b.y);
      trees.forEach((t) => oak(p, t.x, t.y, t.s, t.seed));
      p.beginPath();
      p.moveTo(-40, 665);
      p.bezierCurveTo(250, 590, 610, 670, 550, 548);
      p.bezierCurveTo(530, 509, 570, 502, 650, 499);
      p.strokeStyle = "#b19a76";
      p.lineWidth = 22;
      p.stroke();
      p.strokeStyle = "#dbc9a2";
      p.lineWidth = 12;
      p.stroke();
      if (scene === "discover") {
        // A small trail shelter and resting walkers give the landscape scale.
        shape(
          p,
          [
            [350, 548],
            [391, 491],
            [440, 548],
          ],
          "#d3b087",
        );
        shape(
          p,
          [
            [391, 491],
            [413, 548],
            [440, 548],
          ],
          "#a68168",
        );
        shape(
          p,
          [
            [378, 548],
            [393, 514],
            [405, 548],
          ],
          "#625f50",
        );
        oak(p, 170, 603, 1.25, 22);
        oak(p, 1105, 614, 1.5, 33);
        for (let i = 0; i < 3; i++) {
          const x = 704 + i * 19;
          oval(p, x, 568 + i * 2, 4, 4, "#555749");
          stroke(
            p,
            [
              [x, 574 + i * 2],
              [x - 2, 588 + i * 2],
            ],
            i % 2 ? "#cba37a" : "#57716b",
            6,
          );
          stroke(
            p,
            [
              [x - 2, 588 + i * 2],
              [x - 7, 598 + i * 2],
              [x - 2, 588 + i * 2],
              [x + 5, 597 + i * 2],
            ],
            "#545d50",
            2,
          );
        }
      }
    }
    if(scene === "discover" && variant === 0){oak(p,85,765,4.1,33);oak(p,1250,745,3.1,44);}
    if(scene === "discover" && variant === 2){
      const meadow = new Path2D("M0 520Q300 490 600 555T1200 530V700H0Z");p.fillStyle="#b4c989";p.fill(meadow);p.save();p.clip(meadow);
      for(let i=0;i<6000;i++){const x=r()*1200,y=500+r()*200;stroke(p,[[x,y],[x+2,y-4-r()*7]],i%3?"#8eae70":"#dce0a4",1);if(i%5===0)oval(p,x,y-7,2,1.4,i%2?"#eee0c1":"#b6aed0");}p.restore();
    }
    if (scene === "stay") {
      // A close porch view: timber, woven chair and an enamel cup, not another map.
      oak(p, 180, 580, 1.3, 45);
      oak(p, 1040, 590, 1.2, 23);
      shape(
        p,
        [
          [0, 542],
          [1200, 542],
          [1200, 700],
          [0, 700],
        ],
        "#ad8d6a",
      );
      for (let i = 0; i < 12; i++)
        stroke(
          p,
          [
            [i * 120 - 120, 542],
            [i * 155 - 300, 700],
          ],
          "#846e54",
          2,
        );
      for (let y = 570; y < 700; y += 33)
        stroke(
          p,
          [
            [0, y],
            [1200, y],
          ],
          "#d0ae82",
          1,
        );
      p.fillStyle = "#705f4d";
      p.fillRect(0, 0, 1200, 33);
      p.fillRect(67, 0, 27, 580);
      p.fillRect(1090, 0, 27, 580);
      stroke(
        p,
        [
          [0, 503],
          [1200, 503],
        ],
        "#846b51",
        13,
      );
      for (let x = 110; x < 1100; x += 85)
        stroke(
          p,
          [
            [x, 505],
            [x, 550],
          ],
          "#846b51",
          6,
        );
      shape(
        p,
        [
          [725, 401],
          [865, 399],
          [834, 551],
          [700, 549],
        ],
        "#b8a783",
      );
      for (let x = 725; x < 860; x += 11)
        stroke(
          p,
          [
            [x, 409],
            [x - 18, 532],
          ],
          "#807a5e",
          1,
        );
      stroke(
        p,
        [
          [715, 432],
          [690, 580],
          [728, 552],
          [824, 552],
          [851, 585],
          [851, 430],
        ],
        "#6a6952",
        9,
      );
      oval(p, 507, 559, 70, 15, "#c3a47c");
      stroke(
        p,
        [
          [507, 565],
          [507, 631],
        ],
        "#897258",
        11,
      );
      oval(p, 511, 544, 12, 5, "#e3dfc4");
      p.fillStyle = "#dae0c4";
      p.fillRect(499, 528, 24, 16);
      oval(p, 511, 529, 12, 4, "#725f49");
      oval(p, 225, 558, 42, 14, "#8c8260");
      shape(
        p,
        [
          [184, 555],
          [193, 615],
          [252, 615],
          [267, 555],
        ],
        "#b79572",
      );
      for (let i = 0; i < 20; i++) {
        const x = 222 + (r() - 0.5) * 70;
        stroke(
          p,
          [
            [222, 555],
            [x, 485 - r() * 60],
          ],
          "#4d7451",
          3,
        );
        oval(p, x, 480 - r() * 50, 6, 18, "#6f935f", r() - 0.5);
      }
    }
    if(scene === "stay" && comfort){
      shape(p,[[712,487],[830,487],[818,535],[702,534]],"#bc8c76");
      for(let i=0;i<7;i++)stroke(p,[[714+i*15,489],[704+i*15,532]],"#e5c4a0",2);
      oval(p,550,551,20,8,"#f2e1b8");p.fillStyle="#e2cea5";p.fillRect(535,528,30,22);oval(p,550,528,15,5,"#f6eacb");
    }
    if (scene === "weather") {
      // Shelter beneath a broad oak; a picnic remains while the weather moves.
      oak(p, 225, 710, 4.4, 6);
      oak(p, 1130, 590, 1.2, 53);
      shape(
        p,
        [
          [382, 612],
          [609, 600],
          [687, 680],
          [423, 691],
        ],
        "#d1b596",
      );
      for (let i = 0; i < 8; i++)
        stroke(
          p,
          [
            [390 + i * 29, 611 - i],
            [430 + i * 32, 687 - i],
          ],
          "#f0d9af",
          3,
        );
      oval(p, 507, 631, 24, 11, "#ac9670");
      shape(
        p,
        [
          [485, 628],
          [490, 653],
          [526, 653],
          [531, 628],
        ],
        "#ad8d60",
      );
      stroke(
        p,
        [
          [490, 627],
          [496, 605],
          [517, 605],
          [525, 627],
        ],
        "#927b55",
        3,
      );
      oval(p, 571, 654, 10, 5, "#e6e3cd");
    }
    for (let i = 0; i < 35000; i++) {
      p.fillStyle = i % 2 ? "rgba(255,230,186,.08)" : "rgba(40,62,87,.08)";
      p.fillRect(r() * 1200, r() * 700, 1, 1);
    }
    let frame = 0,
      last = 0,
      time = 0,
      visible = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    function draw(now: number) {
      if (!c || !el) return;
      if (last && !paused && !reduced.matches)
        time += Math.min(0.05, (now - last) / 1000);
      last = now;
      c.drawImage(layer, 0, 0);
      if (scene === "discover" || scene === "route") {
        c.save();
        c.globalAlpha = 0.55;
        for (let i = 0; i < 3; i++) {
          const x = ((i * 480 + time * 3) % 1500) - 150;
          c.save();c.translate(x,78+i*36);c.scale(.8+i*.08,.8+i*.08);
          const cloud=new Path2D("M-100 22C-91 9-70 15-58 5C-53-12-32-19-17-8C-5-31 28-25 39-6C62-14 79 2 83 11C102 10 117 20 119 26C69 37-53 34-100 22Z");
          const light=c.createLinearGradient(0,-22,0,35);light.addColorStop(0,"#fff0d4");light.addColorStop(1,"#c5b7cd");c.fillStyle=light;c.fill(cloud);c.restore();
        }
        c.restore();
      }
      if (rain) {
        c.strokeStyle = "rgba(223,235,226,.55)";
        c.lineWidth = 1;
        for (let i = 0; i < 95; i++) {
          const x = (i * 139 - time * 35) % 1250,
            y = (i * 71 + time * 210) % 700;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - 6, y + 17);
          c.stroke();
        }
      }
      if (visible && !paused && !reduced.matches)
        frame = requestAnimationFrame(draw);
    }
    el.width = 1200;
    el.height = 700;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        cancelAnimationFrame(frame);
        last = 0;
        if (visible) draw(performance.now());
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    const refresh = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (visible) draw(performance.now());
    };
    reduced.addEventListener("change", refresh);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", refresh);
    };
  }, [scene, kind, rain, paused, variant, comfort]);
  return (
    <canvas
      className={`fw-chapter-art fw-art-${scene}`}
      ref={canvas}
      role="img"
      aria-label={
        scene === "stay"
          ? "A textured timber porch with a woven chair, tea and a valley view"
          : scene === "weather"
            ? "A picnic sheltered beneath a textured oak tree as the weather changes"
            : "A textured pastel valley with wooded hills, a trail shelter and tiny walkers"
      }
    />
  );
}
