import React, { useState, useEffect } from 'react';
import type {
  Question,
  AnswerMode,
  CodeLanguage,
  StarData,
  SpeechMetrics,
  ArchitectureCritiqueData,
} from '../types';
import type { ExecutionResultData, AiReviewData } from '../hooks/useCodeExecution';
import type { ArchitectureNode, ArchitectureEdge } from '../hooks/useSystemDesignWhiteboard';
import { AnswerModeSelector } from './AnswerModeSelector';
import { CodeWorkspace } from './CodeWorkspace';
import { StarAnswerHelper, serializeStarData } from './StarAnswerHelper';
import { SpeechTelemetryHUD } from './SpeechTelemetryHUD';
import { SystemDesignCanvas } from './SystemDesignCanvas';
import { ChartErrorBoundary } from '../../../design-system';

export interface QuestionCardProps {
  question: Question;
  currentAnswer: string;
  onAnswerChange: (answer: string) => void;
  index: number;
  /** Chế độ nhập liệu hiện tại */
  answerMode: AnswerMode;
  /** Callback đổi chế độ */
  onAnswerModeChange: (mode: AnswerMode) => void;
  /** Ngôn ngữ code hiện tại */
  codeLanguage: CodeLanguage;
  /** Callback đổi ngôn ngữ code */
  onCodeLanguageChange: (lang: CodeLanguage) => void;
  /** Dữ liệu STAR hiện tại */
  starData: StarData;
  /** Callback khi STAR data thay đổi */
  onStarDataChange: (data: StarData) => void;
  /** Transcript từ speech recognition */
  speechTranscript?: string;
  /** Đang lắng nghe mic */
  isListening: boolean;
  /** Bắt đầu lắng nghe */
  onStartListening: () => void;
  /** Dừng lắng nghe */
  onStopListening: () => void;
  /** Trình duyệt có hỗ trợ STT không */
  isSttSupported: boolean;
  /** Chỉ số giọng nói */
  speechMetrics?: SpeechMetrics;
  /** Thực thi code */
  onRunCode?: () => void;
  isRunningCode?: boolean;
  executionResult?: ExecutionResultData | null;
  aiReviewResult?: AiReviewData | null;
  codeExecutionError?: string | null;
  onClearCodeOutput?: () => void;
  /** Danh sách nút trên canvas bảng vẽ */
  whiteboardNodes?: ArchitectureNode[];
  /** Danh sách liên kết trên canvas bảng vẽ */
  whiteboardEdges?: ArchitectureEdge[];
  /** Thêm nút vào bảng vẽ */
  onAddWhiteboardNode?: (type: string, label: string, x: number, y: number) => void;
  /** Thêm liên kết vào bảng vẽ */
  onAddWhiteboardEdge?: (from: string, to: string, protocol?: string) => void;
  /** Nộp bản vẽ để AI Vision phản biện */
  onSubmitWhiteboardSnapshot?: () => void;
  /** Đang gửi phân tích thị giác */
  isWhiteboardSubmitting?: boolean;
  /** Kết quả phản biện kiến trúc */
  whiteboardCritique?: ArchitectureCritiqueData | null;
  /** Đóng overlay phản biện */
  onCloseWhiteboardCritique?: () => void;
  /** Xóa bảng vẽ */
  onClearWhiteboard?: () => void;
  /** Ngôn ngữ hiển thị, controlled by parent */
  lang?: 'vi' | 'en';
  /** Callback đổi ngôn ngữ */
  onLangChange?: (lang: 'vi' | 'en') => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  index,
  answerMode,
  onAnswerModeChange,
  codeLanguage,
  onCodeLanguageChange,
  starData,
  onStarDataChange,
  isListening,
  onStartListening,
  onStopListening,
  isSttSupported,
  speechMetrics,
  onRunCode,
  isRunningCode,
  executionResult,
  aiReviewResult,
  codeExecutionError,
  onClearCodeOutput,
  whiteboardNodes,
  whiteboardEdges,
  onAddWhiteboardNode,
  onAddWhiteboardEdge,
  onSubmitWhiteboardSnapshot,
  isWhiteboardSubmitting = false,
  whiteboardCritique,
  onCloseWhiteboardCritique,
  onClearWhiteboard,
  lang: controlledLang,
  onLangChange,
}) => {
  const [internalLang, setInternalLang] = useState<'vi' | 'en'>(controlledLang || 'vi');
  const lang = controlledLang ?? internalLang;
  const setLang = (newLang: 'vi' | 'en') => {
    setInternalLang(newLang);
    onLangChange?.(newLang);
  };

  useEffect(() => {
    if (controlledLang !== undefined) setInternalLang(controlledLang);
  }, [controlledLang]);

  const [fallbackNodes, setFallbackNodes] = useState<any[]>([]);
  const [fallbackEdges, setFallbackEdges] = useState<any[]>([]);

  const cardLabels = {
    vi: {
      questionTitle: (n: number) => `Câu hỏi ${n}`,
      stopSpeaking: 'Dừng nói',
      startSpeaking: 'Bắt đầu nói',
      micUnsupported: 'Mic không hỗ trợ',
      answerModeLabel: 'Chế độ trả lời:',
      charsCount: (n: number) => `${n} ký tự`,
      answerPlaceholder: 'Nhập câu trả lời của bạn tại đây...',
      answerAriaLabel: 'Câu trả lời của bạn',
    },
    en: {
      questionTitle: (n: number) => `Question ${n}`,
      stopSpeaking: 'Stop speaking',
      startSpeaking: 'Start speaking',
      micUnsupported: 'Microphone unsupported',
      answerModeLabel: 'Answer mode:',
      charsCount: (n: number) => `${n} characters`,
      answerPlaceholder: 'Enter your answer here...',
      answerAriaLabel: 'Your answer',
    },
  } as const;
  const cl = cardLabels[lang];

  const handleStarChange = (data: StarData) => {
    onStarDataChange(data);
    onAnswerChange(serializeStarData(data));
  };

  const handleCodeChange = (code: string) => {
    onAnswerChange(code);
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 p-6 sm:p-8 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 gap-6">
      {/* Top Header: Question Meta & Language Switcher */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            {cl.questionTitle(index + 1)}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                question.difficulty.toLowerCase() === 'hard'
                  ? 'bg-red-100 text-red-700'
                  : question.difficulty.toLowerCase() === 'medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {question.difficulty}
            </span>
            {question.category && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                {question.category}
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-100 p-1 rounded-lg inline-flex">
          <button
            type="button"
            aria-pressed={lang === 'vi'}
            onClick={() => setLang('vi')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              lang === 'vi'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            VI
          </button>
          <button
            type="button"
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              lang === 'en'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Question Content */}
      <div className="prose prose-slate max-w-none">
        <p className="text-lg leading-relaxed text-slate-800 font-medium">
          {question.content[lang] || question.content.vi || question.content.en || ''}
        </p>
      </div>

      {/* Voice Assistant HUD Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Mic toggle button */}
        {isSttSupported ? (
          <button
            type="button"
            onClick={isListening ? onStopListening : onStartListening}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200'
            }`}
          >
            <span className="text-sm" aria-hidden="true">{isListening ? '⏹' : '🎤'}</span>
            <span>{isListening ? cl.stopSpeaking : cl.startSpeaking}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="px-3.5 py-2.5 rounded-2xl text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shrink-0"
          >
            {cl.micUnsupported}
          </button>
        )}

        {/* Realtime Telemetry */}
        <div className="flex-1 min-w-0">
          <SpeechTelemetryHUD metrics={speechMetrics} isListening={isListening} />
        </div>
      </div>

      {/* Workspace Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 select-none">
            {cl.answerModeLabel}
          </span>
          <AnswerModeSelector activeMode={answerMode} onModeChange={onAnswerModeChange} />
        </div>

        {currentAnswer.length > 0 && (
          <span className="text-xs font-medium text-slate-500">
            {cl.charsCount(currentAnswer.length)}
          </span>
        )}
      </div>

      {/* Dynamic Active Workspace */}
      <div className="flex-1 flex flex-col min-h-[280px]">
        {answerMode === 'text' && (
          <textarea
            aria-label={cl.answerAriaLabel}
            value={currentAnswer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder={cl.answerPlaceholder}
            className="flex-1 w-full bg-slate-50/50 border border-slate-200 rounded-2xl p-4 sm:p-6 text-slate-700 text-base resize-none transition-all duration-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 placeholder:text-slate-400"
          />
        )}

        {answerMode === 'code' && (
          <CodeWorkspace
            value={currentAnswer}
            onChange={handleCodeChange}
            language={codeLanguage}
            onLanguageChange={onCodeLanguageChange}
            onRunCode={onRunCode}
            isRunning={isRunningCode}
            executionResult={executionResult}
            aiReviewResult={aiReviewResult}
            error={codeExecutionError}
            onClearOutput={onClearCodeOutput}
          />
        )}

        {answerMode === 'star' && (
          <StarAnswerHelper value={starData} onChange={handleStarChange} />
        )}

        {answerMode === 'whiteboard' && (
          <ChartErrorBoundary language={lang}>
            <SystemDesignCanvas
              nodes={whiteboardNodes || fallbackNodes}
              edges={whiteboardEdges || fallbackEdges}
              onAddNode={
                onAddWhiteboardNode ||
                ((type, label, x, y) => {
                  setFallbackNodes((prev) => [
                    ...prev,
                    { id: `node-${Date.now()}`, type, label, x, y },
                  ]);
                })
              }
              onAddEdge={
                onAddWhiteboardEdge ||
                ((from, to, protocol) => {
                  setFallbackEdges((prev) => [
                    ...prev,
                    { id: `edge-${Date.now()}`, from, to, protocol },
                  ]);
                })
              }
              onSubmitSnapshot={onSubmitWhiteboardSnapshot || (() => {})}
              isSubmitting={isWhiteboardSubmitting}
              critique={whiteboardCritique}
              onCloseCritique={onCloseWhiteboardCritique}
              onClear={
                onClearWhiteboard ||
                (() => {
                  setFallbackNodes([]);
                  setFallbackEdges([]);
                })
              }
            />
          </ChartErrorBoundary>
        )}
      </div>
    </div>
  );
};
