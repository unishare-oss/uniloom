import { goToConsent } from "@/lib/api";

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
 * mutations can show `.message`. A `403 consent_required` sends the user to /consent.
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
  });

  const json = (await response.json().catch(() => ({}))) as Partial<
    ApiResponse<unknown>
  >;

  if (!response.ok) {
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
