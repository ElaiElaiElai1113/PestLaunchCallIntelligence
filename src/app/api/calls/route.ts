import { randomUUID } from "node:crypto";
import { Repository } from "@/lib/server/repository";
import {
  checkOrigin,
  requireIdentity,
  requireOwner,
  AppError,
} from "@/lib/server/auth";
import { respond } from "@/lib/server/http";
import { sampleCall, SAMPLE_OPTIONS } from "@/lib/samples/fixtures";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => {
    const repo = new Repository(await requireIdentity());
    return { calls: await repo.list() };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const identity = await requireIdentity();
    requireOwner(identity);
    if (identity.mode !== "sample") throw new AppError("USE_RECORDING_UPLOAD");
    const { sample } = z
      .object({
        sample: z.enum(
          SAMPLE_OPTIONS.map((x) => x.id) as [string, ...string[]],
        ),
      })
      .parse(await request.json());
    const call = sampleCall(sample, randomUUID());
    if (!(await new Repository(identity).put(call, null)))
      throw new AppError("CONFLICT", 409);
    return { call };
  });
}
