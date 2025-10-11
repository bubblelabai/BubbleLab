// ESM wrapper for ts-scope-manager
import { createRequire } from 'module';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const scope = require('@typescript-eslint/scope-manager');

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

// Also export resetIds from internal ID module
let resetIds;
try {
  const scopeManagerPath = require.resolve('@typescript-eslint/scope-manager');
  const idPath = join(dirname(scopeManagerPath), 'ID.js');
  const idModule = require(idPath);
  resetIds = idModule.resetIds;
} catch (_e) {
  // noop if upstream layout changes
  resetIds = () => {};
}

export { resetIds };
