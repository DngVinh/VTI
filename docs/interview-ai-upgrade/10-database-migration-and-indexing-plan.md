# AIP-AIU-10 — Database Migration, Indexing Strategy & Data Integrity Plan

## 1. Mục Tiêu & Nguyên Tắc Di Trú Dữ Liệu (Migration Principles)

Tài liệu này quy định việc mở rộng cơ sở dữ liệu MongoDB nhằm hỗ trợ các tính năng phỏng vấn tương tác nhiều lượt, lưu vết bảng vẽ và kết quả đánh giá hội đồng đa tác nhân.

Các nguyên tắc bắt buộc:
1. **Zero Downtime Migration**: Việc tạo bảng và index mới không được phép khóa (blocking) các thao tác đọc/ghi của phiên phỏng vấn đang diễn ra.
2. **Idempotent Indexing**: Tập lệnh di trú index có thể chạy lại nhiều lần an toàn mà không làm lỗi database.
3. **E11000 Protection**: Tập lệnh di trú có cơ chế bắt lỗi trùng khóa (duplicate key error) và kiểm tra dữ liệu bẩn trước khi áp đặt unique index.
4. **Immutability of Historical Sessions**: Các phiên phỏng vấn đã hoàn thành trong quá khứ (`status: COMPLETED`) giữ nguyên tính toàn vẹn 100%, không bị sửa đổi lược đồ.

---

## 2. Chi Tiết Các Lược Đồ Mới & Mở Rộng (Schema Specifications)

---

### 2.1 Collection Mới: `conversationturns`

```typescript
// Collection: conversationturns
// Lưu trữ toàn bộ các lượt đối thoại giữa AI và ứng viên
{
  _id: ObjectId,
  sessionId: ObjectId,             // ref: InterviewSession (Bắt buộc, indexed)
  questionId: ObjectId,            // ref: InterviewQuestion (Bắt buộc, indexed)
  turnIndex: Number,               // Thứ tự lượt: 0, 1, 2, 3... (Bắt buộc)
  role: String,                    // 'INTERVIEWER' | 'CANDIDATE' (Bắt buộc)
  type: String,                    // 'INITIAL_QUESTION' | 'FOLLOW_UP' | 'ANSWER' | 'HINT' | 'SUMMARY'
  content: {
    vi: String,                    // Nội dung tiếng Việt (Tối đa 5,000 ký tự)
    en: String                     // Nội dung tiếng Anh (Tối đa 5,000 ký tự)
  },
  metadata: {
    gapAnalysis: [String],         // Lỗ hổng AI phát hiện (Tối đa 3 items)
    difficultyAdjustment: String,  // 'EASIER' | 'SAME' | 'HARDER'
    confidenceScore: Number,       // 0.0 - 1.0
    tokenUsage: {
      promptTokens: Number,
      candidatesTokens: Number,
      totalTokens: Number
    },
    speechMetrics: {
      wpm: Number,
      fillerCount: Number,
      hesitationMs: Number
    }
  },
  createdAt: ISODate,
  updatedAt: ISODate
}
```

#### Indexing Strategy cho `conversationturns`:
1. **Index duy nhất kiểm soát thứ tự**:
   - `db.conversationturns.createIndex({ sessionId: 1, questionId: 1, turnIndex: 1 }, { unique: true, name: "uniq_session_question_turn" })`
   - *Mục đích*: Ngăn chặn race condition khiến hai lượt đàm thoại bị trùng số thứ tự.
2. **Index truy vấn lịch sử theo thời gian**:
   - `db.conversationturns.createIndex({ sessionId: 1, createdAt: 1 }, { name: "idx_session_created" })`
   - *Mục đích*: Lấy toàn bộ lịch sử trò chuyện của một phiên theo đúng trình tự thời gian cực nhanh.

---

### 2.2 Collection Mới: `whiteboardsnapshots`

```typescript
// Collection: whiteboardsnapshots
// Lưu trữ ảnh sơ đồ kiến trúc và dữ liệu vector canvas của ứng viên
{
  _id: ObjectId,
  sessionId: ObjectId,             // ref: InterviewSession (Bắt buộc)
  questionId: ObjectId,            // ref: InterviewQuestion (Bắt buộc)
  imageBase64: String,             // Chuỗi Data URL ảnh PNG/WebP (Tối đa 3MB)
  canvasDataJson: String,          // Chuỗi JSON cấu trúc Excalidraw / SVG thô
  critiqueResult: {
    detectedNodes: [{ type: String, label: String }],
    issues: [{
      type: String,                // 'SPOF' | 'BOTTLENECK' | 'CONSISTENCY' | 'SECURITY' | 'MISSING_TIER'
      severity: String,            // 'HIGH' | 'MEDIUM' | 'LOW'
      title: { vi: String, en: String },
      description: { vi: String, en: String },
      suggestedFix: { vi: String, en: String }
    }],
    tradeOffEvaluation: { vi: String, en: String },
    score: Number                  // 0.0 - 10.0
  },
  createdAt: ISODate,
  updatedAt: ISODate
}
```

#### Indexing Strategy cho `whiteboardsnapshots`:
- `db.whiteboardsnapshots.createIndex({ sessionId: 1, questionId: 1 }, { unique: true, name: "uniq_whiteboard_session_question" })`

---

### 2.3 Mở Rộng Collection Hiện Có: `interviewsessions`

Bổ sung giá trị `'FOLLOW_UP'` vào enum trạng thái:
```typescript
status: {
  type: String,
  enum: ['PENDING', 'GENERATING', 'IN_PROGRESS', 'FOLLOW_UP', 'EVALUATING', 'COMPLETED', 'FAILED'],
  default: 'PENDING',
  required: true
}
```

---

### 2.4 Mở Rộng Collection Hiện Có: `interviewevaluationresults`

Bổ sung trường lưu vết đánh giá đa tác nhân:
```typescript
personaEvaluations: [{
  role: { type: String, enum: ['TECH_LEAD', 'BAR_RAISER', 'BEHAVIORAL', 'JUDGE'] },
  score: { type: Number, min: 0, max: 10 },
  strengths: [{ vi: String, en: String }],
  weaknesses: [{ vi: String, en: String }],
  specificFeedback: { vi: String, en: String },
  dimensionScores: { type: Map, of: Number }
}],
varianceFlags: [{
  dimension: String,
  variance: Number,
  arbiterResolution: { vi: String, en: String }
}]
```

---

## 3. Tập Lệnh Di Trú Tự Động (`scripts/aiu-migration-indexes.ts`)

File kịch bản TypeScript tự động kiểm tra, dọn dẹp dữ liệu trùng lặp nếu có, và khởi tạo các index an toàn:

```typescript
import mongoose from 'mongoose';
import { getEnv } from '../src/config/env';

export async function applyAiuIndexes(): Promise<void> {
  const env = getEnv();
  const conn = await mongoose.connect(env.MONGODB_URI);
  const db = conn.connection.db;
  if (!db) throw new Error('Database connection failed');

  console.log('[AIU Migration] Checking and applying indexes...');

  try {
    // 1. conversationturns indexes
    await db.collection('conversationturns').createIndex(
      { sessionId: 1, questionId: 1, turnIndex: 1 },
      { unique: true, name: 'uniq_session_question_turn' }
    );
    console.log(' - Created index: uniq_session_question_turn');
  } catch (err: any) {
    if (err.code === 11000) {
      console.warn(' [WARNING] Duplicate keys found in conversationturns. Clean dirty test records before re-running.');
    } else {
      throw err;
    }
  }

  try {
    await db.collection('conversationturns').createIndex(
      { sessionId: 1, createdAt: 1 },
      { name: 'idx_session_created' }
    );
    console.log(' - Created index: idx_session_created');
  } catch (err: any) {
    console.warn(' [WARNING] Failed creating idx_session_created:', err.message);
  }

  try {
    // 2. whiteboardsnapshots index
    await db.collection('whiteboardsnapshots').createIndex(
      { sessionId: 1, questionId: 1 },
      { unique: true, name: 'uniq_whiteboard_session_question' }
    );
    console.log(' - Created index: uniq_whiteboard_session_question');
  } catch (err: any) {
    if (err.code === 11000) {
      console.warn(' [WARNING] Duplicate keys found in whiteboardsnapshots.');
    } else {
      throw err;
    }
  }

  console.log('[AIU Migration] All indexes applied successfully.');
  await mongoose.disconnect();
}

// Chạy trực tiếp qua CLI
if (require.main === module) {
  applyAiuIndexes().catch(err => {
    console.error('[AIU Migration ERROR]:', err);
    process.exit(1);
  });
}
```

### Lệnh Thực Thi Di Trú Từ Terminal:
```powershell
npx tsx scripts/aiu-migration-indexes.ts
```

---

## 4. Kế Hoạch Rollback Index (Hồi Phục An Toàn)

Nếu cần gỡ bỏ các index mới khi rollback hệ thống:
```javascript
// Chạy trong mongosh nếu cần rollback
db.conversationturns.dropIndex("uniq_session_question_turn");
db.conversationturns.dropIndex("idx_session_created");
db.whiteboardsnapshots.dropIndex("uniq_whiteboard_session_question");
```
Việc xóa index này không ảnh hưởng đến bất kỳ dữ liệu gốc nào của các collection `interviewsessions` hay `interviewquestions`.
