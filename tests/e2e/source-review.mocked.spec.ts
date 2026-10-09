import { test, expect } from "@playwright/test";
import { sampleCall } from "../../src/lib/samples/fixtures";
import { guardAssessment } from "../../src/lib/domain/assessment-guards";
import { computeScore } from "../../src/lib/scoring/engine";
import { applySourceReview } from "../../src/lib/domain/source-review";
import { sourceReviewSchema } from "../../src/lib/domain/schemas";
import { mockApi, checkWidths, fictionalSession } from "./mock-api";
function fixture() {
  const call = sampleCall("service", "20000000-0000-4000-8000-000000000011");
  call.mode = "live";
  call.sourceKind = "synthetic";
  call.checksum = "a".repeat(64);
  call.sanitizedPath = `${call.workspaceId}/${call.id}.wav`;
  call.sourcePreparation = {
    checksum: call.checksum,
    attestedBy: "fictional-owner",
    at: "2026-10-09T00:00:00Z",
    kind: "synthetic",
  };
  call.sourceRevision = 0;
  call.analysisSourceRevision = 0;
  call.segments.forEach((s) => (s.speaker = "unknown"));
  call.analysis = guardAssessment(call.originalAnalysis!, call.segments, {
    transcriptComplete: false,
  });
  call.score = computeScore(call.analysis);
  call.status = "needs_review";
  call.transcriptCompleteness = "unverified";
  call.transcriptReviewReasons = ["Transcription completeness needs review."];
  return call;
}
async function fill(page: import("@playwright/test").Page) {
  const roles = sampleCall("service", "roles").segments;
  for (const s of roles)
    await page
      .getByLabel(`Speaker ${s.id}`, { exact: true })
      .selectOption(s.speaker);
  await page
    .getByRole("checkbox", { name: /checked the whole prepared recording/ })
    .check();
  await page
    .getByRole("checkbox", { name: /checked transcript accuracy/ })
    .check();
}
test("speaker suggestions change draft labels without verifying or saving source facts", async ({
  page,
}) => {
  const call = fixture(),
    before = structuredClone(call);
  call.speakerProposals = {
    sourceChecksum: call.checksum!,
    sourceRevision: 0,
    model: "gemini-3.5-flash-lite",
    roles: call.segments.map((s) => ({
      segmentId: s.id,
      speaker: "employee",
      confidence: 0.99,
    })),
  };
  let posts = 0;
  const unexpected = await mockApi(page, (path, method) => {
    if (method !== "GET") {
      posts++;
      return { status: 400, json: { error: "Unexpected save" } };
    }
    if (path === "/api/session")
      return { json: fictionalSession("owner", true) };
    if (path === "/api/calls") return { json: { calls: [call] } };
    if (path === `/api/calls/${call.id}`) return { json: { call } };
    if (path === `/api/calls/${call.id}/media`)
      return { status: 404, json: { error: "MEDIA_UNAVAILABLE" } };
    return null;
  });
  await page.goto(`/calls/${call.id}`);
  await page
    .getByRole("button", { name: "Review transcript", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use suggested labels in draft", exact: true })
    .click();
  await expect(
    page.getByLabel(`Speaker ${call.segments[0].id}`, { exact: true }),
  ).toHaveValue("employee");
  await expect(
    page.getByRole("checkbox", {
      name: /checked the whole prepared recording/,
    }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /checked transcript accuracy/ }),
  ).not.toBeChecked();
  expect(posts).toBe(0);
  expect(call.segments).toEqual(before.segments);
  expect(call.score).toEqual(before.score);
  expect(unexpected).toEqual([]);
});
test("mocked owner source review handles conflict, stale grade, re-analysis failure/history and success", async ({
  page,
}) => {
  let call = fixture(),
    reviews = 0,
    analyses = 0;
  const initial = structuredClone(call.originalAnalysis);
  const unexpected = await mockApi(page, (path, method, input) => {
    if (path === "/api/session" && method === "GET")
      return { json: fictionalSession("owner", true) };
    if (path === "/api/calls" && method === "GET")
      return { json: { calls: [call] } };
    if (path === `/api/calls/${call.id}` && method === "GET")
      return { json: { call } };
    if (path === `/api/calls/${call.id}/media`)
      return { status: 404, json: { error: "MEDIA_UNAVAILABLE" } };
    if (path === `/api/calls/${call.id}/source-review` && method === "POST") {
      reviews++;
      if (reviews === 1) {
        call.version++;
        return { status: 409, json: { error: "STALE_SOURCE_REVIEW" } };
      }
      call = applySourceReview(call, sourceReviewSchema.parse(input), {
        id: "fictional-review",
        userId: "fictional-reviewer",
        at: "2026-10-08T00:00:00Z",
      });
      return { json: { call } };
    }
    if (path === `/api/calls/${call.id}/reanalyze` && method === "POST") {
      analyses++;
      if (analyses === 1) {
        call.status = "failed";
        call.errorCode = "ANALYSIS_FAILED";
      } else {
        call.analysis = guardAssessment(
          sampleCall("service", "raw").originalAnalysis!,
          call.segments,
          { transcriptComplete: true },
        );
        call.score = computeScore(call.analysis);
        call.analysisSourceRevision = call.sourceRevision;
        call.status = "ready";
        call.errorCode = null;
      }
      return { json: { callId: call.id } };
    }
    return null;
  });
  await page.goto(`/calls/${call.id}?tab=transcript`);
  await expect(
    page.getByText("Speaker review needed", { exact: true }),
  ).toBeVisible();
  const trigger = page.getByRole("button", {
    name: "Review transcript",
    exact: true,
  });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await fill(page);
  await page
    .getByLabel("Reason for transcript review")
    .fill(
      "Fictional UI contract review; no real recording or provider request.",
    );
  await page
    .getByRole("button", { name: "Save transcript review", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Refresh transcript review",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save transcript review", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Refresh transcript review", exact: true })
    .click();
  await expect(page.getByLabel("Reason for transcript review")).toHaveValue(
    /Fictional UI contract/,
  );
  await fill(page);
  await checkWidths(page);
  await page
    .getByRole("button", { name: "Save transcript review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Previous analysis — source revision 0",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Transcript review history",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Green · 11\/12/)).toHaveCount(0);
  await page.getByRole("button", { name: "Re-analyze", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Re-analyze", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Re-analyze", exact: true }).click();
  await expect(
    page.getByText("Partial · 10/12", { exact: true }),
  ).toBeVisible();
  expect(call.score?.grade).toBeNull();
  expect(call.originalAnalysis).toEqual(initial);
  expect(unexpected).toEqual([]);
});
test("mocked reviewer can verify source but cannot launch owner re-analysis", async ({
  page,
}) => {
  let call = fixture();
  const unexpected = await mockApi(page, (path, method, input) => {
    if (path === "/api/session" && method === "GET")
      return { json: fictionalSession("reviewer", false) };
    if (path === "/api/calls" && method === "GET")
      return { json: { calls: [call] } };
    if (path === `/api/calls/${call.id}` && method === "GET")
      return { json: { call } };
    if (path === `/api/calls/${call.id}/media`)
      return { status: 404, json: { error: "MEDIA_UNAVAILABLE" } };
    if (path === `/api/calls/${call.id}/source-review` && method === "POST") {
      call = applySourceReview(call, sourceReviewSchema.parse(input), {
        id: "reviewer-review",
        userId: "fictional-reviewer",
        at: "2026-10-08T00:00:00Z",
      });
      return { json: { call } };
    }
    return null;
  });
  await page.goto(`/calls/${call.id}`);
  await page
    .getByRole("button", { name: "Review transcript", exact: true })
    .click();
  await page
    .getByLabel("Reason for transcript review")
    .fill("Fictional partial review; uncertain source remains unknown.");
  await page
    .getByRole("button", { name: "Save transcript review", exact: true })
    .click();
  await expect(
    page.getByText("A workspace owner must start re-analysis.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Re-analyze", exact: true }),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
