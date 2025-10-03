import { describe, it, expect, beforeAll } from 'vitest';
import { getFixture } from '../../tests/fixtures/index.js';
import { getWarmChecker, validateScript } from './BubbleValidator.js';

describe('LanguageService typechecker - validateScript', () => {
  beforeAll(() => {
    // Warm the checker once per test run for fast subsequent checks
    getWarmChecker('./tsconfig.json');
  });

  it('passes on valid HelloWorld flow', () => {
    const code = getFixture('hello-world');
    const result = validateScript(code, {
      fileName: 'virtual/hello-world.ts',
    });
    console.log(result);
    expect(result.success).toBe(true);
    expect(Object.keys(result.errors || {}).length).toBe(0);
  });

  it('fails on invalida parameter in HelloWorld flow', () => {
    const code = getFixture('hello-world-wrong-para');
    const result = validateScript(code, {
      fileName: 'virtual/hello-world-invalid-parameter.ts',
    });
    console.log(result);
  });

  it('fails on wrong types in HelloWorld flow', () => {
    const code = getFixture('hello-world-wrong-type');
    const result = validateScript(code, {
      fileName: 'virtual/hello-world-wrong-para.ts',
    });
    console.log(result);
    expect(result.success).toBe(false);
    expect(Object.keys(result.errors || {}).length).toBeGreaterThan(0);
  });

  it('passes on valid RedditLeadFinder flow', () => {
    const code = getFixture('reddit-lead-finder');
    const result = validateScript(code, {
      fileName: 'virtual/reddit-lead-finder.ts',
    });
    console.log(result);
    expect(result.success).toBe(true);
    expect(Object.keys(result.errors || {}).length).toBe(0);
  });
});
