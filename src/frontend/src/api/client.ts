import type { ApiResponse } from "../types";

const BASE_URL = "/api";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // Domain-specific methods
  getParticipantScore(participantId: string) {
    return this.get<import("../types").WellbeingScore>(
      `/participants/${participantId}/score`
    );
  }

  getParticipantTrend(participantId: string, days = 30) {
    return this.get<import("../types").TrendPoint[]>(
      `/participants/${participantId}/trend?days=${days}`
    );
  }

  getParticipantInsights(participantId: string) {
    return this.get<import("../types").Insight[]>(
      `/participants/${participantId}/insights`
    );
  }

  getCohorts() {
    return this.get<import("../types").CohortSummary[]>("/cohorts");
  }

  getPopulationRisk() {
    return this.get<import("../types").RiskBucket[]>("/population/risk");
  }

  getInterventionROI() {
    return this.get<import("../types").InterventionROI[]>("/interventions/roi");
  }
}

export const apiClient = new ApiClient(BASE_URL);
export default apiClient;
