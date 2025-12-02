// Browser polyfill for Node.js 'node:async_hooks' module
// Provides a minimal AsyncLocalStorage implementation for browser compatibility

export class AsyncLocalStorage<T = any> {
  private store: Map<number, T> = new Map();
  private currentId = 0;

  getStore(): T | undefined {
    return this.store.get(this.currentId);
  }

  run<R>(store: T, callback: () => R): R {
    const prevId = this.currentId;
    this.currentId = Math.random(); // Simple ID generation for browser
    this.store.set(this.currentId, store);
    try {
      return callback();
    } finally {
      this.store.delete(this.currentId);
      this.currentId = prevId;
    }
  }

  enterWith(store: T): void {
    this.currentId = Math.random();
    this.store.set(this.currentId, store);
  }

  exit(callback: () => void): void {
    const prevId = this.currentId;
    this.currentId = 0;
    try {
      callback();
    } finally {
      this.currentId = prevId;
    }
  }

  disable(): void {
    // No-op in browser
  }

  enable(): void {
    // No-op in browser
  }
}

// Export both named and default exports to match different import patterns
// Some code imports as: import { AsyncLocalStorage } from 'node:async_hooks'
// Other code imports as: import AsyncLocalStorage from 'node:async_hooks'
export default AsyncLocalStorage;
