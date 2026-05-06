import { describe, it, expect } from "vitest";
import { parseSlashCommand, type SlashCommandAction } from "./slash-commands.js";

describe("parseSlashCommand", () => {
  // Helper for cleaner table tests
  const cases: Array<{
    input: string;
    expected: SlashCommandAction | null;
    description: string;
  }> = [
    // Non-slash input
    { input: "hello world", expected: null, description: "plain text without leading slash" },
    { input: "", expected: null, description: "empty string" },
    { input: "  ", expected: null, description: "whitespace only" },

    // Known commands — no args
    { input: "/new", expected: { type: "new_session" }, description: "/new command" },
    { input: "/abort", expected: { type: "abort" }, description: "/abort command" },
    { input: "/state", expected: { type: "get_state" }, description: "/state command" },
    { input: "/messages", expected: { type: "get_messages" }, description: "/messages command" },

    // Known commands — with args
    {
      input: "/compress Focus on API changes",
      expected: { type: "compact", customInstructions: "Focus on API changes" },
      description: "/compress with custom instructions",
    },
    {
      input: "/compact",
      expected: { type: "compact" },
      description: "/compact without args (alias)",
    },
    {
      input: "/compact   Trim old context  ",
      expected: { type: "compact", customInstructions: "Trim old context" },
      description: "/compact with extra whitespace",
    },

    // Aliases
    {
      input: "/compress",
      expected: { type: "compact" },
      description: "/compress is alias for /compact",
    },

    // Case insensitivity
    { input: "/NEW", expected: { type: "new_session" }, description: "uppercase /NEW" },
    { input: "/New", expected: { type: "new_session" }, description: "mixed case /New" },
    { input: "/ABORT", expected: { type: "abort" }, description: "uppercase /ABORT" },
    { input: "/COMPRESS", expected: { type: "compact" }, description: "uppercase /COMPRESS" },

    // Whitespace handling
    {
      input: "  /new  ",
      expected: { type: "new_session" },
      description: "/new with leading/trailing whitespace",
    },

    // Unknown commands — should return null so they fall through to normal messages
    { input: "/foo", expected: null, description: "unknown single-word command" },
    { input: "/agent", expected: null, description: "/agent is not a recognized command" },
    { input: "/home/user/file.txt", expected: null, description: "file path starting with slash" },
    { input: "/\\d+/", expected: null, description: "regex pattern starting with slash" },
    { input: "/", expected: null, description: "lone slash" },
    { input: "/ ", expected: null, description: "slash followed by space only" },

    // Commands that look like paths but are known — should still parse as commands
    {
      input: "/new extra stuff",
      expected: { type: "new_session" },
      description: "/new with trailing text (args ignored for /new)",
    },
  ];

  for (const { input, expected, description } of cases) {
    it(description, () => {
      expect(parseSlashCommand(input)).toEqual(expected);
    });
  }

  it("does not mutate original text", () => {
    const input = "  /new  ";
    parseSlashCommand(input);
    expect(input).toBe("  /new  ");
  });
});
