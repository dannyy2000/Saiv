import axios, { type AxiosError, type AxiosInstance, type AxiosResponse } from "axios";

export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data: T;
}

export interface ProblemDetail {
  success?: boolean;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
  [key: string]: unknown;
}

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const DEFAULT_API_BASE_URL =
  typeof window !== "undefined"
    ? "/api"
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? `${DEFAULT_BACKEND_URL.replace(/\/$/, "")}/api`);
const STORAGE_KEY = "saiv-auth-token";

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const apiClient: AxiosInstance = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  withCredentials: false,
  timeout: 15000, // Fail fast instead of leaving the UI stuck
});

type MaybeEnvelope<T> = ApiEnvelope<T> | T;

function normalizeEnvelope<T>(payload: MaybeEnvelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authToken = null;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export function extractData<T>(response: AxiosResponse<MaybeEnvelope<T>>): T {
  return normalizeEnvelope(response.data);
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) {
    return authToken;
  }
  if (typeof window !== "undefined") {
    authToken = window.localStorage.getItem(STORAGE_KEY);
  }
  return authToken;
}

export function clearAuthToken(): void {
  authToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export type ApiError = AxiosError<ProblemDetail>;

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) {
    return fallback;
  }

  if (axios.isAxiosError<ProblemDetail>(error)) {
    const detail = error.response?.data;
    if (detail?.message) {
      return detail.message;
    }
    if (detail?.errors?.length) {
      return detail.errors.map((entry) => entry.message).join("\n");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
