import JSZip from 'jszip';
import type { CredentialType } from '@bubblelab/shared-schemas';
import {
  CREDENTIAL_ENV_MAP,
  MockDataGenerator,
} from '@bubblelab/shared-schemas';

interface ZipExportOptions {
  flowName: string;
  code: string;
  requiredCredentials?: Record<string, CredentialType[]>;
  inputsSchema?: string;
}

/**
 * Generates a complete zip package for exporting a BubbleFlow
 * Includes package.json, .env template, runner code, flow code, and README
 */
export async function generateFlowZip(
  options: ZipExportOptions
): Promise<Blob> {
  const { flowName, code, requiredCredentials = {}, inputsSchema } = options;

  console.log('requiredCredentials', requiredCredentials);

  const zip = new JSZip();

  // Generate sanitized file name from flow name
  const sanitizedFlowName = flowName
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();
  const flowFileName = `${sanitizedFlowName}.ts`;
  const projectName = sanitizedFlowName.replace(/_/g, '-');

  // Collect all unique credential types across all bubbles
  const allCredentialTypes = new Set<CredentialType>();
  Object.values(requiredCredentials).forEach((credTypes) => {
    credTypes.forEach((credType) => allCredentialTypes.add(credType));
  });

  // 1. Generate package.json
  const packageJson = generatePackageJson(projectName);
  zip.file('package.json', packageJson);

  // 2. Generate .env file with required credentials
  const envFile = generateEnvFile(Array.from(allCredentialTypes));
  zip.file('.env.example', envFile);

  // 3. Generate src/index.ts (runner code)
  const indexTs = generateIndexTs(
    flowFileName,
    Array.from(allCredentialTypes),
    inputsSchema
  );
  zip.file('src/index.ts', indexTs);

  // 4. Add the flow code
  zip.file(`src/${flowFileName}`, code);

  // 5. Generate README.md
  const readme = generateReadme(
    flowName,
    projectName,
    flowFileName,
    Array.from(allCredentialTypes)
  );
  zip.file('README.md', readme);

  // 6. Generate tsconfig.json
  const tsconfig = generateTsConfig();
  zip.file('tsconfig.json', tsconfig);

  // Generate the zip blob
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

function generatePackageJson(projectName: string): string {
  const pkg = {
    name: projectName,
    version: '0.1.0',
    type: 'module',
    private: true,
    description: 'BubbleFlow exported from BubbleLab Studio',
    scripts: {
      dev: 'tsx src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@bubblelab/bubble-core': '^0.1.1',
      '@bubblelab/bubble-runtime': '^0.1.4',
      dotenv: '^16.0.0',
    },
    devDependencies: {
      '@types/node': '^20.12.12',
      tsx: '^4.20.3',
      typescript: '^5.4.5',
    },
  };

  return JSON.stringify(pkg, null, 2);
}

function generateEnvFile(credentialTypes: CredentialType[]): string {
  if (credentialTypes.length === 0) {
    return '# No credentials required for this flow\n';
  }

  const lines = [
    '# Environment Variables for BubbleFlow',
    '# Fill in the values for the credentials your flow requires',
    '',
  ];

  // Group credentials by type for better organization
  const apiKeys: string[] = [];
  const oauth: string[] = [];
  const database: string[] = [];
  const storage: string[] = [];

  credentialTypes.forEach((credType) => {
    const envVar = CREDENTIAL_ENV_MAP[credType];
    if (!envVar) return;

    const comment = getCredentialComment(credType);

    if (credType.includes('GOOGLE') && !credType.includes('GEMINI')) {
      oauth.push(`# ${comment}`);
      oauth.push(`${envVar}=your_${envVar.toLowerCase()}_here`);
      oauth.push('');
    } else if (credType.includes('DATABASE')) {
      database.push(`# ${comment}`);
      database.push(`${envVar}=your_${envVar.toLowerCase()}_here`);
      database.push('');
    } else if (credType.includes('R2') || credType.includes('STORAGE')) {
      storage.push(`# ${comment}`);
      storage.push(`${envVar}=your_${envVar.toLowerCase()}_here`);
      storage.push('');
    } else {
      apiKeys.push(`# ${comment}`);
      apiKeys.push(`${envVar}=your_${envVar.toLowerCase()}_here`);
      apiKeys.push('');
    }
  });

  if (apiKeys.length > 0) {
    lines.push('# API Keys', ...apiKeys);
  }
  if (oauth.length > 0) {
    lines.push('# OAuth Credentials (requires OAuth flow)', ...oauth);
  }
  if (database.length > 0) {
    lines.push('# Database Credentials', ...database);
  }
  if (storage.length > 0) {
    lines.push('# Storage Credentials', ...storage);
  }

  return lines.join('\n');
}

function getCredentialComment(credType: CredentialType): string {
  const comments: Record<string, string> = {
    OPENAI_CRED: 'OpenAI API Key - Get at https://platform.openai.com/api-keys',
    GOOGLE_GEMINI_CRED:
      'Google Gemini API Key - Get at https://aistudio.google.com/app/apikey',
    ANTHROPIC_CRED: 'Anthropic API Key - Get at https://console.anthropic.com/',
    FIRECRAWL_API_KEY: 'Firecrawl API Key - Get at https://www.firecrawl.dev/',
    DATABASE_CRED:
      'PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/db)',
    SLACK_CRED: 'Slack Bot Token - Get at https://api.slack.com/apps',
    RESEND_CRED: 'Resend API Key - Get at https://resend.com/api-keys',
    OPENROUTER_CRED: 'OpenRouter API Key - Get at https://openrouter.ai/keys',
    CLOUDFLARE_R2_ACCESS_KEY: 'Cloudflare R2 Access Key',
    CLOUDFLARE_R2_SECRET_KEY: 'Cloudflare R2 Secret Key',
    CLOUDFLARE_R2_ACCOUNT_ID: 'Cloudflare R2 Account ID',
    GOOGLE_DRIVE_CRED: 'Google Drive OAuth credentials (requires OAuth flow)',
    GMAIL_CRED: 'Gmail OAuth credentials (requires OAuth flow)',
    GOOGLE_SHEETS_CRED: 'Google Sheets OAuth credentials (requires OAuth flow)',
    GOOGLE_CALENDAR_CRED:
      'Google Calendar OAuth credentials (requires OAuth flow)',
  };

  return comments[credType] || `${credType} credential`;
}

function generateIndexTs(
  flowFileName: string,
  credentialTypes: CredentialType[],
  inputsSchema?: string
): string {
  const credentialMappingLines: string[] = [];
  credentialTypes.forEach((credType) => {
    const envVar = CREDENTIAL_ENV_MAP[credType];
    if (envVar) {
      credentialMappingLines.push(
        `    [CredentialType.${credType}]: process.env.${envVar},`
      );
    }
  });

  const credentialMapping =
    credentialMappingLines.length > 0
      ? `\n  // Inject credentials from environment variables\n  runner.injector.injectCredentials(bubbles, [], {\n${credentialMappingLines.join('\n')}\n  });\n`
      : '';

  // Generate mock payload from inputsSchema
  let mockPayload = '{}';
  let payloadComment = '// This flow does not require any input payload';
  if (inputsSchema) {
    try {
      const schema = JSON.parse(inputsSchema);
      const mockData = MockDataGenerator.generateMockFromJsonSchema(schema);
      mockPayload = JSON.stringify(mockData, null, 2);
      payloadComment =
        "// Example payload generated from your flow's input schema\n  // Modify this to match your actual data";
    } catch (error) {
      console.error('Failed to parse inputsSchema for mock generation:', error);
    }
  }

  return `/**
 * BubbleFlow Runner
 *
 * This file executes your BubbleFlow locally using the BubbleRunner.
 *
 * Quick Start:
 * 1. Make sure you've run 'npm install' to install dependencies
 * 2. Configure your .env file with required credentials (copy from .env.example)
 * 3. Run 'npm run dev' to execute this flow
 *
 * You can customize bubble parameters and credentials below before execution.
 */

import { BubbleRunner } from '@bubblelab/bubble-runtime';
import { BubbleFactory } from '@bubblelab/bubble-core';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { CredentialType } from '@bubblelab/shared-schemas';

// Load environment variables from .env file
config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🫧 Starting BubbleFlow execution\\n');

  // Step 1: Create a BubbleFactory and register defaults
  const bubbleFactory = new BubbleFactory();
  await bubbleFactory.registerDefaults();
  console.log('✅ BubbleFactory initialized\\n');

  // Step 2: Read the flow code as a string
  const flowCode = readFileSync(join(__dirname, '${flowFileName}'), 'utf-8');

  // Step 3: Create a BubbleRunner with your flow code
  const runner = new BubbleRunner(flowCode, bubbleFactory);

  // Step 4: Get parsed bubbles for credential injection
  const bubbles = runner.getParsedBubbles();
${credentialMapping}
  // Step 5: (Optional) Modify bubble parameters dynamically
  // Example: Change a parameter value
  // const bubbleIds = Object.keys(bubbles).map(Number);
  // if (bubbleIds.length > 0) {
  //   runner.injector.changeBubbleParameters(
  //     bubbleIds[0],
  //     'parameterName',
  //     'new value'
  //   );
  // }

  // Step 6: Execute the flow with payload
  ${payloadComment}
  const payload = ${mockPayload};

  console.log('🤖 Running flow...\\n');
  const result = await runner.runAll(payload);

  // Step 7: Display results
  console.log('📊 Results:');
  console.log('─'.repeat(50));
  console.log(JSON.stringify(result, null, 2));
  console.log('─'.repeat(50));

  // Optional: View execution logs
  const logs = runner.getLogger()?.getLogs();
  if (logs && logs.length > 0) {
    console.log('\\n📝 Execution Logs:');
    console.log(logs.slice(0, 5)); // Show first 5 logs
  }

  // Optional: View execution summary
  const summary = runner.getLogger()?.getExecutionSummary();
  if (summary) {
    console.log('\\n📈 Execution Summary:');
    console.log(summary);
  }

  // Force exit to close any lingering connections
  process.exit(0);
}

// Run the flow
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
`;
}

function generateReadme(
  flowName: string,
  projectName: string,
  flowFileName: string,
  credentialTypes: CredentialType[]
): string {
  const credentialDocs = credentialTypes
    .map((credType) => {
      const envVar = CREDENTIAL_ENV_MAP[credType];
      const comment = getCredentialComment(credType);
      return `- **${envVar}**: ${comment}`;
    })
    .join('\n');

  const hasCredentials = credentialTypes.length > 0;

  return `# ${flowName}

**A complete, ready-to-run BubbleFlow project exported from BubbleLab Studio.**

This is a standalone Node.js project with all dependencies, configuration files, and your flow code pre-configured. Just extract, install, and run!

## 📦 What's Included

- **Complete project structure** with TypeScript configuration
- **All required dependencies** (\`@bubblelab/bubble-core\`, \`@bubblelab/bubble-runtime\`)
- **Your flow code** in \`src/${flowFileName}\`
- **Runner script** that executes your flow locally
- **Environment template** (${hasCredentials ? 'with your required credentials' : 'ready for any future credentials'})
- **Development tools** (tsx for fast development, TypeScript compiler)

## 🚀 Quick Start

### 1. Extract and Navigate

\`\`\`bash
# Extract the downloaded .zip file, then:
cd ${projectName}
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
# or
pnpm install
# or
yarn install
\`\`\`

This installs all required packages including \`@bubblelab/bubble-core\` and \`@bubblelab/bubble-runtime\`.

### 3. Configure Environment Variables

${
  hasCredentials
    ? `Copy the example environment file and fill in your credentials:

\`\`\`bash
cp .env.example .env
\`\`\`

Then edit \`.env\` with your API keys and credentials:

${credentialDocs}
`
    : 'This flow does not require any credentials, but you can add a `.env` file for future use.'
}

### 4. Run the Flow

\`\`\`bash
npm run dev
# or
pnpm dev
# or
yarn dev
\`\`\`

The flow will execute and display results in your terminal.

## 📚 Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── index.ts           # Flow runner (executes the flow)
│   └── ${flowFileName}    # Your flow definition
├── package.json
├── tsconfig.json
├── .env.example          # Environment variables template
└── README.md
\`\`\`

## 🔧 Customization

### Modify Flow Parameters

Edit \`src/index.ts\` to dynamically change bubble parameters before execution:

\`\`\`typescript
// Get the bubble IDs
const bubbleIds = Object.keys(bubbles).map(Number);

// Change a parameter value
runner.injector.changeBubbleParameters(
  bubbleIds[0],  // Bubble ID
  'message',     // Parameter name
  'New value'    // New value
);
\`\`\`

### Add More Flows

Create additional flow files in \`src/\` and import them in \`index.ts\`.

## 📖 Learn More

- [BubbleLab Documentation](https://github.com/bubblelabai/BubbleLab)
- [BubbleLab Studio](https://bubblelab.dev)

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/bubblelabai/BubbleLab/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bubblelabai/BubbleLab/discussions)

## 📄 License

Apache-2.0 © Bubble Lab, Inc.

---

**Happy Building! 🫧**
`;
}

function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      lib: ['ES2022'],
      moduleResolution: 'node',
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      outDir: './dist',
      rootDir: './src',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  return JSON.stringify(config, null, 2);
}
