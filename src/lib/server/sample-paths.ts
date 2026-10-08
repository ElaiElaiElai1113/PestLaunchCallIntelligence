import { resolve, join, relative, isAbsolute, sep } from "node:path";
import { existsSync, lstatSync } from "node:fs";
export function resolveSampleRoot(
  repoRoot = process.cwd(),
  override = process.env.PESTLAUNCH_SAMPLE_ROOT,
): string {
  const repo = resolve(/* turbopackIgnore: true */ repoRoot);
  if (!override) return join(repo, ".private", "app");
  if (override.split(/[\\/]/).includes(".."))
    throw new Error("INVALID_SAMPLE_ROOT");
  const target = resolve(repo, override);
  const allowed = [
    join(repo, ".private", "qa"),
    join(repo, ".private", "demo"),
  ].some((root) => {
    const rel = relative(root, target);
    return (
      !!rel && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)
    );
  });
  if (!allowed) throw new Error("INVALID_SAMPLE_ROOT");
  let cursor = repo;
  for (const part of relative(repo, target).split(sep)) {
    cursor = join(/* turbopackIgnore: true */ cursor, part);
    if (
      existsSync(/* turbopackIgnore: true */ cursor) &&
      lstatSync(/* turbopackIgnore: true */ cursor).isSymbolicLink()
    )
      throw new Error("INVALID_SAMPLE_ROOT");
  }
  return target;
}
