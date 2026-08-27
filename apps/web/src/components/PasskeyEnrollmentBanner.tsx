import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUserPasskeys, isPasskeySupported, registerPasskey } from '../api/auth';
import { Button } from './ui';

export function PasskeyEnrollmentBanner() {
  const queryClient = useQueryClient();
  const [supported, setSupported] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isPasskeySupported().then(setSupported);
    if (localStorage.getItem('dismiss_passkey_enrollment') === 'true') {
      setDismissed(true);
    }
  }, []);

  const { data: passkeys, isLoading } = useQuery({
    queryKey: ['passkeys'],
    queryFn: fetchUserPasskeys,
    enabled: supported && !dismissed,
  });

  const registerMutation = useMutation({
    mutationFn: () => {
      const deviceName = navigator.userAgent.includes('Mac')
        ? 'MacBook Touch ID'
        : navigator.userAgent.includes('iPhone')
          ? 'iPhone Face ID'
          : 'Biometric Passkey';
      return registerPasskey(deviceName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      setSuccess(true);
      setError(null);
      setTimeout(() => {
        setDismissed(true);
      }, 3500);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as { message?: string })?.message ??
        'Could not register passkey. Try again from Settings.';
      setError(message);
    },
  });

  function handleDismiss() {
    localStorage.setItem('dismiss_passkey_enrollment', 'true');
    setDismissed(true);
  }

  // Only show if supported, not dismissed, finished loading passkeys, and has 0 registered passkeys
  if (!supported || dismissed || isLoading) return null;
  if (passkeys && passkeys.length > 0 && !success) return null;

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-card border border-accent/20 bg-accent/5 p-4 text-ink shadow-sm transition">
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent text-white shadow-sm">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004.07 9" />
          </svg>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-ink">
            {success ? '🎉 Touch ID / Face ID Enabled!' : 'Enable 1-Click Biometric Sign-In?'}
          </p>
          <p className="text-xs text-ink-2 max-w-[540px] leading-relaxed">
            {success
              ? 'Your passkey is set up. You can now log into Prosperity CRM with a single tap.'
              : 'Sign into Prosperity CRM instantly next time using Apple Touch ID, Face ID, or Windows Hello without typing passwords or waiting for emails.'}
          </p>
          {error && <p className="mt-1 text-xs text-warn-fg font-medium">{error}</p>}
        </div>
      </div>

      {!success && (
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="focus-ring h-8 rounded-control px-3 text-xs font-medium text-ink-3 hover:text-ink transition"
          >
            Maybe later
          </button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending}
            className="flex items-center gap-1.5"
          >
            <span>{registerMutation.isPending ? 'Touch sensor…' : 'Enable Touch ID / Face ID'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
