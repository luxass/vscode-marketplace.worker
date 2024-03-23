import { deburr, isPlainObject, memoize, trim, upperFirst } from "lodash";
import {
  type JSONSchema,
  type JSONSchemaType,
  type LinkedJSONSchema,
  Parent,
} from "./types";

export const getRootSchema = memoize(
  (schema: LinkedJSONSchema): LinkedJSONSchema => {
    const parent = schema[Parent];
    if (!parent) {
      return schema;
    }
    return getRootSchema(parent);
  },
);

export function isBoolean(
  schema: LinkedJSONSchema | JSONSchemaType,
): schema is boolean {
  return schema === true || schema === false;
}

export function isPrimitive(
  schema: LinkedJSONSchema | JSONSchemaType,
): schema is JSONSchemaType {
  return !isPlainObject(schema);
}

export function isCompound(schema: JSONSchema): boolean {
  return Array.isArray(schema.type) || "anyOf" in schema || "oneOf" in schema;
}

/**
 * Convert a string that might contain spaces or special characters to one that
 * can safely be used as a TypeScript interface or enum name.
 */
export function toSafeString(string: string) {
  // identifiers in javaScript/ts:
  // First character: a-zA-Z | _ | $
  // Rest: a-zA-Z | _ | $ | 0-9

  return upperFirst(
    // remove accents, umlauts, ... by their basic latin letters
    deburr(string)
      // replace chars which are not valid for typescript identifiers with whitespace
      .replace(/(^\s*[^a-zA-Z_$])|([^a-zA-Z_$\d])/g, " ")
      // uppercase leading underscores followed by lowercase
      .replace(/^_[a-z]/g, (match) => match.toUpperCase())
      // remove non-leading underscores followed by lowercase (convert snake_case)
      .replace(/_[a-z]/g, (match) =>
        match.substr(1, match.length).toUpperCase())
      // uppercase letters after digits, dollars
      .replace(/([\d$]+[a-zA-Z])/g, (match) => match.toUpperCase())
      // uppercase first letter after whitespace
      .replace(/\s+([a-zA-Z])/g, (match) => trim(match.toUpperCase()))
      // remove remaining whitespace
      .replace(/\s/g, ""),
  );
}

export function generateName(from: string, usedNames: Set<string>) {
  let name = toSafeString(from);
  if (!name) {
    name = "NoName";
  }

  // increment counter until we find a free name
  if (usedNames.has(name)) {
    let counter = 1;
    let nameWithCounter = `${name}${counter}`;
    while (usedNames.has(nameWithCounter)) {
      nameWithCounter = `${name}${counter}`;
      counter++;
    }
    name = nameWithCounter;
  }

  usedNames.add(name);
  return name;
}

/**
 * Removes the schema's `default` property if it doesn't match the schema's `type` property.
 * Useful when parsing unions.
 *
 * Mutates `schema`.
 */
export function maybeStripDefault(schema: LinkedJSONSchema): LinkedJSONSchema {
  if (!("default" in schema)) {
    return schema;
  }

  switch (schema.type) {
    case "array":
      if (Array.isArray(schema.default)) {
        return schema;
      }
      break;
    case "boolean":
      if (typeof schema.default === "boolean") {
        return schema;
      }
      break;
    case "integer":
    case "number":
      if (typeof schema.default === "number") {
        return schema;
      }
      break;
    case "string":
      if (typeof schema.default === "string") {
        return schema;
      }
      break;
    case "null":
      if (schema.default === null) {
        return schema;
      }
      break;
    case "object":
      if (isPlainObject(schema.default)) {
        return schema;
      }
      break;
  }
  delete schema.default;
  return schema;
}

/**
 * Removes the schema's `$id`, `name`, and `description` properties
 * if they exist.
 * Useful when parsing intersections.
 *
 * Mutates `schema`.
 */
export function maybeStripNameHints(schema: JSONSchema): JSONSchema {
  if ("$id" in schema) {
    delete schema.$id;
  }
  if ("description" in schema) {
    delete schema.description;
  }
  if ("name" in schema) {
    delete schema.name;
  }
  return schema;
}

export function escapeBlockComment(schema: JSONSchema) {
  const replacer = "* /";
  if (schema === null || typeof schema !== "object") {
    return;
  }
  for (const key of Object.keys(schema)) {
    if (key === "description" && typeof schema[key] === "string") {
      schema[key] = schema[key]!.replace(/\*\//g, replacer);
    }
  }
}

export function appendToDescription(existingDescription: string | undefined, ...values: string[]): string {
  if (existingDescription) {
    return `${existingDescription}\n\n${values.join("\n")}`;
  }
  return values.join("\n");
}

// keys that shouldn't be traversed by the catchall step
const BLACKLISTED_KEYS = new Set([
  "id",
  "$defs",
  "$id",
  "$schema",
  "title",
  "description",
  "default",
  "multipleOf",
  "maximum",
  "exclusiveMaximum",
  "minimum",
  "exclusiveMinimum",
  "maxLength",
  "minLength",
  "pattern",
  "additionalItems",
  "items",
  "maxItems",
  "minItems",
  "uniqueItems",
  "maxProperties",
  "minProperties",
  "required",
  "additionalProperties",
  "definitions",
  "properties",
  "patternProperties",
  "dependencies",
  "enum",
  "type",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
]);

function traverseObjectKeys(
  obj: Record<string, LinkedJSONSchema>,
  callback: (schema: LinkedJSONSchema, key: string | null) => void,
  processed: Set<LinkedJSONSchema>,
) {
  Object.keys(obj).forEach((k) => {
    if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) {
      traverse(obj[k], callback, processed, k);
    }
  });
}

function traverseArray(
  arr: LinkedJSONSchema[],
  callback: (schema: LinkedJSONSchema, key: string | null) => void,
  processed: Set<LinkedJSONSchema>,
) {
  arr.forEach((s, k) => traverse(s, callback, processed, k.toString()));
}

export function traverse(
  schema: LinkedJSONSchema,
  callback: (schema: LinkedJSONSchema, key: string | null) => void,
  processed = new Set<LinkedJSONSchema>(),
  key?: string,
): void {
  // Handle recursive schemas
  if (processed.has(schema)) {
    return;
  }

  processed.add(schema);
  callback(schema, key ?? null);

  if (schema.anyOf) {
    traverseArray(schema.anyOf, callback, processed);
  }
  if (schema.allOf) {
    traverseArray(schema.allOf, callback, processed);
  }
  if (schema.oneOf) {
    traverseArray(schema.oneOf, callback, processed);
  }
  if (schema.properties) {
    traverseObjectKeys(schema.properties, callback, processed);
  }
  if (schema.patternProperties) {
    traverseObjectKeys(schema.patternProperties, callback, processed);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    traverse(schema.additionalProperties, callback, processed);
  }
  if (schema.items) {
    const { items } = schema;
    if (Array.isArray(items)) {
      traverseArray(items, callback, processed);
    } else {
      traverse(items, callback, processed);
    }
  }
  if (schema.additionalItems && typeof schema.additionalItems === "object") {
    traverse(schema.additionalItems, callback, processed);
  }
  if (schema.dependencies) {
    if (Array.isArray(schema.dependencies)) {
      traverseArray(schema.dependencies, callback, processed);
    } else {
      traverseObjectKeys(schema.dependencies as LinkedJSONSchema, callback, processed);
    }
  }
  if (schema.definitions) {
    traverseObjectKeys(schema.definitions, callback, processed);
  }
  if (schema.$defs) {
    traverseObjectKeys(schema.$defs, callback, processed);
  }
  if (schema.not) {
    traverse(schema.not, callback, processed);
  }

  // technically you can put definitions on any key
  Object.keys(schema)
    .filter((key) => !BLACKLISTED_KEYS.has(key))
    .forEach((key) => {
      const child = schema[key];
      if (child && typeof child === "object") {
        traverseObjectKeys(child, callback, processed);
      }
    });
}

export function isSchemaLike(schema: LinkedJSONSchema) {
  if (!isPlainObject(schema)) {
    return false;
  }
  const parent = schema[Parent];
  if (parent === null) {
    return true;
  }

  const JSON_SCHEMA_KEYWORDS = [
    "$defs",
    "allOf",
    "anyOf",
    "definitions",
    "dependencies",
    "enum",
    "not",
    "oneOf",
    "patternProperties",
    "properties",
    "required",
  ];
  if (JSON_SCHEMA_KEYWORDS.some((_) => parent[_] === schema)) {
    return false;
  }

  return true;
}

export function justName(filename = ""): string {
  const lastSlashIndex = filename.lastIndexOf("/");
  const name = lastSlashIndex === -1 ? filename : filename.slice(lastSlashIndex + 1);
  return stripExtension(name);
}

export function stripExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex === -1 ? filename : filename.slice(0, lastDotIndex);
}
