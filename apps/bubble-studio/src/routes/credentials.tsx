import { createFileRoute, redirect } from '@tanstack/react-router';
import { CredentialsPage } from '@/pages/CredentialsPage';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/env';

export const Route = createFileRoute('/credentials')({
  beforeLoad: () => {
    const { isSignedIn } = useAuth();
    if (!isSignedIn) {
      throw redirect({ to: '/new' });
    }
  },
  component: CredentialsRoute,
});

function CredentialsRoute() {
  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      <div className="flex-1 min-h-0">
        <CredentialsPage apiBaseUrl={API_BASE_URL} />
      </div>
    </div>
  );
}
