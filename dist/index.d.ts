/**
 * Represents a successful server action response
 */
type SuccessActionResponse<T> = {
    ok: true;
    message: string;
    data: T;
};
/**
 * Represents a failed server action response
 */
type ErrorActionResponse = {
    ok: false;
    message: string;
    error: Error;
};
/**
 * Union type for all possible server action responses
 */
type ServerActionResponse<T> = SuccessActionResponse<T> | ErrorActionResponse;
/**
 * Configuration options for the useSAR hook
 *
 * @template T The expected data type returned by the server action
 */
type SAROptions<T = any> = {
    /** Server action wrapped with withFormTransform */
    action: (...args: any[]) => Promise<ServerActionResponse<T>>;
    /** Condition to execute the action. If false, won't execute */
    condition?: boolean;
    /** Time in ms to keep data in cache. 0 = no cache */
    cacheTime?: number;
    /** Automatically execute when component mounts */
    revalidateOnMount?: boolean;
    /** Revalidate when window gains focus */
    revalidateOnFocus?: boolean;
    /** Minimum interval between requests to avoid duplicates (ms) */
    dedupingInterval?: number;
    /** Execute immediately on mount (ignores condition on first render) */
    executeOnMount?: boolean;
    /** Initial data to pass when executeOnMount is true */
    initialExecuteData?: FormData | Record<string, any>;
    /** Success callback */
    onSuccess?: (data: T) => void;
    /** Error callback */
    onError?: (error: string) => void;
};
/**
 * Return type of the useSAR hook
 *
 * @template T The expected data type returned by the server action
 */
type SARReturn<T> = {
    /** Data returned by the last successful execution */
    data?: T;
    /** Error message from the last execution */
    error?: string;
    /** Current loading state */
    loading: boolean;
    /** Function to manually execute the server action */
    execute: (data?: FormData | Record<string, any>) => Promise<ServerActionResponse<T> | void>;
    /** Function to refetch with the same previous data */
    refetch: () => Promise<ServerActionResponse<T> | void>;
    /** Directly mutate local data */
    mutate: (data: T | undefined) => void;
    /** Optimistic update with function */
    optimisticMutate: (updateFn: OptimisticUpdate<T>) => void;
    /** Clear data and error */
    reset: () => void;
};
/**
 * Function type for optimistic updates
 *
 * @template T The data type being updated
 * @param currentData The current data (may be undefined)
 * @returns The new data (may be undefined)
 */
type OptimisticUpdate<T> = (currentData: T | undefined) => T | undefined;

/**
 * Data transformation utilities for converting between objects and FormData
 */
/**
 * Converts a complex object to FormData, preserving nested structure
 * using dot notation (e.g., user.profile.name) and array indices (e.g., items[0].name)
 *
 * @param obj - The object to convert to FormData
 * @param prefix - Optional prefix for all keys
 * @returns FormData representation of the object
 *
 * @example
 * ```ts
 * const data = {
 *   user: { name: 'John', age: 30 },
 *   files: [file1, file2],
 *   createdAt: new Date()
 * };
 *
 * const formData = objectToFormData(data);
 * // Creates keys: "user.name", "user.age", "files[0]", "files[1]", "createdAt"
 * ```
 */
declare function objectToFormData(obj: any, prefix?: string): FormData;
/**
 * Converts FormData back to an object, reconstructing the original structure
 * based on dot notation and array indices
 *
 * @param formData - The FormData to convert back to an object
 * @returns Reconstructed object with proper types
 *
 * @example
 * ```ts
 * const formData = new FormData();
 * formData.append('user.name', 'John');
 * formData.append('user.age', '30');
 *
 * const obj = formDataToObject(formData);
 * // Result: { user: { name: 'John', age: 30 } }
 * ```
 */
declare function formDataToObject<T = any>(formData: FormData): T;

/**
 * Type helper for sanitized data transformation
 */
type Sanitized$1<T> = T extends Date ? string : T extends File ? {
    name: string;
    size: number;
    type: string;
    _isFile: boolean;
} : T extends Blob ? {
    name: string;
    size: number;
    type: string;
    _isFile: boolean;
} : T extends (infer U)[] ? Sanitized$1<U>[] : T extends object ? {
    [K in keyof T]: Sanitized$1<T[K]>;
} : T;
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
type ResponseWithError = {
    error: any;
    message?: string;
};
type ExtractDataType<R> = R extends {
    ok: true;
    data: infer D;
} ? D : R extends {
    data: infer D;
} ? D : R extends ResponseWithError ? never : R;
type ResponsePattern<R> = {
    ok?: true;
    message?: string;
    data: R;
} | {
    ok?: false;
    message?: string;
    error: Error;
} | R;
declare function withFormTransform<T, R>(serverAction: (data: T) => Promise<ResponsePattern<R>> | ResponsePattern<R>): (formData: FormData) => Promise<ServerActionResponse<Sanitized$1<ExtractDataType<R>>>>;

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
declare const serverActionRequest: <T>(action: (formData: FormData) => Promise<ServerActionResponse<T>>, data: FormData | Record<string, any>) => Promise<ServerActionResponse<T>>;

/**
 * Sanitizes data to ensure client-server compatibility by converting
 * non-serializable types to safe formats
 *
 * @param data - Any data to sanitize
 * @returns Sanitized data safe for JSON serialization
 */
declare function sanitizeForTransport(data: any): any;
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
declare function createSuccessResponse<T>(data: T, message?: string): ServerActionResponse<T>;
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
declare function createErrorResponse(error: Error | string, message?: string): ServerActionResponse<never>;
/**
 * Type helper that transforms types to their sanitized equivalents
 *
 * - Date → string (ISO format)
 * - File/Blob → metadata object
 * - Arrays and nested objects are processed recursively
 *
 * @template T The original type to be sanitized
 */
type Sanitized<T> = T extends Date ? string : T extends File ? {
    name: string;
    size: number;
    type: string;
    _isFile: boolean;
} : T extends Blob ? {
    name: string;
    size: number;
    type: string;
    _isFile: boolean;
} : T extends (infer U)[] ? Sanitized<U>[] : T extends object ? {
    [K in keyof T]: Sanitized<T[K]>;
} : T;

/**
 * Advanced React hook for Server Actions with SWR-like functionality
 *
 * Provides caching, deduplication, optimistic updates, and automatic revalidation
 * for React Server Actions. Similar to SWR but specifically designed for server actions.
 *
 * @template T - The type of data returned by the server action
 *
 * @param options - Configuration object for the hook behavior
 * @returns Object with state and functions to manage the server action
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data: user, execute, loading, error } = useSAR({
 *     action: getUserAction,
 *     condition: !!userId,
 *     cacheTime: 5000,
 *     revalidateOnFocus: true,
 *     onSuccess: (user) => toast.success(`Welcome ${user.name}!`)
 *   });
 *
 *   useEffect(() => {
 *     execute({ userId });
 *   }, [userId]);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error error={error} />;
 *   if (!user) return <NotFound />;
 *
 *   return <div>Hello {user.name}!</div>;
 * }
 * ```
 */
declare function useSAR<T>({ action: serverAction, condition, cacheTime, revalidateOnMount, revalidateOnFocus, dedupingInterval, executeOnMount, initialExecuteData, onSuccess, onError, }: SAROptions<T>): SARReturn<T>;

export { type OptimisticUpdate, type SAROptions, type SARReturn, type Sanitized, type ServerActionResponse, createErrorResponse, createSuccessResponse, formDataToObject, objectToFormData, sanitizeForTransport, serverActionRequest, useSAR, withFormTransform };
