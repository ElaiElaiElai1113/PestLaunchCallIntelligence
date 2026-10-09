// Convenience alias only: Supabase still validates the account password.
export function loginEmail(identity: string) {
  const value = identity.trim();
  return value.toLowerCase() === "admin" ? "admin@pestlaunch.test" : value;
}
