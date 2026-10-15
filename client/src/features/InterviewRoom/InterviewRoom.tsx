import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewApi } from '../../services/api/interviewApi';
import { useInterviewSession } from './hooks/useInterviewSession';
import { useInterviewTimer } from './hooks/useInterviewTimer';
import { useAutosave } from './hooks/useAutosave';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useWebcam } from './hooks/useWebcam';
import { useFollowUp } from './hooks/useFollowUp';
import { useGeminiLiveAudio } from './hooks/useGeminiLiveAudio';
import { useCodeExecution } from './hooks/useCodeExecution';
import { useSystemDesignWhiteboard } from './hooks/useSystemDesignWhiteboard';
import { ProgressBar } from './components/ProgressBar';
import { InterviewLoadingScreen } from './components/InterviewLoadingScreen';
import { QuestionNavigator } from './components/QuestionNavigator';
import { QuestionCard } from './components/QuestionCard';
import { AiInterviewerCard } from './components/AiInterviewerCard';
import { LiveAiInterviewerAvatar } from './components/LiveAiInterviewerAvatar';
import { WebcamPreview } from './components/WebcamPreview';
import { InterviewPreflightModal } from './components/InterviewPreflightModal';
import { AdaptiveDifficultyBadge } from './components/AdaptiveDifficultyBadge';
import { ConversationThread } from './components/ConversationThread';
import { Modal, Button } from '../../design-system';
import { useTranslation } from '../../locales/I18nContext';
import type { AnswerMode, CodeLanguage, StarData } from './types';

export const InterviewRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Equipment Preflight State
  const [showPreflight, setShowPreflight] = useState(true);

  // Studio Workspace Modes
  const [answerMode, setAnswerMode] = useState<AnswerMode>('text');
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('javascript');
  const [starDataMap, setStarDataMap] = useState<Record<string, StarData>>({});

  // Live Audio State (Phase 5)
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const liveAudio = useGeminiLiveAudio(sessionId || '');

  // Interview Language State (Multimodal Sync)
  const { locale: appLocale } = useTranslation();
  const [interviewLang, setInterviewLang] = useState<'vi' | 'en'>(() => (appLocale === 'en' ? 'en' : 'vi'));
  const speechLocale = interviewLang === 'vi' ? 'vi-VN' : 'en-US';

  const roomLabels = {
    vi: {
      timeRemaining: 'Thời gian còn lại',
      timerAria: 'Thời gian phỏng vấn còn lại',
      saving: 'Đang lưu...',
      saved: 'Đã lưu',
      pauseExit: 'Tạm dừng & Thoát',
      submit: 'Nộp bài',
      submitting: 'Đang nộp...',
      aiMode: 'Chế độ AI:',
      questionList: 'Danh sách câu hỏi',
      selecting: 'Đang chọn',
      answered: 'Đã trả lời',
      unanswered: 'Chưa trả lời',
      adaptiveDifficulty: 'Độ khó thích ứng:',
      aiRefuting: 'AI đang phản biện...',
      sendFollowUp: 'Gửi phản biện AI',
      selectQuestionPrompt: 'Vui lòng chọn câu hỏi từ danh sách.',
      dialogueTitle: 'Luồng đối thoại & Phản biện AI',
      turn: 'Lượt:',
      unansweredModalTitle: 'Chưa hoàn thành tất cả câu hỏi',
      unansweredModalDesc: 'Vui lòng trả lời đầy đủ trước khi nộp bài để có kết quả đánh giá chính xác nhất.',
      continueExam: 'Tiếp tục làm bài',
      submitAnyway: 'Vẫn nộp bài',
      pauseModalTitle: 'Tạm dừng phỏng vấn',
      pauseModalDesc: 'Bạn có thể tạm dừng để làm tiếp sau, hoặc nộp bài ngay với kết quả hiện tại.',
      stayAndContinue: 'Ở lại làm tiếp',
      saveDraftAndExit: 'Lưu nháp & Thoát',
      pauseNotice: 'Khi chọn "Lưu nháp & Thoát", hệ thống sẽ bảo lưu toàn bộ câu trả lời hiện tại. Bạn có thể mở mục Lịch sử phỏng vấn để tiếp tục làm bài bất kỳ lúc nào.',
      submitErrorTitle: 'Không thể nộp bài',
      understood: 'Đã hiểu',
    },
    en: {
      timeRemaining: 'Time Remaining',
      timerAria: 'Remaining interview time',
      saving: 'Saving...',
      saved: 'Saved',
      pauseExit: 'Pause & Exit',
      submit: 'Submit',
      submitting: 'Submitting...',
      aiMode: 'AI Mode:',
      questionList: 'Question List',
      selecting: 'Selected',
      answered: 'Answered',
      unanswered: 'Unanswered',
      adaptiveDifficulty: 'Adaptive Difficulty:',
      aiRefuting: 'AI analyzing...',
      sendFollowUp: 'Send AI Follow-up',
      selectQuestionPrompt: 'Please select a question from the list.',
      dialogueTitle: 'Conversation & AI Follow-up',
      turn: 'Turn:',
      unansweredModalTitle: 'Not all questions answered',
      unansweredModalDesc: 'Please answer all questions before submitting for the most accurate assessment.',
      continueExam: 'Continue Working',
      submitAnyway: 'Submit Anyway',
      pauseModalTitle: 'Pause Interview',
      pauseModalDesc: 'You can pause to continue later, or submit immediately with your current answers.',
      stayAndContinue: 'Stay & Continue',
      saveDraftAndExit: 'Save Draft & Exit',
      pauseNotice: 'Selecting "Save Draft & Exit" preserves your current progress. You can resume at any time from your Interview History.',
      submitErrorTitle: 'Submission Error',
      understood: 'Understood',
    },
  } as const;
  const rl = roomLabels[interviewLang];

  const {
    session,
    isLoading,
    isGenerating,
    error,
    currentQuestion,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    currentAnswer,
    handleAnswerChange,
    totalQuestions,
    answeredCount,
    refetch,
    updateVersion,
  } = useInterviewSession(sessionId || '');

  // Webcam Hook
  const {
    videoRef,
    isActive: isCamActive,
    isCameraOn,
    isMicOn,
    audioLevel,
    error: camError,
    start: startCam,
    stop: stopCam,
    toggleCamera,
    toggleMic,
  } = useWebcam();

  // Speech Synthesis Hook (TTS)
  const {
    isSpeaking,
    isSupported: isTtsSupported,
    speak,
    stop: stopSpeaking,
  } = useSpeechSynthesis();

  // Helper to extract question id safely
  const getQuestionId = (q: { id?: string; _id?: string } | undefined): string => {
    return q?.id || q?._id || '';
  };

  // Voice transcript appender
  const handleVoiceResult = useCallback(
    (chunk: string) => {
      const trimmed = chunk.trim();
      if (!trimmed) return;
      handleAnswerChange(
        currentAnswer.trim() ? `${currentAnswer.trim()} ${trimmed}` : trimmed
      );
    },
    [currentAnswer, handleAnswerChange]
  );

  // Speech Recognition Hook (STT)
  const {
    isListening,
    finalTranscript,
    isSupported: isSttSupported,
    startListening,
    stopListening,
    resetTranscript,
    metrics: speechMetrics,
  } = useSpeechRecognition({
    lang: speechLocale,
    onResult: handleVoiceResult,
  });

  const { isSaving, saveError, forceSave } = useAutosave(
    sessionId || '',
    answers,
    session?.version,
    updateVersion,
    1500,
    session?.status === 'IN_PROGRESS' && !isSubmitting
  );

  // Enable F5 protection
  useBeforeUnload(session?.status === 'IN_PROGRESS' && !isSubmitting);

  // Follow-up Engine Hook
  const currentQuestionId = getQuestionId(currentQuestion);
  const {
    turns: followUpTurns,
    isLoading: isFollowUpLoading,
    lastResponse: followUpResponse,
    turnIndex: followUpTurnIndex,
    maxTurns: followUpMaxTurns,
    isCompleted: isFollowUpCompleted,
    submitFollowUp,
  } = useFollowUp({
    sessionId: sessionId || '',
    questionId: currentQuestionId,
    initialQuestion: currentQuestion?.content,
    enabled: Boolean(sessionId && currentQuestionId),
  });

  // Code Execution Sandbox Hook (Phase 3)
  const codeExecution = useCodeExecution({
    sessionId: sessionId || '',
    questionId: currentQuestionId,
  });

  // System Design Whiteboard Hook (Phase 4)
  const whiteboard = useSystemDesignWhiteboard({
    sessionId: sessionId || '',
    questionId: currentQuestionId,
  });

  const starData = currentQuestionId && starDataMap[currentQuestionId]
    ? starDataMap[currentQuestionId]
    : { situation: '', task: '', action: '', result: '' };

  const handleStarDataChange = useCallback((data: StarData) => {
    if (!currentQuestionId) return;
    setStarDataMap((prev) => ({ ...prev, [currentQuestionId]: data }));
  }, [currentQuestionId]);

  const generateWhiteboardSnapshot = useCallback((): string => {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Architecture Whiteboard Diagram', 30, 40);
    whiteboard.nodes.forEach((node) => {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.fillRect(node.x, node.y, 140, 60);
      ctx.strokeRect(node.x, node.y, 140, 60);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${node.type}: ${node.label}`, node.x + 8, node.y + 35);
    });
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }, [whiteboard.nodes]);

  const prevIndexRef = useRef(currentQuestionIndex);

  // Stop speech/recording and reset mode when navigating between questions
  useEffect(() => {
    if (prevIndexRef.current !== currentQuestionIndex) {
      prevIndexRef.current = currentQuestionIndex;
      stopSpeaking();
      stopListening();
      resetTranscript();
      setAnswerMode('text');
    }
  }, [currentQuestionIndex, resetTranscript, stopListening, stopSpeaking]);

  // Cleanup on room unmount
  useEffect(() => {
    return () => {
      stopCam();
      stopSpeaking();
      stopListening();
    };
  }, [stopCam, stopListening, stopSpeaking]);

  const answeredIndices = React.useMemo(() => {
    const indices = new Set<number>();
    if (session?.questions) {
      session.questions.forEach((q, idx) => {
        const qId = getQuestionId(q);
        const answer = answers.find((a) => a.questionId === qId);
        if (answer && answer.candidateAnswer.trim().length > 0) {
          indices.add(idx);
        }
      });
    }
    return indices;
  }, [session?.questions, answers]);

  const submitRef = useRef<((isAutoSubmit?: boolean) => Promise<void>) | null>(null);
  const submitInFlightRef = useRef<Promise<void> | null>(null);
  const submissionSnapshotRef = useRef<{
    expectedVersion?: number;
    answers: Array<
      | { questionId: string; state: 'ANSWERED'; candidateAnswer: string }
      | { questionId: string; state: 'SKIPPED' }
    >;
  } | null>(null);

  // Timer: 20 minutes (1200 seconds)
  const { formattedTime, progressRatio, stopTimer } = useInterviewTimer(
    1200,
    session?.createdAt || null,
    async () => {
      if (submitRef.current) {
        await submitRef.current(true);
      }
    }
  );

  const [unansweredModalOpen, setUnansweredModalOpen] = useState(false);
  const [unansweredTargetIndex, setUnansweredTargetIndex] = useState<number | null>(null);
  const [submitErrorModal, setSubmitErrorModal] = useState<string | null>(null);
  const [exitModalOpen, setExitModalOpen] = useState(false);

  const handleSaveDraftAndExit = useCallback(async () => {
    try {
      await forceSave();
    } catch (e) {
      console.warn('Lỗi lưu nháp trước khi thoát:', e);
    }
    stopTimer();
    stopCam();
    stopSpeaking();
    stopListening();
    navigate('/history');
  }, [forceSave, stopTimer, stopCam, stopSpeaking, stopListening, navigate]);

  const handleSubmit = useCallback(
    async (isAutoSubmit = false) => {
      if (submitInFlightRef.current) return submitInFlightRef.current;
      if (!isAutoSubmit && session?.questions) {
        const unansweredIndex = session.questions.findIndex((_, idx) => !answeredIndices.has(idx));

        if (unansweredIndex !== -1) {
          setCurrentQuestionIndex(unansweredIndex);
          setUnansweredTargetIndex(unansweredIndex);
          setUnansweredModalOpen(true);
          return;
        }
      }

      const run = async () => {
        setIsSubmitting(true);
        stopTimer();
        stopCam();
        stopSpeaking();
        stopListening();
        try {
          if (!submissionSnapshotRef.current) {
            const expectedVersion = await forceSave();
            const submittedAnswers = (session?.questions ?? []).map((question) => {
              const questionId = question.id || question._id || '';
              const candidateAnswer = answers
                .find((answer) => answer.questionId === questionId)
                ?.candidateAnswer.trim();
              return candidateAnswer
                ? { questionId, state: 'ANSWERED', candidateAnswer }
                : { questionId, state: 'SKIPPED' };
            }) as NonNullable<typeof submissionSnapshotRef.current>['answers'];
            submissionSnapshotRef.current = { expectedVersion, answers: submittedAnswers };
          }
          const snapshot = submissionSnapshotRef.current;
          if (!snapshot) throw new Error('Submission snapshot is unavailable');
          await interviewApi.submitInterview(
            sessionId || '',
            snapshot.expectedVersion,
            snapshot.answers
          );
          await refetch();
        } catch {
          setIsSubmitting(false);
          setSubmitErrorModal('Có lỗi xảy ra khi nộp bài. Vui lòng kiểm tra lại kết nối và thử lại.');
        }
      };
      submitInFlightRef.current = run().finally(() => {
        submitInFlightRef.current = null;
      });
      return submitInFlightRef.current;
    },
    [
      session,
      answeredIndices,
      stopTimer,
      stopCam,
      stopSpeaking,
      stopListening,
      forceSave,
      sessionId,
      answers,
      refetch,
      setCurrentQuestionIndex,
    ]
  );

  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
        <p className="mt-4 text-slate-500 font-medium">Đang tải phòng phỏng vấn Studio...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Không thể tải dữ liệu</h2>
          <p className="text-slate-500 mb-6">{error || 'Không tìm thấy phiên phỏng vấn.'}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl w-full cursor-pointer transition-all"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    const isEvaluating = session.status === 'EVALUATING';
    return <InterviewLoadingScreen isEvaluating={isEvaluating} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 sm:p-6 lg:p-8 flex flex-col">
      {/* Equipment Preflight Modal */}
      {showPreflight && (
        <InterviewPreflightModal
          isOpen={showPreflight}
          onClose={() => setShowPreflight(false)}
          onReady={() => {
            setShowPreflight(false);
            void startCam();
          }}
        />
      )}

      <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col gap-6">
        {/* Studio Top Control Header */}
        <header className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="w-full sm:w-1/3">
            <ProgressBar total={totalQuestions} completed={answeredCount} />
          </div>

          <div className="flex flex-col items-center w-full sm:w-1/3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
              {rl.timeRemaining}
            </span>
            <div
              role="timer"
              aria-label={rl.timerAria}
              className={`text-3xl font-black font-mono tracking-tight transition-colors duration-300 ${
                progressRatio < 0.1 ? 'text-rose-600 animate-pulse' : 'text-slate-800'
              }`}
            >
              {formattedTime}
            </div>
          </div>

          <div className="flex justify-end w-full sm:w-1/3 gap-3 items-center">
            {saveError ? (
              <span role="status" aria-live="polite" className="text-xs font-medium text-rose-500">
                {saveError}
              </span>
            ) : isSaving ? (
              <span role="status" aria-live="polite" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {rl.saving}
              </span>
            ) : (
              <span role="status" aria-live="polite" className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                {rl.saved}
              </span>
            )}
            <button
              type="button"
              onClick={() => setExitModalOpen(true)}
              disabled={isSubmitting}
              aria-label={rl.pauseExit}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {rl.pauseExit}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              aria-label={isSubmitting ? rl.submitting : rl.submit}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold rounded-xl transition-all shadow-md shadow-slate-900/10 hover:-translate-y-0.5 disabled:opacity-50 select-none cursor-pointer"
            >
              {isSubmitting ? rl.submitting : rl.submit}
            </button>
          </div>
        </header>

        {/* 2-Column Studio Main Stage */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 items-start">
          {/* Left Panel: Virtual Studio Stage (AI Card + Webcam + Question Nav) */}
          <aside className="w-full lg:w-[380px] xl:w-[420px] flex flex-col gap-5 shrink-0">
            {/* AI Interviewer Mode Toggle & Card / Live Avatar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-500">{rl.aiMode}</span>
              <button
                type="button"
                aria-label={isLiveMode ? 'Live Audio Mode' : 'Standard Audio Mode'}
                onClick={() => {
                  if (isLiveMode) {
                    liveAudio.disconnect();
                    setIsLiveMode(false);
                  } else {
                    setIsLiveMode(true);
                    void liveAudio.connect();
                  }
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer ${
                  isLiveMode
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isLiveMode ? '🎙️ Gemini Live Voice' : '🔊 Web Speech TTS'}
              </button>
            </div>

            {isLiveMode ? (
              <LiveAiInterviewerAvatar
                isAiSpeaking={liveAudio.isAiSpeaking}
                audioLevel={liveAudio.audioLevel}
                onInterrupt={liveAudio.interrupt}
                status={liveAudio.isAiSpeaking ? 'SPEAKING' : liveAudio.isConnected ? 'LISTENING' : 'IDLE'}
              />
            ) : (
              currentQuestion && (
                <AiInterviewerCard
                  questionContent={currentQuestion.content}
                  currentLang={interviewLang}
                  isSpeaking={isSpeaking}
                  onSpeak={() =>
                    speak(
                      currentQuestion.content[interviewLang] ||
                        currentQuestion.content.vi ||
                        currentQuestion.content.en ||
                        '',
                      speechLocale
                    )
                  }
                  onStopSpeaking={stopSpeaking}
                  isTtsSupported={isTtsSupported}
                />
              )
            )}

            {/* Candidate Webcam Preview */}
            <WebcamPreview
              videoRef={videoRef}
              isActive={isCamActive}
              isCameraOn={isCameraOn}
              isMicOn={isMicOn}
              audioLevel={audioLevel}
              onToggleCamera={toggleCamera}
              onToggleMic={toggleMic}
              error={camError}
              onStart={() => void startCam()}
            />

            {/* Question Navigator Drawer */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 select-none">
                {rl.questionList}
              </h3>
              <QuestionNavigator
                totalQuestions={totalQuestions}
                currentIndex={currentQuestionIndex}
                onSelectQuestion={setCurrentQuestionIndex}
                answeredIndices={answeredIndices}
                language={interviewLang}
              />

              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-600 font-medium select-none">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-md bg-indigo-600 shadow-sm" /> {rl.selecting}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-md bg-emerald-50 border border-emerald-300" /> {rl.answered}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-md bg-white border border-slate-300" /> {rl.unanswered}
                </div>
              </div>
            </div>
          </aside>

          {/* Right Panel: Active Candidate Workspace */}
          <main className="flex-1 min-w-0 w-full flex flex-col gap-6">
            {currentQuestion && (
              <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {rl.adaptiveDifficulty}
                  </span>
                  <AdaptiveDifficultyBadge
                    difficulty={currentQuestion.difficulty || 'Medium'}
                    adjustment={followUpResponse?.difficultyAdjustment || 'SAME'}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void submitFollowUp(currentAnswer)}
                    disabled={isFollowUpLoading || !currentAnswer.trim() || isFollowUpCompleted}
                    aria-label={isFollowUpLoading ? rl.aiRefuting : rl.sendFollowUp}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isFollowUpLoading ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {rl.aiRefuting}
                      </>
                    ) : (
                      rl.sendFollowUp
                    )}
                  </button>
                </div>
              </div>
            )}

            {currentQuestion ? (
              <QuestionCard
                key={currentQuestion.id || currentQuestion._id || currentQuestionIndex}
                question={currentQuestion}
                currentAnswer={currentAnswer}
                onAnswerChange={handleAnswerChange}
                index={currentQuestionIndex}
                lang={interviewLang}
                onLangChange={setInterviewLang}
                answerMode={answerMode}
                onAnswerModeChange={setAnswerMode}
                codeLanguage={codeLanguage}
                onCodeLanguageChange={setCodeLanguage}
                starData={starData}
                onStarDataChange={handleStarDataChange}
                speechTranscript={finalTranscript}
                isListening={isListening}
                onStartListening={startListening}
                onStopListening={stopListening}
                isSttSupported={isSttSupported}
                speechMetrics={speechMetrics}
                onRunCode={() => void codeExecution.runCode(currentAnswer, codeLanguage, { withAiReview: true })}
                isRunningCode={codeExecution.isRunning}
                executionResult={codeExecution.executionResult}
                aiReviewResult={codeExecution.aiReviewResult}
                codeExecutionError={codeExecution.error}
                onClearCodeOutput={codeExecution.clearOutput}
                whiteboardNodes={whiteboard.nodes}
                whiteboardEdges={whiteboard.edges}
                onAddWhiteboardNode={whiteboard.addNode}
                onAddWhiteboardEdge={whiteboard.addEdge}
                onSubmitWhiteboardSnapshot={() => void whiteboard.submitWhiteboard(generateWhiteboardSnapshot())}
                isWhiteboardSubmitting={whiteboard.isSubmitting}
                whiteboardCritique={whiteboard.critique}
                onCloseWhiteboardCritique={() => whiteboard.clearCanvas()}
                onClearWhiteboard={whiteboard.clearCanvas}
              />
            ) : (
              <div className="h-full bg-white rounded-3xl border border-slate-200 p-8 flex items-center justify-center">
                <p className="text-slate-500 font-medium">{rl.selectQuestionPrompt}</p>
              </div>
            )}

            {/* Conversation Thread for AI Follow-ups */}
            {followUpTurns.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {rl.dialogueTitle}
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {rl.turn} {followUpTurnIndex}/{followUpMaxTurns}
                  </span>
                </div>
                <ConversationThread
                  turns={followUpTurns}
                  isLoading={isFollowUpLoading}
                  currentLang={interviewLang}
                  onSpeak={(text) => speak(text, speechLocale)}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Unanswered questions warning modal */}
      <Modal
        isOpen={unansweredModalOpen}
        onClose={() => setUnansweredModalOpen(false)}
        title={rl.unansweredModalTitle}
        description={rl.unansweredModalDesc}
        size="md"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => setUnansweredModalOpen(false)}>
              {rl.continueExam}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setUnansweredModalOpen(false);
                void handleSubmit(true);
              }}
            >
              {rl.submitAnyway}
            </Button>
          </div>
        }
      >
        <p className="text-slate-600">
          {interviewLang === 'en' ? (
            <>
              You have not answered question #<strong className="text-indigo-600">{(unansweredTargetIndex ?? 0) + 1}</strong>.
              The system has navigated to it. You can also select <strong>"Submit Anyway"</strong> to submit your completed answers (unanswered questions will be skipped).
            </>
          ) : (
            <>
              Bạn chưa trả lời câu hỏi số <strong className="text-indigo-600">{(unansweredTargetIndex ?? 0) + 1}</strong>.
              Hệ thống đã tự động chuyển đến câu hỏi này để bạn hoàn thiện. Bạn cũng có thể chọn <strong>"Vẫn nộp bài"</strong> để nộp những câu đã làm (các câu chưa làm sẽ được tính là bỏ qua).
            </>
          )}
        </p>
      </Modal>

      {/* Exit / Pause Confirmation Modal */}
      <Modal
        isOpen={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        title={rl.pauseModalTitle}
        description={rl.pauseModalDesc}
        size="md"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => setExitModalOpen(false)}>
              {rl.stayAndContinue}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setExitModalOpen(false);
                void handleSaveDraftAndExit();
              }}
            >
              {rl.saveDraftAndExit}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-slate-600">
          <p>
            {interviewLang === 'en' ? (
              <>
                Current progress: Completed{' '}
                <strong className="text-indigo-600 font-bold">
                  {answeredCount}/{totalQuestions}
                </strong>{' '}
                questions.
              </>
            ) : (
              <>
                Tiến độ hiện tại: Đã hoàn thành{' '}
                <strong className="text-indigo-600 font-bold">
                  {answeredCount}/{totalQuestions}
                </strong>{' '}
                câu hỏi.
              </>
            )}
          </p>
          <p className="text-sm text-slate-500">
            {rl.pauseNotice}
          </p>
        </div>
      </Modal>

      {/* Submission error modal */}
      <Modal
        isOpen={Boolean(submitErrorModal)}
        onClose={() => setSubmitErrorModal(null)}
        title={rl.submitErrorTitle}
        size="md"
        footer={
          <Button variant="primary" onClick={() => setSubmitErrorModal(null)}>
            {rl.understood}
          </Button>
        }
      >
        <p className="text-rose-600 font-medium">{submitErrorModal}</p>
      </Modal>
    </div>
  );
};
