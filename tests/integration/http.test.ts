import { beforeAll, afterAll, it, expect } from "vitest";
const base = "http://127.0.0.1:3000";
let cookie = "",
  callId = "";
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  authenticated = true,
  origin = base,
) {
  return fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(authenticated ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeAll(async () => {
  const response = await request("/api/session", "POST", undefined, false);
  expect(response.status).toBe(200);
  cookie = response.headers.get("set-cookie")!.split(";")[0];
  const result = await request("/api/calls", "POST", { sample: "inspection" });
  expect(result.status).toBe(200);
  callId = (await result.json()).call.id;
});
afterAll(async () => {
  if (callId) await request(`/api/calls/${callId}`, "DELETE");
});
it("private data is denied without a valid session", async () => {
  expect((await request("/api/calls", "GET", undefined, false)).status).toBe(
    401,
  );
  expect(
    (await request(`/api/calls/${callId}`, "GET", undefined, false)).status,
  ).toBe(401);
});
it("foreign origin mutations are rejected", async () => {
  expect(
    (
      await request(
        "/api/calls",
        "POST",
        { sample: "service" },
        true,
        "https://foreign.example",
      )
    ).status,
  ).toBe(403);
});
it("an inspection is never exposed as a confirmed treatment or payment", async () => {
  const call = (await (await request(`/api/calls/${callId}`)).json()).call;
  expect(call.analysis.outcomes.inspectionBooked.value).toBe(true);
  expect(call.analysis.outcomes.treatmentAccepted.value).toBe(null);
  expect(call.analysis.outcomes.paymentCollected.value).toBe(null);
  expect(call.recordedAt).toBe(null);
});
it("reasoned review preserves original data and rejects stale versions", async () => {
  const input = {
    version: 1,
    checkpointId: "pricing",
    status: "missed",
    reason:
      "Fictional inspection-only sample does not include treatment pricing.",
  };
  const updated = await request(`/api/calls/${callId}/review`, "POST", input);
  expect(updated.status).toBe(200);
  const call = (await updated.json()).call;
  expect(
    call.analysis.assessments.find((x: { id: string }) => x.id === "pricing")
      .status,
  ).toBe("missed");
  expect(
    call.originalAnalysis.assessments.find(
      (x: { id: string }) => x.id === "pricing",
    ).status,
  ).toBe("unknown");
  expect(call.version).toBe(2);
  expect(call.score.grade).toBe(null);
  expect(
    (await request(`/api/calls/${callId}/review`, "POST", input)).status,
  ).toBe(409);
});
it("missing AI key returns a specific error without a fake result", async () => {
  const response = await request(`/api/calls/${callId}/retry`, "POST", {});
  expect(response.status).toBe(503);
  expect((await response.json()).error).toBe("AI_NOT_CONFIGURED");
});
it("customer audio is never supplied for fictional text fixtures", async () => {
  expect((await request(`/api/calls/${callId}/media`)).status).toBe(404);
});
it("private API responses are not cacheable", async () => {
  expect((await request("/api/calls")).headers.get("cache-control")).toContain(
    "no-store",
  );
});
it("review requires a meaningful reason", async () => {
  expect(
    (
      await request(`/api/calls/${callId}/review`, "POST", {
        version: 2,
        checkpointId: "pricing",
        status: "passed",
        reason: "x",
      })
    ).status,
  ).toBe(400);
});
it("deleted content is inaccessible on the old API and media paths", async () => {
  expect((await request(`/api/calls/${callId}`, "DELETE")).status).toBe(200);
  expect((await request(`/api/calls/${callId}`)).status).toBe(404);
  expect((await request(`/api/calls/${callId}/media`)).status).toBe(404);
  callId = "";
});
