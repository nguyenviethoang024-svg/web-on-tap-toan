# Web ôn tập Toán

Web tĩnh (HTML + JS thuần, không cần build) dùng Firebase để đăng nhập và lưu dữ liệu, deploy lên Vercel.

**Học sinh:** vào link → nhập tên + mã lớp → làm bài, tự động lưu, có chỗ chèn công thức.
**Giáo viên:** đăng nhập email → tạo lớp → soạn buổi (dán nhanh từ AI, có bàn phím ký hiệu toán) → bấm "Giao" → xem tiến độ, đọc bài làm, viết nhận xét.

## 1. Tạo project Firebase (≈10 phút)

1. Vào https://console.firebase.google.com → **Add project** (tắt Google Analytics cũng được).
2. **Build → Authentication → Get started → Sign-in method**, bật 2 mục:
   - **Email/Password** (cho giáo viên)
   - **Anonymous** (cho học sinh, họ không cần tạo tài khoản)
3. **Build → Firestore Database → Create database** → chọn **Production mode** → chọn vị trí (asia-southeast1 cho gần Việt Nam).
4. Tab **Rules** của Firestore: xóa nội dung cũ, dán toàn bộ nội dung file `firestore.rules` → **Publish**.
5. **Project settings (⚙) → General → Your apps → Web (`</>`)** → đặt tên, đăng ký → copy đoạn `firebaseConfig`.
6. Mở `firebase-config.js`, dán 4 giá trị `apiKey`, `authDomain`, `projectId`, `appId` vào. (Các giá trị này không phải bí mật; bảo mật nằm ở file rules.)

## 2. Chạy thử trên máy (tùy chọn)

```bash
npx serve .
```
Mở http://localhost:3000. Nếu đăng nhập báo lỗi domain: Firebase → Authentication → Settings → **Authorized domains** → thêm `localhost` (thường có sẵn).

## 3. Đưa lên Vercel

1. Tạo repo GitHub, đẩy cả thư mục này lên.
2. https://vercel.com → **Add New → Project** → chọn repo → **Framework Preset: Other**, để trống Build Command / Output Directory → **Deploy**.
3. Vercel cho một địa chỉ dạng `ten-du-an.vercel.app`. Copy địa chỉ đó (không có `https://`).
4. Quay lại Firebase → **Authentication → Settings → Authorized domains → Add domain** → dán `ten-du-an.vercel.app`. **Bước này bắt buộc**, thiếu thì đăng nhập sẽ lỗi.

Xong. Gửi học sinh link của lớp (trang lớp có nút "Sao chép link vào lớp", link đã gắn sẵn mã lớp).

## Cách dùng nhanh

1. Mở `https://…vercel.app/#/gv` → **Tạo tài khoản** → **Tạo lớp** → được mã 6 ký tự.
2. **+ Tạo buổi mới** → đặt tên, chương/phạm vi → mở "Dán nhanh từ AI", dán khối đề (có đánh số 1., 2., … hoặc ngăn cách bằng dòng trống) → **Thêm vào danh sách**.
   Công thức đặt trong `$...$`, ví dụ `$\mathbb{R}^n$`; hoặc bấm "Nhập công thức bằng bàn phím toán".
3. Tick **Giao cho học sinh** → **Lưu**.
4. **Kết quả**: bảng học sinh × bài; bấm vào dòng để đọc bài làm và viết nhận xét.

## Lưu ý

- Học sinh được nhận diện bằng thiết bị (Firebase Anonymous). Cùng một em làm trên máy khác sẽ thành một dòng mới trong bảng kết quả (bảng chỉ hiện bản mới nhất theo tên).
- Ai biết mã lớp đều vào được lớp, hãy coi mã như một mật khẩu chung; muốn khóa lại thì tạo lớp mới.
- Giáo viên đăng ký bằng email nào cũng tạo được lớp riêng của mình, nhưng không xem được lớp của người khác.
- Miễn phí: gói Spark của Firebase và gói Hobby của Vercel đủ cho một lớp học.
- Phần chatbot AI chưa làm (để sau). Khi làm, nên đặt ở một Vercel Function để không lộ API key.
