import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../api/auth';
import { Button, Field } from '../components/ui';
import { useTheme } from '../theme';

type Mode = 'login' | 'signup';

export function AuthPage() {
  const navigate = useNavigate();
  // Auth sits outside ProtectedLayout, so nothing else applies the theme class
  // to <html> here - without this the sign-in screen is always light.
  useTheme();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', invite_code: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await signup({
          name: form.name,
          email: form.email,
          password: form.password,
          invite_code: form.invite_code,
        });
      }
      navigate('/');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (mode === 'login'
          ? 'That email and password did not match.'
          : 'Could not create your account.');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-6 py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent">
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M17 7h4v4" />
            </svg>
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="font-serif text-[28px] leading-tight tracking-[-0.012em]">
              {isLogin ? 'Welcome back' : 'Join your team'}
            </h1>
            <p className="text-base text-ink-2">
              {isLogin
                ? 'Sign in to your Prosperity workspace.'
                : 'Your invite code decides which workspace you join.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 self-center rounded-control bg-surface-3 p-[3px]">
          {(['login', 'signup'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={[
                'focus-ring h-[30px] rounded-[7px] px-4 text-sm font-medium transition',
                mode === value ? 'bg-surface text-ink shadow-pop' : 'text-ink-2',
              ].join(' ')}
            >
              {value === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6"
        >
          {!isLogin && (
            <Field
              label="Full name"
              value={form.name}
              onChange={set('name')}
              required
              autoComplete="name"
            />
          )}

          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={set('email')}
            required
            autoComplete="email"
          />

          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            hint={isLogin ? undefined : 'At least 6 characters'}
          />

          {!isLogin && (
            <Field
              label="Invite code"
              value={form.invite_code}
              onChange={set('invite_code')}
              required
              placeholder="e.g. a1b2c3d4e5"
              hint="From your admin"
            />
          )}

          {error && (
            <p className="rounded-[10px] bg-warn-bg px-3.5 py-2.5 text-sm text-warn-fg">{error}</p>
          )}

          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? 'One moment…' : isLogin ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-3">
          {isLogin ? 'Need an account?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'signup' : 'login')}
            className="focus-ring rounded-[4px] font-medium text-accent underline-offset-2 hover:underline"
          >
            {isLogin ? 'Sign up with an invite code' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
