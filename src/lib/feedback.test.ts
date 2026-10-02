import { describe, expect, it } from "vitest";
import { feedbackProblem, feedbackRow, MAX_MESSAGE } from "./feedback";

const draft = { kind: "bug" as const, message: "  The globe froze  ", contact: "", page: "/clues" };

describe("feedback", () => {
  it("wants a few words, and not a novel", () => {
    expect(feedbackProblem({ ...draft, message: " hi " })).toMatch(/few words/);
    expect(feedbackProblem({ ...draft, message: "x".repeat(MAX_MESSAGE + 1) })).toMatch(/under/);
    expect(feedbackProblem(draft)).toBeNull();
  });

  it("sends only what the table takes, trimmed and capped", () => {
    expect(feedbackRow(draft)).toEqual({
      kind: "bug",
      message: "The globe froze",
      contact: null,
      page: "/clues",
    });
    expect(feedbackRow({ ...draft, contact: " a@b.co ", page: "" })).toMatchObject({
      contact: "a@b.co",
      page: null,
    });
  });
});
