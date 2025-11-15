# Web Test Tool

> Advanced web testing and automation tool with browser actions, screenshots, and structured data extraction using Firecrawl.

## Overview

The `web-test-tool` is a comprehensive testing and automation bubble that combines Firecrawl's powerful scraping capabilities with browser automation, screenshot capture, and AI-powered data extraction. It's perfect for end-to-end testing, web automation, visual documentation, and quality assurance.

## Key Features

### 🎬 Browser Automation

- **Actions Support**: Click, type, scroll, press keys, execute JavaScript
- **Multi-step Flows**: Chain multiple actions for complex interactions
- **Wait Controls**: Precise timing control for dynamic content
- **Form Automation**: Fill forms, select options, submit data

### 📸 Screenshot Capabilities

- **Full Page**: Capture entire scrollable page content
- **Viewport**: Screenshot visible area only
- **Quality Control**: Configurable quality (0-100)
- **Custom Dimensions**: Set viewport width/height
- **Base64 Encoding**: Easy storage and transmission

### 📄 Content Extraction

- **Multiple Formats**: Markdown, HTML, Raw HTML, Links
- **AI JSON Extraction**: Extract structured data with custom schemas
- **Smart Filtering**: Include/exclude specific tags and elements
- **Main Content Focus**: Automatic noise removal

### ⚙️ Advanced Options

- **PDF Parsing**: Built-in PDF document support
- **Cache Control**: Fresh or cached data retrieval
- **Custom Timeouts**: Configurable request timeouts
- **Element Targeting**: CSS selector-based precision

## Installation

The web-test-tool is included in `@bubblelab/bubble-core`:

```bash
npm install @bubblelab/bubble-core
```

## Basic Usage

### Simple Screenshot

```typescript
import { WebTestTool } from '@bubblelab/bubble-core';

const tool = new WebTestTool({
  url: 'https://example.com',
  formats: [
    {
      type: 'screenshot',
      fullPage: true,
      quality: 90,
    },
  ],
  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});

const result = await tool.action();
console.log(result.data?.screenshot?.base64); // Base64 screenshot
```

### Basic Content Scraping

```typescript
const tool = new WebTestTool({
  url: 'https://example.com',
  formats: ['markdown', 'links'],
  onlyMainContent: true,
  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});

const result = await tool.action();
console.log(result.data?.markdown); // Clean markdown content
console.log(result.data?.links); // All extracted links
```

## Advanced Examples

### E2E Test with Actions and Screenshot

```typescript
const tool = new WebTestTool({
  url: 'https://app.example.com/login',
  actions: [
    // Wait for page to load
    { type: 'wait', milliseconds: 1000 },

    // Fill login form
    { type: 'click', selector: '#login-btn' },
    { type: 'write', selector: '#email', text: 'user@example.com' },
    { type: 'write', selector: '#password', text: 'secure123' },

    // Submit form
    { type: 'press', key: 'Enter' },

    // Wait for navigation
    { type: 'wait', milliseconds: 2000 },

    // Take screenshot of dashboard
    { type: 'screenshot', fullPage: true },
  ],
  formats: [
    'markdown',
    {
      type: 'screenshot',
      fullPage: true,
      quality: 85,
    },
  ],
  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});

const result = await tool.action();
```

### Form Automation Test

```typescript
const tool = new WebTestTool({
  url: 'https://example.com/contact',
  actions: [
    // Fill contact form
    { type: 'write', selector: '#name', text: 'John Doe' },
    { type: 'write', selector: '#email', text: 'john@example.com' },
    { type: 'write', selector: '#message', text: 'Test message' },

    // Submit and wait for confirmation
    { type: 'click', selector: '#submit' },
    { type: 'wait', milliseconds: 2000 },

    // Capture result
    { type: 'screenshot', fullPage: false },
  ],
  formats: ['markdown', { type: 'screenshot', fullPage: false }],
  excludeTags: ['#header', '#footer'],
  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});
```

### Structured Data Extraction

```typescript
const tool = new WebTestTool({
  url: 'https://shop.example.com/product/123',
  actions: [
    // Accept cookies
    { type: 'click', selector: '.cookie-accept' },
    { type: 'wait', milliseconds: 500 },

    // Expand all images
    { type: 'click', selector: '.show-all-images' },
    { type: 'wait', milliseconds: 1000 },
  ],
  formats: [
    {
      type: 'json',
      prompt: 'Extract product name, price, description, and all image URLs',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          description: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          inStock: { type: 'boolean' },
        },
        required: ['name', 'price'],
      },
    },
    { type: 'screenshot', fullPage: true },
  ],
  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});

const result = await tool.action();
console.log(result.data?.extractedJson); // Structured product data
```

### Advanced Filtering

```typescript
const tool = new WebTestTool({
  url: 'https://example.com/article',
  formats: ['markdown'],

  // Include only specific elements
  includeTags: ['h1', 'h2', 'p', 'article', '.content'],

  // Exclude ads, navigation, and footer
  excludeTags: ['#ad', '.advertisement', 'nav', 'footer', '#sidebar'],

  // Extract main content only
  onlyMainContent: true,

  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});
```

### Custom JavaScript Execution

```typescript
const tool = new WebTestTool({
  url: 'https://example.com',
  actions: [
    {
      type: 'executeJavascript',
      script: `
        // Remove modal overlays
        document.querySelectorAll('.modal, .popup').forEach(el => el.remove());

        // Highlight important sections
        document.querySelectorAll('.important').forEach(el => {
          el.style.backgroundColor = 'yellow';
        });
      `,
    },
    { type: 'wait', milliseconds: 500 },
    { type: 'screenshot', fullPage: true },
  ],
  formats: ['markdown', { type: 'screenshot', fullPage: true }],
  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});
```

### Visual Regression Testing

```typescript
// Capture baseline screenshot
const baseline = new WebTestTool({
  url: 'https://app.example.com/dashboard',
  actions: [
    { type: 'wait', milliseconds: 2000 }, // Wait for data to load
  ],
  formats: [
    {
      type: 'screenshot',
      fullPage: true,
      quality: 100,
      viewport: {
        width: 1920,
        height: 1080,
      },
    },
  ],
  credentials: {
    FIRECRAWL_API_KEY: 'your-api-key',
  },
});

const result = await baseline.action();
// Save screenshot for comparison
fs.writeFileSync(
  'baseline.png',
  Buffer.from(result.data?.screenshot?.base64, 'base64')
);
```

## Action Types Reference

### Wait Action

```typescript
{
  type: 'wait',
  milliseconds: 1000  // Time to wait in ms
}
```

### Click Action

```typescript
{
  type: 'click',
  selector: '#button'  // CSS selector
}
```

### Write Action

```typescript
{
  type: 'write',
  selector: 'input[name="email"]',
  text: 'user@example.com'
}
```

### Press Key Action

```typescript
{
  type: 'press',
  key: 'Enter'  // Key name: Enter, Tab, Escape, etc.
}
```

### Scroll Action

```typescript
{
  type: 'scroll',
  direction: 'down'  // or 'up'
}
```

### Scrape Action

```typescript
{
  type: 'scrape',
  selector: '.content'  // Scrape specific element
}
```

### Execute JavaScript Action

```typescript
{
  type: 'executeJavascript',
  script: 'document.querySelector(".modal").remove()'
}
```

### Screenshot Action

```typescript
{
  type: 'screenshot',
  fullPage: true  // Full page or viewport
}
```

## Format Options

### Screenshot Format

```typescript
{
  type: 'screenshot',
  fullPage: true,      // Capture full scrollable page
  quality: 85,         // Quality 0-100 (default: 80)
  viewport: {          // Optional custom viewport
    width: 1920,
    height: 1080
  }
}
```

### JSON Extraction Format

```typescript
{
  type: 'json',
  prompt: 'Extract product details including name, price, and images',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      price: { type: 'number' },
      images: { type: 'array', items: { type: 'string' } }
    },
    required: ['name', 'price']
  }
}
```

### String Formats

```typescript
formats: ['markdown', 'html', 'rawHtml', 'links'];
```

## Configuration Options

| Option            | Type     | Default      | Description                           |
| ----------------- | -------- | ------------ | ------------------------------------- |
| `url`             | string   | required     | URL to test/scrape                    |
| `actions`         | Action[] | []           | Actions to perform before scraping    |
| `formats`         | Format[] | ['markdown'] | Output formats to return              |
| `includeTags`     | string[] | undefined    | HTML tags/classes/IDs to include      |
| `excludeTags`     | string[] | undefined    | HTML tags/classes/IDs to exclude      |
| `onlyMainContent` | boolean  | true         | Extract only main content             |
| `waitFor`         | number   | 0            | Milliseconds to wait before scraping  |
| `timeout`         | number   | 30000        | Max request duration in ms            |
| `maxAge`          | number   | 172800000    | Cache age in ms (0 for fresh)         |
| `parsers`         | string[] | []           | Enable specific parsers (e.g., 'pdf') |
| `credentials`     | object   | required     | Must include FIRECRAWL_API_KEY        |

## Result Schema

```typescript
interface WebTestToolResult {
  url: string; // Original URL
  success: boolean; // Success status
  error: string; // Error message if failed
  markdown?: string; // Markdown content
  html?: string; // HTML content
  rawHtml?: string; // Raw HTML source
  links?: string[]; // Extracted links
  screenshot?: {
    // Screenshot data
    base64: string;
    format: string;
    fullPage: boolean;
  };
  extractedJson?: object; // Structured JSON data
  metadata?: {
    // Execution metadata
    title?: string;
    description?: string;
    statusCode?: number;
    executionTime?: number;
    actionsPerformed?: number;
  };
  creditsUsed: number; // Firecrawl credits consumed
}
```

## Use Cases

### 🧪 End-to-End Testing

- Test user flows and authentication
- Verify form submissions
- Validate multi-step processes
- Generate test reports with screenshots

### 🤖 Web Automation

- Automate repetitive browser tasks
- Extract data from protected pages
- Navigate complex JavaScript applications
- Perform scheduled monitoring

### 📸 Visual Documentation

- Create screenshots for docs
- Capture UI states
- Generate visual changelogs
- Build component galleries

### 🔍 Quality Assurance

- Visual regression testing
- Cross-browser validation
- Responsive design checks
- Content verification

### 📊 Data Extraction

- Scrape dynamic content
- Extract structured data
- Parse PDFs and documents
- Monitor competitor sites

## Best Practices

1. **Minimize Actions**: Use only necessary actions to reduce execution time
2. **Explicit Waits**: Use wait actions for dynamic content loading
3. **Error Handling**: Always check `success` status before using data
4. **Cache Control**: Set `maxAge: 0` for frequently changing content
5. **Screenshot Quality**: Balance quality vs file size (80-90 is usually optimal)
6. **Selector Specificity**: Use specific CSS selectors to avoid conflicts
7. **Rate Limiting**: Be mindful of API rate limits and costs

## Troubleshooting

### Actions Not Executing

- Verify CSS selectors are correct
- Add wait actions before interactions
- Check if elements are visible/enabled

### Screenshot Too Large

- Use viewport screenshots instead of full page
- Reduce quality setting
- Consider custom viewport dimensions

### JSON Extraction Failing

- Ensure prompt is clear and specific
- Verify schema matches expected data structure
- Check if data is actually present on page

### Timeout Errors

- Increase `timeout` value
- Add wait actions for slow loading content
- Check if URL is accessible

## Credits and Costs

The web-test-tool uses Firecrawl API credits:

- Base scrape: 1 credit per page
- Additional costs may apply for:
  - PDF parsing
  - Screenshot generation
  - JSON extraction

## Related Tools

- **web-search-tool**: Search the web for URLs
- **web-scrape-tool**: Simple content scraping
- **web-extract-tool**: AI-powered data extraction
- **web-crawl-tool**: Multi-page crawling

## Support

For issues, feature requests, or questions:

- GitHub: https://github.com/bubblelabai/BubbleLab
- Documentation: https://docs.bubblelab.ai
- Discord: https://discord.com/invite/PkJvcU2myV
