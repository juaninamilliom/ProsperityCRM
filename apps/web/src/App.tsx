import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardPage } from './pages/DashboardPage';
import { CandidateFormPage } from './pages/CandidateFormPage';
import { CandidateEditPage } from './pages/CandidateEditPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { AuthPage } from './pages/AuthPage';
import { UserGuidePage } from './pages/UserGuidePage';
import { JobsPage } from './pages/JobsPage';
import { JobDealPage } from './pages/JobDealPage';
import { useTheme } from './theme';
import { fetchCurrentUser } from './api/users';
import { getAuthToken, setAuthToken } from './api/client';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDealPage />} />
        <Route path="/candidates/new" element={<CandidateFormPage />} />
        <Route path="/candidates/:candidateId/edit" element={<CandidateEditPage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/guide" element={<UserGuidePage />} />
      </Route>
    </Routes>
  );
}

function ProtectedLayout() {
  const [theme, toggleTheme] = useTheme();
  const token = getAuthToken();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchCurrentUser,
    enabled: Boolean(token),
    retry: false,
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-slate-500">Loading account…</p>;
  }

  if (!data?.dbUser) {
    setAuthToken(null);
    return <Navigate to="/login" replace />;
  }

  function handleLogout() {
    setAuthToken(null);
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-slate-900 transition-colors dark:bg-surface-dark dark:text-slate-50" data-theme={theme}>
      <header className="rounded-[32px] bg-brand-blue p-6 text-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] opacity-80">Prosperity CRM</p>
            <h1 className="text-3xl font-semibold">Recruiting Workspace</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-3 text-sm font-medium">
              <NavLink className={({ isActive }) => navClass(isActive)} to="/">
                Pipeline
              </NavLink>
              <NavLink className={({ isActive }) => navClass(isActive)} to="/jobs">
                Jobs
              </NavLink>
              <NavLink className={({ isActive }) => navClass(isActive)} to="/candidates/new">
                New Candidate
              </NavLink>
              <NavLink className={({ isActive }) => navClass(isActive)} to="/settings">
                Settings
              </NavLink>
              <NavLink className={({ isActive }) => navClass(isActive)} to="/guide">
                User Guide
              </NavLink>
            </nav>
            <button className="btn-fuchsia px-5" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mt-8 space-y-8">
        <Outlet context={{ theme, toggleTheme }} />
      </main>
    </div>
  );
}

function navClass(isActive: boolean) {
  return [
    'rounded-full px-4 py-2 transition',
    isActive ? 'bg-white/20 text-white shadow-inner' : 'text-white/80 hover:text-white',
  ].join(' ');
}
