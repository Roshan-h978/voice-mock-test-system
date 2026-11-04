// Sign-in, sign-up, profile and password requests.

import api, { tokenStore } from './api';

export async function login(email, password) {
  const { data } = await api.post('/auth/login/', { email, password });
  tokenStore.set(data);
  return data.user;
}

/** Sign in (or sign up) with the ID token from Google's button. */
export async function loginWithGoogle(credential, inviteToken) {
  const { data } = await api.post('/auth/google/', { credential, ...(inviteToken ? { invite_token: inviteToken } : {}) });
  tokenStore.set(data);
  return data.user;
}

let googleConfigRequest = null;

/** { enabled, client_id, setup_hint } — asked once per page load. */
export function getGoogleConfig() {
  googleConfigRequest =
    googleConfigRequest ||
    api
      .get('/auth/google/config/')
      .then((response) => response.data)
      .catch(() => {
        googleConfigRequest = null;
        return { enabled: false, client_id: null, setup_hint: false };
      });
  return googleConfigRequest;
}

/** payload: { full_name, email, password, invite_token? } */
export async function register(payload) {
  const { data } = await api.post('/auth/register/', payload);
  tokenStore.set(data);
  return data.user;
}

export async function logout() {
  const refresh = tokenStore.getRefresh();
  try {
    if (refresh) await api.post('/auth/logout/', { refresh });
  } catch {
    /* the session ends locally either way */
  } finally {
    tokenStore.clear();
  }
}

export async function getMe() {
  const { data } = await api.get('/auth/me/');
  return data;
}

/** payload: any of { full_name, phone, level, bio, purpose, weekly_goal, target_score, email_updates } */
export async function updateMe(payload) {
  const { data } = await api.patch('/auth/me/', payload);
  return data;
}

/** With signOutOthers, every other browser and device is signed out and this one gets new tokens. */
export async function changePassword(currentPassword, newPassword, signOutOthers = false) {
  const { data } = await api.post('/auth/me/password/', {
    current_password: currentPassword,
    new_password: newPassword,
    sign_out_others: signOutOthers,
  });
  if (data.access) tokenStore.set(data);
  return data;
}

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------
/** Profile strength, numbers, this week's goal, achievements (students) and sign-ins. */
export async function getProfileSummary() {
  const { data } = await api.get('/auth/me/summary/');
  return data;
}

/** photo: a Blob (the cropped square). Returns the updated user. */
export async function uploadAvatar(photo) {
  const form = new FormData();
  form.append('avatar', photo, 'photo.jpg');
  const { data } = await api.post('/auth/me/avatar/', form);
  return data;
}

export async function removeAvatar() {
  const { data } = await api.delete('/auth/me/avatar/');
  return data;
}

export async function signOutOtherDevices() {
  const { data } = await api.post('/auth/me/sign-out-others/');
  tokenStore.set(data);
  return data;
}

/** Saves the JSON file the API sends ("Download my data"). */
export async function downloadMyData() {
  const response = await api.get('/auth/me/export/', { responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] || '');
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = match ? match[1] : 'voice-mock-test-data.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** payload: { password } or, for accounts that only use Google, { confirm_email } */
export async function deleteAccount(payload) {
  await api.post('/auth/me/delete/', payload);
  tokenStore.clear();
}

export async function requestPasswordReset(email) {
  const { data } = await api.post('/auth/password-reset/', { email });
  return data;
}

export async function confirmPasswordReset(token, newPassword) {
  const { data } = await api.post('/auth/password-reset/confirm/', { token, new_password: newPassword });
  return data;
}

export async function getInvitation(token) {
  const { data } = await api.get(`/auth/invitations/${encodeURIComponent(token)}/`);
  return data;
}

export const hasSession = () => tokenStore.hasSession();
