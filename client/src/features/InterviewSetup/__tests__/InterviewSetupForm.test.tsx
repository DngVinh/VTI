import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InterviewSetupForm } from '../InterviewSetupForm';
import { interviewApi } from '../../../services/api/interviewApi';

// Mock the API calls
vi.mock('../../../services/api/interviewApi', () => ({
  interviewApi: {
    fetchRoles: vi.fn(),
    fetchLevels: vi.fn(),
    fetchTechnologies: vi.fn(),
    setupInterview: vi.fn().mockResolvedValue({ _id: 'mock-session-id' }),
    uploadJdInterview: vi.fn().mockResolvedValue({ _id: 'mock-session-id' }),
  }
}));

const mockRoles = [
  { _id: 'r1', code: 'FE', name: 'Frontend Developer' },
  { _id: 'r2', code: 'BE', name: 'Backend Developer' },
];

const mockLevels = [
  { _id: 'l1', code: 'JUNIOR', name: 'Junior' },
  { _id: 'l2', code: 'SENIOR', name: 'Senior' },
];

const mockTechnologies = [
  { _id: 't1', code: 'REACT', name: 'React' },
  { _id: 't2', code: 'NODE', name: 'Node.js' },
];

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<InterviewSetupForm />} />
        <Route
          path="/interview/:id"
          element={<div>Interview session opened</div>}
        />
      </Routes>
    </MemoryRouter>
  );

describe('InterviewSetupForm', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    
    // Default mocks to resolve with data
    vi.mocked(interviewApi.fetchRoles).mockResolvedValue(mockRoles);
    vi.mocked(interviewApi.fetchLevels).mockResolvedValue(mockLevels);
    vi.mocked(interviewApi.fetchTechnologies).mockResolvedValue(mockTechnologies);
    vi.mocked(interviewApi.setupInterview).mockResolvedValue({ _id: 'mock-session-id' });
    vi.mocked(interviewApi.uploadJdInterview).mockResolvedValue({ _id: 'mock-session-id' });
  });

  it('renders loading state initially and then displays the manual setup tab by default', async () => {
    renderForm();
    
    // Initially shows loading state
    expect(screen.getByText('Đang tải cấu hình hệ thống...')).toBeInTheDocument();
    
    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });
    
    // Should display Tabs
    expect(screen.getByRole('button', { name: /Tùy Chỉnh Thủ Công/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải Lên JD/i })).toBeInTheDocument();
    
    // Manual setup should be visible by default
    expect(screen.getByText('Chức danh ứng tuyển')).toBeInTheDocument();
    expect(screen.getByText('Trình độ chuyên môn')).toBeInTheDocument();
    
    // Assert API calls
    expect(interviewApi.fetchRoles).toHaveBeenCalledTimes(1);
    expect(interviewApi.fetchLevels).toHaveBeenCalledTimes(1);
  });

  it('switches to JD Upload tab when clicking the tab button', async () => {
    const user = userEvent.setup();
    renderForm();
    
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });
    
    // Click JD Upload tab
    const jdTabButton = screen.getByRole('button', { name: /Tải Lên JD/i });
    await user.click(jdTabButton);
    
    // Verify JD Upload UI is visible
    expect(screen.getByText('Upload Job Description (JD)')).toBeInTheDocument();
    expect(screen.getByText(/Click để tải lên/i)).toBeInTheDocument();
    
    // The Manual setup UI should not be in the document
    expect(screen.queryByText('Chức danh ứng tuyển')).not.toBeInTheDocument();
  });

  it('validates manual setup form fields', async () => {
    const user = userEvent.setup();
    renderForm();
    
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Bắt Đầu Phỏng Vấn Ngay/i });
    await user.click(submitBtn);

    // Form errors should appear for required fields
    expect(await screen.findByText('Vui lòng chọn chức danh')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng chọn cấp độ')).toBeInTheDocument();

    // Now fill the required fields to trigger the custom tech stack validation
    await user.selectOptions(screen.getByLabelText(/Chức danh ứng tuyển/i), 'r1');
    await user.click(screen.getByLabelText('Junior'));
    
    await user.click(submitBtn);
    
    // Custom tech stack validation error should appear
    expect(await screen.findByText('Vui lòng chọn ít nhất một công nghệ (Tech Stack).')).toBeInTheDocument();
  });

  it('handles JD Upload file selection and submission', async () => {
    const user = userEvent.setup();
    renderForm();
    
    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });
    
    // Go to JD Upload tab
    await user.click(screen.getByRole('button', { name: /Tải Lên JD/i }));
    
    // The input should be present (hidden)
    const fileInput = document.getElementById('jdFile') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    
    // Submit button should be disabled initially
    const submitBtn = screen.getByRole('button', { name: /Phân Tích JD & Bắt Đầu Phỏng Vấn/i });
    expect(submitBtn).toBeDisabled();
    
    // Create a mock file
    const file = new File(['mock content'], 'job-description.pdf', { type: 'application/pdf' });
    
    // Upload file
    await user.upload(fileInput, file);
    
    // Assert UI updates
    expect(await screen.findByText(/Đã chọn file: job-description.pdf/i)).toBeInTheDocument();
    
    // Submit button should be enabled
    expect(submitBtn).not.toBeDisabled();
    
    // Submit the form
    await user.click(submitBtn);
    
    // Assert API call
    expect(interviewApi.uploadJdInterview).toHaveBeenCalledTimes(1);
    // Extract formData argument and assert
    const formDataArg = vi.mocked(interviewApi.uploadJdInterview).mock.calls[0][0];
    expect(formDataArg instanceof FormData).toBe(true);
    expect(formDataArg.get('jdFile')).toBe(file);
    expect(formDataArg.has('userId')).toBe(false);
    
    // Successful setup navigates to the newly created interview session.
    expect(await screen.findByText('Interview session opened')).toBeInTheDocument();
  });

  it('renders live session brief preview card with dynamic updates in manual mode', async () => {
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });

    // Verify Session Brief card is rendered
    expect(screen.getByText('Thông số phiên phỏng vấn')).toBeInTheDocument();
    expect(screen.getByText('Vị trí chuẩn hóa')).toBeInTheDocument();
    expect(screen.getByText('Chưa chọn công nghệ nào')).toBeInTheDocument();

    // Select role and level
    await user.selectOptions(screen.getByLabelText(/Chức danh ứng tuyển/i), 'r1');
    await user.click(screen.getByLabelText('Junior'));

    // Select technology
    await user.click(screen.getByRole('button', { name: 'React' }));

    // Brief card should update with selected names
    expect(screen.getAllByText('Frontend Developer').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Junior').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('React').length).toBeGreaterThanOrEqual(2); // One in picker, one in brief preview

    // Studio brief CTA button should be enabled
    const briefSubmitBtn = screen.getByRole('button', { name: /Bắt Đầu Phỏng Vấn Ngay/i });
    expect(briefSubmitBtn).not.toBeDisabled();

    // Clicking brief submit triggers setupInterview
    await user.click(briefSubmitBtn);
    expect(interviewApi.setupInterview).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Interview session opened')).toBeInTheDocument();
  });

  it('renders live session brief preview card updates in JD upload mode', async () => {
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => {
      expect(screen.queryByText('Đang tải cấu hình hệ thống...')).not.toBeInTheDocument();
    });

    // Switch to JD mode
    await user.click(screen.getByRole('button', { name: /Tải Lên JD/i }));

    // Verify JD brief mode
    expect(screen.getByText('Theo bản JD')).toBeInTheDocument();
    expect(screen.getByText('Chưa chọn tệp JD')).toBeInTheDocument();

    // Upload file
    const fileInput = document.getElementById('jdFile') as HTMLInputElement;
    const file = new File(['mock JD content'], 'frontend-lead.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, file);

    // Brief should display uploaded file name
    expect(await screen.findByText('frontend-lead.pdf')).toBeInTheDocument();

    // Studio brief CTA button should be enabled and submit successfully
    const briefSubmitBtn = screen.getByRole('button', { name: /Phân Tích JD & Bắt Đầu Phỏng Vấn/i });
    expect(briefSubmitBtn).not.toBeDisabled();

    await user.click(briefSubmitBtn);
    expect(interviewApi.uploadJdInterview).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Interview session opened')).toBeInTheDocument();
  });

  it('renders English tab and button labels when I18nContext is English', async () => {
    let store: Record<string, string> = { app_locale: 'en' };
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        clear: () => {
          store = {};
        },
      },
      writable: true,
    });

    const { I18nProvider } = await import('../../../locales/I18nContext');

    render(
      <MemoryRouter initialEntries={['/']}>
        <I18nProvider defaultLocale="en">
          <InterviewSetupForm />
        </I18nProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/Loading system configuration/i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Manual Customization/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload JD/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Interview Now/i })).toBeInTheDocument();
  });
});

