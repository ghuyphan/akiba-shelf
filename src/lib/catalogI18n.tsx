import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { CatalogLocale } from "../types/catalog";

export const translations = {
  en: {
    all: "All", officialShop: "Official Shop", boothInfo: "Booth info", boothInfoHint: "Hours, location & socials",
    searchItems: "Search items...", searchCatalog: "Search catalog", clearSearch: "Clear search", recommended: "Recommended",
    priceLow: "Price ↑", priceHigh: "Price ↓", mostStock: "Most stock", name: "Name", gridView: "Grid view", listView: "List view", previousCategories: "Previous categories", nextCategories: "More categories",
    featuredDrop: "Featured drop", limitedCollection: "Limited collection", specialRelease: "A special booth release available while stock lasts.",
    inStock: "In stock", onlyLeft: (count: number) => `Only ${count} left`, addToCart: "Add to cart", swipeToBrowse: "Swipe to browse",
    featured: "Featured", soldOut: "Sold out", available: (count: number) => `${count} available`, unavailable: "Unavailable",
    viewDetails: (name: string) => `View details for ${name}`, addProduct: (name: string) => `Add ${name} to cart`, productSoldOut: (name: string) => `${name} is sold out`,
    cart: "Cart", emptyCart: "Your cart is empty", emptyCartHint: "Tap merch cards to add items to the cart.", viewCart: "View cart", clearAll: "Clear all",
    totalPrice: "Total price", payNow: "Pay now", itemDetails: "Item details", featuredItem: "Featured item", item: "Item", price: "Price",
    noDescription: "No additional description is available for this item.", stockNote: "Your cart will always respect the latest available stock.", currentlyUnavailable: "Currently unavailable",
    nothingCategory: "Nothing in this category", noMerch: "No merch is live yet", switchCatalog: "Switch back to the full catalog to keep the line moving.", addInAdmin: "Add active products in admin before opening the booth catalog.", catalogEmpty: "Catalog empty", showAll: "Show all items",
    paymentComplete: "Payment complete", allSet: "You’re all set!", reservedPickup: "Staff confirmed your payment and the items are now reserved for pickup.", totalPaid: "Total paid", backShop: "Back to the shop",
    confirmOrder: "Confirm your order", lastCheck: "One last check", reviewCart: "Review your cart and add the name staff should call at pickup.", total: "Total", pickupName: "Pickup name", pickupPlaceholder: "e.g. Huy or Alice", pickupHint: "Use a name you can easily hear at the booth.", secureCheck: "Price and stock are checked securely before your order is created.", keepShopping: "Keep shopping", checking: "Checking…", createPay: "Create order & pay",
    scanPay: "Scan to pay", exactNote: "Use the exact transfer note shown below.", waitingConfirmation: "Waiting for staff confirmation", orderCode: "Order code", transferTo: "Transfer to", accountName: "Account name", accountNumber: "Account number", bank: "Bank", transferNote: "Transfer note", orderSummary: "Order summary",
    retryOrder: "Retry safely", reconnectingOrder: "Reconnecting — your order is safe", hidePayment: "Hide payment details", pendingOrder: "Pending order", viewPayment: "View payment", pendingOrderHint: "Your order stays active if you close this window.", orderCancelled: "Order cancelled", cancelledPaymentNote: "Staff cancelled this order. Please do not send payment for it.",
    reservedFor: (time: string) => `Reserved for ${time}`, reservedWhilePaying: "Your items are reserved while you complete payment.", cancelOrder: "Cancel order", cancelling: "Cancelling…", qrUnavailable: "Payment QR is unavailable. Please ask booth staff for help.",
  },
  vi: {
    all: "Tất cả", officialShop: "Gian hàng chính thức", boothInfo: "Thông tin gian hàng", boothInfoHint: "Giờ mở cửa, vị trí & mạng xã hội",
    searchItems: "Tìm sản phẩm...", searchCatalog: "Tìm trong cửa hàng", clearSearch: "Xóa tìm kiếm", recommended: "Đề xuất",
    priceLow: "Giá tăng dần", priceHigh: "Giá giảm dần", mostStock: "Còn nhiều nhất", name: "Tên", gridView: "Dạng lưới", listView: "Dạng danh sách", previousCategories: "Danh mục trước", nextCategories: "Xem thêm danh mục",
    featuredDrop: "Sản phẩm nổi bật", limitedCollection: "Bộ sưu tập giới hạn", specialRelease: "Phiên bản đặc biệt tại gian hàng, chỉ bán khi còn hàng.",
    inStock: "Còn hàng", onlyLeft: (count: number) => `Chỉ còn ${count}`, addToCart: "Thêm vào giỏ", swipeToBrowse: "Vuốt để xem",
    featured: "Nổi bật", soldOut: "Hết hàng", available: (count: number) => `Còn ${count} sản phẩm`, unavailable: "Không khả dụng",
    viewDetails: (name: string) => `Xem chi tiết ${name}`, addProduct: (name: string) => `Thêm ${name} vào giỏ`, productSoldOut: (name: string) => `${name} đã hết hàng`,
    cart: "Giỏ hàng", emptyCart: "Giỏ hàng đang trống", emptyCartHint: "Chạm vào sản phẩm để thêm vào giỏ.", viewCart: "Xem giỏ hàng", clearAll: "Xóa tất cả",
    totalPrice: "Tổng tiền", payNow: "Thanh toán", itemDetails: "Chi tiết sản phẩm", featuredItem: "Sản phẩm nổi bật", item: "Mã", price: "Giá",
    noDescription: "Sản phẩm này chưa có mô tả chi tiết.", stockNote: "Giỏ hàng luôn được đối chiếu với số lượng tồn kho mới nhất.", currentlyUnavailable: "Hiện không khả dụng",
    nothingCategory: "Không có sản phẩm trong danh mục", noMerch: "Chưa có sản phẩm được mở bán", switchCatalog: "Quay lại toàn bộ sản phẩm để tiếp tục mua sắm.", addInAdmin: "Hãy thêm sản phẩm đang hoạt động trong trang quản trị trước khi mở gian hàng.", catalogEmpty: "Gian hàng trống", showAll: "Xem tất cả",
    paymentComplete: "Thanh toán hoàn tất", allSet: "Xong rồi!", reservedPickup: "Staff đã xác nhận thanh toán và giữ sản phẩm để bạn đến nhận.", totalPaid: "Đã thanh toán", backShop: "Quay lại cửa hàng",
    confirmOrder: "Xác nhận đơn hàng", lastCheck: "Kiểm tra lần cuối", reviewCart: "Kiểm tra giỏ hàng và nhập tên để staff gọi khi nhận hàng.", total: "Tổng cộng", pickupName: "Tên nhận hàng", pickupPlaceholder: "Ví dụ: Huy hoặc Alice", pickupHint: "Dùng tên bạn có thể dễ dàng nghe thấy tại gian hàng.", secureCheck: "Giá và tồn kho được kiểm tra an toàn trước khi tạo đơn.", keepShopping: "Tiếp tục mua", checking: "Đang kiểm tra…", createPay: "Tạo đơn & thanh toán",
    scanPay: "Quét mã để thanh toán", exactNote: "Vui lòng dùng đúng nội dung chuyển khoản bên dưới.", waitingConfirmation: "Đang chờ staff xác nhận", orderCode: "Mã đơn", transferTo: "Chuyển khoản đến", accountName: "Tên tài khoản", accountNumber: "Số tài khoản", bank: "Ngân hàng", transferNote: "Nội dung chuyển khoản", orderSummary: "Chi tiết đơn hàng",
    retryOrder: "Thử lại an toàn", reconnectingOrder: "Đang kết nối lại — đơn hàng vẫn an toàn", hidePayment: "Ẩn thông tin thanh toán", pendingOrder: "Đơn đang chờ", viewPayment: "Xem thanh toán", pendingOrderHint: "Đơn hàng vẫn hoạt động khi bạn đóng cửa sổ này.", orderCancelled: "Đơn đã bị hủy", cancelledPaymentNote: "Staff đã hủy đơn này. Vui lòng không chuyển khoản cho đơn.",
    reservedFor: (time: string) => `Giữ hàng trong ${time}`, reservedWhilePaying: "Sản phẩm được giữ trong lúc bạn hoàn tất thanh toán.", cancelOrder: "Hủy đơn hàng", cancelling: "Đang hủy…", qrUnavailable: "Không thể tải mã thanh toán. Vui lòng nhờ staff tại gian hàng hỗ trợ.",
  },
} as const;

export type CatalogCopy = (typeof translations)["en"] | (typeof translations)["vi"];
const CatalogLocaleContext = createContext<CatalogCopy>(translations.en);

export function CatalogLocaleProvider({ locale, children }: { locale: CatalogLocale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = "en"; };
  }, [locale]);
  return <CatalogLocaleContext.Provider value={translations[locale]}>{children}</CatalogLocaleContext.Provider>;
}

export function useCatalogCopy() {
  return useContext(CatalogLocaleContext);
}
