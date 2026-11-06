export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isConflict() {
    return this.status === 409;
  }
  get isUnavailable() {
    return [0, 502, 503, 504].includes(this.status);
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
