import { goToConsent, goToLogin } from "@/lib/api";

/** Uniloom's API answer: `{ success, message, data }`, or an error with a `code`. */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  code?: string;
}

/**
 * A failed API call, as TanStack Query hands it to `onError` / `error`: the server's
 * message (for people), its stable code (for code: `err.code === "blocking_cycle"`) and
 * the HTTP status.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The fetch every generated hook uses (Orval's mutator), as in Unishare. Success returns
 * `{ data, message, status, headers }`: queries take `.data` with `select: (r) => r.data`,
 * mutations can show `.message`. A 401 sends the user to /login, a `403 consent_required`
 * to /consent; both come back to the same page.
 */
export const customFetch = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  }).catch(() => {
    // Offline or the API is down: still an ApiError, so every `error` has the same shape.
    throw new ApiError(
      "Couldn't reach Uniloom. Check your connection and try again.",
      0,
      "network_error",
    );
  });

  const json = (await response.json().catch(() => ({}))) as Partial<
    ApiResponse<unknown>
  >;

  if (!response.ok) {
    if (response.status === 401) goToLogin();
    if (response.status === 403 && json.code === "consent_required")
      goToConsent();
    throw new ApiError(
      json.message ?? "Something went wrong",
      response.status,
      json.code ?? "unknown",
    );
  }

  return {
    data: json.data,
    message: json.message,
    status: response.status,
    headers: response.headers,
  } as unknown as T;
};

/** Orval types every hook's error with this, so `error.message` needs no cast. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Orval passes a type; ours is always ApiError
export type ErrorType<_Error> = ApiError;

/**
 * The API's success message ("UL-12 created") from a mutation's response. customFetch
 * returns it, but Orval's generated types only know `data` and `status`.
 */
export const successMessage = (response: { data: unknown }) => {
  return (response as { message?: string }).message ?? "Done";
};
