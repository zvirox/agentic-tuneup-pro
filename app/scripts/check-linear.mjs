#!/usr/bin/env node
/**
 * Linear-Style Design System Gate (Locked Final Standard).
 * Fails on blur, translucency, glow, dark-mode shadows, legacy glass classes,
 * and raw hex colors outside token/chart theme definitions.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const UI_SRC = join(APP_ROOT, "src");

function findFiles(dir, exts, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      findFiles(full, exts, acc);
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

const files = findFiles(UI_SRC, [".tsx", ".ts", ".css"]);
const violations = [];

const TOKEN_FILES = new Set([
  "src/tailwind.css",
  "src/components/linear/echarts-linear-theme.ts",
]);

const CHECKS = [
  {
    name: "backdrop-filter blur",
    regex: /(?:-webkit-)?backdrop-filter\s*:\s*[^;]*blur\(|backdrop-blur-/g,
    skipTokenFiles: false,
  },
  {
    name: "translucent surface fill (rgba/hsla/white-black alpha)",
    regex: /\b(?:rgba|hsla)\(|\b(?:bg|border|text)-(?:white|black)\/[0-9]/g,
    skipTokenFiles: false,
  },
  {
    name: "legacy glass class",
    regex: /\b(?:glass-panel(?:-strong)?|surface-glass(?:-strong)?|border-glass)\b/g,
    skipTokenFiles: false,
  },
  {
    name: "glow or Tailwind shadow utility",
    regex: /\b(?:drop-shadow|shadow-(?:sm|md|lg|xl|2xl|inner))\b/g,
    skipTokenFiles: false,
  },
  {
    name: "raw hex color outside token files",
    regex: /#[0-9a-fA-F]{3,8}\b/g,
    skipTokenFiles: true,
  },
];

for (const file of files) {
  const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
  const isTokenFile = TOKEN_FILES.has(rel);
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, idx) => {
    for (const check of CHECKS) {
      if (check.skipTokenFiles && isTokenFile) continue;
      check.regex.lastIndex = 0;
      const match = check.regex.exec(line);
      if (match) {
        violations.push(`${rel}:${idx + 1} [${check.name}] -> ${match[0]}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error("❌ check:linear gate FAILED:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
} else {
  console.log("✅ check:linear gate PASSED: Zero blur, zero translucency, zero dark shadows, zero off-token hexes.");
  process.exit(0);
}
