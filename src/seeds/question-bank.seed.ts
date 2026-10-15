import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import Role from '../models/role.model';
import Level from '../models/level.model';
import Technology from '../models/technology.model';
import Question from '../models/question.model';
import QuestionVersion from '../models/question-version.model';
import { createContentHash, normalizePromptFingerprint } from '../domain/question-bank/hashing';
import {
  Difficulty,
  LocalizedText,
  QuestionType,
  RubricCriterion,
  RubricLevel,
  QuestionVersionDraftFields,
} from '../domain/question-bank/types';
import { QuestionCounterRepository } from '../repositories/question-support.repository';
import { seedLevels } from './level.seed';
import { seedRoles } from './role.seed';
import { seedTechnologies } from './technology.seed';

export const QUESTION_BANK_SEED_SOURCE_PREFIX = 'seed:question-bank:v1:';

type SeedQuestionDefinition = {
  key: string;
  prompt: LocalizedText;
  explanation: LocalizedText;
  referenceAnswer: LocalizedText;
  learningObjective: LocalizedText;
  estimatedTimeSeconds: number;
  questionType: QuestionType;
  difficulty: Difficulty;
  roleCode: string;
  levelCodes: readonly string[];
  technologyCodes: readonly string[];
  technologyAgnostic: boolean;
  topic: string;
  tags: readonly string[];
  rubricFocus: LocalizedText;
};

const text = (vi: string, en: string): LocalizedText => ({ vi, en });

const rubricLevels = (dimensionVi: string, dimensionEn: string): RubricLevel[] => [
  { score: 0, description: text(`Không thể hiện ${dimensionVi}.`, `Does not demonstrate ${dimensionEn}.`) },
  { score: 1, description: text(`Nêu được rất ít ý về ${dimensionVi}, còn sai trọng tâm.`, `Mentions very little about ${dimensionEn} and misses the core.`) },
  { score: 2, description: text(`Giải thích được ý chính của ${dimensionVi} nhưng còn thiếu hoặc có lỗi nhỏ.`, `Explains the main idea of ${dimensionEn} but misses details or has minor errors.`) },
  { score: 3, description: text(`Trình bày đúng và có thể áp dụng ${dimensionVi} trong tình huống quen thuộc.`, `Explains ${dimensionEn} accurately and applies it to a familiar scenario.`) },
  { score: 4, description: text(`Phân tích sâu ${dimensionVi}, nêu được edge case, trade-off và cách kiểm chứng.`, `Analyzes ${dimensionEn} deeply, including edge cases, trade-offs, and verification.`) },
];

const rubricFor = (focus: LocalizedText): RubricCriterion[] => [
  {
    key: 'technical-accuracy',
    title: text('Độ chính xác kỹ thuật', 'Technical accuracy'),
    description: text(
      `Đánh giá mức độ hiểu đúng ${focus.vi}.`,
      `Evaluate how accurately the candidate understands ${focus.en}.`,
    ),
    weight: 60,
    levels: rubricLevels(focus.vi, focus.en),
  },
  {
    key: 'practical-application',
    title: text('Vận dụng và trade-off', 'Application and trade-offs'),
    description: text(
      `Đánh giá khả năng vận dụng ${focus.vi} vào hệ thống thực tế.`,
      `Evaluate the ability to apply ${focus.en} in a real system.`,
    ),
    weight: 40,
    levels: rubricLevels(`vận dụng ${focus.vi}`, `applying ${focus.en}`),
  },
];

const questions: readonly SeedQuestionDefinition[] = [
  {
    key: 'javascript-event-loop',
    prompt: text(
      'Trong trình duyệt hoặc Node.js, hãy dự đoán thứ tự in ra của các lệnh synchronous, Promise.then và setTimeout(0). Giải thích call stack, task queue và microtask queue; nêu một khác biệt quan trọng giữa browser và Node.js.',
      'In a browser or Node.js, predict the output order of synchronous code, Promise.then, and setTimeout(0). Explain the call stack, task queue, and microtask queue, and mention one important browser versus Node.js difference.',
    ),
    explanation: text(
      'JavaScript chạy mã đồng bộ trên call stack. Sau khi stack rỗng, runtime xử lý microtask như Promise reaction trước task tiếp theo như timer. Vì vậy log đồng bộ xuất hiện trước, Promise.then thường trước setTimeout(0). Browser có các task source và rendering checkpoint; Node.js dùng các phase của libuv và có nextTick queue được ưu tiên hơn Promise microtask.',
      'JavaScript runs synchronous code on the call stack. Once the stack is empty, the runtime drains microtasks such as Promise reactions before taking the next task such as a timer. Therefore synchronous logs appear first and Promise.then normally runs before setTimeout(0). Browsers have task sources and rendering checkpoints; Node.js uses libuv phases and its nextTick queue has priority over Promise microtasks.',
    ),
    referenceAnswer: text(
      'Thứ tự điển hình là synchronous, Promise.then, rồi setTimeout. Event Loop không làm JavaScript chạy song song; nó phối hợp stack với các queue khi call stack rỗng. Câu trả lời tốt cần phân biệt microtask với macrotask/task, nói rõ timer chỉ là thời điểm sớm nhất có thể chạy, và đề cập nextTick/libuv hoặc rendering tùy runtime.',
      'The typical order is synchronous code, Promise.then, then setTimeout. The Event Loop does not make JavaScript code run in parallel; it coordinates the stack and queues when the stack is empty. A strong answer distinguishes microtasks from tasks/macrotasks, notes that a timer is only eligible after its delay, and mentions nextTick/libuv or rendering depending on the runtime.',
    ),
    learningObjective: text('Giải thích được cách Event Loop điều phối mã đồng bộ và bất đồng bộ.', 'Explain how the Event Loop coordinates synchronous and asynchronous code.'),
    estimatedTimeSeconds: 300,
    questionType: 'TECHNICAL',
    difficulty: 'MEDIUM',
    roleCode: 'FRONTEND_DEVELOPER',
    levelCodes: ['FRESHER', 'JUNIOR', 'MIDDLE'],
    technologyCodes: ['JAVASCRIPT'],
    technologyAgnostic: false,
    topic: 'JavaScript Event Loop',
    tags: ['javascript', 'event-loop', 'async-programming'],
    rubricFocus: text('cơ chế Event Loop và thứ tự thực thi', 'the Event Loop and execution order'),
  },
  {
    key: 'javascript-closure',
    prompt: text(
      'Closure trong JavaScript là gì? Hãy giải thích vì sao một hàm tạo counter vẫn truy cập được biến private sau khi hàm ngoài đã return, và nêu một lỗi thường gặp khi tạo callback trong vòng lặp.',
      'What is a closure in JavaScript? Explain why a counter factory can still access a private variable after the outer function returns, and describe a common callback bug in loops.',
    ),
    explanation: text(
      'Closure là hàm đi kèm với lexical environment nơi nó được tạo. Environment đó được giữ lại nếu hàm bên trong còn tham chiếu tới biến, nên biến không biến mất chỉ vì hàm ngoài đã return. Lỗi kinh điển là dùng var trong loop khiến các callback chia sẻ một binding cuối cùng; let tạo binding theo mỗi iteration hoặc có thể dùng factory để tạo scope riêng.',
      'A closure is a function together with the lexical environment in which it was created. That environment remains reachable while the inner function references it, so the variable does not disappear merely because the outer function returned. A classic bug uses var in a loop, causing callbacks to share the final binding; let creates a per-iteration binding, or a factory can create a separate scope.',
    ),
    referenceAnswer: text(
      'Closure cho phép hàm đọc/ghi biến ở lexical scope bên ngoài và nhờ đó mô phỏng state private. Counter factory trả về increment/getter, còn count nằm trong scope không thể truy cập trực tiếp. Với callback loop, cần dùng let, IIFE/factory hoặc truyền giá trị vào callback; đồng thời tránh giữ closure lâu hơn cần thiết nếu nó giữ object lớn.',
      'A closure lets a function read and update variables from an outer lexical scope, which can model private state. A counter factory returns increment/getter functions while count stays inaccessible directly. For loop callbacks, use let, an IIFE/factory, or pass the value explicitly; also avoid retaining closures longer than needed when they keep large objects alive.',
    ),
    learningObjective: text('Vận dụng lexical scoping và closure để thiết kế state private an toàn.', 'Apply lexical scoping and closures to design safe private state.'),
    estimatedTimeSeconds: 240,
    questionType: 'TECHNICAL',
    difficulty: 'EASY',
    roleCode: 'FRONTEND_DEVELOPER',
    levelCodes: ['FRESHER', 'JUNIOR'],
    technologyCodes: ['JAVASCRIPT'],
    technologyAgnostic: false,
    topic: 'JavaScript Closure',
    tags: ['javascript', 'closure', 'lexical-scope'],
    rubricFocus: text('closure, lexical scope và lifetime của biến', 'closures, lexical scope, and variable lifetime'),
  },
  {
    key: 'javascript-promises-async-await',
    prompt: text(
      'So sánh Promise chain với async/await khi gọi hai API độc lập rồi gọi API thứ ba phụ thuộc vào kết quả của chúng. Bạn sẽ xử lý lỗi, timeout và quyết định chạy tuần tự hay song song như thế nào?',
      'Compare a Promise chain with async/await when two independent APIs must be called before a third API that depends on both results. How would you handle errors, timeouts, and the sequential versus parallel decision?',
    ),
    explanation: text(
      'async/await là cú pháp trên Promise, không biến I/O thành blocking. Các lời gọi độc lập nên khởi tạo trước rồi dùng Promise.all để giảm latency; lời gọi phụ thuộc mới await sau đó. try/catch bắt rejection trong phạm vi phù hợp, nhưng Promise.all fail-fast nên cần Promise.allSettled nếu muốn thu thập từng kết quả. Timeout cần AbortController hoặc wrapper có hủy request, không chỉ bỏ qua Promise.',
      'async/await is syntax over Promises; it does not turn I/O into blocking work. Independent calls should be started first and combined with Promise.all to reduce latency; dependent work is awaited afterward. try/catch handles rejections in the right scope, while Promise.all is fail-fast, so Promise.allSettled is appropriate when every result matters. A timeout should use AbortController or a cancellable wrapper, not merely ignore the Promise.',
    ),
    referenceAnswer: text(
      'Tạo p1 và p2 cùng lúc, await Promise.all([p1, p2]), sau đó gọi API thứ ba. Bọc flow trong try/catch, phân loại lỗi có thể retry và lỗi không nên retry, truyền AbortSignal cho timeout, và đảm bảo không nuốt rejection. Nếu cần kết quả từng API dù một API lỗi thì dùng allSettled rồi áp dụng policy rõ ràng.',
      'Start p1 and p2 together, await Promise.all([p1, p2]), then call the third API. Wrap the flow in try/catch, classify retryable versus non-retryable errors, pass an AbortSignal for timeouts, and never swallow rejections. If each independent result must be inspected even when one fails, use allSettled with an explicit policy.',
    ),
    learningObjective: text('Thiết kế flow bất đồng bộ có độ trễ thấp, timeout và xử lý lỗi rõ ràng.', 'Design asynchronous flows with low latency, timeouts, and explicit error handling.'),
    estimatedTimeSeconds: 300,
    questionType: 'SCENARIO',
    difficulty: 'MEDIUM',
    roleCode: 'FULLSTACK_DEVELOPER',
    levelCodes: ['JUNIOR', 'MIDDLE'],
    technologyCodes: ['JAVASCRIPT'],
    technologyAgnostic: false,
    topic: 'Promises and async/await',
    tags: ['javascript', 'promise', 'async-await', 'error-handling'],
    rubricFocus: text('Promise orchestration, lỗi và timeout', 'Promise orchestration, errors, and timeouts'),
  },
  {
    key: 'react-state-rerender',
    prompt: text(
      'Trong React, vì sao gọi setCount(count + 1) hai lần trong cùng một event handler có thể chỉ tăng một lần? Khi nào cần functional updater, và việc mutate object state ảnh hưởng re-render ra sao?',
      'In React, why can calling setCount(count + 1) twice in the same event handler increment only once? When is a functional updater needed, and how does mutating an object state affect re-rendering?',
    ),
    explanation: text(
      'Mỗi render có snapshot state riêng; cả hai lời gọi có thể đọc cùng giá trị count và React batch chúng thành một kết quả. setCount(prev => prev + 1) xếp các update dựa trên state mới nhất nên tăng đúng hai lần. Với object/array, cần tạo reference mới bằng spread hoặc immutable update; mutate tại chỗ có thể làm React không nhận ra thay đổi và gây bug khi memoization hoặc concurrent rendering.',
      'Each render has its own state snapshot; both calls may read the same count and React can batch them into one result. setCount(prev => prev + 1) queues updates from the latest state, so it increments twice. Objects and arrays should be updated immutably with a new reference; in-place mutation can hide changes and cause bugs with memoization or concurrent rendering.',
    ),
    referenceAnswer: text(
      'Dùng functional updater khi update phụ thuộc state trước đó, ví dụ setCount(c => c + 1). React re-render khi state/props thay đổi theo cơ chế so sánh reference; vì vậy không mutate trực tiếp user.name mà tạo object mới. Cần nhớ batching là tối ưu implementation, không nên dựa vào việc đọc state ngay sau setState để lấy giá trị mới.',
      'Use a functional updater when the next value depends on the previous state, for example setCount(c => c + 1). React re-renders based on state/prop changes and reference comparisons, so create a new object instead of mutating user.name. Batching is an implementation behavior to account for, and code should not read state immediately after setState expecting the new value.',
    ),
    learningObjective: text('Hiểu state snapshot, batching và immutable update trong React.', 'Understand state snapshots, batching, and immutable updates in React.'),
    estimatedTimeSeconds: 240,
    questionType: 'TECHNICAL',
    difficulty: 'MEDIUM',
    roleCode: 'FRONTEND_DEVELOPER',
    levelCodes: ['JUNIOR', 'MIDDLE'],
    technologyCodes: ['REACT'],
    technologyAgnostic: false,
    topic: 'React state and re-render',
    tags: ['react', 'state-management', 'rerender', 'immutability'],
    rubricFocus: text('state snapshot, batching và reference equality', 'state snapshots, batching, and reference equality'),
  },
  {
    key: 'react-use-effect',
    prompt: text(
      'Một component React gọi API trong useEffect theo userId. Hãy mô tả dependency array, cleanup function và cách tránh response của request cũ ghi đè request mới khi userId thay đổi nhanh.',
      'A React component fetches data in useEffect based on userId. Describe the dependency array and cleanup function, and explain how to prevent an older request from overwriting a newer request when userId changes quickly.',
    ),
    explanation: text(
      'Dependency array phải chứa các reactive value mà effect đọc; userId thay đổi thì effect chạy lại. Cleanup chạy trước lần chạy kế tiếp và khi unmount, nhưng không tự hủy fetch. Có thể dùng AbortController để hủy request cũ và kiểm tra AbortError, hoặc dùng request identity/active flag để bỏ qua response muộn. Effect không nên dùng để tính dữ liệu có thể suy ra trong render.',
      'The dependency array should include reactive values read by the effect, so a userId change re-runs it. Cleanup runs before the next effect and on unmount, but it does not cancel fetch automatically. Use AbortController to cancel the old request and handle AbortError, or use a request identity/active flag to ignore late responses. Do not use an effect for data that can be derived during render.',
    ),
    referenceAnswer: text(
      'Dùng useEffect(() => { const controller = new AbortController(); fetch(url, { signal: controller.signal }).then(...); return () => controller.abort(); }, [userId]). Dependency phải phản ánh giá trị được đọc, không bỏ qua để “chạy một lần”. Cleanup bảo vệ khỏi race và cập nhật state sau unmount; cache/query library có thể quản lý các concern này tốt hơn ở ứng dụng lớn.',
      'Use useEffect(() => { const controller = new AbortController(); fetch(url, { signal: controller.signal }).then(...); return () => controller.abort(); }, [userId]). Dependencies should reflect values read by the effect rather than being omitted to “run once.” Cleanup prevents races and updates after unmount; a query/cache library may manage these concerns better at scale.',
    ),
    learningObjective: text('Viết effect đúng lifecycle và loại bỏ race condition trong data fetching.', 'Write lifecycle-correct effects and eliminate data-fetching race conditions.'),
    estimatedTimeSeconds: 300,
    questionType: 'SCENARIO',
    difficulty: 'MEDIUM',
    roleCode: 'FRONTEND_DEVELOPER',
    levelCodes: ['JUNIOR', 'MIDDLE'],
    technologyCodes: ['REACT'],
    technologyAgnostic: false,
    topic: 'React useEffect',
    tags: ['react', 'use-effect', 'data-fetching', 'race-condition'],
    rubricFocus: text('dependency, cleanup và race condition của effect', 'effect dependencies, cleanup, and races'),
  },
  {
    key: 'typescript-generics',
    prompt: text(
      'Hãy thiết kế chữ ký TypeScript cho hàm getProperty(obj, key) chỉ cho phép key tồn tại trên obj và trả về đúng kiểu của property đó. Vì sao generics có constraint an toàn hơn dùng any?',
      'Design a TypeScript signature for getProperty(obj, key) that accepts only keys present on obj and returns the exact property type. Why is a generic constraint safer than using any?',
    ),
    explanation: text(
      'Mẫu chuẩn là function getProperty<T, K extends keyof T>(obj: T, key: K): T[K]. K bị giới hạn bởi keyof T nên compiler từ chối key không tồn tại, còn T[K] giữ lại kiểu chính xác thay vì trả về any. Generic constraint mô tả quan hệ giữa các tham số; any tắt kiểm tra và đẩy lỗi sang runtime.',
      'The standard pattern is function getProperty<T, K extends keyof T>(obj: T, key: K): T[K]. K is constrained by keyof T, so the compiler rejects unknown keys, while T[K] preserves the exact property type instead of returning any. A generic constraint expresses a relationship between parameters; any disables checking and moves errors to runtime.',
    ),
    referenceAnswer: text(
      'Có thể viết function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }. Khi gọi với {name: string, age: number}, key chỉ là name hoặc age và kiểu trả về tương ứng. Generics giúp tái sử dụng mà vẫn giữ type inference; constraint nên đủ hẹp để thể hiện invariant, tránh ép kiểu hoặc any không cần thiết.',
      'Write function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }. For {name: string, age: number}, key can only be name or age and the return type matches the selected property. Generics enable reuse while preserving inference; constraints should be narrow enough to express the invariant, avoiding unnecessary casts or any.',
    ),
    learningObjective: text('Dùng generics, keyof và indexed access type để giữ type safety khi viết API dùng chung.', 'Use generics, keyof, and indexed access types to keep reusable APIs type-safe.'),
    estimatedTimeSeconds: 240,
    questionType: 'CODING',
    difficulty: 'MEDIUM',
    roleCode: 'FULLSTACK_DEVELOPER',
    levelCodes: ['JUNIOR', 'MIDDLE'],
    technologyCodes: ['TYPESCRIPT'],
    technologyAgnostic: false,
    topic: 'TypeScript Generics',
    tags: ['typescript', 'generics', 'type-safety'],
    rubricFocus: text('quan hệ kiểu với generics và keyof', 'generic type relationships and keyof'),
  },
  {
    key: 'node-api-error-handling',
    prompt: text(
      'Thiết kế error handling cho một Node.js/Express API có async handler, lỗi validation, lỗi not-found, lỗi database và lỗi lập trình. Bạn sẽ dùng middleware nào, trả status/response ra sao và tránh lộ thông tin nhạy cảm thế nào?',
      'Design error handling for a Node.js/Express API with async handlers, validation errors, not-found errors, database failures, and programmer errors. What middleware and status responses would you use, and how would you prevent sensitive information from leaking?',
    ),
    explanation: text(
      'Async handler phải chuyển rejection tới error middleware thay vì tạo unhandled rejection. Middleware tập trung phân loại lỗi thành 4xx do input/resource, 5xx do server, ghi log có requestId và giữ response ổn định như code/message/details đã lọc. Không trả stack trace, query, secret hoặc raw database error cho client; lỗi không biết loại cần được log đầy đủ ở server và trả thông báo generic. Timeout, retry và shutdown phải được xử lý có chủ đích.',
      'Async handlers must forward rejections to error middleware rather than creating unhandled rejections. Central middleware classifies client/resource errors as 4xx and server failures as 5xx, logs with a requestId, and returns a stable sanitized error shape. Never expose stack traces, queries, secrets, or raw database errors; unknown errors are logged server-side and return a generic message. Timeouts, retries, and shutdown need deliberate policies.',
    ),
    referenceAnswer: text(
      'Dùng async wrapper hoặc Express 5 promise handling, custom AppError với statusCode/code, validation middleware trước controller, not-found middleware sau routes và một error middleware cuối cùng. Map lỗi known sang status 400/404/409/422/500; log structured với correlation ID, redact secrets, và trong production không gửi stack. Lỗi programmer nghiêm trọng có thể yêu cầu fail fast và restart qua process manager.',
      'Use an async wrapper or Express 5 promise handling, a custom AppError with statusCode/code, validation middleware before controllers, a not-found middleware after routes, and one final error middleware. Map known errors to 400/404/409/422/500; structured-log with a correlation ID, redact secrets, and never send stacks in production. Severe programmer errors may require fail-fast and restart through a process manager.',
    ),
    learningObjective: text('Xây dựng API có error contract nhất quán, quan sát được và không làm lộ dữ liệu.', 'Build APIs with consistent error contracts, observability, and no data leakage.'),
    estimatedTimeSeconds: 360,
    questionType: 'SCENARIO',
    difficulty: 'MEDIUM',
    roleCode: 'BACKEND_DEVELOPER',
    levelCodes: ['JUNIOR', 'MIDDLE'],
    technologyCodes: ['NODEJS', 'EXPRESS'],
    technologyAgnostic: false,
    topic: 'Node.js API error handling',
    tags: ['nodejs', 'express', 'api-design', 'error-handling'],
    rubricFocus: text('phân loại lỗi, contract response và bảo mật log', 'error classification, response contracts, and log safety'),
  },
  {
    key: 'rest-api-idempotency',
    prompt: text(
      'Idempotency trong REST API nghĩa là gì? Hãy thiết kế endpoint tạo payment có thể được client retry an toàn khi mất response, và so sánh semantics của GET, PUT, DELETE với POST có Idempotency-Key.',
      'What does idempotency mean in a REST API? Design a payment-creation endpoint that clients can safely retry after losing the response, and compare GET, PUT, DELETE with POST using an Idempotency-Key.',
    ),
    explanation: text(
      'Một request idempotent có cùng hiệu ứng server khi thực hiện nhiều lần, dù response có thể khác. GET/PUT/DELETE thường được thiết kế idempotent theo semantics; POST tạo resource thường không. Với payment, server lưu key theo user/operation cùng request fingerprint và kết quả; retry cùng key cùng payload replay kết quả, còn payload khác phải bị từ chối. Cần transaction/unique constraint để chống race, TTL để dọn record, và không coi timeout là bằng chứng payment chưa xảy ra.',
      'An idempotent request has the same server-side effect when repeated, although responses can differ. GET/PUT/DELETE are generally designed with idempotent semantics; POST creation is not. For payments, the server stores a key scoped to the user/operation with a request fingerprint and result; the same key and payload replays the result, while a different payload is rejected. Use a transaction/unique constraint for races, TTL for records, and never assume a timeout means payment did not happen.',
    ),
    referenceAnswer: text(
      'Client gửi Idempotency-Key ổn định. Server unique-index key + actor + route, lưu hash payload và trạng thái PROCESSING/COMPLETED/FAILED; request trùng payload sau khi hoàn tất nhận lại status/body cũ, request đang xử lý được báo retry sau, request khác payload nhận 409. Business write và idempotency record nên cùng transaction để không tạo hai payment.',
      'The client sends a stable Idempotency-Key. The server uniquely indexes key plus actor and route, stores a payload hash and PROCESSING/COMPLETED/FAILED state; a matching completed retry gets the original status/body, an in-flight retry is told to retry later, and a different payload gets 409. The business write and idempotency record should be in the same transaction to avoid two payments.',
    ),
    learningObjective: text('Thiết kế thao tác REST an toàn trước retry, timeout và request đồng thời.', 'Design REST operations that remain safe under retries, timeouts, and concurrency.'),
    estimatedTimeSeconds: 360,
    questionType: 'SYSTEM_DESIGN',
    difficulty: 'HARD',
    roleCode: 'BACKEND_DEVELOPER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['NODEJS', 'EXPRESS'],
    technologyAgnostic: false,
    topic: 'REST API idempotency',
    tags: ['rest', 'idempotency', 'payments', 'distributed-systems'],
    rubricFocus: text('idempotency key, fingerprint và chống race', 'idempotency keys, fingerprints, and race prevention'),
  },
  {
    key: 'database-indexing',
    prompt: text(
      'Một endpoint lấy đơn hàng của user theo trạng thái và sắp xếp theo createdAt giảm dần. Bạn sẽ chọn index nào, kiểm chứng bằng EXPLAIN ra sao, và đánh đổi của index đối với write/storage là gì?',
      'An endpoint lists a user’s orders filtered by status and sorted by descending createdAt. Which index would you choose, how would you verify it with EXPLAIN, and what are the write and storage trade-offs?',
    ),
    explanation: text(
      'Index phải phục vụ predicate và sort, ví dụ B-tree trên (user_id, status, created_at DESC) trong PostgreSQL, nhưng thứ tự tối ưu phụ thuộc selectivity và các query thực tế. EXPLAIN (ANALYZE, BUFFERS) giúp xem index scan, rows estimate, actual time, sort và heap fetch. Index tăng tốc đọc nhưng tăng disk, chi phí insert/update/delete, vacuum và có thể không hữu ích nếu query trả phần lớn bảng hoặc dùng hàm khiến cột không sargable.',
      'The index should support both the predicate and sort, such as a PostgreSQL B-tree on (user_id, status, created_at DESC), but the best order depends on selectivity and real query patterns. EXPLAIN (ANALYZE, BUFFERS) shows index scans, row estimates, actual time, sorting, and heap fetches. Indexes improve reads but add disk use, insert/update/delete cost, vacuum work, and may not help when most rows match or expressions make the predicate non-sargable.',
    ),
    referenceAnswer: text(
      'Bắt đầu từ query shape: WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?. Thử index composite (user_id, status, created_at DESC), chạy EXPLAIN ANALYZE trên dữ liệu đại diện, kiểm tra planner có dùng index và latency/tổng rows đọc. Không tạo index cho mọi cột; theo dõi usage, write amplification và cân nhắc partial/covering index khi có invariant rõ ràng.',
      'Start from the query shape: WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?. Test a composite (user_id, status, created_at DESC) index with EXPLAIN ANALYZE on representative data, checking planner choice and rows read versus latency. Do not index every column; monitor usage and write amplification, and consider partial or covering indexes only with a clear invariant.',
    ),
    learningObjective: text('Chọn và đo lường index theo query shape thay vì phỏng đoán.', 'Choose and measure indexes from query shape instead of guessing.'),
    estimatedTimeSeconds: 360,
    questionType: 'SYSTEM_DESIGN',
    difficulty: 'MEDIUM',
    roleCode: 'BACKEND_DEVELOPER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['POSTGRESQL'],
    technologyAgnostic: false,
    topic: 'Database indexing',
    tags: ['database', 'indexing', 'postgresql', 'query-performance'],
    rubricFocus: text('composite index, query plan và write trade-off', 'composite indexes, query plans, and write trade-offs'),
  },
  {
    key: 'database-transaction',
    prompt: text(
      'Thiết kế thao tác chuyển 100 đơn vị từ tài khoản A sang B. Hãy giải thích ACID, cách dùng transaction để không mất tiền, isolation level nào cần cân nhắc và khi nào phải retry lỗi serialization/deadlock.',
      'Design a transfer of 100 units from account A to B. Explain ACID, how a transaction prevents money loss, which isolation levels matter, and when serialization or deadlock errors should be retried.',
    ),
    explanation: text(
      'Đọc và cập nhật hai account trong một transaction; kiểm tra balance đủ, debit và credit cùng commit hoặc cùng rollback. Atomicity và durability bảo vệ tính toàn vẹn, consistency dựa trên constraint, isolation kiểm soát interleaving. READ COMMITTED có thể cần row locks hoặc kiểm tra version; SERIALIZABLE mạnh hơn nhưng có thể trả serialization failure. Deadlock/serialization failure thường retry toàn bộ transaction với giới hạn và backoff; không retry lỗi business như insufficient funds.',
      'Read and update both accounts in one transaction; verify sufficient balance, and commit or roll back the debit and credit together. Atomicity and durability protect integrity, consistency is enforced by constraints, and isolation controls interleaving. READ COMMITTED may need row locks or version checks; SERIALIZABLE is stronger but can return serialization failures. Deadlock or serialization failures can retry the whole transaction with a limit and backoff; business errors such as insufficient funds should not retry.',
    ),
    referenceAnswer: text(
      'Mở transaction, lock hai row theo thứ tự cố định để giảm deadlock, kiểm tra A.balance >= amount, trừ A, cộng B, commit. Dùng CHECK balance >= 0 và unique/foreign-key constraints như lớp bảo vệ. Chọn isolation theo invariant, quan sát deadlock/serialization metrics và retry transaction khi lỗi transient; không thực hiện external side effect không thể rollback bên trong transaction.',
      'Open a transaction, lock both rows in a consistent order to reduce deadlocks, check A.balance >= amount, debit A, credit B, and commit. Add CHECK balance >= 0 plus unique/foreign-key constraints as defense in depth. Choose isolation based on the invariant, monitor deadlocks and serialization failures, and retry transient failures; do not perform non-rollbackable external side effects inside the transaction.',
    ),
    learningObjective: text('Áp dụng transaction và isolation để bảo vệ invariant dữ liệu trong cạnh tranh.', 'Apply transactions and isolation to protect data invariants under concurrency.'),
    estimatedTimeSeconds: 360,
    questionType: 'SCENARIO',
    difficulty: 'HARD',
    roleCode: 'BACKEND_DEVELOPER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['POSTGRESQL'],
    technologyAgnostic: false,
    topic: 'Database transaction',
    tags: ['database', 'transaction', 'acid', 'concurrency'],
    rubricFocus: text('ACID, isolation và invariant khi chuyển tiền', 'ACID, isolation, and transfer invariants'),
  },
  {
    key: 'redis-cache-invalidation',
    prompt: text(
      'Một service dùng Redis cache-aside cho hồ sơ user nhưng sau khi cập nhật database, client đôi lúc vẫn thấy dữ liệu cũ. Phân tích các race condition và đề xuất chiến lược invalidation, TTL, versioning hoặc write-through phù hợp.',
      'A service uses Redis cache-aside for user profiles, but clients sometimes see stale data after a database update. Analyze the race conditions and propose an appropriate invalidation, TTL, versioning, or write-through strategy.',
    ),
    explanation: text(
      'Cache-aside thường đọc cache, miss thì đọc DB rồi set cache; khi write nên commit DB trước rồi DEL key hoặc ghi value mới. Race có thể xảy ra khi request đọc DB cũ rồi set cache sau khi request update đã delete, nên versioned value, compare-and-set hoặc delayed double delete có thể cần thiết tùy mức nhất quán. TTL giới hạn độ cũ nhưng không thay thế invalidation; stampede cần single-flight/locking hoặc jitter. Phải chấp nhận và đo lường consistency contract.',
      'With cache-aside, reads check cache, then load DB and set the cache on a miss; writes should commit the DB before deleting or replacing the key. A race occurs when a reader loads old DB data and sets it after an updater deletes the key, so versioned values, compare-and-set, or a delayed second delete may be needed depending on consistency. TTL bounds staleness but does not replace invalidation; stampedes need single-flight/locking or jitter. The consistency contract must be explicit and measured.',
    ),
    referenceAnswer: text(
      'Ghi database thành công trước, sau đó invalidate đúng key; dùng TTL làm safety net. Nếu stale read không chấp nhận được, lưu version cùng payload và chỉ ghi cache nếu version mới hơn, hoặc dùng write-through/transactional outbox tùy kiến trúc. Xử lý cache failure như degradation có kiểm soát, thêm metrics hit/miss/staleness và chống stampede bằng lock có timeout.',
      'Write the database first, then invalidate the exact key, with TTL as a safety net. If stale reads are unacceptable, store a version with the payload and only accept newer cache versions, or use write-through or a transactional outbox depending on the architecture. Treat cache failure as controlled degradation, add hit/miss/staleness metrics, and prevent stampedes with a timeout-bounded lock.',
    ),
    learningObjective: text('Nhận diện cache race và chọn invalidation dựa trên consistency requirement.', 'Identify cache races and choose invalidation based on consistency requirements.'),
    estimatedTimeSeconds: 360,
    questionType: 'SYSTEM_DESIGN',
    difficulty: 'HARD',
    roleCode: 'BACKEND_DEVELOPER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['REDIS'],
    technologyAgnostic: false,
    topic: 'Redis cache invalidation',
    tags: ['redis', 'cache', 'cache-invalidation', 'consistency'],
    rubricFocus: text('cache-aside, stale race và consistency contract', 'cache-aside, stale races, and consistency contracts'),
  },
  {
    key: 'message-queue',
    prompt: text(
      'Một worker xử lý job gửi email từ message queue và có thể bị crash sau khi gửi email nhưng trước khi ack. Hãy giải thích at-least-once delivery, idempotent consumer, retry, dead-letter queue và cách quan sát hệ thống.',
      'A worker processes email jobs from a message queue and may crash after sending the email but before acknowledging the message. Explain at-least-once delivery, idempotent consumers, retries, dead-letter queues, and observability.',
    ),
    explanation: text(
      'Nếu crash trước ack, broker redeliver message nên at-least-once có thể tạo duplicate. Consumer cần idempotency key/event ID và durable record hoặc provider idempotency để gửi cùng event tối đa một lần theo business semantics; ack chỉ sau khi xử lý thành công. Retry phải có giới hạn, exponential backoff và phân biệt lỗi transient/permanent. Message poison cần DLQ, alert và quy trình replay có kiểm soát; theo dõi queue depth, age, processing latency, retry và DLQ rate.',
      'If the worker crashes before ack, the broker redelivers the message, so at-least-once can create duplicates. The consumer needs an idempotency key/event ID with a durable record or provider idempotency to achieve at-most-once business effect; ack only after successful processing. Retries need limits, exponential backoff, and transient versus permanent error classification. Poison messages go to a DLQ with alerting and controlled replay; monitor queue depth, age, latency, retries, and DLQ rate.',
    ),
    referenceAnswer: text(
      'Định danh mỗi event bằng eventId, lưu trạng thái xử lý với unique constraint và thiết kế send operation idempotent; nếu crash sau side effect, lần sau phát hiện đã hoàn tất rồi ack. Chỉ ack khi kết quả bền vững, retry lỗi tạm thời với backoff, đẩy lỗi không thể xử lý vào DLQ sau max attempts. Cần correlation ID, dashboard queue lag, visibility timeout và cơ chế graceful shutdown.',
      'Give each event an eventId, persist processing state with a unique constraint, and make the send operation idempotent; after a crash, the next delivery detects completion and acks. Ack only after durable success, retry transient failures with backoff, and move unprocessable messages to a DLQ after max attempts. Add correlation IDs, queue-lag dashboards, a visibility timeout, and graceful shutdown.',
    ),
    learningObjective: text('Thiết kế consumer chịu được duplicate và failure trong hệ thống bất đồng bộ.', 'Design consumers that tolerate duplicates and failures in asynchronous systems.'),
    estimatedTimeSeconds: 360,
    questionType: 'SYSTEM_DESIGN',
    difficulty: 'HARD',
    roleCode: 'BACKEND_DEVELOPER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['MESSAGE_QUEUE'],
    technologyAgnostic: false,
    topic: 'Message queue processing',
    tags: ['message-queue', 'at-least-once', 'idempotent-consumer', 'dead-letter-queue'],
    rubricFocus: text('delivery semantics, idempotent consumer và vận hành queue', 'delivery semantics, idempotent consumers, and queue operations'),
  },
  {
    key: 'jwt-refresh-revoke',
    prompt: text(
      'Thiết kế authentication dùng access JWT sống ngắn và refresh token. Khi user logout hoặc phát hiện token bị đánh cắp, bạn revoke/rotate refresh token thế nào để ngăn replay mà vẫn hỗ trợ nhiều thiết bị?',
      'Design authentication with short-lived access JWTs and refresh tokens. When a user logs out or a token is stolen, how do you revoke and rotate refresh tokens to prevent replay while supporting multiple devices?',
    ),
    explanation: text(
      'Access JWT nên ngắn hạn và chứa claim tối thiểu; refresh token nên là giá trị opaque ngẫu nhiên, chỉ lưu hash cùng device/session và expiry ở server. Mỗi lần refresh rotate token, đánh dấu token cũ đã dùng; reuse detection có thể revoke cả token family. Logout thu hồi session/device cụ thể hoặc toàn bộ user; credentialVersion/denylist có thể vô hiệu access token trước expiry nhưng có chi phí lookup. Cookie HttpOnly/Secure/SameSite hoặc storage an toàn, CSRF defense và rate limit đều quan trọng.',
      'Access JWTs should be short-lived with minimal claims; refresh tokens should be random opaque values, with only a hash stored server-side along with device/session and expiry. Rotate on every refresh and mark the old token used; reuse detection can revoke the whole token family. Logout revokes a device session or all user sessions; a credentialVersion or denylist can invalidate access tokens before expiry at a lookup cost. Use secure HttpOnly/SameSite cookies or safe storage, CSRF defenses, and rate limits.',
    ),
    referenceAnswer: text(
      'Lưu hash refresh token, sessionId/deviceId, familyId, issuedAt, expiresAt và revokedAt. Refresh kiểm tra token chưa revoke, atomically mark used rồi phát token mới; reuse token cũ là tín hiệu compromise và revoke family. Logout revoke một session, “logout all” tăng credential version/revoke mọi session. JWT signature/issuer/audience/expiry phải được kiểm tra; không nhúng secret hoặc dữ liệu nhạy cảm vào token.',
      'Store a refresh-token hash, sessionId/deviceId, familyId, issuedAt, expiresAt, and revokedAt. Refresh verifies it is not revoked, atomically marks it used, and issues a new token; reuse of an old token signals compromise and revokes the family. Logout revokes one session, while “logout all” bumps a credential version or revokes all sessions. Always validate JWT signature, issuer, audience, and expiry; never put secrets or sensitive data in the token.',
    ),
    learningObjective: text('Thiết kế vòng đời token có rotation, revoke và phát hiện replay.', 'Design token lifecycles with rotation, revocation, and replay detection.'),
    estimatedTimeSeconds: 360,
    questionType: 'SCENARIO',
    difficulty: 'HARD',
    roleCode: 'SECURITY_ENGINEER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['NODEJS'],
    technologyAgnostic: false,
    topic: 'JWT refresh and revoke token',
    tags: ['jwt', 'refresh-token', 'token-revocation', 'authentication'],
    rubricFocus: text('refresh rotation, revoke và replay detection', 'refresh rotation, revocation, and replay detection'),
  },
  {
    key: 'xss-csrf-ssrf',
    prompt: text(
      'Phân biệt XSS, CSRF và SSRF bằng một ví dụ cho mỗi loại. Với ứng dụng web có cookie authentication và chức năng fetch URL do user nhập, hãy nêu các lớp phòng thủ ở output, browser, server và network.',
      'Distinguish XSS, CSRF, and SSRF with one example each. For a web app using cookie authentication and a feature that fetches a user-provided URL, describe defense layers at the output, browser, server, and network levels.',
    ),
    explanation: text(
      'XSS khiến script không tin cậy chạy trong origin của ứng dụng, cần output encoding theo context, sanitization khi cho phép HTML, CSP và cookie HttpOnly. CSRF lợi dụng cookie tự gửi để khiến nạn nhân thực hiện state-changing request, cần SameSite phù hợp, CSRF token/origin checks và không dùng GET cho mutation. SSRF khiến server gọi tài nguyên nội bộ qua URL do user kiểm soát, cần allowlist scheme/host, chặn private/link-local IP sau DNS resolution, giới hạn redirect, egress firewall và metadata protection.',
      'XSS executes untrusted script in the application origin, requiring context-aware output encoding, sanitization when HTML is allowed, CSP, and HttpOnly cookies. CSRF abuses automatically sent cookies to trigger a state-changing request, requiring appropriate SameSite, CSRF tokens/origin checks, and no mutations over GET. SSRF makes the server call internal resources through a user-controlled URL, requiring scheme/host allowlists, blocking private/link-local IPs after DNS resolution, redirect limits, egress firewalls, and metadata protection.',
    ),
    referenceAnswer: text(
      'XSS là injection vào response/DOM; encode output và tránh innerHTML không an toàn. CSRF là request giả mạo từ browser của user đã đăng nhập; dùng SameSite, CSRF token và kiểm tra Origin. SSRF là server bị dùng làm proxy vào mạng nội bộ; parse URL bằng thư viện chuẩn, allowlist destination, resolve và kiểm tra IP trước mỗi kết nối/redirect, timeout và chặn egress. Không coi một header hoặc một lớp duy nhất là đủ.',
      'XSS injects into a response or DOM; encode output and avoid unsafe innerHTML. CSRF forges requests from a browser with an authenticated user; use SameSite, CSRF tokens, and Origin checks. SSRF turns the server into a proxy for internal networks; parse URLs with a standard library, allowlist destinations, resolve and validate IPs before each connection/redirect, set timeouts, and restrict egress. No single header or layer is sufficient.',
    ),
    learningObjective: text('Phân loại đúng web threat và phối hợp biện pháp phòng thủ theo trust boundary.', 'Classify web threats correctly and layer defenses across trust boundaries.'),
    estimatedTimeSeconds: 420,
    questionType: 'SCENARIO',
    difficulty: 'HARD',
    roleCode: 'SECURITY_ENGINEER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['WEB_SECURITY'],
    technologyAgnostic: false,
    topic: 'XSS, CSRF and SSRF',
    tags: ['xss', 'csrf', 'ssrf', 'web-security'],
    rubricFocus: text('trust boundary và defense-in-depth cho web security', 'trust boundaries and defense-in-depth for web security'),
  },
  {
    key: 'sql-nosql-injection',
    prompt: text(
      'Một API tìm kiếm user nhận filter từ JSON và query cả PostgreSQL lẫn MongoDB. Hãy chỉ ra SQL Injection và NoSQL Injection có thể xảy ra thế nào, rồi thiết kế validation và query construction an toàn.',
      'An API accepts a JSON filter to search users in both PostgreSQL and MongoDB. Explain how SQL Injection and NoSQL Injection could occur, then design safe validation and query construction.',
    ),
    explanation: text(
      'SQL injection xảy ra khi nối chuỗi input vào câu SQL; parameterized query/prepared statement tách code và data. Với MongoDB, nhận nguyên object từ client có thể cho phép operator như $ne/$where hoặc regex tốn CPU; cần schema chặt, allowlist field/operator, ép kiểu primitive và xây query từ cấu trúc server kiểm soát. Escaping không phải thay thế parameterization, và validation phải đi cùng authorization, giới hạn sort/page/regex và least privilege.',
      'SQL injection occurs when input is concatenated into SQL; parameterized queries keep code and data separate. In MongoDB, accepting a client object directly can enable operators such as $ne or $where, or expensive regexes; use a strict schema, allowlisted fields/operators, primitive coercion, and build queries from server-controlled structures. Escaping is not a substitute for parameterization; validation must be combined with authorization, sort/page/regex limits, and least privilege.',
    ),
    referenceAnswer: text(
      'SQL dùng parameter binding như WHERE email = $1, không ghép chuỗi; tên cột/sort không bind được thì map từ allowlist. Mongo filter chỉ nhận các field đã định nghĩa, ví dụ { email: { $eq: value } }, không spread body trực tiếp; từ chối key bắt đầu bằng $ hoặc chứa dot nếu không có use case rõ ràng. Thêm max length, regex policy, audit và DB account quyền tối thiểu.',
      'Use SQL parameter binding such as WHERE email = $1, never string concatenation; map column or sort names from an allowlist because identifiers cannot be bound. Mongo filters should accept only defined fields, for example { email: { $eq: value } }, never spread the request body; reject keys beginning with $ or containing dots unless explicitly needed. Add length limits, regex policy, auditing, and least-privilege DB accounts.',
    ),
    learningObjective: text('Phòng injection bằng parameterization, allowlist và schema thay vì chỉ escape chuỗi.', 'Prevent injection with parameterization, allowlists, and schemas rather than string escaping alone.'),
    estimatedTimeSeconds: 360,
    questionType: 'SCENARIO',
    difficulty: 'HARD',
    roleCode: 'SECURITY_ENGINEER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['POSTGRESQL', 'MONGODB'],
    technologyAgnostic: false,
    topic: 'SQL Injection and NoSQL Injection',
    tags: ['sql-injection', 'nosql-injection', 'input-validation', 'secure-query'],
    rubricFocus: text('tách code/data và kiểm soát operator của query', 'code/data separation and query-operator control'),
  },
  {
    key: 'docker-container',
    prompt: text(
      'Một Docker container chạy Node.js bằng root, image lớn và không tự dừng khi app chết. Hãy đề xuất Dockerfile production an toàn hơn, giải thích PID 1, multi-stage build, healthcheck và giới hạn tài nguyên.',
      'A Docker container runs Node.js as root, has a large image, and does not stop correctly when the app dies. Propose a safer production Dockerfile and explain PID 1, multi-stage builds, health checks, and resource limits.',
    ),
    explanation: text(
      'Multi-stage build chỉ copy artifact và production dependencies vào runtime image nhỏ; pin base image digest khi yêu cầu reproducibility, scan CVE và dùng user non-root. PID 1 cần forward signal và reap child process, nên dùng exec form hoặc init nhẹ; healthcheck phản ánh readiness/liveness phù hợp nhưng không thay thế orchestration. Resource requests/limits, read-only filesystem, dropped capabilities, secret injection và log đến stdout giúp giảm blast radius và vận hành tốt hơn.',
      'A multi-stage build copies only artifacts and production dependencies into a small runtime image; pin a base-image digest when reproducibility matters, scan CVEs, and run as a non-root user. PID 1 must forward signals and reap children, so use exec form or a small init; a health check should reflect the right readiness/liveness contract but does not replace orchestration. Resource limits, a read-only filesystem, dropped capabilities, secret injection, and stdout logging improve safety and operations.',
    ),
    referenceAnswer: text(
      'Dùng builder stage cài dependency/build, runtime stage distroless/slim chỉ chứa dist và production dependency, USER node, COPY theo thứ tự tận dụng cache, không bake secret, và CMD dạng exec như ["node", "dist/server.js"]. Thêm HEALTHCHECK cho endpoint nhẹ, cấu hình graceful shutdown, giới hạn CPU/memory và scan image. Không dùng container như VM; process chính phải nhận SIGTERM và thoát sạch.',
      'Use a builder stage for dependencies/build and a slim or distroless runtime with only dist and production dependencies, USER node, cache-friendly COPY order, no baked-in secrets, and an exec CMD such as ["node", "dist/server.js"]. Add a lightweight HEALTHCHECK, graceful shutdown, CPU/memory limits, and image scanning. A container is not a VM; the main process must receive SIGTERM and exit cleanly.',
    ),
    learningObjective: text('Đóng gói service container nhỏ, reproducible và giảm quyền khi chạy production.', 'Package a small, reproducible service image with reduced runtime privileges.'),
    estimatedTimeSeconds: 360,
    questionType: 'SCENARIO',
    difficulty: 'MEDIUM',
    roleCode: 'DEVOPS_ENGINEER',
    levelCodes: ['JUNIOR', 'MIDDLE'],
    technologyCodes: ['DOCKER'],
    technologyAgnostic: false,
    topic: 'Docker container',
    tags: ['docker', 'containers', 'hardening', 'multi-stage-build'],
    rubricFocus: text('image lifecycle, process signal và container hardening', 'image lifecycle, process signals, and container hardening'),
  },
  {
    key: 'cicd-pipeline',
    prompt: text(
      'Hãy thiết kế CI/CD pipeline cho backend và frontend: từ pull request đến production. Pipeline cần kiểm tra chất lượng, bảo mật, artifact bất biến, migration database, canary/rollback và quyền deploy tối thiểu.',
      'Design a CI/CD pipeline for a backend and frontend from pull request to production. It must cover quality and security checks, immutable artifacts, database migrations, canary/rollback, and least-privilege deployment access.',
    ),
    explanation: text(
      'Pipeline nên tách fast feedback (format/typecheck/unit) khỏi integration/e2e, dependency/container/SAST/secret scan và policy gate. Build một artifact được ký hoặc định danh bằng digest, promote cùng artifact qua staging/canary thay vì build lại. Migration phải backward-compatible và có kế hoạch expand/contract; deploy có health/SLO gate, gradual rollout và rollback code/config, đồng thời tránh rollback schema phá dữ liệu. Credentials dùng short-lived identity/OIDC, protected environment và audit.',
      'The pipeline should separate fast feedback (format/typecheck/unit) from integration/e2e, dependency/container/SAST/secret scans, and policy gates. Build one signed or digest-identified artifact and promote that artifact through staging/canary instead of rebuilding. Database changes should be backward-compatible with an expand/contract plan; deployment uses health/SLO gates and gradual rollout, with rollback for code/config without breaking schema. Use short-lived OIDC identity, protected environments, and audit logs.',
    ),
    referenceAnswer: text(
      'PR chạy lint/typecheck/unit, integration/e2e, dependency và secret scan; merge vào main build image/artifacts có version immutable, publish registry, deploy staging rồi smoke test. Production dùng approval, canary theo metrics error rate/latency, tự dừng khi vượt threshold và rollback artifact trước. DB migration expand/contract, feature flag cho compatibility, secrets không nằm trong repo, runner/deployer có quyền hẹp và mọi thao tác có audit.',
      'PRs run lint/typecheck/unit, integration/e2e, dependency, and secret scans; merging to main builds versioned immutable images/artifacts, publishes them, deploys staging, and runs smoke tests. Production uses approval and metrics-driven canary on error rate/latency, stopping on thresholds and rolling back the artifact first. Use expand/contract migrations, feature flags for compatibility, no secrets in the repo, narrow runner/deployer permissions, and audited actions.',
    ),
    learningObjective: text('Thiết kế pipeline phát hành nhanh nhưng có quality gate, rollback và supply-chain security.', 'Design delivery pipelines with quality gates, rollback, and supply-chain security.'),
    estimatedTimeSeconds: 420,
    questionType: 'SYSTEM_DESIGN',
    difficulty: 'HARD',
    roleCode: 'DEVOPS_ENGINEER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['CI_CD', 'DOCKER'],
    technologyAgnostic: false,
    topic: 'CI/CD pipeline',
    tags: ['ci-cd', 'continuous-delivery', 'deployment', 'rollback'],
    rubricFocus: text('artifact promotion, rollout safety và deployment security', 'artifact promotion, rollout safety, and deployment security'),
  },
  {
    key: 'url-shortener-system-design',
    prompt: text(
      'Thiết kế hệ thống rút gọn URL cho 100 triệu URL và lưu lượng redirect cao hơn nhiều lần lưu lượng tạo link. Hãy trình bày API, sinh short code, lưu trữ, cache, custom alias, abuse prevention và analytics.',
      'Design a URL shortener for 100 million URLs where redirect traffic is much higher than link-creation traffic. Cover APIs, short-code generation, storage, caching, custom aliases, abuse prevention, and analytics.',
    ),
    explanation: text(
      'Redirect là read-heavy nên cache key short code ở edge/Redis, còn database lưu mapping bền vững và expiry/owner. Short code có thể dựa trên sequence/ID mã hóa base62 để tránh collision; custom alias cần unique constraint và policy. API create phải idempotent khi client retry, redirect cần rate limit, validation chống SSRF/phishing và telemetry bất đồng bộ. Scale bằng read replicas/sharding phù hợp, cache stampede protection, negative caching có TTL và observability p95/p99, cache hit, hot keys, redirect errors.',
      'Redirects are read-heavy, so cache the short code at the edge/Redis while the database stores durable mapping, expiry, and ownership. A short code can use a sequence or ID encoded in base62 to avoid collisions; custom aliases need a unique constraint and policy. Creation should be idempotent on retries, and redirects need rate limits, anti-abuse validation, and asynchronous telemetry. Scale with replicas/sharding as needed, stampede protection, bounded negative caching, and p95/p99, hit-rate, hot-key, and redirect-error observability.',
    ),
    referenceAnswer: text(
      'POST /links tạo record với unique shortCode, GET /{code} tra cache rồi DB và trả 301/302 tùy semantics. Dùng ID tăng dần hoặc random code với collision check, mã hóa base62; Redis có TTL và invalidate khi link đổi. Tách click event qua queue, không chặn redirect; giới hạn abuse, kiểm tra scheme/domain, hỗ trợ revoke/expiry và chọn consistency/availability phù hợp. Nêu rõ capacity, hot key và failure mode.',
      'POST /links creates a record with a unique shortCode; GET /{code} checks cache then the database and returns 301/302 based on semantics. Use an increasing ID or random code with collision checks, encoded as base62; Redis has a TTL and is invalidated when a link changes. Send click events asynchronously so redirects stay fast; add abuse limits, scheme/domain checks, revoke/expiry, and explicit consistency/availability choices. State capacity, hot-key, and failure assumptions.',
    ),
    learningObjective: text('Phân rã bài toán read-heavy và nêu được trade-off scale, cache, consistency và abuse.', 'Decompose a read-heavy system and articulate scale, cache, consistency, and abuse trade-offs.'),
    estimatedTimeSeconds: 480,
    questionType: 'SYSTEM_DESIGN',
    difficulty: 'HARD',
    roleCode: 'BACKEND_DEVELOPER',
    levelCodes: ['SENIOR', 'LEAD'],
    technologyCodes: ['NODEJS', 'POSTGRESQL', 'REDIS'],
    technologyAgnostic: false,
    topic: 'System design: URL shortener',
    tags: ['system-design', 'url-shortener', 'redis', 'scalability'],
    rubricFocus: text('capacity, data model và read-heavy scaling', 'capacity, data modeling, and read-heavy scaling'),
  },
  {
    key: 'behavioral-star',
    prompt: text(
      'Hãy kể về một lần bạn phải xử lý mâu thuẫn giữa deadline và chất lượng kỹ thuật. Trả lời theo STAR, làm rõ Situation, Task, Action, Result và điều bạn học được; người phỏng vấn nên đánh giá câu trả lời này thế nào?',
      'Tell me about a time you had to handle a conflict between a deadline and engineering quality. Answer using STAR, making Situation, Task, Action, Result, and learning explicit; how should an interviewer evaluate the answer?',
    ),
    explanation: text(
      'STAR giúp biến câu chuyện thành bằng chứng có cấu trúc: Situation nêu bối cảnh ngắn, Task nói trách nhiệm và constraint, Action tập trung vào hành động cá nhân cùng trade-off, Result dùng outcome đo được và Learning nêu cải tiến. Câu trả lời tốt không đổ lỗi, thể hiện giao tiếp với stakeholder, quyết định dựa trên rủi ro và sự trung thực về phần chưa tốt. Người phỏng vấn nên đánh giá ownership, judgment, collaboration và impact, không chấm theo việc câu chuyện “nghe hay”.',
      'STAR turns a story into structured evidence: Situation gives concise context, Task states responsibility and constraints, Action focuses on personal actions and trade-offs, Result gives measurable outcomes, and Learning describes improvement. A strong answer avoids blame, shows stakeholder communication, risk-based decisions, and honesty about shortcomings. The interviewer should assess ownership, judgment, collaboration, and impact rather than how entertaining the story sounds.',
    ),
    referenceAnswer: text(
      'Một câu trả lời tốt nêu ví dụ cụ thể, vai trò cá nhân và constraint; mô tả cách làm rõ rủi ro, đề xuất phương án giảm scope hoặc feature flag, thống nhất với stakeholder, rồi đo kết quả như thời gian giao hàng, defect hoặc incident. Kết thúc bằng điều đã học và thay đổi quy trình. Không nhận công của cả nhóm, không nói chung chung và không che giấu kết quả không hoàn hảo.',
      'A strong answer gives a specific example, personal role, and constraints; explains how risks were clarified, scope reduced or feature-flagged, stakeholders aligned, and outcomes measured through delivery time, defects, or incidents. It ends with a concrete lesson and process change. Do not claim the whole team’s work, stay vague, or hide an imperfect result.',
    ),
    learningObjective: text('Trình bày bằng chứng hành vi có cấu trúc, ownership và kết quả đo được.', 'Present structured behavioral evidence with ownership and measurable outcomes.'),
    estimatedTimeSeconds: 360,
    questionType: 'BEHAVIORAL',
    difficulty: 'MEDIUM',
    roleCode: 'FULLSTACK_DEVELOPER',
    levelCodes: ['FRESHER', 'JUNIOR', 'MIDDLE', 'SENIOR'],
    technologyCodes: [],
    technologyAgnostic: true,
    topic: 'Behavioral interview using STAR',
    tags: ['behavioral', 'star', 'communication', 'ownership'],
    rubricFocus: text('cấu trúc STAR, ownership và impact', 'STAR structure, ownership, and impact'),
  },
  {
    key: 'debug-production-incident',
    prompt: text(
      'Sau một lần deploy, tỷ lệ 5xx và p99 latency tăng mạnh trong production. Hãy mô tả 15 phút đầu tiên bạn sẽ làm gì, cách hình thành hypothesis, quyết định rollback/mitigation, giao tiếp incident và bước follow-up sau khi khôi phục.',
      'After a deployment, production 5xx errors and p99 latency rise sharply. Describe what you do in the first 15 minutes, how you form hypotheses, decide on rollback or mitigation, communicate the incident, and follow up after recovery.',
    ),
    explanation: text(
      'Ưu tiên ổn định dịch vụ và an toàn người dùng: xác nhận alert, phạm vi và thời điểm; mở incident, phân vai incident commander/communicator/ops; so sánh metric trước-sau deploy, logs/traces và dependency health. Hypothesis phải dựa trên tín hiệu và được kiểm tra bằng thay đổi nhỏ, không sửa mù trong production. Rollback nhanh nếu tương quan rõ và an toàn, hoặc tắt feature/giảm traffic; ghi timeline, cập nhật stakeholder và sau đó làm postmortem không đổ lỗi với action có owner/due date.',
      'Prioritize service stability and user safety: validate the alert, scope, and timeline; open an incident and assign incident commander, communicator, and ops roles; compare pre/post-deploy metrics, logs/traces, and dependency health. Hypotheses should be evidence-driven and tested with small changes, not blind production edits. Roll back when correlation is clear and safe, or disable a feature/reduce traffic; record a timeline, update stakeholders, and conduct a blameless postmortem with owned, dated actions.',
    ),
    referenceAnswer: text(
      'Trong 15 phút đầu: xác nhận lỗi và blast radius, freeze deploy, mở bridge, phân vai, cập nhật status page; kiểm tra dashboard error rate/latency/saturation, release marker, logs/traces và dependency. Nếu deploy là thay đổi duy nhất và rollback an toàn, rollback hoặc disable flag, theo dõi recovery rồi mới điều tra sâu. Lưu evidence, không xóa log; sau incident viết timeline, root/contributing causes, test/alert/runbook và action owner rõ ràng.',
      'In the first 15 minutes: confirm symptoms and blast radius, freeze deployments, open a bridge, assign roles, and update the status page; inspect error rate/latency/saturation, release markers, logs/traces, and dependencies. If the deploy is the only material change and rollback is safe, roll back or disable a flag, watch recovery, and then investigate deeply. Preserve evidence; afterwards document the timeline, root and contributing causes, tests/alerts/runbooks, and named owners.',
    ),
    learningObjective: text('Thực hiện incident response có thứ tự, dựa trên dữ liệu và có khả năng phục hồi.', 'Execute data-driven incident response with safe mitigation and recovery.'),
    estimatedTimeSeconds: 420,
    questionType: 'SCENARIO',
    difficulty: 'HARD',
    roleCode: 'DEVOPS_ENGINEER',
    levelCodes: ['MIDDLE', 'SENIOR'],
    technologyCodes: ['NODEJS', 'DOCKER'],
    technologyAgnostic: false,
    topic: 'Debugging a production incident',
    tags: ['debugging', 'production-incident', 'observability', 'rollback'],
    rubricFocus: text('triage, mitigation và learning sau incident', 'triage, mitigation, and post-incident learning'),
  },
];

type ResolvedTaxonomy = {
  roles: Map<string, Types.ObjectId>;
  levels: Map<string, Types.ObjectId>;
  technologies: Map<string, Types.ObjectId>;
};

const resolveTaxonomy = async (): Promise<ResolvedTaxonomy> => {
  const [roles, levels, technologies] = await Promise.all([
    Role.find().select('_id code').lean().exec(),
    Level.find().select('_id code').lean().exec(),
    Technology.find().select('_id code').lean().exec(),
  ]);

  const roleMap = new Map(roles.map((role) => [role.code, role._id]));
  const levelMap = new Map(levels.map((level) => [level.code, level._id]));
  const technologyMap = new Map(technologies.map((technology) => [technology.code, technology._id]));
  const missing = new Set<string>();

  for (const question of questions) {
    if (!roleMap.has(question.roleCode)) missing.add(`Role ${question.roleCode}`);
    for (const levelCode of question.levelCodes) {
      if (!levelMap.has(levelCode)) missing.add(`Level ${levelCode}`);
    }
    for (const technologyCode of question.technologyCodes) {
      if (!technologyMap.has(technologyCode)) missing.add(`Technology ${technologyCode}`);
    }
  }

  if (missing.size > 0) {
    throw new Error(`Thiếu taxonomy để seed Question Bank: ${[...missing].join(', ')}`);
  }

  return { roles: roleMap, levels: levelMap, technologies: technologyMap };
};

const allocateUnusedCode = async (
  year: number,
  session: mongoose.ClientSession,
  counter: QuestionCounterRepository,
): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const allocation = await counter.allocateCode(year, session);
    const existing = await Question.findOne({ code: allocation.code })
      .select('_id')
      .session(session)
      .lean()
      .exec();
    if (!existing) return allocation.code;
  }

  throw new Error('Không thể cấp mã Question Bank không trùng sau nhiều lần thử');
};

const createSeedDraft = (
  definition: SeedQuestionDefinition,
  taxonomy: ResolvedTaxonomy,
): QuestionVersionDraftFields & { technologyObjectIds: Array<{ technologyId: Types.ObjectId; relevance: number }> } => ({
  prompt: definition.prompt,
  explanation: definition.explanation,
  followUps: [],
  referenceAnswer: definition.referenceAnswer,
  learningObjective: definition.learningObjective,
  estimatedTimeSeconds: definition.estimatedTimeSeconds,
  rubric: rubricFor(definition.rubricFocus),
  questionType: definition.questionType,
  difficulty: definition.difficulty,
  primaryRoleId: taxonomy.roles.get(definition.roleCode)!.toString(),
  additionalRoleIds: [],
  levelIds: definition.levelCodes.map((code) => taxonomy.levels.get(code)!.toString()),
  technologies: definition.technologyCodes.map((code) => ({
    technologyId: taxonomy.technologies.get(code)!.toString(),
    relevance: 100,
  })),
  technologyObjectIds: definition.technologyCodes.map((code) => ({
    technologyId: taxonomy.technologies.get(code)!,
    relevance: 100,
  })),
  technologyAgnostic: definition.technologyAgnostic,
  classificationComplete: true,
  topic: definition.topic,
  tags: [...definition.tags],
  changeSummary: 'Seed 20 câu hỏi IT interview song ngữ cho thư viện học tập',
});

export type SeedQuestionBankResult = {
  created: number;
  skipped: number;
};

export const seedQuestionBank = async (): Promise<SeedQuestionBankResult> => {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_SAMPLE_QUESTION_BANK !== 'true') {
    console.log('⏭️ Bỏ qua sample Question Bank trong production; đặt SEED_SAMPLE_QUESTION_BANK=true để bật rõ ràng.');
    return { created: 0, skipped: 0 };
  }

  await seedLevels();
  await seedRoles();
  await seedTechnologies();

  const admin = await User.findOne({ role: 'ADMIN', status: 'ACTIVE' })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id')
    .lean()
    .exec();
  if (!admin) {
    throw new Error('Không tìm thấy admin ACTIVE để làm owner/author cho sample Question Bank');
  }

  const taxonomy = await resolveTaxonomy();
  const counter = new QuestionCounterRepository();
  const year = new Date().getUTCFullYear();
  let created = 0;
  let skipped = 0;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const definition of questions) {
        const sourceReference = `${QUESTION_BANK_SEED_SOURCE_PREFIX}${definition.key}`;
        const existingVersion = await QuestionVersion.findOne({ sourceReference })
          .session(session)
          .exec();

        if (existingVersion) {
          const existingQuestion = await Question.findById(existingVersion.questionId).session(session).exec();
          const pointerIsCorrect = Boolean(
            existingQuestion?.currentPublishedVersionId?.equals(existingVersion._id),
          );
          if (
            !existingQuestion ||
            existingQuestion.lifecycleStatus !== 'ACTIVE' ||
            existingVersion.status !== 'PUBLISHED' ||
            !pointerIsCorrect
          ) {
            throw new Error(`Sample Question Bank không nhất quán: ${sourceReference}`);
          }
          skipped += 1;
          continue;
        }

        const draft = createSeedDraft(definition, taxonomy);
        const questionId = new Types.ObjectId();
        const versionId = new Types.ObjectId();
        const code = await allocateUnusedCode(year, session, counter);
        const contentHash = createContentHash(definition);
        const normalizedPromptFingerprint = normalizePromptFingerprint(definition.prompt);

        await Question.create(
          [{
            _id: questionId,
            code,
            lifecycleStatus: 'ACTIVE',
            currentPublishedVersionId: versionId,
            draftVersionId: null,
            latestVersionNumber: 1,
            ownerId: admin._id,
            revision: 1,
            createdBy: admin._id,
            updatedBy: admin._id,
          }],
          { session },
        );

        await QuestionVersion.create(
          [{
            _id: versionId,
            questionId,
            versionNumber: 1,
            status: 'PUBLISHED',
            revision: 1,
            prompt: draft.prompt,
            explanation: draft.explanation,
            followUps: draft.followUps,
            questionType: draft.questionType,
            difficulty: draft.difficulty,
            primaryRoleId: taxonomy.roles.get(definition.roleCode)!,
            additionalRoleIds: [],
            levelIds: definition.levelCodes.map((levelCode) => taxonomy.levels.get(levelCode)!),
            technologies: draft.technologyObjectIds,
            technologyAgnostic: draft.technologyAgnostic,
            classificationComplete: draft.classificationComplete,
            topic: draft.topic,
            tags: draft.tags,
            referenceAnswer: draft.referenceAnswer,
            learningObjective: draft.learningObjective,
            estimatedTimeSeconds: draft.estimatedTimeSeconds,
            rubric: draft.rubric,
            changeSummary: draft.changeSummary,
            origin: 'IMPORTED',
            sourceVersionId: null,
            sourceReference,
            contentHash,
            normalizedPromptFingerprint,
            createdBy: admin._id,
            updatedBy: admin._id,
            contributorIds: [admin._id],
          }],
          { session },
        );
        created += 1;
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(`✅ Question Bank sample: tạo ${created}, giữ nguyên ${skipped}, tổng ${questions.length} câu.`);
  return { created, skipped };
};
