#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface PackageJson {
  name: string;
  version: string;
  [key: string]: any;
}

/**
 * Bumps the patch version of a semantic version string
 * @param version - The current version string (e.g., "0.1.2")
 * @returns The bumped version string (e.g., "0.1.3")
 */
function bumpPatchVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid version format: ${version}. Expected format: x.y.z`
    );
  }

  const [major, minor, patch] = parts.map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Updates package.json version and returns the updated content
 */
function updatePackageVersion(packagePath: string): {
  oldVersion: string;
  newVersion: string;
} {
  const packageJsonPath = join(packagePath, 'package.json');
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  const packageJson: PackageJson = JSON.parse(packageJsonContent);

  const oldVersion = packageJson.version;
  const newVersion = bumpPatchVersion(oldVersion);

  packageJson.version = newVersion;

  // Write back to file with proper formatting
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  return { oldVersion, newVersion };
}

/** @bubblelab packages that create-bubblelab-app templates depend on */
const BUBBLELAB_PACKAGES = [
  '@bubblelab/bubble-core',
  '@bubblelab/bubble-runtime',
  '@bubblelab/shared-schemas',
];

/**
 * Update create-bubblelab-app template package.json files with new @bubblelab versions
 */
function updateTemplateDependencies(newVersion: string): void {
  const templatePaths = [
    'packages/create-bubblelab-app/templates/basic/package.json',
    'packages/create-bubblelab-app/templates/reddit-scraper/package.json',
  ];

  for (const templatePath of templatePaths) {
    try {
      const content = readFileSync(templatePath, 'utf-8');
      const pkg: PackageJson = JSON.parse(content);

      if (!pkg.dependencies) continue;

      let updated = false;
      for (const name of BUBBLELAB_PACKAGES) {
        if (name in pkg.dependencies) {
          pkg.dependencies[name] = `^${newVersion}`;
          updated = true;
        }
      }
      if (updated) {
        writeFileSync(templatePath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`   📝 Updated ${templatePath}`);
      }
    } catch (err) {
      console.warn(`   ⚠️  Could not update ${templatePath}:`, err);
    }
  }
}

/**
 * Main function to bump versions for all packages
 */
async function bumpPackageVersions(): Promise<void> {
  console.log('🚀 Starting package patch version bump...\n');

  try {
    // Find all package.json files in the packages directory
    const packagePaths = await glob('packages/*/package.json', {
      cwd: process.cwd(),
      absolute: false,
    });

    if (packagePaths.length === 0) {
      console.log('❌ No packages found in packages/ directory');
      return;
    }

    const updates: Array<{
      name: string;
      oldVersion: string;
      newVersion: string;
      path: string;
    }> = [];

    // Process each package
    for (const packageJsonPath of packagePaths) {
      const packageDir = packageJsonPath.replace('/package.json', '');
      const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageJsonContent);

      // Skip private packages
      if (packageJson.private) {
        console.log(`⏭️  Skipping private package: ${packageJson.name}`);
        continue;
      }

      const { oldVersion, newVersion } = updatePackageVersion(packageDir);
      updates.push({
        name: packageJson.name,
        oldVersion,
        newVersion,
        path: packageDir,
      });

      console.log(`✅ ${packageJson.name}: ${oldVersion} → ${newVersion}`);
    }

    if (updates.length === 0) {
      console.log('\n⚠️  No packages were updated (all packages are private)');
      return;
    }

    // Use the new version from shared-schemas (canonical source)
    const newVersion =
      updates.find((u) => u.name === '@bubblelab/shared-schemas')?.newVersion ??
      updates[0]!.newVersion;

    console.log('\n📦 Updating create-bubblelab-app template dependencies...');
    updateTemplateDependencies(newVersion);

    console.log(`\n🎉 Successfully bumped ${updates.length} package(s):`);
    updates.forEach((update) => {
      console.log(
        `   ${update.name}: ${update.oldVersion} → ${update.newVersion}`
      );
    });

    console.log('\n📝 Next steps:');
    console.log('   1. Review the changes');
    console.log('   2. Commit the version updates');
    console.log(
      '   3. Run pnpm publish:packages (or use bump-and-publish for both)'
    );
  } catch (error) {
    console.error('❌ Error bumping package versions:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  bumpPackageVersions().catch(console.error);
}

export { bumpPackageVersions, bumpPatchVersion };
