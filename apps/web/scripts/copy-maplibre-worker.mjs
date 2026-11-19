// MapLibre runs tile work in a separate worker file. Next's bundler does not
// locate it, so serve the worker that ships with the installed version from
// /maplibre/. Copying it at dev and build time keeps it matched to the package.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const to = resolve(root, "public/maplibre/maplibre-gl-worker.mjs");
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("maplibre worker copied to public/maplibre/");
