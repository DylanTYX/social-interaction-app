import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWithRetry,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/api/fetch-retry";

const ok = () => new Response("{}", { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithRetry", () => {
  it("returns the first response when the request works", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("/api/speech-token");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries once more when the request never reaches the server", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("/api/speech-token", undefined, 0);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives a sentence a candidate can act on when both attempts fail", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWithRetry("/api/speech-token", undefined, 0),
    ).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a response, however bad its status", async () => {
    // The server answered. Asking again only makes it refuse twice — and for
    // a POST that creates something, twice is the expensive kind of wrong.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("/api/sessions", { method: "POST" });

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes a non-network failure straight through", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("aborted"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithRetry("/api/sessions")).rejects.toThrow("aborted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recognises the browser's own network failure", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(false);
  });
});
