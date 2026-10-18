import { useAuth } from '@/contexts/AuthContext';
import { WorkbookWorkspace } from '@/features/y-sheets';

export default function YSheetsPage() {
  const {user,role,profile,status} = useAuth();
  if (status !== 'authenticated' || !user || !role) return <div role="status" className="p-6">Y-Sheets requires an authenticated Y-Hub account.</div>;
  return <WorkbookWorkspace key={user.id} user={{id:user.id,name:profile?.full_name || user.email || 'Y-Hub User',email:user.email,role}} />;
}
