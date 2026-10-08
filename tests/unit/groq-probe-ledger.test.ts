import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  reserveProbe,
  writeArtifact,
  tokenResetMs,
  assertProbeDestination,
} from "../../scripts/groq-probe-ledger";
it("refuses redirects or another endpoint before transmitting credentials", () => {
  expect(() =>
    assertProbeDestination("https://api.groq.com/openai/v1/chat/completions"),
  ).not.toThrow();
  for (const url of [
    "http://api.groq.com/openai/v1/chat/completions",
    "https://elsewhere.example/openai/v1/chat/completions",
    "https://api.groq.com/openai/v1/audio/transcriptions",
    "https://api.groq.com/openai/v1/chat/completions?secret=x",
  ])
    expect(() => assertProbeDestination(url)).toThrow(
      "PROBE_DESTINATION_REFUSED",
    );
});
it("reserves before effects, counts failures and refuses a seventh request", async () => {
  const root = `.private/qa/probe-ledger-test-${randomUUID()}`;
  for (let i = 0; i < 6; i++) {
    const run = await reserveProbe(root, "fictional");
    expect(
      JSON.parse(await readFile(`${root}/ledger.json`, "utf8")).requests,
    ).toHaveLength(i + 1);
    await run.finish();
  }
  await expect(reserveProbe(root, "fictional")).rejects.toThrow(
    "PROBE_REQUEST_CAP",
  );
});
it("immutable artifacts and one active owner prevent overwrites and parallel fetch", async () => {
  const root = `.private/qa/probe-ledger-test-${randomUUID()}`,
    run = await reserveProbe(root, "fictional");
  await expect(reserveProbe(root, "other")).rejects.toThrow();
  await writeArtifact(run.folder, "response.json", { fictional: true });
  await expect(
    writeArtifact(run.folder, "response.json", { replacement: true }),
  ).rejects.toThrow();
  await run.finish({ stopped: "quota" });
  await expect(reserveProbe(root, "another")).rejects.toThrow("PROBE_STOPPED");
});
it("quota reset handles duration headers without treating missing values as zero", () => {
  expect(tokenResetMs("1m7.5s")).toBe(67500);
  expect(tokenResetMs(null)).toBeNull();
  expect(tokenResetMs("unknown")).toBeNull();
});
