import WellbeingScoreCard from "../components/WellbeingScoreCard";
import TrendChart from "../components/TrendChart";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import SectionHeader from "../components/ui/SectionHeader";
import {
  useParticipantScore,
  useParticipantTrend,
  useParticipantInsights,
} from "../hooks/useParticipant";
import type { TrendPoint, Insight, WellbeingDomain } from "../types";

// ---------- placeholder data (used as fallback when API is unavailable) ----------

const fallbackScore = {
  overall: 74,
  domains: {
    physical: 82,
    emotional: 68,
    social: 79,
    cognitive: 71,
    environmental: 65,
  } as Partial<Record<WellbeingDomain, number>>,
  confidence: 0.87,
};

const fallbackTrendData: TrendPoint[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (13 - i));
  return {
    date: d.toISOString().slice(0, 10),
    overall: 68 + Math.round(Math.random() * 12),
    physical: 75 + Math.round(Math.random() * 10),
    emotional: 60 + Math.round(Math.random() * 15),
    social: 70 + Math.round(Math.random() * 14),
  };
});

const fallbackInsights: Insight[] = [
  {
    id: "1",
    title: "Strong social connections",
    description:
      "Your social wellbeing has been consistently above average this month. Keep investing in those relationships.",
    domain: "social",
    type: "strength",
    confidence: 0.91,
  },
  {
    id: "2",
    title: "Physical activity boost",
    description:
      "Your physical scores rose 8 points after increasing daily step count last week.",
    domain: "physical",
    type: "strength",
    confidence: 0.84,
  },
  {
    id: "3",
    title: "Sleep pattern emerging",
    description:
      "Emotional wellbeing tends to be higher on days following 7+ hours of sleep.",
    domain: "emotional",
    type: "pattern",
    confidence: 0.78,
  },
  {
    id: "4",
    title: "Room for growth in mindfulness",
    description:
      "Short guided breathing exercises could support your cognitive resilience.",
    domain: "cognitive",
    type: "growth-area",
    confidence: 0.72,
  },
];

const badgeColorMap: Record<Insight["type"], "green" | "amber" | "blue"> = {
  strength: "green",
  "growth-area": "amber",
  pattern: "blue",
};

// ---------- component ----------

const PARTICIPANT_ID = "demo-participant";

export default function ParticipantDashboard() {
  const scoreApi = useParticipantScore(PARTICIPANT_ID);
  const trendApi = useParticipantTrend(PARTICIPANT_ID, 14);
  const insightsApi = useParticipantInsights(PARTICIPANT_ID);

  // Use API data if available, otherwise fall back to placeholder
  const score = scoreApi.data ?? fallbackScore;
  const trendData = trendApi.data ?? fallbackTrendData;
  const insights = insightsApi.data ?? fallbackInsights;

  const isLoading = scoreApi.loading && trendApi.loading && insightsApi.loading;
  const hasError = scoreApi.error || trendApi.error || insightsApi.error;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Participant Experience</h1>

      {hasError && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-800">
              Could not load live data. Showing sample data instead.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                scoreApi.retry();
                trendApi.retry();
                insightsApi.retry();
              }}
              className="text-amber-800 hover:bg-amber-100 focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WellbeingScoreCard
          overall={score.overall}
          domains={
            "domains" in score
              ? (score.domains as Partial<Record<WellbeingDomain, number>>)
              : undefined
          }
          confidence={score.confidence}
        />

        <div className="lg:col-span-2">
          <TrendChart data={trendData} title="Your 2-Week Trend" />
        </div>
      </div>

      {/* Strength-framed insights */}
      <section>
        <SectionHeader title="Strength-Framed Insights" className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins) => (
            <Card key={ins.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge color={badgeColorMap[ins.type]}>
                  {ins.type === "growth-area" ? "growth area" : ins.type}
                </Badge>
                <span className="text-xs text-gray-400 capitalize">
                  {ins.domain}
                </span>
              </div>
              <h3 className="font-medium text-gray-900">{ins.title}</h3>
              <p className="text-sm text-gray-600">{ins.description}</p>
              <p className="text-xs text-gray-400 mt-auto">
                Confidence: {Math.round(ins.confidence * 100)}%
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
