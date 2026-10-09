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

// Inline acyclic evidence/detail definitions, retaining the shared outcome union
// to avoid duplicating it eight times and exceeding the request admission cap.
export function inlineExtractionReferences<T>(schema: T): T {
  const root = schema as { $defs?: Record<string, unknown> };
  function walk(value: unknown, path: string[] = []): unknown {
    if (Array.isArray(value)) return value.map((x) => walk(x, path));
    if (!value || typeof value !== "object") return value;
    const node = value as Record<string, unknown>;
    if (
      Object.keys(node).length === 1 &&
      typeof node.$ref === "string" &&
      node.$ref.startsWith("#/$defs/")
    ) {
      const name = node.$ref.slice(8).replace(/~1/g, "/").replace(/~0/g, "~");
      const target = root.$defs?.[name] as Record<string, unknown> | undefined;
      if (target && !target.anyOf && !path.includes(name))
        return walk(target, [...path, name]);
    }
    return Object.fromEntries(
      Object.entries(node).map(([key, child]) => [key, walk(child, path)]),
    );
  }
  const result = walk(schema) as Record<string, unknown>;
  const definitions = result.$defs as Record<string, unknown> | undefined;
  if (definitions) {
    const needed = new Set<string>();
    function collect(value: unknown) {
      if (!value || typeof value !== "object") return;
      const node = value as Record<string, unknown>;
      if (typeof node.$ref === "string" && node.$ref.startsWith("#/$defs/")) {
        const key = node.$ref.slice(8).replace(/~1/g, "/").replace(/~0/g, "~");
        if (!needed.has(key)) {
          needed.add(key);
          collect(definitions![key]);
        }
      }
      Object.entries(node).forEach(([key, child]) => {
        if (key !== "$defs") collect(child);
      });
    }
    collect(result);
    result.$defs = Object.fromEntries(
      [...needed].map((key) => [key, definitions[key]]),
    );
    if (!needed.size) delete result.$defs;
  }
  return result as T;
}
