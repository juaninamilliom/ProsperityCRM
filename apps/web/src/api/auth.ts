import type { Role } from 'src/common';
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { apiClient, setAuthToken } from './client';

export interface AuthResponse {
  token: string;
  user: {
    user_id: string;
    email: string;
    name: string;
    role: Role;
    organization_id: string;
  };
}

export interface PasskeyItem {
  passkey_id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

// ─── Traditional Auth ────────────────────────────────────────────────────────

export async function signup(payload: {
  email: string;
  password: string;
  name: string;
  invite_code: string;
}) {
  const response = await apiClient.post<AuthResponse>('/auth/signup', payload);
  setAuthToken(response.data.token);
  return response.data;
}

export async function login(payload: { email: string; password: string }) {
  const response = await apiClient.post<AuthResponse>('/auth/login', payload);
  setAuthToken(response.data.token);
  return response.data;
}

// ─── Magic Link Auth ─────────────────────────────────────────────────────────

export async function requestMagicLink(payload: {
  email: string;
  invite_code?: string;
  name?: string;
}) {
  const response = await apiClient.post<{
    success: boolean;
    message: string;
    devUrl?: string;
  }>('/auth/magic-link/request', payload);
  return response.data;
}

export async function verifyMagicLink(payload: { token: string; name?: string }) {
  const response = await apiClient.post<AuthResponse>('/auth/magic-link/verify', payload);
  setAuthToken(response.data.token);
  return response.data;
}

// ─── Passkey (Face ID / Touch ID) Auth ───────────────────────────────────────

export async function isPasskeySupported(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export async function loginWithPasskey(email?: string): Promise<AuthResponse> {
  // 1. Get auth challenge options from server
  const { data: { options, challengeId } } = await apiClient.post<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }>('/auth/passkey/login-options', { email: email?.trim() || undefined });

  // 2. Prompt Face ID / Touch ID / Security Key via browser
  const credential = await startAuthentication({ optionsJSON: options });

  // 3. Verify signature with server
  const response = await apiClient.post<AuthResponse>('/auth/passkey/login-verify', {
    response: credential,
    challengeId,
  });

  setAuthToken(response.data.token);
  return response.data;
}

export async function registerPasskey(deviceName?: string): Promise<{ success: boolean; passkey: PasskeyItem }> {
  // 1. Get registration challenge options from server
  const { data: { options, challengeId } } = await apiClient.post<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challengeId: string;
  }>('/auth/passkey/register-options');

  // 2. Prompt browser to create new credential
  const credential = await startRegistration({ optionsJSON: options });

  // 3. Verify and save credential on server
  const response = await apiClient.post<{ success: boolean; passkey: PasskeyItem }>('/auth/passkey/register-verify', {
    response: credential,
    challengeId,
    deviceName,
  });

  return response.data;
}

export async function fetchUserPasskeys(): Promise<PasskeyItem[]> {
  const response = await apiClient.get<PasskeyItem[]>('/auth/passkeys');
  return response.data;
}

export async function deleteUserPasskey(passkeyId: string): Promise<void> {
  await apiClient.delete(`/auth/passkeys/${passkeyId}`);
}
