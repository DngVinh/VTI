import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { getProfile, updateProfile, uploadAvatar } from '../auth/apiClient';
import { useAuthStore } from '../auth/authStore';
import type { User } from '../auth/types';
import { ProfilePage } from './ProfilePage';

vi.mock('../auth/apiClient', () => ({
  getProfile: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));


const profile: User = {
  id: 'user-1',
  email: 'candidate@example.com',
  fullName: 'Candidate User',
  role: 'CANDIDATE',
  status: 'ACTIVE',
  avatarUrl: null,
  currentLevel: 'MIDDLE',
  githubUrl: 'https://github.com/candidate',
  linkedinUrl: 'https://linkedin.com/in/candidate',
  bio: null,
  createdAt: '2026-08-22T00:00:00.000Z',
};

const renderPage = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>);

describe('ProfilePage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    useAuthStore.setState({ user: profile, bootstrapStatus: 'ready' });
  });

  it('shows an accessible loading state', () => {
    vi.mocked(getProfile).mockImplementation(() => new Promise(() => undefined));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải hồ sơ');
  });

  it('hydrates, saves, and updates the auth store', async () => {
    const user = userEvent.setup();
    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(updateProfile).mockResolvedValue({ ...profile, fullName: 'Updated User', currentLevel: 'SENIOR' });
    renderPage();

    const name = await screen.findByLabelText('Họ và tên');
    expect(name).toHaveValue('Candidate User');
    expect(screen.getByLabelText('Trình độ hiện tại')).toHaveValue('MIDDLE');
    await user.clear(name);
    await user.type(name, 'Updated User');
    await user.selectOptions(screen.getByLabelText('Trình độ hiện tại'), 'SENIOR');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({
      fullName: 'Updated User',
      avatarUrl: null,
      currentLevel: 'SENIOR',
      githubUrl: 'https://github.com/candidate',
      linkedinUrl: 'https://linkedin.com/in/candidate',
      bio: null,
    }));
    expect(await screen.findByText('Cập nhật hồ sơ thành công')).toBeInTheDocument();
    expect(useAuthStore.getState().user?.fullName).toBe('Updated User');
  });

  it('blocks invalid URLs on the client without calling the API', async () => {
    const user = userEvent.setup();
    vi.mocked(getProfile).mockResolvedValue(profile);
    renderPage();

    const github = await screen.findByLabelText('GitHub URL');
    await user.clear(github);
    await user.type(github, 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText(/URL phải là đường dẫn tuyệt đối/)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('shows load errors and retries successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(getProfile)
      .mockRejectedValueOnce({ message: 'Không thể tải hồ sơ' })
      .mockResolvedValueOnce(profile);
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải hồ sơ');
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByLabelText('Họ và tên')).toHaveValue('Candidate User');
  });

  it('disables save and reports server field errors', async () => {
    const user = userEvent.setup();
    let rejectSave!: (error: unknown) => void;
    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(updateProfile).mockImplementation(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    renderPage();

    await screen.findByLabelText('Họ và tên');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();

    rejectSave({ message: 'Cập nhật thất bại', fieldErrors: { fullName: 'Tên bị từ chối' } });
    expect(await screen.findByText('Cập nhật thất bại')).toBeInTheDocument();
    expect(screen.getByText('Tên bị từ chối')).toBeInTheDocument();
  });

  it('uses deterministic initials when avatar is missing or fails', async () => {
    vi.mocked(getProfile).mockResolvedValue({ ...profile, fullName: 'John Doe', avatarUrl: null });
    renderPage();
    expect(await screen.findByTestId('avatar-fallback')).toHaveTextContent('JD');

    cleanup();
    vi.mocked(getProfile).mockResolvedValue({ ...profile, fullName: 'Alice Smith', avatarUrl: 'https://example.com/broken.png' });
    renderPage();
    fireEvent.error(await screen.findByRole('img', { name: 'Ảnh đại diện của Alice Smith' }));
    expect(await screen.findByTestId('avatar-fallback')).toHaveTextContent('AS');
  });

  it('handles avatar file upload successfully', async () => {
    vi.mocked(getProfile).mockResolvedValue(profile);
    vi.mocked(uploadAvatar).mockResolvedValue({
      avatarUrl: '/uploads/avatars/new-avatar.png',
      user: { ...profile, avatarUrl: '/uploads/avatars/new-avatar.png' },
    });
    renderPage();

    await screen.findByLabelText('Họ và tên');
    const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
    const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith(file));
    expect(await screen.findByText('Cập nhật hồ sơ thành công')).toBeInTheDocument();
    expect(useAuthStore.getState().user?.avatarUrl).toBe('/uploads/avatars/new-avatar.png');
  });

  it('allows saving profile when avatarUrl is a relative /uploads/ path', async () => {
    const user = userEvent.setup();
    const profileWithUploadedAvatar = {
      ...profile,
      avatarUrl: '/uploads/avatars/avatar-6aadef0d9295dbf9d50889b3-1789786076652.jpg',
    };
    vi.mocked(getProfile).mockResolvedValue(profileWithUploadedAvatar);
    vi.mocked(updateProfile).mockResolvedValue({
      ...profileWithUploadedAvatar,
      fullName: 'Updated With Avatar',
    });
    renderPage();

    const name = await screen.findByLabelText('Họ và tên');
    await user.clear(name);
    await user.type(name, 'Updated With Avatar');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        fullName: 'Updated With Avatar',
        avatarUrl: '/uploads/avatars/avatar-6aadef0d9295dbf9d50889b3-1789786076652.jpg',
        currentLevel: 'MIDDLE',
        githubUrl: 'https://github.com/candidate',
        linkedinUrl: 'https://linkedin.com/in/candidate',
        bio: null,
      })
    );
    expect(await screen.findByText('Cập nhật hồ sơ thành công')).toBeInTheDocument();
  });
});

