import type { InterventionROI, RiskBucket } from "../types";

// ---------- placeholder data ----------

const riskBuckets: RiskBucket[] = [
  { label: "Low risk", count: 412, percentage: 48, color: "bg-wellab-400" },
  { label: "Moderate", count: 267, percentage: 31, color: "bg-yellow-400" },
  { label: "Elevated", count: 118, percentage: 14, color: "bg-orange-400" },
  { label: "High risk", count: 55, percentage: 7, color: "bg-red-400" },
];

const interventions: InterventionROI[] = [
  { interventionName: "Community Wellness Hubs", targetPopulation: "Urban Adults", costPerParticipant: 320, wellbeingGain: 8.4, roi: 3.2 },
  { interventionName: "Digital CBT Program", targetPopulation: "College Students", costPerParticipant: 85, wellbeingGain: 5.1, roi: 5.8 },
  { interventionName: "Social Prescribing", targetPopulation: "Older Adults 65+", costPerParticipant: 210, wellbeingGain: 7.2, roi: 4.1 },
  { interventionName: "Workplace Flexibility", targetPopulation: "Working Adults", costPerParticipant: 0, wellbeingGain: 4.8, roi: 12.0 },
  { interventionName: "Green Space Access", targetPopulation: "Rural Community", costPerParticipant: 150, wellbeingGain: 3.9, roi: 2.7 },
];

const regionData = [
  { region: "North District", population: 42000, avgWellbeing: 71, trend: "up" },
  { region: "Central Metro", population: 128000, avgWellbeing: 64, trend: "flat" },
  { region: "East Suburbs", population: 67000, avgWellbeing: 73, trend: "up" },
  { region: "South Valley", population: 31000, avgWellbeing: 58, trend: "down" },
  { region: "West Coast", population: 54000, avgWellbeing: 69, trend: "flat" },
];

const trendArrow: Record<string, string> = {
  up: "text-wellab-600",
  flat: "text-gray-400",
  down: "text-red-500",
};
const trendSymbol: Record<string, string> = {
  up: "^",
  flat: "-",
  down: "v",
};

// ---------- component ----------

export default function PolicyDashboard() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Policy Dashboard</h1>

      {/* Population wellbeing map placeholder */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          Population Wellbeing by Region
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Region</th>
                <th className="py-2 pr-4 font-medium">Population</th>
                <th className="py-2 pr-4 font-medium">Avg Wellbeing</th>
                <th className="py-2 pr-4 font-medium">Trend</th>
                <th className="py-2 font-medium">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {regionData.map((r) => (
                <tr key={r.region} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium text-gray-900">
                    {r.region}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {r.population.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-semibold">{r.avgWellbeing}</span>
                    <span className="text-gray-400"> / 100</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`font-bold ${trendArrow[r.trend]}`}>
                      {trendSymbol[r.trend]}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-wellab-500 h-2.5 rounded-full"
                        style={{ width: `${r.avgWellbeing}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Map visualization will render here once a mapping library is
          integrated (e.g., Mapbox GL, Leaflet).
        </p>
      </section>

      {/* Risk distribution */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          Risk Distribution
        </h2>
        <div className="flex gap-1 h-10 rounded-lg overflow-hidden mb-4">
          {riskBuckets.map((b) => (
            <div
              key={b.label}
              className={`${b.color} flex items-center justify-center text-xs font-medium text-white`}
              style={{ width: `${b.percentage}%` }}
            >
              {b.percentage}%
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {riskBuckets.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-sm">
              <span className={`w-3 h-3 rounded-full ${b.color}`} />
              <span className="text-gray-600">
                {b.label}: {b.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Intervention ROI table */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          Intervention ROI Analysis
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Intervention</th>
                <th className="py-2 pr-4 font-medium">Target Population</th>
                <th className="py-2 pr-4 font-medium text-right">
                  Cost / Person
                </th>
                <th className="py-2 pr-4 font-medium text-right">
                  Wellbeing Gain
                </th>
                <th className="py-2 font-medium text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {interventions.map((iv) => (
                <tr
                  key={iv.interventionName}
                  className="border-b last:border-0"
                >
                  <td className="py-3 pr-4 font-medium text-gray-900">
                    {iv.interventionName}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {iv.targetPopulation}
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-600">
                    {iv.costPerParticipant === 0
                      ? "Policy change"
                      : `$${iv.costPerParticipant}`}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-wellab-700">
                    +{iv.wellbeingGain}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`font-bold ${
                        iv.roi >= 5
                          ? "text-wellab-600"
                          : iv.roi >= 3
                            ? "text-yellow-600"
                            : "text-gray-600"
                      }`}
                    >
                      {iv.roi}x
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
