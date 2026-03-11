import type { Page } from "@playwright/test";

export const loginoutmate = async (page: Page) => {
  await page.goto("/");
  await page.getByPlaceholder("Username").fill("outmate");
  await page.getByPlaceholder("Password").fill("outmate");
  await page.getByRole("button", { name: "Sign In" }).click();
};
