import { expect, it } from "vitest";
import { resolve, join } from "node:path";
import { resolveSampleRoot } from "@/lib/server/sample-paths";
it("ordinary dev retains its default while isolated roots stay in ignored namespaces", () => {
  const repo = process.cwd();
  expect(resolveSampleRoot(repo, undefined)).toBe(
    join(repo, ".private", "app"),
  );
  for (const folder of ["qa", "demo"])
    expect(resolveSampleRoot(repo, `.private/${folder}/fictional-run`)).toBe(
      resolve(repo, `.private/${folder}/fictional-run`),
    );
});
it.each([
  "../outside",
  ".private/qa/../app",
  ".private/app",
  ".private/qa",
  "C:/outside",
  "/outside",
])("rejects an unsafe isolated override %s", (path) =>
  expect(() => resolveSampleRoot(process.cwd(), path)).toThrow(
    "INVALID_SAMPLE_ROOT",
  ),
);
