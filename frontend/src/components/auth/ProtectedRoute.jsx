import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="font-mono text-accent text-sm animate-pulse">raise</span>
      </div>
    );
  }

  return user ? children : <Navigate to="/" replace />;
}
