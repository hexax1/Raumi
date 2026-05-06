const API_BASE = "http://localhost:8080";

type RequestOptions = RequestInit & {
  headers?: Record<string, string>;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`HTTP error! Status: ${res.status}`);
  }

  // Falls kein Body zurückkommt (z. B. DELETE)
  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T, B = unknown>(endpoint: string, data: B) =>
    request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: <T, B = unknown>(endpoint: string, data: B) =>
    request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, {
      method: "DELETE",
    }),
};