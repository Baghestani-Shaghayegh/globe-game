import { describe, expect, it, vi } from "vitest";
import { startUpload, uploadFailure, youtubeMetadata } from "./youtube";

describe("what YouTube is told", () => {
  it("marks it as a short, and keeps the title and description inside YouTube's limits", () => {
    const meta = youtubeMetadata("x".repeat(200), "Named 47 of 50. https://guessglobe.com/play", "unlisted");
    expect(meta.snippet.title).toHaveLength(90);
    expect(meta.snippet.description).toContain("#Shorts");
    expect(meta.snippet.description).toContain("https://guessglobe.com/play");
    expect(meta.status).toEqual({ privacyStatus: "unlisted", selfDeclaredMadeForKids: false });
  });

  it("drops angle brackets, which YouTube rejects, and never sends an empty title", () => {
    const meta = youtubeMetadata("  <b>  ", "a < b", "public");
    expect(meta.snippet.title).toBe("b");
    expect(youtubeMetadata("<>", "", "public").snippet.title).toBe("GuessGlobe");
    expect(meta.snippet.description).not.toMatch(/[<>]/);
  });
});

describe("failures", () => {
  it("says what happened in terms a player can act on", () => {
    expect(uploadFailure(401, "").kind).toBe("expired");
    expect(uploadFailure(403, '{"reason":"quotaExceeded"}').kind).toBe("quota");
    expect(uploadFailure(403, "forbidden").kind).toBe("denied");
    expect(uploadFailure(500, "").kind).toBe("failed");
  });
});

describe("asking for an upload address", () => {
  const blob = new Blob(["abc"], { type: "video/mp4" });
  const meta = youtubeMetadata("t", "d", "public");

  it("sends the token, the size and the type, and returns where to send the video", async () => {
    const send = vi.fn(async () => new Response("", { headers: { Location: "https://upload.example/abc" } }));
    expect(await startUpload("tok", blob, meta, send as unknown as typeof fetch)).toBe("https://upload.example/abc");
    const [, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["X-Upload-Content-Length"]).toBe("3");
    expect(headers["X-Upload-Content-Type"]).toBe("video/mp4");
  });

  it("fails when YouTube refuses, or gives no address", async () => {
    await expect(startUpload("t", blob, meta, async () => new Response("", { status: 401 }))).rejects.toMatchObject({
      kind: "expired",
    });
    await expect(startUpload("t", blob, meta, async () => new Response(""))).rejects.toMatchObject({ kind: "failed" });
  });
});
