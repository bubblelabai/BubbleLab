import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Bubble Lab Documentation',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.bubblelab.ai',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'bubblelab',
  projectName: 'bubble-lab-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // Serve docs at the site root
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    //image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'Bubble Lab Documentation',
      logo: {
        alt: 'Bubble Lab Logo',
        src: 'img/favicon.ico',
        width: 32,
        height: 32,
      },
      items: [
        {
          href: 'https://bubblelab.ai',
          label: 'Back to Bubble Lab',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/intro',
            },
            {
              label: 'Key Concepts',
              to: '/key-concepts/bubbles',
            },
          ],
        },
        {
          title: 'Bubble Lab',
          items: [
            {
              label: 'Main Website',
              href: 'https://bubblelab.ai',
            },
            {
              label: 'Demos',
              href: 'https://bubblelab.ai/demos',
            },
          ],
        },
        {
          title: 'Support',
          items: [
            {
              label: 'Get Early Access',
              href: 'https://bubblelab.ai',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Bubble Lab.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
