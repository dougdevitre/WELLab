import type {
  ApiResponse,
  WellbeingScore,
  TrendPoint,
  Insight,
  CohortSummary,
  RiskBucket,
  InterventionROI,
} from "../types";

const BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_API_BASE_URL) ||
  "/api";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem("wellab_auth");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.token ?? null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        DEFAULT_TIMEOUT_MS
      );

      // Forward external abort to our controller
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timeoutId);
          throw new DOMException("Aborted", "AbortError");
        }
        signal.addEventListener(
          "abort",
          () => controller.abort(),
          { once: true }
        );
      }

      try {
        const result = await fn(controller.signal);
        clearTimeout(timeoutId);
        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: unknown) {
      lastError = err;

      // Do not retry abort errors or client errors (4xx)
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // Only retry on network/server errors, not 4xx
      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    externalSignal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    return withRetry(async (signal) => {
      const url = `${this.baseUrl}${endpoint}`;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      const token = getStoredToken();
      if (token) {
        (headers as Record<string, string>)["Authorization"] =
          `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        const err = new Error(
          error.message || `Request failed: ${response.status}`
        );
        // Attach status for retry logic
        (err as Error & { status?: number }).status = response.status;
        throw err;
      }

      return response.json();
    }, externalSignal);
  }

  async get<T>(
    endpoint: string,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" }, signal);
  }

  async post<T>(
    endpoint: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      { method: "POST", body: JSON.stringify(body) },
      signal
    );
  }

  async put<T>(
    endpoint: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      { method: "PUT", body: JSON.stringify(body) },
      signal
    );
  }

  async delete<T>(
    endpoint: string,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" }, signal);
  }

  // Domain-specific methods
  getParticipantScore(participantId: string, signal?: AbortSignal) {
    return this.get<WellbeingScore>(
      `/participants/${participantId}/score`,
      signal
    );
  }

  getParticipantTrend(
    participantId: string,
    days = 30,
    signal?: AbortSignal
  ) {
    return this.get<TrendPoint[]>(
      `/participants/${participantId}/trend?days=${days}`,
      signal
    );
  }

  getParticipantInsights(participantId: string, signal?: AbortSignal) {
    return this.get<Insight[]>(
      `/participants/${participantId}/insights`,
      signal
    );
  }

  getCohorts(signal?: AbortSignal) {
    return this.get<CohortSummary[]>("/cohorts", signal);
  }

  getPopulationRisk(signal?: AbortSignal) {
    return this.get<RiskBucket[]>("/population/risk", signal);
  }

  getInterventionROI(signal?: AbortSignal) {
    return this.get<InterventionROI[]>("/interventions/roi", signal);
  }
}

export const apiClient = new ApiClient(BASE_URL);
export default apiClient;
