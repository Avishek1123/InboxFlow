/**
 * Shared application types (API responses, UI models).
 * Prisma model types will be re-exported from @/server/db in Step 4.
 */

export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
