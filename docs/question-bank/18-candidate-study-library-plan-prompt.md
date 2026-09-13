# PROMPT YÊU CẦU: TRIỂN KHAI THƯ VIỆN CÂU HỎI & ĐÁP ÁN MẪU CHO ỨNG VIÊN (CANDIDATE STUDY LIBRARY)

## 1. Bối cảnh dự án
Dự án: **Hệ thống Luyện phỏng vấn IT bằng AI (VTI Intern)**
- **Stack**: Node.js, Express (TypeScript), MongoDB/Mongoose, React 19, Vite, Tailwind CSS v4.
- **Hiện trạng Question Bank (AIP-62–AIP-68)**: Đã hoàn thiện toàn bộ hệ thống quản trị nội bộ (Admin CMS) bao gồm: Quản lý phiên bản câu hỏi (Draft, Published), phân loại Taxonomy (Role, Level, Technology), tiêu chí chấm (Rubric), giải thích đáp án mẫu (`explanation`), quy trình duyệt 4-eyes, và cơ chế bốc đề phỏng vấn.
- **Vấn đề cần giải quyết**: Hiện tại ứng viên (Candidate) và khách (Guest) chưa có giao diện tra cứu ngân hàng câu hỏi để ôn tập. Cần mở tính năng **"Thư viện câu hỏi & Đáp án mẫu ôn tập"** cho người dùng trực tiếp học tập, tra cứu đáp án chuẩn và luyện tập.

---

## 2. Mục tiêu kỹ thuật
1. **Bảo toàn hệ thống CMS Admin**: Giữ nguyên toàn bộ logic Admin CMS hiện có (`/admin/question-bank`) để quản trị viên tiếp tục soạn thảo, import, dùng AI sinh đề và duyệt câu hỏi. Không làm gãy 180+ bài test hiện tại.
2. **Xây dựng API công khai cho Ứng viên (Public Study API)**:
   - `GET /api/v1/questions/public`: Lấy danh sách câu hỏi có trạng thái `PUBLISHED`. Hỗ trợ phân trang, tìm kiếm từ khóa, lọc theo `roleId`, `levelId`, `technologyId`, `difficulty`, `questionType`.
   - `GET /api/v1/questions/public/:id`: Lấy chi tiết một câu hỏi đã `PUBLISHED`, trả về đầy đủ:
     + Đề bài (Prompt VI & EN).
     + Đáp án chuẩn & Lời giải thích chi tiết (`explanation` VI & EN).
     + Tiêu chí chấm điểm năng lực (`rubric` các mức điểm 0–4).
     + Thông tin phân loại (Role, Level, Technology, Topic).
3. **Phát triển giao diện Ứng viên (Candidate UI)**:
   - Thêm nút / menu **"Ngân hàng câu hỏi"** trên Navbar và Trang chủ (`HomePage.tsx`), hiển thị cho mọi vai trò (Khách, Candidate, Admin).
   - **Trang danh sách ôn tập (`/practice/questions` hoặc `/questions`)**:
     + Giao diện hiện đại, thân thiện người học.
     + Thanh tìm kiếm nhanh kèm bộ lọc trực quan (Vị trí, Cấp độ, Công nghệ, Độ khó).
     + Card hiển thị câu hỏi: Tiêu đề, tag công nghệ, độ khó, nút "Xem đáp án & lời giải".
   - **Trang chi tiết câu hỏi (`/practice/questions/:id`)**:
     + Trình bày đề bài rõ ràng, hỗ trợ chuyển đổi song ngữ (Việt - Anh).
     + Khu vực **"Đáp án chuẩn & Lời giải"** có định dạng code highlight (nếu có snippet).
     + Khu vực **"Tiêu chí đánh giá của nhà tuyển dụng"** (Rubric mức 0 đến 4).
     + Nút hành động nổi bật: **"Luyện phỏng vấn câu này với AI"** (dẫn vào phòng mock interview với câu hỏi đó).

---

## 3. Kế hoạch triển khai theo kỷ luật TDD (RED - GREEN - REFACTOR)

### Bước 1: Backend - Public Study API
1. Viết Unit & Integration test (`tests/public-question-study.integration.test.ts`):
   - Test lấy danh sách câu hỏi chỉ trả về bản `PUBLISHED` (không lọt `DRAFT` hay `RETIRED`).
   - Test bộ lọc Role, Level, Technology, Pagination.
   - Test lấy chi tiết câu hỏi trả về đúng `explanation` và `rubric`.
   - Test chặn xem chi tiết nếu câu hỏi chưa được `PUBLISHED` (trả về 404).
2. Triển khai Route, Controller, Service cho Public Question Study.
3. Chạy test xanh (Exit code 0).

### Bước 2: Frontend - Service & Hooks
1. Viết test `client/src/services/api/publicQuestionApi.test.ts`.
2. Tạo `publicQuestionApi.ts` gọi các endpoint mới.
3. Định nghĩa Zod schema & TypeScript type cho `PublicQuestionDetail`, `PublicQuestionSummary`.

### Bước 3: Frontend - UI Components & Pages
1. Tạo component `QuestionLibraryListPage.tsx`:
   - Bộ lọc Responsive (Role, Level, Tech, Search).
   - Grid danh sách Question Cards.
   - Phân trang mượt mà.
2. Tạo component `QuestionStudyDetailPage.tsx`:
   - Trình bày Đề bài, Đáp án chuẩn, Rubric, Chuyển ngữ VI/EN.
   - Tích hợp nút CTA luyện tập phỏng vấn.
3. Cập nhật `App.tsx` định tuyến route mới `/questions` và `/questions/:id`.
4. Cập nhật `HomePage.tsx` và Header dẫn link trực tiếp vào Thư viện.
5. Viết component test cho các trang mới (`QuestionLibraryPages.test.tsx`).

### Bước 4: Kiểm thử E2E & Bàn giao
1. Chạy toàn bộ test suite frontend & backend (`npm test`).
2. Khởi động ứng dụng, dùng headless browser chụp ảnh minh chứng:
   - Trang chủ có nút dẫn vào Thư viện câu hỏi.
   - Danh sách câu hỏi lọc theo Node.js / Middle.
   - Trang chi tiết hiển thị đề bài, đáp án mẫu và rubric chuẩn.
