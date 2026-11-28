import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// npm pack ships each file with its on-disk mode, and npm's bin-linking only
// chmods the .bin link target when it CREATES the link. A re-install that
// reuses an existing (still-valid) symlink therefore leaves a 0644 target:
// invoking the bin fails with EACCES, and the shell silently falls through to
// the next same-named binary on PATH (e.g. a stale global install), which then
// runs a completely different concept-browser version with no error anywhere.
// Guard: the committed CLI entrypoint must carry the executable bit so every
// install path — fresh or re-install — lands an executable bin.
describe("CLI bin is executable", () => {
  it("cli/index.mjs carries the executable bit", () => {
    const cliPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "cli",
      "index.mjs",
    );
    const mode = statSync(cliPath).mode;
    expect(
      mode & 0o111,
      `cli/index.mjs mode is ${(mode & 0o777).toString(8)} — npm pack ships ` +
        `this mode verbatim and a reused .bin symlink is not re-chmodded, so ` +
        `the published bin can be un-invokable (EACCES falls through to a ` +
        `same-named binary on PATH). Run: chmod +x cli/index.mjs`,
    ).toBe(0o111);
  });
});
