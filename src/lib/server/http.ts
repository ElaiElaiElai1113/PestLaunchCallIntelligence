import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./auth";
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export async function respond(work: () => Promise<unknown>) {
  try {
    return json(await work());
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.code }, error.status);
    if (error instanceof ZodError)
      return json({ error: "INVALID_REQUEST" }, 400);
    return json({ error: "REQUEST_FAILED" }, 500);
  }
}
