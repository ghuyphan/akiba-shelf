import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PlatformLocale = "en" | "vi";

const STORAGE_KEY = "matsuri-platform-locale";

const vi: Record<string, string> = {
  "Artist booth platform": "Nền tảng gian hàng artist",
  "Sign in": "Đăng nhập",
  "Sign out": "Đăng xuất",
  "Back to home": "Về trang chủ",
  "Back to dashboard": "Về bảng điều khiển",
  "Create account": "Tạo tài khoản",
  "Reset password": "Đặt lại mật khẩu",
  "Set password": "Đặt mật khẩu",
  "Finishing sign in": "Đang hoàn tất đăng nhập",
  "Your shops": "Gian hàng của bạn",
  "Create a shop": "Tạo gian hàng",
  "Admin workspace": "Không gian quản trị",
  "Install Matsuri staff app": "Cài đặt ứng dụng staff Matsuri",
  "Keep Matsuri close": "Luôn có Matsuri bên bạn",
  "Install the staff app for quicker access to shops and orders.":
    "Cài ứng dụng staff để truy cập gian hàng và đơn hàng nhanh hơn.",
  "Tap Share, then Add to Home Screen.":
    "Chạm Chia sẻ, sau đó chọn Thêm vào Màn hình chính.",
  "How to install": "Cách cài đặt",
  "Opening…": "Đang mở…",
  Install: "Cài đặt",
  "Dismiss install suggestion": "Ẩn gợi ý cài đặt",
  "Product name is required.": "Tên sản phẩm là bắt buộc.",
  "Item code is required.": "Mã sản phẩm là bắt buộc.",
  "Category is required.": "Danh mục là bắt buộc.",
  "Price must be a positive number.": "Giá phải là số không âm.",
  "Sale price must be lower than the regular price.":
    "Giá khuyến mãi phải thấp hơn giá thường.",
  "Quantity must be a whole number.": "Số lượng phải là số nguyên không âm.",
  "At least one image URL is required.": "Cần ít nhất một URL hình ảnh.",
  "We could not verify your account access. Check your connection and try again.":
    "Không thể xác minh quyền truy cập tài khoản. Hãy kiểm tra kết nối và thử lại.",
  "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.":
    "Supabase chưa được cấu hình. Hãy đặt VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.",
  "Product not found.": "Không tìm thấy sản phẩm.",
  "Invitation response was invalid.": "Phản hồi lời mời không hợp lệ.",
  "Use a JPEG, PNG, or WebP image.": "Hãy dùng ảnh JPEG, PNG hoặc WebP.",
  "Images must be between 1 byte and 10 MB.":
    "Ảnh phải có dung lượng từ 1 byte đến 10 MB.",
  "The image has invalid dimensions.": "Kích thước ảnh không hợp lệ.",
  "Image dimensions cannot exceed 8000 × 8000.":
    "Kích thước ảnh không được vượt quá 8000 × 8000.",
  "The image could not be decoded.": "Không thể giải mã ảnh.",
  "This browser cannot process the image.":
    "Trình duyệt này không thể xử lý ảnh.",
  "This browser cannot encode WebP images.":
    "Trình duyệt này không thể mã hóa ảnh WebP.",
  "The image could not be encoded.": "Không thể mã hóa ảnh.",
  "Product image variants must be WebP files.":
    "Các phiên bản ảnh sản phẩm phải là tệp WebP.",
  "The image could not be read.": "Không thể đọc ảnh.",
  "Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY.":
    "Thông báo đẩy chưa được cấu hình. Hãy đặt VITE_VAPID_PUBLIC_KEY.",
  "Select a shop before enabling notifications.":
    "Hãy chọn gian hàng trước khi bật thông báo.",
  "Supabase is not configured.": "Supabase chưa được cấu hình.",
  "Notification permission was not granted.":
    "Quyền gửi thông báo chưa được cấp.",
  "Sign in before enabling notifications.":
    "Hãy đăng nhập trước khi bật thông báo.",
  English: "Tiếng Anh",
  Vietnamese: "Tiếng Việt",
  Language: "Ngôn ngữ",
  "More actions": "Thêm thao tác",
  "Made for artists, not spreadsheets": "Dành cho artist, không phải bảng tính",
  "Your art. Your booth.": "Tác phẩm của bạn. Gian hàng của bạn.",
  "Your little corner of the con.": "Góc nhỏ của bạn tại hội chợ.",
  "Matsuri turns your merch table into a friendly digital storefront, with live orders and accurate stock while you focus on meeting fans.":
    "Matsuri biến bàn merch của bạn thành một cửa hàng số thân thiện, với đơn hàng trực tiếp và tồn kho chính xác để bạn tập trung gặp gỡ fan.",
  "Open your booth": "Mở gian hàng",
  "See the demo booth": "Xem gian hàng demo",
  "No generic marketplace vibe.": "Không mang cảm giác chợ trực tuyến đại trà.",
  "Your colors, your sections, your merch.":
    "Màu sắc, bố cục và merch đều là của bạn.",
  "Artist Alley · Table B12": "Khu Artist Alley · Bàn B12",
  "live today!": "đang mở hôm nay!",
  "New festival drop": "Bộ sưu tập mới tại lễ hội",
  "tiny things, big feelings": "những món nhỏ, cảm xúc lớn",
  "ACRYLIC STAND": "STANDEE ACRYLIC",
  "STICKER SHEET": "BỘ STICKER",
  "Your order": "Đơn hàng của bạn",
  "Qty {{count}}": "SL {{count}}",
  "Decorative checkout QR code": "Mã QR thanh toán minh họa",
  "DRAW MORE": "VẼ THÊM",
  "Who Matsuri helps": "Matsuri hỗ trợ những ai",
  "For fans": "Cho fan",
  "Browse and order from their phone": "Xem và đặt hàng bằng điện thoại",
  "For artists": "Cho artist",
  "Keep stock and payments together": "Quản lý tồn kho và thanh toán cùng nơi",
  "For helpers": "Cho cộng sự",
  "Share one clear live order queue": "Cùng theo dõi một hàng đợi đơn rõ ràng",
  "For your brand": "Cho thương hiệu của bạn",
  "Make the storefront feel like you": "Tạo cửa hàng mang đúng cá tính của bạn",
  "How the booth flows": "Quy trình tại gian hàng",
  "Less table chaos. More time talking about your art.":
    "Bớt bối rối tại bàn. Thêm thời gian trò chuyện về tác phẩm.",
  "A simple three-step flow that feels natural for customers and helpers.":
    "Quy trình ba bước đơn giản, tự nhiên cho cả khách hàng và cộng sự.",
  "Fans browse": "fan xem sản phẩm",
  "They scan your booth QR, explore your collections, and add merch without blocking the table.":
    "Họ quét QR của gian hàng, khám phá các bộ sưu tập và thêm merch mà không làm ùn bàn.",
  "They order and pay": "Họ đặt hàng và thanh toán",
  "Matsuri reserves the items, calculates the total, and shows your VietQR payment details.":
    "Matsuri giữ sản phẩm, tính tổng tiền và hiển thị thông tin thanh toán VietQR.",
  "You hand it over": "Bạn giao sản phẩm",
  "The order appears live for your team, ready to confirm, pack, and give to the customer.":
    "Đơn hàng xuất hiện trực tiếp cho đội ngũ để xác nhận, đóng gói và giao cho khách.",
  "Your booth toolkit": "Bộ công cụ gian hàng",
  "Designed like an artist’s workspace, not an enterprise dashboard.":
    "Được thiết kế như không gian làm việc của artist, không phải bảng điều khiển doanh nghiệp.",
  "Use a live storefront designer, keep a simple order queue, and invite helpers without giving everyone full control.":
    "Thiết kế cửa hàng trực tiếp, quản lý hàng đợi đơn giản và mời cộng sự mà không cần trao toàn quyền.",
  "Arrange banners, collections, and booth information":
    "Sắp xếp banner, bộ sưu tập và thông tin gian hàng",
  "Use your own colors, logo, and visual style":
    "Dùng màu sắc, logo và phong cách riêng",
  "See pending, paid, and completed orders in one place":
    "Xem đơn chờ, đã thanh toán và hoàn tất tại một nơi",
  "Give helpers only the access they need": "Chỉ cấp cho cộng sự quyền họ cần",
  "Matsuri workspace preview": "Bản xem trước không gian Matsuri",
  "Live orders": "Đơn hàng trực tiếp",
  "3 fans waiting": "3 fan đang chờ",
  Palette: "Bảng màu",
  "Match your art": "Đồng điệu với tác phẩm",
  "Storefront sections": "Các phần cửa hàng",
  "Featured drop · Products · About the artist · Booth info":
    "Sản phẩm nổi bật · Sản phẩm · Về artist · Thông tin gian hàng",
  "Ready for your next event?": "Sẵn sàng cho sự kiện tiếp theo?",
  "Make a booth your fans will remember.":
    "Tạo một gian hàng khiến fan nhớ mãi.",
  "Create your shop": "Tạo gian hàng",
  "Made for independent artists, conventions, and pop-up booths.":
    "Dành cho artist độc lập, hội chợ và gian hàng pop-up.",
  "Welcome back": "Chào mừng bạn trở lại",
  "Sign in to manage your shops.": "Đăng nhập để quản lý các gian hàng.",
  "Signing in…": "Đang đăng nhập…",
  "Secure access to your shops and staff workspaces.":
    "Truy cập an toàn vào gian hàng và không gian làm việc của staff.",
  "Create your account": "Tạo tài khoản",
  "Start a storefront or accept a staff invitation.":
    "Bắt đầu một cửa hàng hoặc chấp nhận lời mời staff.",
  "Creating account…": "Đang tạo tài khoản…",
  "Email confirmation protects every new account.":
    "Xác nhận email giúp bảo vệ mọi tài khoản mới.",
  "Reset your password": "Đặt lại mật khẩu",
  "We’ll email a secure recovery link.":
    "Chúng tôi sẽ gửi liên kết khôi phục an toàn qua email.",
  "Send recovery link": "Gửi liên kết khôi phục",
  "Sending link…": "Đang gửi liên kết…",
  "Recovery never reveals whether an account exists.":
    "Quá trình khôi phục không tiết lộ tài khoản có tồn tại hay không.",
  "Choose a stronger password": "Chọn mật khẩu mạnh hơn",
  "Check your password": "Kiểm tra mật khẩu",
  "A new secure link is on its way.": "Một liên kết bảo mật mới đang được gửi.",
  "Email sent": "Đã gửi email",
  "Check your email": "Kiểm tra email",
  "We sent a confirmation link to {{email}}.":
    "Chúng tôi đã gửi liên kết xác nhận đến {{email}}.",
  "If {{email}} can be recovered, a secure link is on its way.":
    "Nếu có thể khôi phục {{email}}, một liên kết bảo mật đang được gửi.",
  "Sending…": "Đang gửi…",
  "Send again in {{seconds}}s": "Gửi lại sau {{seconds}} giây",
  "Send another email": "Gửi email khác",
  "Return to sign in": "Quay lại đăng nhập",
  "Sign up with Google": "Đăng ký bằng Google",
  "Continue with Google": "Tiếp tục với Google",
  "Opening Google…": "Đang mở Google…",
  or: "hoặc",
  "Email address": "Địa chỉ email",
  Password: "Mật khẩu",
  "Choose a strong password": "Chọn mật khẩu mạnh",
  "Enter your password": "Nhập mật khẩu",
  "Confirm password": "Xác nhận mật khẩu",
  "Repeat your password": "Nhập lại mật khẩu",
  "Forgot password?": "Quên mật khẩu?",
  "Secure links are short-lived and can only be used through your email.":
    "Liên kết bảo mật chỉ có hiệu lực trong thời gian ngắn và chỉ dùng được qua email của bạn.",
  "Show {{label}}": "Hiện {{label}}",
  "Hide {{label}}": "Ẩn {{label}}",
  "Use 10+ characters with uppercase, lowercase, and a number.":
    "Dùng ít nhất 10 ký tự gồm chữ hoa, chữ thường và số.",
  "Both passwords must match.": "Hai mật khẩu phải trùng khớp.",
  "Please wait a moment": "Vui lòng chờ một chút",
  "Too many emails were requested. Wait a few minutes before trying again.":
    "Đã yêu cầu quá nhiều email. Vui lòng chờ vài phút rồi thử lại.",
  "Too many attempts were made. Wait a few minutes before trying again.":
    "Đã thử quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.",
  "Sign in failed": "Đăng nhập thất bại",
  "The email address or password is incorrect.":
    "Địa chỉ email hoặc mật khẩu không đúng.",
  "Confirm your email": "Xác nhận email",
  "Open the confirmation email before signing in.":
    "Mở email xác nhận trước khi đăng nhập.",
  "Use at least 10 characters with an uppercase letter, a lowercase letter, and a number.":
    "Dùng ít nhất 10 ký tự gồm một chữ hoa, một chữ thường và một chữ số.",
  "Link expired": "Liên kết đã hết hạn",
  "This secure link is invalid or expired. Request a new one.":
    "Liên kết bảo mật không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.",
  "We could not sign you in. Check your details and try again.":
    "Không thể đăng nhập. Hãy kiểm tra thông tin và thử lại.",
  "Could not create account": "Không thể tạo tài khoản",
  "We could not create the account. Please try again.":
    "Không thể tạo tài khoản. Vui lòng thử lại.",
  "Could not send recovery email": "Không thể gửi email khôi phục",
  "We could not send the recovery email. Please try again later.":
    "Không thể gửi email khôi phục. Vui lòng thử lại sau.",
  "Could not finish sign in": "Không thể hoàn tất đăng nhập",
  "Could not set password": "Không thể đặt mật khẩu",
  "We could not save the password. Request a new secure link.":
    "Không thể lưu mật khẩu. Hãy yêu cầu liên kết bảo mật mới.",
  "Confirming your secure link…": "Đang xác nhận liên kết bảo mật…",
  "Back to sign in": "Về trang đăng nhập",
  "Expired or used secure links cannot be reopened.":
    "Không thể mở lại liên kết bảo mật đã hết hạn hoặc đã sử dụng.",
  "Your password is saved, but shop access could not be completed. You can retry safely.":
    "Mật khẩu đã được lưu nhưng chưa thể hoàn tất quyền truy cập gian hàng. Bạn có thể thử lại an toàn.",
  "Invitation not completed": "Chưa hoàn tất lời mời",
  "Shop access was accepted, but account cleanup could not finish. Retry to complete safely.":
    "Quyền truy cập gian hàng đã được chấp nhận nhưng chưa thể hoàn tất tài khoản. Hãy thử lại an toàn.",
  "Invitation cleanup incomplete": "Chưa hoàn tất lời mời",
  "Your password was saved, but we could not open your account. Retry safely without changing it again.":
    "Mật khẩu đã được lưu nhưng không thể mở tài khoản. Hãy thử lại an toàn mà không cần đổi mật khẩu lần nữa.",
  "Could not finish recovery": "Không thể hoàn tất khôi phục",
  "Checking password link": "Đang kiểm tra liên kết mật khẩu",
  "Verifying this secure session…": "Đang xác minh phiên bảo mật…",
  "Password link unavailable": "Liên kết mật khẩu không khả dụng",
  "This password link is invalid or has expired.":
    "Liên kết mật khẩu không hợp lệ hoặc đã hết hạn.",
  "Request another recovery email": "Yêu cầu email khôi phục khác",
  "Password links are short-lived and protected by your email session.":
    "Liên kết mật khẩu chỉ có hiệu lực trong thời gian ngắn và được bảo vệ bởi phiên email của bạn.",
  "Finish joining the shop": "Hoàn tất tham gia gian hàng",
  "Your password is saved. Retry the invitation without changing it again.":
    "Mật khẩu đã được lưu. Hãy thử lại lời mời mà không cần đổi mật khẩu lần nữa.",
  "Retry invitation": "Thử lại lời mời",
  "Your saved password will not be changed when you retry.":
    "Mật khẩu đã lưu sẽ không bị thay đổi khi bạn thử lại.",
  "Password updated": "Đã cập nhật mật khẩu",
  "Your new password is saved. Retry opening your account without changing it again.":
    "Mật khẩu mới đã được lưu. Hãy thử mở lại tài khoản mà không cần đổi mật khẩu lần nữa.",
  "Opening account…": "Đang mở tài khoản…",
  "Open my account": "Mở tài khoản của tôi",
  "Set your password": "Đặt mật khẩu",
  "Choose a secure password to finish account setup.":
    "Chọn mật khẩu an toàn để hoàn tất thiết lập tài khoản.",
  "New password": "Mật khẩu mới",
  "Saving…": "Đang lưu…",
  "Save password": "Lưu mật khẩu",
  "Your password is encrypted and never shown to shop staff.":
    "Mật khẩu được mã hóa và không bao giờ hiển thị cho staff gian hàng.",
  "Staff sign in": "Đăng nhập staff",
  "Use your admin account to continue.": "Dùng tài khoản quản trị để tiếp tục.",
  "Supabase is not configured": "Chưa cấu hình Supabase",
  "Add the Supabase URL and public key before signing in.":
    "Thêm URL Supabase và khóa công khai trước khi đăng nhập.",
  "Open admin": "Mở trang quản trị",
  "Only authorised staff can access this workspace.":
    "Chỉ staff được cấp quyền mới có thể truy cập không gian này.",
  "Checking your access": "Đang kiểm tra quyền truy cập",
  "Loading your workspace…": "Đang tải không gian làm việc…",
  "Staff access inactive": "Quyền staff đang tạm ngưng",
  "Access check failed": "Kiểm tra quyền truy cập thất bại",
  "Staff access required": "Cần quyền staff",
  "An owner must reactivate your staff membership.":
    "Chủ gian hàng cần kích hoạt lại quyền staff của bạn.",
  "This signed-in account is not an authorized staff member.":
    "Tài khoản đang đăng nhập chưa được cấp quyền staff.",
  "Signed in as": "Đang đăng nhập bằng",
  "Ask an owner to grant this account access.":
    "Hãy nhờ chủ gian hàng cấp quyền cho tài khoản này.",
  "Check access again": "Kiểm tra lại quyền truy cập",
  "Shop name is required.": "Cần nhập tên gian hàng.",
  "Shop name must be between 1 and 100 characters.":
    "Tên gian hàng phải dài từ 1 đến 100 ký tự.",
  "Could not create shop": "Không thể tạo gian hàng",
  "Slug must be between 2 and 63 characters, contain only lowercase letters, numbers, and single dashes, and cannot start or end with a dash.":
    "Slug phải dài từ 2 đến 63 ký tự, chỉ gồm chữ thường, số và dấu gạch ngang đơn, đồng thời không được bắt đầu hoặc kết thúc bằng dấu gạch ngang.",
  "Could not create shop.": "Không thể tạo gian hàng.",
  "Creation failed": "Tạo gian hàng thất bại",
  "Back to shops dashboard": "Về bảng điều khiển gian hàng",
  "Back to homepage": "Về trang chủ",
  "Set up your shop name and storefront URL slug to get started.":
    "Thiết lập tên gian hàng và slug URL cửa hàng để bắt đầu.",
  "Shop name": "Tên gian hàng",
  "A friendly name for your merch booth.":
    "Tên thân thiện cho gian hàng merch của bạn.",
  "My Artist Booth": "Gian hàng artist của tôi",
  "Storefront URL slug": "Slug URL cửa hàng",
  "Only lowercase letters, numbers, and dashes. No spaces.":
    "Chỉ dùng chữ thường, số và dấu gạch ngang. Không dùng khoảng trắng.",
  "Preview URL:": "URL xem trước:",
  "Creating shop…": "Đang tạo gian hàng…",
  "Create shop": "Tạo gian hàng",
  "Check your connection and try again.": "Kiểm tra kết nối rồi thử lại.",
  "Could not sign out": "Không thể đăng xuất",
  "Could not save shop details": "Không thể lưu thông tin gian hàng",
  "Your Account": "Tài khoản của bạn",
  "Select a shop workspace to manage orders, products, and designs, or preview its public storefront.":
    "Chọn không gian gian hàng để quản lý đơn, sản phẩm và thiết kế, hoặc xem trước cửa hàng công khai.",
  "Edit shop details": "Sửa thông tin gian hàng",
  owner: "chủ sở hữu",
  admin: "quản trị viên",
  staff: "staff",
  "Access disabled": "Quyền truy cập đã tắt",
  "Shop unavailable": "Gian hàng không khả dụng",
  "Manage shop": "Quản lý gian hàng",
  Storefront: "Cửa hàng",
  "Create another shop": "Tạo thêm gian hàng",
  "Create your own shop (optional)": "Tạo gian hàng riêng (không bắt buộc)",
  "Start a storefront only if you plan to sell your own merch. You can also wait for an invitation.":
    "Chỉ tạo cửa hàng nếu bạn dự định bán sản phẩm của riêng mình. Bạn cũng có thể chờ lời mời.",
  "Welcome to Matsuri": "Chào mừng đến với Matsuri",
  "You can join a shop as a teammate or create your own storefront whenever you are ready.":
    "Bạn có thể tham gia một gian hàng với tư cách cộng sự hoặc tạo cửa hàng riêng khi sẵn sàng.",
  "Joining someone else’s shop?": "Bạn đang tham gia gian hàng của người khác?",
  "Open the invitation link from your email. After you accept it, the shop will appear here automatically.":
    "Mở liên kết lời mời trong email. Sau khi chấp nhận, gian hàng sẽ tự động xuất hiện tại đây.",
  "{{owned}} of {{limit}} created shops used":
    "Đã dùng {{owned}} / {{limit}} gian hàng tự tạo",
  "You have joined {{joined}} shops. Joined shops do not count toward this limit.":
    "Bạn đã tham gia {{joined}} gian hàng. Các gian hàng tham gia không tính vào giới hạn này.",
  "Shop creation limit reached": "Đã đạt giới hạn tạo gian hàng",
  "You can create up to {{limit}} shops. Joined shops do not count toward this limit.":
    "Bạn có thể tạo tối đa {{limit}} gian hàng. Các gian hàng tham gia không tính vào giới hạn này.",
  "Add a new storefront and manage its inventory, custom design, and orders.":
    "Thêm cửa hàng mới và quản lý tồn kho, thiết kế tùy chỉnh cùng đơn hàng.",
  "Sign out of your account?": "Đăng xuất khỏi tài khoản?",
  "Your work is saved.": "Công việc của bạn đã được lưu.",
  "You’ll sign out of the platform dashboard and all shops.":
    "Bạn sẽ đăng xuất khỏi bảng điều khiển nền tảng và tất cả gian hàng.",
  Cancel: "Hủy",
  "Signing out…": "Đang đăng xuất…",
  "Update the name customers see across your storefront.":
    "Cập nhật tên khách hàng nhìn thấy trên cửa hàng.",
  "My shop name": "Tên gian hàng của tôi",
  "Storefront URL": "URL cửa hàng",
  Fixed: "Cố định",
  "Shop URLs cannot currently be changed after creation.":
    "Hiện không thể đổi URL gian hàng sau khi tạo.",
  "Save changes": "Lưu thay đổi",
  "Unsaved changes": "Thay đổi chưa lưu",
  "No changes": "Không có thay đổi",
  "Reset changes": "Đặt lại thay đổi",
  "Could not upload image.": "Không thể tải ảnh lên.",
  "Upload failed": "Tải lên thất bại",
  "Uploading…": "Đang tải lên…",
  Products: "Sản phẩm",
  "{{count}} catalog items": "{{count}} sản phẩm trong danh mục",
  "Search products": "Tìm sản phẩm",
  "New item": "Sản phẩm mới",
  "Product filters": "Bộ lọc sản phẩm",
  all: "tất cả",
  live: "đang bán",
  low: "sắp hết",
  hidden: "đã ẩn",
  "Low / sold out": "Sắp hết / hết hàng",
  "Loading products…": "Đang tải sản phẩm…",
  "No products yet": "Chưa có sản phẩm",
  "No matching products": "Không có sản phẩm phù hợp",
  "Fetching the latest catalog and stock levels.":
    "Đang tải danh mục và tồn kho mới nhất.",
  "Create your first item to start filling the booth.":
    "Tạo sản phẩm đầu tiên để bắt đầu lấp đầy gian hàng.",
  "Adjust your search or return to all products.":
    "Điều chỉnh tìm kiếm hoặc quay lại tất cả sản phẩm.",
  "Create product": "Tạo sản phẩm",
  "Clear filters": "Xóa bộ lọc",
  "Untitled item": "Sản phẩm chưa đặt tên",
  Featured: "Nổi bật",
  Hidden: "Đã ẩn",
  "No code": "Chưa có mã",
  "Sold out": "Hết hàng",
  "{{count}} in stock": "Còn {{count}} sản phẩm",
  "Could not save payment settings": "Không thể lưu cài đặt thanh toán",
  "Payment & QR": "Thanh toán & QR",
  "Bank details and payment instructions.":
    "Thông tin ngân hàng và hướng dẫn thanh toán.",
  Edit: "Sửa",
  Bank: "Ngân hàng",
  Account: "Tài khoản",
  Label: "Nhãn",
  "Not set": "Chưa thiết lập",
  Payment: "Thanh toán",
  "Bank account": "Tài khoản ngân hàng",
  "Used to generate each payment QR.": "Dùng để tạo từng mã QR thanh toán.",
  "Choose a bank": "Chọn ngân hàng",
  "No bank is configured yet": "Chưa cấu hình ngân hàng",
  "Account not set": "Chưa thiết lập tài khoản",
  "Payment label": "Nhãn thanh toán",
  "Select bank": "Chọn ngân hàng",
  "Account number": "Số tài khoản",
  "Account name": "Tên tài khoản",
  "Transfer message": "Nội dung chuyển khoản",
  "Match payments to orders with tokens.":
    "Đối chiếu thanh toán với đơn hàng bằng biến.",
  "Transfer message template": "Mẫu nội dung chuyển khoản",
  "Available tokens: {code}, {item}, {amount}":
    "Biến có thể dùng: {code}, {item}, {amount}",
  "Customer payment instructions": "Hướng dẫn thanh toán cho khách",
  "Backup QR": "QR dự phòng",
  "Used if VietQR is unavailable.": "Dùng khi VietQR không khả dụng.",
  "Fallback payment QR": "QR thanh toán dự phòng",
  "Fallback QR URL": "URL QR dự phòng",
  "Upload fallback QR": "Tải QR dự phòng lên",
  "Save payment settings": "Lưu cài đặt thanh toán",
  "Could not save booth settings": "Không thể lưu cài đặt gian hàng",
  "Booth info": "Thông tin gian hàng",
  "Name, logo, location, and social links.":
    "Tên, logo, vị trí và liên kết mạng xã hội.",
  Booth: "Gian hàng",
  Code: "Mã",
  Hours: "Giờ mở cửa",
  "Booth identity": "Nhận diện gian hàng",
  "Customer-facing booth subtitle": "Mô tả gian hàng hiển thị cho khách",
  Public: "Công khai",
  "Name, code, logo, hours, and location.":
    "Tên, mã, logo, giờ mở cửa và vị trí.",
  "Booth logo": "Logo gian hàng",
  "Logo URL": "URL logo",
  "Upload logo": "Tải logo lên",
  "Booth name": "Tên gian hàng",
  "Booth code": "Mã gian hàng",
  "Open hours": "Giờ mở cửa",
  Location: "Vị trí",
  "Store copy": "Nội dung cửa hàng",
  "Customer-facing title and description.":
    "Tiêu đề và mô tả hiển thị cho khách hàng.",
  Subtitle: "Tiêu đề phụ",
  "Social links": "Liên kết mạng xã hội",
  "Links shown in booth information.":
    "Các liên kết hiển thị trong thông tin gian hàng.",
  Show: "Hiển thị",
  "Profile URL": "URL trang cá nhân",
  "{{platform}} profile URL": "URL trang {{platform}}",
  "QR center logo": "Logo giữa mã QR",
  "Social QR logo": "Logo QR mạng xã hội",
  "Shared QR logo": "Logo QR dùng chung",
  "Used in the center of every social QR code.":
    "Được đặt ở giữa mọi mã QR mạng xã hội.",
  "Upload QR logo": "Tải logo QR lên",
  "Save booth settings": "Lưu cài đặt gian hàng",
  "Could not update item": "Không thể cập nhật sản phẩm",
  "Delete “{{name}}”? This cannot be undone.":
    "Xóa “{{name}}”? Không thể hoàn tác thao tác này.",
  "Product details": "Chi tiết sản phẩm",
  "Add the essentials first. You can refine the listing later.":
    "Thêm thông tin thiết yếu trước. Bạn có thể hoàn thiện sản phẩm sau.",
  "Deleting…": "Đang xóa…",
  Delete: "Xóa",
  Price: "Giá",
  Sale: "Giảm giá",
  Stock: "Tồn kho",
  Visibility: "Hiển thị",
  Live: "Đang bán",
  "Listing details": "Thông tin đăng bán",
  "The information customers use to identify this item.":
    "Thông tin giúp khách hàng nhận biết sản phẩm.",
  "Product name · Required": "Tên sản phẩm · Bắt buộc",
  "e.g. Moonlight acrylic stand": "VD: Standee acrylic Ánh Trăng",
  "Item code · Required": "Mã sản phẩm · Bắt buộc",
  "A short unique code used by staff.": "Mã ngắn duy nhất để staff sử dụng.",
  Collection: "Bộ sưu tập",
  "Optional grouping, such as Spring 2026.": "Nhóm tùy chọn, ví dụ Xuân 2026.",
  "e.g. Starry Days": "VD: Những ngày đầy sao",
  "Category · Required": "Danh mục · Bắt buộc",
  "e.g. Acrylic, Print, Apparel": "VD: Acrylic, Tranh in, Trang phục",
  Description: "Mô tả",
  "{{count}}/500 characters": "{{count}}/500 ký tự",
  "What should customers know about this item?":
    "Khách hàng cần biết gì về sản phẩm này?",
  "Price & availability": "Giá & tình trạng hàng",
  "Stock status updates automatically from the quantity.":
    "Tình trạng tồn kho tự động cập nhật theo số lượng.",
  "Price · Required": "Giá · Bắt buộc",
  "Regular price · Required": "Giá thường · Bắt buộc",
  "Sale price · Required": "Giá khuyến mãi · Bắt buộc",
  "Customers save {{percent}}%.": "Khách hàng tiết kiệm {{percent}}%.",
  "Must be lower than the regular price.": "Phải thấp hơn giá thường.",
  Quantity: "Số lượng",
  "Decrease quantity": "Giảm số lượng",
  "Increase quantity": "Tăng số lượng",
  "{{count}} items in stock": "{{count}} sản phẩm trong kho",
  "Large quantity — double-check this number.":
    "Số lượng lớn — hãy kiểm tra lại con số này.",
  "Customer badge": "Nhãn sản phẩm",
  "Optional label shown on product artwork.":
    "Nhãn tùy chọn hiển thị trên hình sản phẩm.",
  "No badge": "Không có nhãn",
  "Choose badge color": "Chọn màu nhãn",
  "Badge color": "Màu nhãn",
  New: "Mới",
  "Best Seller": "Bán chạy",
  Limited: "Giới hạn",
  Restock: "Vừa nhập lại",
  "Event Exclusive": "Độc quyền sự kiện",
  Preorder: "Đặt trước",
  "Last Call": "Cơ hội cuối",
  "Feature this item": "Làm nổi bật sản phẩm",
  "Give it extra prominence on the storefront.":
    "Tăng độ nổi bật trên cửa hàng.",
  "Put this item on sale": "Giảm giá sản phẩm này",
  "Show a lower price while keeping the regular price visible.":
    "Hiển thị giá thấp hơn và vẫn giữ giá thường để khách so sánh.",
  "Include in quantity promotion": "Tham gia khuyến mãi theo số lượng",
  "Mix this item with other eligible products in the active offer.":
    "Kết hợp sản phẩm này với các sản phẩm đủ điều kiện khác trong ưu đãi đang bật.",
  "Quantity promotion": "Khuyến mãi theo số lượng",
  "Configure a mix-and-match buy-X-get-Y offer.":
    "Thiết lập ưu đãi mua X tặng Y có thể kết hợp nhiều sản phẩm.",
  Offer: "Ưu đãi",
  "Buy {{buy}}, get {{free}} free": "Mua {{buy}}, tặng {{free}}",
  Status: "Trạng thái",
  "Eligible products": "Sản phẩm đủ điều kiện",
  "Customer buys": "Khách mua",
  "Paid items required in each offer group.":
    "Số sản phẩm trả tiền cần có trong mỗi nhóm ưu đãi.",
  "Customer gets free": "Khách được tặng",
  "Cheapest eligible items become free.":
    "Sản phẩm đủ điều kiện có giá thấp nhất sẽ được miễn phí.",
  "Customers choose free items from the selected reward products.":
    "Khách chọn sản phẩm miễn phí trong nhóm sản phẩm tặng đã chọn.",
  "Promotion active": "Bật khuyến mãi",
  "Apply this offer in the storefront and checkout.":
    "Áp dụng ưu đãi này tại cửa hàng và khi thanh toán.",
  "Repeat offer": "Lặp lại ưu đãi",
  "Apply the reward again for each complete group.":
    "Tiếp tục tặng cho mỗi nhóm sản phẩm đầy đủ.",
  "Select at least one eligible product before publishing this offer.":
    "Chọn ít nhất một sản phẩm đủ điều kiện trước khi bật ưu đãi.",
  "Choose eligible products from each product’s Price & availability section.":
    "Chọn sản phẩm đủ điều kiện trong mục Giá & tình trạng của từng sản phẩm.",
  "Could not save promotion": "Không thể lưu khuyến mãi",
  "Save promotion": "Lưu khuyến mãi",
  "Promotion saved.": "Đã lưu khuyến mãi.",
  "Promotion savings": "Tiết kiệm khuyến mãi",
  "Buy products": "Sản phẩm khách mua",
  "Reward products": "Sản phẩm tặng",
  "{{buy}} buy products · {{reward}} reward products": "{{buy}} sản phẩm mua · {{reward}} sản phẩm tặng",
  "What customers buy": "Sản phẩm khách mua",
  "Products that count toward Buy {{buy}}": "Sản phẩm tính vào mốc Mua {{buy}}",
  "These paid products count toward the Buy quantity.": "Các sản phẩm trả tiền này được tính vào số lượng Mua.",
  "What customers get": "Sản phẩm khách được tặng",
  "Products customers can choose free": "Sản phẩm khách có thể chọn miễn phí",
  "Customers choose free items from this reward group.": "Khách chọn sản phẩm miễn phí từ nhóm quà tặng này.",
  "Buy any {{buy}} from {{qualifying}} selected products, then choose {{free}} free from {{reward}} reward products.":
    "Mua bất kỳ {{buy}} trong {{qualifying}} sản phẩm đã chọn, sau đó chọn miễn phí {{free}} trong {{reward}} sản phẩm tặng.",
  "Select at least one buy product and one reward product before publishing this offer.": "Chọn ít nhất một sản phẩm mua và một sản phẩm tặng trước khi bật ưu đãi.",
  "Visible in catalog": "Hiển thị trong danh mục",
  "Customers can find and purchase this item.":
    "Khách hàng có thể tìm và mua sản phẩm này.",
  "Product gallery": "Thư viện ảnh sản phẩm",
  "Add up to four images. The first image becomes the cover.":
    "Thêm tối đa bốn ảnh. Ảnh đầu tiên sẽ làm ảnh bìa.",
  Product: "Sản phẩm",
  Cover: "Ảnh bìa",
  "Remove image {{number}}": "Xóa ảnh {{number}}",
  "No product images yet": "Chưa có ảnh sản phẩm",
  "Add another image": "Thêm ảnh khác",
  "Upload product image": "Tải ảnh sản phẩm lên",
  Clear: "Xóa nội dung",
  "Unknown product": "Sản phẩm không xác định",
  "This order was already handled by another staff member.":
    "Đơn này đã được staff khác xử lý.",
  "Payment confirmed.": "Đã xác nhận thanh toán.",
  "Failed to confirm payment.": "Xác nhận thanh toán thất bại.",
  "Could not confirm order": "Không thể xác nhận đơn",
  "Cancel this order? This cannot be undone.":
    "Hủy đơn này? Không thể hoàn tác thao tác này.",
  "Order cancelled and stock released.": "Đã hủy đơn và hoàn lại tồn kho.",
  "Failed to cancel order.": "Hủy đơn thất bại.",
  "Could not cancel order": "Không thể hủy đơn",
  "Order status": "Trạng thái đơn",
  pending: "đang chờ",
  confirmed: "đã xác nhận",
  cancelled: "đã hủy",
  expired: "đã hết hạn",
  "Live queue": "Hàng đợi trực tiếp",
  "Orders shown": "Số đơn hiển thị",
  "{{count}} matching orders": "{{count}} đơn phù hợp",
  "Order value": "Giá trị đơn",
  "Current page total": "Tổng của trang hiện tại",
  "Units requested": "Số sản phẩm yêu cầu",
  "{{count}} unique products": "{{count}} sản phẩm khác nhau",
  "Fulfilment overview": "Tổng quan chuẩn bị hàng",
  "What needs to be packed": "Các sản phẩm cần đóng gói",
  "{{count}} total units": "Tổng {{count}} sản phẩm",
  "No item code": "Chưa có mã sản phẩm",
  "Order queue": "Hàng đợi đơn",
  "All orders": "Tất cả đơn hàng",
  "{{status}} orders": "Đơn {{status}}",
  "Refreshing…": "Đang làm mới…",
  "{{first}}–{{last}} of {{total}} · newest first":
    "{{first}}–{{last}} trên {{total}} · mới nhất trước",
  "Loading orders…": "Đang tải đơn hàng…",
  "No orders yet": "Chưa có đơn hàng",
  "No {{status}} orders": "Không có đơn {{status}}",
  Today: "Hôm nay",
  "No orders today": "Chưa có đơn hàng nào hôm nay",
  "No {{status}} orders today": "Không có đơn {{status}} nào hôm nay",
  "Fetching the latest queue from the server.":
    "Đang tải hàng đợi mới nhất từ máy chủ.",
  "You’re all caught up. New orders will appear here automatically.":
    "Bạn đã xử lý hết. Đơn mới sẽ tự động xuất hiện tại đây.",
  "There are no orders with this status yet.":
    "Chưa có đơn hàng ở trạng thái này.",
  "All statuses": "Tất cả trạng thái",
  "Live updates on": "Đang cập nhật trực tiếp",
  "View all orders": "Xem tất cả đơn",
  "Order pages": "Các trang đơn hàng",
  Previous: "Trước",
  Page: "Trang",
  of: "trên",
  Next: "Tiếp",
  "Pickup name": "Tên nhận hàng",
  Total: "Tổng cộng",
  "Cancelling…": "Đang hủy…",
  "Cancel and release stock": "Hủy và hoàn lại tồn kho",
  "Swipe right or press Enter to confirm payment and update stock":
    "Vuốt sang phải hoặc nhấn Enter để xác nhận thanh toán và cập nhật tồn kho",
  "Confirming payment…": "Đang xác nhận thanh toán…",
  "Payment confirmed": "Đã xác nhận thanh toán",
  "Stock updated": "Đã cập nhật tồn kho",
  "Could not confirm — try again": "Không thể xác nhận — thử lại",
  "Swipe to confirm payment": "Vuốt để xác nhận thanh toán",
  "Payment confirmed and stock updated":
    "Đã xác nhận thanh toán và cập nhật tồn kho",
  "Confirmation failed. Try again.": "Xác nhận thất bại. Hãy thử lại.",
  Staff: "staff",
  Admin: "Quản trị viên",
  Owner: "Chủ sở hữu",
  "Process and fulfil orders": "Xử lý và hoàn tất đơn hàng",
  "Manage catalog, settings, and orders":
    "Quản lý danh mục, cài đặt và đơn hàng",
  "Full shop and team access": "Toàn quyền gian hàng và đội ngũ",
  "Could not load staff": "Không thể tải danh sách staff",
  "Enter a valid email address.": "Nhập địa chỉ email hợp lệ.",
  "Could not send invitation": "Không thể gửi lời mời",
  "Invite processed. The team list is up to date.":
    "Đã xử lý lời mời. Danh sách đội ngũ đã được cập nhật.",
  "Staff access updated.": "Đã cập nhật quyền staff.",
  "Could not update staff": "Không thể cập nhật staff",
  "Shop access removed.": "Đã xóa quyền truy cập gian hàng.",
  "Could not remove access": "Không thể xóa quyền truy cập",
  "Invitation revoked.": "Đã thu hồi lời mời.",
  "Could not revoke invitation": "Không thể thu hồi lời mời",
  "Team access": "Quyền truy cập đội ngũ",
  "Invite people, choose their role, and review access in one place.":
    "Mời mọi người, chọn vai trò và xem lại quyền truy cập tại một nơi.",
  "Invite a teammate": "Mời cộng sự",
  "Team overview": "Tổng quan đội ngũ",
  "Active members": "Thành viên đang hoạt động",
  "Pending invites": "Lời mời đang chờ",
  "Team places used": "Vị trí đã dùng",
  "Choose what they can do. You can change or remove access later.":
    "Chọn quyền họ có thể sử dụng. Bạn có thể thay đổi hoặc xóa quyền sau.",
  "Track who still needs to accept their email invitation.":
    "Theo dõi những người vẫn cần chấp nhận lời mời qua email.",
  "They’ll receive secure access for this shop only.":
    "Họ sẽ nhận quyền truy cập an toàn chỉ dành cho gian hàng này.",
  "{{used}} of {{limit}} team places used":
    "Đã dùng {{used}} / {{limit}} vị trí trong đội ngũ",
  "Team limit reached": "Đã đạt giới hạn đội ngũ",
  "Shop team limit reached.":
    "Gian hàng đã đạt giới hạn 10 thành viên và lời mời đang chờ.",
  "Revoke a pending invitation or remove a member before inviting someone new.":
    "Hãy thu hồi một lời mời đang chờ hoặc xóa một thành viên trước khi mời người mới.",
  Email: "Email",
  Role: "Vai trò",
  "Invitation role": "Vai trò lời mời",
  "Send invitation": "Gửi lời mời",
  Members: "Thành viên",
  "{{count}} people with shop access":
    "{{count}} người có quyền truy cập gian hàng",
  "Loading staff…": "Đang tải staff…",
  "No members yet": "Chưa có thành viên",
  "Invite a staff member above.": "Mời một staff ở phía trên.",
  "Shop member": "Thành viên gian hàng",
  Active: "Đang hoạt động",
  Inactive: "Không hoạt động",
  "Role for {{email}}": "Vai trò của {{email}}",
  Enabled: "Đã bật",
  Disabled: "Đã tắt",
  "Remove {{email}}": "Xóa {{email}}",
  Remove: "Xóa",
  Invitations: "Lời mời",
  "Pending and recent email invitations": "Lời mời email đang chờ và gần đây",
  expires: "hết hạn",
  Revoke: "Thu hồi",
  "Confirm ownership change": "Xác nhận thay đổi chủ sở hữu",
  "Ownership changes affect full shop and team access. The shop must always retain at least one active owner.":
    "Thay đổi chủ sở hữu ảnh hưởng toàn bộ quyền gian hàng và đội ngũ. Gian hàng luôn phải có ít nhất một chủ sở hữu đang hoạt động.",
  "Confirm change": "Xác nhận thay đổi",
  "Remove shop access?": "Xóa quyền truy cập gian hàng?",
  "will immediately lose access to this shop.":
    "sẽ mất quyền truy cập gian hàng này ngay lập tức.",
  "Remove access": "Xóa quyền truy cập",
  "Could not publish": "Không thể xuất bản",
  "Featured spotlight": "Điểm nhấn nổi bật",
  "Promoted products and swipe deck": "Sản phẩm quảng bá và bộ thẻ vuốt",
  "Booth information": "Thông tin gian hàng",
  "Location, hours, and social QR codes":
    "Vị trí, giờ mở cửa và mã QR mạng xã hội",
  "Browse controls": "Điều khiển duyệt",
  "Categories, search, sort, and view mode":
    "Danh mục, tìm kiếm, sắp xếp và kiểu xem",
  "Shopping cart": "Giỏ hàng",
  "Cart, bank details, transfer note, and QR":
    "Giỏ hàng, thông tin ngân hàng, nội dung chuyển khoản và QR",
  "Product collection": "Bộ sưu tập sản phẩm",
  "The complete item grid or list": "Toàn bộ lưới hoặc danh sách sản phẩm",
  Wide: "Rộng",
  Side: "Bên cạnh",
  "Drag {{section}}": "Kéo {{section}}",
  "Payment settings": "Cài đặt thanh toán",
  "Storefront builder": "Trình thiết kế cửa hàng",
  "Click anything in the preview to edit it.":
    "Nhấp vào nội dung trong bản xem trước để chỉnh sửa.",
  "Collapse builder sidebar": "Thu gọn thanh thiết kế",
  "Expand builder sidebar": "Mở rộng thanh thiết kế",
  "Builder tools": "Công cụ thiết kế",
  Layout: "Bố cục",
  Content: "Nội dung",
  Style: "Phong cách",
  "Page sections": "Các phần trang",
  "Drag to reorder the public page.": "Kéo để sắp xếp lại trang công khai.",
  "Move {{section}} up": "Di chuyển {{section}} lên",
  "Move {{section}} down": "Di chuyển {{section}} xuống",
  "Wide and side modules keep safe column widths. Dragging changes their order within those responsive lanes.":
    "Mô-đun rộng và bên cạnh luôn giữ chiều rộng cột an toàn. Kéo để đổi thứ tự trong các vùng đáp ứng tương ứng.",
  "Only settings for the selected section are shown.":
    "Chỉ hiển thị cài đặt của phần đang chọn.",
  "The Featured banner displays details directly from active featured products. Mark products as Featured in the Products workspace.":
    "Banner Nổi bật lấy nội dung trực tiếp từ các sản phẩm nổi bật đang hoạt động. Đánh dấu sản phẩm là Nổi bật trong khu vực Sản phẩm.",
  "Auto-rotate products": "Tự động chuyển sản phẩm",
  "Advance to the next featured item every 4.5 seconds. Pauses after customer interaction and respects reduced motion.":
    "Chuyển sang sản phẩm nổi bật tiếp theo sau mỗi 4,5 giây. Tạm dừng sau tương tác và tôn trọng cài đặt giảm chuyển động.",
  "Banner style": "Kiểu banner",
  "Swipe deck": "Bộ thẻ vuốt",
  "Layered cards and soft orbit": "Thẻ xếp lớp và quỹ đạo nhẹ",
  Editorial: "Tạp chí",
  "Clean magazine layout": "Bố cục tạp chí gọn gàng",
  Minimal: "Tối giản",
  "Quiet and product-first": "Nhẹ nhàng, tập trung vào sản phẩm",
  "Pop poster": "Áp phích nổi bật",
  "Bold color and energy": "Màu sắc mạnh mẽ và năng động",
  "Control style": "Kiểu điều khiển",
  Panel: "Bảng điều khiển",
  "Everything in one surface": "Tất cả trong một bề mặt",
  Floating: "Nổi",
  "Light and open": "Nhẹ và thoáng",
  Compact: "Gọn",
  "More catalog, less chrome": "Nhiều nội dung, ít khung điều khiển",
  "Tinted with an offset shadow": "Nền màu nhẹ với bóng lệch",
  "Product card style": "Kiểu thẻ sản phẩm",
  Classic: "Cổ điển",
  "Balanced shop cards": "Thẻ cửa hàng cân đối",
  "Flat and spacious": "Phẳng và thoáng",
  Framed: "Đóng khung",
  "Inset product photography": "Ảnh sản phẩm nằm trong khung",
  "Colorful collectible cards": "Thẻ sưu tầm đầy màu sắc",
  "Header subtitle": "Tiêu đề phụ đầu trang",
  "Upload booth logo": "Tải logo gian hàng lên",
  "Social QR center logo": "Logo giữa QR mạng xã hội",
  "Payment account": "Tài khoản thanh toán",
  "No account configured": "Chưa cấu hình tài khoản",
  "Account holder not set": "Chưa nhập tên chủ tài khoản",
  "Customer ready": "Sẵn sàng cho khách",
  "Needs setup": "Cần thiết lập",
  "Backup payment QR": "QR thanh toán dự phòng",
  "Upload backup QR": "Tải QR dự phòng lên",
  "Browse controls use the categories and product data from your catalog. Language is available under Style.":
    "Điều khiển duyệt dùng danh mục và dữ liệu sản phẩm. Ngôn ngữ nằm trong mục Phong cách.",
  "Product content is managed from the Products workspace. This section follows the customer’s grid or list choice.":
    "Nội dung sản phẩm được quản lý trong khu vực Sản phẩm. Phần này tuân theo lựa chọn dạng lưới hoặc danh sách của khách.",
  "Look & feel": "Giao diện",
  "Palette presets": "Bảng màu có sẵn",
  "Start with a mood, then fine-tune any color below.":
    "Bắt đầu với một phong cách, sau đó tinh chỉnh từng màu bên dưới.",
  "Matsuri Bloom": "Matsuri Rực rỡ",
  "Warm & cheerful": "Ấm áp & vui tươi",
  "Matcha Picnic": "Dã ngoại Matcha",
  "Cute & cozy": "Dễ thương & ấm cúng",
  "Sakura Soda": "Soda Sakura",
  "Sweet & bubbly": "Ngọt ngào & sôi nổi",
  "Night Market": "Chợ đêm",
  "Cool & electric": "Cá tính & rực sáng",
  "Ocean Pop": "Ocean Pop",
  "Fresh & playful": "Tươi mới & tinh nghịch",
  "Card personality": "Phong cách thẻ",
  "Choose how product, booth, cart, and control cards feel.":
    "Chọn phong cách cho thẻ sản phẩm, gian hàng, giỏ hàng và điều khiển.",
  Soft: "Mềm mại",
  "Gentle surfaces": "Bề mặt nhẹ nhàng",
  Outlined: "Viền rõ",
  "Clean and crisp": "Gọn gàng & sắc nét",
  Elevated: "Nổi khối",
  "Polished depth": "Chiều sâu tinh tế",
  Playful: "Tinh nghịch",
  "Colorful offset shadow": "Bóng lệch đầy màu sắc",
  "Custom colors": "Màu tùy chỉnh",
  "Make this palette completely yours.":
    "Biến bảng màu này thành phong cách riêng của bạn.",
  "Changes update the canvas instantly.":
    "Thay đổi cập nhật bản xem trước ngay lập tức.",
  Primary: "Chính",
  Dark: "Tối",
  Accent: "Điểm nhấn",
  "Corner radius": "Độ bo góc",
  "{{radius}}px across storefront cards": "{{radius}}px cho các thẻ cửa hàng",
  "Storefront language": "Ngôn ngữ cửa hàng",
  "Customer-facing interface copy.": "Nội dung giao diện dành cho khách hàng.",
  "Unpublished changes": "Thay đổi chưa xuất bản",
  "Published storefront": "Cửa hàng đã xuất bản",
  "Preview size": "Kích thước xem trước",
  Desktop: "Máy tính",
  Phone: "Điện thoại",
  "Preview zoom": "Thu phóng xem trước",
  "Zoom out": "Thu nhỏ",
  "Fit preview": "Vừa khung xem trước",
  "Zoom in": "Phóng to",
  Undo: "Hoàn tác",
  Redo: "Làm lại",
  "Reset unpublished changes": "Đặt lại thay đổi chưa xuất bản",
  Reset: "Đặt lại",
  Publish: "Xuất bản",
  desktop: "máy tính",
  phone: "điện thoại",
  "{{device}} storefront preview": "Bản xem trước cửa hàng trên {{device}}",
  "Could not refresh orders.": "Không thể làm mới đơn hàng.",
  "Refresh failed": "Làm mới thất bại",
  "Could not load workspace data.":
    "Không thể tải dữ liệu không gian làm việc.",
  "Connection error": "Lỗi kết nối",
  "Could not load the admin workspace.": "Không thể tải không gian quản trị.",
  "Admin unavailable": "Trang quản trị không khả dụng",
  "Could not refresh admin data.": "Không thể làm mới dữ liệu quản trị.",
  "Order notifications disabled.": "Đã tắt thông báo đơn hàng.",
  "Order notifications enabled on this device.":
    "Đã bật thông báo đơn hàng trên thiết bị này.",
  "Could not update notifications.": "Không thể cập nhật thông báo.",
  "Notifications unavailable": "Thông báo không khả dụng",
  "Item saved.": "Đã lưu sản phẩm.",
  "Item deleted.": "Đã xóa sản phẩm.",
  "Back to catalog": "Về danh mục",
  "Go to dashboard": "Đến bảng điều khiển",
  "Merch desk": "Quầy merch",
  "Orders Queue": "Hàng đợi đơn",
  "Products ({{count}})": "Sản phẩm ({{count}})",
  Team: "Đội ngũ",
  Settings: "Cài đặt",
  "Active shop": "Gian hàng hiện tại",
  Unavailable: "Không khả dụng",
  "All shops": "Tất cả gian hàng",
  "Open platform dashboard": "Mở bảng điều khiển nền tảng",
  "Set up a new storefront": "Thiết lập cửa hàng mới",
  "Disable alerts": "Tắt cảnh báo",
  "Enable alerts": "Bật cảnh báo",
  "Disable order notifications": "Tắt thông báo đơn hàng",
  "Enable order notifications": "Bật thông báo đơn hàng",
  "Alerts on": "Đã bật cảnh báo",
  "Live operations": "Vận hành trực tiếp",
  "Catalog management": "Quản lý danh mục",
  "Mobile configuration": "Cấu hình di động",
  "Access management": "Quản lý quyền truy cập",
  "Visual storefront": "Giao diện cửa hàng",
  Orders: "Đơn hàng",
  "Storefront designer": "Trình thiết kế cửa hàng",
  "Confirm payments and fulfil orders.":
    "Xác nhận thanh toán và hoàn tất đơn hàng.",
  "Manage products, prices, and stock.": "Quản lý sản phẩm, giá và tồn kho.",
  "Update booth and payment details.":
    "Cập nhật thông tin gian hàng và thanh toán.",
  "Build your storefront and checkout.":
    "Thiết kế cửa hàng và quy trình thanh toán.",
  "matching orders": "đơn phù hợp",
  total: "tổng cộng",
  "need attention": "cần chú ý",
  corners: "bo góc",
  locale: "ngôn ngữ",
  "Workspace unavailable": "Không gian làm việc không khả dụng",
  "We could not load this shop's workspace. Check your connection and retry.":
    "Không thể tải không gian của gian hàng này. Hãy kiểm tra kết nối và thử lại.",
  "Retry loading": "Tải lại",
  "Products List ({{count}})": "Danh sách sản phẩm ({{count}})",
  "Edit Product": "Sửa sản phẩm",
  "No product selected": "Chưa chọn sản phẩm",
  "Choose a product from the list to edit it, or start a fresh listing.":
    "Chọn sản phẩm trong danh sách để chỉnh sửa hoặc tạo sản phẩm mới.",
  "Storefront design published.": "Đã xuất bản thiết kế cửa hàng.",
  "Checkout settings saved.": "Đã lưu cài đặt thanh toán.",
  "Booth settings saved.": "Đã lưu cài đặt gian hàng.",
  "Sign out of admin?": "Đăng xuất khỏi trang quản trị?",
  "You’ll return to the staff login screen. The public catalog stays open for customers.":
    "Bạn sẽ quay lại màn hình đăng nhập staff. Danh mục công khai vẫn mở cho khách hàng.",
  "Stay signed in": "Tiếp tục đăng nhập",
  Gacha: "Gacha",
  "Gacha setup": "Thiết lập gacha",
  "Gacha setup steps": "Các bước thiết lập gacha",
  "Game setup": "Thiết lập game",
  "Prize pool": "Pool phần thưởng",
  "Choose the game, public copy, and advanced pity rules.":
    "Chọn game, nội dung công khai và quy tắc bảo hiểm nâng cao.",
  "Public minigame open": "Minigame công khai đang mở",
  "Public minigame closed": "Minigame công khai đang đóng",
  "Live banners": "Banner đang bật",
  "Pool items": "Vật phẩm trong pool",
  "{{count}} featured on this banner":
    "{{count}} vật phẩm nổi bật trên banner này",
  "Gacha workflow": "Quy trình gacha",
  "Set the public experience.": "Thiết lập trải nghiệm công khai.",
  "Choose what each banner shows.": "Chọn nội dung hiển thị trên từng banner.",
  "Add and configure prize items.": "Thêm và cấu hình vật phẩm phần thưởng.",
  Preview: "Xem thử",
  "Filter pool items": "Lọc vật phẩm trong pool",
  "Pool items ({{count}})": "Vật phẩm trong pool ({{count}})",
  "Add products ({{count}})": "Thêm sản phẩm ({{count}})",
  "Added to pool.": "Đã thêm vào pool.",
  "Removed from pool.": "Đã xóa khỏi pool.",
  "Remove from pool": "Xóa khỏi pool",
  "Pity rules": "Quy tắc bảo hiểm",
  "Rates and pity rules": "Tỷ lệ và quy tắc bảo hiểm",
  "Base odds and maximum pulls before each guarantee.":
    "Tỷ lệ cơ bản và số lượt tối đa trước mỗi mốc bảo hiểm.",
  "Advanced pull guarantees": "Cài đặt bảo hiểm nâng cao",
  "Pull guarantees": "Mốc bảo hiểm",
  "Maximum pulls before each rarity is guaranteed.":
    "Số lượt tối đa trước khi đảm bảo nhận được từng độ hiếm.",
  "All products": "Tất cả sản phẩm",
  "In pool": "Trong pool",
  "Not added": "Chưa thêm",
  "Gacha banners": "Banner gacha",
  "Build merch pools, preview changes, then publish.":
    "Tạo pool merch, xem thử thay đổi rồi xuất bản.",
  Banners: "Banner",
  "Add, order, duplicate, or disable banners.":
    "Thêm, sắp xếp, nhân bản hoặc tắt banner.",
  "Add banner": "Thêm banner",
  "Move banner up": "Đưa banner lên",
  "Move banner down": "Đưa banner xuống",
  "Duplicate banner": "Nhân bản banner",
  "Delete banner": "Xóa banner",
  "Banner presentation, pool, and item stats.":
    "Giao diện banner, pool và chỉ số vật phẩm.",
  "Banner title": "Tên banner",
  "Bilingual: English | Tiếng Việt or [en]English[vi]Tiếng Việt": "Song ngữ: Tiếng Anh | Tiếng Việt hoặc [en]English[vi]Tiếng Việt",
  "Banner type": "Loại banner",
  "Banner copy": "Nội dung banner",
  "Featured items shown": "Số vật phẩm nổi bật",
  "Featured banner slots": "Vị trí nổi bật trên banner",
  "1 primary item": "1 vật phẩm chính",
  "1 primary + {{count}} secondary": "1 chính + {{count}} phụ",
  "1 featured item": "1 vật phẩm nổi bật",
  "{{count}} featured items": "{{count}} vật phẩm nổi bật",
  "HSR banners show one 5-star primary and up to three 4-star rate-ups.":
    "Banner HSR hiển thị một vật phẩm 5 sao chính và tối đa ba vật phẩm 4 sao tăng tỉ lệ.",
  "HSR banners support one primary 5-star item.":
    "Banner HSR hỗ trợ một vật phẩm 5 sao chính.",
  "This HSR banner has filled its 4-star rate-up slots.":
    "Banner HSR này đã đủ vị trí tăng tỉ lệ 4 sao.",
  "Only 5-star primary and 4-star secondary items can be featured.":
    "Chỉ vật phẩm 5 sao chính và vật phẩm 4 sao phụ mới có thể được đặt làm nổi bật.",
  "Choose a featured rarity": "Chọn độ hiếm nổi bật",
  "Featured items must match the HSR banner type.":
    "Vật phẩm nổi bật phải khớp với loại banner HSR.",
  "Choose a matching role": "Chọn vai trò phù hợp",
  "Every active HSR banner needs one featured 5-star item.":
    "Mỗi banner HSR đang bật cần một vật phẩm 5 sao nổi bật.",
  'The active banner "{{name}}" needs exactly one featured 5-star item.':
    'Banner đang hoạt động "{{name}}" cần chính xác một vật phẩm 5 sao nổi bật.',
  "Rate-up": "Tăng tỉ lệ",
  "Primary featured": "Nổi bật chính",
  "Secondary rate-up": "Tăng tỉ lệ phụ",
  "Banner theme": "Chủ đề banner",
  "Banner element": "Nguyên tố banner",
  "Banner active": "Bật banner",
  "Banner starts": "Banner bắt đầu",
  "Banner ends": "Banner kết thúc",
  "Leave empty to make it available immediately.":
    "Để trống để banner khả dụng ngay lập tức.",
  "Leave empty to keep it running until you close it.":
    "Để trống để banner tiếp tục chạy cho đến khi bạn tắt.",
  "Times use your current device timezone.":
    "Thời gian sử dụng múi giờ hiện tại của thiết bị.",
  'Banner "{{name}}" must end after it starts.':
    'Banner "{{name}}" phải kết thúc sau thời gian bắt đầu.',
  "Check banner schedule": "Kiểm tra lịch banner",
  "Simulator rules": "Quy tắc mô phỏng",
  "Shared availability and pity across every banner.":
    "Trạng thái và bảo hiểm dùng chung cho mọi banner.",
  Element: "Nguyên tố",
  "Element icon": "Biểu tượng nguyên tố",
  "Weapon class": "Loại vũ khí",
  "featured items": "vật phẩm nổi bật",
  items: "vật phẩm",
  shown: "hiển thị",
  active: "hoạt động",
  featured: "nổi bật",
  Add: "Thêm",
  "Preparing the shop’s merch banners.":
    "Đang chuẩn bị các banner merch của gian hàng.",
  "Give the minigame and every banner a title.":
    "Hãy đặt tên cho minigame và mọi banner.",
  "Every active banner needs at least one active merch item.":
    "Mỗi banner đang bật cần ít nhất một merch đang hoạt động.",
  "The active game needs at least one active {{rarity}}-star item across its banners.":
    "Game đang hoạt động cần ít nhất một vật phẩm {{rarity}} sao đang bật trong các banner.",
  'The active banner "{{name}}" needs at least one active merch item.':
    'Banner đang hoạt động "{{name}}" cần ít nhất một vật phẩm đang bán.',
  "Featured slots are full": "Đã đủ vị trí nổi bật",
  "This banner can show up to {{count}} featured items.":
    "Banner này có thể hiển thị tối đa {{count}} vật phẩm nổi bật.",
  Sword: "Kiếm",
  Claymore: "Trọng kiếm",
  Polearm: "Vũ khí cán dài",
  Bow: "Cung",
  Catalyst: "Pháp khí",
  "Minigame studio": "Xưởng minigame",
  "Turn your merch into characters and weapons for a free minigame.":
    "Biến merch thành nhân vật và vũ khí trong minigame miễn phí.",
  "Shelf wishes": "Điều ước kệ hàng",
  "Create a free character-and-weapon minigame using your real merch catalog.":
    "Tạo minigame nhân vật và vũ khí miễn phí từ danh mục merch thật.",
  "Open preview": "Mở bản xem thử",
  "Public minigame": "Minigame công khai",
  "Add merch, then tune rarity, role, and featured placement.":
    "Thêm merch, sau đó điều chỉnh độ hiếm, vai trò và vị trí nổi bật.",
  "Customers can play from the storefront.": "Khách có thể chơi từ cửa hàng.",
  "Only staff can preview it until you open it.":
    "Chỉ staff có thể xem thử cho đến khi bạn mở minigame.",
  Open: "Đang mở",
  Closed: "Đã đóng",
  "Minigame title": "Tên minigame",
  Introduction: "Giới thiệu",
  "Warp title": "Tên Warp",
  "Wish title": "Tên Wish",
  "4-star pity": "Bảo hiểm 4 sao",
  "5-star pity": "Bảo hiểm 5 sao",
  "Character 5-star pity": "Bảo hiểm nhân vật 5 sao",
  "Light Cone 5-star pity": "Bảo hiểm Nón Ánh Sáng 5 sao",
  "4-star base rate": "Tỷ lệ cơ bản 4 sao",
  "5-star base rate": "Tỷ lệ cơ bản 5 sao",
  "Character 5-star base rate": "Tỷ lệ cơ bản nhân vật 5 sao",
  "Light Cone 5-star base rate": "Tỷ lệ cơ bản Nón Ánh Sáng 5 sao",
  "Chance per pull before pity increases the rate.":
    "Xác suất mỗi lượt trước khi bảo hiểm tăng tỷ lệ.",
  "Guarantee a 4-star or higher within this many pulls.":
    "Đảm bảo nhận 4 sao trở lên trong số lượt này.",
  "Guarantee a 5-star within this many pulls.":
    "Đảm bảo nhận 5 sao trong số lượt này.",
  "4-star soft pity": "Mốc tăng tỷ lệ 4 sao",
  "5-star soft pity": "Mốc tăng tỷ lệ 5 sao",
  "Character 5-star soft pity": "Mốc tăng tỷ lệ nhân vật 5 sao",
  "Light Cone 5-star soft pity": "Mốc tăng tỷ lệ Nón Ánh Sáng 5 sao",
  "Start increasing the 4-star rate from this pull.":
    "Bắt đầu tăng tỷ lệ 4 sao từ lượt này.",
  "Start increasing the 5-star rate from this pull.":
    "Bắt đầu tăng tỷ lệ 5 sao từ lượt này.",
  "Featured-item rate": "Tỷ lệ vật phẩm nổi bật",
  "Chance that a 4-star or 5-star pull uses its featured pool.":
    "Xác suất lượt 4 hoặc 5 sao lấy vật phẩm từ pool nổi bật.",
  "Featured guarantee": "Bảo hiểm vật phẩm nổi bật",
  "After a non-featured pull, guarantee the next item of that rarity is featured.":
    "Sau khi trượt vật phẩm nổi bật, đảm bảo vật phẩm tiếp theo cùng độ hiếm sẽ là vật phẩm nổi bật.",
  "Each soft pity must be at least 1 and lower than its hard pity.":
    "Mỗi mốc tăng tỷ lệ phải từ 1 trở lên và thấp hơn mốc bảo hiểm cứng.",
  "The featured-item rate must be between 0% and 100%.":
    "Tỷ lệ vật phẩm nổi bật phải nằm trong khoảng 0% đến 100%.",
  "Merch wish pool": "Pool điều ước merch",
  "Choose products, present them as characters or weapons, and tune their rarity.":
    "Chọn sản phẩm, đặt vai trò nhân vật hoặc vũ khí và điều chỉnh độ hiếm.",
  "Publishing…": "Đang xuất bản…",
  "Publish gacha": "Xuất bản gacha",
  "Publish HSR warp": "Xuất bản Warp HSR",
  "Publish Genshin wish": "Xuất bản Wish Genshin",
  "active merch": "merch đang hoạt động",
  "Base rarity rates are 90% / 9% / 1%. Weight changes which item appears within the same rarity.":
    "Tỷ lệ cơ bản là 90% / 9% / 1%. Trọng số quyết định vật phẩm xuất hiện trong cùng độ hiếm.",
  "Search merch…": "Tìm merch…",
  "Hidden product": "Sản phẩm bị ẩn",
  "This product is hidden and won't show up in the storefront wish pool.":
    "Sản phẩm này đang bị ẩn và sẽ không xuất hiện trong pool ước của cửa hàng.",
  Included: "Đã thêm",
  "Add to pool": "Thêm vào pool",
  Character: "Nhân vật",
  Weapon: "Vũ khí",
  Rarity: "Độ hiếm",
  Weight: "Trọng số",
  "No matching merch": "Không có merch phù hợp",
  "Try another product name, code, or category.":
    "Hãy thử tên, mã hoặc danh mục sản phẩm khác.",
  "Loading gacha settings…": "Đang tải cài đặt gacha…",
  "Preparing the shop’s merch pool.": "Đang chuẩn bị pool merch của gian hàng.",
  "Could not load the minigame.": "Không thể tải minigame.",
  "Gacha unavailable": "Gacha không khả dụng",
  "Give the minigame a title.": "Hãy đặt tên cho minigame.",
  "Check gacha settings": "Kiểm tra cài đặt gacha",
  "The 5-star pity must be higher than the 4-star pity.":
    "Bảo hiểm 5 sao phải lớn hơn bảo hiểm 4 sao.",
  "The Light Cone 5-star pity must be higher than the 4-star pity.":
    "Bảo hiểm Nón Ánh Sáng 5 sao phải lớn hơn bảo hiểm 4 sao.",
  "The 4-star and 5-star base rates must total less than 100%.":
    "Tổng tỷ lệ cơ bản 4 sao và 5 sao phải nhỏ hơn 100%.",
  "The 4-star and Light Cone 5-star base rates must total less than 100%.":
    "Tổng tỷ lệ cơ bản 4 sao và Nón Ánh Sáng 5 sao phải nhỏ hơn 100%.",
  "Incomplete prize pool": "Pool phần thưởng chưa đầy đủ",
  'The active banner "{{name}}" needs at least one active 3-star, 4-star, and 5-star item.':
    'Banner đang bật "{{name}}" cần ít nhất một vật phẩm 3 sao, 4 sao và 5 sao đang hoạt động.',
  "Check warp settings": "Kiểm tra cài đặt Warp",
  "Add at least one active merch item before opening the minigame.":
    "Thêm ít nhất một merch đang hoạt động trước khi mở minigame.",
  "Wish pool is empty": "Pool điều ước đang trống",
  "Gacha settings published.": "Đã xuất bản cài đặt gacha.",
  "Could not save the minigame.": "Không thể lưu minigame.",
  "Could not publish gacha": "Không thể xuất bản gacha",
  "Moonlight Girl": "Cô gái Ánh Trăng",
  "Festival Cats": "Mèo Lễ Hội",
  "Moonlight Stand": "Standee Ánh Trăng",
  "Postcard Pack": "Bộ bưu thiếp",
  "Moon Stand × 2": "Standee Ánh Trăng × 2",
  "Sticker Pack × 1": "Bộ sticker × 1",
  "Print Set × 1": "Bộ tranh in × 1",
  "Game Theme": "Chủ đề game",
  "Game editor": "Trình chỉnh sửa game",
  "Availability & game": "Trạng thái & game",
  "Choose the simulator and whether customers can play it.":
    "Chọn trình mô phỏng và quyết định khách hàng có thể chơi hay không.",
  "Public copy": "Nội dung công khai",
  "Name the experience and briefly tell customers what they can win.":
    "Đặt tên trải nghiệm và giới thiệu ngắn gọn phần thưởng cho khách hàng.",
  "Turn this minigame on or off for customers.":
    "Bật hoặc tắt minigame này cho khách hàng.",
  "Choose the active simulator game.":
    "Chọn trò chơi mô phỏng đang hoạt động.",
  "Title shown on the storefront banner.":
    "Tiêu đề hiển thị trên banner cửa hàng.",
  "Brief description of rewards.":
    "Mô tả ngắn gọn về phần thưởng.",
  "Warp pool": "Pool Warp",
  "Current banner": "Banner hiện tại",
  "Reward setup": "Thiết lập phần thưởng",
  Configure: "Cấu hình",
  "Select a banner, edit its public copy, then choose its featured rewards.":
    "Chọn banner, chỉnh sửa nội dung công khai, rồi chọn phần thưởng nổi bật.",
  "Banners & pool": "Banner & pool",
  "Gacha status": "Trạng thái gacha",
  "Each game keeps its own banners and prize pool.":
    "Mỗi game giữ banner và pool phần thưởng riêng.",
  "Banner duplicated": "Đã nhân bản banner",
  "Pool items are not copied — each merch item can only belong to one banner.":
    "Các vật phẩm trong pool không được sao chép — mỗi merch chỉ có thể thuộc về một banner.",
  "Already in another banner": "Đã có trong banner khác",
  "This item is already in “{{banner}}”. Remove it there first.":
    "Vật phẩm này đã có trong “{{banner}}”. Hãy xóa nó ở đó trước.",
  "In “{{banner}}”": "Trong “{{banner}}”",
  "Banner {{number}}": "Banner {{number}}",
  "Editing banner": "Đang chỉnh sửa banner",
  "Light Cone": "Nón Ánh Sáng",
  Path: "Vận Mệnh",
  Destruction: "Hủy Diệt",
  Hunt: "Săn Bắn",
  Erudition: "Tri Thức",
  Harmony: "Hòa Hợp",
  Nihility: "Hư Vô",
  Preservation: "Bảo Hộ",
  Abundance: "Trù Phú",
  Physical: "Vật Lý",
  Fire: "Hỏa",
  Ice: "Băng",
  Lightning: "Lôi",
  Wind: "Phong",
  Quantum: "Lượng Tử",
  Imaginary: "Số Ảo",
  "Could not save draft": "Không thể lưu bản nháp",
  "Gacha draft saved.": "Đã lưu bản nháp gacha.",
  "Add at least three active products so the pool can include 3-star, 4-star, and 5-star rewards.":
    "Hãy thêm ít nhất ba sản phẩm đang hoạt động để pool có phần thưởng 3 sao, 4 sao và 5 sao.",
  "More merch needed": "Cần thêm merch",
  "Recommended pool created. Review it, then publish when ready.":
    "Đã tạo pool đề xuất. Hãy kiểm tra rồi xuất bản khi sẵn sàng.",
  "Quick setup": "Thiết lập nhanh",
  "Create a playable pool from your active merch, using safe recommended defaults. Everything remains editable and undoable.":
    "Tạo pool chơi được từ merch đang hoạt động bằng thiết lập đề xuất an toàn. Bạn vẫn có thể chỉnh sửa hoặc hoàn tác mọi thứ.",
  "Use recommended setup": "Dùng thiết lập đề xuất",
  "Publishing switches the public minigame to {{game}}. Continue?": "Xuất bản sẽ chuyển minigame công khai sang {{game}}. Tiếp tục?",
  "Delete banner “{{name}}”? Its pool items will be removed too.": "Xóa banner “{{name}}”? Các vật phẩm trong pool của nó cũng sẽ bị xóa theo.",
  "Availability, public copy, and pity rules for this game.": "Trạng thái hoạt động, nội dung công khai và luật bảo hiểm của game này.",
  "Availability, public copy, rates, and pity rules for this game.":
    "Trạng thái hoạt động, nội dung công khai, tỷ lệ và luật bảo hiểm của game này.",
  "1 · Status & copy": "1 · Trạng thái & nội dung",
  "Choose whether customers can play and what they see before starting.":
    "Chọn việc khách có thể chơi hay không và nội dung họ thấy trước khi bắt đầu.",
  "2 · Prizes & banners": "2 · Phần thưởng & banner",
  "Choose one banner, then manage its prizes without leaving this card.":
    "Chọn một banner rồi quản lý phần thưởng ngay trong khu vực này.",
  "3 · Luck & guarantees": "3 · May mắn & bảo hiểm",
  "Start with a simple preset. Advanced odds stay out of the way until needed.":
    "Bắt đầu bằng thiết lập đơn giản. Tỷ lệ nâng cao chỉ hiện khi cần.",
  "Review luck settings": "Xem thiết lập may mắn",
  "Choose a preset": "Chọn thiết lập có sẵn",
  Availability: "Trạng thái hoạt động",
  "Live now": "Đang hoạt động",
  Unsaved: "Chưa lưu",
  Draft: "Bản nháp",
  "{{banners}} banners · {{items}} items": "{{banners}} banner · {{items}} vật phẩm",
  "Save draft": "Lưu bản nháp",
  "Enable at least one banner before publishing the minigame.":
    "Hãy bật ít nhất một banner trước khi xuất bản minigame.",
  "No active banner": "Không có banner đang hoạt động",
  "Luck & guarantees": "Tỷ lệ & bảo hiểm",
  "Pick a preset, or fine-tune the odds yourself.":
    "Chọn thiết lập có sẵn hoặc tự điều chỉnh tỷ lệ.",
  "Odds presets": "Mẫu tỷ lệ",
  "4★ guaranteed by pull #{{count}}": "Bảo hiểm 4★ ở lượt #{{count}}",
  "5★ guaranteed by pull #{{count}}": "Bảo hiểm 5★ ở lượt #{{count}}",
  "Light Cone 5★ guaranteed by pull #{{count}}":
    "Bảo hiểm Nón Ánh Sáng 5★ ở lượt #{{count}}",
  "Customize odds": "Tùy chỉnh tỷ lệ",
  "Fine-tune base rates, luck ramps, and promoted-prize rules.":
    "Điều chỉnh tỷ lệ cơ bản, mốc tăng tỷ lệ và luật phần thưởng quảng bá.",
  "Chance per pull before luck starts improving.":
    "Tỷ lệ mỗi lượt trước khi bắt đầu tăng may mắn.",
  "4★ guaranteed within N pulls": "Bảo hiểm 4★ trong N lượt",
  "4★ luck improves after pull #": "May mắn 4★ tăng sau lượt #",
  "Light Cone 5★ guaranteed within N pulls":
    "Bảo hiểm Nón Ánh Sáng 5★ trong N lượt",
  "Light Cone 5★ luck improves after pull #":
    "May mắn Nón Ánh Sáng 5★ tăng sau lượt #",
  "Promoted-prize chance": "Tỷ lệ phần thưởng quảng bá",
  "Chance that a 4★ or 5★ pull lands on a promoted prize.":
    "Tỷ lệ lượt quay 4★ hoặc 5★ nhận được phần thưởng quảng bá.",
  "Guarantee promoted prize after a miss":
    "Đảm bảo phần thưởng quảng bá sau lượt trật",
  "After a 4★ or 5★ pull misses the promoted prize, the next one is guaranteed.":
    "Sau khi lượt 4★ hoặc 5★ trật phần thưởng quảng bá, lượt tiếp theo chắc chắn nhận.",
  "Assign 4★ and 5★ merch prizes for this specific banner. 3★ pulls use the shared souvenir pool.":
    "Gán phần thưởng merch 4★ và 5★ cho banner này. Lượt quay 3★ sẽ dùng kho quà lưu niệm chung.",
  "Banner Prizes ({{count}})": "Phần thưởng banner ({{count}})",
  "Add merch ({{count}})": "Thêm merch ({{count}})",
  "Included ({{count}})": "Đã thêm ({{count}})",
  "3★ filler ({{count}})": "Phần thưởng phụ 3★ ({{count}})",
  "3★ filler prizes": "Phần thưởng phụ 3★",
  "These prizes are shared by every banner in this game.":
    "Các phần thưởng này được dùng chung cho mọi banner trong game.",
  Promoted: "Quảng bá",
  "Banner actions": "Thao tác banner",
  "Move earlier": "Chuyển lên trước",
  "Move later": "Chuyển xuống sau",
  "Saving draft…": "Đang lưu bản nháp…",
  "Draft saved": "Đã lưu bản nháp",
  "Discard changes": "Bỏ thay đổi",
  "Discard all unpublished changes for this game?":
    "Bỏ toàn bộ thay đổi chưa xuất bản của game này?",
  "Add to banner": "Thêm vào banner",
  "Shared 3★ Souvenir Pool": "Kho quà lưu niệm 3★ chung",
  "Items awarded for 3★ pulls across all banners in this game.":
    "Các vật phẩm trao cho lượt 3★ ở tất cả banner trong game này.",
  "Custom 3★ Merch ({{count}})": "Merch 3★ tùy chỉnh ({{count}})",
  "Add 3★ Merch ({{count}})": "Thêm merch 3★ ({{count}})",
  "Search merch to add…": "Tìm merch để thêm…",
  "Remove from 3★ shared pool": "Xóa khỏi kho 3★ chung",
  "No custom 3★ merch items added. Default souvenirs will be awarded automatically.":
    "Chưa thêm merch 3★ tùy chỉnh. Quà lưu niệm mặc định sẽ tự động được trao.",
  "Add as 3★ item": "Thêm làm vật phẩm 3★",
  "No available merch products to add as 3★ items.":
    "Không có sản phẩm merch nào khả dụng để thêm làm vật phẩm 3★.",
};

type Variables = Record<string, string | number>;

function interpolate(message: string, variables?: Variables) {
  if (!variables) return message;
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.split(`{{${key}}}`).join(String(value)),
    message,
  );
}

function getInitialLocale(): PlatformLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "vi") return stored;
  } catch {
    // Storage is optional; fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

type PlatformI18nValue = {
  locale: PlatformLocale;
  setLocale: (locale: PlatformLocale) => void;
  t: (english: string, variables?: Variables) => string;
};

const PlatformI18nContext = createContext<PlatformI18nValue | null>(null);

export function PlatformI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PlatformLocale>(getInitialLocale);
  const value = useMemo<PlatformI18nValue>(
    () => ({
      locale,
      setLocale(nextLocale) {
        setLocaleState(nextLocale);
        try {
          localStorage.setItem(STORAGE_KEY, nextLocale);
        } catch {
          // Storage is optional; the current session still updates.
        }
      },
      t(english, variables) {
        return interpolate(
          locale === "vi" ? (vi[english] ?? english) : english,
          variables,
        );
      },
    }),
    [locale],
  );

  return (
    <PlatformI18nContext.Provider value={value}>
      {children}
    </PlatformI18nContext.Provider>
  );
}

export function usePlatformI18n() {
  const value = useContext(PlatformI18nContext);
  if (!value)
    throw new Error("usePlatformI18n must be used inside PlatformI18nProvider");
  return value;
}

export function getPlatformTranslation(
  english: string,
  locale: PlatformLocale,
  variables?: Variables,
) {
  return interpolate(
    locale === "vi" ? (vi[english] ?? english) : english,
    variables,
  );
}

export const platformVietnameseTranslations = vi;
