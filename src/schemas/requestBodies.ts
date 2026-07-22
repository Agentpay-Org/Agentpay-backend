type JsonObject = Record<string, unknown>;

export type BodySchema = {
  parse(
    body: unknown
  ): { ok: true; value: JsonObject } | { ok: false; message: string };
  openApi: JsonObject;
};

type FieldSchema = {
  required: boolean;
  validate(value: unknown): string | undefined;
  openApi: JsonObject;
};

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function strictObjectSchema(fields: Record<string, FieldSchema>): BodySchema {
  return {
    parse(body: unknown) {
      const value = body ?? {};
      if (!isPlainObject(value)) {
        return { ok: false, message: "body must be a JSON object" };
      }

      const allowed = new Set(Object.keys(fields));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          return { ok: false, message: `unexpected field: ${key}` };
        }
      }

      for (const [key, field] of Object.entries(fields)) {
        const fieldValue = value[key];
        if (fieldValue === undefined) {
          if (field.required) {
            return {
              ok: false,
              message: field.validate(fieldValue) ?? `${key} is required`,
            };
          }
          continue;
        }
        const message = field.validate(fieldValue);
        if (message) return { ok: false, message };
      }

      return { ok: true, value };
    },
    openApi: {
      type: "object",
      additionalProperties: false,
      required: Object.entries(fields)
        .filter(([, field]) => field.required)
        .map(([key]) => key),
      properties: Object.fromEntries(
        Object.entries(fields).map(([key, field]) => [key, field.openApi])
      ),
    },
  };
}

function stringField(
  message: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  }
): FieldSchema {
  return {
    required: options.required ?? true,
    validate(value: unknown) {
      if (typeof value !== "string") return message;
      if (options.minLength !== undefined && value.length < options.minLength) {
        return message;
      }
      if (options.maxLength !== undefined && value.length > options.maxLength) {
        return message;
      }
      if (options.pattern !== undefined && !new RegExp(options.pattern).test(value)) {
        return message;
      }
      return undefined;
    },
    openApi: {
      type: "string",
      ...(options.minLength !== undefined ? { minLength: options.minLength } : {}),
      ...(options.maxLength !== undefined ? { maxLength: options.maxLength } : {}),
      ...(options.pattern !== undefined ? { pattern: options.pattern } : {}),
    },
  };
}

function integerField(
  message: string,
  options: { required?: boolean; minimum?: number; exclusiveMinimum?: number }
): FieldSchema {
  return {
    required: options.required ?? true,
    validate(value: unknown) {
      if (typeof value !== "number" || !Number.isInteger(value)) return message;
      if (options.minimum !== undefined && value < options.minimum) return message;
      if (options.exclusiveMinimum !== undefined && value <= options.exclusiveMinimum) {
        return message;
      }
      return undefined;
    },
    openApi: {
      type: "integer",
      ...(options.minimum !== undefined ? { minimum: options.minimum } : {}),
      ...(options.exclusiveMinimum !== undefined
        ? { exclusiveMinimum: options.exclusiveMinimum }
        : {}),
    },
  };
}

function booleanField(message: string): FieldSchema {
  return {
    required: true,
    validate(value: unknown) {
      return typeof value === "boolean" ? undefined : message;
    },
    openApi: { type: "boolean" },
  };
}

function stringArrayField(
  message: string,
  options: { required?: boolean; minItems?: number }
): FieldSchema {
  return {
    required: options.required ?? true,
    validate(value: unknown) {
      if (!Array.isArray(value)) return message;
      if (options.minItems !== undefined && value.length < options.minItems) {
        return message;
      }
      if (value.some((item) => typeof item !== "string")) return message;
      return undefined;
    },
    openApi: {
      type: "array",
      items: { type: "string" },
      ...(options.minItems !== undefined ? { minItems: options.minItems } : {}),
    },
  };
}

function arrayField(
  message: string,
  options: { minItems: number; maxItems: number; itemSchema: JsonObject }
): FieldSchema {
  return {
    required: true,
    validate(value: unknown) {
      if (!Array.isArray(value)) return message;
      if (value.length < options.minItems || value.length > options.maxItems) {
        return message;
      }
      return undefined;
    },
    openApi: {
      type: "array",
      minItems: options.minItems,
      maxItems: options.maxItems,
      items: options.itemSchema,
    },
  };
}

const agentField = stringField("agent must be a non-empty string up to 256 chars", {
  minLength: 1,
  maxLength: 256,
});

const serviceIdField = stringField(
  "serviceId must be a non-empty string up to 128 chars",
  { minLength: 1, maxLength: 128 }
);

const requestsField = integerField("requests must be a positive integer", {
  exclusiveMinimum: 0,
});

const priceStroopsField = integerField("priceStroops must be a non-negative integer", {
  minimum: 0,
});

const usageItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["agent", "serviceId", "requests"],
  properties: {
    agent: agentField.openApi,
    serviceId: serviceIdField.openApi,
    requests: requestsField.openApi,
  },
};

const serviceItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["serviceId", "priceStroops"],
  properties: {
    serviceId: serviceIdField.openApi,
    priceStroops: priceStroopsField.openApi,
  },
};

const positiveRuntimeConfigField = (key: string) =>
  integerField(`${key} must be a positive integer`, {
    required: false,
    exclusiveMinimum: 0,
  });

export const requestBodySchemas = {
  apiKeyCreate: strictObjectSchema({
    label: stringField("label must be a non-empty string up to 64 chars", {
      minLength: 1,
      maxLength: 64,
    }),
  }),
  bulkServices: strictObjectSchema({
    items: arrayField("items must be 1-50 entries", {
      minItems: 1,
      maxItems: 50,
      itemSchema: serviceItemSchema,
    }),
  }),
  bulkUsage: strictObjectSchema({
    items: arrayField("items must be a non-empty array of up to 100 entries", {
      minItems: 1,
      maxItems: 100,
      itemSchema: usageItemSchema,
    }),
  }),
  configPatch: strictObjectSchema({
    rateLimitPerWindow: positiveRuntimeConfigField("rateLimitPerWindow"),
    rateLimitWindowMs: positiveRuntimeConfigField("rateLimitWindowMs"),
    bulkMaxItems: positiveRuntimeConfigField("bulkMaxItems"),
  }),
  serviceCreate: strictObjectSchema({
    serviceId: serviceIdField,
    priceStroops: priceStroopsField,
  }),
  serviceDisabledPatch: strictObjectSchema({
    disabled: booleanField("disabled must be a boolean"),
  }),
  serviceMetadataPut: strictObjectSchema({
    description: stringField("description must be a string up to 256 chars", {
      maxLength: 256,
    }),
    owner: stringField("owner must be a non-empty string up to 256 chars", {
      minLength: 1,
      maxLength: 256,
    }),
  }),
  servicePricePatch: strictObjectSchema({
    priceStroops: priceStroopsField,
  }),
  settle: strictObjectSchema({
    agent: stringField("agent and serviceId are required strings", {}),
    serviceId: stringField("agent and serviceId are required strings", {}),
  }),
  usageRecord: strictObjectSchema({
    agent: agentField,
    serviceId: serviceIdField,
    requests: requestsField,
  }),
  webhookCreate: strictObjectSchema({
    url: stringField("url must be an http(s) URL up to 2048 chars", {
      maxLength: 2048,
      pattern: "^https?://",
    }),
    events: stringArrayField("events must be a non-empty array of strings", {
      minItems: 1,
    }),
  }),
  webhookPatch: strictObjectSchema({
    url: stringField("url must be an http(s) URL up to 2048 chars", {
      required: false,
      maxLength: 2048,
      pattern: "^https?://",
    }),
    events: stringArrayField("events must be a non-empty array of strings", {
      required: false,
      minItems: 1,
    }),
  }),
} satisfies Record<string, BodySchema>;

export const openApiRequestBodyComponents = Object.fromEntries(
  Object.entries(requestBodySchemas).map(([key, schema]) => [key, schema.openApi])
);

export function jsonRequestBodyRef(schemaName: keyof typeof requestBodySchemas) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  };
}
