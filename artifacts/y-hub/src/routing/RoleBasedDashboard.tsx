import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from '@/pages/Dashboard';
import StudentDashboard from '@/pages/StudentDashboard';

export function RoleBasedDashboard() {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-10 text-center">Loading Auth...</div>;

  if (role === 'instructor' || role === 'admin' || role === 'super_admin') {
    return <Dashboard />;
  }
  return <StudentDashboard />;
}
