export function processUserCode(code: string): string {
  // First, transpile TypeScript to JavaScript using Bun

  // @ts-expect-error Bun.Transpiler is not in TypeScript definitions
  const transpiler = new Bun.Transpiler({
    loader: 'ts',
    target: 'bun',
    minifyWhitespace: false,
  });

  // Transpile TypeScript to JavaScript
  let processedCode = transpiler.transformSync(code);

  // Remove import statements and collect what was imported
  const imports = new Set<string>();

  // Handle: import { BubbleFlow } from '@bubblelab/bubble-core'
  processedCode = processedCode.replace(
    /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@bubblelab\/bubble-core['"]\s*;?/g,
    (_match: string, importList: string) => {
      importList.split(',').forEach((item: string) => {
        const cleaned = item.trim();
        const [name] = cleaned.split(' as ');
        imports.add(name.trim());
      });
      return ''; // Remove import line
    }
  );

  // Handle: import type { ... } from '@bubblelab/bubble-core' (might still exist after transpilation)
  processedCode = processedCode.replace(
    /import\s*type\s*{\s*([^}]+)\s*}\s*from\s*['"]@bubblelab\/bubble-core['"]\s*;?/g,
    ''
  );

  // Handle: import * as bubbles from '@bubblelab/bubble-core'
  processedCode = processedCode.replace(
    /import\s*\*\s*as\s*(\w+)\s*from\s*['"]@bubblelab\/bubble-core['"]\s*;?/g,
    'const $1 = __bubbleCore;'
  );

  // Remove ALL remaining import statements (e.g., zod, etc.)
  // These can't be executed in new Function() context
  // Pattern: import ... from "..."
  processedCode = processedCode.replace(
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"][^'"]+['"]\s*;?\n?/g,
    ''
  );

  // Also handle: import type ... from "..."
  processedCode = processedCode.replace(
    /import\s+type\s+.*?\s+from\s+['"][^'"]+['"]\s*;?\n?/g,
    ''
  );

  // More aggressive: catch any remaining import statements
  // Match: import { ... } from "..."
  processedCode = processedCode.replace(
    /import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;?\n?/g,
    ''
  );

  // Match: import ... from "..."
  processedCode = processedCode.replace(
    /import\s+\w+\s+from\s*['"][^'"]+['"]\s*;?\n?/g,
    ''
  );

  // Remove export keyword from class declarations
  processedCode = processedCode.replace(/export\s+class\s+/g, 'class ');

  // Remove export keyword from other declarations
  processedCode = processedCode.replace(
    /export\s+(?:const|let|var|function)\s+/g,
    (match: string) => {
      return match.replace('export ', '');
    }
  );

  // Build the destructuring assignment for imports
  const importsList = Array.from(imports);
  const destructuring =
    importsList.length > 0
      ? `const { ${importsList.join(', ')} } = __bubbleCore;`
      : '';

  return `${destructuring}
${processedCode}`.trim();
}
