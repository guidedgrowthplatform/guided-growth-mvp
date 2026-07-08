// Shared JSON-schema types for LLM tool definitions (onboarding + checkin).
interface JSONSchemaProp {
  readonly type: 'string' | 'number' | 'boolean' | 'array';
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly items?: {
    readonly type: 'string' | 'number';
    readonly enum?: readonly string[];
  };
}

export interface JSONSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JSONSchemaProp>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
}
