import { useQuery } from '@tanstack/react-query';

interface GitHubRepoResponse {
  stargazers_count: number;
  full_name: string;
  description: string;
}

/**
 * Hook to fetch GitHub star count for a repository
 * Uses React Query for caching and automatic refetching
 */
export function useGitHubStars(repo = 'bubblelabai/BubbleLab') {
  const query = useQuery({
    queryKey: ['githubStars', repo],
    queryFn: async () => {
      const response = await fetch(`https://api.github.com/repos/${repo}`);
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub stars');
      }
      return response.json() as Promise<GitHubRepoResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - stars don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });

  return {
    starCount: query.data?.stargazers_count ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
