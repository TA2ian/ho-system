export type ApiError = {
  error: string;
  message: string;
  issues?: unknown;
  retryAfterSeconds?: number;
};

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null
  ) {}

  private buildUrl(path: string): string {
    const normalizedPath = path.replace(/^\/+/, "");
    if (/^https?:\/\//i.test(this.baseUrl)) {
      return new URL(normalizedPath, this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`).toString();
    }
    return `${this.baseUrl.replace(/\/+$/, "")}/${normalizedPath}`;
  }

  async get<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(this.buildUrl(path), {
      ...init,
      method: "GET",
      headers
    });

    if (!response.ok) throw await this.readError(response);
    return response.json() as Promise<T>;
  }

  private async readError(response: Response): Promise<Error> {
    let body: ApiError | null = null;
    try { body = await response.json() as ApiError; } catch {}
    return new Error(body?.message || `API_REQUEST_FAILED_${response.status}`);
  }
}
