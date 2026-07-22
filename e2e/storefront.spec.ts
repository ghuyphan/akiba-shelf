import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
  await page.goto("./s/akiba-shelf");
});

test("does not advertise the staff PWA from a customer storefront", async ({
  page,
}) => {
  await expect(page.locator("link[rel='manifest']")).toHaveCount(0);
});

test("reloads the storefront while completely offline", async ({
  context,
  page,
}) => {
  await expect(
    page.getByRole("button", { name: /Add Moon Stand to cart/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Booth info/i }).click();
  const boothDialog = page.getByRole("dialog", { name: "Booth details" });
  await expect(
    boothDialog.getByRole("button", { name: "Download for offline browsing" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("button", { name: /Add Moon Stand to cart/i }),
  ).toBeVisible();
});

test("uses a familiar featured icon and centers the collection badge", async ({
  page,
}) => {
  const featured = page.getByRole("region", { name: "Featured merchandise" });
  await expect(page.locator(".featured-banner-kicker svg")).toHaveClass(
    /lucide-star/,
  );
  await expect(
    featured.getByRole("heading", { name: "Moon Stand" }),
  ).toBeVisible();
  await expect(
    featured.getByRole("button", { name: "Add front item: Moon Stand" }),
  ).toBeVisible();
  const collectionBadge = page.locator(".featured-banner-collection");
  await expect(collectionBadge).toHaveCSS("display", "flex");
  await expect(collectionBadge).toHaveCSS("align-items", "center");
  await expect(collectionBadge).toHaveCSS("line-height", "9px");
});

test("toast uses smooth restrained motion", async ({ page }) => {
  const addMoonStand = page.getByRole("button", {
    name: /Add Moon Stand to cart/i,
  });
  await addMoonStand.click();
  await addMoonStand.click();
  await addMoonStand.click();

  const toast = page.locator(".toast");
  await expect(toast).toHaveCSS("animation-duration", "0.22s");
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(toast).toHaveCSS("animation-duration", "0.16s");
});

test("renders social QR codes with gradient dots in the simple card layout", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { socialLinks: true });
  await page.reload();

  await page.getByRole("button", { name: /Booth info/i }).click();
  const boothDialog = page.getByRole("dialog", { name: "Booth details" });
  const instagramCard = boothDialog.locator(".social-qr-instagram");
  await expect(instagramCard).toBeVisible();
  const cardQr = instagramCard.getByAltText("Instagram QR code");
  await expect(cardQr).toBeVisible();
  await expect
    .poll(() => cardQr.getAttribute("src"))
    .toMatch(/^data:image\/png/);
  const sampledColors = await cardQr.evaluate((image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 160) {
      if (
        pixels[index] > 245 &&
        pixels[index + 1] > 245 &&
        pixels[index + 2] > 245
      )
        continue;
      colors.add(`${pixels[index]}-${pixels[index + 1]}-${pixels[index + 2]}`);
    }
    return colors.size;
  });
  expect(sampledColors).toBeGreaterThan(10);
  await instagramCard.click();

  const qrDialog = page.getByRole("dialog", { name: "Instagram Link" });
  await expect(qrDialog).toBeVisible();
  await expect(qrDialog.locator(".social-qr-zoom-icon")).toContainText(
    "Instagram",
  );
  await expect(qrDialog.getByAltText("Instagram QR code")).toBeVisible();
  const socialHandle = qrDialog.getByText("@fixture.artist");
  await expect(socialHandle).toBeVisible();
  await expect(socialHandle).toHaveCSS("color", "rgb(225, 48, 108)");
  await expect(
    qrDialog.getByRole("link", { name: /Open Profile Link/i }),
  ).toHaveAttribute("href", "https://instagram.com/fixture.artist");

  const xCard = boothDialog.locator(".social-qr-x");
  const youtubeCard = boothDialog.locator(".social-qr-youtube");
  await expect(xCard).toBeVisible();
  await expect(xCard.locator(".social-qr-header")).toHaveCSS(
    "color",
    "rgb(15, 20, 25)",
  );
  await expect(youtubeCard).toBeVisible();
  await expect(youtubeCard.locator(".social-qr-header")).toHaveCSS(
    "color",
    "rgb(255, 0, 51)",
  );
  await expect(boothDialog.locator(".social-qr-threads")).toHaveCount(0);
});

test("uses the booth locale and derives its open status from local time", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { catalogLocale: "vi" });
  await page.reload();

  const guide = page.locator(".booth-card-redesign");
  if ((page.viewportSize()?.width ?? 1000) > 760) {
    await expect(guide.getByText("Thông tin gian hàng")).toBeVisible();
    await expect(guide.locator(".booth-card-topline small")).toContainText(
      /Đang mở|Đã đóng/,
    );
    await expect(guide.locator(".booth-card-topline small")).toHaveCSS(
      "color",
      "rgb(95, 141, 85)",
    );
    await expect(guide.locator(".booth-card-topline i")).toHaveCount(0);
  }
  await page.getByRole("button", { name: /Thông tin gian hàng/i }).click();
  await expect(
    page.getByRole("dialog", { name: "Chi tiết gian hàng" }),
  ).toContainText("Giờ mở cửa");
});

test("browses, filters, searches, opens details, and enforces quantity limits", async ({
  page,
}) => {
  await expect(page.getByText("Fixture Booth").first()).toBeVisible();
  await page.getByPlaceholder("Search items...").fill("Sun");
  await expect(page.getByText("Sun Print").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /View details for Moon Stand/i }),
  ).toHaveCount(0);
  await page.getByPlaceholder("Search items...").fill("");
  await page
    .getByRole("button", { name: /View details for Moon Stand/i })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "A bright acrylic stand",
  );
  await page
    .getByRole("button", { name: /Add to cart/i })
    .last()
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  await expect(page.getByText(/Only 2 units are available/i)).toBeVisible();
});

test("keeps the storefront mounted while a category refreshes", async ({
  page,
}) => {
  await page.route("**/mock-supabase/rest/v1/products**", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.searchParams.get("category") === "eq.Print" &&
      url.searchParams.get("select") !== "category"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    await route.fallback();
  });

  const printCategory = page.getByRole("button", {
    name: "Print",
    exact: true,
  });
  await expect(printCategory).toBeVisible();
  await printCategory.click();
  await expect(page.getByText("Stocking the shelf")).toBeVisible();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".page-loading")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View details for Sun Print" }),
  ).toBeVisible();
});

test("loads the catalog in batches without hiding later search results", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { manyProducts: true });
  await page.reload();

  await expect(page.locator(".product-card")).toHaveCount(24);
  await expect(page.getByText("24 items shown")).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.locator(".product-card")).toHaveCount(30);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);

  const searchedProducts = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.includes("/rest/v1/products") &&
      (url.searchParams.get("or") ?? "").includes("Product 30")
    );
  });
  await page.getByPlaceholder("Search items...").fill("Product 30");
  await searchedProducts;
  await expect(
    page.getByRole("button", { name: "View details for Product 30" }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(1);
});

test("keeps a long cart reachable while the customer continues browsing", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { manyProducts: true });
  await page.reload();

  const addButtons = page.locator(".product-card .product-add-button");
  for (let index = 0; index < 8; index += 1) {
    await addButtons.nth(index).click();
  }

  const isPhone = (page.viewportSize()?.width ?? 1000) <= 760;
  if (isPhone) {
    await page.getByRole("button", { name: "View cart" }).click();
  }

  const cart = page.locator(".selected-panel:not(.selected-panel-empty)");
  const cartItems = cart.locator(".cart-items-container");
  await expect(cart.locator(".cart-item-row")).toHaveCount(8);
  await expect(cart.getByRole("button", { name: /Pay now/i })).toBeVisible();
  await expect
    .poll(() =>
      cartItems.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);

  if (!isPhone) {
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const floatingCart = page.locator(".floating-cart-bar");
    await expect(floatingCart).toBeVisible();
    await expect(floatingCart).toContainText("8 items ready in your cart");
    const floatingCartBounds = await floatingCart.boundingBox();
    expect(floatingCartBounds?.width).toBeLessThanOrEqual(622);
    expect(floatingCartBounds?.height).toBeLessThanOrEqual(68);
    await expect(page.locator(".app-shell")).toHaveClass(
      /storefront-has-cart-dock/,
    );
    const cartDockOverlap = await page.evaluate(() => {
      const dock = document.querySelector(".floating-cart-bar");
      const cards = document.querySelectorAll(".product-card");
      const finalCard = cards.item(cards.length - 1);
      if (!dock || !finalCard) return Number.POSITIVE_INFINITY;
      return (
        finalCard.getBoundingClientRect().bottom -
        dock.getBoundingClientRect().top
      );
    });
    expect(cartDockOverlap).toBeLessThanOrEqual(0);
    const shellBottomPadding = await page
      .locator(".app-shell")
      .evaluate((shell) => Number.parseFloat(getComputedStyle(shell).paddingBottom));
    expect(shellBottomPadding).toBeLessThanOrEqual(32);
    const revealCart = floatingCart.getByRole("button", { name: "View cart" });
    await expect(revealCart).toBeVisible();
    await revealCart.click();
    await expect(floatingCart).toBeHidden();
    await expect
      .poll(async () => (await cart.boundingBox())?.y ?? -1)
      .toBeGreaterThanOrEqual(0);
  }
});

test("keeps products clear of the pending payment dock", async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { manyProducts: true });
  await page.reload();

  await page.getByRole("button", { name: /Add Product 01 to cart/i }).click();
  const viewCart = page.getByRole("button", { name: /View cart/i });
  if (await viewCart.isVisible()) await viewCart.click();
  await page.getByRole("button", { name: /Pay now/i }).click();
  await page.getByLabel(/Pickup name/i).fill("Customer");
  await page.getByRole("button", { name: /Create order & pay/i }).click();
  await page.getByRole("button", { name: "Hide payment details" }).click();

  const pendingDock = page.locator(".pending-order-bar");
  await expect(pendingDock).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) > 760) {
    const pendingDockBounds = await pendingDock.boundingBox();
    expect(pendingDockBounds?.width).toBeLessThanOrEqual(622);
    expect(pendingDockBounds?.height).toBeLessThanOrEqual(68);
  }
  await expect(page.locator(".app-shell")).toHaveClass(
    /storefront-has-order-dock/,
  );
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const pendingDockOverlap = await page.evaluate(() => {
    const dock = document.querySelector(".pending-order-bar");
    const cards = document.querySelectorAll(".product-card");
    const finalCard = cards.item(cards.length - 1);
    if (!dock || !finalCard) return Number.POSITIVE_INFINITY;
    return (
      finalCard.getBoundingClientRect().bottom -
      dock.getBoundingClientRect().top
    );
  });
  expect(pendingDockOverlap).toBeLessThanOrEqual(0);
  if ((page.viewportSize()?.width ?? 1000) > 760) {
    await expect(page.locator(".app-shell")).toHaveCSS(
      "padding-bottom",
      "32px",
    );
  }
});

test("keeps the view toggle aligned and animates results as one grid", async ({
  page,
}) => {
  const viewToggle = page.locator(".view-toggle");
  const gridButton = page.getByRole("button", { name: "Grid view" });
  const listButton = page.getByRole("button", { name: "List view" });
  const productGrid = page.locator(".product-grid");

  await expect(viewToggle).toHaveCSS("display", "grid");
  await expect(viewToggle).toHaveCSS("width", "76px");
  await expect(gridButton).toHaveCSS("transform", "none");
  await expect(gridButton).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(productGrid).toHaveCSS("animation-name", "product-grid-refresh");
  await expect(productGrid).toHaveCSS("animation-duration", "0.18s");
  await expect(page.locator(".product-card").first()).toHaveCSS(
    "animation-name",
    "none",
  );

  await listButton.click();
  await expect(listButton).toHaveClass(/active/);
  await expect(productGrid).toHaveClass(/product-grid-list/);
  await expect(listButton).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
});

test("shows desktop category arrows when categories overflow", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { manyCategories: true });
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.reload();

  const nextCategories = page.getByRole("button", { name: "More categories" });
  await expect(nextCategories).toBeVisible();
  await nextCategories.click();
  await expect
    .poll(() =>
      page.locator(".category-row").evaluate((element) => element.scrollLeft),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Previous categories" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sticker pack", exact: true }).click();
  await expect(page.getByText("Sticker pack fixture").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /View details for Moon Stand/i }),
  ).toHaveCount(0);
});

test("keeps the cart available when server validation rejects checkout", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { checkoutFails: true });
  await page.reload();
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  const viewCart = page.getByRole("button", { name: /View cart/i });
  if (await viewCart.isVisible()) {
    await viewCart.click();
  }
  await page.getByRole("button", { name: /Pay now/i }).click();
  await page.getByLabel(/Pickup name/i).fill("Customer");
  await page.getByRole("button", { name: /Create order & pay/i }).click();
  await expect(
    page.getByRole("dialog", { name: "Checkout unavailable" }),
  ).toBeVisible();
  await expect(page.getByText(/Stock changed/i)).toBeVisible();
  const storedCart = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("akiba-shelf-cart-v1:akiba-shelf") || "null",
    ),
  );
  expect(storedCart?.items).toHaveLength(1);
});

test("keeps one payment modal and shows the QR spinner while reserving", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  const viewCart = page.getByRole("button", { name: /View cart/i });
  if (await viewCart.isVisible()) await viewCart.click();
  await page.getByRole("button", { name: /Pay now/i }).click();
  const paymentDialog = page.getByRole("dialog", { name: "Scan to pay" });
  await paymentDialog.getByLabel(/Pickup name/i).fill("Customer");

  await page.route(
    "**/mock-supabase/functions/v1/create-order",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 650));
      await route.fallback();
    },
  );
  await paymentDialog
    .getByRole("button", { name: /Create order & pay/i })
    .click();

  await expect(
    paymentDialog.locator(".payment-qr-loading .spin-icon"),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Couldn’t reach checkout" }),
  ).toHaveCount(0);
  await expect(paymentDialog.getByAltText("Payment QR code")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Scan to pay" })).toHaveCount(
    1,
  );
});

test("shows an order-status error without calling an online customer offline", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  const viewCart = page.getByRole("button", { name: /View cart/i });
  if (await viewCart.isVisible()) await viewCart.click();
  await page.getByRole("button", { name: /Pay now/i }).click();
  await page.getByLabel(/Pickup name/i).fill("Customer");
  await page.getByRole("button", { name: /Create order & pay/i }).click();

  await expect(page.getByText("Couldn’t refresh order status")).toBeVisible();
  await expect(page.getByText(/offline —/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancel order" }),
  ).toBeEnabled();
});

test("queues checkout offline and reserves it safely after reconnect", async ({
  context,
  page,
}) => {
  await page.getByRole("button", { name: /Add Moon Stand to cart/i }).click();
  const viewCart = page.getByRole("button", { name: /View cart/i });
  if (await viewCart.isVisible()) await viewCart.click();
  await page.getByRole("button", { name: /Pay now/i }).click();
  await page.getByLabel(/Pickup name/i).fill("Customer");

  const createOrderPattern = "**/mock-supabase/functions/v1/create-order";
  await page.route(createOrderPattern, (route) =>
    route.abort("internetdisconnected"),
  );
  await context.setOffline(true);
  await page.getByRole("button", { name: /Create order & pay/i }).click();
  await expect(
    page.getByRole("dialog", { name: "Reconnect to checkout" }),
  ).toBeVisible();
  await expect(page.getByAltText("Payment QR code")).toHaveCount(0);
  const queuedCart = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("akiba-shelf-cart-v1:akiba-shelf") || "null",
    ),
  );
  expect(queuedCart?.items).toHaveLength(1);

  await page.unroute(createOrderPattern);
  await context.setOffline(false);
  await expect(page.getByRole("dialog", { name: "Scan to pay" })).toBeVisible();
  await expect(page.getByText("A100").first()).toBeVisible();
  const reservedCart = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("akiba-shelf-cart-v1:akiba-shelf") || "null",
    ),
  );
  expect(reservedCart?.items).toHaveLength(0);
});

test("isolates storefront state when navigating between shops", async ({
  page,
}) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { multiShop: true });
  await page.goto("./s/shop-a");
  await expect(page.getByText("Booth id-shop-a").first()).toBeVisible();
  await expect(page.getByText("id-shop-a Moon Stand").first()).toBeVisible();

  await page.goto("./s/shop-b");
  await expect(page).toHaveURL(/\/s\/shop-b$/);
  await expect(page.getByText("Booth id-shop-a")).toHaveCount(0);
  await expect(page.getByText("id-shop-a Moon Stand")).toHaveCount(0);
  await expect(page.getByText("Booth id-shop-b").first()).toBeVisible();
  await expect(page.getByText("id-shop-b Moon Stand").first()).toBeVisible();
});

test("offers native game portals when both gacha games are active", async ({
  page,
}, testInfo) => {
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { dualGacha: true });
  await page.goto("./s/akiba-shelf/play");

  const heading = page.getByRole("heading", { name: "Choose your universe" });
  if (testInfo.project.name === "phone-chromium") {
    await expect(heading).toBeHidden();
    await expect(
      page.getByText("Wish simulator", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Warp simulator", { exact: true }),
    ).toBeVisible();
  } else await expect(heading).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Enter: Wish simulator" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Enter: Warp simulator" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save offline" }),
  ).toBeVisible();
});

test("keeps the phone game selector full-screen during launch", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-chromium");
  await page.unrouteAll({ behavior: "wait" });
  await mockSupabase(page, { catalogLocale: "vi", dualGacha: true });
  await page.goto("./s/akiba-shelf/play");

  await expect(
    page.getByRole("heading", { name: "Chọn vũ trụ của bạn" }),
  ).toBeHidden();
  await expect(page.getByText("Cầu Nguyện", { exact: true })).toBeVisible();
  await expect(page.getByText("Bước Nhảy", { exact: true })).toBeVisible();
  const hiddenDetails = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        ".gacha-portal-meta, .gacha-portal-prizes, .gacha-portal-enter",
      ),
    ).every((element) => getComputedStyle(element).display === "none"),
  );
  expect(hiddenDetails).toBe(true);
  await expect(
    page.getByRole("link", { name: "Vào game: Cầu Nguyện" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll(".gacha-game-portal")).every(
          (portal) =>
            portal
              .getAnimations()
              .filter(
                (animation): animation is CSSAnimation =>
                  animation instanceof CSSAnimation &&
                  animation.animationName.includes(
                    "gacha-mobile-portal-arrive",
                  ),
              )
              .every((animation) => animation.playState === "finished"),
        ),
      ),
    )
    .toBe(true);
  const layout = await page.evaluate(() => ({
    cardRects: Array.from(
      document.querySelectorAll<HTMLElement>(".gacha-game-portal"),
    ).map((card) => {
      const rect = card.getBoundingClientRect();
      return { bottom: rect.bottom, height: rect.height, top: rect.top };
    }),
    pageHeight: document.documentElement.scrollHeight,
    pageWidth: document.documentElement.scrollWidth,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.pageHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.cardRects).toHaveLength(2);
  expect(layout.cardRects[0].height).toBeGreaterThan(
    layout.viewportHeight * 0.56,
  );
  expect(layout.cardRects[0].height).toBeLessThan(layout.viewportHeight * 0.6);
  expect(layout.cardRects[1].height).toBeGreaterThan(
    layout.viewportHeight * 0.56,
  );
  expect(layout.cardRects[1].height).toBeLessThan(layout.viewportHeight * 0.6);
  expect(layout.cardRects[0].bottom).toBeGreaterThan(layout.cardRects[1].top);

  await page.getByRole("link", { name: "Vào game: Cầu Nguyện" }).click();
  await page.waitForTimeout(120);
  const launchWidth = await page
    .locator(".gacha-game-portal.is-genshin")
    .evaluate((portal) => portal.getBoundingClientRect().width);
  expect(launchWidth).toBeGreaterThan(layout.viewportWidth * 0.98);
  await expect(page).toHaveURL(/\?game=genshin$/);
});
