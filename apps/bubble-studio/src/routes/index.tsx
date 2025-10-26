import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { isSignedIn } = useAuth();

    throw redirect({
      to: isSignedIn ? '/home' : '/new',
    });
  },
});
