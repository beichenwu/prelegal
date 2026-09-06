import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  authHeaders,
  clearToken,
  fetchMe,
  getToken,
  login,
  setToken,
} from "./auth";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("token store", () => {
  it("round-trips and clears the token", () => {
    expect(getToken()).toBeNull();
    setToken("abc.def.ghi");
    expect(getToken()).toBe("abc.def.ghi");
    expect(authHeaders()).toEqual({ Authorization: "Bearer abc.def.ghi" });
    clearToken();
    expect(getToken()).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it("survives a throwing storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage);
    expect(getToken()).toBeNull();
    expect(() => setToken("x")).not.toThrow();
  });
});

describe("login", () => {
  it("throws AuthError with the server detail on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Incorrect email or password" }),
      }),
    );
    await expect(login("a@b.c", "nope")).rejects.toMatchObject({
      name: "AuthError",
      status: 401,
      message: "Incorrect email or password",
    });
  });

  it("returns the token payload on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "t", user: { id: 1, email: "a@b.c" } }),
      }),
    );
    await expect(login("a@b.c", "pw")).resolves.toEqual({
      access_token: "t",
      user: { id: 1, email: "a@b.c" },
    });
  });
});

describe("fetchMe", () => {
  it("returns null and clears the token on 401", async () => {
    setToken("stale");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await fetchMe()).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("returns null without a token (no request)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchMe()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("AuthError", () => {
  it("carries the status code", () => {
    const e = new AuthError(409, "taken");
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(409);
  });
});
