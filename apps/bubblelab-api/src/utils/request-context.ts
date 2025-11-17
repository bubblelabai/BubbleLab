import { AsyncLocalStorage } from 'async_hooks';
import type {
  PLAN_TYPE,
  FEATURE_TYPE,
} from '../services/subscription-validation.js';
import { AppType } from '../config/clerk-apps.js';

/**
 * Request context that can be accessed globally within an async call chain
 * This uses AsyncLocalStorage to store context that's automatically available
 * in the same async execution context without needing to pass it through function parameters
 */
export interface RequestContext {
  userId?: string;
  userPlan?: PLAN_TYPE;
  userFeatures?: FEATURE_TYPE[];
  appType?: AppType;
}

/**
 * AsyncLocalStorage instance for storing request context
 * This allows accessing context from anywhere in the async call chain
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with request context
 * This should be called at the entry point (middleware) to establish the context
 */
export function runWithContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>
): Promise<T> {
  return Promise.resolve(requestContextStorage.run(context, fn));
}

/**
 * Get the current user's subscription info from context
 */
export function getCurrentUserInfo():
  | {
      plan: PLAN_TYPE;
      features: FEATURE_TYPE[];
      appType: AppType;
      userId: string;
    }
  | undefined {
  const context = requestContextStorage.getStore();
  if (
    !context?.userPlan ||
    !context?.userFeatures ||
    !context?.appType ||
    !context?.userId
  ) {
    return undefined;
  }
  return {
    plan: context.userPlan,
    appType: context.appType,
    userId: context.userId,
    features: context.userFeatures,
  };
}
