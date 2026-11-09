"use client";
import { useEffect, useRef } from "react";

type C = CanvasRenderingContext2D;
type P = [number, number];
const W = 2000,
  H = 1200;
function rand(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function buffer(width = W, height = H) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, c: canvas.getContext("2d")! };
}
function shape(c: C, points: P[], color: string) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = color;
  c.fill();
}
function oval(
  c: C,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  a = 0,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}
function stroke(c: C, points: P[], color: string, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.stroke();
}
function crown(
  c: C,
  x: number,
  y: number,
  rx: number,
  ry: number,
  seed: number,
) {
  const r = rand(seed);
  const path = new Path2D();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2,
      edge = 1 + Math.sin(a * 6 + seed) * 0.095 + Math.sin(a * 11) * 0.042;
    const xx = x + Math.cos(a) * rx * edge,
      yy = y + Math.sin(a) * ry * edge;
    i ? path.lineTo(xx, yy) : path.moveTo(xx, yy);
  }
  path.closePath();
  c.fillStyle = "#285449";
  c.fill(path);
  c.save();
  c.clip(path);
  for (let i = 0; i < 370; i++) {
    const px = x + (r() - 0.5) * rx * 2.2,
      py = y + (r() - 0.5) * ry * 2.2;
    const warm = -(py - y) / ry + ((px - x) / rx) * 0.35;
    const col =
      warm > 0.55 && i % 4 === 0
        ? "#c4c378"
        : i % 7 === 0
          ? "#809b63"
          : i % 3 === 0
            ? "#4d784e"
            : "#37634b";
    const s = 1 + r() * rx * 0.055;
    oval(c, px, py, s, s * 0.63, col, r() * 1.2 - 0.6);
  }
  c.restore();
}
function oak(c: C, x: number, y: number, s: number, seed: number) {
  const r = rand(seed);
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  oval(c, -37, 8, 86, 12, "rgba(31,56,139,.26)", -0.1);
  stroke(
    c,
    [
      [0, 0],
      [-4, -51],
      [-21, -91],
    ],
    "#594d43",
    6,
  );
  stroke(
    c,
    [
      [-2, -35],
      [26, -64],
      [42, -89],
    ],
    "#594d43",
    4,
  );
  stroke(
    c,
    [
      [-3, -44],
      [-37, -72],
    ],
    "#594d43",
    3,
  );
  crown(c, -32, -91, 39 + r() * 8, 35, seed);
  crown(c, 14, -112, 45, 37, seed + 15);
  crown(c, 47, -79, 35, 30, seed + 41);
  crown(c, 0, -69, 56, 33, seed + 22);
  c.restore();
}
function mountain(
  c: C,
  profile: P[],
  color: string,
  seed: number,
  snow = false,
  textureY = 600,
) {
  const r = rand(seed),
    p = new Path2D();
  profile.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.lineTo(2200, 1200);
  p.lineTo(-100, 1200);
  p.closePath();
  c.fillStyle = color;
  c.fill(p);
  c.save();
  c.clip(p);
  for (let i = 0; i < 260; i++) {
    const x = r() * 2200,
      y = textureY + r() * 430;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x - 17, y + 18, x - 64, y + 22, x - 96 - r() * 65, y + 58);
    c.strokeStyle = i % 3 ? "rgba(244,208,165,.29)" : "rgba(87,65,72,.18)";
    c.lineWidth = 0.7 + r() * 3;
    c.stroke();
  }
  for (let i = 0; i < 11000; i++) {
    c.fillStyle = i % 3 ? "rgba(246,213,177,.13)" : "rgba(87,65,72,.12)";
    c.fillRect(r() * W, textureY + r() * 600, 1.1, 1.1);
  }
  if (snow) {
    // Small broken snowfields cling to the highest ridge, following its slope.
    for (let i = 1; i < profile.length - 1; i++) {
      const [x, y] = profile[i];
      const [lx, ly] = profile[i - 1];
      const [rx, ry] = profile[i + 1];
      if (y >= ly || y >= ry || x < 1250) continue;
      const l = 0.31,
        right = 0.4;
      shape(
        c,
        [
          [x + (lx - x) * l, y + (ly - y) * l],
          [x, y],
          [x + (rx - x) * right, y + (ry - y) * right],
          [x + 29, y + 16],
          [x + 17, y + 13],
          [x + 8, y + 24],
          [x - 2, y + 10],
          [x - 18, y + 19],
          [x - 31, y + 14],
        ],
        "#efe4cf",
      );
      stroke(
        c,
        [
          [x - 3, y + 4],
          [x - 13, y + 12],
          [x - 20, y + 14],
        ],
        "#c3bebf",
        1.5,
      );
    }
  }
  c.restore();
}
interface Flower {
  x: number;
  y: number;
  h: number;
  lean: number;
  phase: number;
  color: string;
  petal: string;
  head: boolean;
}
class Pasture {
  sky = buffer();
  land = buffer();
  cloud = buffer(370, 125);
  flowers: Flower[] = [];
  constructor() {
    this.paintSky();
    this.paintCloud();
    this.paintLand();
    this.seedFlowers();
  }
  paintCloud() {
    const c = this.cloud.c;
    const p = new Path2D(
      "M15 92C32 74 57 76 76 65C91 39 123 33 149 46C176 15 217 23 236 47C264 39 286 49 298 65C325 66 350 78 352 91C318 106 278 102 238 106C174 110 124 102 79 107C46 108 24 103 15 92Z",
    );
    const tint = c.createLinearGradient(0, 25, 0, 110);
    tint.addColorStop(0, "#f8e9cf");
    tint.addColorStop(0.55, "#dfcbd1");
    tint.addColorStop(1, "#a9a1cc");
    c.fillStyle = tint;
    c.fill(p);
    c.save();
    c.clip(p);
    const r = rand(881);
    for (let i = 0; i < 4300; i++) {
      c.fillStyle = i % 3 ? "rgba(255,239,204,.15)" : "rgba(75,83,147,.10)";
      c.fillRect(r() * 370, 20 + r() * 95, 0.7, 0.7);
    }
    c.restore();
  }
  paintSky() {
    const c = this.sky.c,
      g = c.createLinearGradient(0, 0, 0, 800);
    g.addColorStop(0, "#1744ba");
    g.addColorStop(0.48, "#4665bf");
    g.addColorStop(0.72, "#ab9bd4");
    g.addColorStop(0.9, "#efa083");
    g.addColorStop(1, "#f5ce86");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    const r = rand(219);
    for (let y = 0; y < 800; y += 4.5) {
      for (let x = 0; x < W; x += 4.5) {
        const f = y / 800;
        const opacity = 0.03 + Math.pow(f, 1.8) * 0.22;
        c.fillStyle = `rgba(20,59,163,${opacity})`;
        const size = 0.35 + f * 0.75 + r() * 0.25;
        oval(
          c,
          x + (Math.floor(y / 4.5) % 2) * 2.2,
          y,
          size,
          size,
          "rgba(20,59,163," + opacity + ")",
        );
      }
    }
    for (let i = 0; i < 42000; i++) {
      c.fillStyle = i % 2 ? "rgba(255,224,167,.07)" : "rgba(17,52,147,.07)";
      c.fillRect(r() * W, r() * 810, 0.5 + r() * 1.4, 0.5 + r() * 1.4);
    }
  }
  paintLand() {
    const c = this.land.c,
      r = rand(370);
    mountain(
      c,
      [
        [-60, 804],
        [185, 767],
        [331, 784],
        [476, 718],
        [635, 763],
        [793, 747],
        [941, 788],
        [1112, 751],
        [1291, 774],
        [1450, 724],
        [1595, 743],
        [1751, 698],
        [1910, 725],
        [2090, 673],
      ],
      "#af9b99",
      40,
      true,
    );
    mountain(
      c,
      [
        [-60, 872],
        [168, 807],
        [369, 845],
        [568, 767],
        [720, 831],
        [895, 802],
        [1059, 849],
        [1250, 777],
        [1426, 816],
        [1609, 751],
        [1801, 799],
        [2055, 742],
      ],
      "#977f78",
      56,
    );
    const hill = new Path2D(
      "M-80 574C138 625 293 695 487 719C734 755 828 864 1159 909C1459 952 1712 846 2080 823V1300H-80Z",
    );
    c.fillStyle = "#b58c68";
    c.fill(hill);
    c.save();
    c.clip(hill);
    shape(
      c,
      [
        [-80, 652],
        [217, 718],
        [405, 786],
        [637, 834],
        [880, 918],
        [1079, 943],
        [721, 908],
        [478, 848],
        [169, 765],
        [-80, 712],
      ],
      "#997457",
    );
    for (let i = 0; i < 600; i++) {
      const x = r() * W,
        y = 600 + r() * 450;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 32, y + 11, x + 70 + r() * 60, y + 16);
      c.strokeStyle = i % 3 ? "rgba(228,190,143,.26)" : "rgba(113,78,55,.19)";
      c.lineWidth = 1 + r() * 7;
      c.stroke();
    }
    // Low groundcover follows the wooded slopes, leaving gaps of exposed soil.
    // A separate seed keeps the existing trees and foreground meadow in place.
    const grass = rand(915);
    for (let i = 0; i < 170; i++) {
      const x = grass() * W;
      const y = 650 + grass() * 350;
      const rx = 24 + grass() * 79;
      const ry = 5 + grass() * 12;
      const patch = new Path2D();
      for (let j = 0; j <= 24; j++) {
        const a = (j / 24) * Math.PI * 2;
        const edge = 1 + Math.sin(a * 5 + i) * 0.16;
        const px = x + Math.cos(a) * rx * edge;
        const py = y + Math.sin(a) * ry * edge + (px - x) * 0.08;
        if (j === 0) patch.moveTo(px, py);
        else patch.lineTo(px, py);
      }
      patch.closePath();
      c.fillStyle = i % 3 ? "rgba(161,190,119,.43)" : "rgba(123,158,95,.36)";
      c.fill(patch);
    }
    for (let i = 0; i < 16500; i++) {
      const x = grass() * W;
      const y = 610 + grass() * 410;
      const coverage =
        Math.sin(x * 0.014 + Math.sin(y * 0.03) * 2) +
        Math.cos(y * 0.054 + x * 0.004);
      if (coverage < -0.35 || grass() < 0.2) continue;
      const h = 1.2 + ((y - 600) / 420) * (2 + grass() * 4);
      stroke(
        c,
        [
          [x, y],
          [x + (grass() - 0.35) * h * 0.6, y - h],
        ],
        ["#a7c580", "#bdd593", "#8eaf6c", "#ccdda2"][i % 4],
        0.65,
      );
    }
    c.restore();
    // Clusters follow the slope rather than a uniform tree row.
    const trees: { x: number; y: number; s: number; seed: number }[] = [];
    for (let i = 0; i < 108; i++) {
      const x = r() * 1960;
      const ridge = 640 + x * 0.16 + Math.sin(x * 0.004) * 18;
      const y = ridge + r() * 93;
      trees.push({ x, y, s: 0.18 + r() * 0.45, seed: i + 32 });
    }
    trees.sort((a, b) => a.y - b.y);
    for (const t of trees) oak(c, t.x, t.y, t.s, t.seed);
    const valley = new Path2D(
      "M-60 977C292 924 546 1008 842 976C1140 938 1433 1015 1669 972C1806 945 1904 952 2060 908V1300H-60Z",
    );
    c.fillStyle = "#ad8463";
    c.fill(valley);
    // Uneven flower patches, not repeated agricultural rows.
    for (let i = 0; i < 55; i++) {
      const x = r() * W,
        y = 978 + r() * 222;
      oval(
        c,
        x,
        y,
        24 + r() * 65,
        4 + r() * 13,
        i % 3 ? "rgba(119,85,60,.13)" : "rgba(207,169,123,.16)",
        (r() - 0.5) * 0.5,
      );
    }
    const edgeTrees = [
      { x: 125, y: 899, s: 1.08, seed: 3 },
      { x: 267, y: 852, s: 0.68, seed: 6 },
      { x: 426, y: 900, s: 0.56, seed: 9 },
      { x: 1443, y: 947, s: 0.64, seed: 10 },
      { x: 1605, y: 909, s: 0.86, seed: 13 },
      { x: 1858, y: 893, s: 1.21, seed: 14 },
      { x: 2009, y: 921, s: 0.97, seed: 18 },
    ];
    for (const t of edgeTrees) oak(c, t.x, t.y, t.s, t.seed);
    for (let i = 0; i < 41000; i++) {
      const x = r() * W,
        y = 964 + r() * 236;
      const depth = (y - 930) / 270;
      const patch =
        (Math.sin(x * 0.008 + Math.sin(y * 0.013) * 2) +
          Math.cos(y * 0.034 + Math.sin(x * 0.005) * 3) * 0.7 +
          Math.sin((x + y) * 0.025) * 0.3 +
          2) /
        4;
      const col =
        patch > 0.59
          ? ["#77a864", "#8bbb71", "#a2c980"][i % 3]
          : ["#c9df9a", "#afd284", "#d4e6a8"][i % 3];
      const h = 1.5 + depth * (1 + r() * 6);
      stroke(
        c,
        [
          [x, y],
          [x + (r() - 0.5) * h, y - h],
        ],
        col,
        0.6 + depth * 0.7,
      );
      if (i % 8 === 0)
        oval(
          c,
          x,
          y - h,
          1 + depth * 0.9,
          1 + depth * 0.6,
          i % 4 ? "#f9dfb0" : "#c5b4df",
        );
    }
    // Fine print grain keeps large shapes from becoming flat vector cutouts.
    for (let i = 0; i < 43000; i++) {
      const x = r() * W,
        y = 600 + r() * 600;
      c.fillStyle = i % 2 ? "rgba(21,58,159,.055)" : "rgba(255,221,154,.09)";
      c.fillRect(x, y, 1, 1);
    }
  }
  seedFlowers() {
    const r = rand(668);
    for (let i = 0; i < 1850; i++) {
      const x = r() * W,
        y = 988 + r() * 241,
        d = (y - 980) / 250;
      this.flowers.push({
        x,
        y,
        h: 5 + d * (12 + r() * 25),
        lean: (r() - 0.5) * 10,
        phase: r() * 6.28,
        color: ["#73a15f", "#89b66c", "#9dc37b", "#b5d58d"][i % 4],
        petal: ["#f8dfae", "#e5bfcc", "#b9a8e0", "#ffe3ad"][i % 4],
        head: i % 3 === 0,
      });
    }
  }
  goat(
    c: C,
    x: number,
    y: number,
    s: number,
    cream: boolean,
    t: number,
    alert: boolean,
  ) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    const ink = cream ? "#fafaf4" : "#202320",
      shade = cream ? "#c6cec0" : "#101310";
    oval(c, 0, 5, 54, 7, "rgba(38,57,146,.22)");
    c.fillStyle = ink;
    c.beginPath();
    c.moveTo(-46, -39);
    c.bezierCurveTo(-38, -57, 9, -56, 26, -43);
    c.bezierCurveTo(39, -38, 34, -15, 20, -13);
    c.bezierCurveTo(-1, -5, -42, -15, -46, -30);
    c.closePath();
    c.fill();
    shape(
      c,
      [
        [-37, -23],
        [-31, -19],
        [-32, 0],
        [-27, 2],
        [-26, 6],
        [-37, 5],
      ],
      shade,
    );
    shape(
      c,
      [
        [15, -21],
        [23, -18],
        [18, 3],
        [22, 5],
        [12, 5],
      ],
      shade,
    );
    shape(
      c,
      [
        [-22, -18],
        [-15, -17],
        [-14, 2],
        [-10, 3],
        [-9, 6],
        [-18, 5],
      ],
      ink,
    );
    shape(
      c,
      [
        [26, -28],
        [30, -22],
        [29, 0],
        [33, 3],
        [32, 5],
        [24, 5],
      ],
      ink,
    );
    const head = alert ? -0.5 : Math.sin(t * 0.8 + x) * 0.035;
    c.save();
    c.translate(24, -38);
    c.rotate(head);
    c.fillStyle = ink;
    c.beginPath();
    c.moveTo(-1, -5);
    c.bezierCurveTo(15, -10, 14, 6, 28, 14);
    c.lineTo(29, 24);
    c.quadraticCurveTo(19, 31, 14, 19);
    c.lineTo(3, 11);
    c.closePath();
    c.fill();
    stroke(
      c,
      [
        [16, 9],
        [18, -2],
        [24, -6],
      ],
      shade,
      2.2,
    );
    stroke(
      c,
      [
        [10, 5],
        [7, -5],
        [11, -9],
      ],
      shade,
      1.8,
    );
    shape(
      c,
      [
        [12, 10],
        [3, 4],
        [-1, 6],
        [9, 14],
      ],
      shade,
    );
    stroke(
      c,
      [
        [23, 24],
        [22, 31],
      ],
      shade,
      1.5,
    );
    oval(c, 23, 14, 1.1, 1.1, cream ? "#30362e" : "#e4e7dc");
    c.restore();
    stroke(
      c,
      [
        [-46, -34],
        [-53, -31],
        [-55, -21],
      ],
      ink,
      3,
    );
    stroke(
      c,
      [
        [-42, -41],
        [-21, -48],
        [8, -46],
      ],
      cream ? "#ffffff" : "#5b635a",
      1.2,
    );
    c.restore();
  }
  draw(c: C, width: number, height: number, t: number, alert: boolean) {
    const scale = Math.max(width / W, height / H),
      ox = (width - W * scale) / 2,
      oy = height - H * scale;
    c.save();
    c.translate(ox, oy);
    c.scale(scale, scale);
    c.drawImage(this.sky.canvas, 0, 0);
    // Broad, slow wind carries the clouds in the same direction as the meadow.
    // Separate speeds and heights keep the sky from feeling like a repeating strip.
    const clouds = [
      { x: 50, y: 138, s: 0.96, speed: 3.1, opacity: 0.73 },
      { x: 1510, y: 196, s: 1.06, speed: 2.3, opacity: 0.66 },
      { x: -172, y: 424, s: 0.82, speed: 3.7, opacity: 0.51 },
      { x: 1700, y: 501, s: 0.64, speed: 2.0, opacity: 0.48 },
    ];
    for (const cloud of clouds) {
      const x = ((cloud.x + 450 + t * cloud.speed) % 2450) - 450;
      c.globalAlpha = cloud.opacity;
      c.drawImage(
        this.cloud.canvas,
        0,
        0,
        370,
        125,
        x,
        cloud.y + Math.sin(t * 0.11 + cloud.x) * 2,
        370 * cloud.s,
        125 * cloud.s,
      );
    }
    c.globalAlpha = 1;
    c.drawImage(this.land.canvas, 0, 0);
    const herd = [
      [542, 962, 0.64, 0],
      [640, 972, 0.51, 1],
      [730, 975, 0.48, 1],
      [1134, 976, 0.42, 0],
      [1202, 973, 0.31, 1],
      [1415, 988, 0.27, 0],
    ];
    herd.forEach(([x, y, s, cream], i) =>
      this.goat(c, x, y, s, Boolean(cream), t + i, alert && i === 0),
    );
    for (const f of this.flowers) {
      const bend =
        Math.sin(t * 1.4 - f.x * 0.005 + f.phase * 0.23) * f.h * 0.2 +
        Math.sin(t * 0.65 - f.x * 0.003) * f.h * 0.2;
      const tx = f.x + f.lean + bend,
        ty = f.y - f.h + Math.abs(bend) * 0.1;
      c.beginPath();
      c.moveTo(f.x, f.y);
      c.quadraticCurveTo(f.x + bend * 0.2, f.y - f.h * 0.6, tx, ty);
      c.strokeStyle = f.color;
      c.lineWidth = 0.65 + (f.y - 980) / 500;
      c.stroke();
      if (f.head) {
        const size = 1 + (f.y - 980) / 180;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI * 0.5 + 0.4;
          oval(
            c,
            tx + Math.cos(a) * size,
            ty + Math.sin(a) * size,
            size * 0.9,
            size * 0.55,
            f.petal,
            a,
          );
        }
        oval(c, tx, ty, size * 0.45, size * 0.45, "#edbb64");
      }
    }
    for (let i = 0; i < 3; i++) {
      const bx = 1510 + i * 64 + Math.sin(t * 0.08 + i) * 21,
        by = 518 + i * 13 + Math.sin(t * 0.2 + i) * 4;
      const flap = Math.sin(t * 2 + i) * 3;
      c.beginPath();
      c.moveTo(bx - 7, by - flap);
      c.quadraticCurveTo(bx - 2, by - 2, bx, by + 2);
      c.quadraticCurveTo(bx + 3, by - 2, bx + 8, by - flap);
      c.strokeStyle = "rgba(41,61,148,.58)";
      c.lineWidth = 1.3;
      c.stroke();
    }
    c.restore();
  }
}
export default function Meadow({
  paused,
  alert,
}: {
  paused: boolean;
  alert: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLCanvasElement>(null),
    state = useRef({ paused, alert }),
    refresh = useRef<(() => void) | null>(null);
  useEffect(() => {
    state.current = { paused, alert };
    refresh.current?.();
  }, [paused, alert]);
  useEffect(() => {
    const el = root.current,
      canvas = surface.current;
    if (!el || !canvas) return;
    const c = canvas.getContext("2d", { alpha: false });
    if (!c) return;
    const painter = new Pasture();
    let raf = 0,
      visible = false,
      last = 0,
      time = 0,
      w = 1,
      h = 1,
      dpr = 1,
      disposed = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    function measure() {
      if (!el || !canvas) return;
      const r = el.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      const sceneScale = Math.max(w / W, h / H);
      const hero = el.parentElement;
      hero?.style.setProperty(
        "--local-x",
        `${(w - W * sceneScale) / 2 + 542 * sceneScale}px`,
      );
      hero?.style.setProperty(
        "--local-y",
        `${h - H * sceneScale + 962 * sceneScale}px`,
      );
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    function draw(now: number) {
      if (disposed || !visible || !c || !el) return;
      const stop = state.current.paused || reduced.matches;
      if (last && !stop) time += Math.min(0.05, (now - last) / 1000);
      last = now;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      painter.draw(c, w, h, time, state.current.alert);
      el.dataset.motion = stop ? "paused" : "playing";
      el.dataset.sceneTime = time.toFixed(2);
      if (!stop) raf = requestAnimationFrame(draw);
    }
    function start() {
      cancelAnimationFrame(raf);
      last = 0;
      if (visible && !disposed) raf = requestAnimationFrame(draw);
    }
    refresh.current = start;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          measure();
          start();
        } else {
          cancelAnimationFrame(raf);
          el.dataset.motion = "offscreen";
          last = 0;
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    const resize = new ResizeObserver(() => {
      if (visible) {
        measure();
        start();
      }
    });
    resize.observe(el);
    reduced.addEventListener("change", start);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      resize.disconnect();
      reduced.removeEventListener("change", start);
      refresh.current = null;
    };
  }, []);
  return (
    <div
      className="ft-meadow"
      ref={root}
      role="img"
      aria-label="Code-drawn sunset mountain pasture with drifting clouds, brown ridges with small snowfields, green trees, black and white grazing goats and a moving light green flower meadow"
    >
      <canvas ref={surface} aria-hidden="true" />
    </div>
  );
}

export { oak, mountain, rand, oval, stroke, shape };
