import { test, expect, type Page } from "@playwright/test";
import { sampleCall } from "../../src/lib/samples/fixtures";
import { applySourceReview } from "../../src/lib/domain/source-review";
import { sourceReviewSchema } from "../../src/lib/domain/schemas";
import { mockApi, checkWidths, fictionalSession } from "./mock-api";

const draft =
  "Fictional review-control regression; no customer recording used.";
function liveFixture() {
  const call = sampleCall("service", "20000000-0000-4000-8000-000000000021");
  call.mode = "live";
  call.sourceKind = "synthetic";
  call.sanitizedPath = "fictional/prepared.wav";
  return call;
}
function silence() {
  // Local silence tests the media element, never transcription or AI accuracy.
  const bytes = Buffer.alloc(44 + 180 * 8000 * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}
async function setup(page: Page, withMedia = false) {
  let call = withMedia
    ? liveFixture()
    : sampleCall("service", "20000000-0000-4000-8000-000000000022");
  let mediaAvailable = true;
  const unexpected = await mockApi(page, (path, method) => {
    if (path === "/api/session") return { json: fictionalSession() };
    if (path === "/api/calls") return { json: { calls: [call] } };
    if (path === `/api/calls/${call.id}` && method === "GET")
      return { json: { call } };
    if (path === `/api/calls/${call.id}/media` && method === "GET")
      return mediaAvailable
        ? { json: { url: "http://127.0.0.1:3001/fictional-media.wav" } }
        : { status: 503, json: { error: "MEDIA_UNAVAILABLE" } };
    return null;
  });
  await page.route("**/fictional-media.wav", (route) => {
    const bytes = silence();
    const range = /^bytes=(\d+)-(\d*)$/.exec(
      route.request().headers().range || "",
    );
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2]
      ? Math.min(Number(range[2]), bytes.length - 1)
      : bytes.length - 1;
    return route.fulfill({
      status: range ? 206 : 200,
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
          : {}),
      },
      body: bytes.subarray(start, end + 1),
    });
  });
  return {
    getCall: () => call,
    setCall: (next: typeof call) => {
      call = next;
    },
    unavailable: () => {
      mediaAvailable = false;
    },
    unexpected,
  };
}
async function open(page: Page, id: string) {
  await page.goto(`/calls/${id}?tab=transcript`);
  await page
    .getByRole("button", { name: "Review transcript", exact: true })
    .click();
  await page.getByLabel("Reason for transcript review").fill(draft);
}

test("prepared playback and segment seek stay usable inside transcript review without losing annotations", async ({
  page,
}) => {
  const state = await setup(page, true);
  const call = state.getCall();
  await page.goto(`/calls/${call.id}?tab=transcript`);
  await expect(page.locator("audio")).toHaveJSProperty("readyState", 4);
  await page
    .locator("audio")
    .evaluate((audio: HTMLAudioElement) => audio.play());
  await page
    .getByRole("button", { name: "Review transcript", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Review transcript" });
  await expect(dialog.locator("audio")).toHaveCount(1);
  await expect(dialog.locator("audio")).toHaveJSProperty("paused", true);
  await expect(page.locator("audio")).toHaveCount(1);
  await page.getByLabel("Reason for transcript review").fill(draft);
  await page
    .getByLabel(`Speaker ${call.segments[0].id}`, { exact: true })
    .selectOption("unknown");
  await dialog
    .getByRole("button", { name: "Play prepared recording", exact: true })
    .click();
  await expect(dialog.locator("audio")).toHaveJSProperty("paused", false);
  await dialog
    .getByRole("button", { name: "Pause prepared recording", exact: true })
    .click();
  await expect(dialog.locator("audio")).toHaveJSProperty("paused", true);
  const segment = call.segments[2];
  await dialog
    .getByRole("button", {
      name: `Seek recording to ${Math.floor(segment.startMs / 60000)}:${String(Math.floor(segment.startMs / 1000) % 60).padStart(2, "0")}`,
      exact: true,
    })
    .click();
  await expect(dialog.locator("audio")).toHaveJSProperty(
    "currentTime",
    segment.startMs / 1000,
  );
  await expect(page.getByLabel("Reason for transcript review")).toHaveValue(
    draft,
  );
  await expect(
    page.getByLabel(`Speaker ${call.segments[0].id}`, { exact: true }),
  ).toHaveValue("unknown");
  await checkWidths(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review transcript", exact: true }),
  ).toBeFocused();
  await expect(page.locator("audio")).toHaveCount(1);
  await expect(page.locator("audio")).toHaveJSProperty("paused", true);
  expect(state.unexpected).toEqual([]);
});

test("unavailable prepared media is explicit and refresh failure preserves review draft", async ({
  page,
}) => {
  const state = await setup(page, true);
  state.unavailable();
  await open(page, state.getCall().id);
  const dialog = page.getByRole("dialog", { name: "Review transcript" });
  await expect(
    dialog.getByText(
      "Prepared recording is unavailable. Try refreshing playback before verifying the source.",
      { exact: true },
    ),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Refresh prepared recording", exact: true })
    .click();
  await expect(dialog.locator("audio")).toHaveCount(0);
  await expect(page.getByLabel("Reason for transcript review")).toHaveValue(
    draft,
  );
  expect(state.unexpected).toEqual([]);
});

for (const outcome of ["failure", "success"] as const) {
  test(`busy transcript review prevents Escape during delayed ${outcome}`, async ({
    page,
  }) => {
    const state = await setup(page);
    const call = state.getCall();
    let release = () => {},
      received = false,
      requests = 0;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/calls/${call.id}/source-review`, async (route) => {
      received = true;
      requests++;
      if (requests === 1) await gate;
      if (requests === 1 && outcome === "failure")
        await route.fulfill({ status: 503, json: { error: "REQUEST_FAILED" } });
      else {
        state.setCall(
          applySourceReview(
            state.getCall(),
            sourceReviewSchema.parse(route.request().postDataJSON()),
            {
              id: "fictional-ui-review",
              userId: "fictional-reviewer",
              at: "2026-10-08T00:00:00Z",
            },
          ),
        );
        await route.fulfill({ json: { call: state.getCall() } });
      }
    });
    await open(page, call.id);
    const dialog = page.getByRole("dialog", { name: "Review transcript" });
    await expect(dialog.locator("audio")).toHaveCount(0);
    await dialog
      .getByRole("button", { name: "Save transcript review", exact: true })
      .click();
    try {
      await expect.poll(() => received).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(page.getByLabel("Reason for transcript review")).toHaveValue(
        draft,
      );
    } finally {
      release();
    }
    if (outcome === "failure") {
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(page.getByLabel("Reason for transcript review")).toHaveValue(
        draft,
      );
      await dialog
        .getByRole("button", { name: "Save transcript review", exact: true })
        .click();
    }
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", { name: "Review transcript", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Review transcript", exact: true }),
    ).toBeFocused();
    expect(state.unexpected).toEqual([]);
  });
}

test("busy checkpoint review prevents Escape and retains failed-save draft", async ({
  page,
}) => {
  const state = await setup(page);
  const call = state.getCall();
  let release = () => {},
    received = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/calls/${call.id}/review`, async (route) => {
    received = true;
    await gate;
    await route.fulfill({ status: 503, json: { error: "REQUEST_FAILED" } });
  });
  await page.goto(`/calls/${call.id}?tab=scorecard`);
  await page
    .locator("button.text-link")
    .filter({ hasText: "Review checkpoint" })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Review checkpoint" });
  await page.getByLabel("Reason for this decision").fill(draft);
  await dialog
    .getByRole("button", { name: "Save review", exact: true })
    .click();
  try {
    await expect.poll(() => received).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally {
    release();
  }
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Reason for this decision")).toHaveValue(draft);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

test("busy deletion prevents Escape through failure and can reopen afterward", async ({
  page,
}) => {
  const state = await setup(page);
  const call = state.getCall();
  let release = () => {},
    received = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/calls/${call.id}`, async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    received = true;
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: "DELETE_STORAGE_FAILED" },
    });
  });
  await page.goto(`/calls/${call.id}`);
  await page.getByRole("button", { name: "Delete call", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Delete this conversation?",
  });
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete data", exact: true })
    .click();
  try {
    await expect.poll(() => received).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally {
    release();
  }
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText(
      "Some recording copies could not be removed. Retry deletion to finish cleanup.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete call", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});
