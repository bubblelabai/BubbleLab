import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname, resolve, extname } from 'path';

class ManualTypeBundler {
  private verbose = false;
  private processedFiles = new Set<string>();
  private typeDefinitions = new Map<string, string>();
  private sharedSchemasBundle: string | null = null;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  // Bundle shared-schemas package separately
  private async bundleSharedSchemas(basePath: string): Promise<string> {
    if (this.sharedSchemasBundle) {
      return this.sharedSchemasBundle;
    }

    this.log('Bundling @bubblelab/shared-schemas...');
    const sharedSchemasPath = resolve(
      basePath,
      '../../bubble-shared-schemas/dist/index.d.ts'
    );

    if (!existsSync(sharedSchemasPath)) {
      this.log('Warning: shared-schemas not found, skipping');
      return '';
    }

    // Create a separate bundler instance to avoid conflicts
    const sharedSchemasDist = dirname(sharedSchemasPath);
    const content = await this.processFile(
      sharedSchemasPath,
      sharedSchemasDist
    );

    this.sharedSchemasBundle = `\n/* Inlined types from @bubblelab/shared-schemas */\n\n${content}\n`;

    const hasBubbleOpResult = content.includes('BubbleOperationResult');
    const hasInterface = content.includes('interface BubbleOperationResult');
    console.log(
      '[DEBUG] Shared-schemas content has BubbleOperationResult:',
      hasBubbleOpResult
    );
    console.log(
      '[DEBUG] Shared-schemas content has interface definition:',
      hasInterface
    );

    // Find where BubbleOperationResult appears
    const index = content.indexOf('BubbleOperationResult');
    if (index > -1) {
      console.log(
        '[DEBUG] BubbleOperationResult context:',
        content.substring(Math.max(0, index - 100), index + 200)
      );
    }

    this.log(
      `Bundled shared-schemas: ${this.sharedSchemasBundle.length} chars`
    );
    return this.sharedSchemasBundle;
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

  async bundlePackage(
    packageName: string,
    packagePath: string,
    outputPath: string
  ): Promise<boolean> {
    this.log(`Starting manual bundle for ${packageName}...`);

    // Find the main .d.ts file
    const mainDtsPath = join(packagePath, 'dist', 'index.d.ts');
    if (!existsSync(mainDtsPath)) {
      this.error(`Main declaration file not found: ${mainDtsPath}`);
      return false;
    }

    // Reset state
    this.processedFiles.clear();
    this.typeDefinitions.clear();

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
      this.log(`Created output directory: ${outputDir}`);
    }

    try {
      // Recursively process all .d.ts files in the dist directory
      const distPath = join(packagePath, 'dist');
      this.log(`Scanning directory: ${distPath}`);

      await this.processDirectory(distPath, distPath);

      // Process the main entry point to get the correct export structure
      const mainContent = await this.processFile(mainDtsPath, distPath);

      // Build the final bundle
      const bundledContent = await this.buildBundle(
        packageName,
        mainContent,
        distPath
      );

      // Write the final bundle
      writeFileSync(outputPath, bundledContent);

      this.success(`Manual bundle created successfully: ${outputPath}`);

      // Show bundle stats
      const sizeKB = (bundledContent.length / 1024).toFixed(1);
      const lineCount = bundledContent.split('\n').length;
      console.log(`📊 Bundle stats: ${sizeKB}KB, ${lineCount} lines`);
      console.log(`📁 Processed ${this.processedFiles.size} files`);

      return true;
    } catch (error) {
      this.error(`Manual bundle failed: ${error}`);
      return false;
    }
  }

  private async processDirectory(
    dirPath: string,
    basePath: string
  ): Promise<void> {
    const items = readdirSync(dirPath);

    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        await this.processDirectory(fullPath, basePath);
      } else if (extname(item) === '.ts' && item.endsWith('.d.ts')) {
        await this.processFile(fullPath, basePath);
      }
    }
  }

  private async processFile(
    filePath: string,
    basePath: string
  ): Promise<string> {
    // Use absolute path as cache key to avoid conflicts
    const cacheKey = filePath;

    console.log(
      `[DEBUG] Cache check - filePath: ${filePath}, cached: ${this.processedFiles.has(cacheKey)}`
    );

    if (this.processedFiles.has(cacheKey)) {
      console.log(`[DEBUG] Returning cached content for: ${filePath}`);
      return this.typeDefinitions.get(cacheKey) || '';
    }

    const relativePath = filePath.replace(basePath + '/', '');

    this.log(`Processing: ${relativePath}`);
    console.log(`[DEBUG] Processing file: ${filePath}`);
    this.processedFiles.add(cacheKey);

    let content = readFileSync(filePath, 'utf8');
    console.log(
      `[DEBUG] File content length: ${content.length}, first 200 chars:`,
      content.substring(0, 200)
    );

    // Remove source map comments
    content = content.replace(/\/\/# sourceMappingURL=.*$/gm, '');

    // Process imports and replace with actual content
    content = await this.processImports(content, dirname(filePath), basePath);

    // Store the processed content
    this.typeDefinitions.set(cacheKey, content);

    return content;
  }

  private async processImports(
    content: string,
    currentDir: string,
    basePath: string
  ): Promise<string> {
    // More comprehensive regex patterns to catch all import/export variations
    const allImportExportRegex =
      /^((?:export|import)\s+.*?from\s+['"]([^'"]+)['"];?)$/gm;

    let processedContent = content;
    const imports: string[] = [];

    // Find all import/export statements
    let match;
    while ((match = allImportExportRegex.exec(content)) !== null) {
      imports.push(match[0]);
    }

    console.log(`[DEBUG] Found ${imports.length} imports in ${currentDir}`);

    // Process each import
    for (const importStatement of imports) {
      const pathMatch = importStatement.match(/['"]([^'"]+)['"]/);
      if (!pathMatch) continue;

      const importPath = pathMatch[1];

      // Skip external dependencies
      if (!importPath.startsWith('.')) {
        // Remove all external imports (zod, shared-schemas, etc)
        // shared-schemas will be bundled separately and prepended
        processedContent = processedContent.replace(importStatement, '');
        continue;
      }

      // Resolve relative path
      let resolvedPath = resolve(currentDir, importPath);

      // Add .d.ts if it's missing
      if (!resolvedPath.endsWith('.d.ts')) {
        if (resolvedPath.endsWith('.js')) {
          resolvedPath = resolvedPath.replace('.js', '.d.ts');
        } else {
          resolvedPath += '.d.ts';
        }
      }

      // Check if file exists
      if (existsSync(resolvedPath)) {
        console.log(`[DEBUG] Inlining file: ${resolvedPath}`);
        // Process the imported file
        const importedContent = await this.processFile(resolvedPath, basePath);

        // Replace ALL export/import statements with actual inlined content
        processedContent = processedContent.replace(
          importStatement,
          `\n// Inlined from ${importPath}\n${importedContent}\n`
        );
      } else {
        console.log(`[DEBUG] WARNING: Could not find file: ${resolvedPath}`);
        this.log(`Warning: Could not find imported file: ${resolvedPath}`);
      }
    }

    return processedContent;
  }

  private async buildBundle(
    packageName: string,
    mainContent: string,
    basePath: string
  ): Promise<string> {
    this.log('Building final bundle...');

    // Bundle shared-schemas first
    console.log(
      '[DEBUG] About to bundle shared-schemas from basePath:',
      basePath
    );
    const sharedSchemasContent = await this.bundleSharedSchemas(basePath);
    console.log(
      '[DEBUG] Bundled shared-schemas, length:',
      sharedSchemasContent.length
    );

    const header = `/**
 * Self-contained TypeScript declarations for ${packageName}
 * Generated for Monaco Editor compatibility using Manual Bundler
 * 
 * This file includes all type definitions needed for full IntelliSense support
 * without external dependencies.
 * 
 * Generated with @bubblelab/type-bundler
 */

`;

    const zodTypes = `
// ============================================================================
// Comprehensive Zod Types for Monaco Editor
// ============================================================================

declare namespace z {
  interface ZodRawShape { [k: string]: ZodTypeAny; }
  type UnknownKeysParam = 'passthrough' | 'strict' | 'strip';

  interface ZodTypeAny { _type: any; _output: any; _input: any; _def: any; }

  interface ZodSchema<Output = any, Def = any, Input = Output> extends ZodTypeAny {
    _output: Output;
    _input: Input;
    _def: Def;
  }

  // Primitives
  interface ZodString extends ZodSchema<string, any, string> {}
  interface ZodNumber extends ZodSchema<number, any, number> {}
  interface ZodBoolean extends ZodSchema<boolean, any, boolean> {}
  interface ZodUndefined extends ZodSchema<undefined, any, undefined> {}
  interface ZodNull extends ZodSchema<null, any, null> {}
  interface ZodLiteral<T extends string | number | boolean | null>
    extends ZodSchema<T, any, T> {}

  // Collections
  interface ZodArray<T extends ZodTypeAny>
    extends ZodSchema<output<T>[], any, input<T>[]> {}
  interface ZodEnum<T extends readonly [string, ...string[]]>
    extends ZodSchema<T[number], any, T[number]> {}
  interface ZodNativeEnum<T extends Record<string, string | number>>
    extends ZodSchema<T[keyof T], any, T[keyof T]> {}
  interface ZodRecord<K extends ZodTypeAny = ZodString, V extends ZodTypeAny = ZodTypeAny>
    extends ZodSchema<Record<output<K>, output<V>>, any, Record<input<K>, input<V>>> {}

  // Modifiers
  interface ZodOptional<T extends ZodTypeAny>
    extends ZodSchema<output<T> | undefined, any, input<T> | undefined> {}
  interface ZodNullable<T extends ZodTypeAny>
    extends ZodSchema<output<T> | null, any, input<T> | null> {}
  interface ZodDefault<T extends ZodTypeAny>
    extends ZodSchema<output<T>, any, input<T> | undefined> {}

  // Objects
  interface ZodObject<
    T extends ZodRawShape,
    UnknownKeys extends UnknownKeysParam = 'strip',
    Catchall extends ZodTypeAny = ZodTypeAny,
    Output = { [k in keyof T]: output<T[k]> },
    Input = { [k in keyof T]: input<T[k]> }
  > extends ZodSchema<Output, any, Input> { _shape: T; }

  // Unions
  interface ZodUnion<TTypes extends readonly [ZodTypeAny, ...ZodTypeAny[]]>
    extends ZodSchema<TTypes[number]['_output'], any, TTypes[number]['_input']> {}
  interface ZodDiscriminatedUnion<
    Discriminator extends string,
    TTypes extends ZodObject<any, any, any>[]
  > extends ZodSchema<TTypes[number]['_output'], any, TTypes[number]['_input']> {}

  // Utility helpers
  type input<T extends ZodTypeAny> =
    T extends ZodObject<any, infer UK, any, any, infer Input>
      ? UK extends 'strict'
        ? Input & { [K in Exclude<string | number | symbol, keyof Input>]?: never }
        : Input
      : T['_input'];
  type output<T extends ZodTypeAny> = T['_output'];
  type infer<T extends ZodTypeAny> = T['_output'];
}

// ============================================================================
// ${packageName} Type Definitions
// ============================================================================

`;

    // Clean up the main content
    let cleanedContent = mainContent;

    // Remove remaining import statements
    cleanedContent = cleanedContent.replace(/^import.*from.*$/gm, '');

    // Convert Zod utility types to concrete interfaces for better Monaco support
    cleanedContent = this.expandZodTypes(cleanedContent);

    // Remove empty lines and clean up
    cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleanedContent = cleanedContent.trim();

    const moduleDeclaration = `

// ============================================================================
// Module Declaration for Monaco Editor
// ============================================================================

declare module '${packageName}' {
  export * from './${packageName.replace('@', '').replace('/', '-')}-manual-bundle';
}
`;

    const fullBundle =
      header +
      zodTypes +
      sharedSchemasContent +
      cleanedContent +
      moduleDeclaration;

    // Check if BubbleOperationResult is in the bundle before minification
    const hasBubbleOpResult = fullBundle.includes(
      'interface BubbleOperationResult'
    );
    console.log(
      '[DEBUG] Before minify - has BubbleOperationResult definition:',
      hasBubbleOpResult
    );
    console.log('[DEBUG] Full bundle length before minify:', fullBundle.length);

    // Minify the bundle for smaller size
    const minified = this.minifyBundle(fullBundle);

    const hasAfterMinify = minified.includes('interface BubbleOperationResult');
    console.log(
      '[DEBUG] After minify - has BubbleOperationResult definition:',
      hasAfterMinify
    );
    console.log('[DEBUG] Full bundle length after minify:', minified.length);

    return minified;
  }

  /**
   * Truncates long string literals that can break minification.
   * Specifically targets longDescription properties which contain markdown
   * that gets mangled by whitespace compression.
   */
  private truncateLongStrings(content: string): string {
    // Match longDescription with string value assignment
    // The .d.ts files have strings with escaped quotes inside, so we need to match
    // from 'longDescription = "' until the closing '";' while handling escaped quotes
    // Pattern: longDescription = "...content with \"escaped\" quotes...";
    const longDescPattern =
      /(static\s+readonly\s+longDescription\s*=\s*)"((?:[^"\\]|\\.)*)"/g;

    const result = content.replace(
      longDescPattern,
      (match, prefix: string, stringContent: string) => {
        // If the string content is long (>500 chars), truncate it
        if (stringContent.length > 500) {
          return `${prefix}"See bubble documentation for details"`;
        }
        return match;
      }
    );

    return result;
  }

  private minifyBundle(content: string): string {
    this.log('Minifying bundle...');

    // First, truncate long string literals that would break minification
    const minified = this.truncateLongStrings(content);

    // Remove comments (but keep header comment)
    const headerEnd = minified.indexOf(
      '// ============================================================================'
    );
    const header = minified.substring(0, headerEnd);
    const body = minified.substring(headerEnd);

    // Remove single line comments from body (but preserve type comments)
    const bodyMinified = body
      .replace(/\/\/(?!\s*@|\s*monaco-friendly).*$/gm, '') // Remove comments except @types and monaco-friendly
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive empty lines
      .replace(/^\s*$/gm, '') // Remove empty lines
      .replace(/\n{3,}/g, '\n\n') // Limit to max 2 consecutive newlines
      .replace(/\s+$/gm, '') // Remove trailing whitespace
      .replace(/{\s+/g, '{ ') // Compress opening braces
      .replace(/\s+}/g, ' }') // Compress closing braces
      .replace(/;\s+/g, '; ') // Compress semicolons
      .replace(/,\s+/g, ', ') // Compress commas
      .replace(/:\s+/g, ': ') // Compress colons
      .trim();

    const result = header + bodyMinified;

    const originalSize = (content.length / 1024).toFixed(1);
    const minifiedSize = (result.length / 1024).toFixed(1);
    const savings = (
      ((content.length - result.length) / content.length) *
      100
    ).toFixed(1);

    this.log(
      `Minification: ${originalSize}KB → ${minifiedSize}KB (${savings}% smaller)`
    );

    return result;
  }

  private expandZodTypes(content: string): string {
    // Find and expand z.input<> type aliases to concrete interfaces
    // This helps Monaco understand the types better for strict validation

    // Pattern to match: type SomeName = z.input<typeof SomeSchema>;
    const zodInputPattern = /type\s+(\w+)\s*=\s*z\.input<typeof\s+(\w+)>/g;

    let expandedContent = content;
    let match;

    while ((match = zodInputPattern.exec(content)) !== null) {
      const typeName = match[1];
      const schemaName = match[2];

      this.log(`Found Zod input type: ${typeName} from ${schemaName}`);

      // For now, keep the original type but add a comment for Monaco
      const replacement = `// Monaco-friendly type alias
type ${typeName} = z.input<typeof ${schemaName}>;`;

      expandedContent = expandedContent.replace(match[0], replacement);
    }

    return expandedContent;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const helpRequested = args.includes('--help') || args.includes('-h');

  if (helpRequested) {
    console.log(`
🚀 Manual TypeScript Declaration Bundler for Monaco Editor

Usage:
  bun run bundle:manual [options]

Options:
  --package=<name>     Package name to bundle (default: @bubblelab/bubble-core)
  --output=<path>      Output path for bundle (auto-generated if not specified)
  --verbose, -v        Show verbose output
  --help, -h           Show this help message

Examples:
  bun run bundle:manual --package=@bubblelab/bubble-core
  bun run bundle:manual --verbose
`);
    process.exit(0);
  }

  // Parse arguments
  const packageArg = args.find((arg) => arg.startsWith('--package='));
  const outputArg = args.find((arg) => arg.startsWith('--output='));

  const packageName = packageArg?.split('=')[1] || '@bubblelab/bubble-core';

  // Determine package path and output path (running from within bubble-core)
  const packageRoot = resolve(process.cwd());
  const packagePath = packageRoot;

  const defaultOutput = join(packageRoot, 'dist', 'bubble-bundle.d.ts');
  const outputPath = outputArg?.split('=')[1] || defaultOutput;

  console.log(
    `🚀 Bundling ${packageName} with Manual Bundler for Monaco Editor`
  );
  if (verbose) {
    console.log(`📂 Package path: ${packagePath}`);
    console.log(`📄 Output path: ${outputPath}`);
  }

  const bundler = new ManualTypeBundler(verbose);
  const success = await bundler.bundlePackage(
    packageName,
    packagePath,
    outputPath
  );

  process.exit(success ? 0 : 1);
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ManualTypeBundler };
