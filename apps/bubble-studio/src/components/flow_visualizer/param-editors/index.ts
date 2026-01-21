/**
 * Parameter Editor Components
 *
 * This module provides schema-aware parameter editing components for bubbles.
 * Components handle different parameter types including:
 * - Simple types: string, number, boolean
 * - Enum types: rendered as dropdowns
 * - Discriminated unions: operation-based schemas with dynamic param sets
 */

// Legacy param editor (uses extractParamValue)
export { ParamEditor } from './ParamEditor';
export type { ParamEditorProps } from './ParamEditor';

// Schema-aware param editor (uses JSON Schema)
export { SchemaParamEditor } from './SchemaParamEditor';
export type { SchemaParamEditorProps } from './SchemaParamEditor';

// Discriminated union editor (handles anyOf with operation)
export { DiscriminatedUnionEditor } from './DiscriminatedUnionEditor';
export type { DiscriminatedUnionEditorProps } from './DiscriminatedUnionEditor';

// Main orchestrator component
export { SchemaParamsSection } from './SchemaParamsSection';
export type { SchemaParamsSectionProps } from './SchemaParamsSection';
