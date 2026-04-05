import type { WellbeingDomain } from "../types";

interface WellbeingScoreCardProps {
  overall: number;
  domains?: Partial<Record<WellbeingDomain, number>>;
  confidence?: number;
  label?: string;
}

const domainColors: Record<WellbeingDomain, string> = {
  physical: "bg-blue-400",
  emotional: "bg-purple-400",
  social: "bg-pink-400",
  cognitive: "bg-indigo-400",
  environmental: "bg-green-400",
  occupational: "bg-yellow-400",
  spiritual: "bg-teal-400",
  financial: "bg-orange-400",
};

const domainLabels: Record<WellbeingDomain, string> = {
  physical: "Physical",
  emotional: "Emotional",
  social: "Social",
  cognitive: "Cognitive",
  environmental: "Environmental",
  occupational: "Occupational",
  spiritual: "Spiritual",
  financial: "Financial",
};

function scoreColor(score: number): string {
  if (score >= 75) return "text-wellab-600";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

export default function WellbeingScoreCard({
  overall,
  domains,
  confidence,
  label = "Your Wellbeing Today",
}: WellbeingScoreCardProps) {
  return (
    <article
      aria-label={`Wellbeing score: ${overall} out of 100`}
      className="bg-white rounded-xl shadow-sm border p-6"
    >
      <h3 className="text-sm font-medium text-gray-500 mb-1">{label}</h3>
      <div className="flex items-end gap-2 mb-4">
        <span
          className={`text-5xl font-bold ${scoreColor(overall)}`}
          aria-label={`Score: ${overall}`}
        >
          {overall}
        </span>
        <span className="text-gray-400 text-lg mb-1">/ 100</span>
      </div>
      {confidence !== undefined && (
        <p className="text-xs text-gray-400 mb-4">
          Confidence: {Math.round(confidence * 100)}%
        </p>
      )}
      {domains && (
        <div className="space-y-2">
          {(Object.entries(domains) as [WellbeingDomain, number][]).map(
            ([domain, value]) => (
              <div key={domain} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-24">
                  {domainLabels[domain]}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`${domainColors[domain]} h-2 rounded-full transition-all`}
                    style={{ width: `${value}%` }}
                    role="progressbar"
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${domainLabels[domain]}: ${value}%`}
                  />
                </div>
                <span className="text-xs text-gray-600 w-8 text-right">
                  {value}
                </span>
              </div>
            )
          )}
        </div>
      )}
    </article>
  );
}
