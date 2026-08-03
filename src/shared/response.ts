export interface SuccessResponse<T> {
  success: true;

  message: string;

  data: T;
}

export interface FailureResponse {
  success: false;

  message: string;

  errors: unknown[];
}

export function success<T>(data: T, message = "Success"): SuccessResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

export function failure(
  message: string,
  errors: unknown[] = [],
): FailureResponse {
  return {
    success: false,
    message,
    errors,
  };
}
