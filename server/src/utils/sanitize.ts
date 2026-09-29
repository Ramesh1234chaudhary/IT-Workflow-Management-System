/**
 * Whitelist based filter sanitisation.
 *
 * NoSQL operator injection is prevented by never copying unknown keys or
 * object values out of user input into a Mongo query. Combined with the Joi
 * schemas in `src/validators`, which reject objects where scalars are expected,
 * payloads such as `{ email: { $ne: null } }` cannot reach a query.
 */
export const safeFilter = (raw: Record<string, unknown> = {}, allowed: string[] = []): Record<string, string> => {
  const output: Record<string, string> = {};
  for (const key of allowed) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') continue; // never trust object valued input
    output[key] = String(value);
  }
  return output;
};

export default safeFilter;
