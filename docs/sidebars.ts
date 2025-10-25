import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
import fs from 'fs';
import path from 'path';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// Function to get all MDX files from a directory and return them as sidebar items
function getBubbleItems(
  bubbleType: 'service-bubbles' | 'tool-bubbles'
): string[] {
  const bubblesDir = path.join(__dirname, 'docs', 'bubbles', bubbleType);

  try {
    // Check if directory exists first
    if (!fs.existsSync(bubblesDir)) {
      console.warn(`Directory ${bubblesDir} does not exist`);
      return [];
    }

    const files = fs.readdirSync(bubblesDir);
    return files
      .filter((file) => file.endsWith('.mdx'))
      .map((file) => `bubbles/${bubbleType}/${file.replace('.mdx', '')}`)
      .sort();
  } catch (error) {
    console.warn(`Could not read ${bubbleType} directory:`, error);
    return [];
  }
}

const sidebars: SidebarsConfig = {
  // Bubble Lab documentation sidebar
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Key Concepts',
      items: ['key-concepts/bubbles', 'key-concepts/execution-pipeline'],
    },
    {
      type: 'category',
      label: 'Bubbles',
      items: [
        'bubbles/overview',
        {
          type: 'category',
          label: 'Service Bubbles',
          items: getBubbleItems('service-bubbles'),
        },
        {
          type: 'category',
          label: 'Tool Bubbles',
          items: getBubbleItems('tool-bubbles'),
        },
      ],
    },
  ],
};

export default sidebars;
