import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrat d'architecture : app → pages → features → shared, jamais de feature → feature.
 * Lit tous les imports du code source (alias « @/ » et chemins relatifs) et échoue à la première dépendance interdite.
 */
const SRC = path.resolve(import.meta.dirname, "..");
const FEATURES = ["users", "academic", "resources", "housing", "student-life", "library"];
const posix = (p: string) => p.split(path.sep).join("/");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) && !p.includes(`${path.sep}test${path.sep}`)) out.push(p);
  }
  return out;
}

const root = (rel: string) => {
  const [a, b] = rel.split("/");
  return a === "features" ? `features/${b}` : a;
};

function importsOf(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  return [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)].map((m) => m[1]!);
}

function violations(): string[] {
  const out: string[] = [];
  for (const file of walk(SRC)) {
    const rel = posix(path.relative(SRC, file));
    for (const spec of importsOf(file)) {
      let target: string;
      if (spec.startsWith("@/")) target = spec.slice(2);
      else if (spec.startsWith(".")) target = posix(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
      else continue;
      const from = rel.split("/")[0]!;
      const to = target.split("/")[0]!;
      const bad = (why: string) => out.push(`${rel} → ${spec} : ${why}`);
      if (from === "shared" && ["app", "pages", "features"].includes(to)) bad("shared ne dépend d'aucune autre couche");
      if (from === "features" && ["app", "pages"].includes(to)) bad("une feature ne dépend ni de app ni de pages");
      if (from === "features" && to === "features" && root(rel) !== root(target)) bad("une feature ne dépend jamais d'une autre feature");
      if (from === "pages" && to === "app") bad("pages ne dépend pas de app");
    }
  }
  return out;
}

describe("architecture en couches", () => {
  it("respecte le sens unique des dépendances (app → pages → features → shared)", () => {
    expect(violations()).toEqual([]);
  });

  it("contient exactement les six modules métier attendus", () => {
    const dirs = fs
      .readdirSync(path.join(SRC, "features"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(dirs).toEqual([...FEATURES].sort());
  });
});
