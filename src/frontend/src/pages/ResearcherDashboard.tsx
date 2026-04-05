import type { CohortSummary, WellbeingDomain } from "../types";

// ---------- placeholder data ----------

const cohorts: CohortSummary[] = [
  { cohortId: "c1", name: "Urban Adults 25-40", participantCount: 312, avgWellbeing: 71, dataCompleteness: 0.89 },
  { cohortId: "c2", name: "College Students", participantCount: 187, avgWellbeing: 64, dataCompleteness: 0.93 },
  { cohortId: "c3", name: "Older Adults 65+", participantCount: 145, avgWellbeing: 68, dataCompleteness: 0.76 },
  { cohortId: "c4", name: "Rural Community", participantCount: 98, avgWellbeing: 72, dataCompleteness: 0.81 },
];

const domains: WellbeingDomain[] = [
  "physical", "emotional", "social", "cognitive", "environmental",
];

// Synthetic coupling matrix (correlation-like values)
const couplingMatrix: number[][] = [
  [1.0, 0.42, 0.38, 0.55, 0.21],
  [0.42, 1.0, 0.67, 0.48, 0.31],
  [0.38, 0.67, 1.0, 0.34, 0.44],
  [0.55, 0.48, 0.34, 1.0, 0.27],
  [0.21, 0.31, 0.44, 0.27, 1.0],
];

function heatColor(v: number): string {
  if (v >= 0.8) return "bg-wellab-700 text-white";
  if (v >= 0.6) return "bg-wellab-500 text-white";
  if (v >= 0.4) return "bg-wellab-300 text-wellab-900";
  if (v >= 0.2) return "bg-wellab-100 text-wellab-800";
  return "bg-gray-100 text-gray-600";
}

const clusterLabels = [
  { id: 1, label: "Thriving", count: 214, color: "bg-wellab-500" },
  { id: 2, label: "Stable-moderate", count: 301, color: "bg-yellow-400" },
  { id: 3, label: "Declining", count: 128, color: "bg-orange-400" },
  { id: 4, label: "At-risk", count: 67, color: "bg-red-400" },
];

const qualityMetrics = [
  { label: "EMA response rate", value: "87%", status: "good" },
  { label: "Sensor uptime", value: "93%", status: "good" },
  { label: "Missing data (7d)", value: "4.2%", status: "good" },
  { label: "Outlier flags", value: "12", status: "warn" },
];

// ---------- component ----------

export default function ResearcherDashboard() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Researcher Dashboard</h1>

      {/* Cohort selector */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          Cohort Selector
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cohorts.map((c) => (
            <button
              key={c.cohortId}
              className="text-left border rounded-lg p-4 hover:border-wellab-400 hover:shadow transition-all"
            >
              <p className="font-medium text-gray-900">{c.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                n={c.participantCount} &middot; Avg {c.avgWellbeing}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-wellab-400 h-1.5 rounded-full"
                    style={{ width: `${c.dataCompleteness * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">
                  {Math.round(c.dataCompleteness * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coupling heatmap */}
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-sm font-medium text-gray-500 mb-4">
            Domain Coupling Heatmap
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th />
                  {domains.map((d) => (
                    <th key={d} className="px-2 py-1 capitalize font-medium text-gray-500">
                      {d.slice(0, 4)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {domains.map((rowD, ri) => (
                  <tr key={rowD}>
                    <td className="pr-2 py-1 capitalize font-medium text-gray-500 text-right">
                      {rowD.slice(0, 4)}
                    </td>
                    {couplingMatrix[ri].map((val, ci) => (
                      <td key={ci} className="px-1 py-1">
                        <div
                          className={`w-full text-center py-1 rounded ${heatColor(val)}`}
                        >
                          {val.toFixed(2)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Trajectory clusters */}
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-sm font-medium text-gray-500 mb-4">
            Trajectory Clusters
          </h2>
          <div className="space-y-3">
            {clusterLabels.map((cl) => {
              const total = clusterLabels.reduce((s, x) => s + x.count, 0);
              const pct = Math.round((cl.count / total) * 100);
              return (
                <div key={cl.id} className="flex items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-full ${cl.color} shrink-0`}
                  />
                  <span className="text-sm font-medium w-36">{cl.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div
                      className={`${cl.color} h-3 rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-20 text-right">
                    {cl.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Clusters derived from 30-day trajectory similarity (DTW + k-means).
          </p>
        </section>
      </div>

      {/* Data quality monitor */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          Data Quality Monitor
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {qualityMetrics.map((m) => (
            <div
              key={m.label}
              className="border rounded-lg p-4 flex flex-col items-center gap-1"
            >
              <span className="text-2xl font-bold text-gray-900">
                {m.value}
              </span>
              <span className="text-xs text-gray-500 text-center">
                {m.label}
              </span>
              <span
                className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  m.status === "good"
                    ? "bg-wellab-100 text-wellab-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
