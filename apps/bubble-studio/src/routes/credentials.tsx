import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CredentialsPage } from '@/pages/CredentialsPage';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/env';

export const Route = createFileRoute('/credentials')({
  component: CredentialsRoute,
});

function CredentialsRoute() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  // Redirect if not signed in
  if (!isSignedIn) {
    // Open up sign in modal
    navigate({ to: '/home', search: { showSignIn: true }, replace: true });
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-card text-foreground">
      <div className="flex-1 min-h-0">
        <CredentialsPage apiBaseUrl={API_BASE_URL} />
      </div>
    </div>
  );
}
