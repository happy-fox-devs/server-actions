import { MSG_OP_DEFAULT_FAILURE, MSG_OP_DEFAULT_SUCCESS } from "../models";
import type { ServerActionResponse } from "../types/index";
import { formDataToObject } from "./transform";

/**
 * Sanitizes data for client transmission by converting non-serializable types to safe formats
 *
 * @param data - Any data to be sanitized
 * @returns Sanitized data safe for JSON serialization
 */
function sanitizeDataForClient(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeDataForClient);
  }

  if (typeof data === "object") {
    // Convert Date objects to ISO strings
    if (data instanceof Date) {
      return data.toISOString();
    }

    // Convert File/Blob objects to metadata (not serializable)
    if (data instanceof File || data instanceof Blob) {
      return {
        name: data instanceof File ? data.name : "blob",
        size: data.size,
        type: data.type,
        _isFile: true,
      };
    }

    // Handle plain objects recursively
    if (data.constructor === Object) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = sanitizeDataForClient(value);
      }
      return sanitized;
    }
  }

  return data;
}

/**
 * Type helper for sanitized data transformation
 */
type Sanitized<T> = T extends Date
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

/**
 * Wraps a server action to provide automatic data transformation and response wrapping
 *
 * Features:
 * - Automatically transforms FormData to typed objects
 * - Wraps results in ServerActionResponse format
 * - Sanitizes data for client consumption
 * - Handles errors gracefully
 * - **Smart Response Detection**: Detects response patterns and handles accordingly
 *
 * **Supported Response Patterns**:
 * 1. `{ ok: true, message: string, data: any }` → Uses your custom success message
 * 2. `{ ok: false, message: string, error: any }` → Throws error with your message
 * 3. `{ data: any, message?: string }` → Success with optional custom message
 * 4. `{ error: any, message?: string }` → Throws error with optional message
 * 5. `any` → Wraps in default success response
 *
 * @param serverAction - Server action that returns data or response object
 * @returns Function that accepts FormData and returns ServerActionResponse with sanitized data
 *
 * @example
 * ```typescript 
 * // Pattern 1: Direct data (auto-wrapped)
 * const getUser = withFormTransform(async (data: { id: string }) => {
 *   return await db.user.findUnique({ where: { id: data.id } });
 *   // → { ok: true, message: "Operation completed successfully", data: user }
 * });
 *
 * // Pattern 2: Custom success message
 * const createUser = withFormTransform(async (data: CreateUserInput) => {
 *   const user = await db.user.create({ data });
 *   return {
 *     ok: true,
 *     message: "User created successfully",
 *     data: user
 *   };
 * });
 * // → Result: { ok: true, message: "User created successfully", data: user }
 *
 * // Pattern 3: Error handling with custom message
 * const deleteUser = withFormTransform(async (data: { id: string }) => {
 *   const user = await db.user.findUnique({ where: { id: data.id } });
 *   if (!user) {
 *     return {
 *       ok: false,
 *       message: "User not found",
 *       error: new Error("User not found")
 *     };
 *   }
 *
 *   await db.user.delete({ where: { id: data.id } });
 *   return { ok: true, message: "User deleted successfully", data: null };
 * });
 * // → Result: { ok: false, message: "User not found", error: ... }
 *
 * // Pattern 4: Throwing an error directly
 * const updateUser = withFormTransform(async (data: UpdateUserInput) => {
 *   const user = await db.user.findUnique({ where: { id: data.id } });
 *   if (!user) {
 *     throw new Error("User not found");
 *   }
 *
 *   await db.user.update({ where: { id: data.id }, data });
 *   return { ok: true, message: "User updated successfully", data: null };
 * });
 * // → Result: { ok: false, message: "User not found", error: ... }
 *
 * // Pattern 5: Without returning anything (void)
 * const voidAction = withFormTransform(async (data: { id: string }) => {
 *   await db.user.delete({ where: { id: data.id } });
 * });
 * // → Result: { ok: true, message: "Operation completed successfully", data: null }
 *
 *
 * // Usage (automatically handles FormData → object conversion)
 * const result = await createUser(formData);
 * // Result: { ok: true, message: "...", data: sanitizedUser }
 * ```
 */
// Type helpers for different response patterns
type ResponseWithError = { error: any; message?: string };

// Extract data type from different response patterns
type ExtractDataType<R> = R extends { ok: true; data: infer D }
  ? D
  : R extends { data: infer D }
    ? D
    : R extends ResponseWithError
      ? never
      : R;

type ResponsePattern<R> =
  | { ok?: true; message?: string; data: R }
  | { ok?: false; message?: string; error: Error }
  | R;

export function withFormTransform<T, R>(
  serverAction: (data: T) => Promise<ResponsePattern<R>> | ResponsePattern<R>,
): (
  formData: FormData,
) => Promise<ServerActionResponse<Sanitized<ExtractDataType<R>>>> {
  return async (
    formData: FormData,
  ): Promise<ServerActionResponse<Sanitized<ExtractDataType<R>>>> => {
    try {
      const parsedData = formDataToObject<T>(formData);
      const result = await serverAction(parsedData);

      // Check if result has the pattern of a response object with ok/error
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const { ok, message, data, error } = result as any;

        // Pattern 1: { ok: boolean, message: string, data?: any, error?: any }
        if (typeof ok === "boolean") {
          if (ok) {
            // Success response - use the provided message and data
            return {
              ok: true,
              message: message || MSG_OP_DEFAULT_FAILURE,
              data: sanitizeDataForClient(data),
            };
          } else {
            // Error response - throw error to trigger catch block
            throw error ?? new Error(message || MSG_OP_DEFAULT_FAILURE);
          }
        }

        // Pattern 2: { data: any, message?: string } (success)
        if (data && !error) {
          return {
            ok: true,
            message: message || MSG_OP_DEFAULT_FAILURE,
            data: sanitizeDataForClient(data),
          };
        }

        // Pattern 3: { error: any, message?: string } (error)
        if (error && !data) {
          throw error instanceof Error
            ? error
            : new Error(message || MSG_OP_DEFAULT_FAILURE);
        }
      }

      // Regular data - wrap in success response
      const sanitizedResult = sanitizeDataForClient(result);

      return {
        ok: true,
        message: MSG_OP_DEFAULT_SUCCESS,
        data: sanitizedResult,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Error processing request",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  };
}
