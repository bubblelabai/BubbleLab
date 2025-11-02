import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

interface IndexRouteSearch {
  prompt?: string;
}

export const Route = createFileRoute('/')({
  component: IndexRoute,
  validateSearch: (search: Record<string, unknown>): IndexRouteSearch => {
    return {
      prompt: typeof search.prompt === 'string' ? search.prompt : undefined,
    };
  },
});

function IndexRoute() {
  const navigate = useNavigate();
  const { prompt } = Route.useSearch();

  useEffect(() => {
    navigate({
      to: '/home',
      search: { prompt },
      replace: true,
    });
  }, [navigate, prompt]);

  return null;
}
