import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Field, Icon, Notice } from './ui';

export type AuthMethod = 'passwordless' | 'password';

export interface AuthScreenProps {
  loading: boolean;
  error: string | null;
  success: string | null;
  magicSent: boolean;
  onPasskey: () => void;
  onMagicLinkRequest: (email: string) => void;
  onMagicLinkVerify: (code: string) => void;
  onPasswordLogin: (email: string, password: string) => void;
  onBackFromMagic: () => void;
}

/** The web AuthPage at panel width: brand mark, serif greeting, passkey first,
 *  magic link second, password behind a text link. */
export function AuthScreen(props: AuthScreenProps) {
  const [method, setMethod] = useState<AuthMethod>('passwordless');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  function submitMagic(event: FormEvent) {
    event.preventDefault();
    props.onMagicLinkRequest(email);
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    props.onMagicLinkVerify(code);
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    props.onPasswordLogin(email, password);
  }

  return (
    <div className="my-auto flex flex-col gap-5 py-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-accent text-white shadow-sm">
          <Icon name="logo" size={23} strokeWidth={2.2} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[26px] leading-tight tracking-[-0.012em]">Welcome back</h1>
          <p className="text-base text-ink-2">Sign in to source candidates into your Prosperity workspace.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-token">
        {props.error && (
          <Notice tone="warn">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            <span>{props.error}</span>
          </Notice>
        )}
        {props.success && (
          <Notice tone="ok">
            <Icon name="check" size={14} className="mt-0.5 shrink-0" />
            <span>{props.success}</span>
          </Notice>
        )}

        {method === 'passwordless' ? (
          <div className="flex flex-col gap-4">
            <Button type="button" variant="primary" disabled={props.loading} onClick={props.onPasskey} className="h-10 w-full">
              <Icon name="passkey" size={18} strokeWidth={2} />
              <span>{props.loading ? 'Waiting for Touch ID…' : 'Sign in with Passkey / Touch ID'}</span>
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-surface px-3 text-xs uppercase tracking-wider text-ink-3">Or with magic link</span>
            </div>

            {!props.magicSent ? (
              <form onSubmit={submitMagic} className="flex flex-col gap-4">
                <Field
                  label="Work email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" disabled={props.loading} className="w-full">
                  <Icon name="mail" size={16} strokeWidth={2} />
                  <span>{props.loading ? 'Sending link…' : 'Send 1-Click Magic Link'}</span>
                </Button>
              </form>
            ) : (
              <form onSubmit={submitCode} className="flex flex-col gap-4">
                <Field
                  label="Sign-in code"
                  hint="From the email we sent"
                  required
                  placeholder="Paste the code or token"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono"
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={props.loading} className="flex-1">
                    {props.loading ? 'Verifying…' : 'Verify & sign in'}
                  </Button>
                  <Button type="button" onClick={props.onBackFromMagic}>
                    Back
                  </Button>
                </div>
              </form>
            )}

            <div className="border-t border-border pt-3 text-center">
              <button
                type="button"
                onClick={() => setMethod('password')}
                className="focus-ring rounded-[4px] text-xs font-medium text-ink-3 transition hover:text-ink"
              >
                Sign in with password instead →
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitPassword} className="flex flex-col gap-4">
            <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="primary" disabled={props.loading} className="w-full">
              {props.loading ? 'One moment…' : 'Sign in'}
            </Button>
            <div className="border-t border-border pt-3 text-center">
              <button
                type="button"
                onClick={() => setMethod('passwordless')}
                className="focus-ring rounded-[4px] text-xs font-medium text-accent transition hover:underline"
              >
                ← Use Passkey or Magic Link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
