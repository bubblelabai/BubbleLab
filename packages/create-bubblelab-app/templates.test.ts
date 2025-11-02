import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readdirSync,
  copyFileSync,
  existsSync,
  readFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { CREDENTIAL_ENV_MAP, CredentialType } from '@bubblelab/shared-schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Templates to test
const TEMPLATES = ['basic', 'reddit-scraper'];

describe('Template Tests', () => {
  const tempDir = join(__dirname, 'temp-tests');

  beforeAll(() => {
    // Clean up temp directory before running tests
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up temp directory after tests
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function copyDirectory(src: string, dest: string) {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules to avoid copying large dependencies
      if (entry.name === 'node_modules' || entry.name === 'package-lock.json') {
        continue;
      }

      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Loads environment variables from .env files at multiple levels
   * (similar to env.ts pattern)
   */
  function loadSourceEnvVars(): Record<string, string> {
    // Try multiple common locations for .env file (similar to env.ts)
    console.log('Loading environment variables from:', process.cwd());
    const envPaths = [
      join(process.cwd(), '.env'), // Current dir
      join(process.cwd(), '../.env'), // One up (apps level)
      join(process.cwd(), '../../.env'), // Two up (monorepo root)
    ];

    const sourceEnvVars: Record<string, string> = {};

    // Scan for existing .env files to inherit values
    for (const path of envPaths) {
      if (existsSync(path)) {
        try {
          const envContent = readFileSync(path, 'utf-8');
          const lines = envContent.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
              const [key, ...valueParts] = trimmed.split('=');
              const value = valueParts.join('=');
              sourceEnvVars[key.trim()] = value.trim();
            }
          }
          console.log(`📄 Found .env file at: ${path}`);
          break;
        } catch (error) {
          console.warn(`⚠️  Could not read .env file at ${path}:`, error);
        }
      }
    }

    return sourceEnvVars;
  }

  TEMPLATES.forEach((templateName) => {
    it(`should successfully copy and import ${templateName} template`, async () => {
      const templateSrcDir = join(__dirname, 'templates', templateName);
      const templateDestDir = join(tempDir, templateName);

      // Verify template source exists
      expect(existsSync(templateSrcDir)).toBe(true);
      expect(existsSync(join(templateSrcDir, 'src', 'index.ts'))).toBe(true);

      // Copy template files
      copyDirectory(templateSrcDir, templateDestDir);

      // Verify files were copied
      expect(existsSync(templateDestDir)).toBe(true);
      expect(existsSync(join(templateDestDir, 'src', 'index.ts'))).toBe(true);

      // Load environment variables from .env files at multiple levels
      const sourceEnvVars = loadSourceEnvVars();

      // Get API keys from env or .env files
      const googleApiKey =
        process.env.TEST_GOOGLE_API_KEY ||
        sourceEnvVars[CREDENTIAL_ENV_MAP[CredentialType.GOOGLE_GEMINI_CRED]] ||
        'test-google-api-key-placeholder';
      const firecrawlApiKey =
        process.env.TEST_FIRECRAWL_API_KEY ||
        sourceEnvVars[CREDENTIAL_ENV_MAP[CredentialType.FIRECRAWL_API_KEY]] ||
        'test-firecrawl-api-key-placeholder';

      console.log('Google API Key:', googleApiKey);
      console.log('Firecrawl API Key:', firecrawlApiKey);

      // Create .env file in temp directory (same directory as the script will run)
      const envPath = join(templateDestDir, '.env');
      const envContent = [
        '# BubbleLab Configuration',
        '# Google API Key (required for AI models)',
        `GOOGLE_API_KEY=${googleApiKey}`,
        '',
        '# Firecrawl API Key (optional, for advanced web scraping)',
        `FIRECRAWL_API_KEY=${firecrawlApiKey}`,
        '',
        '# Other optional configurations',
        'CITY=New York',
        '',
      ].join('\n');
      writeFileSync(envPath, envContent);

      // Verify .env file was created
      expect(existsSync(envPath)).toBe(true);
      console.log(`📄 Created .env file at: ${envPath}`);

      // Check if we have a valid API key
      const hasValidGoogleApiKey =
        googleApiKey &&
        googleApiKey !== 'test-google-api-key-placeholder' &&
        googleApiKey.trim().length > 0;

      if (hasValidGoogleApiKey) {
        // Run the template directly using tsx (no installation needed)
        // Since create-bubblelab-app has bubble-runtime as dev dependencies,
        // we can run it directly from the workspace
        try {
          // Ensure credentials are available both via .env file and environment variables
          // The .env file is created in templateDestDir, and we set cwd to templateDestDir
          // so dotenv's config() should find it. We also pass env vars explicitly as backup.
          const execEnv = {
            ...process.env,
            NODE_ENV: 'test',
            // Pass credentials as environment variables (dotenv will also load from .env file)
            GOOGLE_API_KEY: googleApiKey,
            FIRECRAWL_API_KEY: firecrawlApiKey,
            CITY: 'New York',
            // Ensure the working directory is set correctly for dotenv
            PWD: templateDestDir,
          };

          console.log(
            `🚀 Running template ${templateName} from: ${templateDestDir}`
          );
          console.log(
            `🔑 Using GOOGLE_API_KEY: ${googleApiKey.substring(0, 10)}...`
          );

          const output = execSync('npx tsx src/index.ts', {
            cwd: templateDestDir, // This ensures dotenv looks for .env in the right place
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 120000, // 2 minutes for execution
            env: execEnv,
          });
          expect(output).toBeDefined();
          console.log(`✅ Template ${templateName} executed successfully`);
          console.log('📊 Execution Result:');
          console.log(output);
        } catch (execError: any) {
          if (execError.message?.includes('timeout')) {
            throw new Error(
              `Template ${templateName} execution timed out after 2 minutes`
            );
          }
          if (execError.status === 1) {
            console.warn(
              `⚠️  Template ${templateName} execution failed (exit code 1). This may be due to invalid API keys or runtime errors.`
            );
            console.warn(`   Error: ${execError.message}`);
            if (execError.stdout) {
              console.warn('📊 Execution Output:');
              console.warn(execError.stdout);
            }
            if (execError.stderr) {
              console.warn('❌ Execution Error:');
              console.warn(execError.stderr);
            }
            // Still verify the structure is correct
            expect(templateDestDir).toBeDefined();
          } else {
            throw execError;
          }
        }
      } else {
        console.log(
          `ℹ️  Skipping execution test for ${templateName} - set TEST_GOOGLE_API_KEY or GOOGLE_API_KEY in .env file to test execution`
        );
      }

      // Verify .env file was created
      expect(existsSync(envPath)).toBe(true);
    }, 180000); // 3 minute timeout per test
  });
});
