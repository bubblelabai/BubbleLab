import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PricingPage } from '@/pages/PricingPage';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/pricing')({
  component: PricingRoute,
});

function PricingRoute() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  // Redirect if not signed in
  if (!isSignedIn) {
    // Open up sign in modal
    navigate({ to: '/home', search: { showSignIn: true }, replace: true });
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <PricingPage />
      </div>
    </div>
  );
}
