import { type ServerActionResponse } from "../types";

/**
 * Sanitizes data to ensure client-server compatibility by converting
 * non-serializable types to safe formats
 *
 * @param data - Any data to sanitize
 * @returns Sanitized data safe for JSON serialization
 */
export function sanitizeForTransport(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeForTransport);
  }

  if (typeof data === "object") {
    if (data instanceof Date) {
      return data.toISOString();
    }

    if (data instanceof File || data instanceof Blob) {
      return {
        name: data instanceof File ? data.name : "blob",
        size: data.size,
        type: data.type,
        _isFile: true,
      };
    }

    if (data.constructor === Object) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = sanitizeForTransport(value);
      }
      return sanitized;
    }
  }

  return data;
}

/**
 * Creates a success response with sanitized data
 *
 * @param data - The response data
 * @param message - Optional success message
 * @returns ServerActionResponse with success status
 *
 * @example
 * ```ts
 * return createSuccessResponse(user, "User created successfully");
 * ```
 */
export function createSuccessResponse<T>(
  data: T,
  message: string = "Operation successful",
): ServerActionResponse<T> {
  return {
    ok: true,
    message,
    data: sanitizeForTransport(data) as T,
  };
}

/**
 * Creates an error response
 *
 * @param error - Error object or error message
 * @param message - Optional error message
 * @returns ServerActionResponse with error status
 *
 * @example
 * ```ts
 * return createErrorResponse(error, "Failed to create user");
 * ```
 */
export function createErrorResponse(
  error: Error | string,
  message: string = "Operation failed",
): ServerActionResponse<never> {
  return {
    ok: false,
    message,
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

/**
 * Processes a server action response, automatically sanitizing data
 *
 * If you pass a plain object, it wraps it in ServerActionResponse.
 * If you pass an existing ServerActionResponse, it sanitizes the data.
 *
 * @param response - Plain object or existing ServerActionResponse
 * @param message - Optional message for plain objects
 * @returns ServerActionResponse with sanitized data
 *
 * @example
 * ```ts
 * // With plain object
 * return serverActionResponse(user, "User retrieved");
 *
 * // With existing response
 * return serverActionResponse(existingResponse);
 * ```
 */
export function serverActionResponse<T>(
  response: T | ServerActionResponse<T>,
  message?: string,
): ServerActionResponse<T> {
  if (response && typeof response === "object" && "ok" in response) {
    const serverResponse = response as ServerActionResponse<T>;

    if (serverResponse.ok) {
      return {
        ...serverResponse,
        data: sanitizeForTransport(serverResponse.data) as T,
      };
    }

    return serverResponse;
  }

  return createSuccessResponse(response as T, message);
}

/**
 * Type helper that transforms types to their sanitized equivalents
 *
 * - Date → string (ISO format)
 * - File/Blob → metadata object
 * - Arrays and nested objects are processed recursively
 *
 * @template T The original type to be sanitized
 */
export type Sanitized<T> = T extends Date
  ? string
  : T extends File
    ? { name: string; size: number; type: string; _isFile: boolean }
    : T extends Blob
      ? { name: string; size: number; type: string; _isFile: boolean }
      : T extends (infer U)[]
        ? Sanitized<U>[]
        : T extends object
          ? { [K in keyof T]: Sanitized<T[K]> }
          : T;
