import axios from 'axios';
import { ChangeEvent, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select, { type StylesConfig } from 'react-select';
import { login, signup } from '../api/auth';
import { setAuthToken } from '../api/client';
import { useTheme } from '../theme';

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

  const selectStyles: StylesConfig<SelectOption, false> = {
    control: (provided, state) => ({
      ...provided,
      borderRadius: 9999,
      minHeight: '2.75rem',
      borderColor: state.isFocused ? '#7c3aed' : provided.borderColor,
      boxShadow: 'none',
      ':hover': {
        borderColor: '#7c3aed',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      paddingTop: '4px',
      paddingBottom: '4px',
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: 16,
      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
      color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused
        ? theme === 'dark'
          ? '#475569'
          : '#e0f2fe'
        : provided.backgroundColor,
      color: state.isSelected
        ? theme === 'dark'
          ? '#e2e8f0'
          : '#1d4ed8'
        : theme === 'dark'
        ? '#e2e8f0'
        : '#0f172a',
      ':active': {
        backgroundColor: theme === 'dark' ? '#334155' : '#bfdbfe',
      },
    }),
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-100 px-4 py-10">
      <form className="glass-card w-full max-w-md space-y-4" onSubmit={handleSubmit}>
        <h1 className="text-xl font-semibold text-center text-brand-blue dark:text-white">
          Prosperity CRM
        </h1>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className="btn-outline flex-1 justify-center"
            onClick={() => setMode('login')}
          >
            <span className={mode === 'login' ? 'bg-brand-fuchsia text-white w-full' : 'w-full'}>
              Login
            </span>
          </button>
          <button
            type="button"
            className="btn-outline flex-1 justify-center"
            onClick={() => setMode('signup')}
          >
            <span className={mode === 'signup' ? 'bg-brand-fuchsia text-white w-full' : 'w-full'}>
              Sign Up
            </span>
          </button>
        </div>

        {mode === 'signup' && (
          <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
            Full Name
            <input
              className="pill-input"
              value={form.name}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = event.currentTarget.value;
                setForm((prev) => ({ ...prev, name: value }));
              }}
              required
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Email
          <input
            className="pill-input"
            type="email"
            value={form.email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.currentTarget.value;
              setForm((prev) => ({ ...prev, email: value }));
            }}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
          Password
          <input
            className="pill-input"
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
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
              Organization ID
              <input
                className="pill-input"
                value={form.organization_id}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const value = event.currentTarget.value;
                  setForm((prev) => ({ ...prev, organization_id: value }));
                }}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-200">
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          className="btn-outline w-full justify-center disabled:opacity-50"
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
