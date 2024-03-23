import type {
  JSONSchema4,
  JSONSchema4Type,
  JSONSchema4TypeName,
} from "json-schema";

// export const getRootSchema = memoize((schema: LinkedJSONSchema): LinkedJSONSchema => {
//   const parent = schema[Parent]
//   if (!parent) {
//     return schema
//   }
//   return getRootSchema(parent)
// })

// export function isBoolean(schema: LinkedJSONSchema | JSONSchemaType): schema is boolean {
//   return schema === true || schema === false
// }

// export function isPrimitive(schema: LinkedJSONSchema | JSONSchemaType): schema is JSONSchemaType {
//   return !isPlainObject(schema)
// }

// export function isCompound(schema: JSONSchema): boolean {
//   return Array.isArray(schema.type) || 'anyOf' in schema || 'oneOf' in schema
// }

export type SchemaType =
  | "ALL_OF"
  | "UNNAMED_SCHEMA"
  | "ANY"
  | "ANY_OF"
  | "BOOLEAN"
  | "NAMED_ENUM"
  | "NAMED_SCHEMA"
  | "NEVER"
  | "NULL"
  | "NUMBER"
  | "STRING"
  | "OBJECT"
  | "ONE_OF"
  | "TYPED_ARRAY"
  | "REFERENCE"
  | "UNION"
  | "UNNAMED_ENUM"
  | "UNTYPED_ARRAY"
  | "CUSTOM_TYPE";

export type JSONSchemaTypeName = JSONSchema4TypeName;
export type JSONSchemaType = JSONSchema4Type;

export interface JSONSchema extends JSONSchema4 {
  /**
   * schema extension to support numeric enums
   */
  tsEnumNames?: string[];
  /**
   * schema extension to support custom types
   */
  tsType?: string;
  /**
   * property exists at least in https://json-schema.org/draft/2019-09/json-schema-validation.html#rfc.section.9.3
   */
  deprecated?: boolean;
}

export const Parent = Symbol("Parent");

export interface LinkedJSONSchema extends JSONSchema {
  /**
   * A reference to this schema's parent node, for convenience.
   * `null` when this is the root schema.
   */
  [Parent]: LinkedJSONSchema | null;

  additionalItems?: boolean | LinkedJSONSchema;
  additionalProperties?: boolean | LinkedJSONSchema;
  items?: LinkedJSONSchema | LinkedJSONSchema[];
  definitions?: {
    [k: string]: LinkedJSONSchema;
  };
  properties?: {
    [k: string]: LinkedJSONSchema;
  };
  patternProperties?: {
    [k: string]: LinkedJSONSchema;
  };
  dependencies?: {
    [k: string]: LinkedJSONSchema | string[];
  };
  allOf?: LinkedJSONSchema[];
  anyOf?: LinkedJSONSchema[];
  oneOf?: LinkedJSONSchema[];
  not?: LinkedJSONSchema;
}

export interface NormalizedJSONSchema extends LinkedJSONSchema {
  additionalItems?: boolean | NormalizedJSONSchema;
  additionalProperties: boolean | NormalizedJSONSchema;
  extends?: string[];
  items?: NormalizedJSONSchema | NormalizedJSONSchema[];
  $defs?: {
    [k: string]: NormalizedJSONSchema;
  };
  properties?: {
    [k: string]: NormalizedJSONSchema;
  };
  patternProperties?: {
    [k: string]: NormalizedJSONSchema;
  };
  dependencies?: {
    [k: string]: NormalizedJSONSchema | string[];
  };
  allOf?: NormalizedJSONSchema[];
  anyOf?: NormalizedJSONSchema[];
  oneOf?: NormalizedJSONSchema[];
  not?: NormalizedJSONSchema;
  required: string[];

  // Removed by normalizer
  definitions: never;
  id: never;
}

export interface EnumJSONSchema extends NormalizedJSONSchema {
  enum: any[];
}

export interface NamedEnumJSONSchema extends NormalizedJSONSchema {
  tsEnumNames: string[];
}

export interface SchemaSchema extends NormalizedJSONSchema {
  properties: {
    [k: string]: NormalizedJSONSchema;
  };
  required: string[];
}

export interface JSONSchemaWithDefinitions extends NormalizedJSONSchema {
  $defs: {
    [k: string]: NormalizedJSONSchema;
  };
}

export interface CustomTypeJSONSchema extends NormalizedJSONSchema {
  tsType: string;
}

export type AST_TYPE = AST["type"];

export type AST =
  | TAny
  | TArray
  | TBoolean
  | TEnum
  | TInterface
  | TNamedInterface
  | TIntersection
  | TLiteral
  | TNever
  | TNumber
  | TNull
  | TObject
  | TReference
  | TString
  | TTuple
  | TUnion
  | TUnknown
  | TCustomType;

export interface AbstractAST {
  comment?: string;
  keyName?: string;
  standaloneName?: string;
  type: AST_TYPE;
  deprecated?: boolean;
}

export type ASTWithComment = AST & { comment: string };
export type ASTWithName = AST & { keyName: string };
export type ASTWithStandaloneName = AST & { standaloneName: string };

export function hasComment(ast: AST): ast is ASTWithComment {
  return (
    ("comment" in ast && ast.comment != null && ast.comment !== "") ||
    // Compare to true because ast.deprecated might be undefined
    ("deprecated" in ast && ast.deprecated === true)
  );
}

export function hasStandaloneName(ast: AST): ast is ASTWithStandaloneName {
  return (
    "standaloneName" in ast &&
    ast.standaloneName != null &&
    ast.standaloneName !== ""
  );
}

/// /////////////////////////////////////////     types

export interface TAny extends AbstractAST {
  type: "ANY";
}

export interface TArray extends AbstractAST {
  type: "ARRAY";
  params: AST;
}

export interface TBoolean extends AbstractAST {
  type: "BOOLEAN";
}

export interface TEnum extends AbstractAST {
  standaloneName: string;
  type: "ENUM";
  params: TEnumParam[];
}

export interface TEnumParam {
  ast: AST;
  keyName: string;
}

export interface TInterface extends AbstractAST {
  type: "INTERFACE";
  params: TInterfaceParam[];
  superTypes: TNamedInterface[];
}

export interface TNamedInterface extends AbstractAST {
  standaloneName: string;
  type: "INTERFACE";
  params: TInterfaceParam[];
  superTypes: TNamedInterface[];
}

export interface TNever extends AbstractAST {
  type: "NEVER";
}

export interface TInterfaceParam {
  ast: AST;
  keyName: string;
  isRequired: boolean;
  isPatternProperty: boolean;
  isUnreachableDefinition: boolean;
}

export interface TIntersection extends AbstractAST {
  type: "INTERSECTION";
  params: AST[];
}

export interface TLiteral extends AbstractAST {
  params: JSONSchema4Type;
  type: "LITERAL";
}

export interface TNumber extends AbstractAST {
  type: "NUMBER";
}

export interface TNull extends AbstractAST {
  type: "NULL";
}

export interface TObject extends AbstractAST {
  type: "OBJECT";
}

export interface TReference extends AbstractAST {
  type: "REFERENCE";
  params: string;
}

export interface TString extends AbstractAST {
  type: "STRING";
}

export interface TTuple extends AbstractAST {
  type: "TUPLE";
  params: AST[];
  spreadParam?: AST;
  minItems: number;
  maxItems?: number;
}

export interface TUnion extends AbstractAST {
  type: "UNION";
  params: AST[];
}

export interface TUnknown extends AbstractAST {
  type: "UNKNOWN";
}

export interface TCustomType extends AbstractAST {
  type: "CUSTOM_TYPE";
  params: string;
}

/// /////////////////////////////////////////     literals

export const T_ANY: TAny = {
  type: "ANY",
};

export const T_ANY_ADDITIONAL_PROPERTIES: TAny & ASTWithName = {
  keyName: "[k: string]",
  type: "ANY",
};

export const T_UNKNOWN: TUnknown = {
  type: "UNKNOWN",
};

export const T_UNKNOWN_ADDITIONAL_PROPERTIES: TUnknown & ASTWithName = {
  keyName: "[k: string]",
  type: "UNKNOWN",
};
