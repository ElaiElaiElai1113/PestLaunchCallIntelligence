import { it, expect } from "vitest";
import { originAllowed } from "@/lib/server/origin";
const request = (origin: string, host = "127.0.0.1:3000") =>
  new Request("http://localhost:3000/api/session", {
    headers: { Origin: origin, Host: host },
  });
it("accepts the actual loopback host even when Next uses an internal localhost URL", () => {
  expect(originAllowed(request("http://127.0.0.1:3000"), undefined, true)).toBe(
    true,
  );
});
it("rejects a foreign browser origin", () => {
  expect(
    originAllowed(request("https://foreign.example"), undefined, true),
  ).toBe(false);
});
it("requires an explicitly approved production origin", () => {
  expect(
    originAllowed(
      request("http://localhost:3000", "localhost:3000"),
      undefined,
      false,
    ),
  ).toBe(false);
});
it("accepts only the configured production origin", () => {
  expect(
    originAllowed(request("https://app.example"), "https://app.example", false),
  ).toBe(true);
  expect(
    originAllowed(
      request("https://foreign.example"),
      "https://app.example",
      false,
    ),
  ).toBe(false);
});
