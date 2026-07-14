import { expect, test } from "@playwright/test";

test("landing locale control matches the other header actions", async ({
  page,
}) => {
  await page.goto("./");
  const localeButton = page.getByRole("button", { name: "Language: English" });
  const signInButton = page.locator(".platform-home-signin-btn");
  await expect(localeButton).toHaveCSS("border-top-width", "0px");
  const [localeBackground, signInBackground] = await Promise.all([
    localeButton.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
    signInButton.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ]);
  expect(localeBackground).toBe(signInBackground);
});

async function expectStableLandingHero(page: import("@playwright/test").Page) {
  const title = page.locator(".platform-landing-hero h1");
  const underline = page.locator(".platform-landing-title-underline");

  await expect(underline).toBeVisible();
  const [titleBox, underlineBox] = await Promise.all([
    title.boundingBox(),
    underline.boundingBox(),
  ]);
  expect(titleBox).not.toBeNull();
  expect(underlineBox).not.toBeNull();
  expect(underlineBox!.width).toBeGreaterThanOrEqual(115);
  expect(underlineBox!.height).toBeGreaterThanOrEqual(6);
  expect(underlineBox!.y).toBeGreaterThan(titleBox!.y);
  expect(underlineBox!.y + underlineBox!.height).toBeLessThanOrEqual(
    titleBox!.y + titleBox!.height + 5,
  );

  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    const [artBox, phoneBox] = await Promise.all([
      page.locator(".platform-landing-art").boundingBox(),
      page.locator(".platform-landing-phone").boundingBox(),
    ]);
    expect(artBox).not.toBeNull();
    expect(phoneBox).not.toBeNull();
    expect(phoneBox!.x + phoneBox!.width).toBeLessThanOrEqual(
      artBox!.x + artBox!.width + 12,
    );
    expect(phoneBox!.y + phoneBox!.height).toBeLessThanOrEqual(
      artBox!.y + artBox!.height + 12,
    );
  }
}

test("landing title accent and mobile artwork stay stable across locales", async ({
  page,
}) => {
  await page.goto("./");
  await expectStableLandingHero(page);

  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("option", { name: "Tiếng Việt" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Tác phẩm của bạn. Gian hàng của bạn. Góc nhỏ của bạn tại hội chợ.",
    }),
  ).toBeVisible();
  await expectStableLandingHero(page);
});

test("platform locale menu persists without horizontal overflow", async ({
  page,
}) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Language: English" }).click();
  await page.getByRole("option", { name: "Tiếng Việt" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Tác phẩm của bạn. Gian hàng của bạn. Góc nhỏ của bạn tại hội chợ.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ngôn ngữ: Tiếng Việt" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.goto("./auth?mode=signin");
  await expect(
    page.getByRole("heading", { name: "Chào mừng bạn trở lại" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Truy cập an toàn vào gian hàng và không gian làm việc của staff.",
    ),
  ).toBeVisible();
  await expect(page.locator(".platform-language-menu")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
