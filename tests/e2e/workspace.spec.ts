import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
test("roadmap verification resets after evidence and status changes", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
      exact: true,
    }),
  ).toBeVisible();
  const created = await page.request.post("/api/calls", {
    headers: { Origin: "http://127.0.0.1:3002" },
    data: { sample: "service" },
  });
  const call = (await created.json()).call;
  try {
    await page.goto(`/calls/${call.id}?tab=scorecard`);
    const row = page.locator(".checkpoint").filter({
      has: page.getByText("Set a solution expectation", { exact: true }),
    });
    await row.getByRole("button", { name: "Review Set a solution expectation", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Checkpoint decision").selectOption("passed");
    const verify = dialog.getByRole("checkbox", {
      name: /I checked the cited source/,
    });
    await verify.check();
    await expect(verify).toBeChecked();
    await dialog.locator(".evidence-choice input").first().check();
    await expect(verify).not.toBeChecked();
    await verify.check();
    await dialog.getByLabel("Checkpoint decision").selectOption("unknown");
    await dialog.getByLabel("Checkpoint decision").selectOption("passed");
    await expect(verify).not.toBeChecked();
    await verify.check();
    await expect(verify).toBeChecked();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await page.request.delete(`/api/calls/${call.id}`, {
      headers: { Origin: "http://127.0.0.1:3002" },
    });
  }
});
test("source recap navigates exact evidence and preserves historical speaker labels", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
      exact: true,
    }),
  ).toBeVisible();
  const created = await page.request.post("/api/calls", {
    headers: { Origin: "http://127.0.0.1:3002" },
    data: { sample: "service" },
  });
  const call = (await created.json()).call;
  try {
    await page.goto("/calls/" + call.id);
    const recap = page.locator(".source-recap");
    await expect(recap.getByText("SELECTED SOURCE EXCERPTS")).toBeVisible();
    await expect(recap.getByText("Customer · 0:14")).toBeVisible();
    await recap.getByRole("button").first().click();
    await expect(page.locator("#seg-2")).toHaveClass(/highlighted/);
    const revised = await page.request.post(
      `/api/calls/${call.id}/source-review`,
      {
        headers: { Origin: "http://127.0.0.1:3002" },
        data: {
          version: call.version,
          roles: [{ segmentId: "seg-2", speaker: "unknown" }],
          completenessVerified: true,
          qualityVerified: true,
          reason:
            "Fictional test keeps this speaker uncertain after source inspection.",
        },
      },
    );
    expect(revised.status()).toBe(200);
    await page.reload();
    await expect(
      page.locator(".source-recap").getByText("Customer · 0:14"),
    ).toBeVisible();
    const restored = (
      await (await page.request.get("/api/calls/" + call.id)).json()
    ).call;
    expect(restored.originalAnalysis.sourceRecap.segments[0].speaker).toBe(
      "customer",
    );
    expect(restored.segments[1].speaker).toBe("unknown");
  } finally {
    await page.request.delete("/api/calls/" + call.id, {
      headers: { Origin: "http://127.0.0.1:3002" },
    });
  }
});
test("actual next/previous navigation stays inside the outcome filter", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
      exact: true,
    }),
  ).toBeVisible();
  const ids: string[] = [];
  for (const sample of ["inspection", "inspection", "one-time"]) {
    const response = await page.request.post("/api/calls", {
      headers: { Origin: "http://127.0.0.1:3002" },
      data: { sample },
    });
    ids.push((await response.json()).call.id);
  }
  try {
    await page.goto("/calls?outcome=inspectionBooked");
    await expect(page.locator(".call-row")).toHaveCount(2);
    await page.locator(".call-row").first().click();
    await expect(page.locator(".call-navigation span").first()).toHaveText(
      "1 of 2",
    );
    await page.getByRole("link", { name: "Next call", exact: true }).click();
    await expect(page.locator(".call-navigation span").first()).toHaveText(
      "2 of 2",
    );
    await page
      .getByRole("link", { name: "Back to calls", exact: true })
      .click();
    await expect(page.locator(".call-row")).toHaveCount(2);
  } finally {
    for (const id of ids)
      await page.request.delete(`/api/calls/${id}`, {
        headers: { Origin: "http://127.0.0.1:3002" },
      });
  }
});
test("actual isolated app audits text-only source review, reloads history and withholds stale grade", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:3002")
      external.push(new URL(request.url()).hostname);
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  await page.getByRole("radio", { name: /A service concern resolved/ }).check();
  await page
    .getByRole("button", { name: "Add fictional call", exact: true })
    .click();
  await expect(
    page.getByText("Partial · 10/12", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review transcript", exact: true })
    .click();
  await expect(
    page.getByText(/text-only example has no recording/),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations
        .filter((x) => ["serious", "critical"].includes(x.impact ?? ""))
        .map((x) => x.id),
    ).toEqual([]);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review transcript", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Review transcript", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "I reviewed the complete fictional dialogue.",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "I checked the accuracy of the displayed fictional text.",
      exact: true,
    })
    .check();
  await page
    .getByLabel("Reason for transcript review")
    .fill(
      "Reviewed the complete fictional text, without claiming recorded audio.",
    );
  await page
    .getByRole("button", { name: "Save transcript review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Transcript review history",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Green · 11/12", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Re-analyze", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Previous analysis — source revision 0",
      exact: true,
    }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.request.delete(`/api/calls/${id}`, {
    headers: { Origin: "http://127.0.0.1:3002" },
  });
  expect(external).toEqual([]);
});

test("mobile call views, filter return, keyboard dialog and zoom remain usable", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  await page
    .getByRole("radio", { name: /One-time treatment accepted/ })
    .check();
  await page
    .getByRole("button", { name: "Add fictional call", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "One-time treatment accepted",
      exact: true,
    }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const tab of ["Scorecard", "Coaching", "Transcript", "Summary"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations
        .filter((x) => ["serious", "critical"].includes(x.impact || ""))
        .map((x) => ({ id: x.id, targets: x.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await mkdir(".private/evidence", { recursive: true });
  await page.screenshot({ path: ".private/evidence/mobile-call.png" });
  await page.getByRole("link", { name: "Back to calls", exact: true }).click();
  await page.getByRole("textbox", { name: "Search calls" }).fill("one-time");
  await page
    .getByRole("combobox", { name: "Filter by purpose" })
    .selectOption("sales");
  await page.locator(".call-row").first().click();
  await page.getByRole("link", { name: "Back to calls", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search calls" })).toHaveValue(
    "one-time",
  );
  await expect(
    page.getByRole("combobox", { name: "Filter by purpose" }),
  ).toHaveValue("sales");
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/overview");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.request.delete(`/api/calls/${id}`, {
    headers: { Origin: "http://127.0.0.1:3002" },
  });
});
test("sample call, evidence, correction, history and deletion work together", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  await page
    .getByRole("button", { name: "Add fictional call", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "An inspection, not a sale",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Text-only fixture. No recorded customer audio."),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mkdir(".private/evidence", { recursive: true });
  await page.screenshot({ path: ".private/evidence/call-workspace.png" });
  const serious = async () => {
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations
        .filter((x) => ["serious", "critical"].includes(x.impact || ""))
        .map((x) => ({
          id: x.id,
          nodes: x.nodes.map((n) => ({
            target: n.target,
            data: n.any.map((a) => a.data),
          })),
        })),
    ).toEqual([]);
  };
  await serious();
  await page.getByRole("tab", { name: "Scorecard", exact: true }).click();
  await page.getByRole("button", { name: "Review Explain pricing" }).click();
  await page.getByLabel("Checkpoint decision").selectOption("missed");
  await page
    .getByLabel("Reason for this decision")
    .fill(
      "Fictional inspection-only sample does not establish treatment pricing.",
    );
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review history" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Coaching", exact: true }).click();
  await expect(page.getByText("Make the next call stronger.")).toBeVisible();
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search transcript" })
    .fill("kitchen");
  await expect(page.locator(".transcript-segment")).toHaveCount(1);
  await serious();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "An inspection, not a sale",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete call", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Type DELETE to confirm" })
    .fill("DELETE");
  await page.getByRole("button", { name: "Delete data", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Calls", exact: false }),
  ).toBeVisible();
});
test("no horizontal overflow or serious accessibility issues at target widths", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Open sample workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good conversations start with listening.",
    }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(
      audit.violations
        .filter((x) => ["serious", "critical"].includes(x.impact || ""))
        .map((x) => ({
          id: x.id,
          nodes: x.nodes.map((n) => ({
            target: n.target,
            data: n.any.map((a) => a.data),
          })),
        })),
    ).toEqual([]);
  }
});
