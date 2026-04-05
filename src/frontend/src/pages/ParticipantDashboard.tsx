import WellbeingScoreCard from "../components/WellbeingScoreCard";
import TrendChart from "../components/TrendChart";
import type { TrendPoint, Insight, WellbeingDomain } from "../types";

// ---------- placeholder data ----------

const currentScore = {
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

const trendData: TrendPoint[] = Array.from({ length: 14 }, (_, i) => {
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

const insights: Insight[] = [
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

const badgeColor: Record<Insight["type"], string> = {
  strength: "bg-wellab-100 text-wellab-800",
  "growth-area": "bg-amber-100 text-amber-800",
  pattern: "bg-blue-100 text-blue-800",
};

// ---------- component ----------

export default function ParticipantDashboard() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Participant Experience</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WellbeingScoreCard
          overall={currentScore.overall}
          domains={currentScore.domains}
          confidence={currentScore.confidence}
        />

        <div className="lg:col-span-2">
          <TrendChart data={trendData} title="Your 2-Week Trend" />
        </div>
      </div>

      {/* Strength-framed insights */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Strength-Framed Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className="bg-white rounded-xl shadow-sm border p-5 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor[ins.type]}`}
                >
                  {ins.type === "growth-area" ? "growth area" : ins.type}
                </span>
                <span className="text-xs text-gray-400 capitalize">
                  {ins.domain}
                </span>
              </div>
              <h3 className="font-medium text-gray-900">{ins.title}</h3>
              <p className="text-sm text-gray-600">{ins.description}</p>
              <p className="text-xs text-gray-400 mt-auto">
                Confidence: {Math.round(ins.confidence * 100)}%
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
