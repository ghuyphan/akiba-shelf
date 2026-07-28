import { expect, test } from "@playwright/test";

test("landing locale control matches the other header actions", async ({
  page,
}) => {
  await page.goto("./");
  const localeButton = page.getByRole("combobox", {
    name: "Language: English",
  });
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

test("landing header keeps stable geometry without horizontal overflow", async ({
  page,
}) => {
  await page.goto("./");

  const header = page.locator(".app-header");
  const surface = page.locator(".app-header-surface");
  await expect(header).toBeVisible();
  await expect(surface).toBeVisible();

  const [headerBox, surfaceBox] = await Promise.all([
    header.boundingBox(),
    surface.boundingBox(),
  ]);
  expect(headerBox).not.toBeNull();
  expect(surfaceBox).not.toBeNull();
  expect(surfaceBox!.height).toBeCloseTo(66, 2);
  expect(surfaceBox!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width - 16,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

async function expectStableLandingHero(page: import("@playwright/test").Page) {
  const title = page.locator(".platform-home-hero h1");
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
      page.locator(".platform-home-hero-preview").boundingBox(),
      page.locator(".platform-home-preview-phone").boundingBox(),
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

  await page.getByRole("combobox", { name: "Language: English" }).click();
  await page.getByRole("option", { name: "Tiếng Việt" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Bán merch gọn hơn. Không bỏ sót đơn nào.",
    }),
  ).toBeVisible();
  await expectStableLandingHero(page);
});

test("landing sections reveal once they enter the viewport", async ({
  page,
}) => {
  await page.goto("./");

  const surfaces = page.locator(".platform-home-surfaces");
  await expect(surfaces).not.toHaveClass(/is-visible/);
  await surfaces.scrollIntoViewIfNeeded();
  await expect(surfaces).toHaveClass(/is-visible/);
});

test("landing content stays visible with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");

  await expect(page.locator("[data-home-reveal]")).toHaveCount(6);
  await expect(page.locator("[data-home-reveal]:not(.is-visible)")).toHaveCount(
    0,
  );
});

test("support page offers one-time community support methods", async ({
  page,
}) => {
  await page.goto("./support");

  await expect(
    page.getByRole("heading", {
      name: "Keep Matsuri free for artists.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Buy me a coffee/i }),
  ).toHaveAttribute("href", "https://buymeacoffee.com/ghuyphan");
  await expect(page.getByText("Phan Gia Huy")).toBeVisible();
  await expect(page.getByText("Pha Gia Huy")).toBeVisible();
  await expect(
    page.getByAltText("TPBank QR code to support Matsuri"),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);
});

test("platform locale menu persists without horizontal overflow", async ({
  page,
}) => {
  await page.goto("./");

  await page.getByRole("combobox", { name: "Language: English" }).click();
  await page.getByRole("option", { name: "Tiếng Việt" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Bán merch gọn hơn. Không bỏ sót đơn nào.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Ngôn ngữ: Tiếng Việt" }),
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
      "Truy cập an toàn vào gian hàng và không gian làm việc của nhân viên.",
    ),
  ).toBeVisible();
  await expect(page.locator(".platform-language-menu")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
