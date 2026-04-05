import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import ResearcherDashboard from "./pages/ResearcherDashboard";
import PolicyDashboard from "./pages/PolicyDashboard";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ParticipantDashboard />} />
        <Route path="/researcher" element={<ResearcherDashboard />} />
        <Route path="/policy" element={<PolicyDashboard />} />
      </Routes>
    </Layout>
  );
}

export default App;
