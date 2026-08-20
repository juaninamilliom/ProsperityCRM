import axios from 'axios';
import { ChangeEvent, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { login, signup } from '../api/auth';
import { setAuthToken } from '../api/client';
import { useTheme } from '../theme';
import { getSelectStyles } from '../components/selectStyles';

type SelectOption = { value: string; label: string };

const roleOptions: SelectOption[] = [
  { value: 'OrgEmployee', label: 'Employee' },
  { value: 'OrgAdmin', label: 'Admin' },
];

export function AuthPage() {
  const navigate = useNavigate();
  const [theme] = useTheme();
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      setError(resolveAuthError(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const selectStyles = getSelectStyles(theme);

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-100 px-4 py-10">
      <form
        className="rounded-card border border-border bg-surface p-6 w-full max-w-md space-y-4"
        onSubmit={handleSubmit}
      >
        <h1 className="text-xl font-semibold text-center text-accent">Prosperity CRM</h1>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3 flex-1 justify-center"
            onClick={() => setMode('login')}
          >
            <span className={mode === 'login' ? 'bg-accent text-white w-full' : 'w-full'}>
              Login
            </span>
          </button>
          <button
            type="button"
            className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3 flex-1 justify-center"
            onClick={() => setMode('signup')}
          >
            <span className={mode === 'signup' ? 'bg-accent text-white w-full' : 'w-full'}>
              Sign Up
            </span>
          </button>
        </div>

        {mode === 'signup' && (
          <label className="flex flex-col gap-1 text-sm text-ink-2">
            Full Name
            <input
              className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
              value={form.name}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = event.currentTarget.value;
                setForm((prev) => ({ ...prev, name: value }));
              }}
              required
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-ink-2">
          Email
          <input
            className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            type="email"
            value={form.email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, email: value }));
            }}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-2">
          Password
          <input
            className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
            type="password"
            value={form.password}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, password: value }));
            }}
            required
          />
        </label>

        {mode === 'signup' && (
          <>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Organization ID
              <input
                className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={form.organization_id}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const value = event.currentTarget.value;
                  setForm((prev) => ({ ...prev, organization_id: value }));
                }}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-2">
              Role
              <Select
                options={roleOptions}
                value={roleOptions.find((o) => o.value === form.role)}
                onChange={(option) =>
                  setForm((prev) => ({
                    ...prev,
                    role: (option?.value as 'OrgAdmin' | 'OrgEmployee') ?? 'OrgEmployee',
                  }))
                }
                styles={selectStyles}
                classNamePrefix="skill-select"
              />
            </label>
          </>
        )}

        {error && <p className="text-sm text-warn-fg">{error}</p>}

        <button
          className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3 w-full justify-center disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          <span>{mode === 'login' ? 'Login' : 'Create Account'}</span>
        </button>
      </form>
    </div>
  );
}

type ApiErrorPayload = {
  message?: string;
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
};

function resolveAuthError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (Array.isArray(data?.formErrors) && data.formErrors.length > 0) {
      return data.formErrors[0];
    }
    const fieldErrors = data?.fieldErrors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      for (const [field, messages] of Object.entries(fieldErrors)) {
        if (Array.isArray(messages) && messages.length > 0) {
          return `${humanize(field)}: ${messages[0]}`;
        }
      }
    }
  }
  return 'Authentication failed. Check your details and try again.';
}

function humanize(field: string) {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
