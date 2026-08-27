import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  isPasskeySupported,
  login,
  loginWithPasskey,
  requestMagicLink,
  signup,
  verifyMagicLink,
} from '../api/auth';
import { Button, Field } from '../components/ui';
import { useTheme } from '../theme';

type Mode = 'login' | 'signup';
type AuthMethod = 'passwordless' | 'password';

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useTheme();

  const [mode, setMode] = useState<Mode>('login');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('passwordless');
  const [form, setForm] = useState({ name: '', email: '', password: '', invite_code: '' });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devMagicUrl, setDevMagicUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(true);
  const [verifyingToken, setVerifyingToken] = useState(false);

  // Auto-verify magic link if token exists in query string
  useEffect(() => {
    const token = searchParams.get('magic_token');
    if (!token) return;

    setVerifyingToken(true);
    setError(null);

    verifyMagicLink({ token })
      .then(() => {
        navigate('/');
      })
      .catch((err) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'This sign-in link is invalid or has expired.';
        setError(message);
      })
      .finally(() => {
        setVerifyingToken(false);
      });
  }, [searchParams, navigate]);

  // Check WebAuthn support on mount
  useEffect(() => {
    isPasskeySupported().then(setPasskeyAvailable);
  }, []);

  function set(field: keyof typeof form) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccessMessage(null);
    setDevMagicUrl(null);
  }

  async function handlePasskeyLogin() {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await loginWithPasskey(form.email || undefined);
      navigate('/');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as { message?: string })?.message ??
        'Could not authenticate with Passkey.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLinkRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.email) {
      setError('Please enter your email address.');
      return;
    }

    if (mode === 'signup' && !form.invite_code) {
      setError('An invite code is required to sign up.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setDevMagicUrl(null);
    setLoading(true);

    try {
      const res = await requestMagicLink({
        email: form.email,
        invite_code: form.invite_code || undefined,
        name: form.name || undefined,
      });
      setSuccessMessage(res.message || 'Check your email for your instant sign-in link!');
      if (res.devUrl) {
        setDevMagicUrl(res.devUrl);
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not send magic link. Please check your details.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
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

  if (verifyingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col items-center gap-4 rounded-card border border-border bg-surface p-8 text-center shadow-lg">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <h2 className="font-serif text-2xl font-medium">Verifying sign-in link…</h2>
          <p className="text-sm text-ink-3">One moment while we log you into your workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-6 py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent shadow-sm">
            <svg
              width="23"
              height="23"
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

        {/* Mode Switch (Sign in / Sign up) */}
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

        {/* Main Card */}
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm">
          {error && (
            <p className="rounded-[10px] bg-warn-bg px-3.5 py-2.5 text-sm text-warn-fg">{error}</p>
          )}

          {successMessage && (
            <div className="flex flex-col gap-2 rounded-[10px] bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              <p className="font-medium">{successMessage}</p>
              {devMagicUrl && (
                <div className="mt-1 pt-2 border-t border-emerald-500/20">
                  <p className="text-xs text-ink-3">Local dev 1-click test link:</p>
                  <a
                    href={devMagicUrl}
                    className="mt-1 inline-block text-xs font-semibold text-accent underline break-all"
                  >
                    Click to sign in instantly →
                  </a>
                </div>
              )}
            </div>
          )}

          {authMethod === 'passwordless' ? (
            <div className="flex flex-col gap-4">
              {/* Apple Passkey / Biometric Option */}
              {isLogin && passkeyAvailable && (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={loading}
                    onClick={handlePasskeyLogin}
                    className="w-full flex items-center justify-center gap-2 h-11 text-base font-medium shadow-sm"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004.07 9" />
                    </svg>
                    <span>Sign in with Passkey / Face ID</span>
                  </Button>

                  <div className="relative my-1 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <span className="relative bg-surface px-3 text-xs uppercase tracking-wider text-ink-3">
                      Or with magic link
                    </span>
                  </div>
                </>
              )}

              {/* Magic Link Form */}
              <form onSubmit={handleMagicLinkRequest} className="flex flex-col gap-4">
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
                  label="Work email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                  placeholder="name@company.com"
                  autoComplete="email"
                />

                {!isLogin && (
                  <Field
                    label="Invite code"
                    value={form.invite_code}
                    onChange={set('invite_code')}
                    required
                    placeholder="e.g. a1b2c3d4e5"
                    hint="From your team admin"
                  />
                )}

                <Button
                  type="submit"
                  variant={isLogin && passkeyAvailable ? 'secondary' : 'primary'}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>{loading ? 'Sending link…' : 'Send 1-Click Magic Link'}</span>
                </Button>
              </form>

              {/* Toggle to Password */}
              <div className="pt-2 text-center border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('password');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-medium text-ink-3 hover:text-ink transition"
                >
                  Sign in with password instead →
                </button>
              </div>
            </div>
          ) : (
            /* Traditional Password Form */
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
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

              <Button type="submit" variant="primary" disabled={loading} className="w-full">
                {loading ? 'One moment…' : isLogin ? 'Sign in' : 'Create account'}
              </Button>

              {/* Toggle back to Passwordless */}
              <div className="pt-2 text-center border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('passwordless');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-medium text-accent hover:underline transition"
                >
                  ← Use Passwordless (Passkey / Magic Link)
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer switch */}
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
