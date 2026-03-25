export interface ScheduleConflictPayload {
  /** 业务错误码，如 SCHEDULE_CONFLICT、USER_HAS_ACTIVE_ORDERS */
  code?: string;
  conflicts?: Array<{
    customerUnit?: string;
    customerName?: string;
    visitTime?: string;
    serviceEndTime?: string;
  }>;
  error?: string;
}

export interface HttpError extends Error {
  status?: number;
  data?: ScheduleConflictPayload;
}

export function getHttpError(e: unknown): HttpError {
  return e as HttpError;
}
