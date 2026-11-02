// Taking a test: published tests, starting an attempt, uploading answers, finishing.

import { audioFileName } from '../utils/formatters';
import api from './api';

/** Published tests. params: { level? } */
export async function getTests(params = {}) {
  const { data } = await api.get('/tests/', { params });
  return data;
}

export async function getTest(testId) {
  const { data } = await api.get(`/tests/${testId}/`);
  return data;
}

/** Starts the test, or returns the unfinished attempt to continue. */
export async function startAttempt(testId) {
  const { data } = await api.post('/attempts/', { test: testId });
  return data;
}

export async function getAttempt(attemptId) {
  const { data } = await api.get(`/attempts/${attemptId}/`);
  return data;
}

/** Uploads one recording and returns its scores. */
export async function uploadAnswer(attemptId, { questionId, blob, durationSeconds }) {
  const form = new FormData();
  form.append('question', String(questionId));
  form.append('audio', blob, audioFileName('answer', blob.type));
  if (durationSeconds) form.append('duration_seconds', String(Math.round(durationSeconds * 10) / 10));
  const { data } = await api.post(`/attempts/${attemptId}/answers/`, form);
  return data;
}

export async function submitAttempt(attemptId) {
  const { data } = await api.post(`/attempts/${attemptId}/submit/`);
  return data;
}
