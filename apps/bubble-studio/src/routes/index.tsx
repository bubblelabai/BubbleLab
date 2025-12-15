import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

interface IndexRouteSearch {
  prompt?: string;
  ref?: string;
}

export const Route = createFileRoute('/')({
  component: IndexRoute,
  validateSearch: (search: Record<string, unknown>): IndexRouteSearch => {
    return {
      prompt: typeof search.prompt === 'string' ? search.prompt : undefined,
      ref: typeof search.ref === 'string' ? search.ref : undefined,
    };
  },
});

function IndexRoute() {
  const navigate = useNavigate();
  const { prompt, ref } = Route.useSearch();

  useEffect(() => {
    navigate({
      to: '/home',
      search: { prompt, ref },
      replace: true,
    });
  }, [navigate, prompt, ref]);

  return null;
}
