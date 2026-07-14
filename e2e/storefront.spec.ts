import { expect, test } from "@playwright/test";
import { mockSupabase } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSupabase(page);
  await page.goto("./s/akiba-shelf");
});

test("uses a familiar featured icon and centers the collection badge", async ({
  page,
}) => {
  await expect(page.locator(".featured-banner-kicker svg")).toHaveClass(
    /lucide-star/,
  );
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
  const sampledColors = await cardQr.evaluate(
    (image: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<string>();
      for (let index = 0; index < pixels.length; index += 160) {
        if (pixels[index] > 245 && pixels[index + 1] > 245 && pixels[index + 2] > 245) continue;
        colors.add(`${pixels[index]}-${pixels[index + 1]}-${pixels[index + 2]}`);
      }
      return colors.size;
    },
  );
  expect(sampledColors).toBeGreaterThan(10);
  await instagramCard.click();

  const qrDialog = page.getByRole("dialog", { name: "Instagram Link" });
  await expect(qrDialog).toBeVisible();
  await expect(qrDialog.locator(".social-qr-zoom-icon")).toContainText("Instagram");
  await expect(qrDialog.getByAltText("Instagram QR code")).toBeVisible();
  const socialHandle = qrDialog.getByText("@fixture.artist");
  await expect(socialHandle).toBeVisible();
  await expect(socialHandle).toHaveCSS("color", "rgb(225, 48, 108)");
  await expect(
    qrDialog.getByRole("link", { name: /Open Profile Link/i }),
  ).toHaveAttribute("href", "https://instagram.com/fixture.artist");
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
  await page
    .getByRole("button", { name: /Thông tin gian hàng/i })
    .click();
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

  await page.getByPlaceholder("Search items...").fill("Product 30");
  await expect(
    page.getByRole("button", { name: "View details for Product 30" }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(1);
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

test("loads payment settings before checkout and presents API failure", async ({
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
  await expect(page.getByText(/Failed to submit order/i)).toBeVisible();
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
