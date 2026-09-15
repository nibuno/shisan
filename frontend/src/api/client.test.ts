import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiError, authApi, ownersApi, setUnauthorizedHandler } from "./client";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("api client", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not attach a CSRF header to a safe (GET) request", async () => {
    document.cookie = "csrftoken=abc123";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ authenticated: false, user: null }));
    vi.stubGlobal("fetch", fetchMock);

    await authApi.csrf();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/csrf/");
    const headers = new Headers(init.headers);
    expect(headers.has("X-CSRFToken")).toBe(false);
    expect(init.credentials).toBe("include");
  });

  it("attaches the csrftoken cookie as X-CSRFToken on unsafe (POST) requests", async () => {
    document.cookie = "csrftoken=abc123";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, name: "現金" }));
    vi.stubGlobal("fetch", fetchMock);

    await ownersApi.create({ name: "現金" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRFToken")).toBe("abc123");
  });

  it("omits X-CSRFToken on unsafe requests when no cookie is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, name: "現金" }));
    vi.stubGlobal("fetch", fetchMock);

    await ownersApi.create({ name: "現金" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.has("X-CSRFToken")).toBe(false);
  });

  it("resolves undefined for an empty response body (e.g. DELETE/logout)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ownersApi.delete(1)).resolves.toBeUndefined();
  });

  it("rejects with an ApiError carrying the server-provided detail message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ detail: "資産が見つかりません" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ownersApi.delete(999)).rejects.toMatchObject({
      status: 404,
      message: "資産が見つかりません",
    });
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not json", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ownersApi.delete(1)).rejects.toMatchObject({
      status: 500,
      message: "エラーが発生しました (500)",
    });
  });

  it("invokes the registered unauthorized handler on a 401, in addition to throwing", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: "認証が必要です" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ownersApi.delete(1)).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the unauthorized handler for non-401 errors", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: "エラー" }, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ownersApi.delete(1)).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });
});
