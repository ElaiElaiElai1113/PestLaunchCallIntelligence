import { expect, it } from "vitest";
import { loginEmail } from "@/lib/domain/login-identity";
it("resolves the explicit demo username without changing other invited email logins", () => {
  expect(loginEmail(" admin ")).toBe("admin@pestlaunch.test");
  expect(loginEmail("ADMIN")).toBe("admin@pestlaunch.test");
  expect(loginEmail(" invited@example.com ")).toBe("invited@example.com");
  expect(loginEmail("somebody")).toBe("somebody");
});
