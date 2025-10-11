#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const SAMPLE_DIR = path.join(
  process.cwd(),
  'packages/bubble-core/src/bubble-flow/sample'
);

// Function to list all TypeScript files in the sample directory
function listSampleFiles(): string[] {
  if (!fs.existsSync(SAMPLE_DIR)) {
    console.error(`Sample directory not found: ${SAMPLE_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(SAMPLE_DIR)
    .filter((file) => file.endsWith('.ts'))
    .sort();

  return files;
}

// Function to prompt user for file selection
function promptForFileSelection(files: string[]): Promise<string> {
  return new Promise((resolve) => {
    console.log('\n📁 Available bubble flow files:');
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });

    console.log('\nSelect a file by number (or press Enter to exit):');

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let input = '';

    process.stdin.on('data', (data) => {
      const key = data.toString();

      if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();

        if (input.trim() === '') {
          console.log('Exiting...');
          process.exit(0);
        }

        const selection = parseInt(input.trim());
        if (selection >= 1 && selection <= files.length) {
          resolve(files[selection - 1]);
        } else {
          console.error('Invalid selection');
          process.exit(1);
        }
      } else if (key === '\u0003') {
        // Ctrl+C
        process.exit(0);
      } else if (key >= '0' && key <= '9') {
        input += key;
        process.stdout.write(key);
      } else if (key === '\u007f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      }
    });
  });
}

async function main() {
  // Check if file path was provided as argument (backward compatibility)
  const filePath = process.argv[2];

  let selectedFile: string;
  let fullPath: string;

  if (filePath) {
    // Use provided file path
    fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      process.exit(1);
    }
  } else {
    // List files and let user select
    const files = listSampleFiles();

    if (files.length === 0) {
      console.error('No TypeScript files found in sample directory');
      process.exit(1);
    }

    selectedFile = await promptForFileSelection(files);
    fullPath = path.join(SAMPLE_DIR, selectedFile);
  }

  console.log(`\n🔄 Processing: ${path.basename(fullPath)}`);

  // Read the file content
  const code = fs.readFileSync(fullPath, 'utf8');

  // Extract class name from the code (simple regex)
  const classMatch = code.match(/export class (\w+)/);
  const className = classMatch ? classMatch[1] : 'UnknownBubble';

  // Extract event type from BubbleFlow declaration
  const eventTypeMatch = code.match(/extends BubbleFlow<['"]([^'"]+)['"]/);
  const eventType = eventTypeMatch ? eventTypeMatch[1] : 'webhook/http';

  // Create request body
  const requestBody = {
    name: className,
    description: `Auto-generated from ${path.basename(fullPath)}`,
    code: code,
    eventType: eventType,
    webhookPath: eventType.startsWith('webhook/')
      ? className.toLowerCase().replace(/bubble|flow/gi, '')
      : undefined,
    webhookActive: eventType.startsWith('webhook/') ? true : undefined,
  };

  // Output as formatted JSON
  const jsonOutput = JSON.stringify(requestBody, null, 2);
  console.log(jsonOutput);

  // Copy to clipboard on macOS
  const pbcopy = spawn('pbcopy');
  pbcopy.stdin.write(jsonOutput);
  pbcopy.stdin.end();

  console.log('\n✅ Copied to clipboard!');
}

main().catch(console.error);
