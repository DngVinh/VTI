import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './ProtectedRoute';
import { AuthBootstrap } from './AuthBootstrap';
import { roleLanding } from './routePolicy';
import { useAuthStore } from './authStore';
import { setRefreshToken } from './session';

const candidate = {
  id: '1', email: 'candidate@example.com', fullName: 'Candidate', role: 'CANDIDATE' as const,
  status: 'ACTIVE' as const, createdAt: '',
};
const admin = { ...candidate, id: '2', email: 'admin@example.com', role: 'ADMIN' as const };

const renderProtectedSetup = () => render(
  <MemoryRouter initialEntries={['/setup']}>
    <Routes>
      <Route element={<ProtectedRoute allowedRoles={['CANDIDATE', 'INTERVIEWER']} />}>
        <Route path="/setup" element={<div>SECRET</div>} />
      </Route>
      <Route path="/" element={<div>HOME</div>} />
      <Route path="/login" element={<div>LOGIN</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('route policy', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    setRefreshToken(null);
    useAuthStore.setState({ user: null, bootstrapStatus: 'ready' });
  });

  it('uses the home landing policy for all roles', () => {
    expect(roleLanding('CANDIDATE')).toBe('/');
    expect(roleLanding('INTERVIEWER')).toBe('/');
    expect(roleLanding('ADMIN')).toBe('/');
  });

  it('redirects anonymous users without flashing protected children', () => {
    renderProtectedSetup();
    expect(screen.queryByText('SECRET')).toBeNull();
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('renders the protected Candidate route only for an allowed role', () => {
    useAuthStore.setState({ user: candidate, bootstrapStatus: 'ready' });
    renderProtectedSetup();
    expect(screen.getByText('SECRET')).toBeInTheDocument();
  });

  it('redirects Admin away without rendering Candidate content', () => {
    useAuthStore.setState({ user: admin, bootstrapStatus: 'ready' });
    renderProtectedSetup();
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.queryByText('SECRET')).toBeNull();
  });

  it('redirects an authenticated Admin away from guest auth routes', () => {
    useAuthStore.setState({ user: admin, bootstrapStatus: 'ready' });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<GuestRoute />}><Route path="/login" element={<div>LOGIN</div>} /></Route>
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN')).toBeNull();
  });

  it('holds protected children during deferred bootstrap and routes refreshed Admin away', async () => {
    let resolve!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((done) => {
      resolve = done;
    }));
    setRefreshToken('refresh');
    useAuthStore.setState({ user: null, bootstrapStatus: 'idle' });

    render(
      <MemoryRouter initialEntries={['/setup']}>
        <AuthBootstrap>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['CANDIDATE', 'INTERVIEWER']} />}>
              <Route path="/setup" element={<div>SECRET</div>} />
            </Route>
            <Route path="/" element={<div>HOME</div>} />
            <Route path="/login" element={<div>LOGIN</div>} />
          </Routes>
        </AuthBootstrap>
      </MemoryRouter>,
    );

    expect(screen.queryByText('SECRET')).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
    resolve(new Response(JSON.stringify({
      data: { user: admin, tokens: { accessToken: 'access', refreshToken: 'next' } },
    }), { status: 200 }));

    expect(await screen.findByText('HOME')).toBeInTheDocument();
    expect(screen.queryByText('SECRET')).toBeNull();
  });
});
