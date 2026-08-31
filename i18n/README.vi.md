<div align="center">
<div align="right">
  <a href="../README.md">English</a> | <a href="../README.fa.md">فارسی</a>
</div>

<img src="../assets/readme/hero.svg" width="100%" alt="NovaRoute">

**NovaRoute – Nền tảng Nhà cung cấp AI & Trò chuyện Nâng cao**

Nền tảng tự lưu trữ mạnh mẽ để quản lý các nhà cung cấp AI (API, CLI, OAuth, Cookie), xây dựng tổ hợp mô hình và trò chuyện với tất cả mô hình của bạn ở một nơi.

[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](../LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/IRNova/NovaRoute)
</div>

---

## 🚀 Cài đặt một dòng

Chạy trên máy chủ Linux mới (Ubuntu/Debian, RHEL/CentOS/Fedora hoặc tương thích):

```bash
curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
```

Trình cài đặt sẽ:

1. Cài đặt Node.js nếu thiếu.
2. Clone kho lưu trữ này vào `/opt/novaroute`.
3. Cài đặt phụ thuộc và xây dựng bundle sản xuất.
4. Tạo người dùng Linux biệt lập `novaroute` và thư mục dữ liệu `/var/lib/novaroute`.
5. Tạo tệp `.env` bảo mật với khóa ngẫu nhiên.
6. Cài đặt và khởi chạy dịch vụ systemd tên `novaroute`.
7. Tự động cấu hình tất cả nhà cung cấp miễn phí không xác thực trên bảng điều khiển.

Cổng mặc định là **20126**. Trình cài đặt sẽ yêu cầu xác nhận hoặc thay đổi.

Sau khi cài đặt, mở bảng điều khiển:

```text
http://<server-ip>:20126/dashboard
```

---

## 🌐 API

NovaRoute hiển thị điểm cuối tương thích OpenAI tại:

```text
http://<server-ip>:12126/v1
```

---

## 📄 Giấy phép

NovaRoute được phát hành theo [MIT License](../LICENSE).
