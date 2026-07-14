import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test("advertises the staff PWA only on dashboard and admin routes", async ({
  page,
}) => {
  await mockSupabase(page);

  await page.goto("./admin");
  await expect(page.locator("link[rel='manifest']")).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  await page.goto("./dashboard");
  await expect(page.locator("link[rel='manifest']")).toHaveCount(1);

  await page.goto("./s/akiba-shelf");
  await expect(page.locator("link[rel='manifest']")).toHaveCount(0);
});

test("offers an eligible staff browser a compact install banner", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(event);
  });

  const installBanner = page.getByLabel("Install Matsuri staff app");
  await expect(installBanner).toBeVisible();
  await expect(installBanner).toContainText("Keep Matsuri close");
  await installBanner
    .getByRole("button", { name: "Install", exact: true })
    .click();
  await expect(installBanner).toHaveCount(0);
});

test("routes an authenticated non-staff user to the dashboard", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: null });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("outsider@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Matsuri" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Create your own shop \(optional\)/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your shop" }),
  ).toBeVisible();
  await expect(page.getByLabel("Shop name")).toHaveAttribute(
    "maxlength",
    "100",
  );
  await expect(page.getByLabel("Storefront URL slug")).toHaveAttribute(
    "maxlength",
    "63",
  );
});

test("allows authorized staff into orders without restricted settings", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "staff" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("staff@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Orders Queue/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Products/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Storefront/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Settings/ })).toHaveCount(0);
});

test("highlights the default Orders navigation tab", async ({ page }) => {
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  const ordersTab = page.getByRole("button", { name: /Orders Queue/ });
  await expect(ordersTab).toHaveClass(/active/);
  await expect
    .poll(() =>
      page
        .locator(".admin-nav-tabs")
        .evaluate((element) =>
          Number.parseFloat(
            getComputedStyle(element).getPropertyValue("--active-width"),
          ),
        ),
    )
    .toBeGreaterThan(0);
});

for (const role of ["owner", "admin"] as const) {
  test(`${role} sees every permitted workspace`, async ({ page }) => {
    await mockSupabase(page, { staffRole: role });
    await page.goto("./admin");
    await page.getByLabel("Email address").fill(`${role}@test.local`);
    await page.getByPlaceholder("Enter your password").fill("password123");
    await page.getByRole("button", { name: "Open admin" }).click();
    await expect(
      page.getByRole("button", { name: /Orders Queue/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Products/ })).toBeVisible();
    if (page.viewportSize()!.width > 760)
      await expect(
        page.getByRole("button", { name: /Storefront/ }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: /Settings/ }),
      ).toBeVisible();
  });
}

test("rejects inactive staff", async ({ page }) => {
  await mockSupabase(page, { staffRole: "staff", staffActive: false });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("inactive@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Staff access inactive" }),
  ).toBeVisible();
});

test("dashboard keeps inactive memberships visible but disabled", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "staff", staffActive: false });
  await page.goto("./dashboard");
  await page.getByLabel("Email address").fill("inactive@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture Booth" }),
  ).toBeVisible();
  await expect(page.getByText("Access disabled")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage shop" })).toHaveCount(
    0,
  );
});

test("shop creation feedback reflects the server-side ownership limit", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner", ownedShopCount: 5 });
  await page.goto("./dashboard");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await expect(page.getByText("5 of 5 created shops used")).toBeVisible();
  await expect(page.getByText(/You have joined 0 shops/)).toBeVisible();
  await expect(
    page.locator(".dashboard-create-card[aria-disabled='true']"),
  ).toContainText("Shop creation limit reached");

  await page.goto("./dashboard/shops/new");
  await expect(
    page.getByText(
      "You can create up to 5 shops. Joined shops do not count toward this limit.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create shop" })).toHaveCount(
    0,
  );
});

test("dashboard presents the storefront slug as immutable", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./dashboard");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await page.getByTitle("Edit shop details").click();
  const dialog = page.getByRole("dialog", { name: "Edit shop details" });
  await expect(dialog.getByText("/s/akiba-shelf")).toBeVisible();
  await expect(
    dialog.getByText("Shop URLs cannot currently be changed after creation."),
  ).toBeVisible();
  await expect(page.getByPlaceholder("shop-url-slug")).toHaveCount(0);
  await expect(dialog.getByLabel("Shop name")).toHaveAttribute(
    "maxlength",
    "100",
  );
});

test("shop switcher keeps a compact scrollable list and fixed actions", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner", manyShops: true });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await page
    .getByRole("button", { name: "Active shop: Fixture Booth" })
    .click();
  const selectedShopMeta = page.locator(
    ".admin-shop-switcher-menu > .select-menu-trigger .select-menu-copy small",
  );
  await expect(selectedShopMeta).toHaveCSS("white-space", "nowrap");
  await expect(selectedShopMeta).toHaveCSS("text-overflow", "ellipsis");
  const shopList = page.locator(
    ".admin-shop-switcher-menu .select-menu-options",
  );
  await expect(shopList).toBeVisible();
  await expect
    .poll(() =>
      shopList.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);
  await expect(page.getByRole("option", { name: /All shops/ })).toBeVisible();
  await expect(
    page.getByRole("option", { name: /Create another shop/ }),
  ).toBeVisible();
});

test("designer phone rules apply inside the preview iframe", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()!.width <= 760,
    "The designer is intentionally replaced by Settings on phone admin viewports.",
  );
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await page.getByRole("button", { name: /Storefront/ }).click();
  const desktopPreview = page.frameLocator(
    'iframe[title="desktop storefront preview"]',
  );
  await expect(desktopPreview.locator(".product-grid")).toBeVisible();
  await expect
    .poll(() =>
      desktopPreview
        .locator(".product-grid")
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
        ),
    )
    .toBe(3);

  await page.locator('[data-designer-section="featured"]').click();
  await page.getByRole("button", { name: /Pop poster/ }).click();
  await expect(
    desktopPreview.locator(".storefront-module-featured"),
  ).toHaveClass(/style-featured-poster/);

  await desktopPreview.locator(".storefront-module-controls").click();
  await page.getByRole("button", { name: /Compact/ }).click();
  await expect(
    desktopPreview.locator(".storefront-module-controls"),
  ).toHaveClass(/style-controls-compact/);

  await desktopPreview.locator(".storefront-module-products").click();
  await page.getByRole("button", { name: /Framed/ }).click();
  await expect(
    desktopPreview.locator(".storefront-module-products"),
  ).toHaveClass(/style-product-framed/);

  await page.getByRole("button", { name: "Phone" }).click();
  const preview = page.frameLocator('iframe[title="phone storefront preview"]');
  await expect(preview.locator("body")).toHaveClass(
    /designer-preview-document/,
  );
  await expect(preview.locator("body")).toHaveClass(/device-phone/);
  await expect(preview.locator(".designer-live-storefront")).toBeVisible();
  await expect(preview.locator(".storefront-module-booth")).toBeHidden();
  await expect(
    preview.getByRole("button", { name: /Booth info/ }),
  ).toBeVisible();
  await preview.getByRole("button", { name: /Booth info/ }).click();
  await expect(preview.locator(".designer-header-trigger-wrapper")).toHaveClass(
    /is-selected/,
  );
  await expect(
    preview.locator(".storefront-module-cart > .designer-module-handle"),
  ).toHaveCSS("position", "fixed");
});

test("mobile team members use one unified list surface", async ({ page }) => {
  test.skip(page.viewportSize()!.width > 760, "Mobile-only team layout.");
  await mockSupabase(page, { staffRole: "owner", teamMembers: true });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await page.getByRole("button", { name: "Team", exact: true }).click();

  const membersPanel = page.locator(".staff-members-panel");
  const memberRows = membersPanel.locator(".admin-staff-row");
  await expect(memberRows).toHaveCount(3);
  await expect(membersPanel).toHaveCSS("border-top-width", "1px");
  await expect(memberRows.first()).toHaveCSS("border-radius", "0px");
  await expect(memberRows.nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(
    memberRows.first().getByRole("button", { name: /Remove/ }),
  ).toHaveCSS("width", "74px");
});
