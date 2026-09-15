import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import NavBar from "./components/layout/NavBar";
import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import SnapshotsPage from "./pages/SnapshotsPage";
import LoginPage from "./pages/LoginPage";
import InvitePage from "./pages/InvitePage";

const ChartsPage = lazy(() => import("./pages/ChartsPage"));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <NavBar />
          <main className="main-content">
            <Suspense fallback={<div className="loading">読み込み中...</div>}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/invite/:token" element={<InvitePage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/snapshots" element={<SnapshotsPage />} />
                  <Route path="/charts" element={<ChartsPage />} />
                </Route>
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
