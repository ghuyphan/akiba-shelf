import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test("auth remains usable when browser storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    const shouldBlock = (storage: Storage, key: string) =>
      storage === window.localStorage && key.startsWith("matsuri-admin-");
    Storage.prototype.getItem = function (key) {
      if (shouldBlock(this, key))
        throw new DOMException("Storage is blocked", "SecurityError");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (shouldBlock(this, key))
        throw new DOMException("Storage is blocked", "SecurityError");
      return setItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (shouldBlock(this, key))
        throw new DOMException("Storage is blocked", "SecurityError");
      return removeItem.call(this, key);
    };
  });
  await mockSupabase(page, { staffRole: "staff" });

  await page.goto("./admin");
  await page.getByLabel("Email address").fill("staff@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  const tokenResponse = page.waitForResponse((response) =>
    response.url().includes("/mock-supabase/auth/v1/token"),
  );
  await page.getByRole("button", { name: "Open workspace" }).click();
  expect((await tokenResponse).status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();

  const moreActions = page.getByRole("button", { name: "More actions" });
  await moreActions.click();
  const menuBounds = await page
    .getByRole("menu", { name: "More actions" })
    .evaluate((menu) => {
      const bounds = menu.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        width: innerWidth,
      };
    });
  expect(menuBounds.left).toBeGreaterThanOrEqual(11);
  expect(menuBounds.right).toBeLessThanOrEqual(menuBounds.width - 11);
});

test("storefront cart persists across a WebKit reload", async ({ page }) => {
  await mockSupabase(page);
  await page.goto("./s/akiba-shelf");
  const addToCart = page.getByRole("button", {
    name: /Add Moon Stand to cart/i,
  });
  await expect(addToCart).toBeVisible();

  const readTheme = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const header = document.querySelector<HTMLElement>(".catalog-header");
      return {
        page: root.getPropertyValue("--page-bg").trim(),
        card: root.getPropertyValue("--store-card-background").trim(),
        renderedPage: getComputedStyle(document.body).backgroundColor,
        backdrop: header
          ? getComputedStyle(header).getPropertyValue("backdrop-filter") ||
            getComputedStyle(header).getPropertyValue(
              "-webkit-backdrop-filter",
            )
          : "",
      };
    });
  await expect.poll(async () => (await readTheme()).card).toMatch(/^#[0-9a-f]{6}$/);
  const theme = await readTheme();
  expect(theme.page).toMatch(/^#[0-9a-f]{6}$/);
  expect(theme.renderedPage).not.toBe("rgba(0, 0, 0, 0)");
  expect(theme.backdrop).toContain("blur");

  await addToCart.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.entries(localStorage).find(([key]) =>
            key.includes("-cart-v1:"),
          )?.[1] ?? "",
      ),
    )
    .toContain("moon-stand");
  const persistedCart = await page.evaluate(() =>
    Object.entries(localStorage).find(([key]) => key.includes("-cart-v1:")),
  );
  expect(persistedCart?.[1]).toContain("moon-stand");
  await page.reload();

  await expect
    .poll(() =>
      page.evaluate(
        ([key]) => localStorage.getItem(key ?? ""),
        persistedCart ?? [undefined, undefined],
      ),
    )
    .toBe(persistedCart?.[1]);
});

test("storefront modal closes and restores page interaction", async ({
  page,
}) => {
  await mockSupabase(page);
  await page.goto("./s/akiba-shelf");
  const trigger = page.getByRole("button", { name: /Booth info/i });

  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Booth details" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
  await trigger.click();
  await expect(dialog).toBeVisible();
});

test("release update detection works in WebKit", async ({ page }) => {
  await mockSupabase(page);
  await page.goto("./support");
  await expect(
    page.getByRole("heading", { name: "Keep Matsuri free for artists." }),
  ).toBeVisible();

  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/release.ts";
    const release = await import(modulePath);
    const metadata = await release.fetchReleaseMetadata(async () =>
      Response.json({ release: "webkit-next" }),
    );
    return {
      current: release.APP_RELEASE,
      metadata,
      detectsUpdate: release.hasNewerRelease(metadata),
    };
  });

  expect(result.current).not.toBe("development");
  expect(result.metadata).toEqual({ release: "webkit-next" });
  expect(result.detectsUpdate).toBe(true);
});
