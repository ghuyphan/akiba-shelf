import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { externalizeSimulatorBootstrap } from "./externalize-simulator-bootstrap.mjs";

test("moves the generated SvelteKit bootstrap to a same-origin script", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "matsuri-simulator-"));
  try {
    await mkdir(join(outputDir, "internal"));
    await writeFile(
      join(outputDir, "index.html"),
      `<div><script>
        __sveltekit_test = { base: "/gacha-simulator" };
        const element = document.currentScript.parentElement;
        Promise.resolve().then((kit) => kit.start({}, element));
      </script></div>`,
    );

    const result = externalizeSimulatorBootstrap(outputDir, "/gacha-simulator");
    const html = await readFile(join(outputDir, "index.html"), "utf8");
    const bootstrap = await readFile(result.bootstrapPath, "utf8");

    assert.match(
      html,
      /<script src="\/gacha-simulator\/internal\/matsuri-bootstrap\.js"><\/script>/,
    );
    assert.doesNotMatch(html, /__sveltekit_test/);
    assert.match(bootstrap, /__sveltekit_test/);
    assert.match(bootstrap, /document\.currentScript\.parentElement/);

    assert.deepEqual(
      externalizeSimulatorBootstrap(outputDir, "/gacha-simulator"),
      result,
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
