import { BubbleFactory } from '@bubblelab/bubble-core';

// Create a singleton factory instance that will be initialized once
let bubbleFactoryInstance: BubbleFactory | null = null;
let initializationPromise: Promise<BubbleFactory> | null = null;

/**
 * Get the singleton BubbleFactory instance
 * Ensures the factory is initialized with defaults before returning
 */
export async function getBubbleFactory(): Promise<BubbleFactory> {
  if (bubbleFactoryInstance && bubbleFactoryInstance.list().length > 0) {
    return bubbleFactoryInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const instance = new BubbleFactory();
    await instance.registerDefaults();
    bubbleFactoryInstance = instance;
    return instance;
  })().finally(() => {
    // If initialization failed, allow retry on next call
    initializationPromise = null;
  });
  return initializationPromise;
}

// Note: legacy initializeFactory removed; use getBubbleFactory()
