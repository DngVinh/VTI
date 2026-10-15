import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { PersonaFeedbackPanel } from '../components/PersonaFeedbackPanel';
import type { PersonaEvaluationClient, VarianceFlagClient } from '../components/PersonaFeedbackPanel';

describe('PersonaFeedbackPanel Component (Micro-Task 2.9)', () => {
  afterEach(() => {
    cleanup();
  });

  const mockPersonas: PersonaEvaluationClient[] = [
    {
      role: 'TECH_LEAD',
      score: 9.0,
      strengths: [{ vi: 'Kiến trúc phân tầng sạch sẽ', en: 'Clean layered architecture' }],
      weaknesses: [{ vi: 'Thiếu caching Redis', en: 'Missing Redis caching' }],
      specificFeedback: {
        vi: 'Ứng viên nắm rất chắc design pattern.',
        en: 'Candidate has very solid design pattern grasp.',
      },
      dimensionScores: { 'Architecture & Design': 9.0 },
    },
    {
      role: 'BAR_RAISER',
      score: 5.5,
      strengths: [{ vi: 'Biết dùng validator', en: 'Uses validator' }],
      weaknesses: [{ vi: 'Bỏ qua kiểm tra XSS input', en: 'Ignored XSS input checks' }],
      specificFeedback: {
        vi: 'Cần nâng cao nhận thức bảo mật OWASP.',
        en: 'Needs to improve OWASP security awareness.',
      },
      dimensionScores: { 'Security Awareness': 5.5 },
    },
    {
      role: 'BEHAVIORAL',
      score: 8.5,
      strengths: [{ vi: 'Giao tiếp tự tin, đúng chuẩn STAR', en: 'Confident STAR communication' }],
      weaknesses: [{ vi: 'Cần lắng nghe kỹ hơn', en: 'Listen more closely' }],
      specificFeedback: {
        vi: 'Tác phong chuyên nghiệp.',
        en: 'Professional demeanor.',
      },
      dimensionScores: { 'Communication Clarity': 8.5 },
    },
  ];

  const mockFlags: VarianceFlagClient[] = [
    {
      dimension: 'Architecture vs Security',
      variance: 3.5,
      arbiterResolution: {
        vi: 'Trọng tài trừ điểm vì lỗi bảo mật nhưng ghi nhận kiến trúc.',
        en: 'Arbiter penalized for security bug but noted architecture.',
      },
    },
  ];

  it('renders 4 tabs: Overview, Tech Lead, Bar Raiser, and HR', () => {
    render(
      <PersonaFeedbackPanel
        personaEvaluations={mockPersonas}
        varianceFlags={mockFlags}
        overallScore={7.8}
      />
    );

    expect(screen.getByRole('tab', { name: /Tổng quan/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tech Lead/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bar Raiser/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /HR/i })).toBeInTheDocument();
  });

  it('displays variance flags warning banner when variance exists', () => {
    render(
      <PersonaFeedbackPanel
        personaEvaluations={mockPersonas}
        varianceFlags={mockFlags}
        overallScore={7.8}
      />
    );

    expect(screen.getByText(/Phát hiện độ lệch điểm/i)).toBeInTheDocument();
    expect(screen.getByText(/Trọng tài trừ điểm vì lỗi bảo mật/i)).toBeInTheDocument();
  });

  it('switches to Tech Lead tab and displays Tech Lead feedback and strengths', () => {
    render(
      <PersonaFeedbackPanel
        personaEvaluations={mockPersonas}
        varianceFlags={mockFlags}
        overallScore={7.8}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Tech Lead/i }));

    expect(screen.getByText('Kiến trúc phân tầng sạch sẽ')).toBeInTheDocument();
    expect(screen.getByText('Thiếu caching Redis')).toBeInTheDocument();
    expect(screen.getByText('Ứng viên nắm rất chắc design pattern.')).toBeInTheDocument();
  });

  it('switches to Bar Raiser tab and displays security weaknesses', () => {
    render(
      <PersonaFeedbackPanel
        personaEvaluations={mockPersonas}
        varianceFlags={mockFlags}
        overallScore={7.8}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Bar Raiser/i }));

    expect(screen.getByText('Bỏ qua kiểm tra XSS input')).toBeInTheDocument();
    expect(screen.getByText('Cần nâng cao nhận thức bảo mật OWASP.')).toBeInTheDocument();
  });

  it('renders all section titles and role titles in English when currentLang="en"', () => {
    render(
      <PersonaFeedbackPanel
        personaEvaluations={mockPersonas}
        varianceFlags={mockFlags}
        overallScore={7.8}
        currentLang="en"
      />
    );

    expect(screen.getByText(/AI Panel Perspectives/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByText(/Score variance detected between experts/i)).toBeInTheDocument();
    expect(screen.getByText('Arbiter penalized for security bug but noted architecture.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Tech Lead/i }));
    expect(screen.getByText(/Core Feedback/i)).toBeInTheDocument();
    expect(screen.getByText(/Strengths/i)).toBeInTheDocument();
    expect(screen.getByText(/Areas for Improvement/i)).toBeInTheDocument();
    expect(screen.getByText('Tech Lead: Architecture & Code')).toBeInTheDocument();
  });
});
