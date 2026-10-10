import { test, expect } from "@playwright/test";
import { mockApi, fictionalSession } from "./mock-api";
test("upload defaults to the single Call option and allows immediate file selection", async ({
  page,
}) => {
  const unexpected = await mockApi(page, (path) => {
    if (path === "/api/session")
      return { json: fictionalSession("owner", true) };
    if (path === "/api/calls") return { json: { calls: [] } };
    return null;
  });
  await page.goto("/calls");
  await page.getByRole("button", { name: "Add call", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const type = dialog.getByLabel(/Recording type/);
  await expect(type).toHaveValue("real");
  await expect(type.locator("option")).toHaveCount(1);
  await expect(type.locator("option")).toHaveText("Call");
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(dialog.locator("input[type=file]")).toBeEnabled();
  await dialog.locator("input[type=file]").setInputFiles({
    name: "Fictional locally selected.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("RIFF0000WAVEfictional"),
  });
  await expect(
    dialog.getByText("Fictional locally selected.wav", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Upload and analyze", exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByText(/Actual client calls remain on hold/),
  ).toHaveCount(0);
  expect(unexpected).toEqual([]);
});
