import type * as monaco from 'monaco-editor';

// Import TypeScript lib files as raw strings (bundled at build time)
import es2015Types from '../../public/typescript-libs/lib.es2015.d.ts?raw';
import domTypes from '../../public/typescript-libs/lib.dom.d.ts?raw';
import es2020FullTypes from '../../public/typescript-libs/lib.es2020.full.d.ts?raw';
import bufferTypes from '../../public/typescript-libs/buffer.d.ts?raw';

// Comprehensive Zod type definitions (inline - no CDN fetch needed)
const zodTypes = `
declare module 'zod' {
  export interface ZodType<Output = any, Def = any, Input = Output> {
    _type: any;
    _output: Output;
    _input: Input;
    _def: Def;
    parse(input: unknown): Output;
    safeParse(input: unknown): { success: true; data: Output } | { success: false; error: any };
    optional(): ZodOptional<this>;
    nullable(): ZodNullable<this>;
    nullish(): ZodOptional<ZodNullable<this>>;
    array(): ZodArray<this>;
    default(def: () => Output): ZodDefault<this>;
    refine<RefinedOutput extends Output>(
      check: (arg: Output) => arg is RefinedOutput,
      message?: string | { message?: string; path?: (string | number)[] }
    ): ZodEffects<this, RefinedOutput, Input>;
    refine(
      check: (arg: Output) => unknown,
      message?: string | { message?: string; path?: (string | number)[] }
    ): ZodEffects<this, Output, Input>;
    transform<NewOutput>(
      transform: (arg: Output) => NewOutput
    ): ZodEffects<this, NewOutput, Input>;
    describe(description: string): this;
  }

  export interface ZodString extends ZodType<string> {
    min(minLength: number, message?: string): ZodString;
    max(maxLength: number, message?: string): ZodString;
    length(len: number, message?: string): ZodString;
    email(message?: string): ZodString;
    url(message?: string): ZodString;
    uuid(message?: string): ZodString;
    regex(regex: RegExp, message?: string): ZodString;
    nonempty(message?: string): ZodString;
    trim(): ZodString;
    toLowerCase(): ZodString;
    toUpperCase(): ZodString;
  }

  export interface ZodNumber extends ZodType<number> {
    min(minimum: number, message?: string): ZodNumber;
    max(maximum: number, message?: string): ZodNumber;
    int(message?: string): ZodNumber;
    positive(message?: string): ZodNumber;
    negative(message?: string): ZodNumber;
    nonpositive(message?: string): ZodNumber;
    nonnegative(message?: string): ZodNumber;
    finite(message?: string): ZodNumber;
    safe(message?: string): ZodNumber;
  }

  export interface ZodBoolean extends ZodType<boolean> {}

  export interface ZodArray<T extends ZodTypeAny> extends ZodType<T['_output'][]> {
    element: T;
    min(minLength: number, message?: string): ZodArray<T>;
    max(maxLength: number, message?: string): ZodArray<T>;
    length(len: number, message?: string): ZodArray<T>;
    nonempty(message?: string): ZodArray<T>;
  }

  export interface ZodObject<T extends ZodRawShape> extends ZodType<{ [k in keyof T]: T[k]['_output'] }> {
    shape: T;
    keyof(): ZodEnum<[keyof T, ...(keyof T)[]]>;
    extend<U extends ZodRawShape>(shape: U): ZodObject<T & U>;
    merge<U extends ZodRawShape>(shape: U): ZodObject<T & U>;
    pick<U extends keyof T>(keys: U[]): ZodObject<Pick<T, U>>;
    omit<U extends keyof T>(keys: U[]): ZodObject<Omit<T, U>>;
    partial(): ZodObject<{ [k in keyof T]: ZodOptional<T[k]> }>;
    deepPartial(): ZodObject<{ [k in keyof T]: ZodOptional<ZodType<T[k]['_output']>> }>;
    required(): ZodObject<{ [k in keyof T]: ZodType<T[k]['_output']> }>;
  }

  export interface ZodOptional<T extends ZodTypeAny> extends ZodType<T['_output'] | undefined> {
    unwrap(): T;
  }

  export interface ZodNullable<T extends ZodTypeAny> extends ZodType<T['_output'] | null> {
    unwrap(): T;
  }

  export interface ZodDefault<T extends ZodTypeAny> extends ZodType<T['_output']> {
    removeDefault(): T;
  }

  export interface ZodEnum<T extends readonly [string, ...string[]]> extends ZodType<T[number]> {
    options: T;
  }

  export interface ZodLiteral<T extends string | number | boolean | null> extends ZodType<T> {
    value: T;
  }

  export interface ZodUnion<T extends readonly [ZodTypeAny, ...ZodTypeAny[]]> extends ZodType<T[number]['_output']> {
    options: T;
  }

  export interface ZodDiscriminatedUnion<
    Discriminator extends string,
    T extends readonly [ZodObject<any>, ...ZodObject<any>[]]
  > extends ZodType<T[number]['_output']> {
    discriminator: Discriminator;
    options: T;
  }

  export interface ZodRecord<K extends ZodTypeAny, V extends ZodTypeAny> extends ZodType<Record<K['_output'], V['_output']>> {
    keySchema: K;
    valueSchema: V;
  }

  export interface ZodMap<K extends ZodTypeAny, V extends ZodTypeAny> extends ZodType<Map<K['_output'], V['_output']>> {
    keySchema: K;
    valueSchema: V;
  }

  export interface ZodSet<T extends ZodTypeAny> extends ZodType<Set<T['_output']>> {
    valueSchema: T;
  }

  export interface ZodFunction<
    Args extends ZodTuple<any>,
    Returns extends ZodTypeAny
  > extends ZodType<(...args: Args['_output']) => Returns['_output']> {
    args: Args;
    returns: Returns;
  }

  export interface ZodTuple<T extends readonly ZodTypeAny[]> extends ZodType<{ [k in keyof T]: T[k]['_output'] }> {
    items: T;
  }

  export interface ZodEffects<
    Output,
    NewOutput,
    Input
  > extends ZodType<NewOutput, any, Input> {
    innerType(): ZodType<Output>;
  }

  export type ZodTypeAny = ZodType<any, any, any>;
  export type ZodRawShape = { [k: string]: ZodTypeAny };

  export const z: {
    string(): ZodString;
    number(): ZodNumber;
    boolean(): ZodBoolean;
    array<T extends ZodTypeAny>(schema: T): ZodArray<T>;
    object<T extends ZodRawShape>(shape: T): ZodObject<T>;
    enum<T extends readonly [string, ...string[]]>(values: T): ZodEnum<T>;
    literal<T extends string | number | boolean | null>(value: T): ZodLiteral<T>;
    union<T extends readonly [ZodTypeAny, ...ZodTypeAny[]]>(options: T): ZodUnion<T>;
    discriminatedUnion<Discriminator extends string, T extends readonly [ZodObject<any>, ...ZodObject<any>[]]>(
      discriminator: Discriminator,
      options: T
    ): ZodDiscriminatedUnion<Discriminator, T>;
    record<K extends ZodTypeAny, V extends ZodTypeAny>(keySchema: K, valueSchema: V): ZodRecord<K, V>;
    map<K extends ZodTypeAny, V extends ZodTypeAny>(keySchema: K, valueSchema: V): ZodMap<K, V>;
    set<T extends ZodTypeAny>(valueSchema: T): ZodSet<T>;
    function<Args extends ZodTuple<any>, Returns extends ZodTypeAny>(
      args: Args,
      returns: Returns
    ): ZodFunction<Args, Returns>;
    tuple<T extends readonly ZodTypeAny[]>(schemas: T): ZodTuple<T>;
    effects<Output, NewOutput, Input>(
      schema: ZodType<Output, any, Input>,
      transform: (arg: Output) => NewOutput
    ): ZodEffects<Output, NewOutput, Input>;
    any(): ZodType<any>;
    unknown(): ZodType<unknown>;
    never(): ZodType<never>;
    void(): ZodType<void>;
    null(): ZodType<null>;
    undefined(): ZodType<undefined>;
    date(): ZodType<Date>;
    bigint(): ZodType<bigint>;
    symbol(): ZodType<symbol>;
    lazy<T extends ZodTypeAny>(getter: () => T): T;
    catch<T extends ZodTypeAny>(schema: T, fallback: T['_output']): T;
    transform<T extends ZodTypeAny, NewOutput>(
      schema: T,
      transform: (arg: T['_output']) => NewOutput
    ): ZodEffects<T, NewOutput, T['_input']>;
    preprocess<PreprocessInput, Input, Output>(
      preprocess: (arg: PreprocessInput) => Input,
      schema: ZodType<Output, any, Input>
    ): ZodType<Output, any, PreprocessInput>;
    pipeline<Input, Output>(
      ...schemas: [ZodType<Output, any, Input>, ...ZodTypeAny[]]
    ): ZodType<Output, any, Input>;
    custom<T>(check: (arg: unknown) => arg is T, message?: string): ZodType<T>;
    custom<T>(check: (arg: unknown) => unknown, message?: string): ZodType<T>;
  };
}
`;

// Namespace merge to support z.infer<>, z.input<>, z.output<>
// This namespace will merge with the 'z' const exported from the 'zod' module
// This allows: import { z } from 'zod'; type X = z.infer<typeof schema>;
const zodNamespaceMerge = `
declare namespace z {
  type infer<T extends import('zod').ZodTypeAny> = T['_output'];
  type input<T extends import('zod').ZodTypeAny> = T['_input'];
  type output<T extends import('zod').ZodTypeAny> = T['_output'];
}
`;

// JSON Schema to Zod converter types
const jsonSchemaConverterTypes = `
declare global {
  interface JsonSchemaProperty {
    type: string;
    description?: string;
    required?: boolean;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    items?: JsonSchemaProperty;
    properties?: Record<string, JsonSchemaProperty>;
  }

  interface JsonSchema {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  }

  class JsonSchemaToZodConverter {
    static convert(jsonSchema: JsonSchema): Record<string, any>;
  }
}
`;

/**
 * Loads all TypeScript and custom type definitions into Monaco Editor.
 * All types are bundled at build time - no runtime fetches needed.
 */
export async function loadMonacoTypes(
  monacoInstance: typeof monaco
): Promise<void> {
  try {
    // Load TypeScript ES2015 lib (includes Promise, etc.)
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      es2015Types,
      'file:///node_modules/typescript/lib/lib.es2015.d.ts'
    );
    // Load DOM lib
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      domTypes,
      'file:///node_modules/typescript/lib/lib.dom.d.ts'
    ); // Load ES2020 full lib (includes Array.flat, etc.)
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      es2020FullTypes,
      'file:///node_modules/typescript/lib/lib.es2020.full.d.ts'
    );
    // Load Buffer types
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      bufferTypes,
      'file:///node_modules/@types/node/buffer.d.ts'
    ); // Load Zod types (inline, no fetch needed)
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      zodTypes,
      'file:///node_modules/zod/index.d.ts'
    ); // Load Zod namespace merge for z.infer support
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      zodNamespaceMerge,
      'file:///node_modules/zod/namespace.d.ts'
    );
    // Load JSON Schema to Zod converter types
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      jsonSchemaConverterTypes,
      'file:///utils/json-schema-converter.d.ts'
    );
  } catch (error) {
    console.error('❌ Failed to load type definitions:', error);
    throw error;
  }
}

/**
 * Loads @bubblelab/bubble-core types from the public directory.
 * This is kept as a separate function since it needs runtime fetch.
 */
export async function loadBubbleCoreTypes(
  monacoInstance: typeof monaco
): Promise<void> {
  try {
    const response = await fetch('/bubble-types.txt');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bundledTypes = await response.text(); // Find the module declaration and remove it
    const moduleDeclarationMatch = bundledTypes.match(
      /declare module '@bubblelab\/bubble-core'[\s\S]*$/
    );
    const moduleDeclarationStart = moduleDeclarationMatch
      ? bundledTypes.indexOf(moduleDeclarationMatch[0])
      : bundledTypes.length;

    // Extract only the actual type definitions (before the module declaration)
    const cleanedTypes = bundledTypes
      .substring(0, moduleDeclarationStart)
      .trim();

    // Add our bundled types as the @bubblelab/bubble-core module
    const moduleDeclaration = `
declare module '@bubblelab/bubble-core' {
${cleanedTypes.replace(/^/gm, '  ')}
}
`;

    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      moduleDeclaration,
      'file:///node_modules/@types/nodex__bubble-core/index.d.ts'
    );
  } catch (error) {
    console.error('❌ Failed to load bundled types:', error);
  }
}
