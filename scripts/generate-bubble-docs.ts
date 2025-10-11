/*
  Generate MDX docs for Service and Tool bubbles from @bubblelab/bubble-core
  - Parses Zod schemas via zod-to-json-schema
  - Emits MDX with Tabs/TabItem and schema-card markup
  - For new files: generates complete content with Quick Start and Operation Details
  - For existing files: only updates Operation Details section, preserves Quick Start

  Usage Examples:
    # Update all existing files (preserves Quick Start, updates Operation Details)
    pnpm tsx scripts/generate-bubble-docs.ts

    # Update specific bubbles only
    pnpm tsx scripts/generate-bubble-docs.ts --only slack,sql-query-tool

    # Force complete regeneration (overwrites Quick Start)
    pnpm tsx scripts/generate-bubble-docs.ts --force

    # Force regeneration of specific bubbles
    pnpm tsx scripts/generate-bubble-docs.ts --only slack --force

    # Generate docs for all service bubbles
    pnpm tsx scripts/generate-bubble-docs.ts --only slack,github,notion

    # Generate docs for all tool bubbles
    pnpm tsx scripts/generate-bubble-docs.ts --only sql-query-tool,web-crawl-tool,list-bubbles-tool
    
  Options:
    --only <bubble1,bubble2>  Only generate docs for specified bubbles
    --force, -f               Force regeneration of existing files (overwrites Quick Start)
*/

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// zod-to-json-schema left in place for future use, but we will directly
// introspect Zod types to produce detailed docs reliably
// import zodToJsonSchema, { type JsonSchema7Type } from 'zod-to-json-schema';

type AnyZod = any;
type JsonSchema7Type = any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCS_SERVICE_DIR = path.resolve(
  REPO_ROOT,
  'docs',
  'docs',
  'bubbles',
  'service-bubbles'
);
const DOCS_TOOL_DIR = path.resolve(
  REPO_ROOT,
  'docs',
  'docs',
  'bubbles',
  'tool-bubbles'
);

type BubbleClass = {
  new (...args: any[]): any;
  name: string;
  type: 'service' | 'tool' | 'workflow' | 'ui' | 'infra';
  bubbleName: string;
  shortDescription?: string;
  longDescription?: string;
  schema: AnyZod;
  resultSchema: AnyZod;
};

function isBubbleClass(maybe: any): maybe is BubbleClass {
  return (
    typeof maybe === 'function' &&
    typeof maybe.name === 'string' &&
    typeof maybe.schema === 'object' &&
    typeof maybe.resultSchema === 'object' &&
    typeof maybe.bubbleName === 'string' &&
    typeof maybe.type === 'string'
  );
}

function toTitleCase(input: string): string {
  return input
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getTypeStringFromJsonSchema(schema: any): string {
  // JsonSchema variant to human-readable type string
  if (!schema) return 'unknown';
  if (schema.const !== undefined) return `'${schema.const}'`;
  if (schema.enum) return schema.enum.map((v: any) => `'${v}'`).join(' | ');
  if (schema.type === 'array') {
    return `${getTypeStringFromJsonSchema(schema.items)}[]`;
  }
  if (schema.anyOf) {
    return schema.anyOf
      .map((s: any) => getTypeStringFromJsonSchema(s))
      .join(' | ');
  }
  if (schema.allOf) {
    return schema.allOf
      .map((s: any) => getTypeStringFromJsonSchema(s))
      .join(' & ');
  }
  if (schema.type) return String(schema.type);
  return 'unknown';
}

function resolveRef(root: any, ref: string): any | undefined {
  if (!ref?.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  let node = root as any;
  for (const p of parts) {
    if (node && typeof node === 'object') node = node[p];
    else return undefined;
  }
  if (node && node.$ref) return resolveRef(root, node.$ref);
  return node;
}

function mergeSchemas(schemas: any[]): any {
  const out: any = {};
  for (const s of schemas) {
    if (!s || typeof s !== 'object') continue;
    // Merge properties
    if (s.properties) {
      out.properties = { ...(out.properties || {}), ...s.properties };
    }
    // Merge required
    if (Array.isArray(s.required)) {
      const set = new Set([...(out.required || []), ...s.required]);
      out.required = Array.from(set);
    }
    // Carry description/type if helpful
    if (!out.type && s.type) out.type = s.type;
    if (!out.description && s.description) out.description = s.description;
  }
  return out;
}

function resolveSchema(json: any): any {
  if (!json || typeof json !== 'object') return json;
  const root = json;
  // Deref top-level $ref
  let node: any = json;
  if (node.$ref) node = resolveRef(root, node.$ref) || node;

  // If node has oneOf/anyOf, resolve each
  const variants = node.oneOf || node.anyOf;
  if (Array.isArray(variants)) {
    const resolved = variants.map((v: any) => {
      if (v.$ref) return resolveRef(root, v.$ref) || v;
      if (Array.isArray(v.allOf)) {
        const parts = v.allOf.map((p: any) =>
          p.$ref ? resolveRef(root, p.$ref) || p : p
        );
        return mergeSchemas(parts);
      }
      return v;
    });
    return { ...node, oneOf: resolved };
  }

  // If node has allOf, merge them
  if (Array.isArray(node.allOf)) {
    const parts = node.allOf.map((p: any) =>
      p.$ref ? resolveRef(root, p.$ref) || p : p
    );
    return mergeSchemas(parts);
  }

  return node;
}

function renderSchemaDlFromJson(
  properties: Record<string, any> | undefined,
  required: string[] | undefined
): string {
  if (!properties) return '';
  const req = new Set(required || []);
  const lines: string[] = [];
  for (const [key, prop] of Object.entries(properties)) {
    const typeStr = getTypeStringFromJsonSchema(prop as JsonSchema7Type);
    const requiredBadge = req.has(key)
      ? `<span style={{color:'#d32f2f',fontWeight:600}}>required</span>`
      : '';
    const desc = (prop as any).description || '';
    lines.push(
      `  <dt><code>${key}</code> <em>${typeStr}</em> ${requiredBadge}</dt>`
    );
    lines.push(`  <dd>${desc}</dd>`);
    lines.push('');
  }
  return lines.join('\n');
}

function getDiscriminatedOptions(zodSchema: any): any[] | undefined {
  const def = zodSchema && zodSchema._def;
  if (!def) return undefined;
  const maybeOpts = def.options || def._def?.options || def.optionsMap;
  if (!maybeOpts) return undefined;
  // Map of options
  if (typeof maybeOpts.values === 'function') {
    return Array.from(maybeOpts.values());
  }
  // Array of options
  if (Array.isArray(maybeOpts)) return maybeOpts;
  // Map-like object
  try {
    return Array.from(maybeOpts);
  } catch {
    return undefined;
  }
}

// ---- Direct Zod Parsing for detailed schema ----
type ZodLike = any;

function unwrapZod(z: ZodLike): {
  inner: ZodLike;
  optional: boolean;
  hasDefault: boolean;
  nullable: boolean;
} {
  let inner = z;
  let optional = false;
  let hasDefault = false;
  let nullable = false;
  // ZodOptional, ZodDefault, ZodNullable wrappers
  while (
    inner &&
    inner._def &&
    ['ZodOptional', 'ZodDefault', 'ZodNullable'].includes(inner._def.typeName)
  ) {
    if (inner._def.typeName === 'ZodOptional') optional = true;
    if (inner._def.typeName === 'ZodDefault') hasDefault = true;
    if (inner._def.typeName === 'ZodNullable') nullable = true;
    inner =
      inner._def.innerType ||
      inner._def.inner ||
      inner._def.schema ||
      inner._def.type ||
      inner._def.unwrap?.() ||
      inner._def;
  }
  return { inner, optional, hasDefault, nullable };
}

function typeStringFromZod(z: ZodLike): string {
  const { inner } = unwrapZod(z);
  const t = inner?._def?.typeName;
  if (!t) return 'unknown';
  switch (t) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return `${typeStringFromZod(inner._def.type)}[]`;
    case 'ZodEnum':
      return (
        inner._def.values?.map((v: string) => `'${v}'`).join(' | ') || 'enum'
      );
    case 'ZodNativeEnum':
      return 'enum';
    case 'ZodLiteral':
      return `'${inner._def.value}'`;
    case 'ZodRecord': {
      const key = typeStringFromZod(
        inner._def.keyType || { _def: { typeName: 'ZodString' } }
      );
      const val = typeStringFromZod(
        inner._def.valueType || { _def: { typeName: 'ZodUnknown' } }
      );
      return `Record<${key},${val}>`;
    }
    case 'ZodObject':
      return 'object';
    case 'ZodUnknown':
    case 'ZodAny':
      return 'unknown';
    default:
      return 'unknown';
  }
}

function extractObjectShape(
  z: ZodLike
): Record<string, { type: string; required: boolean; description: string }> {
  const result: Record<
    string,
    { type: string; required: boolean; description: string }
  > = {};
  const obj = unwrapZod(z).inner;
  const shapeFn = obj?._def?.shape || obj?._def?.shapeFn || obj?.shape;
  const shape = typeof shapeFn === 'function' ? shapeFn() : shapeFn || {};
  for (const [key, field] of Object.entries(shape as Record<string, ZodLike>)) {
    const wrapped = unwrapZod(field);
    const required = !(wrapped.optional || wrapped.hasDefault);
    const typeStr = typeStringFromZod(field);
    // Look for description in both the field and its unwrapped inner schema
    const desc =
      field?._def?.description || wrapped.inner?._def?.description || '';
    result[key] = { type: typeStr, required, description: desc };
  }
  return result;
}

function discriminatedUnionOptions(
  z: ZodLike
): { op: string; obj: ZodLike }[] | undefined {
  const def = z?._def;
  if (!def) return undefined;
  // ZodDiscriminatedUnion stores options in .options or .optionsMap
  const options: any = def.options || def.optionsMap || def._def?.options;
  const list: any[] = Array.isArray(options)
    ? options
    : options?.values
      ? Array.from(options.values())
      : options
        ? Array.from(options)
        : [];
  const out: { op: string; obj: ZodLike }[] = [];
  for (const opt of list) {
    const shape = extractObjectShape(opt);
    const op =
      (opt?._def &&
        (opt._def.shape?.()?.operation ||
          opt._def.shape?.operation ||
          opt.shape?.operation)) ||
      undefined;
    let opVal = '';
    const literal = op?._def?.value;
    if (typeof literal === 'string') opVal = literal;
    else if (shape.operation && shape.operation.type.startsWith("'"))
      opVal = shape.operation.type.replace(/'/g, '');
    if (opVal) out.push({ op: opVal, obj: opt });
  }
  return out.length ? out : undefined;
}

// Removed hardcoded descriptions - now using schema descriptions only

function renderSchemaDlFromZod(
  shape: Record<
    string,
    { type: string; required: boolean; description: string }
  >,
  isOutput = false
): string {
  const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeMdx = (s: string): string =>
    s.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  const lines: string[] = [];
  for (const [key, meta] of Object.entries(shape)) {
    let typeText = meta.type;
    if (key === 'credentials' && /Record<.*>/.test(typeText)) {
      typeText = typeText.replace(
        /Record<.*>/,
        'Record<CredentialType,string>'
      );
    }
    const safeType = escapeHtml(typeText);
    const requiredBadge = meta.required
      ? `<span style={{color:'#d32f2f',fontWeight:600}}>required</span>`
      : '';
    const desc = escapeMdx(meta.description || '');
    lines.push(
      `  <dt><code>${key}</code> <em>${safeType}</em> ${requiredBadge}</dt>`
    );
    lines.push(`  <dd>${desc}</dd>`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderTabs(
  title: string,
  inputSchema: AnyZod,
  outputSchema: AnyZod,
  bubbleName: string,
  className: string
): string {
  const sections: string[] = [];
  const inDiscriminated = discriminatedUnionOptions(inputSchema);
  const outDiscriminated = discriminatedUnionOptions(outputSchema);

  if (inDiscriminated && outDiscriminated) {
    const byOp = new Map<
      string,
      { inShape: Record<string, any>; outShape: Record<string, any> }
    >();
    for (const { op, obj } of inDiscriminated)
      byOp.set(op, { inShape: extractObjectShape(obj), outShape: {} });
    for (const { op, obj } of outDiscriminated)
      if (byOp.has(op)) byOp.get(op)!.outShape = extractObjectShape(obj);
    for (const [op, shapes] of byOp) {
      sections.push(
        `### \`${op}\`\n\n<Tabs values={[\n  { label: 'Input Schema', value: 'input' },\n  { label: 'Output Schema', value: 'output' }\n]} defaultValue="input">\n  <TabItem value="input">\n\n<div className="schema-card">\n<dl>\n${renderSchemaDlFromZod(shapes.inShape, false)}</dl>\n\n</div>\n\n  </TabItem>\n  <TabItem value="output">\n\n<div className="schema-card">\n<dl>\n${renderSchemaDlFromZod(shapes.outShape, true)}</dl>\n\n</div>\n\n  </TabItem>\n</Tabs>\n`
      );
    }
    return sections.join('\n');
  }

  const inShape = extractObjectShape(inputSchema);
  const outShape = extractObjectShape(outputSchema);
  return `### \`execute\`\n\n<Tabs values={[\n  { label: 'Input Schema', value: 'input' },\n  { label: 'Output Schema', value: 'output' }\n]} defaultValue="input">\n  <TabItem value="input">\n\n<div className="schema-card">\n<dl>\n${renderSchemaDlFromZod(inShape, false)}</dl>\n\n</div>\n\n  </TabItem>\n  <TabItem value="output">\n\n<div className="schema-card">\n<dl>\n${renderSchemaDlFromZod(outShape, true)}</dl>\n\n</div>\n\n  </TabItem>\n</Tabs>\n`;
}

function renderExampleForOp(
  op: string,
  inShape: Record<
    string,
    { type: string; required: boolean; description: string }
  >,
  bubbleName: string,
  className: string
): string {
  // Filter out credentials and operation from required fields for the example
  const requiredEntries = Object.entries(inShape).filter(
    ([key, v]) => v.required && key !== 'credentials' && key !== 'operation'
  );

  const props = requiredEntries
    .map(([k, v]) => `  ${k}: ${guessValueForType(v.type)},`)
    .join('\n');

  // Determine credential type based on bubble name
  const credType = getCredentialTypeForBubble(bubbleName);
  const envVar = getEnvVarForCredentialType(credType);

  const exampleProps = props ? `\n${props}` : '';

  // Only include credentials if they're actually needed
  const needsCredentials = credType !== 'NONE';
  const credentialsSection = needsCredentials
    ? `\n  credentials: {\n    [CredentialType.${credType}]: process.env.${envVar} as string,\n  },`
    : '';

  return `\`\`\`typescript\nimport { ${className} } from '@bubblelab/bubble-core';\n${needsCredentials ? "import { CredentialType } from '@bubblelab/shared-schemas';\n" : ''}\nconst result = await new ${className}({\n  operation: '${op}',${exampleProps}${credentialsSection}\n}).action();\n\`\`\``;
}

function guessValueForType(type: string): string {
  if (type === 'string') return `'example'`;
  if (type === 'number') return `123`;
  if (type === 'boolean') return `true`;
  if (type.endsWith('[]')) return `[]`;
  if (type.startsWith("'")) return type.split('|')[0].trim();
  return 'null';
}

function getCredentialTypeForBubble(bubbleName: string): string {
  // Map bubble names to credential types
  const credMap: Record<string, string> = {
    slack: 'SLACK_CRED',
    'sql-query-tool': 'DATABASE_CRED',
    'web-crawl-tool': 'FIRECRAWL_API_KEY',
    'web-extract-tool': 'FIRECRAWL_API_KEY',
    'list-bubbles-tool': 'NONE',
    'get-bubble-details-tool': 'NONE',
  };

  return credMap[bubbleName] || 'API_KEY_CRED';
}

function getEnvVarForCredentialType(credType: string): string {
  const envMap: Record<string, string> = {
    SLACK_CRED: 'SLACK_TOKEN',
    DATABASE_CRED: 'DATABASE_URL',
    FIRECRAWL_API_KEY: 'FIRECRAWL_API_KEY',
    API_KEY_CRED: 'API_KEY',
    NONE: 'NONE',
  };

  return envMap[credType] || 'API_KEY';
}

function renderQuickStart(bubble: BubbleClass): string {
  const className = bubble.name;
  const credType = getCredentialTypeForBubble(bubble.bubbleName);
  const envVar = getEnvVarForCredentialType(credType);

  // Get a sample operation from the schema
  const inShape = extractObjectShape(bubble.schema);
  const requiredFields = Object.entries(inShape).filter(
    ([key, v]) => v.required && key !== 'credentials' && key !== 'operation'
  );

  // Generate sample properties
  const sampleProps = requiredFields
    .map(([k, v]) => `  ${k}: ${guessValueForType(v.type)},`)
    .join('\n');

  // Determine if this is a discriminated union (has operations)
  const hasOperations = discriminatedUnionOptions(bubble.schema) !== undefined;
  const operationLine = hasOperations
    ? `  operation: '${getFirstOperation(bubble.schema)}',`
    : '';

  // Only include credentials if they're actually needed
  const needsCredentials = credType !== 'NONE';
  const credentialsSection = needsCredentials
    ? `\n  credentials: {\n    [CredentialType.${credType}]: process.env.${envVar} as string,\n  },`
    : '';

  const sample = `const result = await new ${className}({
${operationLine}${sampleProps ? `\n${sampleProps}` : ''}${credentialsSection}
}).action();`;

  return `## Quick Start\n\n\`\`\`typescript\nimport { ${className} } from '@bubblelab/bubble-core';
${needsCredentials ? "import { CredentialType } from '@bubblelab/shared-schemas';\n" : ''}${sample}
\`\`\``;
}

function getFirstOperation(schema: AnyZod): string {
  const options = discriminatedUnionOptions(schema);
  if (options && options.length > 0) {
    return options[0].op;
  }
  return 'execute';
}

function renderHeader(bubble: BubbleClass): string {
  const title =
    `${toTitleCase(bubble.bubbleName.replace(/-tool$/, '').replace(/-/, ' '))}${bubble.type === 'service' ? ' Bubble' : bubble.type === 'tool' ? ' Tool' : ''}`.trim();
  return `# ${title}\n\n${bubble.shortDescription || ''}\n\nimport Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n`;
}

async function generateForBubble(
  bubble: BubbleClass,
  outDir: string
): Promise<void> {
  const fname =
    bubble.type === 'service'
      ? `${bubble.bubbleName}-bubble.mdx`
      : `${bubble.bubbleName}.mdx`;

  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, fname);

  // Check if file already exists
  const fileExists = await fs
    .access(outPath)
    .then(() => true)
    .catch(() => false);

  if (fileExists && !shouldForceRegenerate()) {
    // Update existing file - only replace Operation Details section
    await updateExistingFile(bubble, outPath);
  } else {
    // Create new file with complete content (or regenerate if --force)
    await createNewFile(bubble, outPath);
  }
}

async function createNewFile(
  bubble: BubbleClass,
  outPath: string
): Promise<void> {
  const header = renderHeader(bubble);
  const quickStart = renderQuickStart(bubble);
  const tabs = renderTabs(
    'Operation Details',
    bubble.schema,
    bubble.resultSchema,
    bubble.bubbleName,
    bubble.name
  );

  const content = [
    header,
    quickStart,
    '',
    '## Operation Details',
    '',
    tabs,
    '',
  ].join('\n');

  await fs.writeFile(outPath, content, 'utf8');
  console.log(`Created new file: ${outPath}`);
}

async function updateExistingFile(
  bubble: BubbleClass,
  outPath: string
): Promise<void> {
  const existingContent = await fs.readFile(outPath, 'utf8');

  // Generate new Operation Details section
  const newOperationDetails = renderTabs(
    'Operation Details',
    bubble.schema,
    bubble.resultSchema,
    bubble.bubbleName,
    bubble.name
  );

  // Replace the Operation Details section using regex
  // Look for "## Operation Details" and everything after it until end of file
  const operationDetailsRegex = /## Operation Details[\s\S]*$/;
  const updatedContent = existingContent.replace(
    operationDetailsRegex,
    `## Operation Details\n\n${newOperationDetails}\n`
  );

  await fs.writeFile(outPath, updatedContent, 'utf8');
  console.log(`Updated existing file: ${outPath}`);
}

function parseOnlyArg(): string[] | null {
  const idx = process.argv.indexOf('--only');
  if (idx === -1) return null;
  const val = process.argv[idx + 1] || '';
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function shouldForceRegenerate(): boolean {
  return hasFlag('--force') || hasFlag('-f');
}

async function main(): Promise<void> {
  const only = parseOnlyArg();

  // Collect target bubbles
  const targets: BubbleClass[] = [];

  // Dynamically import local bubble-core dist to avoid workspace resolution issues
  const localCorePath = path.resolve(
    REPO_ROOT,
    'packages',
    'bubble-core',
    'dist',
    'index.js'
  );
  let BubbleCore: Record<string, unknown>;
  try {
    BubbleCore = await import(pathToFileURL(localCorePath).href);
  } catch (err) {
    console.error(
      `Failed to import bubble-core at ${localCorePath}. Did you run pnpm build:core?`
    );
    throw err;
  }

  for (const exp of Object.values(BubbleCore)) {
    if (isBubbleClass(exp)) {
      // Limit to service/tool
      if (exp.type === 'service' || exp.type === 'tool') {
        if (!only || only.includes(exp.bubbleName)) {
          targets.push(exp);
        }
      }
    }
  }

  if (targets.length === 0) {
    console.log(
      'No matching bubbles found. Available bubbles:',
      Object.values(BubbleCore)
        .filter(isBubbleClass)
        .map((b) => b.bubbleName)
        .join(', ')
    );
    return;
  }

  // Prepare output directories
  await fs.mkdir(DOCS_SERVICE_DIR, { recursive: true });
  await fs.mkdir(DOCS_TOOL_DIR, { recursive: true });

  for (const bubble of targets) {
    // Write directly to the target directory
    const outDir = bubble.type === 'service' ? DOCS_SERVICE_DIR : DOCS_TOOL_DIR;
    await generateForBubble(bubble, outDir);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
