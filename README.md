# Backend 
Xây dựng API cho website bán nước hoa, quản lý sản phẩm, giỏ hàng, voucher, người dùng, và đơn hàng.

## Chức năng chính
- Quản lý sản phẩm với nhiều size và giá khác nhau
- Quản lý giỏ hàng động, tính tổng tiền, áp dụng voucher
- Quản lý voucher: tạo, sửa, xóa, kiểm tra điều kiện áp dụng
- Quản lý đơn hàng: lưu trữ, cập nhật trạng thái, liên kết thanh toán
- Quản lý người dùng: đăng ký, đăng nhập, phân quyền Admin/User
- Thống kê đơn hàng, doanh thu và sản phẩm bán chạy cho dashboard Admin

## Chức năng khác
- Bảo mật: JWT, httpOnly cookie, bcrypt mã hóa mật khẩu
- Xử lý lỗi (error handling) chuẩn, phản hồi hợp lệ cho Frontend

## Công nghệ sử dụng
- Node.js & Express
- MongoDB & Mongoose
- JWT & bcrypt
- Cloudinary (upload ảnh)
- Nodemailer (gửi email)

## Tài khoản demo Admin
    Email: admin@gmail.com
    Password: 888888

## Cài đặt & chạy dự án
```bash

git clone https://github.com/Vancong/ecommerce-be

cd ecommerce-be

npm install

cp .env.example .env


npm run dev
