import { Workspace } from '@/components/workspace';
import { requireOwner } from '@/lib/auth';
export default async function WorkspacePage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path[0] === 'admin') await requireOwner();
  return <Workspace route={path} />;
}
