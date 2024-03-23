interface SchemaObject {
  [key: string]: any;
}

function nestKeysWithDot(schema: SchemaObject): SchemaObject {
  const result: SchemaObject = {
    properties: {},
  };

  for (const key in schema.properties) {
    if (key.includes(".")) {
      const [parentKey, nestedKey] = key.split(".");
      result.properties[parentKey] = result.properties[parentKey] || {
        properties: {},
      };
      result.properties[parentKey].properties[nestedKey] = schema.properties[key];
    } else {
      result.properties[key] = schema.properties[key];
    }
  }

  return result;
}

// Example usage
const schema = {
  properties: {
    "testresolver.startupDelay": {
      description: "If set, the resolver will delay for the given amount of seconds. Use ths setting for testing a slow resolver",
      type: "number",
      default: 0,
    },
    "testresolver.startupError": {
      description: "If set, the resolver will fail. Use ths setting for testing the failure of a resolver.",
      type: "boolean",
      default: false,
    },
    "testresolver.supportPublicPorts": {
      description: "If set, the test resolver tunnel factory will support mock public ports. Forwarded ports will not actually be public. Requires reload.",
      type: "boolean",
      default: false,
    },
  },
};

const modifiedSchema = nestKeysWithDot(schema);
console.log(JSON.stringify(modifiedSchema, null, 2));
