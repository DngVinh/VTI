# AIP-AIU-11 — Frontend Design System, UI Components & Interaction Specifications

## 1. Mục Tiêu & Nguyên Tắc Thiết Kế UI/UX (Design Principles)

Tài liệu này chuẩn hóa toàn bộ giao diện, bảng màu, trạng thái tương tác và component cho các tính năng nâng cấp AI trong phòng phỏng vấn (`client/src/features/InterviewRoom`).

Các nguyên tắc thiết kế cốt lõi:
1. **Zero Distraction for Candidate**: Giao diện tập trung tối đa vào câu hỏi và không gian trả lời. Các thông tin phản biện của AI xuất hiện tự nhiên, không che khuất màn hình làm bài.
2. **Accessible & Responsive**: Tuân thủ chuẩn trợ năng WCAG 2.1 AA (độ tương phản màu, hỗ trợ phím Tab, nhãn aria-label đầy đủ).
3. **Tailwind CSS V4 & Design Tokens**: Sử dụng trực tiếp bộ màu Indigo chuẩn của Tailwind v4 (khớp với `client/src/design-system/tokens.ts`), đảm bảo không bị lỗi build CSS.

---

## 2. Bảng Màu & Tokens Sử Dụng (Color Palette)

| Mục Đích Giao Diện | Lớp Tailwind v4 | Mã Màu Hex | Áp Dụng Cho |
| :--- | :--- | :--- | :--- |
| **Chủ đạo AI (Indigo)** | `indigo-600`, `indigo-700` | `#4f46e5`, `#4338ca` | Avatar AI, viền bong bóng chat AI, nút hành động chính, thanh tiến độ. |
| **Ứng viên (Slate Neutral)** | `slate-700`, `slate-800` | `#334155`, `#1e293b` | Bong bóng chat ứng viên, text chính, thanh điều hướng. |
| **Cảnh báo Lỗ hổng (Gap Alert)**| `amber-500`, `amber-50` | `#f59e0b`, `#fffbeb` | Khung cảnh báo kiến thức hổng (Gap Analysis), độ khó Medium. |
| **Thành công & Khớp (Pass)** | `emerald-600`, `emerald-50` | `#059669`, `#ecfdf5` | Test case đã vượt qua (Passed), độ khó Easy, trạng thái kết nối tốt. |
| **Nguy hiểm & SPOF (Critical)**| `rose-600`, `rose-50` | `#e11d48`, `#fff1f2` | Điểm chết duy nhất (SPOF), test case lỗi (Failed), độ khó Hard. |

---

## 3. Đặc Tả Chi Tiết Từng Component Giao Diện

---

### 3.1 Component: `ConversationThread.tsx` (Luồng Hội Thoại Chat Socratic)

#### Cấu Trúc Bố Cục (Layout Anatomy)
- **Container**: Vùng cuộn dọc có thanh cuộn mượt (`overflow-y-auto max-h-[500px]`), tự động cuộn xuống đáy (`scrollIntoView({ behavior: 'smooth' })`) mỗi khi có lượt mới.
- **Bong bóng AI (Left-aligned)**:
  - Avatar tròn 36px màu Indigo kèm biểu tượng Robot.
  - Nhãn tiêu đề: "AI Phỏng Vấn Viên" + nhãn thời gian tương đối ("vừa xong").
  - Thân tin nhắn: Nền trắng, viền `border-indigo-100`, đổ bóng nhẹ `shadow-sm`.
  - Hỗ trợ định dạng Markdown và khối mã cú pháp.
  - Nút loa nghe đọc câu hỏi (TTS) đính kèm góc phải.
- **Bong bóng Ứng viên (Right-aligned)**:
  - Avatar tròn 36px màu Slate với chữ cái đầu của ứng viên.
  - Thân tin nhắn: Nền `bg-slate-800 text-white`, bo góc mềm `rounded-2xl rounded-tr-none`.
- **Thẻ Nhận diện Lỗ hổng (Gap Analysis Banner)**:
  - Xuất hiện ngay dưới câu trả lời của ứng viên nếu AI phát hiện điểm thiếu sót.
  - Khung màu hổ phách `border-amber-200 bg-amber-50/80`.
  - Tiêu đề: "Điểm cần làm rõ thêm" kèm danh sách gạch đầu dòng ngắn gọn.
- **Chỉ Báo AI Đang Suy Nghĩ (Thinking Indicator)**:
  - Xuất hiện khi `isAnalyzing === true`.
  - 3 chấm tròn chuyển động sóng nhấp nháy (`animate-bounce`) màu Indigo.

---

### 3.2 Component: `AdaptiveDifficultyBadge.tsx` (Huy Hiệu Độ Khó Thích Ứng)

#### Trạng Thái Hiển Thị (Visual States)
- **Độ khó Easy**: Viền xanh ngọc `text-emerald-700 bg-emerald-50 border-emerald-200`, nhãn "Cơ Bản".
- **Độ khó Medium**: Viền hổ phách `text-amber-700 bg-amber-50 border-amber-200`, nhãn "Trung Cấp".
- **Độ khó Hard**: Viền đỏ hồng `text-rose-700 bg-rose-50 border-rose-200`, nhãn "Chuyên Sâu".
- **Biểu tượng Xu hướng**:
  - `↑ Tăng cấp`: Mũi tên xanh lá chỉ lên (Ứng viên làm bài tốt).
  - `↓ Giảm tải`: Mũi tên vàng chỉ xuống (Hỗ trợ ứng viên khi gặp khó khăn).
  - `↔ Ổn định`: Dấu gạch ngang màu xám (Duy trì phong độ).

---

### 3.3 Component: `CodeWorkspace.tsx` Nâng Cấp (Console & Test Runner Panel)

#### Bố Cục Chia Phân Đoạn (Split Panel)
```
┌────────────────────────────────────────────────────────────┐
│ [JS/TS/Python...]   [Indentation: 2]      [▶ Chạy Code F5] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  function twoSum(nums, target) {                           │
│    const map = new Map();                                  │
│    // ...                                                  │
│  }                                                         │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Tabs: [Console Stdout]  [Test Cases (3/3)]  [Big-O: O(N)]  │
├────────────────────────────────────────────────────────────┤
│ ✓ Test Case 1: [2, 7, 11, 15], target=9 -> Output: [0, 1]  │
│ ✓ Test Case 2: [3, 2, 4], target=6      -> Output: [1, 2]  │
│ 🔒 Test Case 3 (Ẩn): Passed (4.2ms, 12MB RAM)              │
└────────────────────────────────────────────────────────────┘
```

---

### 3.4 Component: `SystemDesignCanvas.tsx` (Bảng Vẽ & Lớp Phủ Phản Biện)

#### Thanh Công Cụ Kéo Thả (Draggable Toolbar)
- Cung cấp các khối thành phần hệ thống tiêu chuẩn:
  - 🌐 **Client / Web / Mobile**
  - 🛡️ **CDN / Cloudflare**
  - ⚖️ **Load Balancer (Nginx, ALB)**
  - 🚪 **API Gateway**
  - ⚙️ **Microservice / Backend Worker**
  - ⚡ **Cache (Redis, Memcached)**
  - 📬 **Message Queue (Kafka, RabbitMQ)**
  - 🗄️ **Database (PostgreSQL, MongoDB, Sharded DB)**
  - 📦 **Object Storage (S3, MinIO)**

#### Lớp Phủ Nhận Xét Thị Giác (Critique Overlay)
- Khi Gemini Vision hoàn tất phân tích:
  - Khung chữ nhật màu đỏ chớp nhẹ bao quanh vị trí phát hiện **SPOF** (Single Point of Failure).
  - Khung chữ nhật màu vàng cam bao quanh vị trí có **Bottleneck** về băng thông hoặc I/O.
  - Nhấp vào khung sẽ hiển thị popover giải thích chi tiết bằng tiếng Việt cùng gợi ý kiến trúc sửa đổi.

---

### 3.5 Component: `LiveAiInterviewerAvatar.tsx` (Avatar Sóng Âm & Đo Gaze)

#### Hiệu Ứng Sóng Âm (Waveform Visualizer)
- 5 thanh âm thanh chuyển động theo biên độ thực tế từ Web Audio API `AnalyserNode`:
  - Trạng thái **Đang Nghe (Listening)**: Vòng tròn hào quang màu xanh lục nhấp nháy êm dịu.
  - Trạng thái **Đang Suy Nghĩ (Thinking)**: Vòng tròn chuyển động xoay màu hổ phách.
  - Trạng thái **Đang Nói (Speaking)**: Các cột sóng âm dao động mạnh theo ngữ điệu giọng nói tiếng Việt.

#### Bảng Đo Độ Tập Trung Giao Tiếp (Gaze & Focus HUD)
- Đặt góc nhỏ trên camera preview của ứng viên:
  - Thanh đo **Giao tiếp mắt (Eye Contact)**: Hiển thị tỷ lệ phần trăm (ví dụ: `88% Tốt`).
  - Cảnh báo **Nhìn ra ngoài màn hình**: Nếu mắt ứng viên nhìn lệch quá 30 độ khỏi camera liên tục quá 5 giây, xuất hiện huy hiệu nhỏ nhắc nhở nhẹ nhàng nhằm chống gian lận.

---

## 4. Cú Pháp Kiểm Thử Giao Diện Client Chuẩn

```powershell
# Chạy kiểm thử đơn vị component client
npm --prefix client test -- src/features/InterviewRoom/__tests__/ConversationThread.test.tsx
npm --prefix client test -- src/features/InterviewRoom/__tests__/AdaptiveDifficultyBadge.test.tsx
npm --prefix client test -- src/features/InterviewRoom/__tests__/CodeWorkspaceRunner.test.tsx
```
