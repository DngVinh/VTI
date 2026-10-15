# AIP-AIU-05 — Phase 5: Gemini Multimodal Live Audio Stream & Real-time Vision

## 1. Executive Summary & Acceptance Criteria

Pha 5 thay thế hoàn toàn Web Speech API trình duyệt (vốn có giọng đọc cơ học, độ trễ cao, phụ thuộc hệ điều hành client) bằng **Luồng Hội Thoại Trực Tiếp Hai Chiều (Full-Duplex Multimodal Live Audio Stream)** kết hợp **Phân Tích Cử Chỉ & Tương Tác Bằng Thị Giác Máy Tính On-Device (MediaPipe Face & Gaze Tracking)**.

### Acceptance Criteria (AC):
1. **AC-01 (Full-Duplex Audio Streaming)**: Kết nối âm thanh hai chiều thời gian thực qua WebSocket Relay tới Gemini Multimodal Live API. Độ trễ phản hồi đàm thoại (Voice-to-Voice Latency) duy trì < 1200ms.
2. **AC-02 (Bilingual Voice with Vietnamese Priority)**:
   - Giọng nói của AI sử dụng Neural voice tiếng Việt (`vi-VN-Neural2-A`) với ngữ điệu tự nhiên, nhấn nhá kỹ thuật chuẩn mực.
   - STT tự động lọc tạp âm và nhận diện chính xác các từ đệm tiếng Việt ("ừm", "ờ", "kiểu như", "thì là mà", "dạ").
3. **AC-03 (Intelligent Interruption Handling)**:
   - Ứng viên có thể cắt lời AI bất cứ lúc nào để hỏi lại yêu cầu đề bài; AI ngừng phát âm thanh ngay lập tức (Zero Latency Cutoff).
   - AI có khả năng nhắc nhở lịch sự khi ứng viên nói lạc đề quá 60 giây.
4. **AC-04 (On-Device Privacy-Preserving Vision Metrics)**:
   - Sử dụng MediaPipe Vision chạy trực tiếp trên trình duyệt client (Edge AI), không truyền video stream thô về server để đảm bảo quyền riêng tư.
   - Đo lường: Độ duy trì giao tiếp mắt (Eye Contact Ratio), hướng nhìn màn hình phụ (gaze off-screen detection nhằm chống gian lận), và nhịp thở/tốc độ nói (WPM).

---

## 2. Danh Sách Micro-Tasks (1 Seam - 1 File)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Micro-Task 5.1: Định nghĩa WebSocket Audio Stream Protocol & Payloads  │
│ Micro-Task 5.2: Triển khai WebSocket Server Relay Cho Gemini Live API   │
│ Micro-Task 5.3: Module Audio Buffer Resampler (16kHz PCM <-> Browser) │
│ Micro-Task 5.4: Fallback Cloud TTS Service (Google vi-VN Neural2)      │
│ Micro-Task 5.5: Controller & WebSocket Upgrade Route                   │
│ Micro-Task 5.6: Client Audio Worklet Processor (PCM Streamer)          │
│ Micro-Task 5.7: Client Hook useGeminiLiveAudio                         │
│ Micro-Task 5.8: Component LiveAiInterviewerAvatar (Mouth Sync Waveform)│
│ Micro-Task 5.9: Client Hook useMediaPipeGazeTracker (On-Device Vision) │
│ Micro-Task 5.10: Integration Test Toàn Diện Live Audio Streaming       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Từng Micro-Task

---

### Micro-Task 5.1: Định nghĩa WebSocket Audio Stream Protocol & Payloads

- **File test**: `tests/services/live-audio/live-audio-protocol.unit.test.ts`
- **File source**: `src/services/live-audio/types.ts` (MỚI)
- **Đặc tả WebSocket Events**:
  ```typescript
  export type LiveClientEvent = 
    | { type: 'START_SESSION'; sessionId: string; questionId: string }
    | { type: 'AUDIO_CHUNK'; pcmBase64: string }
    | { type: 'INTERRUPT' }
    | { type: 'STOP_SESSION' };

  export type LiveServerEvent = 
    | { type: 'SESSION_STARTED'; sampleRate: number }
    | { type: 'AUDIO_RESPONSE'; pcmBase64: string }
    | { type: 'TRANSCRIPT_UPDATE'; role: 'INTERVIEWER' | 'CANDIDATE'; text: string; isFinal: boolean }
    | { type: 'INTERRUPTED' }
    | { type: 'ERROR'; code: string; message: string };
  ```
- **Lệnh kiểm tra**: `npx vitest run tests/services/live-audio/live-audio-protocol.unit.test.ts`

---

### Micro-Task 5.2: Triển khai WebSocket Server Relay Cho Gemini Live API

- **File test**: `tests/services/live-audio/gemini-live-relay.test.ts`
- **File source**: `src/infrastructure/websocket/GeminiLiveRelay.ts` (MỚI)
- **Cơ chế**: Nhận WebSocket connection từ frontend, xác thực JWT, tạo luồng kết nối song công với Gemini Live API endpoint qua gRPC/Bidi stream, chuyển tiếp audio buffers.
- **Lệnh kiểm tra**: `npx vitest run tests/services/live-audio/gemini-live-relay.test.ts`

---

### Micro-Task 5.3: Module Audio Buffer Resampler (16kHz PCM <-> Browser)

- **File test**: `tests/services/live-audio/audio-resampler.unit.test.ts`
- **File source**: `src/services/live-audio/AudioResampler.ts` (MỚI)
- **Mục tiêu**: Chuyển đổi tần số lấy mẫu giữa audio trình duyệt (thường là 44.1kHz hoặc 48kHz Float32) và Gemini Live API (16kHz hoặc 24kHz Int16 PCM Mono).
- **Lệnh kiểm tra**: `npx vitest run tests/services/live-audio/audio-resampler.unit.test.ts`

---

### Micro-Task 5.4: Fallback Cloud TTS Service (Google vi-VN Neural2)

- **File test**: `tests/services/live-audio/cloud-tts-fallback.test.ts`
- **File source**: `src/services/live-audio/CloudTtsService.ts` (MỚI)
- **Cơ chế**: Trong trường hợp Gemini Live API tạm thời quá tải, hệ thống fallback mượt mà sang Google Cloud Text-to-Speech API với voice `vi-VN-Neural2-A` và audio cache memory LRU để giảm thiểu chi phí API.
- **Lệnh kiểm tra**: `npx vitest run tests/services/live-audio/cloud-tts-fallback.test.ts`

---

### Micro-Task 5.5: Controller & WebSocket Upgrade Route

- **File test**: `tests/controllers/live-websocket-upgrade.test.ts`
- **File source**: `src/infrastructure/websocket/websocketServer.ts` (MỚI)
- **Endpoint**: `ws://<host>/api/v1/interviews/:id/live-audio`
- **Bảo mật**: Kiểm tra bearer token trong query param `?token=...` hoặc protocol header, thẩm định quyền truy cập session.
- **Lệnh kiểm tra**: `npx vitest run tests/controllers/live-websocket-upgrade.test.ts`

---

### Micro-Task 5.6: Client Audio Worklet Processor (PCM Streamer)

- **File test**: `client/src/features/InterviewRoom/__tests__/audioWorklet.test.ts`
- **File source**: `client/public/pcm-recorder-worklet.js` (MỚI)
- **Nhiệm vụ**: AudioWorklet chạy trên luồng phụ Web Audio API, thu thập mẩu âm thanh PCM 16-bit mà không gây giật lag giao diện (Zero UI Jank).
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/audioWorklet.test.ts`

---

### Micro-Task 5.7: Client Hook useGeminiLiveAudio

- **File test**: `client/src/features/InterviewRoom/__tests__/useGeminiLiveAudio.test.ts`
- **File source**: `client/src/features/InterviewRoom/hooks/useGeminiLiveAudio.ts` (MỚI)
- **Return signature**:
  ```typescript
  export function useGeminiLiveAudio(sessionId: string): {
    isConnected: boolean;
    isStreaming: boolean;
    isAiSpeaking: boolean;
    currentTranscript: string;
    connect: () => Promise<void>;
    disconnect: () => void;
    interrupt: () => void;
    audioLevel: number;
  };
  ```
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/useGeminiLiveAudio.test.ts`

---

### Micro-Task 5.8: Component LiveAiInterviewerAvatar (Mouth Sync Waveform)

- **File test**: `client/src/features/InterviewRoom/__tests__/LiveAiInterviewerAvatar.test.tsx`
- **File source**: `client/src/features/InterviewRoom/components/LiveAiInterviewerAvatar.tsx` (MỚI)
- **Giao diện**: Avatar AI 3D/2.5D phản ứng theo sóng âm thanh thực tế của Gemini, hiệu ứng nhấp nháy mắt tự nhiên và vòng hào quang phản hồi trạng thái (Nghe, Suy nghĩ, Nói).
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/LiveAiInterviewerAvatar.test.tsx`

---

### Micro-Task 5.9: Client Hook useMediaPipeGazeTracker (On-Device Vision)

- **File test**: `client/src/features/InterviewRoom/__tests__/useMediaPipeGazeTracker.test.ts`
- **File source**: `client/src/features/InterviewRoom/hooks/useMediaPipeGazeTracker.ts` (MỚI)
- **Tính toán**:
  - Tỷ lệ duy trì ánh mắt hướng vào màn hình (`eyeContactRatio`).
  - Cảnh báo nhìn ra ngoài màn hình kéo dài (`offScreenDurationSeconds`).
- **Lệnh kiểm tra**: `npm --prefix client test -- src/features/InterviewRoom/__tests__/useMediaPipeGazeTracker.test.ts`

---

### Micro-Task 5.10: Integration Test Toàn Diện Live Audio Streaming

- **File test**: `tests/live-audio-stream.integration.test.ts` (MỚI)
- **Kịch bản**: Khởi tạo phiên live audio, gửi gói PCM tiếng Việt, nhận phản hồi stream, giả lập cắt lời (interrupt) và xác nhận luồng ngắt ngay lập tức.
- **Lệnh kiểm tra**: `npx vitest run tests/live-audio-stream.integration.test.ts`
