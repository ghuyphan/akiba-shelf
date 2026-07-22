import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mockSupabase, products } from "./fixtures";

async function expectTouchTargetsAtLeast(locator: Locator, minimum = 44) {
  await expect(locator.first()).toBeVisible();
  const targets = await locator.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        style.visibility === "hidden" ||
        style.display === "none" ||
        bounds.width === 0 ||
        bounds.height === 0
      )
        return [];
      return [
        {
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim() ||
            element.tagName,
          width: bounds.width,
          height: bounds.height,
        },
      ];
    }),
  );
  expect(targets.length).toBeGreaterThan(0);
  for (const target of targets) {
    expect
      .soft(target.width, `${target.label} width`)
      .toBeGreaterThanOrEqual(minimum);
    expect
      .soft(target.height, `${target.label} height`)
      .toBeGreaterThanOrEqual(minimum);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        documentFits:
          document.documentElement.scrollWidth <= window.innerWidth + 1,
        bodyFits: document.body.scrollWidth <= window.innerWidth + 1,
      })),
    )
    .toEqual({ documentFits: true, bodyFits: true });
}

async function seedOfflineEventLedger(page: Page) {
  const now = new Date().toISOString();
  const sessionId = "71000000-0000-4000-8000-000000000001";
  const session = {
    version: 1,
    id: sessionId,
    shopId: "main",
    shopSlug: "akiba-shelf",
    deviceId: "72000000-0000-4000-8000-000000000001",
    name: "Fixture Event",
    status: "active",
    scheduledStartAt: now,
    scheduledEndAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    startedAt: now,
    allocations: [
      { product: products[0], quantityAllocated: 2, quantitySold: 2 },
    ],
    payment: {
      momo_qr_url: "",
      bank_qr_url: "",
      momo_label: "MoMo",
      bank_label: "Bank",
      payment_instructions: "Pay exactly",
    },
    promotion: {
      enabled: false,
      buy_quantity: 3,
      free_quantity: 1,
      repeatable: false,
      qualifying_product_ids: [],
      reward_product_ids: [],
    },
    createdAt: now,
    updatedAt: now,
  };
  const order = (
    id: string,
    orderCode: string,
    status: "confirmed" | "cancelled",
  ) => ({
    version: 1,
    id,
    sessionId,
    shopId: "main",
    orderCode,
    customerName: `${status} customer`,
    totalAmount: products[0].price_vnd,
    status,
    paymentMethod: "cash",
    paymentState:
      status === "confirmed" ? "cash_confirmed" : "awaiting_payment",
    clientRevision: 1,
    fulfillmentStatus: status === "confirmed" ? "preparing" : "unfulfilled",
    confirmedAt: status === "confirmed" ? now : undefined,
    cancelledAt: status === "cancelled" ? now : undefined,
    items: [
      {
        product_id: products[0].id,
        quantity: 1,
        unit_price: products[0].price_vnd,
        discount_amount: 0,
      },
    ],
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
  });

  await page.evaluate(
    async ({ seededSession, seededOrders }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("matsuri-offline-events-v1", 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("sessions"))
            database.createObjectStore("sessions", { keyPath: "shopId" });
          if (!database.objectStoreNames.contains("orders")) {
            const orders = database.createObjectStore("orders", {
              keyPath: "id",
            });
            orders.createIndex("sessionId", "sessionId", { unique: false });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ["sessions", "orders"],
            "readwrite",
          );
          transaction.objectStore("sessions").put(seededSession);
          for (const seededOrder of seededOrders)
            transaction.objectStore("orders").put(seededOrder);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        };
      });
    },
    {
      seededSession: session,
      seededOrders: [
        order("73000000-0000-4000-8000-000000000001", "EVT-001", "confirmed"),
        order("73000000-0000-4000-8000-000000000002", "EVT-002", "cancelled"),
      ],
    },
  );
}

test("advertises the PWA only on staff routes", async ({ page }) => {
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

test("offers the install banner only on phone staff layouts", async ({
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
  if (page.viewportSize()!.width > 760) {
    await expect(installBanner).toHaveCount(0);
    return;
  }
  await expect(installBanner).toBeVisible();
  await expect(installBanner).toContainText("Keep Matsuri close");
  await expect(page.locator("body > .staff-install-banner")).toHaveCount(1);
  await installBanner
    .getByRole("button", { name: "Install", exact: true })
    .click();
  await expect(installBanner).toHaveCount(0);
});

test("shows order details and advances online fulfilment", async ({ page }) => {
  await mockSupabase(page, { staffRole: "owner", orderQueue: true });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await page.getByRole("button", { name: /confirmed 1/i }).click();
  await expect(page.getByText("AK-0042", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Order details" }).click();
  const details = page.getByRole("dialog", { name: "Order details · AK-0042" });
  await expect(details).toBeVisible();
  await expect(details).toContainText("staff@test.local");
  await details.getByRole("button", { name: "Close modal" }).click();

  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(
    page.getByRole("button", { name: "Mark picked up" }),
  ).toBeVisible();
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

test("integrates event controls and filtering into the Orders toolbar", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "phone-chromium") {
    await page.setViewportSize({ width: 760, height: 900 });
  }
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
  await expect(hero.locator(".offline-event-launcher")).toHaveCount(0);
  await expect(hero).toHaveCSS("background-image", "none");
  await expect(hero).toHaveCSS("border-top-style", "none");

  const toolbar = page.locator(".admin-filter-bar");
  const eventControl = toolbar.locator(".offline-event-launcher");
  await expect(eventControl).toBeVisible();
  await expect(eventControl).toContainText("Event mode");
  await expect(toolbar.getByText("Live queue", { exact: true })).toHaveCount(0);
  const eventFilter = toolbar.getByRole("button", { name: /event 0/i });
  await expect(eventFilter).toBeVisible();
  const eventMenu = toolbar.locator(".admin-event-select");
  const eventSelect = eventMenu.getByRole("button", {
    name: "Event: All events",
    exact: true,
  });
  await expect(eventMenu).toHaveClass(/select-menu/);
  await expect(eventSelect).toBeVisible();
  const readToolbarGeometry = () =>
    toolbar.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const utilities = element
        .querySelector<HTMLElement>(".admin-queue-utilities")!
        .getBoundingClientRect();
      const eventSelectBounds = element
        .querySelector<HTMLElement>(".admin-event-select")!
        .getBoundingClientRect();
      return {
        height: bounds.height,
        utilitiesX: utilities.x - bounds.x,
        utilitiesWidth: utilities.width,
        eventSelectWidth: eventSelectBounds.width,
      };
    });
  const geometryBeforeFilterChange = await readToolbarGeometry();

  await eventFilter.click();
  await expect(
    page.getByRole("heading", { name: "Event orders", exact: true }),
  ).toBeVisible();
  const geometryAfterFilterChange = await readToolbarGeometry();
  expect(geometryAfterFilterChange.height).toBeCloseTo(
    geometryBeforeFilterChange.height,
    1,
  );
  expect(geometryAfterFilterChange.utilitiesX).toBeCloseTo(
    geometryBeforeFilterChange.utilitiesX,
    1,
  );
  expect(geometryAfterFilterChange.utilitiesWidth).toBeCloseTo(
    geometryBeforeFilterChange.utilitiesWidth,
    1,
  );
  expect(geometryAfterFilterChange.eventSelectWidth).toBeCloseTo(
    geometryBeforeFilterChange.eventSelectWidth,
    1,
  );
  await expect(eventSelect).toHaveCSS("min-height", "44px");
  await expect(eventSelect).toHaveCSS("background-color", "rgb(255, 255, 255)");

  if (testInfo.project.name === "tablet-chromium") {
    const [toolbarBox, tabsBox, utilitiesBox] = await Promise.all([
      toolbar.boundingBox(),
      toolbar.locator(".admin-filter-tabs").boundingBox(),
      toolbar.locator(".admin-queue-utilities").boundingBox(),
    ]);
    expect(toolbarBox).not.toBeNull();
    expect(tabsBox).not.toBeNull();
    expect(utilitiesBox).not.toBeNull();
    const activeFilterBox = await toolbar
      .locator(".admin-filter-tabs button[aria-pressed='true']")
      .boundingBox();
    expect(activeFilterBox).not.toBeNull();
    const toolbarCenter = toolbarBox!.y + toolbarBox!.height / 2;
    expect(
      Math.abs(tabsBox!.y + tabsBox!.height / 2 - toolbarCenter),
    ).toBeLessThan(2);
    expect(
      Math.abs(utilitiesBox!.y + utilitiesBox!.height / 2 - toolbarCenter),
    ).toBeLessThan(2);
    expect(tabsBox!.x + tabsBox!.width).toBeLessThanOrEqual(utilitiesBox!.x);
    expect(activeFilterBox!.x).toBeGreaterThanOrEqual(tabsBox!.x);
    expect(activeFilterBox!.x + activeFilterBox!.width).toBeLessThanOrEqual(
      tabsBox!.x + tabsBox!.width + 1,
    );
    expect(utilitiesBox!.x + utilitiesBox!.width).toBeLessThanOrEqual(
      toolbarBox!.x + toolbarBox!.width + 1,
    );
  }

  await eventSelect.click();
  await expect(page.getByRole("listbox", { name: "Event" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(eventControl).toHaveCSS("background-image", "none");
  await expect(
    toolbar.getByRole("button", { name: "Today", exact: true }),
  ).toHaveCSS("background-image", "none");

  await eventControl.click();
  const dialog = page.getByRole("dialog", { name: "Offline event mode" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveClass(/modal-wide/);
  const dialogShape = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, ratio: bounds.width / bounds.height };
  });
  if (page.viewportSize()!.width > 760) {
    expect(dialogShape.width).toBeLessThanOrEqual(640);
    expect(dialogShape.ratio).toBeLessThanOrEqual(1.35);
  } else {
    const sheetGeometry = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const header = element.querySelector<HTMLElement>(".modal-header");
      const backdrop = element.parentElement;
      return {
        height: bounds.height,
        viewportHeight: window.innerHeight,
        backdropAlign: backdrop ? getComputedStyle(backdrop).alignItems : "",
        headerPosition: header ? getComputedStyle(header).position : "",
        bottomRadius: getComputedStyle(element).borderBottomLeftRadius,
      };
    });
    expect(sheetGeometry.backdropAlign).toBe("end");
    expect(sheetGeometry.headerPosition).toBe("sticky");
    expect(sheetGeometry.bottomRadius).toBe("0px");
    await expect
      .poll(() =>
        dialog.evaluate((element) =>
          Math.abs(element.getBoundingClientRect().bottom - window.innerHeight),
        ),
      )
      .toBeLessThanOrEqual(1);
    expect(sheetGeometry.height).toBeLessThanOrEqual(
      sheetGeometry.viewportHeight * 0.88 + 1,
    );
    const detailsCard = dialog.locator(".offline-event-details-card");
    await expect(detailsCard).toBeVisible();
    const setupGeometry = await dialog.evaluate((element) => {
      const warningBounds = element
        .querySelector<HTMLElement>(".offline-event-warning")!
        .getBoundingClientRect();
      const detailsBounds = element
        .querySelector<HTMLElement>(".offline-event-details-card")!
        .getBoundingClientRect();
      return {
        warningLeft: warningBounds.left,
        warningRight: warningBounds.right,
        detailsLeft: detailsBounds.left,
        detailsRight: detailsBounds.right,
        gap: detailsBounds.top - warningBounds.bottom,
      };
    });
    expect(setupGeometry.warningLeft).toBeCloseTo(setupGeometry.detailsLeft, 1);
    expect(setupGeometry.warningRight).toBeCloseTo(
      setupGeometry.detailsRight,
      1,
    );
    expect(setupGeometry.gap).toBeGreaterThanOrEqual(11);
    const allocationRows = dialog.locator(".offline-event-allocation-row");
    expect(await allocationRows.count()).toBeGreaterThan(0);
    await expect(
      dialog.locator(".offline-event-allocation-thumb").first(),
    ).toBeVisible();
    await expectTouchTargetsAtLeast(
      dialog.locator(
        ".offline-event-allocation-toggle, .offline-event-allocation-quantity",
      ),
    );
  }
  const eventName = dialog.getByLabel("Event name");
  await expect(dialog).toHaveClass(/modal-admin/);
  await expect(eventName).toHaveClass(/input/);
  await expect(eventName).toHaveCSS("min-height", "44px");
  await expect(eventName).not.toHaveCSS("border-style", "none");
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
});

test("renders expired and Event Mode statuses with shared visual pills", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockSupabase(page, {
    staffRole: "owner",
    orderQueue: true,
    orderStatus: "expired",
  });
  await page.goto("./admin");
  await seedOfflineEventLedger(page);
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await page.getByRole("button", { name: /expired 1/i }).click();
  const expiredStatus = page.locator(".admin-order-status.expired");
  await expect(expiredStatus).toHaveClass(/status-pill-warning/);
  await expect(expiredStatus).toHaveCSS(
    "background-color",
    "rgb(255, 244, 214)",
  );
  await expect(expiredStatus).toHaveCSS("border-top-style", "solid");

  const eventControl = page.getByRole("button", {
    name: "Event mode: Fixture Event",
  });
  await expect(eventControl).toBeVisible();
  await eventControl.click();
  const dialog = page.getByRole("dialog", { name: "Offline event mode" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator(".offline-event-order-state .status-pill-success"),
  ).toContainText("Confirmed");
  await expect(
    dialog.locator(".offline-event-order-state .status-pill-danger"),
  ).toContainText("Cancelled");
  await expect(
    dialog.locator(".offline-event-order-state .status-pill-info"),
  ).toHaveCount(2);
  await expect(
    dialog.locator(".offline-event-order-state .status-pill-success"),
  ).toHaveCSS("background-color", "rgb(231, 246, 238)");
  await expect(
    dialog.locator(".offline-event-order-state .status-pill-danger"),
  ).toHaveCSS("background-color", "rgb(255, 240, 241)");
});

test("keeps Event Mode locked while device preparation is running", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockSupabase(page, { staffRole: "owner" });
  let releaseDraft!: () => void;
  const draftGate = new Promise<void>((resolve) => {
    releaseDraft = resolve;
  });
  await page.route("**/rest/v1/rpc/save_offline_event_draft", async (route) => {
    await draftGate;
    await route.fallback();
  });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();
  await page.locator(".offline-event-launcher").click();

  const dialog = page.getByRole("dialog", { name: "Offline event mode" });
  await dialog.getByLabel("Event name").fill("Locked preparation");
  await dialog.getByLabel("Allocate Moon Stand").check();
  const prepare = dialog.getByRole("button", {
    name: "Prepare device and reserve stock",
    exact: true,
  });
  await expect(prepare).toBeEnabled();
  await prepare.click();
  try {
    await expect(
      dialog.getByRole("button", { name: "Close modal" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally {
    releaseDraft();
  }
});

test("loads the initial owner workspace without duplicate requests", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const requestCounts = {
    catalog: 0,
    orders: 0,
    counts: 0,
    eventOrders: 0,
  };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/rpc/get_admin_products"))
      requestCounts.catalog += 1;
    else if (url.pathname.endsWith("/rest/v1/orders"))
      requestCounts.orders += 1;
    else if (url.pathname.endsWith("/rpc/get_order_status_counts"))
      requestCounts.counts += 1;
    else if (url.pathname.endsWith("/rpc/get_offline_event_orders"))
      requestCounts.eventOrders += 1;
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
      eventOrders: 1,
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
}, testInfo) => {
  if (testInfo.project.name === "desktop-chromium") {
    await page.setViewportSize({ width: 1024, height: 900 });
  }
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

  if (testInfo.project.name === "desktop-chromium") {
    const [brandBox, actionsBox] = await Promise.all([
      page.locator(".app-header-brand").boundingBox(),
      page.locator(".app-header-actions").boundingBox(),
    ]);
    expect(brandBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    const navigationCenter = navigationBox!.y + navigationBox!.height / 2;
    expect(
      Math.abs(brandBox!.y + brandBox!.height / 2 - navigationCenter),
    ).toBeLessThan(2);
    expect(
      Math.abs(actionsBox!.y + actionsBox!.height / 2 - navigationCenter),
    ).toBeLessThan(2);

    await expect(page.locator(".admin-dashboard-button")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Go to dashboard" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "More actions" }).click();
    const settingsAction = page
      .locator(".admin-overflow-popover")
      .getByRole("button", { name: "Settings", exact: true });
    await expect(settingsAction).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await settingsAction.click();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".admin-mobile-settings-page")).toBeVisible();
  }
});

test("inherits the shop accent across workspace and portaled admin actions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  const shopAccent = await page
    .locator(".admin-shell")
    .evaluate((shell) =>
      getComputedStyle(shell).getPropertyValue("--coral").trim(),
    );
  expect(shopAccent).toBe("#5f8d55");

  await page.getByRole("button", { name: /Products/ }).click();
  await page.getByRole("button", { name: /Moon Stand/ }).click();
  const form = page.locator(".admin-grid-col-form");
  await form.getByRole("button", { name: "Edit", exact: true }).click();
  const workspacePrimaryColor = await form
    .getByRole("button", { name: "Save changes", exact: true })
    .evaluate((button) => getComputedStyle(button).backgroundColor);
  await form.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: /Orders Queue/ }).click();
  await page.locator(".offline-event-launcher").click();
  const dialog = page.getByRole("dialog", { name: "Offline event mode" });
  const portaledPrimaryColor = await dialog
    .getByRole("button", {
      name: "Prepare device and reserve stock",
      exact: true,
    })
    .evaluate((button) => getComputedStyle(button).backgroundColor);
  expect(portaledPrimaryColor).toBe(workspacePrimaryColor);
});

test("phone admin workspaces keep major targets touch-sized without page overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-chromium");
  await mockSupabase(page, {
    staffRole: "owner",
    orderQueue: true,
    teamMembers: true,
    dualGacha: true,
    manyProducts: true,
  });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await expectTouchTargetsAtLeast(
    page.getByRole("link", { name: "Back to catalog" }),
  );
  await expectTouchTargetsAtLeast(
    page.getByRole("button", { name: "Active shop: Fixture Booth" }),
  );
  await expectTouchTargetsAtLeast(
    page.getByRole("button", { name: "More actions" }),
  );
  await expectTouchTargetsAtLeast(
    page.locator(".admin-nav-tab:not(.admin-nav-storefront)"),
  );
  await expectTouchTargetsAtLeast(
    page.locator(".admin-filter-tabs button, .admin-queue-utilities button"),
  );
  await page.getByRole("button", { name: /confirmed 1/i }).click();
  await expectTouchTargetsAtLeast(
    page.locator(
      ".admin-order-fulfillment button, .admin-order-details-trigger",
    ),
  );
  await expectNoHorizontalOverflow(page);

  await expect(page.getByRole("button", { name: /Storefront/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Settings/ }).click();
  await expect(page.locator(".admin-mobile-settings-page")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Products/ }).click();
  await expect(page.locator(".admin-grid")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Gacha", exact: true }).click();
  await expect(page.locator(".gacha-admin-page")).toBeVisible();
  await expectTouchTargetsAtLeast(
    page.locator(
      ".gacha-status-games button, .gacha-preview-button, .gacha-sticky-actions button",
    ),
  );
  const arrowRightEdges = await page
    .locator(".gacha-item.is-included .gacha-item-expand")
    .evaluateAll((arrows) =>
      arrows.map((arrow) => arrow.getBoundingClientRect().right),
    );
  expect(arrowRightEdges.length).toBeGreaterThan(1);
  expect(
    Math.max(...arrowRightEdges) - Math.min(...arrowRightEdges),
  ).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: /Add merch/ }).click();
  const ownedAvailableCard = page
    .locator(".gacha-item.is-available")
    .filter({ has: page.locator(".gacha-tag.is-owned") })
    .first();
  await expect(ownedAvailableCard).toBeVisible();
  const ownedCardGeometry = await ownedAvailableCard.evaluate((card) => {
    const identity = card.querySelector<HTMLElement>(".gacha-item-id")!;
    const name = card.querySelector<HTMLElement>(".gacha-item-name")!;
    const tag = card.querySelector<HTMLElement>(".gacha-tag.is-owned")!;
    const cardBounds = card.getBoundingClientRect();
    const identityBounds = identity.getBoundingClientRect();
    const nameBounds = name.getBoundingClientRect();
    const tagBounds = tag.getBoundingClientRect();
    return {
      cardWidth: cardBounds.width,
      identityWidth: identityBounds.width,
      nameWidth: nameBounds.width,
      identityBottom: identityBounds.bottom,
      tagTop: tagBounds.top,
    };
  });
  expect(ownedCardGeometry.identityWidth).toBeGreaterThan(
    ownedCardGeometry.cardWidth * 0.8,
  );
  expect(ownedCardGeometry.nameWidth).toBeGreaterThan(60);
  expect(ownedCardGeometry.tagTop).toBeGreaterThanOrEqual(
    ownedCardGeometry.identityBottom,
  );
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight }),
  );
  const gachaBottomGeometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(
      "#gacha-validation-luck",
    );
    const actions = document.querySelector<HTMLElement>(
      ".gacha-sticky-actions",
    );
    if (!content || !actions) return null;
    const contentBounds = content.getBoundingClientRect();
    const actionBounds = actions.getBoundingClientRect();
    return {
      contentBottom: contentBounds.bottom,
      actionTop: actionBounds.top,
    };
  });
  expect(gachaBottomGeometry).not.toBeNull();
  expect(gachaBottomGeometry!.contentBottom).toBeLessThanOrEqual(
    gachaBottomGeometry!.actionTop + 1,
  );
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.locator(".admin-team-page")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

for (const role of ["owner", "admin"] as const) {
  test(`${role} sees every permitted workspace`, async ({ page }, testInfo) => {
    await mockSupabase(page, { staffRole: role });
    await page.goto("./admin");
    await page.getByLabel("Email address").fill(`${role}@test.local`);
    await page.getByPlaceholder("Enter your password").fill("password123");
    await page.getByRole("button", { name: "Open admin" }).click();
    await expect(
      page.getByRole("button", { name: /Orders Queue/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Products/ })).toBeVisible();
    if (testInfo.project.name === "desktop-chromium") {
      await expect(
        page.getByRole("button", { name: /Storefront/ }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /Settings/ })).toHaveCount(
        0,
      );
    } else {
      await expect(
        page.getByRole("button", { name: /Storefront/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Settings/ }),
      ).toBeVisible();
    }
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
  if (page.viewportSize()!.width <= 760) {
    const productBounds = await productEditBar.evaluate((bar) => {
      const barRect = bar.getBoundingClientRect();
      const actions = [...bar.querySelectorAll<HTMLElement>("button")].map(
        (button) => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        },
      );
      return {
        viewportWidth: window.innerWidth,
        bar: { left: barRect.left, right: barRect.right },
        actions,
      };
    });
    expect(productBounds.bar.left).toBeGreaterThanOrEqual(0);
    expect(productBounds.bar.right).toBeLessThanOrEqual(
      productBounds.viewportWidth,
    );
    for (const action of productBounds.actions) {
      expect(action.left).toBeGreaterThanOrEqual(productBounds.bar.left);
      expect(action.right).toBeLessThanOrEqual(productBounds.bar.right);
    }
  }

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
  if (page.viewportSize()!.width <= 760) {
    const gachaLayout = await gachaEditBar.evaluate((bar) => {
      const barRect = bar.getBoundingClientRect();
      const status = bar.querySelector<HTMLElement>(".admin-edit-status")!;
      const reset = bar.querySelector<HTMLElement>(".gacha-reset-button")!;
      const publish = bar.querySelector<HTMLElement>(".gacha-publish-button")!;
      const resetRect = reset.getBoundingClientRect();
      const publishRect = publish.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        bar: { left: barRect.left, right: barRect.right },
        statusFontSize: getComputedStyle(status).fontSize,
        reset: {
          left: resetRect.left,
          right: resetRect.right,
          width: resetRect.width,
        },
        publish: {
          left: publishRect.left,
          right: publishRect.right,
          width: publishRect.width,
        },
      };
    });
    expect(gachaLayout.bar.left).toBeGreaterThanOrEqual(0);
    expect(gachaLayout.bar.right).toBeLessThanOrEqual(
      gachaLayout.viewportWidth,
    );
    expect(gachaLayout.statusFontSize).not.toBe("0px");
    expect(gachaLayout.reset.left).toBeGreaterThanOrEqual(gachaLayout.bar.left);
    expect(gachaLayout.publish.right).toBeLessThanOrEqual(
      gachaLayout.bar.right,
    );
    expect(gachaLayout.publish.width).toBeGreaterThan(gachaLayout.reset.width);
  }
});

test("guards workspace navigation while product edits are unsaved", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open admin" }).click();

  await page.getByRole("button", { name: /Products/ }).click();
  await page.getByRole("button", { name: /Moon Stand/ }).click();
  const form = page.locator(".admin-grid-col-form");
  await form.getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Product name · Required").fill("Moon Stand unsaved");

  await page.getByRole("button", { name: /Orders Queue/ }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Discard unsaved changes?",
  });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveClass(/modal-admin/);
  const confirmationActions = confirmation.locator(
    ".confirmation-dialog-actions",
  );
  await expect(form).toBeVisible();

  await confirmationActions
    .getByRole("button", { name: "Keep editing" })
    .click();
  await expect(confirmation).toBeHidden();
  await expect(form.getByLabel("Product name · Required")).toHaveValue(
    "Moon Stand unsaved",
  );

  await page.getByRole("button", { name: /Orders Queue/ }).click();
  await page
    .getByRole("dialog", { name: "Discard unsaved changes?" })
    .getByRole("button", { name: "Discard changes" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();
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
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
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
