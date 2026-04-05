import { useApi } from "./useApi";
import apiClient from "../api/client";
import type { WellbeingScore, TrendPoint, Insight } from "../types";

export function useParticipantScore(participantId: string) {
  return useApi<WellbeingScore>(
    async (signal) => {
      const response = await apiClient.getParticipantScore(participantId, signal);
      return response.data;
    },
    [participantId]
  );
}

export function useParticipantTrend(participantId: string, days = 30) {
  return useApi<TrendPoint[]>(
    async (signal) => {
      const response = await apiClient.getParticipantTrend(participantId, days, signal);
      return response.data;
    },
    [participantId, days]
  );
}

export function useParticipantInsights(participantId: string) {
  return useApi<Insight[]>(
    async (signal) => {
      const response = await apiClient.getParticipantInsights(participantId, signal);
      return response.data;
    },
    [participantId]
  );
}
