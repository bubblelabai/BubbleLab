// ESM wrapper for ts-scope-manager
// Browser-compatible: Uses direct import - bundlers (Vite/webpack) handle CommonJS conversion
// For Node.js, conditionally uses createRequire only for resetIds

// Import directly - bundlers will handle CommonJS conversion at build time
// In browser (Vite), this gets transformed and works fine
// In Node.js ESM, this also works if the package is properly configured
import * as scopeManagerModule from '@typescript-eslint/scope-manager';

// Handle CommonJS default export if present
const scope = scopeManagerModule.default || scopeManagerModule;

// resetIds is in an internal module and requires Node.js require.resolve
// In browser, we provide a no-op (resetIds is mainly for test determinism)
// In Node.js, we'll try to load it, but if it fails, use no-op
// Note: We can't use top-level await, so resetIds loading is best-effort
let resetIds = () => {};

// Try to load resetIds in Node.js only
// Use an IIFE with async to handle the dynamic import
(async () => {
  try {
    // Check if we're in Node.js
    if (typeof process !== 'undefined' && process.versions?.node) {
      // Use createRequire via dynamic import
      const { createRequire } = await import('module');
      const requireFn = createRequire(import.meta.url);
      const { dirname, join } = await import('path');
      const scopeManagerPath = requireFn.resolve('@typescript-eslint/scope-manager');
      const idPath = join(dirname(scopeManagerPath), 'ID.js');
      const idModule = requireFn(idPath);
      resetIds = idModule.resetIds;
    }
  } catch (_e) {
    // resetIds is optional - use no-op if not available (especially in browser)
    resetIds = () => {};
  }
})();

// Re-export everything as named exports
export const {
  analyze,
  PatternVisitor,
  Reference,
  Visitor,
  ScopeManager,
  CatchClauseDefinition,
  ClassNameDefinition,
  DefinitionType,
  FunctionNameDefinition,
  ImplicitGlobalVariableDefinition,
  ImportBindingDefinition,
  ParameterDefinition,
  TSEnumMemberDefinition,
  TSEnumNameDefinition,
  TSModuleNameDefinition,
  TypeDefinition,
  VariableDefinition,
  DefinitionBase,
  Scope,
  ScopeType,
  BlockScope,
  CatchScope,
  ClassFieldInitializerScope,
  ClassScope,
  ClassStaticBlockScope,
  ConditionalTypeScope,
  ForScope,
  FunctionExpressionNameScope,
  FunctionScope,
  FunctionTypeScope,
  GlobalScope,
  MappedTypeScope,
  ModuleScope,
  SwitchScope,
  TSEnumScope,
  TSModuleScope,
  TypeScope,
  WithScope,
  Variable
} = scope;

export { resetIds };
