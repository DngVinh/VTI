import React, { useRef, useState } from 'react';
import type { CodeLanguage } from '../types';

export interface CodeWorkspaceProps {
  /** Nội dung code hiện tại */
  value: string;
  /** Callback khi code thay đổi */
  onChange: (code: string) => void;
  /** Ngôn ngữ lập trình đang chọn */
  language: CodeLanguage;
  /** Callback khi đổi ngôn ngữ */
  onLanguageChange: (lang: CodeLanguage) => void;
  /** Callback khi bấm nút Chạy mã hoặc ấn Ctrl+Enter */
  onRunCode?: () => void;
  /** Trạng thái sandbox đang thực thi */
  isRunning?: boolean;
  /** Kết quả thực thi từ sandbox */
  executionResult?: {
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    memoryKb?: number;
    testResults?: Array<{
      testCaseIndex: number;
      passed: boolean;
      actualOutput: string;
      expectedOutput: string;
      executionTimeMs: number;
      isHidden: boolean;
    }>;
  } | null;
  /** Đánh giá AST / AI Review */
  aiReviewResult?: {
    astComplexity: {
      estimatedTimeComplexity: string;
      estimatedSpaceComplexity: string;
      cyclomaticComplexity: number;
      maxLoopNesting: number;
      hasRecursion: boolean;
      detectedSmells: string[];
    };
    feedback: { vi: string; en: string };
    suggestions: Array<{ vi: string; en: string }>;
    cleanCodeScore: number;
  } | null;
  /** Thông báo lỗi từ sandbox hoặc server */
  error?: string | null;
  /** Callback xóa output */
  onClearOutput?: () => void;
}

const SUPPORTED_LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'cpp', label: 'C++' },
  { value: 'sql', label: 'SQL' },
];

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({
  value,
  onChange,
  language,
  onLanguageChange,
  onRunCode,
  isRunning = false,
  executionResult,
  aiReviewResult,
  error,
  onClearOutput,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'review'>('console');

  const lines = value.split('\n');
  const lineCount = Math.max(1, lines.length);

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter: Run Code
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunning && onRunCode) {
        onRunCode();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab: remove up to 2 spaces from start of line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        if (value.substring(lineStart, lineStart + 2) === '  ') {
          const newValue = value.substring(0, lineStart) + value.substring(lineStart + 2);
          onChange(newValue);
          requestAnimationFrame(() => {
            target.selectionStart = Math.max(lineStart, start - 2);
            target.selectionEnd = Math.max(lineStart, end - 2);
          });
        } else if (value.substring(lineStart, lineStart + 1) === ' ') {
          const newValue = value.substring(0, lineStart) + value.substring(lineStart + 1);
          onChange(newValue);
          requestAnimationFrame(() => {
            target.selectionStart = Math.max(lineStart, start - 1);
            target.selectionEnd = Math.max(lineStart, end - 1);
          });
        }
      } else {
        // Tab: insert 2 spaces
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          target.selectionStart = start + 2;
          target.selectionEnd = start + 2;
        });
      }
    }
  };

  const hasOutput = Boolean(executionResult || error || aiReviewResult);

  return (
    <div className="flex-1 flex flex-col min-h-[420px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-inner text-slate-100">
      {/* Top Bar with Language Selector, Run Button, and Info */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="code-language-select" className="text-slate-400 font-semibold select-none">
              Ngôn ngữ:
            </label>
            <select
              id="code-language-select"
              aria-label="Ngôn ngữ lập trình"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as CodeLanguage)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {onRunCode && (
            <button
              type="button"
              onClick={onRunCode}
              disabled={isRunning}
              aria-label={isRunning ? 'Đang chạy...' : 'Chạy mã'}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                isRunning
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-emerald-950'
              }`}
            >
              {isRunning ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span>Đang chạy...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Chạy mã (Ctrl+Enter)</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px] select-none">
          <span>{lineCount} dòng</span>
          <span>Tab: 2 spaces</span>
        </div>
      </div>

      {/* Editor Body: Line numbers + Textarea */}
      <div className="flex-1 flex relative overflow-hidden bg-slate-900/90 font-mono text-sm leading-6 min-h-[220px]">
        {/* Line Numbers column */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="w-12 bg-slate-950/40 border-r border-slate-800/80 py-4 select-none text-right pr-3 text-slate-500 shrink-0 flex flex-col font-mono overflow-hidden"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <span key={i} data-testid="line-number" className="leading-6">
              {i + 1}
            </span>
          ))}
        </div>

        {/* Code Textarea */}
        <textarea
          ref={textareaRef}
          aria-label="Khung soạn thảo mã nguồn"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="// Nhập mã nguồn của bạn tại đây... (Nhấn Ctrl+Enter để chạy thử)"
          className="flex-1 w-full p-4 bg-transparent text-slate-200 placeholder:text-slate-600 font-mono text-sm leading-6 resize-none outline-none overflow-auto whitespace-pre tab-2"
        />
      </div>

      {/* Output Console & AST Panel */}
      {hasOutput && (
        <div className="border-t border-slate-800 bg-slate-950 flex flex-col text-xs max-h-56 overflow-hidden">
          {/* Header tabs */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('console')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeTab === 'console'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Console Đầu ra
              </button>
              {aiReviewResult && (
                <button
                  type="button"
                  onClick={() => setActiveTab('review')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === 'review'
                      ? 'bg-slate-800 text-indigo-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Phân tích AI</span>
                  <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-mono text-[10px]">
                    {aiReviewResult.astComplexity.estimatedTimeComplexity}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {executionResult && (
                <span className="text-slate-500 font-mono text-[11px]">
                  {executionResult.executionTimeMs} ms | Exit: {executionResult.exitCode}
                </span>
              )}
              {onClearOutput && (
                <button
                  type="button"
                  onClick={onClearOutput}
                  className="text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-3 overflow-y-auto font-mono max-h-40 leading-relaxed">
            {activeTab === 'console' && (
              <>
                {error && (
                  <div className="text-rose-400 mb-2 whitespace-pre-wrap">
                    {error}
                  </div>
                )}
                {executionResult?.stderr && (
                  <div className="text-amber-400 mb-2 whitespace-pre-wrap">
                    {executionResult.stderr}
                  </div>
                )}
                {executionResult?.stdout ? (
                  <div className="text-slate-200 whitespace-pre-wrap">
                    {executionResult.stdout}
                  </div>
                ) : !error && !executionResult?.stderr ? (
                  <div className="text-slate-500 italic">Không có dữ liệu stdout</div>
                ) : null}
              </>
            )}

            {activeTab === 'review' && aiReviewResult && (
              <div className="font-sans space-y-2 text-slate-300">
                <div className="flex items-center gap-3 text-xs">
                  <span>
                    Điểm Clean Code:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {aiReviewResult.cleanCodeScore}/100
                    </strong>
                  </span>
                  <span>
                    Độ phức tạp lặp:{' '}
                    <strong className="text-indigo-400 font-mono">
                      {aiReviewResult.astComplexity.maxLoopNesting}
                    </strong>
                  </span>
                </div>
                <div className="text-xs text-slate-200 bg-slate-900/60 p-2 rounded border border-slate-800">
                  {aiReviewResult.feedback.vi}
                </div>
                {aiReviewResult.suggestions.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                    {aiReviewResult.suggestions.map((s, idx) => (
                      <li key={idx}>{s.vi}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

