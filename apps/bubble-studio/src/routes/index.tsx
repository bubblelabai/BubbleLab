import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: IndexRoute,
});

function IndexRoute() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    navigate({
      to: isSignedIn ? '/home' : '/new',
      replace: true,
    });
  }, [isSignedIn, navigate]);

  return null;
}
