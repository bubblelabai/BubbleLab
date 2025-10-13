import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { ListBubblesTool } from '../dist/bubbles/tool-bubble/list-bubbles-tool.js';
import { GetBubbleDetailsTool } from '../dist/bubbles/tool-bubble/get-bubble-details-tool.js';
import { BUBBLE_CREDENTIAL_OPTIONS } from '@bubblelab/shared-schemas';

interface BubbleMetadata {
  name: string;
  alias?: string;
  type: string;
  shortDescription: string;
  longDescription?: string;
  useCase: string;
  inputSchema?: string;
  outputSchema: string;
  usageExample: string;
  requiredCredentials: string[];
}

interface BubblesManifest {
  version: string;
  generatedAt: string;
  totalCount: number;
  bubbles: BubbleMetadata[];
}

class BubbleMetadataBundler {
  private verbose = false;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  private log(message: string) {
    if (this.verbose) {
      console.log(`🔧 ${message}`);
    }
  }

  private error(message: string) {
    console.error(`❌ ${message}`);
  }

  private success(message: string) {
    console.log(`✅ ${message}`);
  }

  async generateBubbleManifest(outputPath: string): Promise<boolean> {
    this.log('Starting bubble metadata bundler...');

    try {
      // Step 1: Get list of all bubbles
      this.log('Fetching list of all bubbles...');
      const listTool = new ListBubblesTool({});
      const listResult = await listTool.action();

      if (!listResult.success) {
        this.error(`Failed to list bubbles: ${listResult.error}`);
        return false;
      }

      this.log(`Found ${listResult.data.totalCount} bubbles`);

      // Step 2: Get detailed info for each bubble
      this.log('Fetching detailed information for each bubble...');
      const bubbleMetadata: BubbleMetadata[] = [];

      for (const bubble of listResult.data.bubbles) {
        this.log(`Processing: ${bubble.name}...`);

        try {
          const detailsTool = new GetBubbleDetailsTool({
            bubbleName: bubble.name,
            includeInputSchema: true,
          });
          const detailsResult = await detailsTool.action();

          if (detailsResult.success) {
            // Get required credentials from the mapping
            const requiredCredentials =
              BUBBLE_CREDENTIAL_OPTIONS[
                bubble.name as keyof typeof BUBBLE_CREDENTIAL_OPTIONS
              ] || [];

            bubbleMetadata.push({
              name: bubble.name,
              alias: bubble.alias,
              type: bubble.type,
              shortDescription: bubble.shortDescription,
              useCase: bubble.useCase,
              inputSchema: detailsResult.data.inputSchema,
              outputSchema: detailsResult.data.outputSchema,
              usageExample: detailsResult.data.usageExample,
              requiredCredentials: requiredCredentials,
            });
          } else {
            this.error(
              `Failed to get details for ${bubble.name}: ${detailsResult.error}`
            );
            // Continue with other bubbles even if one fails
          }
        } catch (err) {
          this.error(`Error processing ${bubble.name}: ${err}`);
          // Continue with other bubbles
        }
      }

      // Step 3: Create manifest
      const manifest: BubblesManifest = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        totalCount: bubbleMetadata.length,
        bubbles: bubbleMetadata,
      };

      // Step 4: Ensure output directory exists
      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
        this.log(`Created output directory: ${outputDir}`);
      }

      // Step 5: Write the manifest
      const jsonContent = JSON.stringify(manifest, null, 2);
      writeFileSync(outputPath, jsonContent, 'utf8');

      this.success(`Bubble manifest created successfully: ${outputPath}`);

      // Show stats
      const sizeKB = (jsonContent.length / 1024).toFixed(1);
      console.log(
        `📊 Manifest stats: ${sizeKB}KB, ${bubbleMetadata.length} bubbles`
      );

      return true;
    } catch (error) {
      this.error(`Bubble manifest generation failed: ${error}`);
      return false;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const helpRequested = args.includes('--help') || args.includes('-h');

  if (helpRequested) {
    console.log(`
🚀 Bubble Metadata Bundler

Usage:
  bun run bundle:metadata [options]

Options:
  --output=<path>      Output path for manifest (auto-generated if not specified)
  --verbose, -v        Show verbose output
  --help, -h           Show this help message

Examples:
  bun run bundle:metadata
  bun run bundle:metadata --verbose
  bun run bundle:metadata --output=./custom/path/bubbles.json
`);
    process.exit(0);
  }

  // Parse arguments
  const outputArg = args.find((arg) => arg.startsWith('--output='));

  // Determine output path (running from within bubble-core)
  const packageRoot = resolve(process.cwd());
  const defaultOutput = join(packageRoot, 'dist', 'bubbles.json');
  const outputPath = outputArg?.split('=')[1] || defaultOutput;

  console.log('🚀 Generating Bubble Metadata Manifest');
  if (verbose) {
    console.log(`📄 Output path: ${outputPath}`);
  }

  const bundler = new BubbleMetadataBundler(verbose);
  const success = await bundler.generateBubbleManifest(outputPath);

  process.exit(success ? 0 : 1);
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { BubbleMetadataBundler };
