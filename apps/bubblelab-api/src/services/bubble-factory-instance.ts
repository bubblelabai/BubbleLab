import { BubbleFactory } from '@bubblelab/bubble-core';

// Create a singleton factory instance that will be initialized once
let bubbleFactoryInstance: BubbleFactory | null = null;
let initializationPromise: Promise<BubbleFactory> | null = null;

/**
 * Get the singleton BubbleFactory instance
 * Ensures the factory is initialized with defaults before returning
 */
export async function getBubbleFactory(): Promise<BubbleFactory> {
  if (bubbleFactoryInstance) {
    return bubbleFactoryInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = initializeFactory();
  return initializationPromise;
}

async function initializeFactory(): Promise<BubbleFactory> {
  if (bubbleFactoryInstance) {
    return bubbleFactoryInstance;
  }

  bubbleFactoryInstance = new BubbleFactory();
  await bubbleFactoryInstance.registerDefaults();
  return bubbleFactoryInstance;
}
