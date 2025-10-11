#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prompts from 'prompts';
import pc from 'picocolors';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log(pc.cyan('\n🫧 Welcome to BubbleLab!\n'));

  const response = await prompts([
    {
      type: 'text',
      name: 'projectName',
      message: 'What is your project name?',
      initial: 'my-bubblelab-app',
      validate: (value) =>
        /^[a-z0-9-_]+$/.test(value)
          ? true
          : 'Project name must contain only lowercase letters, numbers, hyphens, and underscores',
    },
    {
      type: 'select',
      name: 'template',
      message: 'Select a template:',
      choices: [
        {
          title: 'Reddit News Scraper',
          value: 'reddit-scraper',
          description:
            'AI agent that scrapes Reddit and summarizes news (uses Google API key)',
        },
        {
          title: 'Weather Agent (Recommended)',
          value: 'basic',
          description:
            'AI agent that researches weather using web search (uses Google API key and Firecrawl API key)',
        },
      ],
      initial: 0,
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Select a package manager:',
      choices: [
        { title: 'pnpm', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
      ],
      initial: 0,
    },
    {
      type: 'password',
      name: 'googleApiKey',
      message: 'Enter your Google API key (required for AI models):',
      validate: (value) =>
        value.length > 0 ? true : 'Google API key is required',
    },
    {
      type: 'password',
      name: 'firecrawlApiKey',
      message: 'Enter your Firecrawl API key (optional, press Enter to skip):',
    },
  ]);

  if (!response.projectName) {
    console.log(pc.red('\n❌ Project creation cancelled'));
    process.exit(1);
  }

  const {
    projectName,
    template,
    packageManager,
    googleApiKey,
    firecrawlApiKey,
  } = response;
  const targetDir = path.join(process.cwd(), projectName);

  // Check if directory exists
  if (fs.existsSync(targetDir)) {
    console.log(pc.red(`\n❌ Directory ${projectName} already exists`));
    process.exit(1);
  }

  // Create directory
  console.log(pc.cyan(`\n📁 Creating ${projectName}...\n`));
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy template
  const templateDir = path.join(__dirname, '..', 'templates', template);
  copyDirectory(templateDir, targetDir);

  // Update package.json with project name
  const packageJsonPath = path.join(targetDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  packageJson.name = projectName;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Create .env file with API keys
  console.log(pc.cyan('🔑 Creating .env file...\n'));
  const envContent = [
    '# BubbleLab Configuration',
    '# Google API Key (required for AI models)',
    `GOOGLE_API_KEY=${googleApiKey}`,
    '',
    '# Firecrawl API Key (optional, for advanced web scraping)',
    firecrawlApiKey
      ? `FIRECRAWL_API_KEY=${firecrawlApiKey}`
      : '# FIRECRAWL_API_KEY=your_firecrawl_api_key_here',
    '',
    '# Other optional configurations',
    '# CITY=New York',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, '.env'), envContent);

  // Install dependencies
  console.log(pc.cyan('📦 Installing dependencies...\n'));
  try {
    const installCmd =
      packageManager === 'yarn' ? 'yarn' : `${packageManager} install`;
    execSync(installCmd, { cwd: targetDir, stdio: 'inherit' });
  } catch (error) {
    console.log(
      pc.yellow('\n⚠️  Failed to install dependencies automatically')
    );
    console.log(
      pc.yellow(`Please run: cd ${projectName} && ${packageManager} install\n`)
    );
  }

  // Success message
  console.log(pc.green('\n✅ Project created successfully!\n'));
  console.log(pc.bold('Next steps:\n'));
  console.log(pc.cyan(`  cd ${projectName}`));
  console.log(
    pc.cyan(`  ${packageManager === 'npm' ? 'npm run' : packageManager} dev\n`)
  );
  console.log(pc.dim('📖 Read the README.md for more information\n'));
}

function copyDirectory(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main().catch((error) => {
  console.error(pc.red('\n❌ Error:'), error);
  process.exit(1);
});
