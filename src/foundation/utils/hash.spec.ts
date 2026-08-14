import { hashPassword, comparePassword } from "./hash";

describe("Hash Utils", () => {
  it("should hash a password", async () => {
    const hash = await hashPassword("TestPassword123");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("TestPassword123");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should correctly compare password against hash", async () => {
    const password = "MySecurePass123";
    const hash = await hashPassword(password);

    const isMatch = await comparePassword(password, hash);
    expect(isMatch).toBe(true);
  });

  it("should return false for wrong password", async () => {
    const hash = await hashPassword("CorrectPassword1");
    const isMatch = await comparePassword("WrongPassword1", hash);
    expect(isMatch).toBe(false);
  });
});
