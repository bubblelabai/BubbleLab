import { useQuery } from '@tanstack/react-query';

interface GitHubStarsResult {
  stargazers_count: number;
}

interface UseGitHubStarsResult {
  data: number | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch GitHub repository stars from the GitHub API
 *
 * @returns GitHub stars data and loading state
 */
export function useGitHubStars(): UseGitHubStarsResult {
  const query = useQuery({
    queryKey: ['githubStars'],
    queryFn: async () => {
      const response = await fetch(
        'https://api.github.com/repos/bubblelabai/BubbleLab'
      );
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      const data: GitHubStarsResult = await response.json();
      return data.stargazers_count;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - stars don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2, // Retry twice on failure
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
