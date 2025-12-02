// Browser-safe BubbleFactory that reads from bubbles.json metadata
// This avoids loading actual bubble implementations which have Node.js dependencies

import type {
  BubbleName,
  BubbleNodeType,
  CredentialType,
} from '@bubblelab/shared-schemas';

interface BubbleMetadataFromJSON {
  name: string;
  alias?: string;
  type: 'service' | 'tool' | 'workflow';
  shortDescription?: string;
  useCase?: string;
  inputSchema?: string;
  outputSchema?: string;
  requiredCredentials?: string[];
  className?: string; // Class name from factory (e.g., "AIAgentBubble")
}

interface ClassNameMapping {
  bubbleName: string;
  className: string;
  nodeType: string;
}

interface BubblesManifest {
  bubbles: BubbleMetadataFromJSON[];
  classNameMapping?: ClassNameMapping[];
}

// Create a constructor-like function that works with buildClassNameLookup
function createStubConstructor(
  className: string,
  bubbleName: BubbleName,
  nodeType: BubbleNodeType
): any {
  // Create a function with the correct name
  const Constructor = function () {};

  // Set the function name (works in most environments)
  try {
    Object.defineProperty(Constructor, 'name', {
      value: className,
      configurable: true,
    });
  } catch {
    // Fallback: use a different approach if defineProperty fails
    // The function will still work, but .name might not be set correctly
  }

  // Add static properties that BubbleClassWithMetadata expects
  (Constructor as any).bubbleName = bubbleName;
  (Constructor as any).type = nodeType;

  return Constructor;
}

export class BrowserBubbleFactory {
  private bubbleConstructors: any[] = []; // Constructor-like functions
  private bubblesMetadata: Map<BubbleName, BubbleMetadataFromJSON> = new Map();
  private classNameMapping: Map<
    BubbleName,
    { className: string; nodeType: BubbleNodeType }
  > = new Map();
  private initialized = false;

  async registerDefaults(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load bubbles.json from public directory
      const response = await fetch('/bubbles.json');
      if (!response.ok) {
        throw new Error(`Failed to load bubbles.json: ${response.status}`);
      }

      const data: BubblesManifest = await response.json();
      const bubblesMetadata: BubbleMetadataFromJSON[] = data.bubbles || [];
      const classNameMapping: ClassNameMapping[] = data.classNameMapping || [];

      // Build class name mapping
      for (const mapping of classNameMapping) {
        this.classNameMapping.set(mapping.bubbleName as BubbleName, {
          className: mapping.className,
          nodeType: mapping.nodeType as BubbleNodeType,
        });
      }

      // Create constructor-like functions for each bubble
      // Use classNameMapping if available, otherwise fall back to bubbles metadata
      const constructors: any[] = [];

      for (const metadata of bubblesMetadata) {
        const bubbleName = metadata.name as BubbleName;

        // Get class name from mapping or metadata, or generate it
        let className: string;
        let nodeType: BubbleNodeType;

        const mapping = this.classNameMapping.get(bubbleName);
        if (mapping) {
          className = mapping.className;
          nodeType = mapping.nodeType;
        } else if (metadata.className) {
          className = metadata.className;
          nodeType = metadata.type as BubbleNodeType;
        } else {
          // Fallback: generate class name from bubble name
          className =
            bubbleName
              .split('-')
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join('') + 'Bubble';
          nodeType = metadata.type as BubbleNodeType;
        }

        const Constructor = createStubConstructor(
          className,
          bubbleName,
          nodeType
        );
        constructors.push(Constructor);
      }

      this.bubbleConstructors = constructors;

      // Store metadata map for getMetadata
      bubblesMetadata.forEach((metadata) => {
        this.bubblesMetadata.set(metadata.name as BubbleName, metadata);
      });

      this.initialized = true;
      console.log(
        `[BrowserBubbleFactory] Loaded ${this.bubbleConstructors.length} bubbles from metadata`
      );
    } catch (error) {
      console.error(
        '[BrowserBubbleFactory] Failed to load bubbles.json:',
        error
      );
      throw error;
    }
  }

  getAll(): any[] {
    if (!this.initialized) {
      throw new Error(
        'BrowserBubbleFactory not initialized. Call registerDefaults() first.'
      );
    }
    return this.bubbleConstructors;
  }

  list(): BubbleName[] {
    return Array.from(this.bubblesMetadata.keys());
  }

  get(name: BubbleName): any | undefined {
    const mapping = this.classNameMapping.get(name);
    if (!mapping) return undefined;

    return this.bubbleConstructors.find(
      (ctor) => (ctor as any).bubbleName === name
    );
  }

  register(): void {
    // No-op in browser - bubbles are loaded from JSON
  }

  getMetadata(name: BubbleName) {
    if (!this.initialized) {
      throw new Error(
        'BrowserBubbleFactory not initialized. Call registerDefaults() first.'
      );
    }

    const metadata = this.bubblesMetadata.get(name);
    if (!metadata) {
      return undefined;
    }

    // Map bubbles.json fields to getMetadata return format
    return {
      bubbleDependenciesDetailed: undefined, // Not available in bubbles.json
      name: metadata.name as BubbleName,
      shortDescription: metadata.shortDescription || '',
      longDescription: metadata.useCase || metadata.shortDescription || '', // Use useCase as longDescription
      alias: metadata.alias,
      credentialOptions: (metadata.requiredCredentials ||
        []) as CredentialType[],
      bubbleDependencies: undefined, // Not available in bubbles.json
      schema: undefined, // Schema is a string in JSON, not a Zod object
      resultSchema: undefined, // Schema is a string in JSON, not a Zod object
      type: metadata.type as BubbleNodeType,
      params: undefined, // Cannot extract params from string schema
    };
  }
}
