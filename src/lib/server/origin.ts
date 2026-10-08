export function originAllowed(
  request: Request,
  approved: string | undefined,
  development: boolean,
) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (approved) {
    try {
      return origin === new URL(approved).origin;
    } catch {
      return false;
    }
  }
  if (!development) return false;
  try {
    const actual = new URL(origin);
    return (
      ["127.0.0.1", "localhost"].includes(actual.hostname) &&
      actual.protocol === "http:" &&
      actual.host === request.headers.get("host")
    );
  } catch {
    return false;
  }
}
