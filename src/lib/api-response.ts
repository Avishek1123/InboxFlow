import { NextResponse } from "next/server";
import type { ApiError, ApiSuccess } from "@/types";

export function apiSuccess<T>(
  data: T,
  status = 200,
  meta?: Record<string, unknown>
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data, meta }, { status });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}
