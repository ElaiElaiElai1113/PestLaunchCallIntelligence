import { test, expect } from "@playwright/test";
import { mockApi, fictionalSession } from "./mock-api";
test("upload requires an explicit source choice and distinguishes actual client calls from fiction", async ({
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
  await expect(type).toHaveValue("");
  await expect(dialog.locator("input[type=file]")).toBeDisabled();
  await type.selectOption("synthetic");
  const check = dialog.getByRole("checkbox", {
    name: /made-up people and details/,
  });
  await check.check();
  await type.selectOption("real");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await expect(dialog.locator("input[type=file]")).toBeEnabled();
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "Fictional locally selected.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("RIFF0000WAVEfictional"),
    });
  await expect(
    dialog.getByText("Fictional locally selected.wav", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await expect(
    dialog.getByRole("button", { name: "Upload and analyze", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByText(/Actual client calls remain on hold/),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
});
