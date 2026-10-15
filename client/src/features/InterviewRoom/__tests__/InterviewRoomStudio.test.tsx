import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InterviewRoom } from '../InterviewRoom';

// Mock child hooks to isolate InterviewRoom integration behavior
vi.mock('../hooks/useInterviewSession', () => ({
  useInterviewSession: vi.fn(),
}));

vi.mock('../hooks/useInterviewTimer', () => ({
  useInterviewTimer: vi.fn(() => ({
    timeLeft: 1200,
    formattedTime: '20:00',
    progressRatio: 1,
    isActive: true,
    toggleTimer: vi.fn(),
    stopTimer: vi.fn(),
  })),
}));

vi.mock('../hooks/useAutosave', () => ({
  useAutosave: vi.fn(() => ({
    isSaving: false,
    lastSaved: new Date(),
    saveError: null,
    forceSave: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('../hooks/useBeforeUnload', () => ({
  useBeforeUnload: vi.fn(),
}));

const mockStopListening = vi.fn();
const mockResetTranscript = vi.fn();
const mockStartListening = vi.fn();
const mockSpeechMetrics = { wordCount: 0, durationSeconds: 0, wpm: 0, fillerWords: [], fillerCount: 0 };

vi.mock('../hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: vi.fn(() => ({
    isListening: false,
    interimTranscript: '',
    finalTranscript: '',
    error: null,
    isSupported: true,
    startListening: mockStartListening,
    stopListening: mockStopListening,
    resetTranscript: mockResetTranscript,
    metrics: mockSpeechMetrics,
  })),
}));

const mockSpeak = vi.fn();
const mockStopSpeaking = vi.fn();

vi.mock('../hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: vi.fn(() => ({
    isSpeaking: false,
    isSupported: true,
    speak: mockSpeak,
    stop: mockStopSpeaking,
    pause: vi.fn(),
    resume: vi.fn(),
  })),
}));

const mockStartCam = vi.fn();
const mockStopCam = vi.fn();
const mockToggleCam = vi.fn();
const mockToggleMic = vi.fn();

vi.mock('../hooks/useWebcam', () => ({
  useWebcam: vi.fn(() => ({
    videoRef: { current: null },
    isActive: true,
    isCameraOn: true,
    isMicOn: true,
    hasPermission: true,
    hasMicPermission: true,
    error: null,
    audioLevel: 30,
    start: mockStartCam,
    stop: mockStopCam,
    toggleCamera: mockToggleCam,
    toggleMic: mockToggleMic,
  })),
}));

const mockSubmitFollowUp = vi.fn().mockResolvedValue({ shouldFollowUp: true });
vi.mock('../hooks/useFollowUp', () => ({
  useFollowUp: vi.fn(() => ({
    turns: [
      {
        id: 'turn-1',
        sessionId: 'session-123',
        questionId: 'q1',
        turnIndex: 0,
        role: 'INTERVIEWER',
        type: 'INITIAL_QUESTION',
        content: { vi: 'Câu hỏi ban đầu', en: 'Initial question' },
      },
      {
        id: 'turn-2',
        sessionId: 'session-123',
        questionId: 'q1',
        turnIndex: 1,
        role: 'INTERVIEWER',
        type: 'FOLLOW_UP',
        content: { vi: 'Câu hỏi phản biện test', en: 'Follow up test' },
      },
    ],
    isLoading: false,
    error: null,
    lastResponse: {
      shouldFollowUp: true,
      difficultyAdjustment: 'HARDER',
      turnIndex: 1,
      maxTurns: 3,
      gapAnalysis: ['Chưa giải thích cơ chế'],
    },
    turnIndex: 1,
    maxTurns: 3,
    isCompleted: false,
    submitFollowUp: mockSubmitFollowUp,
    loadHistory: vi.fn(),
  })),
}));

import { useInterviewSession } from '../hooks/useInterviewSession';

const mockUseInterviewSession = vi.mocked(useInterviewSession);

describe('InterviewRoom Studio 2.0 Integration', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockQuestions = [
    {
      _id: 'q1',
      order: 1,
      difficulty: 'Easy',
      category: 'Frontend',
      content: { vi: 'Câu hỏi 1 tiếng Việt', en: 'Question 1 English' },
    },
    {
      _id: 'q2',
      order: 2,
      difficulty: 'Hard',
      category: 'Algorithms',
      content: { vi: 'Câu hỏi 2 thuật toán', en: 'Question 2 Algorithm' },
    },
  ];

  beforeEach(() => {
    mockUseInterviewSession.mockReturnValue({
      session: {
        _id: 'session-123',
        status: 'IN_PROGRESS',
        version: 1,
        setupData: { jobPosition: 'Frontend Dev', level: 'Junior' },
        questions: mockQuestions,
      },
      isLoading: false,
      isGenerating: false,
      error: null,
      currentQuestion: mockQuestions[0],
      currentQuestionIndex: 0,
      setCurrentQuestionIndex: vi.fn(),
      answers: [{ questionId: 'q1', candidateAnswer: 'Đáp án 1' }],
      currentAnswer: 'Đáp án 1',
      handleAnswerChange: vi.fn(),
      totalQuestions: 2,
      answeredCount: 1,
      refetch: vi.fn(),
      updateVersion: vi.fn(),
    });
  });

  const renderInterviewRoom = () => {
    return render(
      <MemoryRouter initialEntries={['/interview/session-123']}>
        <Routes>
          <Route path="/interview/:sessionId" element={<InterviewRoom />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders preflight modal on first load', () => {
    renderInterviewRoom();
    expect(screen.getByRole('heading', { name: /Kiểm tra thiết bị/i })).toBeInTheDocument();
  });

  it('closes preflight modal and shows studio layout when "Bắt đầu phỏng vấn" is clicked', () => {
    renderInterviewRoom();
    const startBtn = screen.getByRole('button', { name: /Bắt đầu phỏng vấn/i });
    fireEvent.click(startBtn);

    expect(screen.queryByRole('heading', { name: /Kiểm tra thiết bị/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('AI Interviewer')[0]).toBeInTheDocument();
    expect(screen.getByText('Camera ứng viên')).toBeInTheDocument();
    expect(screen.getByText('Câu hỏi 1 tiếng Việt')).toBeInTheDocument();
  });

  it('renders 2-column Studio components: Left panel (AI Card, Camera, Nav) and Right panel (QuestionCard)', () => {
    renderInterviewRoom();
    // Dismiss preflight
    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua/i }));

    // Left Panel
    expect(screen.getAllByText('AI Interviewer')[0]).toBeInTheDocument();
    expect(screen.getByText('Camera ứng viên')).toBeInTheDocument();
    expect(screen.getByText(/Danh sách câu hỏi/i)).toBeInTheDocument();

    // Right Panel
    expect(screen.getByText('Câu hỏi 1 tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText(/Chế độ trả lời:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Văn bản/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /STAR/i })).toBeInTheDocument();
  });

  it('switches between Text, Code, and STAR workspaces within InterviewRoom', () => {
    renderInterviewRoom();
    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua/i }));

    // Switch to Code
    fireEvent.click(screen.getByRole('button', { name: /Code/i }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Switch to STAR
    fireEvent.click(screen.getByRole('button', { name: /STAR/i }));
    expect(screen.getByText(/Situation/i)).toBeInTheDocument();
    expect(screen.getByText(/Task/i)).toBeInTheDocument();
  });

  it('renders AdaptiveDifficultyBadge and ConversationThread with follow-up turns', () => {
    renderInterviewRoom();
    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua/i }));

    expect(screen.getAllByText('Easy')[0]).toBeInTheDocument();
    expect(screen.getByText('Tăng độ khó')).toBeInTheDocument();
    expect(screen.getByText('Câu hỏi phản biện test')).toBeInTheDocument();
    expect(screen.getByText(/Lượt: 1\/3/i)).toBeInTheDocument();
  });

  it('triggers follow-up request when candidate clicks follow-up button', () => {
    renderInterviewRoom();
    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua/i }));

    const followUpBtn = screen.getByRole('button', { name: /Gửi phản biện AI/i });
    expect(followUpBtn).toBeInTheDocument();
    fireEvent.click(followUpBtn);

    expect(mockSubmitFollowUp).toHaveBeenCalledWith('Đáp án 1');
  });

  it('renders "Tạm dừng & Thoát" button on header and opens exit modal when clicked', () => {
    renderInterviewRoom();
    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua/i }));

    const exitBtn = screen.getByRole('button', { name: /Tạm dừng & Thoát/i });
    expect(exitBtn).toBeInTheDocument();

    fireEvent.click(exitBtn);
    expect(screen.getByRole('heading', { name: /Tạm dừng phỏng vấn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lưu nháp & Thoát/i })).toBeInTheDocument();
  });

  it('allows early submission with "Vẫn nộp bài" when questions are incomplete', () => {
    renderInterviewRoom();
    fireEvent.click(screen.getByRole('button', { name: /Bỏ qua/i }));

    const submitBtn = screen.getByRole('button', { name: /^Nộp bài$/i });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('heading', { name: /Chưa hoàn thành tất cả câu hỏi/i })).toBeInTheDocument();
    const earlySubmitBtn = screen.getByRole('button', { name: /Vẫn nộp bài/i });
    expect(earlySubmitBtn).toBeInTheDocument();
  });
});

