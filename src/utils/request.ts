import { type ServerActionResponse } from "../types/index";
import { objectToFormData } from "./transform";

/**
 * Executes a server action with automatic data transformation
 *
 * Automatically detects whether the input data is FormData or a plain object
 * and transforms it accordingly. This provides flexibility in how you send data
 * to server actions - use FormData for forms or plain objects for programmatic calls.
 *
 * @param action - Server action wrapped with withFormTransform
 * @param data - FormData from a form or plain JavaScript object
 * @returns Promise resolving to ServerActionResponse
 *
 * @example
 * ```ts
 * // With FormData (from HTML form)
 * const formData = new FormData(form);
 * const result = await serverActionRequest(createUser, formData);
 *
 * // With plain object (programmatic)
 * const userData = { name: 'John', email: 'john@example.com' };
 * const result = await serverActionRequest(createUser, userData);
 * ```
 */
export const serverActionRequest = async <T>(
  action: (formData: FormData) => Promise<ServerActionResponse<T>>,
  data: FormData | Record<string, any>,
): Promise<ServerActionResponse<T>> => {
  try {
    let formData: FormData;

    if (data instanceof FormData) {
      formData = data;
    } else {
      formData = objectToFormData(data);
    }

    const response = await action(formData);
    return response;
  } catch (error) {
    return {
      ok: false,
      message: "Error processing request",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};
