import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env.local
const envPaths = [
  path.join(process.cwd(), '../../.env.local'),
  path.join(process.cwd(), '.env.local'),
  path.join(__dirname, '../../../../../.env.local'),
];

let loaded = false;
for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      dotenv.config({
        path: envPath,
        override: true,
        encoding: 'utf8',
      });
      console.log(`✅ Loaded .env.local from: ${envPath}`);
      loaded = true;
      break;
    }
  } catch {
    // Continue to next path
  }
}
