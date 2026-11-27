import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

// The CLI imports scripts/*.js bundles; they are COMMITTED so git-dependency
// consumers (whose npm install runs no esbuild-bearing prepare) work. This
// gate regenerates them and fails when a scripts/*.ts changed without
// re-running scripts/build-scripts.mjs (regeneration updates the working
// tree, ready to commit).
describe("committed CLI bundles are fresh", () => {
  it("scripts/*.js match a fresh esbuild bundle", () => {
    execFileSync(process.execPath, ["scripts/build-scripts.mjs"], { stdio: "ignore" });
    let diff = "";
    try {
      execFileSync("git", ["diff", "--exit-code", "--stat", "--", "scripts/"], { encoding: "utf8" });
    } catch (e) {
      diff = String((e as { stdout?: unknown }).stdout ?? "");
    }
    const sources = readdirSync("scripts").filter((f) => f.endsWith(".ts"));
    expect(diff, `scripts/*.js are stale — run scripts/build-scripts.mjs and commit:\n${diff}`).toBe("");
    expect(sources.length).toBeGreaterThan(10);
  });
});
