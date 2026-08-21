import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { mockSupabase, products } from "./fixtures";

function getContrastRatio(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = [1, 3, 5].map(
      (index) => Number.parseInt(color.slice(index, index + 2), 16) / 255,
    );
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

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

async function chooseOrderFilter(page: Page, label: string, count: number) {
  if (page.viewportSize()!.width <= 1100) {
    await page.locator(".admin-status-filter .select-menu-trigger").click();
    await page
      .getByRole("option", { name: `${label} · ${count}`, exact: true })
      .click();
    return;
  }
  await page
    .getByRole("button", { name: new RegExp(`${label} ${count}`, "i") })
    .click();
}

async function expectAdminListsFlowOnPhone(page: Page) {
  const lists = await page
    .locator(".admin-scroll-list")
    .evaluateAll((elements) =>
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
        return [{ maxHeight: style.maxHeight, overflowY: style.overflowY }];
      }),
    );
  expect(lists.length).toBeGreaterThan(0);
  for (const list of lists) {
    expect.soft(list.maxHeight).toBe("none");
    expect.soft(list.overflowY).toBe("visible");
  }
}

async function seedOfflineEventLedger(page: Page, shopId = "main") {
  const now = new Date().toISOString();
  const sessionId = "71000000-0000-4000-8000-000000000001";
  const session = {
    version: 1,
    id: sessionId,
    shopId,
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

async function saveTabletPin(page: Page, pin = "123456") {
  const pinDialog = page.getByRole("dialog", { name: "Protect this tablet" });
  await expect(pinDialog).toBeVisible();
  await pinDialog.getByLabel("6-digit tablet PIN").fill(pin);
  await pinDialog.getByLabel("Confirm tablet PIN").fill(pin);
  await pinDialog.getByRole("button", { name: "Save PIN" }).click();
  await expect(pinDialog).toHaveCount(0);
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
  await page.getByRole("button", { name: "Open workspace" }).click();

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
  await page.getByRole("button", { name: "Open workspace" }).click();

  await chooseOrderFilter(page, "Confirmed", 1);
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

test("keeps sales and promotion layouts readable at every breakpoint", async ({
  page,
}) => {
  await mockSupabase(page, {
    staffRole: "owner",
    orderQueue: true,
    orderStatus: "confirmed",
  });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  const summary = page.locator(".admin-sales-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toHaveCSS("background-image", "none");
  await expect(summary.locator(".admin-sales-breakdown > span")).toHaveCount(3);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Products/ }).click();
  const promotionCard = page.getByRole("region", { name: "Promotion" });
  await promotionCard
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Promotion" });
  const modalFooter = dialog.locator(".modal-footer");
  await expect(modalFooter).toBeVisible();
  await expect(modalFooter).toHaveCSS("position", "sticky");
  await expect(modalFooter).toHaveCSS("backdrop-filter", "none");
  const footerLayout = await modalFooter.evaluate((footer) => {
    const footerBounds = footer.getBoundingClientRect();
    const dialogBounds = footer
      .closest("[role='dialog']")!
      .getBoundingClientRect();
    const statusBounds = footer
      .querySelector(".admin-edit-status")!
      .getBoundingClientRect();
    const actionsBounds = footer
      .querySelector(".admin-edit-actions")!
      .getBoundingClientRect();
    const buttonTops = [...footer.querySelectorAll("button")].map(
      (button) => button.getBoundingClientRect().top,
    );
    return {
      dialogLeft: dialogBounds.left,
      dialogRight: dialogBounds.right,
      footerLeft: footerBounds.left,
      footerRight: footerBounds.right,
      statusTop: statusBounds.top,
      statusBottom: statusBounds.bottom,
      actionsTop: actionsBounds.top,
      buttonTops,
    };
  });
  expect(
    Math.abs(footerLayout.footerLeft - footerLayout.dialogLeft),
  ).toBeLessThanOrEqual(1.5);
  expect(
    Math.abs(footerLayout.footerRight - footerLayout.dialogRight),
  ).toBeLessThanOrEqual(1.5);
  expect(new Set(footerLayout.buttonTops).size).toBe(1);
  if (page.viewportSize()!.width <= 760) {
    expect(footerLayout.actionsTop).toBeGreaterThanOrEqual(
      footerLayout.statusBottom,
    );
  } else {
    expect(footerLayout.actionsTop).toBeLessThanOrEqual(
      footerLayout.statusTop + 16,
    );
  }
  await dialog
    .locator(".admin-promotion-fields-group .select-menu-trigger")
    .click();
  await page.getByRole("option", { name: "Percentage off" }).click();
  const percentageProducts = dialog.locator(
    ".promotion-products-selection.is-percentage",
  );
  await expect(percentageProducts).toBeVisible();

  if (page.viewportSize()!.width <= 760) {
    const actionColumns = await percentageProducts
      .locator(".promotion-product-actions")
      .evaluateAll((actions) =>
        actions.map((action) => getComputedStyle(action).gridTemplateColumns),
      );
    expect(actionColumns).not.toHaveLength(0);
    for (const columns of actionColumns)
      expect(columns.trim().split(/\s+/)).toHaveLength(1);
  }
  await expectNoHorizontalOverflow(page);
});

test("shows Event sales as a solid responsive storefront status", async ({
  page,
}) => {
  await mockSupabase(page);
  await page.goto("./s/akiba-shelf");
  await seedOfflineEventLedger(page, "00000000-0000-4000-8000-000000000001");
  await page.reload();

  const ribbon = page.locator(".event-sales-ribbon");
  await expect(ribbon).toBeVisible();
  await expect(ribbon).toHaveCSS("background-image", "none");
  await expectNoHorizontalOverflow(page);
});

test("locks event staff access and protects ending the event with a local PIN", async ({
  page,
}) => {
  const storefrontShopId = "00000000-0000-4000-8000-000000000001";
  await mockSupabase(page, { staffRole: "owner", catalogLocale: "vi" });
  await page.goto("./admin");
  await seedOfflineEventLedger(page);
  // The fixture intentionally aliases the staff shop ID to a public UUID.
  await seedOfflineEventLedger(page, storefrontShopId);
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  await page.getByRole("button", { name: "Event Mode: Fixture Event" }).click();
  let eventDialog = page.getByRole("dialog", { name: "Offline Event Mode" });
  const activeFooter = eventDialog.locator(".offline-event-active-actions");
  await expect(activeFooter).toBeVisible();
  await expect(activeFooter).toHaveCSS("position", "sticky");
  await expect(
    activeFooter.getByRole("button", { name: "Set tablet PIN" }),
  ).toHaveCSS("min-height", "44px");
  await expect(
    activeFooter.getByRole("button", { name: "End event" }),
  ).toHaveCSS("min-height", "44px");
  const footerLayout = await activeFooter.evaluate((footer) => {
    const bounds = footer.getBoundingClientRect();
    const style = getComputedStyle(footer);
    return {
      display: style.display,
      left: bounds.left,
      right: bounds.right,
      viewportWidth: window.innerWidth,
    };
  });
  expect(footerLayout.left).toBeGreaterThanOrEqual(0);
  expect(footerLayout.right).toBeLessThanOrEqual(footerLayout.viewportWidth);
  if (page.viewportSize()!.width <= 760)
    expect(footerLayout.display).toBe("grid");

  await activeFooter.getByRole("button", { name: "Set tablet PIN" }).click();
  await saveTabletPin(page);
  await page.evaluate((publicShopId) => {
    const prefix = "matsuri-offline-event-pin-v1:";
    const record = localStorage.getItem(`${prefix}main`);
    if (record) localStorage.setItem(`${prefix}${publicShopId}`, record);
  }, storefrontShopId);
  await activeFooter.getByRole("button", { name: "Lock tablet" }).click();
  await expect(page).toHaveURL(/\/s\/akiba-shelf$/);
  await expect(page.locator(".event-sales-ribbon")).toBeVisible();

  await page
    .getByRole("button", {
      name: "Thông tin gian hàng Giờ mở cửa, vị trí & mạng xã hội",
    })
    .click();
  const boothDialog = page.getByRole("dialog", { name: "Chi tiết gian hàng" });
  await boothDialog.getByRole("button", { name: "Kênh staff →" }).click();

  const storefrontPin = page.getByRole("dialog", { name: "Kênh staff" });
  await storefrontPin
    .getByLabel("Mã PIN máy tính bảng gồm 6 số")
    .fill("000000");
  await storefrontPin.getByRole("button", { name: "Mở bảng staff" }).click();
  await expect(storefrontPin).toContainText("Mã PIN máy tính bảng không đúng.");
  await storefrontPin
    .getByLabel("Mã PIN máy tính bảng gồm 6 số")
    .fill("123456");
  await storefrontPin.getByRole("button", { name: "Mở bảng staff" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  const adminPin = page.getByRole("dialog", { name: "Staff access locked" });
  await expect(adminPin).toBeVisible();
  await adminPin.getByLabel("6-digit tablet PIN").fill("123456");
  await adminPin.getByRole("button", { name: "Open event console" }).click();
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Event Mode: Fixture Event" }).click();
  eventDialog = page.getByRole("dialog", { name: "Offline Event Mode" });
  await eventDialog.getByRole("button", { name: "End event" }).click();

  const endPin = page.getByRole("dialog", { name: "Confirm tablet PIN" });
  await endPin.getByLabel("6-digit tablet PIN").fill("123456");
  await endPin.getByRole("button", { name: "Continue" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "End offline event?",
  });
  await expect(confirmation).toContainText(
    "2 local orders will be synchronized and 0 unsold items will return to online stock.",
  );
  await confirmation
    .locator(".confirmation-dialog-actions .button-secondary")
    .click();
  await expectNoHorizontalOverflow(page);
});

test("routes an authenticated non-staff user to the dashboard", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: null });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("outsider@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();
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
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Orders", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Order queue/ })).toBeVisible();
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
  await page.getByRole("button", { name: "Open workspace" }).click();

  const navigation = page.locator(".admin-nav-tabs");
  await expect(
    navigation.getByRole("button", { name: "Event Mode" }),
  ).toHaveCount(0);

  const hero = page.locator(".admin-view-hero-orders");
  await expect(hero.locator(".offline-event-launcher")).toHaveCount(0);
  await expect(hero).toHaveCSS("background-image", "none");
  await expect(hero).toHaveCSS("border-top-style", "none");

  const toolbar = page.locator(".admin-filter-bar");
  const eventControl = toolbar.locator(".offline-event-launcher");
  await expect(eventControl).toBeVisible();
  await expect(eventControl).toContainText("Offline sales");
  await expect(toolbar.getByText("Live queue", { exact: true })).toHaveCount(0);
  const eventFilter = toolbar.getByRole("button", { name: /event 0/i });
  const compactStatusFilter = toolbar.locator(".admin-status-filter");
  if (page.viewportSize()!.width <= 1100) {
    await expect(compactStatusFilter).toBeVisible();
    await expect(eventFilter).toBeHidden();
  } else {
    await expect(eventFilter).toBeVisible();
    await expect(compactStatusFilter).toBeHidden();
  }
  const eventMenu = toolbar.locator(".admin-event-select");
  const eventSelect = eventMenu.getByRole("combobox", {
    name: "Event: All events",
    exact: true,
  });
  await expect(eventMenu).toHaveCount(0);

  await chooseOrderFilter(page, "Event", 0);
  await expect(
    page.getByRole("heading", { name: "Event orders", exact: true }),
  ).toBeVisible();
  await expect(eventMenu).toHaveClass(/select-menu/);
  await expect(eventSelect).toBeVisible();
  await expect(eventSelect).toHaveCSS("min-height", "44px");
  await expect(eventSelect).toHaveCSS("background-color", "rgb(255, 255, 255)");

  if (testInfo.project.name === "tablet-chromium") {
    const [toolbarBox, statusBox, utilitiesBox] = await Promise.all([
      toolbar.boundingBox(),
      compactStatusFilter.boundingBox(),
      toolbar.locator(".admin-queue-utilities").boundingBox(),
    ]);
    expect(toolbarBox).not.toBeNull();
    expect(statusBox).not.toBeNull();
    expect(utilitiesBox).not.toBeNull();
    const toolbarCenter = toolbarBox!.y + toolbarBox!.height / 2;
    expect(
      Math.abs(statusBox!.y + statusBox!.height / 2 - toolbarCenter),
    ).toBeLessThan(4);
    expect(
      Math.abs(utilitiesBox!.y + utilitiesBox!.height / 2 - toolbarCenter),
    ).toBeLessThan(2);
    expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(
      utilitiesBox!.x,
    );
    expect(utilitiesBox!.x + utilitiesBox!.width).toBeLessThanOrEqual(
      toolbarBox!.x + toolbarBox!.width + 1,
    );
  }

  await eventSelect.click();
  await expect(page.getByRole("listbox", { name: "Event" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(eventControl).toHaveCSS("background-image", "none");
  await expect(toolbar.locator(".admin-date-picker-trigger")).toHaveCSS(
    "background-image",
    "none",
  );

  await eventControl.click();
  const dialog = page.getByRole("dialog", { name: "Offline Event Mode" });
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
    expect(sheetGeometry.height).toBeGreaterThanOrEqual(
      sheetGeometry.viewportHeight * 0.86,
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

  const startDateTrigger = dialog.getByRole("button", {
    name: /Event starts:/,
  });
  await startDateTrigger.scrollIntoViewIfNeeded();
  await startDateTrigger.click();
  const datePopover = page.getByRole("dialog", { name: "Event starts" });
  await expect(datePopover).toBeVisible();
  await expect(datePopover).toHaveCSS("position", "fixed");
  const dateBounds = await datePopover.boundingBox();
  const viewport = page.viewportSize();
  expect(dateBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dateBounds!.x).toBeGreaterThanOrEqual(0);
  expect(dateBounds!.y).toBeGreaterThanOrEqual(0);
  expect(dateBounds!.x + dateBounds!.width).toBeLessThanOrEqual(
    viewport!.width,
  );
  expect(dateBounds!.y + dateBounds!.height).toBeLessThanOrEqual(
    viewport!.height,
  );

  const hourTrigger = datePopover.getByRole("combobox", { name: /Hour:/ });
  await hourTrigger.click();
  const hourOptions = page.getByRole("listbox", { name: "Hour" });
  await expect(hourOptions).toBeVisible();
  const hourBounds = await hourOptions.boundingBox();
  expect(hourBounds).not.toBeNull();
  expect(hourBounds!.x).toBeGreaterThanOrEqual(0);
  expect(hourBounds!.y).toBeGreaterThanOrEqual(0);
  expect(hourBounds!.x + hourBounds!.width).toBeLessThanOrEqual(
    viewport!.width,
  );
  expect(hourBounds!.y + hourBounds!.height).toBeLessThanOrEqual(
    viewport!.height,
  );
  await page.keyboard.press("Escape");
  await expect(hourOptions).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(datePopover).toHaveCount(0);

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
  await page.getByRole("button", { name: "Open workspace" }).click();

  await page.getByRole("button", { name: /expired 1/i }).click();
  const expiredStatus = page.locator(".admin-order-status.expired");
  await expect(expiredStatus).toHaveClass(/status-pill-warning/);
  await expect(expiredStatus).toHaveCSS(
    "background-color",
    "rgb(255, 244, 214)",
  );
  await expect(expiredStatus).toHaveCSS("border-top-style", "solid");

  const eventControl = page.getByRole("button", {
    name: "Event Mode: Fixture Event",
  });
  await expect(eventControl).toBeVisible();
  await eventControl.click();
  const dialog = page.getByRole("dialog", { name: "Offline Event Mode" });
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
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.locator(".offline-event-launcher").click();

  const dialog = page.getByRole("dialog", { name: "Offline Event Mode" });
  await dialog.getByLabel("Event name").fill("Locked preparation");
  await dialog.getByLabel("Allocate Moon Stand").check();
  const prepare = dialog.getByRole("button", {
    name: "Prepare device and reserve stock",
    exact: true,
  });
  await expect(prepare).toBeEnabled();
  await prepare.click();
  await saveTabletPin(page);
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

test("probes real IndexedDB before reserving Event Mode stock", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.addInitScript(() => {
    const operations: string[] = [];
    Object.defineProperty(window, "__offlineStorageProbeOperations", {
      configurable: false,
      value: operations,
    });
    for (const method of ["put", "get", "delete"] as const) {
      const original = IDBObjectStore.prototype[method];
      Object.defineProperty(IDBObjectStore.prototype, method, {
        configurable: true,
        value: function (...args: unknown[]) {
          const marker = args[0];
          if (
            (typeof marker === "string" &&
              marker.startsWith("storage-probe:")) ||
            (marker &&
              typeof marker === "object" &&
              "probeId" in marker &&
              typeof marker.probeId === "string" &&
              marker.probeId.startsWith("storage-probe:"))
          ) {
            operations.push(`${this.name}:${method}`);
          }
          return Reflect.apply(original, this, args);
        },
      });
    }
    const originalPersist = navigator.storage?.persist?.bind(navigator.storage);
    if (originalPersist) {
      Object.defineProperty(navigator.storage, "persist", {
        configurable: true,
        value: async () => {
          operations.push("storage:persist");
          return originalPersist();
        },
      });
    }
  });
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.locator(".offline-event-launcher").click();

  const dialog = page.getByRole("dialog", { name: "Offline Event Mode" });
  await dialog.getByLabel("Event name").fill("Storage probe");
  await dialog.getByLabel("Allocate Moon Stand").check();
  await dialog
    .getByRole("button", {
      name: "Prepare device and reserve stock",
      exact: true,
    })
    .click();
  await saveTabletPin(page);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __offlineStorageProbeOperations?: string[];
            }
          ).__offlineStorageProbeOperations ?? [],
      ),
    )
    .toEqual([
      "sessions:put",
      "orders:put",
      "sessions:get",
      "orders:get",
      "sessions:delete",
      "orders:delete",
      "storage:persist",
    ]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open("matsuri-offline-events-v1", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const database = request.result;
              const transaction = database.transaction(
                ["sessions", "orders"],
                "readonly",
              );
              const sessions = transaction.objectStore("sessions").getAllKeys();
              const orders = transaction.objectStore("orders").getAllKeys();
              transaction.oncomplete = () => {
                database.close();
                resolve(
                  [...(sessions.result ?? []), ...(orders.result ?? [])].filter(
                    (key) =>
                      typeof key === "string" &&
                      key.startsWith("storage-probe:"),
                  ).length,
                );
              };
              transaction.onerror = () => reject(transaction.error);
            };
          }),
      ),
    )
    .toBe(0);
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
  await page.getByRole("button", { name: "Open workspace" }).click();
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
  await page.getByRole("button", { name: "Open workspace" }).click();

  const ordersTab = page.getByRole("button", { name: /Order queue/ });
  await expect(ordersTab).toHaveClass(/active/);
  await expect(ordersTab).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Admin sections" }),
  ).toBeVisible();
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

test("keeps admin sections URL-backed across reloads", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin?view=products");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  const productsTab = page.getByRole("button", { name: /Products/ });
  await expect(productsTab).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\/admin\?view=products$/);

  await page.getByRole("button", { name: "Gacha", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\?view=gacha$/);
  await expect(
    page.getByRole("button", { name: "Gacha", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.reload();
  await expect(page).toHaveURL(/\/admin\?view=gacha$/);
  await expect(
    page.getByRole("button", { name: "Gacha", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("./admin?view=unknown");
  await expect(
    page.getByRole("button", { name: /Order queue/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/\/admin$/);
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
  await page.getByRole("button", { name: "Open workspace" }).click();

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

  if (page.viewportSize()!.width <= 1100) {
    const visualTabOrder = await navigation
      .locator(".admin-nav-tab:visible")
      .evaluateAll((tabs) =>
        tabs
          .sort(
            (left, right) =>
              left.getBoundingClientRect().left -
              right.getBoundingClientRect().left,
          )
          .map((tab) => tab.textContent?.trim() ?? ""),
      );
    expect(visualTabOrder.at(-1)).toContain("Settings");
  }

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
  }

  const moreActions = page.getByRole("button", { name: "More actions" });
  await moreActions.click();
  const overflowMenu = page.getByRole("menu", { name: "More actions" });
  await expect(overflowMenu).toBeVisible();
  await expect(
    overflowMenu.getByRole("menuitem", { name: "Support Matsuri" }),
  ).toBeVisible();
  const overflowBox = await overflowMenu.boundingBox();
  const viewport = page.viewportSize();
  expect(overflowBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(overflowBox!.x).toBeGreaterThanOrEqual(11);
  expect(overflowBox!.y).toBeGreaterThanOrEqual(11);
  expect(overflowBox!.x + overflowBox!.width).toBeLessThanOrEqual(
    viewport!.width - 11,
  );
  expect(overflowBox!.y + overflowBox!.height).toBeLessThanOrEqual(
    viewport!.height - 11,
  );
  await page.keyboard.press("Escape");
  await expect(overflowMenu).toHaveCount(0);
  await expect(moreActions).toBeFocused();

  if (testInfo.project.name === "desktop-chromium") {
    await expect(page.locator(".admin-dashboard-button")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Go to dashboard" }),
    ).toBeVisible();
    await moreActions.click();
    await expect(
      page.getByRole("menuitem", { name: "Settings", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: "Sign out", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("menuitem", { name: "Support Matsuri", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Keep Matsuri free for artists." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Admin sections" }),
    ).toBeVisible();
  }
});

test("uses shop branding while keeping admin actions contrast-safe", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  const adminTheme = await page.locator(".admin-shell").evaluate((shell) => {
    const style = getComputedStyle(shell);
    return {
      primary: style.getPropertyValue("--admin-primary").trim(),
      secondary: style.getPropertyValue("--admin-secondary").trim(),
      accent: style.getPropertyValue("--teal").trim(),
      page: style.getPropertyValue("--admin-page-bg").trim(),
      brandPrimary: style.getPropertyValue("--admin-brand-primary").trim(),
      brandSecondary: style.getPropertyValue("--admin-brand-secondary").trim(),
      brandAccent: style.getPropertyValue("--admin-brand-accent").trim(),
    };
  });
  expect(adminTheme).toMatchObject({
    secondary: "#17233c",
    brandPrimary: "#5f8d55",
    brandSecondary: "#17233c",
    brandAccent: "#5f8d55",
  });
  expect(
    getContrastRatio(adminTheme.primary, "#ffffff"),
  ).toBeGreaterThanOrEqual(4.5);
  expect(getContrastRatio(adminTheme.accent, "#ffffff")).toBeGreaterThanOrEqual(
    4.5,
  );
  expect(adminTheme.page).toBe("#f7f2ea");

  await page.getByRole("button", { name: /Products/ }).click();
  await page.getByRole("button", { name: /Moon Stand/ }).click();
  const form = page.locator(".admin-grid-col-form");
  await form.getByRole("button", { name: "Edit", exact: true }).click();
  const workspacePrimaryColor = await form
    .getByRole("button", { name: "Save changes", exact: true })
    .evaluate((button) => getComputedStyle(button).backgroundColor);
  await form.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: /Order queue/ }).click();
  await page.locator(".offline-event-launcher").click();
  const dialog = page.getByRole("dialog", { name: "Offline Event Mode" });
  const portaledPrimaryColor = await dialog
    .getByRole("button", {
      name: "Prepare device and reserve stock",
      exact: true,
    })
    .evaluate((button) => getComputedStyle(button).backgroundColor);
  expect(workspacePrimaryColor).toBe(portaledPrimaryColor);
  expect([workspacePrimaryColor, portaledPrimaryColor]).not.toContain(
    "rgb(95, 141, 85)",
  );
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
  await page.getByRole("button", { name: "Open workspace" }).click();

  await expectTouchTargetsAtLeast(
    page.getByRole("link", { name: "Back to storefront" }),
  );
  await expectTouchTargetsAtLeast(
    page.getByRole("combobox", { name: "Active shop: Fixture Booth" }),
  );
  await expectTouchTargetsAtLeast(
    page.getByRole("button", { name: "More actions" }),
  );
  await expectTouchTargetsAtLeast(
    page.locator(".admin-nav-tab:not(.admin-nav-storefront)"),
  );
  await expectTouchTargetsAtLeast(
    page.locator(".admin-status-filter button, .admin-queue-utilities button"),
  );
  await chooseOrderFilter(page, "Confirmed", 1);
  await expectTouchTargetsAtLeast(
    page.locator(
      ".admin-order-fulfillment button, .admin-order-details-trigger",
    ),
  );
  await expectAdminListsFlowOnPhone(page);
  await expectNoHorizontalOverflow(page);

  const packingHeading = page.locator(
    ".admin-items-summary .admin-section-heading",
  );
  await expect(packingHeading).toBeVisible();
  const packingLayout = await packingHeading.evaluate((heading) => {
    const title = heading.querySelector<HTMLElement>(":scope > div")!;
    const meta = heading.querySelector<HTMLElement>(":scope > small")!;
    const titleBox = title.getBoundingClientRect();
    const metaBox = meta.getBoundingClientRect();
    return {
      titleBottom: titleBox.bottom,
      metaTop: metaBox.top,
      titleRight: titleBox.right,
      metaLeft: metaBox.left,
    };
  });
  expect(
    packingLayout.metaTop >= packingLayout.titleBottom - 1 ||
      packingLayout.metaLeft >= packingLayout.titleRight - 1,
  ).toBe(true);

  await expect(page.getByRole("button", { name: /Storefront/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Settings/ }).click();
  await expect(page.locator(".admin-mobile-settings-page")).toBeVisible();
  const boothSettings = page.getByRole("region", { name: "Booth info" });
  await expect(
    boothSettings.getByRole("heading", { name: "Custom colors" }),
  ).toBeVisible();
  const primaryColor = boothSettings.getByRole("button", {
    name: "Primary: #5f8d55",
  });
  const boothName = boothSettings.getByRole("textbox", { name: "Booth name" });
  await expect(boothName).toBeDisabled();
  const disabledInputBackground = await boothName.evaluate(
    (input) => getComputedStyle(input).backgroundColor,
  );
  await expect(primaryColor).toBeDisabled();
  await boothSettings
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(boothName).toBeEnabled();
  await expect
    .poll(() =>
      boothName.evaluate((input) => getComputedStyle(input).backgroundColor),
    )
    .not.toBe(disabledInputBackground);
  await primaryColor.scrollIntoViewIfNeeded();
  await expect(primaryColor).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Products/ }).click();
  await expect(page.locator(".admin-grid")).toBeVisible();
  const productWorkspaceTabs = page.getByRole("tablist", {
    name: "Product workspace",
  });
  const activeProductTab = productWorkspaceTabs.getByRole("tab", {
    name: /Products/,
  });
  await expect(activeProductTab).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect
    .poll(() =>
      productWorkspaceTabs.evaluate((tabs) =>
        Number.parseFloat(
          getComputedStyle(tabs).getPropertyValue("--active-width"),
        ),
      ),
    )
    .toBeGreaterThan(0);
  const flowingProductList = await page
    .locator(".product-manager-list .admin-product-list")
    .evaluate((list) => {
      return {
        clientHeight: list.clientHeight,
        scrollHeight: list.scrollHeight,
        overflowY: getComputedStyle(list).overflowY,
      };
    });
  expect(flowingProductList.clientHeight).toBeGreaterThanOrEqual(320);
  expect(flowingProductList.scrollHeight).toBeLessThanOrEqual(
    flowingProductList.clientHeight + 1,
  );
  expect(flowingProductList.overflowY).toBe("visible");
  await expectAdminListsFlowOnPhone(page);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Product 01/ }).click();
  await productWorkspaceTabs.getByRole("tab", { name: /Products/ }).click();
  await expect(page.locator(".admin-product.active")).toBeVisible();
  await productWorkspaceTabs.getByRole("tab", { name: "Edit product" }).click();
  const mobileProductForm = page.locator(".admin-grid-col-form");
  await mobileProductForm
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await mobileProductForm
    .getByRole("button", { name: "Badge color: #5f8d55" })
    .click();
  const colorPickerBounds = await page
    .getByRole("dialog", { name: "Choose color for Badge color" })
    .evaluate((popover) => {
      const bounds = popover.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        placement: popover.getAttribute("data-placement"),
      };
    });
  expect(colorPickerBounds.left).toBeGreaterThanOrEqual(8);
  expect(colorPickerBounds.right).toBeLessThanOrEqual(
    colorPickerBounds.viewportWidth - 8,
  );
  expect(colorPickerBounds.top).toBeGreaterThanOrEqual(8);
  expect(colorPickerBounds.bottom).toBeLessThanOrEqual(
    colorPickerBounds.viewportHeight - 8,
  );
  expect(colorPickerBounds.placement).toMatch(/^(top|bottom)-(start|end)$/);
  const colorPlane = page.getByRole("slider", {
    name: "Saturation and brightness",
  });
  await expect(colorPlane).toBeVisible();
  await expect(colorPlane).toHaveCSS("border-top-color", "rgb(222, 217, 207)");
  await expect(page.getByLabel("Open system color picker")).toHaveAttribute(
    "type",
    "color",
  );
  await page.keyboard.press("Escape");

  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight }),
  );
  const productWorkspaceNavigation = page.getByRole("tablist", {
    name: "Product workspace",
  });
  await expect(productWorkspaceNavigation).toBeVisible();
  const productNavigationGeometry = await productWorkspaceNavigation.evaluate(
    (navigation) => {
      const navigationBounds = navigation.getBoundingClientRect();
      const headerBounds = document
        .querySelector<HTMLElement>(".admin-workspace-header")!
        .getBoundingClientRect();
      return {
        navigationTop: navigationBounds.top,
        headerBottom: headerBounds.bottom,
      };
    },
  );
  expect(productNavigationGeometry.navigationTop).toBeGreaterThanOrEqual(
    productNavigationGeometry.headerBottom - 1,
  );
  const editProductTab = productWorkspaceNavigation.getByRole("tab", {
    name: "Edit product",
  });
  const productListTab = productWorkspaceNavigation.getByRole("tab", {
    name: /Products/,
  });
  await expect(editProductTab).toHaveAttribute("aria-selected", "true");
  await expect(editProductTab).toHaveAttribute(
    "aria-controls",
    "product-workspace-form-panel",
  );
  await editProductTab.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(productListTab).toBeFocused();
  await expect(productListTab).toHaveAttribute("aria-selected", "true");
  await expect(productListTab).toHaveAttribute(
    "aria-controls",
    "product-workspace-list-panel",
  );
  await expect(page.locator(".admin-grid-col-list")).toBeVisible();
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
  await expectAdminListsFlowOnPhone(page);
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
  await expectAdminListsFlowOnPhone(page);
  await expectNoHorizontalOverflow(page);
});

for (const role of ["owner", "admin"] as const) {
  test(`${role} sees every permitted workspace`, async ({ page }, testInfo) => {
    await mockSupabase(page, { staffRole: role });
    await page.goto("./admin");
    await page.getByLabel("Email address").fill(`${role}@test.local`);
    await page.getByPlaceholder("Enter your password").fill("password123");
    await page.getByRole("button", { name: "Open workspace" }).click();
    await expect(
      page.getByRole("button", { name: /Order queue/ }),
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
  await page.getByRole("button", { name: "Open workspace" }).click();

  await page.getByRole("button", { name: /Products/ }).click();
  await page.getByRole("button", { name: /Moon Stand/ }).click();
  const productFormColumn = page.locator(".admin-grid-col-form");
  await productFormColumn
    .getByRole("button", { name: "Edit", exact: true })
    .click();

  const productEditBar = productFormColumn.locator(".admin-edit-bar");
  await expect(productEditBar).toContainText("No changes");
  const productControls = productFormColumn.locator(
    ".admin-product-form :is(input.input, select.input, .select-menu-trigger)",
  );
  const productControlCount = await productControls.count();
  expect(productControlCount).toBeGreaterThan(0);
  const productControlStyles = await productControls.evaluateAll((controls) =>
    controls.flatMap((control) => {
      const element = control as HTMLElement;
      const bounds = element.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return [];
      const style = getComputedStyle(element);
      return [{ height: style.height, radius: style.borderRadius }];
    }),
  );
  for (const style of productControlStyles) {
    expect(style.height).toBe("44px");
    expect(style.radius).toBe("11px");
  }
  const productCard = productFormColumn.locator(".admin-card");
  await expect(productCard).toHaveCSS(
    "border-radius",
    page.viewportSize()!.width <= 760 ? "16px" : "18px",
  );
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
  await page.getByRole("button", { name: "Open workspace" }).click();

  await page.getByRole("button", { name: /Products/ }).click();
  await page.getByRole("button", { name: /Moon Stand/ }).click();
  const form = page.locator(".admin-grid-col-form");
  await form.getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Product name · Required").fill("Moon Stand unsaved");

  const confirmation = page.getByRole("dialog", {
    name: "Discard unsaved changes?",
  });
  await page.evaluate(() => window.history.back());
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
  await expect(page).toHaveURL(/view=products/);

  await page.getByRole("button", { name: /Order queue/ }).click();
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
  await page.getByRole("button", { name: "Open workspace" }).click();
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
  await page.getByRole("button", { name: "Open workspace" }).click();
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
  await page.getByRole("button", { name: "Open workspace" }).click();

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
  await page.getByRole("button", { name: "Open workspace" }).click();
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

test("dashboard uses the unified account surface and control contract", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./dashboard");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  const shell = page.locator(".dashboard-account-shell");
  await expect(shell).toHaveCSS("--admin-action", "#d95c64");

  const expectedRadius = page.viewportSize()!.width <= 760 ? "16px" : "18px";
  await expect(page.locator(".dashboard-shop-card")).toHaveCSS(
    "border-radius",
    expectedRadius,
  );
  await expect(page.locator(".dashboard-create-card")).toHaveCSS(
    "border-radius",
    expectedRadius,
  );
  await expect(page.getByRole("button", { name: "Manage shop" })).toHaveCSS(
    "min-height",
    "44px",
  );
  await expect(
    page.getByRole("link", { name: "Storefront", exact: true }),
  ).toHaveCSS("min-height", "44px");
  await expect(page.getByTitle("Edit shop details")).toHaveCSS(
    "height",
    "44px",
  );

  const overflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByTitle("Edit shop details").click();
  const dialog = page.getByRole("dialog", { name: "Edit shop details" });
  await expect(dialog.getByLabel("Shop name")).toHaveCSS("height", "44px");
  await expect(dialog.getByLabel("Shop name")).toHaveCSS(
    "border-radius",
    "11px",
  );
  for (const button of await dialog.getByRole("button").all()) {
    await expect(button).toHaveCSS("min-height", "44px");
  }
});

test("workspace and dashboard headers share locale and selector surfaces", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  const headerButton = page.locator(".admin-overflow-toggle");
  const shopSelector = page.locator(
    ".admin-shop-switcher-menu > .select-menu-trigger",
  );
  const headerButtonBackground = await headerButton.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );

  await expect(shopSelector).toBeVisible();
  await expect(shopSelector).toHaveCSS("height", "44px");
  await expect(shopSelector).toHaveCSS("border-radius", "12px");
  await expect(shopSelector).toHaveCSS(
    "background-color",
    headerButtonBackground,
  );

  // Check language option in overflow menu
  await headerButton.click();
  await expect(
    page.getByRole("menuitem", { name: /Tiếng Việt/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  if (page.viewportSize()!.width > 1280) {
    const headerGeometry = await page
      .locator(".admin-workspace-header .app-header-surface-with-nav")
      .evaluate((surface) => {
        const surfaceBounds = surface.getBoundingClientRect();
        const navigationBounds = surface
          .querySelector<HTMLElement>(".app-header-navigation")!
          .getBoundingClientRect();
        return {
          surfaceCenter: surfaceBounds.left + surfaceBounds.width / 2,
          navigationCenter: navigationBounds.left + navigationBounds.width / 2,
        };
      });
    expect(
      Math.abs(headerGeometry.navigationCenter - headerGeometry.surfaceCenter),
    ).toBeLessThan(1);
    await expect(shopSelector.locator(".select-menu-copy small")).toBeHidden();
  }

  await page.goto("./dashboard");
  await expect(
    page.getByRole("heading", { name: "Your shops", exact: true }),
  ).toBeVisible();
  const dashboardLocale = page.getByRole("combobox", {
    name: "Language: English",
  });
  await expect(dashboardLocale).toBeVisible();
  await expect(dashboardLocale).toHaveCSS("height", "44px");
  await expect(dashboardLocale).toHaveCSS("border-radius", "12px");
});

test("shop switcher keeps a compact scrollable list and fixed actions", async ({
  page,
}) => {
  await mockSupabase(page, { staffRole: "owner", manyShops: true });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  await page
    .getByRole("combobox", { name: "Active shop: Fixture Booth" })
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
  const switcherBounds = await page
    .getByRole("listbox", { name: "Active shop" })
    .evaluate((popover) => {
      const bounds = popover.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
  expect(switcherBounds.left).toBeGreaterThanOrEqual(8);
  expect(switcherBounds.top).toBeGreaterThanOrEqual(8);
  expect(switcherBounds.right).toBeLessThanOrEqual(
    switcherBounds.viewportWidth - 8,
  );
  expect(switcherBounds.bottom).toBeLessThanOrEqual(
    switcherBounds.viewportHeight - 8,
  );
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

test("shop switching ignores late catalog and count responses", async ({
  page,
}) => {
  await mockSupabase(page, {
    staffRole: "owner",
    manyShops: true,
    multiShop: true,
    adminResponseDelayMs: { "shop-0": 600 },
    orderCountsByShop: {
      main: { pending: 0, confirmed: 0, cancelled: 0, expired: 0, all: 0 },
      "shop-0": {
        pending: 1,
        confirmed: 0,
        cancelled: 0,
        expired: 0,
        all: 1,
      },
      "shop-1": {
        pending: 2,
        confirmed: 0,
        cancelled: 0,
        expired: 0,
        all: 2,
      },
    },
  });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();

  const activeShop = page.getByRole("combobox", { name: /^Active shop:/ });
  await activeShop.click();
  await page
    .getByRole("option", { name: /^Fixture Shop 1(?: Active.*)?$/ })
    .click();
  await expect(activeShop).toHaveAccessibleName(/Fixture Shop 1/);
  await activeShop.click();
  await page
    .getByRole("option", { name: /^Fixture Shop 2(?: Active.*)?$/ })
    .click();

  await expect(page.locator(".admin-workspace-identity strong")).toHaveText(
    "Booth shop-1",
  );
  await expect(page.locator(".admin-nav-orders .admin-nav-count")).toHaveText(
    "2",
  );

  await page.waitForTimeout(700);
  await expect(page.locator(".admin-workspace-identity strong")).toHaveText(
    "Booth shop-1",
  );
  await expect(page.locator(".admin-nav-orders .admin-nav-count")).toHaveText(
    "2",
  );
});

test("designer phone rules apply inside the preview iframe", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockSupabase(page, { staffRole: "owner" });
  await page.goto("./admin");
  await page.getByLabel("Email address").fill("owner@test.local");
  await page.getByPlaceholder("Enter your password").fill("password123");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("button", { name: /Storefront/ }).click();
  const desktopPreview = page.frameLocator(
    'iframe[title="desktop storefront preview"]',
  );
  await expect(desktopPreview.locator(".product-grid")).toBeVisible();
  const previewCanvas = page.getByLabel("Storefront preview canvas");
  await expect
    .poll(() =>
      previewCanvas.evaluate((element) => ({
        horizontal: element.scrollWidth > element.clientWidth,
        vertical: element.scrollHeight > element.clientHeight,
      })),
    )
    .toEqual({ horizontal: true, vertical: true });

  const canvasBox = await previewCanvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  const initialCanvasScroll = await previewCanvas.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
  }));
  await page.mouse.move(
    canvasBox!.x + 18,
    canvasBox!.y + canvasBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBox!.x + 78,
    canvasBox!.y + canvasBox!.height / 2,
  );
  await page.mouse.up();
  await expect
    .poll(() => previewCanvas.evaluate((element) => element.scrollLeft))
    .toBeLessThan(initialCanvasScroll.left);

  await previewCanvas.hover({ position: { x: 18, y: 18 } });
  await page.keyboard.down("Space");
  await expect(previewCanvas).toHaveClass(/is-pan-ready/);
  await page.keyboard.up("Space");
  await expect(previewCanvas).not.toHaveClass(/is-pan-ready/);

  const zoomValue = page.locator(".builder-zoom-controls span");
  const initialZoom = Number((await zoomValue.textContent())?.replace("%", ""));
  await previewCanvas.dispatchEvent("wheel", {
    deltaY: -100,
    ctrlKey: true,
    clientX: canvasBox!.width / 2,
    clientY: canvasBox!.height / 2,
  });
  await expect
    .poll(async () => Number((await zoomValue.textContent())?.replace("%", "")))
    .toBeGreaterThan(initialZoom);
  await page.getByRole("button", { name: "Fit preview" }).click();
  await expect(page.getByRole("button", { name: "Fit preview" })).toHaveClass(
    /active/,
  );

  const iframeBox = await page
    .locator('iframe[title="desktop storefront preview"]')
    .boundingBox();
  expect(iframeBox).not.toBeNull();
  const beforeSpacePan = await previewCanvas.evaluate(
    (element) => element.scrollLeft,
  );
  await page.mouse.move(
    iframeBox!.x + iframeBox!.width / 2,
    iframeBox!.y + iframeBox!.height / 2,
  );
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(
    iframeBox!.x + iframeBox!.width / 2 + 50,
    iframeBox!.y + iframeBox!.height / 2,
  );
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect
    .poll(() => previewCanvas.evaluate((element) => element.scrollLeft))
    .toBeLessThan(beforeSpacePan);
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

  await desktopPreview
    .locator(".storefront-module-booth > .designer-module-handle")
    .click();
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

  await desktopPreview
    .locator(".storefront-module-cart > .designer-module-handle")
    .click();
  await expect(page.locator(".designer-payment-card")).toBeVisible();
  await expect(page.locator(".designer-payment-preview")).toContainText(
    "Payment ready",
  );

  await desktopPreview
    .locator(".storefront-module-featured > .designer-module-handle")
    .click();
  await page.getByRole("button", { name: /Pop poster/ }).click();
  await expect(
    desktopPreview.locator(".storefront-module-featured"),
  ).toHaveClass(/style-featured-poster/);

  await desktopPreview
    .locator(".storefront-module-controls > .designer-module-handle")
    .click();
  await page.getByRole("button", { name: /Compact/ }).click();
  await expect(
    desktopPreview.locator(".storefront-module-controls"),
  ).toHaveClass(/style-controls-compact/);

  await desktopPreview
    .locator(".storefront-module-products > .designer-module-handle")
    .click();
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
  await page.getByRole("button", { name: "Open workspace" }).click();
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
