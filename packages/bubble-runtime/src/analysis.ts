// Browser-safe analysis entrypoint for @bubblelab/bubble-runtime
// Re-exports BubbleScript and related types without pulling in Node-specific runtime code.

export { BubbleScript } from './parse/BubbleScript';
export type { MethodInvocationInfo } from './parse/BubbleScript';
export { BubbleInjector } from './injection/BubbleInjector';
export type {
  UserCredentialWithId,
  CredentialInjectionResult,
} from './injection/BubbleInjector';
