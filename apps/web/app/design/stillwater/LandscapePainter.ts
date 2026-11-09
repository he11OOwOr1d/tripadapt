/** All scenery is drawn here with native Canvas paths. No scene image is loaded. */
export type LandscapeKind = "valley" | "coast" | "inn" | "rain";
type Ctx = CanvasRenderingContext2D;
type Point = [number, number];
const coastShape =
  "M-60 1050C197 896 410 991 657 777S967 494 1218 486C1370 492 1490 550 1660 547V1500H-60Z";
const W = 1600,
  H = 1900,
  TOP = -400;
const riverCourse: [number, number, number][] = [
  [612, 828, 0.7],
  [651, 811, 3],
  [689, 801, 11],
  [734, 833, 25],
  [790, 733, 51],
  [855, 674, 78],
  [950, 748, 115],
  [1120, 903, 180],
  [1500, 1020, 300],
];
function riverAt(y: number) {
  let j = 0;
  while (j < riverCourse.length - 2 && y > riverCourse[j + 1][0]) j++;
  const a = riverCourse[j],
    b = riverCourse[j + 1],
    p = riverCourse[Math.max(0, j - 1)],
    q = riverCourse[Math.min(riverCourse.length - 1, j + 2)],
    t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0]))),
    t2 = t * t,
    t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * a[1] +
        (-p[1] + b[1]) * t +
        (2 * p[1] - 5 * a[1] + 4 * b[1] - q[1]) * t2 +
        (-p[1] + 3 * a[1] - 3 * b[1] + q[1]) * t3),
    half: a[2] + (b[2] - a[2]) * t,
  };
}
function riverOutline(extra = 0) {
  const left: Point[] = [],
    right: Point[] = [];
  for (let y = 612; y <= 1500; y += 4) {
    const p = riverAt(y);
    left.push([p.x - p.half - extra, y]);
    right.push([p.x + p.half + extra, y]);
  }
  const points = [...left, ...right.reverse()];
  return (
    points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y}`).join("") +
    "Z"
  );
}
export const riverShape = riverOutline();
const valleyHouse = { x: 1127, y: 724, scale: 0.8 };
function random(seed: number) {
  let v = seed;
  return () => {
    v = (v * 1664525 + 1013904223) >>> 0;
    return v / 4294967296;
  };
}
function layer() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.translate(0, -TOP);
  return { canvas: c, ctx };
}
function poly(c: Ctx, points: Point[], fill: string) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}
function line(c: Ctx, points: Point[], colour: string, width = 1) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.lineCap = "round";
  c.stroke();
}
function ellipse(
  c: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  rotation = 0,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}
function ridge(profile: Point[], seed: number): Point[] {
  const r = random(seed),
    out: Point[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const p0 = profile[Math.max(0, i - 1)],
      p1 = profile[i],
      p2 = profile[i + 1],
      p3 = profile[Math.min(profile.length - 1, i + 2)];
    const steps = Math.ceil((p2[0] - p1[0]) / 9);
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        t2 = t * t,
        t3 = t2 * t;
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([p1[0] + (p2[0] - p1[0]) * t, y + (r() - 0.5) * 5]);
    }
  }
  out.push(profile[profile.length - 1]);
  return out;
}
function mountain(
  c: Ctx,
  profile: Point[],
  colour: string,
  seed: number,
  detail: number,
) {
  const edge = ridge(profile, seed),
    path = new Path2D();
  edge.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.lineTo(1700, 1100);
  path.lineTo(-100, 1100);
  path.closePath();
  c.fillStyle = colour;
  c.fill(path);
  c.save();
  c.clip(path);
  const r = random(seed + 38);
  for (let i = 0; i < detail; i++) {
    const x = r() * 1800 - 100,
      top = 260 + r() * 520;
    const length = 40 + r() * 230;
    c.beginPath();
    c.moveTo(x, top);
    c.bezierCurveTo(
      x - 20,
      top + length * 0.3,
      x - 80,
      top + length * 0.6,
      x - 120 - r() * 100,
      top + length,
    );
    c.strokeStyle =
      i % 3 === 0 ? "rgba(223,235,226,.065)" : "rgba(27,73,82,.035)";
    c.lineWidth = 1 + r() * 4;
    c.stroke();
  }
  for (let i = 0; i < detail * 3; i++) {
    const x = r() * 1800 - 100,
      y = 280 + r() * 540;
    c.fillStyle = i % 2 ? "rgba(232,235,204,.045)" : "rgba(40,80,75,.035)";
    c.fillRect(x, y, 4 + r() * 19, 1 + r() * 3);
  }
  c.restore();
}
function foliage(
  c: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  seed: number,
  colours: string[],
) {
  const r = random(seed),
    outline = new Path2D();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2,
      edge =
        1 +
        Math.sin(a * 5 + seed) * 0.09 +
        Math.sin(a * 9) * 0.045 +
        (r() - 0.5) * 0.09;
    const xx = x + Math.cos(a) * rx * edge,
      yy = y + Math.sin(a) * ry * edge;
    i ? outline.lineTo(xx, yy) : outline.moveTo(xx, yy);
  }
  outline.closePath();
  const shade = c.createLinearGradient(x - rx, y + ry, x + rx * 0.6, y - ry);
  shade.addColorStop(0, colours[0]);
  shade.addColorStop(0.6, colours[1]);
  shade.addColorStop(1, colours[2]);
  c.fillStyle = shade;
  c.fill(outline);
  c.save();
  c.clip(outline);
  for (let i = 0; i < 185; i++) {
    const px = x + (r() - 0.5) * rx * 2.15,
      py = y + (r() - 0.5) * ry * 2.15;
    const sun = (px - x) * 0.004 - (py - y) * 0.009 + r() * 0.6;
    const size = (1.5 + r() * 4.5) * (rx / 50);
    ellipse(
      c,
      px,
      py,
      size,
      size * 0.58,
      colours[sun > 0.45 ? 2 : sun > 0.05 ? 1 : 0],
      -0.6 + r() * 1.2,
    );
    if (i % 7 === 0)
      line(
        c,
        [
          [px, py],
          [px + size * 0.8, py - 0.5],
        ],
        "rgba(219,228,162,.18)",
        0.65,
      );
  }
  c.restore();
}
function pine(
  c: Ctx,
  x: number,
  y: number,
  s: number,
  seed: number,
  colours: string[],
) {
  const r = random(seed),
    height = 128 + r() * 31,
    base = 31 + r() * 13;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const points: Point[] = [[-1, -height]];
  for (let i = 1; i < 22; i++) {
    const t = i / 22,
      yy = -height + t * (height - 9),
      w = Math.pow(t, 0.78) * base;
    points.push(
      [-w * (0.78 + r() * 0.28), yy],
      [-w * (0.46 + r() * 0.18), yy + 3 + r() * 3],
    );
  }
  points.push([0, -4]);
  for (let i = 21; i > 0; i--) {
    const t = i / 22,
      yy = -height + t * (height - 9),
      w = Math.pow(t, 0.82) * base;
    points.push(
      [w * (0.56 + r() * 0.14), yy + 4],
      [w * (0.8 + r() * 0.23), yy - 1],
    );
  }
  const silhouette = new Path2D();
  points.forEach(([px, py], i) =>
    i ? silhouette.lineTo(px, py) : silhouette.moveTo(px, py),
  );
  silhouette.closePath();
  line(
    c,
    [
      [0, 1],
      [0, -27],
    ],
    "#58604a",
    3,
  );
  const shade = c.createLinearGradient(-base, -height * 0.2, base, -height);
  shade.addColorStop(0, colours[0]);
  shade.addColorStop(0.65, colours[1]);
  shade.addColorStop(1, colours[2]);
  c.fillStyle = shade;
  c.fill(silhouette);
  c.save();
  c.clip(silhouette);
  for (let i = 0; i < 105; i++) {
    const yy = -height + r() * (height - 9),
      t = (yy + height) / height,
      xx = (r() - 0.5) * base * 2 * t;
    const size = 1 + r() * 3.5;
    ellipse(
      c,
      xx,
      yy,
      size,
      size * 0.46,
      i % 4 === 0 ? colours[2] : i % 3 === 0 ? colours[0] : colours[1],
      -0.25,
    );
    if (i % 11 === 0)
      line(
        c,
        [
          [xx - 2, yy + 1],
          [xx + 4, yy - 1],
        ],
        "rgba(169,191,127,.2)",
        0.8,
      );
  }
  c.restore();
  c.restore();
}
function broadleaf(
  c: Ctx,
  x: number,
  y: number,
  s: number,
  seed: number,
  colours: string[],
) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  line(
    c,
    [
      [1, 0],
      [-2, -51],
      [-13, -94],
    ],
    "#5e6248",
    5,
  );
  line(
    c,
    [
      [-1, -42],
      [23, -77],
      [32, -97],
    ],
    "#62674b",
    3,
  );
  line(
    c,
    [
      [-3, -53],
      [-27, -82],
    ],
    "#62674b",
    2.4,
  );
  foliage(c, -10, -88, 43, 39, seed, colours);
  foliage(c, 22, -86, 33, 34, seed + 31, colours);
  foliage(c, 2, -65, 42, 28, seed + 75, colours);
  c.restore();
}
function shrub(
  c: Ctx,
  x: number,
  y: number,
  s: number,
  seed: number,
  colours = ["#3f6748", "#608451", "#90a563"],
) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  foliage(c, 0, -17, 31, 23, seed, colours);
  foliage(c, 25, -12, 23, 17, seed + 47, colours);
  c.restore();
}
function canopySprite() {
  const surface = document.createElement("canvas");
  surface.width = 720;
  surface.height = 360;
  const c = surface.getContext("2d")!,
    r = random(894);
  const crown = new Path2D();
  crown.moveTo(160, -20);
  crown.lineTo(760, -20);
  crown.lineTo(760, 240);
  const edge: [[number, number], ...Array<[number, number]>] = [
    [0, 99],
    [80, 171],
    [170, 201],
    [250, 225],
    [340, 244],
    [430, 248],
    [520, 288],
    [620, 271],
    [720, 255],
    [760, 240],
  ];
  for (let x = 760; x >= 100; x -= 4) {
    let j = 0;
    while (j < edge.length - 2 && x > edge[j + 1][0]) j++;
    const aa = edge[j],
      bb = edge[j + 1],
      t = (x - aa[0]) / (bb[0] - aa[0]);
    const y =
      aa[1] + (bb[1] - aa[1]) * t + Math.sin(x * 0.31) * 3 + (r() - 0.5) * 9;
    crown.lineTo(x, y);
  }
  crown.bezierCurveTo(54, 181, 56, 144, 77, 127);
  crown.bezierCurveTo(45, 121, 52, 88, 78, 76);
  crown.bezierCurveTo(52, 46, 80, 20, 106, 24);
  crown.bezierCurveTo(99, -2, 135, -14, 160, -20);
  crown.closePath();
  const shade = c.createLinearGradient(50, 300, 660, 20);
  shade.addColorStop(0, "#244f43");
  shade.addColorStop(0.55, "#426d46");
  shade.addColorStop(1, "#71924f");
  c.fillStyle = shade;
  c.fill(crown);
  c.save();
  c.clip(crown);
  c.beginPath();
  c.moveTo(746, 49);
  c.bezierCurveTo(559, 73, 424, 128, 138, 170);
  c.strokeStyle = "#2c5142";
  c.lineWidth = 15;
  c.lineCap = "round";
  c.stroke();
  line(
    c,
    [
      [511, 108],
      [447, 206],
      [355, 259],
    ],
    "#315643",
    8,
  );
  line(
    c,
    [
      [382, 135],
      [287, 78],
      [191, 44],
    ],
    "#315643",
    6,
  );
  for (let i = 0; i < 3100; i++) {
    const x = r() * 760,
      y = r() * 350;
    const sunlight = x * 0.001 - y * 0.0018 + r() * 0.6;
    const colour =
      sunlight > 0.75
        ? "#a3b86e"
        : sunlight > 0.42
          ? "#7b9a53"
          : sunlight > 0.12
            ? "#567f49"
            : sunlight > -0.15
              ? "#3e6a43"
              : "#2b5442";
    const size = 1.2 + r() * 4.6;
    ellipse(c, x, y, size, size * 0.6, colour, -0.7 + r() * 1.2);
    if (i % 13 === 0)
      line(
        c,
        [
          [x, y],
          [x + size, y - 1],
        ],
        "rgba(208,222,145,.24)",
        0.7,
      );
  }
  c.restore();
  c.save();
  c.globalCompositeOperation = "destination-out";
  const gaps = random(631);
  for (let i = 0; i < 85; i++) {
    const x = 80 + gaps() * 650,
      y = 25 + gaps() * 230;
    ellipse(c, x, y, 1 + gaps() * 4, 0.8 + gaps() * 2.5, "#000", -0.4);
  }
  c.restore();
  return surface;
}
function cloudSprite(seed: number) {
  const c = document.createElement("canvas");
  c.width = 470;
  c.height = 180;
  const x = c.getContext("2d")!,
    r = random(seed);
  for (let i = 0; i < 40; i++) {
    const px = 40 + r() * 380,
      py = 96 + Math.sin(px * 0.016) * 16;
    ellipse(x, px, py, 24 + r() * 36, 10 + r() * 20, "rgba(196,214,219,.3)");
  }
  for (let i = 0; i < 48; i++) {
    const px = 45 + r() * 370,
      edge = Math.sin(((px - 30) / 410) * Math.PI);
    const py = 113 - edge * (28 + r() * 49);
    ellipse(
      x,
      px,
      py,
      17 + r() * 27,
      12 + r() * 21,
      i % 4 === 0 ? "#e6ece5" : "#f5f5e8",
    );
  }
  for (let i = 0; i < 32; i++) {
    const px = 50 + r() * 360;
    ellipse(
      x,
      px,
      122 + r() * 10,
      20 + r() * 30,
      3 + r() * 8,
      "rgba(212,226,224,.45)",
    );
  }
  return c;
}
function wood(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
) {
  const r = random(seed);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  for (let i = 0; i < 16; i++) {
    const yy = y + r() * h;
    line(
      c,
      [
        [x - 10, yy],
        [x + w * 0.3, yy + r() * 2],
        [x + w, yy - 1],
      ],
      i % 3 ? "rgba(67,54,32,.17)" : "rgba(236,211,154,.19)",
      0.6 + r(),
    );
  }
  c.restore();
}
function bridge(c: Ctx) {
  const x = 740,
    y = 714;
  c.save();
  c.translate(x, y);
  poly(
    c,
    [
      [0, 12],
      [162, -5],
      [187, 13],
      [16, 34],
    ],
    "#897752",
  );
  for (let i = 0; i < 15; i++) {
    const t = i / 15;
    poly(
      c,
      [
        [t * 162, 12 - t * 17],
        [t * 162 + 9, 11 - t * 17],
        [t * 162 + 26, 31 - t * 18],
        [t * 162 + 16, 33 - t * 17],
      ],
      i % 3 ? "#a08f65" : "#b3a275",
    );
    line(
      c,
      [
        [t * 162 + 4, 14 - t * 17],
        [t * 162 + 16, 29 - t * 17],
      ],
      "rgba(57,63,42,.35)",
      0.8,
    );
  }
  poly(
    c,
    [
      [16, 34],
      [187, 13],
      [186, 23],
      [16, 43],
    ],
    "#685f43",
  );
  for (const [px, py] of [
    [1, 12],
    [54, 6],
    [109, 0],
    [162, -5],
    [18, 34],
    [76, 26],
    [132, 19],
    [185, 13],
  ]) {
    line(
      c,
      [
        [px, py],
        [px, py - 34],
      ],
      "#76664a",
      4,
    );
    line(
      c,
      [
        [px - 1, py],
        [px - 1, py - 34],
      ],
      "#b1a077",
      1,
    );
  }
  line(
    c,
    [
      [0, -22],
      [162, -39],
    ],
    "#897652",
    5,
  );
  line(
    c,
    [
      [18, 0],
      [185, -21],
    ],
    "#8e7a52",
    5,
  );
  line(
    c,
    [
      [0, -24],
      [162, -41],
    ],
    "#c1b38b",
    1.2,
  );
  line(
    c,
    [
      [18, -2],
      [185, -23],
    ],
    "#c1b38b",
    1.2,
  );
  line(
    c,
    [
      [15, 39],
      [16, 66],
    ],
    "#71654a",
    8,
  );
  line(
    c,
    [
      [174, 19],
      [172, 47],
    ],
    "#71654a",
    7,
  );
  c.restore();
}
function house(c: Ctx, x: number, y: number, s: number, seed: number) {
  const r = random(seed);
  c.save();
  c.translate(x, y);
  c.scale(s * 1.1, s * 0.82);
  ellipse(c, 96, 109, 149, 21, "rgba(31,61,39,.21)", -0.09);
  const front = new Path2D("M-5-47 177-67 177 79-5 98Z");
  c.fillStyle = "#d6d1ae";
  c.fill(front);
  poly(
    c,
    [
      [177, -67],
      [235, -91],
      [235, 53],
      [177, 79],
    ],
    "#9aab91",
  );
  c.save();
  c.clip(front);
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 12; col++) {
      const xx = col * 19 + (row % 2 ? -9 : 0),
        yy = -47 + row * 19 - xx * 0.105;
      poly(
        c,
        [
          [xx, yy],
          [xx + 17, yy - 1.5],
          [xx + 17, yy + 15],
          [xx, yy + 16.5],
        ],
        ["#c9c9a7", "#d9d5b3", "#d0cfad", "#ded9b7"][Math.floor(r() * 4)],
      );
      line(
        c,
        [
          [xx, yy + 17],
          [xx + 18, yy + 15],
        ],
        "rgba(107,119,91,.19)",
        0.8,
      );
    }
  poly(
    c,
    [
      [-6, 48],
      [181, 27],
      [181, 82],
      [-6, 103],
    ],
    "#8e8666",
  );
  for (let i = 0; i < 11; i++)
    line(
      c,
      [
        [i * 19, 46 - i * 2],
        [i * 19, 104 - i * 2],
      ],
      "rgba(57,76,56,.28)",
      1.2,
    );
  const wallShade = c.createLinearGradient(0, -50, 0, 35);
  wallShade.addColorStop(0, "rgba(32,63,45,.19)");
  wallShade.addColorStop(1, "rgba(32,63,45,0)");
  c.fillStyle = wallShade;
  c.fillRect(-10, -70, 200, 165);
  c.restore();
  const roof = new Path2D("M-31-50 19-123 208-145 175-73Z");
  c.fillStyle = "#4a626b";
  c.fill(roof);
  poly(
    c,
    [
      [208, -145],
      [251, -101],
      [175, -73],
    ],
    "#344d56",
  );
  c.save();
  c.clip(roof);
  for (let row = 0; row < 8; row++) {
    const t = row / 8;
    const lx = -31 + (19 + 31) * t,
      ly = -50 + (-123 + 50) * t,
      rx = 175 + (208 - 175) * t,
      ry = -73 + (-145 + 73) * t;
    line(
      c,
      [
        [lx, ly],
        [rx, ry],
      ],
      row % 2 ? "#77878a" : "#657b7f",
      1.15,
    );
    for (let col = 0; col < 12; col++) {
      const u = (col + (row % 2) * 0.5) / 12;
      const xx = lx + (rx - lx) * u,
        yy = ly + (ry - ly) * u;
      line(
        c,
        [
          [xx, yy],
          [xx + 4, yy - 8],
        ],
        "rgba(31,58,61,.36)",
        0.8,
      );
    }
  }
  c.restore();
  line(
    c,
    [
      [-33, -49],
      [175, -72],
      [252, -100],
    ],
    "#334c50",
    5,
  );
  line(
    c,
    [
      [18, -125],
      [208, -147],
    ],
    "#879290",
    3,
  );
  poly(
    c,
    [
      [163, -147],
      [179, -153],
      [179, -118],
      [163, -114],
    ],
    "#87948c",
  );
  poly(
    c,
    [
      [159, -153],
      [180, -160],
      [184, -153],
      [162, -148],
    ],
    "#657d77",
  );
  c.fillStyle = "#586f64";
  const window = new Path2D("M18-21 70-27 70 22 18 28Z");
  c.fill(window);
  poly(
    c,
    [
      [22, -17],
      [66, -22],
      [66, 18],
      [22, 23],
    ],
    "#ccd6b9",
  );
  poly(
    c,
    [
      [25, -13],
      [42, -15],
      [42, 18],
      [25, 20],
    ],
    "#dad7ad",
  );
  poly(
    c,
    [
      [48, -16],
      [63, -18],
      [63, 16],
      [48, 17],
    ],
    "#a6c1ba",
  );
  line(
    c,
    [
      [45, -22],
      [45, 22],
    ],
    "#7a8162",
    3,
  );
  line(
    c,
    [
      [20, 3],
      [69, -2],
    ],
    "#7a8162",
    2.5,
  );
  line(
    c,
    [
      [14, 32],
      [75, 25],
    ],
    "#9b9d79",
    5,
  );
  poly(
    c,
    [
      [12, -23],
      [1, -20],
      [1, 33],
      [12, 30],
    ],
    "#5c7c68",
  );
  poly(
    c,
    [
      [76, -29],
      [88, -32],
      [88, 20],
      [76, 24],
    ],
    "#4f705f",
  );
  for (let i = 0; i < 9; i++) {
    line(
      c,
      [
        [2, -14 + i * 5],
        [11, -17 + i * 5],
      ],
      "#8f9f7c",
      0.9,
    );
    line(
      c,
      [
        [77, -23 + i * 5],
        [87, -26 + i * 5],
      ],
      "#819778",
      0.9,
    );
  }
  poly(
    c,
    [
      [104, -15],
      [143, -20],
      [143, 78],
      [104, 82],
    ],
    "#596553",
  );
  poly(
    c,
    [
      [109, -10],
      [138, -14],
      [138, 73],
      [109, 77],
    ],
    "#3f5145",
  );
  wood(c, 109, -10, 30, 87, 41);
  line(
    c,
    [
      [113, -7],
      [113, 73],
    ],
    "#8b8862",
    1.6,
  );
  ellipse(c, 132, 35, 1.6, 1.6, "#baad77");
  poly(
    c,
    [
      [187, -37],
      [217, -50],
      [217, -8],
      [187, 4],
    ],
    "#607f77",
  );
  poly(
    c,
    [
      [190, -35],
      [214, -45],
      [214, -10],
      [190, 0],
    ],
    "#a0b9ad",
  );
  line(
    c,
    [
      [202, -39],
      [202, -5],
    ],
    "#7f957d",
    2,
  );
  poly(
    c,
    [
      [-25, 101],
      [178, 80],
      [204, 96],
      [-10, 121],
    ],
    "#958e6d",
  );
  for (let i = 0; i < 6; i++)
    line(
      c,
      [
        [-22 + i * 2, 104 + i * 3],
        [179 + i * 4, 83 + i * 2],
      ],
      i % 2 ? "#b2ab82" : "#6d7559",
      1.1,
    );
  line(
    c,
    [
      [-10, 121],
      [204, 96],
    ],
    "#657252",
    5,
  );
  line(
    c,
    [
      [-5, -45],
      [-5, 100],
    ],
    "#747b59",
    5,
  );
  line(
    c,
    [
      [93, -56],
      [93, 89],
    ],
    "#7d815e",
    5,
  );
  line(
    c,
    [
      [177, -67],
      [177, 80],
    ],
    "#687653",
    6,
  );
  line(
    c,
    [
      [-8, -43],
      [179, -64],
    ],
    "#778060",
    7,
  );
  poly(
    c,
    [
      [12, 121],
      [167, 103],
      [182, 111],
      [24, 132],
    ],
    "#b4b69a",
  );
  poly(
    c,
    [
      [25, 133],
      [182, 113],
      [183, 121],
      [34, 142],
    ],
    "#9fa989",
  );
  shrub(c, 215, 68, 0.75, seed + 35);
  shrub(c, -21, 112, 0.6, seed + 36);
  for (let i = 0; i < 13; i++) {
    const px = 194 + r() * 43,
      py = 49 + r() * 19;
    ellipse(c, px, py, 1.8, 1.5, i % 3 ? "#e5dfbd" : "#c7a6b3");
  }
  c.restore();
}
interface Blade {
  x: number;
  y: number;
  h: number;
  lean: number;
  w: number;
  phase: number;
  colour: string;
  flower: boolean;
}
export class LandscapePainter {
  private sky = layer();
  private terrain = layer();
  private props = layer();
  private clouds = [cloudSprite(23), cloudSprite(73), cloudSprite(91)];
  private river = new Path2D(riverShape);
  private coastLand = new Path2D(coastShape);
  private blades: Blade[] = [];
  private canopy = canopySprite();
  private kind: LandscapeKind;
  constructor(kind: LandscapeKind) {
    this.kind = kind;
    this.paintSky();
    this.paintTerrain();
    this.paintProps();
    this.makeGrass();
  }
  private paintSky() {
    const c = this.sky.ctx,
      g = c.createLinearGradient(0, -300, 0, 650);
    g.addColorStop(0, "#accfe7");
    g.addColorStop(0.65, "#d2e4e9");
    g.addColorStop(1, "#edf0dd");
    c.fillStyle = g;
    c.fillRect(0, TOP, W, H);
    const r = random(222);
    for (let i = 0; i < 4500; i++) {
      c.fillStyle = i % 2 ? "rgba(255,255,244,.025)" : "rgba(92,135,158,.018)";
      c.fillRect(r() * W, TOP + r() * H, 1 + r() * 3, 1);
    }
  }
  private paintTerrain() {
    const c = this.terrain.ctx;
    if (this.kind === "rain") {
      this.paintRainTerrain(c);
      return;
    }
    if (this.kind === "coast") {
      this.paintCoast(c);
      return;
    }
    mountain(
      c,
      [
        [-100, 526],
        [70, 462],
        [221, 491],
        [388, 412],
        [541, 461],
        [742, 424],
        [908, 443],
        [1110, 311],
        [1240, 349],
        [1390, 285],
        [1700, 414],
      ],
      "#b2c8d0",
      73,
      65,
    );
    mountain(
      c,
      [
        [-100, 558],
        [81, 508],
        [243, 520],
        [409, 467],
        [601, 549],
        [749, 486],
        [872, 520],
        [1012, 410],
        [1147, 445],
        [1315, 367],
        [1494, 453],
        [1710, 430],
      ],
      "#8eafbc",
      91,
      105,
    );
    mountain(
      c,
      [
        [-100, 586],
        [84, 511],
        [213, 557],
        [343, 548],
        [511, 628],
        [667, 660],
        [809, 624],
        [925, 596],
        [1066, 515],
        [1195, 492],
        [1326, 426],
        [1450, 479],
        [1680, 450],
      ],
      "#749a9f",
      81,
      130,
    );
    mountain(
      c,
      [
        [-100, 698],
        [102, 608],
        [266, 651],
        [427, 690],
        [613, 720],
        [824, 675],
        [1046, 628],
        [1247, 564],
        [1450, 589],
        [1680, 540],
      ],
      "#567f72",
      17,
      110,
    );
    c.beginPath();
    c.moveTo(-50, 616);
    c.bezierCurveTo(170, 573, 290, 698, 490, 686);
    c.bezierCurveTo(635, 686, 730, 663, 858, 671);
    c.bezierCurveTo(1110, 638, 1270, 572, 1650, 584);
    c.lineTo(1650, 840);
    c.lineTo(-50, 840);
    c.closePath();
    c.fillStyle = "#416e5f";
    c.fill();
    const r = random(431);
    const farTrees = [];
    for (let i = 0; i < 440; i++) {
      const x = r() * 1700 - 50,
        side = Math.abs(x - 815) / 815,
        y = 635 - side * 96 + r() * 110;
      farTrees.push({ x, y, s: 0.16 + side * 0.12 + r() * 0.32, seed: i });
    }
    farTrees.sort((a, b) => a.y - b.y);
    for (const tree of farTrees) {
      const colours =
        tree.seed % 3
          ? ["#355f54", "#48745c", "#739267"]
          : ["#4b756c", "#5c8676", "#8ca286"];
      if (tree.seed % 8 === 0)
        broadleaf(c, tree.x, tree.y, tree.s * 0.9, tree.seed + 12, colours);
      else pine(c, tree.x, tree.y, tree.s, tree.seed + 42, colours);
    }
    const meadow = c.createLinearGradient(0, 660, 0, 1450);
    meadow.addColorStop(0, "#abc57d");
    meadow.addColorStop(0.48, "#8fab65");
    meadow.addColorStop(1, "#4c7851");
    c.beginPath();
    c.moveTo(0, 681);
    c.bezierCurveTo(260, 685, 290, 789, 565, 730);
    c.bezierCurveTo(730, 687, 818, 665, 893, 655);
    c.bezierCurveTo(1050, 677, 1170, 594, 1600, 622);
    c.lineTo(1600, 1500);
    c.lineTo(0, 1500);
    c.closePath();
    c.fillStyle = meadow;
    c.fill();
    c.beginPath();
    c.moveTo(0, 727);
    c.bezierCurveTo(240, 725, 330, 809, 562, 752);
    c.bezierCurveTo(654, 730, 736, 684, 783, 674);
    c.bezierCurveTo(630, 786, 422, 851, 218, 799);
    c.lineTo(0, 772);
    c.fillStyle = "rgba(224,227,167,.34)";
    c.fill();
    c.beginPath();
    c.moveTo(1030, 705);
    c.bezierCurveTo(1245, 635, 1400, 638, 1600, 647);
    c.lineTo(1600, 710);
    c.bezierCurveTo(1350, 678, 1180, 720, 1045, 757);
    c.fillStyle = "rgba(219,225,163,.26)";
    c.fill();
    const water = c.createLinearGradient(0, 600, 0, 1400);
    water.addColorStop(0, "#b2d0ca");
    water.addColorStop(0.4, "#8fbabd");
    water.addColorStop(1, "#6b9da5");
    c.fillStyle = "#6c8e60";
    c.fill(new Path2D(riverOutline(3)));
    c.fillStyle = water;
    c.fill(this.river);
    c.save();
    c.clip(this.river);
    c.beginPath();
    for (let yy = 615; yy < 1500; yy += 6) {
      const at = riverAt(yy);
      yy === 615 ? c.moveTo(at.x, yy) : c.lineTo(at.x, yy);
    }
    c.strokeStyle = "rgba(217,236,214,.18)";
    c.lineWidth = 12;
    c.stroke();
    c.restore();
    c.save();
    c.clip(new Path2D("M0 700H1600V1500H0Z" + riverShape), "evenodd");
    const shade = c.createLinearGradient(1400, 800, 900, 1400);
    shade.addColorStop(0, "rgba(25,68,43,0)");
    shade.addColorStop(1, "rgba(25,68,43,.2)");
    c.fillStyle = shade;
    c.fillRect(0, 820, 1600, 680);
    const light = random(901);
    for (let i = 0; i < 80; i++) {
      const px = light() * 1600,
        py = 850 + light() * 550;
      ellipse(
        c,
        px,
        py,
        10 + light() * 29,
        2 + light() * 7,
        "rgba(225,236,169,.14)",
        -0.28,
      );
    }
    c.restore();
    const randomGrass = random(440);
    for (let i = 0; i < 19000; i++) {
      const x = randomGrass() * W,
        y = 690 + randomGrass() * 800;
      if (c.isPointInPath(this.river, x, y - TOP)) continue;
      if (x > 1100 && y < 880) continue;
      const h = 2 + (y - 650) / 95;
      c.strokeStyle = [
        "rgba(40,86,47,.26)",
        "rgba(211,227,153,.47)",
        "rgba(80,131,55,.32)",
      ][i % 3];
      c.lineWidth = 0.6;
      line(
        c,
        [
          [x, y],
          [x + randomGrass() * 2, y - h * randomGrass() * 3],
        ],
        c.strokeStyle as string,
        0.6,
      );
    }
    if (this.kind === "inn") return;
    const edgeTrees = [];
    for (let i = 0; i < 104; i++) {
      const left = i < 65,
        x = left ? Math.pow(r(), 1.5) * 410 - 65 : 1330 + r() * 340,
        y = left ? 724 + r() * 224 : 654 + r() * 175;
      edgeTrees.push({
        x,
        y,
        s: left ? 0.46 + (y - 700) / 550 + r() * 0.28 : 0.3 + r() * 0.48,
        seed: i,
      });
    }
    edgeTrees.sort((a, b) => a.y - b.y);
    for (const tree of edgeTrees) {
      const colours = ["#285044", "#426c4b", "#819d60"];
      if (tree.seed % 5 === 0)
        broadleaf(c, tree.x, tree.y, tree.s * 0.9, tree.seed + 70, colours);
      else pine(c, tree.x, tree.y, tree.s, tree.seed + 90, colours);
    }
  }
  private paintCoast(c: Ctx) {
    const sea = c.createLinearGradient(0, 480, 0, 1300);
    sea.addColorStop(0, "#83b6c4");
    sea.addColorStop(1, "#427e9b");
    c.fillStyle = sea;
    c.fillRect(0, 440, 1600, 1060);
    mountain(
      c,
      [
        [-100, 565],
        [100, 500],
        [270, 519],
        [420, 488],
        [620, 512],
        [890, 480],
        [1150, 552],
        [1710, 588],
      ],
      "#a6bdba",
      31,
      45,
    );
    c.fillStyle = sea;
    c.fillRect(0, 560, 1600, 940);
    const p = this.coastLand;
    c.fillStyle = "#96ad7a";
    c.fill(p);
    c.strokeStyle = "#e1d7b4";
    c.lineWidth = 45;
    c.stroke(p);
    c.save();
    c.clip(p);
    const r = random(29);
    for (let i = 0; i < 3500; i++) {
      const x = r() * 1700,
        y = 500 + r() * 950;
      line(
        c,
        [
          [x, y],
          [x + 4, y - 4 - r() * 7],
        ],
        i % 2 ? "rgba(216,222,150,.4)" : "rgba(69,115,62,.2)",
        1,
      );
    }
    c.restore();
    c.beginPath();
    c.moveTo(1190, 670);
    c.bezierCurveTo(999, 800, 1064, 1000, 791, 1410);
    c.lineTo(930, 1480);
    c.bezierCurveTo(1140, 1100, 1070, 854, 1252, 721);
    c.fillStyle = "#d9cb9f";
    c.fill();
  }
  private paintRainTerrain(c: Ctx) {
    c.fillStyle = "#c1c5b5";
    c.fillRect(0, TOP, W, H);
    mountain(
      c,
      [
        [-30, 521],
        [261, 338],
        [435, 432],
        [717, 312],
        [940, 443],
        [1165, 314],
        [1660, 500],
      ],
      "#89a3a2",
      17,
      75,
    );
    const r = random(317);
    for (let i = 0; i < 140; i++)
      pine(c, r() * 1600, 480 + r() * 240, 0.3 + r() * 0.45, i, [
        "#617f73",
        "#6c8977",
        "#789782",
      ]);
    c.fillStyle = "#a2ad96";
    c.fillRect(0, 720, 1600, 800);
    house(c, 313, 646, 1.25, 5);
    house(c, 1130, 612, 1.5, 21);
  }
  private paintProps() {
    const c = this.props.ctx;
    if (this.kind === "rain") {
      this.paintWindow(c);
      return;
    }
    if (this.kind === "coast") {
      house(c, 1150, 640, 1.35, 12);
      return;
    }
    if (this.kind === "inn") {
      house(c, 643, 544, 3.2, 19);
      const r = random(812);
      for (let i = 0; i < 45; i++)
        broadleaf(c, r() * 480, 835 + r() * 130, 0.25 + r() * 0.5, 21 + i, [
          "#486f51",
          "#6d8e59",
          "#8ca66b",
        ]);
      return;
    }
    const origin = random(312);
    for (let i = 0; i < 46; i++) {
      const x = 745 + origin() * 185,
        y = 635 + origin() * 29;
      const at = riverAt(y);
      if (Math.abs(x - at.x) < at.half + 6) continue;
      pine(c, x, y, 0.1 + origin() * 0.12, i + 51, [
        "#365f53",
        "#517a63",
        "#8fa280",
      ]);
    }
    broadleaf(c, 837, 638, 0.25, 301, ["#365f53", "#517a63", "#8fa280"]);
    bridge(c);
    house(c, valleyHouse.x, valleyHouse.y, valleyHouse.scale, 5);
    c.beginPath();
    c.moveTo(1232, 817);
    c.bezierCurveTo(1260, 845, 1309, 850, 1370, 902);
    c.lineTo(1394, 898);
    c.bezierCurveTo(1330, 836, 1280, 828, 1257, 813);
    c.closePath();
    c.fillStyle = "#c5be93";
    c.fill();
    for (const [x, y, scale, seed] of [
      [1109, 817, 0.62, 852],
      [1134, 824, 0.47, 853],
      [1315, 808, 0.65, 854],
      [1351, 802, 0.58, 855],
      [1372, 800, 0.75, 856],
    ])
      shrub(c, x, y, scale, seed);
    const stones = random(111);
    for (let i = 0; i < 15; i++) {
      const f = i / 15;
      ellipse(
        c,
        1250 + f * 127,
        822 + f * 73,
        2 + stones() * 4,
        1 + stones() * 1.5,
        i % 2 ? "#aeb59b" : "#d5d0af",
        -0.2,
      );
    }
    const r = random(73);
    for (let i = 0; i < 27; i++) {
      const x = 702 + r() * 232,
        y = 739 + r() * 47;
      if (c.isPointInPath(this.river, x, y - TOP)) continue;
      ellipse(
        c,
        x,
        y,
        3 + r() * 7,
        1.5 + r() * 4,
        ["#b5b59a", "#8e9e89", "#c5c7a5"][i % 3],
        r(),
      );
    }
  }
  private paintWindow(c: Ctx) {
    c.fillStyle = "#8f7957";
    c.fillRect(0, TOP, 185, H);
    c.fillRect(1450, TOP, 150, H);
    c.fillRect(170, 57, 1300, 40);
    c.fillRect(170, 802, 1300, 47);
    c.fillRect(804, 86, 24, 717);
    line(
      c,
      [
        [177, 97],
        [177, 803],
      ],
      "#b3a47d",
      10,
    );
    line(
      c,
      [
        [1456, 97],
        [1456, 803],
      ],
      "#b3a47d",
      10,
    );
    c.fillStyle = "#a58a60";
    c.fillRect(0, 849, 1600, 651);
    wood(c, 0, 850, 1600, 650, 211);
    ellipse(c, 358, 1044, 123, 20, "rgba(63,56,40,.17)");
    ellipse(c, 339, 1011, 104, 15, "#d9d2b1");
    poly(
      c,
      [
        [292, 879],
        [389, 879],
        [377, 995],
        [309, 995],
      ],
      "#d6d7c0",
    );
    poly(
      c,
      [
        [300, 926],
        [382, 926],
        [373, 986],
        [311, 986],
      ],
      "#bb9259",
    );
    c.beginPath();
    c.moveTo(392, 903);
    c.bezierCurveTo(451, 894, 447, 957, 386, 959);
    c.strokeStyle = "#d6d7c0";
    c.lineWidth = 11;
    c.stroke();
    poly(
      c,
      [
        [633, 1010],
        [865, 963],
        [960, 1040],
        [714, 1097],
      ],
      "#597b69",
    );
    line(
      c,
      [
        [645, 1012],
        [862, 970],
        [941, 1038],
      ],
      "#b0b697",
      4,
    );
  }
  private makeGrass() {
    if (this.kind === "rain") return;
    const r = random(this.kind === "coast" ? 915 : 881),
      c = this.terrain.ctx;
    const add = (x: number, y: number, h: number, i: number) => {
      if (this.kind === "valley" && c.isPointInPath(this.river, x, y - TOP))
        return;
      if (this.kind === "valley" && x > 1110 && x < 1410 && y < 835) return;
      if (this.kind === "coast" && !c.isPointInPath(this.coastLand, x, y - TOP))
        return;
      if (this.kind === "inn" && x > 530 && x < 1400 && y < 960) return;
      const depth = Math.max(0, Math.min(1, (y - 700) / 530));
      this.blades.push({
        x,
        y,
        h,
        lean: (r() - 0.5) * 13,
        w: 0.6 + depth * (0.7 + r() * 1.2),
        phase: r() * Math.PI * 2,
        colour: ["#3f7043", "#62894c", "#7fa357", "#a5bc70", "#c1cf8d"][i % 5],
        flower: i % 37 === 0,
      });
    };
    for (let i = 0; i < 750; i++) {
      const x = r() * 1600,
        y = 710 + r() * 360;
      add(x, y, 8 + r() * 18, i);
    }
    for (let tuft = 0; tuft < 185; tuft++) {
      const x = r() * 1600,
        y = 822 + r() * 580;
      const h = 20 + (y - 790) / 13 + r() * 20;
      for (let j = 0; j < 22; j++)
        add(
          x + (r() - 0.5) * 49,
          y + (r() - 0.5) * 17,
          h * (0.5 + r() * 0.8),
          tuft * 22 + j,
        );
    }
    this.blades.sort((a, b) => a.y - b.y);
  }
  draw(
    c: Ctx,
    width: number,
    height: number,
    t: number,
    wind: number,
    portrait: boolean,
  ) {
    c.clearRect(0, 0, width, height);
    c.save();
    const worldW = portrait ? 760 : 1600,
      scale = width / worldW;
    const top = portrait ? -360 : Math.min(0, 1000 - height / scale),
      left = portrait ? 535 : 0;
    c.scale(scale, scale);
    c.translate(-left, -top);
    c.drawImage(this.sky.canvas, 0, TOP);
    this.drawClouds(c, t);
    c.drawImage(this.terrain.canvas, 0, TOP);
    if (this.kind === "valley") this.drawWater(c, t);
    if (this.kind === "coast") this.drawSea(c, t);
    c.drawImage(this.props.canvas, 0, TOP);
    if (this.kind === "rain") this.drawRain(c, t, wind);
    else {
      this.drawHouseMotion(c, t, wind);
      this.drawGrass(c, t, wind);
      this.drawCanopy(c, t, wind);
    }
    c.restore();
  }
  private drawClouds(c: Ctx, t: number) {
    const specs = [
      [980, 130, 0.9, 0],
      [80, 220, 0.62, 2],
      [1320, 278, 0.55, 4],
    ];
    specs.forEach(([x, y, s, p], i) => {
      const drift = Math.sin(t * 0.017 + p) * 100;
      c.globalAlpha = 0.82;
      c.drawImage(this.clouds[i], x - 200 + drift, y - 70, 470 * s, 180 * s);
      c.globalAlpha = 1;
    });
  }
  private drawWater(c: Ctx, t: number) {
    c.save();
    c.clip(this.river);
    for (let i = 0; i < 91; i++) {
      const f = (i / 91 + t * 0.022) % 1,
        y = 614 + f * f * 886,
        at = riverAt(y),
        r = random(i + 180),
        xx = at.x + (r() - 0.5) * at.half * 1.15,
        span = (0.2 + r() * 0.4) * at.half + 2;
      c.beginPath();
      c.moveTo(xx - span * 0.5, y);
      c.bezierCurveTo(
        xx - span * 0.15,
        y - 1 - f * 2,
        xx + span * 0.2,
        y + 1,
        xx + span * 0.5,
        y - 0.4,
      );
      c.strokeStyle =
        i % 4 === 0 ? "rgba(239,246,223,.61)" : "rgba(207,233,219,.4)";
      c.lineWidth = 0.5 + f * 1.8;
      c.stroke();
    }
    c.restore();
  }
  private drawSea(c: Ctx, t: number) {
    c.save();
    const seaArea = new Path2D("M0 560H1600V1500H0Z" + coastShape);
    c.clip(seaArea, "evenodd");
    for (let i = 0; i < 31; i++) {
      const y = 560 + ((i * 23 + t * 7) % 430);
      line(
        c,
        [
          [0, y],
          [180 + Math.sin(t * 0.2 + i) * 60, y - 2],
          [420, y + 1],
          [640, y],
        ],
        `rgba(227,242,228,${0.08 + (i % 4) * 0.025})`,
        1.5,
      );
    }
    c.restore();
  }
  private drawGrass(c: Ctx, t: number, wind: number) {
    for (const b of this.blades) {
      const wave = Math.sin(t * 1.6 - b.x * 0.006 + b.y * 0.002);
      const secondary = Math.sin(t * 2.7 + b.phase) * 0.25;
      const gust = 0.45 + 0.55 * Math.sin(t * 0.7 - b.x * 0.002);
      const bend =
        b.h * (0.12 + wind * 0.28) * (wave * 0.55 + gust * 0.7 + secondary);
      const tipX = b.x + b.lean + bend,
        tipY = b.y - b.h + Math.abs(bend) * 0.13;
      c.beginPath();
      c.moveTo(b.x, b.y);
      c.bezierCurveTo(
        b.x + b.lean * 0.1,
        b.y - b.h * 0.42,
        tipX - bend * 0.15,
        tipY + b.h * 0.24,
        tipX,
        tipY,
      );
      c.bezierCurveTo(
        tipX - b.w,
        tipY + b.h * 0.25,
        b.x + b.w,
        b.y - b.h * 0.35,
        b.x + b.w,
        b.y,
      );
      c.closePath();
      c.fillStyle = b.colour;
      c.fill();
      if (b.flower) {
        const r = 1.6 + b.h * 0.022;
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5;
          ellipse(
            c,
            tipX + Math.cos(a) * r * 1.3,
            tipY + Math.sin(a) * r,
            r * 0.9,
            r * 0.55,
            "#e9e6c6",
            a,
          );
        }
        ellipse(c, tipX, tipY, r * 0.55, r * 0.55, "#c2ad53");
      }
    }
  }
  private drawHouseMotion(c: Ctx, t: number, wind: number) {
    const spec =
      this.kind === "inn"
        ? { x: 643, y: 544, scale: 3.2 }
        : this.kind === "coast"
          ? { x: 1150, y: 640, scale: 1.35 }
          : valleyHouse;
    c.save();
    c.translate(spec.x, spec.y);
    c.scale(spec.scale * 1.1, spec.scale * 0.82);
    const b = Math.sin(t * 1.6) * 3.3 * wind + 1;
    c.save();
    c.clip(new Path2D("M24-17 42-19 42 20 24 23Z"));
    c.beginPath();
    c.moveTo(24, -17);
    c.lineTo(36, -18);
    c.bezierCurveTo(32 + b, -4, 35 + b, 7, 39 + b, 21);
    c.lineTo(24, 23);
    c.closePath();
    c.fillStyle = "#e8e4c7";
    c.fill();
    c.restore();
    for (let i = 0; i < 6; i++) {
      const p = (t * 0.1 + i / 6) % 1;
      const sx = 171 + Math.sin(t * 0.5 + p * 4) * 9 * p,
        sy = -158 - p * 75;
      ellipse(
        c,
        sx,
        sy,
        3 + p * 9,
        2 + p * 4,
        `rgba(224,234,219,${0.12 * (1 - p)})`,
        p * 0.7,
      );
    }
    c.restore();
  }
  private drawCanopy(c: Ctx, t: number, wind: number) {
    if (this.kind === "inn") return;
    const trunk = new Path2D(
      "M1640 1300C1553 1110 1554 784 1568 475C1577 250 1547 94 1486-30L1536-30C1613 119 1632 307 1615 511C1597 818 1656 1080 1720 1300Z",
    );
    const bark = c.createLinearGradient(1550, 0, 1640, 0);
    bark.addColorStop(0, "#315444");
    bark.addColorStop(0.5, "#244c41");
    bark.addColorStop(1, "#3e6049");
    c.fillStyle = bark;
    c.fill(trunk);
    c.save();
    c.clip(trunk);
    for (let i = 0; i < 12; i++) {
      c.beginPath();
      c.moveTo(1490 + i * 9, -10);
      c.bezierCurveTo(1570 + i * 5, 310, 1550 + i * 5, 760, 1640 + i * 7, 1240);
      c.strokeStyle = i % 3 ? "rgba(139,157,100,.11)" : "rgba(14,47,39,.3)";
      c.lineWidth = 1 + (i % 3);
      c.stroke();
    }
    c.restore();
    c.save();
    c.translate(1600, -35);
    c.rotate(Math.sin(t * 0.7) * 0.007 * wind);
    c.drawImage(this.canopy, -540, 0, 540, 270);
    c.restore();
  }
  private drawRain(c: Ctx, t: number, wind: number) {
    c.save();
    c.beginPath();
    c.rect(190, 98, 1250, 698);
    c.clip();
    for (let i = 0; i < 105; i++) {
      const x = 220 + ((i * 117) % 1220),
        yy = 95 + ((i * 71 + t * (190 + wind * 25)) % 770);
      line(
        c,
        [
          [x, yy],
          [x - 5 - wind * 3, yy + 17 + (i % 4) * 5],
        ],
        "rgba(232,243,231,.35)",
        i % 4 === 0 ? 1.5 : 0.8,
      );
    }
    c.restore();
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.15 + i * 0.33) % 1;
      c.beginPath();
      c.moveTo(329 + i * 15, 873 - p * 50);
      c.bezierCurveTo(
        315 + i * 15,
        855 - p * 50,
        348 + i * 15,
        846 - p * 50,
        333 + i * 15,
        827 - p * 50,
      );
      c.strokeStyle = `rgba(241,235,210,${0.25 * (1 - p)})`;
      c.lineWidth = 2;
      c.stroke();
    }
  }
}
