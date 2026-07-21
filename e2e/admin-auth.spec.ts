import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test("advertises the PWA on staff and storefront routes", async ({ page }) => {
  await mockSupabase(page);

  await page.goto("./admin");
  await expect(page.locator("link[rel='manifest']")).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  await page.goto("./dashboard");
  await expect(page.locator("link[rel='manifest']")).toHaveCount(1);

  await page.goto("./s/akiba-shelf");
  await expect(page.locator("link[rel='manifest']")).toHaveCount(1);
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
  await expect(page.locator("body > .staff-install-banner")).toHaveCount(1);
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
  await expect(page.locator(".offline-event-launcher")).toHaveCount(0);
});

test("integrates offline event controls into the Orders hero", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  const navigation = page.locator(".admin-nav-tabs");
  await expect(
    navigation.getByRole("button", { name: "Event mode" }),
  ).toHaveCount(0);

  const hero = page.locator(".admin-view-hero-orders");
  const eventControl = hero.locator(".offline-event-launcher");
  await expect(eventControl).toBeVisible();
  await expect(eventControl).toContainText("Event sales");
  await expect(eventControl).toContainText("Not prepared");

  await eventControl.getByRole("button", { name: "Set up" }).click();
  const dialog = page.getByRole("dialog", { name: "Offline event mode" });
  await expect(dialog).toBeVisible();
  const eventName = dialog.getByLabel("Event name");
  await expect(eventName).toHaveClass(/input/);
  await expect(eventName).toHaveCSS("min-height", "44px");
  await expect(eventName).not.toHaveCSS("border-style", "none");
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
});

test("loads the initial owner workspace without duplicate requests", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const requestCounts = {
    catalog: 0,
    orders: 0,
    counts: 0,
  };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/rpc/get_admin_products"))
      requestCounts.catalog += 1;
    else if (url.pathname.endsWith("/rest/v1/orders"))
      requestCounts.orders += 1;
    else if (url.pathname.endsWith("/rpc/get_order_status_counts"))
      requestCounts.counts += 1;
  });

  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();

  await expect
    .poll(() => requestCounts)
    .toEqual({
      catalog: 1,
      orders: 1,
      counts: 1,
    });
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

test("admin header stays contained across responsive viewports", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  const header = page.locator(".app-header");
  const surface = page.locator(".app-header-surface");
  const navigation = page.locator(".app-header-navigation");
  await expect(header).toBeVisible();
  await expect(surface).toBeVisible();
  await expect(navigation).toBeVisible();

  const [surfaceBox, navigationBox] = await Promise.all([
    surface.boundingBox(),
    navigation.boundingBox(),
  ]);
  expect(surfaceBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(navigationBox!.x).toBeGreaterThanOrEqual(surfaceBox!.x);
  expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(
    surfaceBox!.x + surfaceBox!.width + 1,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
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

test("admin edit controls share one action grammar", async ({ page }) => {
  await mockSupabase(page, { staffRole: "owner", teamMembers: true });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await page.getByRole("button", { name: /Products/ }).click();
  await page.getByRole("button", { name: /Moon Stand/ }).click();
  const productFormColumn = page.locator(".admin-grid-col-form");
  await productFormColumn
    .getByRole("button", { name: "Edit", exact: true })
    .click();

  const productEditBar = productFormColumn.locator(".admin-edit-bar");
  await expect(productEditBar).toContainText("No changes");
  const cancelButton = productEditBar.getByRole("button", {
    name: "Cancel",
    exact: true,
  });
  const saveButton = productEditBar.getByRole("button", {
    name: "Save changes",
    exact: true,
  });
  await expect(cancelButton).toHaveCSS("border-radius", "11px");
  await expect(saveButton).toHaveCSS("border-radius", "11px");
  expect((await cancelButton.boundingBox())!.x).toBeLessThan(
    (await saveButton.boundingBox())!.x,
  );
  await expect(saveButton).toBeDisabled();

  await productFormColumn
    .getByLabel("Product name · Required")
    .fill("Moon Stand updated");
  await expect(productEditBar).toContainText("Unsaved changes");
  await expect(saveButton).toBeEnabled();
  await cancelButton.click();

  await page.getByRole("button", { name: "Team", exact: true }).click();
  const invitePanel = page.locator(".staff-invite-panel");
  await expect(invitePanel).toBeVisible();
  const inviteLabelStyles = await invitePanel.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>(".field-label")].map((label) => ({
      text: label.textContent,
      fontSize: getComputedStyle(label).fontSize,
      textTransform: getComputedStyle(label).textTransform,
    })),
  );
  expect(inviteLabelStyles).toEqual([
    { text: "Email", fontSize: "12px", textTransform: "uppercase" },
    { text: "Role", fontSize: "12px", textTransform: "uppercase" },
  ]);

  await page.getByRole("button", { name: "Gacha", exact: true }).click();
  const gachaEditBar = page.locator(".gacha-sticky-actions");
  await expect(gachaEditBar).toBeVisible();
  await expect(gachaEditBar.locator(".admin-edit-status")).toContainText(
    "Draft saved",
  );
  const discardButton = gachaEditBar.getByRole("button", {
    name: "Discard changes",
    exact: true,
  });
  const publishButton = gachaEditBar.getByRole("button", {
    name: "Publish",
    exact: true,
  });
  await expect(discardButton).toHaveCSS("border-radius", "11px");
  await expect(publishButton).toHaveCSS("border-radius", "11px");
  expect((await discardButton.boundingBox())!.x).toBeLessThan(
    (await publishButton.boundingBox())!.x,
  );
});

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

  await desktopPreview.locator(".storefront-module-booth").click();
  await expect(page.locator(".designer-identity-card")).toBeVisible();
  await expect(page.locator(".designer-identity-preview")).toContainText(
    "Fixture Booth",
  );
  const logoControl = page.locator(".designer-asset-field");
  await expect
    .poll(() =>
      logoControl.evaluate((element) => ({
        columns:
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
        inputWidth: element
          .querySelector("input.input")!
          .getBoundingClientRect().width,
        uploadWidth: element
          .querySelector(".upload-button")!
          .getBoundingClientRect().width,
      })),
    )
    .toMatchObject({ columns: 1, inputWidth: expect.any(Number) });
  await expect
    .poll(() =>
      logoControl.evaluate((element) => {
        const input = element
          .querySelector("input.input")!
          .getBoundingClientRect();
        const upload = element
          .querySelector(".upload-button")!
          .getBoundingClientRect();
        return Math.min(input.width, upload.width);
      }),
    )
    .toBeGreaterThan(240);

  await desktopPreview.locator(".storefront-module-cart").click();
  await expect(page.locator(".designer-payment-card")).toBeVisible();
  await expect(page.locator(".designer-payment-preview")).toContainText(
    "Customer ready",
  );

  await desktopPreview.locator(".storefront-module-featured").click();
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

test("renders callback error page with proper centered card and constrained logo styling", async ({
  page,
}) => {
  await mockSupabase(page);
  await page.goto("./auth/callback?error_description=Access%20denied");

  // Verify elements exist
  const card = page.locator(".admin-access-card");
  const logo = page.locator(".admin-login-logo .platform-mark");

  await expect(page.getByText("Could not finish sign in")).toBeVisible();
  await expect(card).toBeVisible();
  await expect(logo).toBeVisible();

  // Verify computed styles/bounding boxes for layout sanity
  const cardBox = await card.boundingBox();
  const logoBox = await logo.boundingBox();

  expect(cardBox?.width).toBeLessThanOrEqual(480);
  expect(logoBox?.width).toBeLessThan(50);

  // Verify the card has background-color and is not transparent
  const cardBg = await card.evaluate(
    (el) => window.getComputedStyle(el).backgroundColor,
  );
  expect(cardBg).toMatch(/rgba?\(255,\s*255,\s*255/);
});
