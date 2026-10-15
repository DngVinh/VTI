# VTI Intern Practice: IT Interviews with AI

Đây là hệ thống phỏng vấn giả lập bằng AI dành cho các ứng viên IT, giúp thực hành và đánh giá kỹ năng chuyên môn trước các kỳ phỏng vấn thực tế.

## 🚀 Tiến độ dự án (Đã làm được gì?)

Tính đến thời điểm hiện tại, dự án đã hoàn thành các hạng mục cốt lõi sau:
1. **Thiết lập Base Project:** Setup thành công frontend (React) và backend (Node.js/Express) với TypeScript, cấu hình strict type-checking, ESLint và chuẩn commit.
2. **Interview Session State Machine:** Xây dựng thành công máy trạng thái (State Machine) quản lý vòng đời của một phiên phỏng vấn (từ `PENDING` -> `GENERATING` -> `IN_PROGRESS` -> `EVALUATING` -> `COMPLETED` hoặc `FAILED`).
3. **API Endpoints:** Hoàn thiện bộ API RESTful cho phiên phỏng vấn:
   - `POST /api/v1/interviews`: Tạo phiên phỏng vấn mới.
   - `GET /api/v1/interviews/:id`: Lấy trạng thái hiện hành (Dùng để chống lỗi F5/Reload trang).
   - `POST /api/v1/interviews/:id/generate`: Yêu cầu AI sinh câu hỏi (Tự động chuyển trạng thái).
   - `POST /api/v1/interviews/:id/submit`: Nộp bài và yêu cầu AI chấm điểm.
4. **Cơ chế Idempotency & Chống Spam:** Khắc phục triệt để lỗi người dùng refresh (F5) trang liên tục hoặc spam click nhờ vào kiến trúc State Pattern. Request gọi sai thời điểm sẽ bị chặn ngay lập tức.
5. **Typescript Strict Typing:** Đã loại bỏ hoàn toàn kiểu dữ liệu `any`, áp dụng các interface rõ ràng để đảm bảo an toàn mã nguồn.
6. **AI Provider (AIQ-01):** Hoàn thiện hệ thống Provider cung cấp AI theo chuẩn Strategy Pattern với 2 lựa chọn (cấu hình qua `.env`):
   - **MockAiProvider:** Sinh dữ liệu giả lập (mock data) và chấm điểm ngẫu nhiên để test luồng và giao diện mà không tốn chi phí gọi API.
   - **GeminiAiProvider:** Tích hợp mô hình `gemini-1.5-flash` của Google, đảm bảo cấu trúc trả về chuẩn JSON bằng tính năng JSON Output Schema. Tự động sinh ra 5 câu hỏi phỏng vấn dưới dạng song ngữ (Anh/Việt) có độ khó khác nhau.
7. **Đánh giá & Lộ trình Học Tập bằng AI:** Xây dựng tính năng AI tự động đọc hiểu câu trả lời, trả về Feedback nhận xét từng câu (song ngữ), điểm số tổng quan và Đề xuất Lộ trình học tập (`learningPath`) dựa trên điểm yếu của ứng viên.
8. **Chống lỗi Rate Limit (Retry Logic):** Bổ sung cơ chế Exponential Backoff cho các lời gọi AI để vượt qua lỗi quá tải server (`429`) một cách tự động và an toàn.

## 🛠️ Công nghệ sử dụng
- **Backend:** Node.js, Express.js, TypeScript.
- **Frontend:** React, Vite (hoặc tương đương).
- **Database:** MongoDB (sử dụng Mongoose) - Multi-Document Transactions trên Replica Set.
- **Mẫu Thiết Kế (Design Patterns):** State Pattern, Layered Architecture, Dependency Injection.

## 🌱 Seed Question Bank mẫu

Sau khi cấu hình `MONGODB_URI` và khởi động MongoDB Replica Set, chạy từ thư mục repository:

```bash
npm run db:seed
```

Lệnh này tạo 20 câu hỏi IT interview song ngữ đã ở trạng thái `ACTIVE/PUBLISHED`, có taxonomy, đáp án, giải thích và rubric để hiển thị ngay trong study library. Seeder nhận diện bằng `sourceReference` ổn định nên chạy lại không tạo trùng và không ghi đè câu hỏi người dùng. Không tự seed sample trong production; chỉ bật rõ ràng bằng `SEED_SAMPLE_QUESTION_BANK=true` khi thực sự cần.

Kiểm tra thư viện user tại `http://localhost:5173/questions` (API: `GET /api/v1/questions/public`).

## 📐 Tuân thủ nghiêm ngặt nguyên tắc S.O.L.I.D

Dự án được thiết kế cấu trúc thư mục và viết code theo đúng 5 nguyên tắc S.O.L.I.D để đảm bảo dễ bảo trì và mở rộng:

1. **S - Single Responsibility Principle (Đơn Trách Nhiệm):**
   - **Cách áp dụng:** Phân chia rõ ràng Layered Architecture. `InterviewController` chỉ lo nhận HTTP Request và Response. `InterviewService` chỉ lo điều phối logic nghiệp vụ. Các thao tác DB được giao hẳn cho `InterviewRepository`. Mỗi `State` class (như `PendingState`, `InProgressState`) chỉ chịu trách nhiệm cho các hành vi nằm trong chính trạng thái đó.

2. **O - Open/Closed Principle (Đóng/Mở):**
   - **Cách áp dụng:** Thay vì dùng các lệnh `if/else` hoặc `switch/case` khổng lồ để kiểm tra trạng thái phỏng vấn (ví dụ: `if (status === 'PENDING')`), hệ thống sử dụng **State Design Pattern**. Nếu tương lai cần thêm trạng thái `PAUSED` (Tạm dừng), ta chỉ việc tạo class `PausedState` mới implement `IInterviewState` mà không cần sửa đổi mã nguồn của Context hay Service hiện tại.

3. **L - Liskov Substitution Principle (Thay thế Liskov):**
   - **Cách áp dụng:** `InterviewContext` tương tác với các state thông qua interface `IInterviewState`. Bất kỳ state cụ thể nào (như `GeneratingState`, `CompletedState`) cũng có thể thay thế cho nhau vào biến `this.state` trong Context mà không làm phá vỡ logic chương trình. Nếu một State không hỗ trợ hàm đó, nó sẽ ném ra `InvalidStateTransitionException` đúng chuẩn quy định của Interface.

4. **I - Interface Segregation Principle (Phân tách Interface):**
   - **Cách áp dụng:** Các interface được thiết kế nhỏ gọn và đúng mục đích. Ví dụ, `IInterviewRepository` chỉ chứa các hàm cần thiết để quản lý Interview (`create`, `findById`, `updateStatus`, `update`). Tránh việc phình to một interface ép các class phải implement những hàm không cần thiết.

5. **D - Dependency Inversion Principle (Đảo ngược Dependency):**
   - **Cách áp dụng:** `InterviewService` không phụ thuộc trực tiếp vào class cụ thể (concrete) mà phụ thuộc vào bản vẽ (abstraction) là các interface `IInterviewRepository` và `IAiProvider`. Nhờ thư viện **TSyringe**, hệ thống thực hiện Dependency Injection (DI) hoàn toàn tự động. `InterviewService` nhận các interface này qua tham số constructor (`@inject()`), nhờ đó ta có thể linh hoạt hoán đổi giữa `MockAiProvider` và `GeminiAiProvider` thông qua file `.env` (hoặc đổi Database từ Mongoose sang Prisma) mà **không cần sửa một dòng code nào trong Service**. Mọi logic nghiệp vụ (domain) hoàn toàn không biết gì về cơ sở dữ liệu hay chi tiết API của Google.
