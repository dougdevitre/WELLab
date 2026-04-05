import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Spinner from "./components/ui/Spinner";

const ParticipantDashboard = lazy(
  () => import("./pages/ParticipantDashboard")
);
const ResearcherDashboard = lazy(
  () => import("./pages/ResearcherDashboard")
);
const PolicyDashboard = lazy(() => import("./pages/PolicyDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<ParticipantDashboard />} />
            <Route path="/researcher" element={<ResearcherDashboard />} />
            <Route path="/policy" element={<PolicyDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
