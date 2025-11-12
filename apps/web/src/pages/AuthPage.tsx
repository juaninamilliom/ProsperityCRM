import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../api/auth';
import { setAuthToken } from '../api/client';

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    organization_id: '',
    role: 'OrgEmployee' as 'OrgAdmin' | 'OrgEmployee',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await signup({
          email: form.email,
          password: form.password,
          name: form.name,
          organization_id: form.organization_id,
          role: form.role,
        });
      }
      navigate('/');
    } catch (err) {
      setAuthToken(null);
      setError('Authentication failed. Check your details and try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-blue via-brand-fuchsia to-brand-green px-4 py-10">
      <form className="glass-card w-full max-w-md space-y-4" onSubmit={handleSubmit}>
        <h1 className="text-xl font-semibold text-center text-brand-blue dark:text-white">Prosperity CRM</h1>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className={`flex-1 rounded-full border px-4 py-2 shadow-inner ${mode === 'login' ? 'border-brand-blue text-brand-blue bg-white' : 'border-white/40 text-white/70'}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full border px-4 py-2 shadow-inner ${mode === 'signup' ? 'border-brand-blue text-brand-blue bg-white' : 'border-white/40 text-white/70'}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {mode === 'signup' && (
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
            Full Name
            <input className="pill-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Email
          <input className="pill-input" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Password
          <input className="pill-input" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} required />
        </label>

        {mode === 'signup' && (
          <>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Organization ID
              <input className="pill-input" value={form.organization_id} onChange={(e) => setForm((prev) => ({ ...prev, organization_id: e.target.value }))} required />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Role
              <select className="pill-input" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as 'OrgAdmin' | 'OrgEmployee' }))}>
                <option value="OrgEmployee">OrgEmployee</option>
                <option value="OrgAdmin">OrgAdmin</option>
              </select>
            </label>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          className="w-full rounded-full bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {mode === 'login' ? 'Login' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
