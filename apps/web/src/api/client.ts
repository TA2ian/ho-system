export type ApiError = {
  error: string;
  message: string;
  issues?: unknown;
  retryAfterSeconds?: number;
};

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null,
    private readonly onUnauthorized?: () => void
  ) {}

  private buildUrl(path: string): string {
    const normalizedPath = path.replace(/^\/+/, "");
    if (/^https?:\/\//i.test(this.baseUrl)) {
      return new URL(normalizedPath, this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`).toString();
    }
    return `${this.baseUrl.replace(/\/+$/, "")}/${normalizedPath}`;
  }

  private async request<T>(method: string, path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(this.buildUrl(path), { ...init, method, headers });
    if (response.status === 401) {
      this.onUnauthorized?.();
    }
    if (!response.ok) throw await this.readError(response);
    return response.json() as Promise<T>;
  }

  get<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.request<T>("GET", path, init);
  }

  put<T>(path: string, body: unknown, idempotencyKey: string, init: RequestInit = {}): Promise<T> {
    if (idempotencyKey.trim().length < 16) {
      throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    }
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request<T>("PUT", path, {
      ...init,
      headers,
      body: JSON.stringify(body)
    });
  }

  post<T>(path: string, body: unknown, idempotencyKey: string, init: RequestInit = {}): Promise<T> {
    if (idempotencyKey.trim().length < 16) {
      throw new Error("IDEMPOTENCY_KEY_REQUIRED");
    }
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request<T>("POST", path, {
      ...init,
      headers,
      body: JSON.stringify(body)
    });
  }

  private async readError(response: Response): Promise<Error> {
    let body: ApiError | null = null;
    try { body = await response.json() as ApiError; } catch {}
    return new Error(body?.message || `API_REQUEST_FAILED_${response.status}`);
  }
}
