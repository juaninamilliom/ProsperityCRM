import { NavLink, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { AdminStatusesPage } from './pages/AdminStatusesPage';
import { AdminAgenciesPage } from './pages/AdminAgenciesPage';
import { CandidateFormPage } from './pages/CandidateFormPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { useTheme } from './theme';

export default function App() {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Prosperity CRM</h1>
          <p className="muted text-sm">Low-budget recruiting CRM</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex gap-4 text-sm font-medium">
            <NavLink className={({ isActive }) => (isActive ? 'text-brand' : 'text-slate-500 dark:text-slate-400')} to="/">
              Pipeline
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'text-brand' : 'text-slate-500 dark:text-slate-400')} to="/candidates/new">
              New Candidate
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'text-brand' : 'text-slate-500 dark:text-slate-400')} to="/admin/statuses">
              Statuses
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'text-brand' : 'text-slate-500 dark:text-slate-400')} to="/admin/agencies">
              Agencies
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? 'text-brand' : 'text-slate-500 dark:text-slate-400')} to="/settings">
              Settings
            </NavLink>
          </nav>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"
            onClick={toggleTheme}
          >
            Switch to {theme === 'light' ? 'dark' : 'light'} mode
          </button>
        </div>
      </header>
      <main className="mt-8 space-y-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/candidates/new" element={<CandidateFormPage />} />
          <Route path="/admin/statuses" element={<AdminStatusesPage />} />
          <Route path="/admin/agencies" element={<AdminAgenciesPage />} />
          <Route path="/settings" element={<AccountSettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
