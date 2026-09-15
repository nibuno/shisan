import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
