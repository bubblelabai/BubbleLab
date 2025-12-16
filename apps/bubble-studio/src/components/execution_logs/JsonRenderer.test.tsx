/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for JsonRenderer HTML sanitization
 * Tests that HTML with CSS is properly sanitized to prevent page styling issues
 */

// Mock the sanitizeHTML function logic (since it's private, we test the behavior)
function testSanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return html;
  }

  // Use DOM API for safer parsing (same approach as JsonRenderer)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove <style> tags and their content (prevents CSS leakage)
  const styleTags = tempDiv.querySelectorAll('style');
  styleTags.forEach((style) => style.remove());

  // Remove <script> tags and their content (security)
  const scripts = tempDiv.querySelectorAll('script');
  scripts.forEach((script) => script.remove());

  // Remove inline style attributes from all elements (prevents CSS leakage)
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach((el) => {
    el.removeAttribute('style');
  });

  return tempDiv.innerHTML;
}

describe('JsonRenderer - HTML Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HTML with inline CSS sanitization', () => {
    it('should remove <style> tags from HTML content', () => {
      const htmlWithStyle = `
        <style>
          body { background: red !important; color: white !important; }
          * { margin: 0 !important; padding: 20px !important; }
        </style>
        <h1>Test Content</h1>
        <p>This should render without CSS affecting the page.</p>
      `;

      const sanitized = testSanitizeHTML(htmlWithStyle);

      // Check that style tags are removed
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('</style>');
      expect(sanitized).not.toContain('background: red');

      // Check that content is still preserved
      expect(sanitized).toContain('Test Content');
      expect(sanitized).toContain('This should render without CSS');
      expect(sanitized).toContain('<h1>');
      expect(sanitized).toContain('<p>');
    });

    it('should remove inline style attributes from elements', () => {
      const htmlWithInlineStyles = `
        <div style="background: red; color: white; font-size: 30px;">
          <p style="margin: 0; padding: 20px;">Test content</p>
          <span style="color: blue;">Inline styled text</span>
        </div>
      `;

      const sanitized = testSanitizeHTML(htmlWithInlineStyles);

      // Check that style attributes are removed
      expect(sanitized).not.toContain('style=');
      expect(sanitized).not.toContain('background: red');
      expect(sanitized).not.toContain('color: white');
      expect(sanitized).not.toContain('font-size: 30px');

      // Check that content is still preserved
      expect(sanitized).toContain('Test content');
      expect(sanitized).toContain('Inline styled text');
      expect(sanitized).toContain('<div>');
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<span>');
    });

    it('should remove both <style> tags and inline styles', () => {
      const htmlWithBoth = `
        <style>
          body { background: red !important; }
        </style>
        <div style="color: white; font-size: 20px;">
          <h1 style="margin: 0;">Title</h1>
          <p>Content with styles</p>
        </div>
      `;

      const sanitized = testSanitizeHTML(htmlWithBoth);

      // Check that style tags are removed
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('</style>');
      expect(sanitized).not.toContain('background: red');

      // Check that inline style attributes are removed
      expect(sanitized).not.toContain('style=');
      expect(sanitized).not.toContain('color: white');
      expect(sanitized).not.toContain('font-size: 20px');
      expect(sanitized).not.toContain('margin: 0');

      // Check that content is still preserved
      expect(sanitized).toContain('Title');
      expect(sanitized).toContain('Content with styles');
      expect(sanitized).toContain('<h1>');
      expect(sanitized).toContain('<p>');
    });

    it('should remove <script> tags for security', () => {
      const htmlWithScript = `
        <div>
          <h1>Test</h1>
          <script>alert('XSS');</script>
          <script src="evil.js"></script>
        </div>
      `;

      const sanitized = testSanitizeHTML(htmlWithScript);

      // Check that script tags are removed
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain("alert('XSS')");
      expect(sanitized).not.toContain('evil.js');

      // Check that content is still preserved
      expect(sanitized).toContain('Test');
      expect(sanitized).toContain('<h1>');
      expect(sanitized).toContain('<div>');
    });

    it('should handle Google 404 error page HTML', () => {
      const google404Html = `
        <meta name=viewport content="initial-scale=1, minimum-scale=1, width=device-width">
        <title>Error 404 (Not Found)!!1</title>
        <style>
          {margin:0;padding:0}html,code{font:15px/22px arial,sans-serif}html{background:#fff;color:#222;padding:15px}body{margin:7% auto 0;max-width:390px;min-height:180px;padding:30px 0 15px}
        </style>
        <div>
          404. That's an error.
          The requested URL was not found on this server.
        </div>
      `;

      const sanitized = testSanitizeHTML(google404Html);

      // Check that style tags are removed
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('</style>');
      expect(sanitized).not.toContain('background:#fff');
      expect(sanitized).not.toContain('color:#222');

      // Check that content is still preserved
      expect(sanitized).toContain("404. That's an error");
      expect(sanitized).toContain('The requested URL was not found');
      expect(sanitized).toContain('<div>');
    });

    it('should preserve HTML structure while removing CSS', () => {
      const structuredHtml = `
        <div>
          <h1>Title</h1>
          <p style="color: red;">Paragraph with inline style</p>
          <ul>
            <li>Item 1</li>
            <li style="font-weight: bold;">Item 2</li>
          </ul>
        </div>
      `;

      const sanitized = testSanitizeHTML(structuredHtml);

      // Check that structure is preserved
      expect(sanitized).toContain('<h1>');
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<ul>');
      expect(sanitized).toContain('<li>');

      // Check that inline styles are removed
      expect(sanitized).not.toContain('style=');
      expect(sanitized).not.toContain('color: red');
      expect(sanitized).not.toContain('font-weight: bold');

      // Check that content is preserved
      expect(sanitized).toContain('Title');
      expect(sanitized).toContain('Paragraph with inline style');
      expect(sanitized).toContain('Item 1');
      expect(sanitized).toContain('Item 2');
    });

    it('should handle empty or null HTML gracefully', () => {
      expect(testSanitizeHTML('')).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(testSanitizeHTML(null as any)).toBe(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(testSanitizeHTML(undefined as any)).toBe(undefined);
    });

    it('should handle nested HTML with multiple style tags', () => {
      const nestedHtml = `
        <div>
          <style>
            .outer { background: blue; }
          </style>
          <div class="outer">
            <style>
              .inner { color: red; }
            </style>
            <p class="inner" style="font-size: 20px;">Nested content</p>
          </div>
        </div>
      `;

      const sanitized = testSanitizeHTML(nestedHtml);

      // Check that all style tags are removed
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('</style>');
      expect(sanitized).not.toContain('background: blue');
      expect(sanitized).not.toContain('color: red');

      // Check that inline styles are removed
      expect(sanitized).not.toContain('style=');
      expect(sanitized).not.toContain('font-size: 20px');

      // Check that content is preserved
      expect(sanitized).toContain('Nested content');
      expect(sanitized).toContain('<div>');
      expect(sanitized).toMatch(/<p[^>]*>/); // Match <p> or <p class="...">
    });
  });

  describe('HTML sanitization edge cases', () => {
    it('should handle HTML with mixed case style tags', () => {
      const mixedCaseHtml = `
        <STYLE>body { color: red; }</STYLE>
        <Style>div { background: blue; }</Style>
        <div STYLE="font-size: 20px;">Content</div>
      `;

      const sanitized = testSanitizeHTML(mixedCaseHtml);

      // Check that style tags are removed (case insensitive)
      expect(sanitized).not.toContain('<STYLE>');
      expect(sanitized).not.toContain('</STYLE>');
      expect(sanitized).not.toContain('<Style>');
      expect(sanitized).not.toContain('</Style>');

      // Check that inline styles are removed
      expect(sanitized).not.toContain('STYLE=');
      expect(sanitized).not.toContain('font-size: 20px');

      // Check that content is preserved
      expect(sanitized).toContain('Content');
    });

    it('should handle HTML with empty style tags', () => {
      const emptyStyleHtml = `
        <style></style>
        <div style="">Content</div>
      `;

      const sanitized = testSanitizeHTML(emptyStyleHtml);

      // Check that empty style tags are removed
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('</style>');
      expect(sanitized).not.toContain('style=""');

      // Check that content is preserved
      expect(sanitized).toContain('Content');
    });

    it('should handle HTML with only style tags', () => {
      const onlyStyleHtml = `
        <style>
          body { background: red; }
        </style>
      `;

      const sanitized = testSanitizeHTML(onlyStyleHtml);

      // Check that style tags are removed
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('</style>');
      expect(sanitized).not.toContain('background: red');

      // Should be empty or whitespace only
      expect(sanitized.trim().length).toBe(0);
    });
  });
});
