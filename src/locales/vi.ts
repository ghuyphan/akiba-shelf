import { translations } from "../lib/catalogI18n";
import type { AppCopy } from "./types";

export const vi: AppCopy = {
  common: { backHome: "Về trang chủ", signIn: "Đăng nhập", signOut: "Đăng xuất", cancel: "Hủy", save: "Lưu", retry: "Thử lại", close: "Đóng", loading: "Đang tải…", english: "English", vietnamese: "Tiếng Việt" },
  brand: { descriptor: "Trang bán merch & đơn hàng trực tiếp", description: "Nền tảng cửa hàng thân thiện với cảm ứng và quản lý đơn trực tiếp dành cho các gian hàng nghệ sĩ độc lập.", tagline: "Bán hàng trơn tru ngay cả lúc sự kiện đông nhất." },
  navigation: { language: "Ngôn ngữ", selectLanguage: "Chọn ngôn ngữ nền tảng", yourShops: "Các gian hàng của bạn" },
  home: { badge: "Đã hỗ trợ nhiều gian hàng", title: "Tạo gian hàng merch trong mơ", getStarted: "Bắt đầu", demo: "Xem gian hàng mẫu", storefrontTitle: "Cửa hàng tối ưu cho cảm ứng", storefrontBody: "Khách hàng có thể xem sản phẩm, đọc chi tiết và tạo giỏ hàng an toàn theo tồn kho ngay trên điện thoại.", ordersTitle: "Danh sách đơn trực tiếp", ordersBody: "Xác nhận thanh toán, quản lý tồn kho và phối hợp staff xử lý đơn theo thời gian thực.", designerTitle: "Thiết kế cửa hàng", designerBody: "Tùy chỉnh bố cục, màu sắc, ngôn ngữ và bo góc ngay trên bản xem trước.", rights: "Đã đăng ký bản quyền." },
  auth: { email: "Địa chỉ email", password: "Mật khẩu", enterPassword: "Nhập mật khẩu", forgotPassword: "Quên mật khẩu?", createAccount: "Tạo tài khoản", staffSignIn: "Đăng nhập dành cho staff", adminContinue: "Dùng tài khoản admin để tiếp tục.", openAdmin: "Mở trang admin", authorisedOnly: "Chỉ staff được cấp quyền mới có thể truy cập khu vực này.", showPassword: (label) => `Hiện ${label.toLocaleLowerCase("vi-VN")}`, hidePassword: (label) => `Ẩn ${label.toLocaleLowerCase("vi-VN")}`, checkingAccess: "Đang kiểm tra quyền truy cập", loadingWorkspace: "Đang tải khu vực làm việc…" },
  dashboard: { eyebrow: "Tài khoản của bạn", title: "Các gian hàng của bạn", description: "Chọn gian hàng để quản lý đơn, sản phẩm và giao diện." },
  shopCreation: { title: "Tạo gian hàng" },
  admin: { title: (shop) => `Admin ${shop} · Matsuri`, orders: "Đơn hàng", products: "Sản phẩm", design: "Trang cửa hàng", settings: "Cài đặt", team: "Đội ngũ" },
  orders: { title: "Đơn hàng", pending: "Đang chờ", confirmed: "Đã xác nhận", cancelled: "Đã hủy", expired: "Đã hết hạn" },
  products: { title: "Sản phẩm", add: "Thêm sản phẩm" }, staff: { title: "Đội ngũ & staff", owner: "Chủ cửa hàng", admin: "Admin", staff: "Staff" }, settings: { title: "Cài đặt gian hàng" }, payments: { title: "Cài đặt thanh toán" },
  designer: { title: "Trình thiết kế cửa hàng", storefrontLanguage: "Ngôn ngữ cửa hàng", storefrontLanguageHint: "Ngôn ngữ hiển thị cho khách hàng." }, validation: { required: "Vui lòng điền trường này." },
  errors: { generic: "Đã xảy ra lỗi. Hãy kiểm tra kết nối và thử lại.", signOut: "Không thể đăng xuất", supabaseTitle: "Chưa cấu hình Supabase", supabaseMessage: "Thêm URL và khóa công khai của Supabase trước khi đăng nhập." },
  loading: { preparing: (brand) => `Đang chuẩn bị ${brand}`, ready: "Đang chuẩn bị mọi thứ…" }, accessibility: { loading: (brand) => `Đang tải ${brand}`, backHome: "Về trang chủ" }, catalog: translations.vi,
};

