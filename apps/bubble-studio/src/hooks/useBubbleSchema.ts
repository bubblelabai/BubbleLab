import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Bubble definition from bubbles.json with JSON Schema support
 */
export interface BubbleSchemaDefinition {
  name: string;
  alias: string;
  type: string;
  shortDescription: string;
  useCase: string;
  inputSchema: string;
  outputSchema: string;
  usageExample: string;
  requiredCredentials: string[];
  /** JSON Schema for input parameters */
  inputJsonSchema?: JsonSchema;
  /** JSON Schema for output */
  outputJsonSchema?: JsonSchema;
}

/**
 * JSON Schema type definition for bubble schemas
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  enum?: (string | number | boolean | null)[];
  const?: unknown;
  default?: unknown;
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  title?: string;
  $ref?: string;
  [key: string]: unknown;
}

interface BubblesData {
  version: string;
  generatedAt: string;
  totalCount: number;
  bubbles: BubbleSchemaDefinition[];
}

/**
 * Query key for bubbles.json data
 */
const BUBBLES_QUERY_KEY = ['bubbles-schema'] as const;

/**
 * Fetch bubbles.json data
 */
async function fetchBubblesData(): Promise<BubblesData> {
  const response = await fetch('/bubbles.json');
  if (!response.ok) {
    throw new Error('Failed to load bubbles.json');
  }
  return response.json();
}

/**
 * Hook to access the full bubbles data with caching
 */
export function useBubblesData() {
  return useQuery<BubblesData>({
    queryKey: BUBBLES_QUERY_KEY,
    queryFn: fetchBubblesData,
    staleTime: 1000 * 60 * 60, // 1 hour - bubbles.json rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

/**
 * Hook to access bubble schema by name
 * Returns the inputJsonSchema for a specific bubble
 */
export function useBubbleSchema(bubbleName: string | undefined): {
  schema: JsonSchema | undefined;
  bubbleDefinition: BubbleSchemaDefinition | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useBubblesData();

  const result = useMemo(() => {
    if (!bubbleName || !data?.bubbles) {
      return { schema: undefined, bubbleDefinition: undefined };
    }

    const bubbleDefinition = data.bubbles.find(
      (b) => b.name === bubbleName || b.alias === bubbleName
    );

    return {
      schema: bubbleDefinition?.inputJsonSchema as JsonSchema | undefined,
      bubbleDefinition,
    };
  }, [bubbleName, data?.bubbles]);

  return {
    ...result,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get all bubble definitions (for listing/searching)
 */
export function useBubbleDefinitions(): {
  bubbles: BubbleSchemaDefinition[];
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useBubblesData();

  return {
    bubbles: data?.bubbles ?? [],
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Get bubble schema by name from cached data (non-reactive)
 * Useful for imperative code that doesn't need reactivity
 */
export function getBubbleSchemaFromCache(
  bubbleName: string,
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>
): JsonSchema | undefined {
  const data = queryClient.getQueryData<BubblesData>(BUBBLES_QUERY_KEY);
  if (!data?.bubbles) return undefined;

  const bubbleDefinition = data.bubbles.find(
    (b) => b.name === bubbleName || b.alias === bubbleName
  );

  return bubbleDefinition?.inputJsonSchema as JsonSchema | undefined;
}
