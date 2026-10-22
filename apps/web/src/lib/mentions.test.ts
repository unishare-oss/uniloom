import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mentionIdsIn, mentionQueryAt, splitMentions } from "./mentions";

describe("splitMentions", () => {
  it("marks each @Name of a mentioned person and keeps the rest", () => {
    assert.deepEqual(
      splitMentions("Hi @Ann, see @Bob Lee.", ["Ann", "Bob Lee"]),
      [
        { text: "Hi ", mention: false },
        { text: "@Ann", mention: true },
        { text: ", see ", mention: false },
        { text: "@Bob Lee", mention: true },
        { text: ".", mention: false },
      ],
    );
  });

  it("ignores a name inside a word or one that runs on, and a person not listed", () => {
    assert.deepEqual(splitMentions("mail a@Ann and @Annie and @Zed", ["Ann"]), [
      { text: "mail a@Ann and @Annie and @Zed", mention: false },
    ]);
  });

  it("prefers the longer name and escapes special characters", () => {
    const parts = splitMentions("@Ann Lee (seed) hi", [
      "Ann",
      "Ann Lee (seed)",
    ]);
    assert.deepEqual(parts[0], { text: "@Ann Lee (seed)", mention: true });
  });

  it("returns the text untouched with no names", () => {
    assert.deepEqual(splitMentions("@Ann", []), [
      { text: "@Ann", mention: false },
    ]);
  });
});

describe("mentionIdsIn", () => {
  const picked = [
    { id: "1", name: "Ann" },
    { id: "2", name: "Bob" },
    { id: "1", name: "Ann" },
  ];

  it("keeps only the people whose @Name is still in the body, once each", () => {
    assert.deepEqual(mentionIdsIn("hello @Ann", picked), ["1"]);
    assert.deepEqual(mentionIdsIn("hello Ann", picked), []);
    assert.deepEqual(mentionIdsIn("@Bob and @Ann", picked), ["1", "2"]);
  });
});

describe("mentionQueryAt", () => {
  it("finds the @word right before the caret at the start or after whitespace", () => {
    assert.deepEqual(mentionQueryAt("@An", 3), { start: 0, query: "An" });
    assert.deepEqual(mentionQueryAt("hi @", 4), { start: 3, query: "" });
    assert.deepEqual(mentionQueryAt("hi\n@bo yo", 6), {
      start: 3,
      query: "bo",
    });
  });

  it("finds nothing inside a word, after the word ends, or with no @", () => {
    assert.equal(mentionQueryAt("a@An", 4), null);
    assert.equal(mentionQueryAt("@An x", 5), null);
    assert.equal(mentionQueryAt("hello", 5), null);
  });
});
