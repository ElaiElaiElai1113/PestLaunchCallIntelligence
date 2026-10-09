// Preserve primitive enum constraints while making both stages explicit to Groq.
export function inlinePrimitiveEnumReferences<T>(schema: T): T {
  const root = schema as { $defs?: Record<string, unknown> };
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const node = value as Record<string, unknown>;
    if (
      Object.keys(node).length === 1 &&
      typeof node.$ref === "string" &&
      node.$ref.startsWith("#/$defs/")
    ) {
      const name = node.$ref.slice(8).replace(/~1/g, "/").replace(/~0/g, "~");
      const target = root.$defs?.[name] as Record<string, unknown> | undefined;
      if (
        target &&
        typeof target.type === "string" &&
        ["string", "number", "integer", "boolean", "null"].includes(
          target.type,
        ) &&
        Array.isArray(target.enum) &&
        !target.$ref
      )
        return structuredClone(target);
    }
    return Object.fromEntries(
      Object.entries(node).map(([key, child]) => [key, walk(child)]),
    );
  }
  return walk(schema) as T;
}
