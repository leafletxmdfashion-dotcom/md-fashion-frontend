import { describe, expect, it } from "vitest";

import { emptyLogin, generatePassword, loginPayload, loginValuesSchema } from "./login-fields";

describe("login values", () => {
  it("needs an email or a phone", () => {
    const result = loginValuesSchema.safeParse({
      ...emptyLogin(),
      roleKey: "KARIGAR",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["email"]);

    expect(
      loginValuesSchema.safeParse({
        ...emptyLogin("9801234567"),
        roleKey: "KARIGAR",
      }).success,
    ).toBe(true);
  });

  it("needs a 12+ character password only when the admin sets it", () => {
    const base = {
      ...emptyLogin("9801234567"),
      roleKey: "KARIGAR",
      mode: "PASSWORD" as const,
    };
    expect(loginValuesSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(loginValuesSchema.safeParse({ ...base, password: "long enough phrase" }).success).toBe(true);
  });

  it("sends blanks as null and the password only for PASSWORD", () => {
    expect(
      loginPayload({
        ...emptyLogin(" 980 "),
        roleKey: "KARIGAR",
        password: "ignored",
      }),
    ).toEqual({
      email: null,
      phone: "980",
      roleKey: "KARIGAR",
      mode: "INVITE",
    });
    expect(
      loginPayload({
        ...emptyLogin(),
        email: "a@b.co",
        roleKey: "STAFF",
        mode: "PASSWORD",
        password: "p",
      }),
    ).toMatchObject({ email: "a@b.co", phone: null, password: "p" });
  });
});

describe("generatePassword", () => {
  it("makes 4 groups of 4 unambiguous characters, different each time", () => {
    const first = generatePassword();
    expect(first).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{4}(-[a-km-zA-HJ-NP-Z2-9]{4}){3}$/);
    expect(first).not.toMatch(/[01lIoO]/);
    expect(generatePassword()).not.toBe(first);
  });
});
