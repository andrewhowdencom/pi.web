// Slash command parser for pi-web UI
// Maps "/command [args]" text to typed actions

export type SlashCommandAction =
  | { type: "new_session" }
  | { type: "compact"; customInstructions?: string }
  | { type: "abort" }
  | { type: "get_state" }
  | { type: "get_messages" };

/**
 * Parse a text input for slash commands.
 *
 * Returns `null` if the text is not a slash command (does not start with "/").
 * Returns a `SlashCommandAction` for recognized or unknown commands.
 *
 * Supported commands:
 *   /new                    → { type: "new_session" }
 *   /compress [args]        → { type: "compact", customInstructions: args }
 *   /compact [args]         → { type: "compact", customInstructions: args }
 *   /abort                  → { type: "abort" }
 *   /state                  → { type: "get_state" }
 *   /messages               → { type: "get_messages" }
 */
export function parseSlashCommand(text: string): SlashCommandAction | null {
  const trimmed = text.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  // Remove leading "/" and split on first whitespace
  const withoutSlash = trimmed.slice(1);
  const spaceIndex = withoutSlash.search(/\s/);

  const command =
    spaceIndex === -1
      ? withoutSlash.toLowerCase()
      : withoutSlash.slice(0, spaceIndex).toLowerCase();

  const args =
    spaceIndex === -1 ? "" : withoutSlash.slice(spaceIndex + 1).trim();

  switch (command) {
    case "new":
      return { type: "new_session" };

    case "compress":
    case "compact":
      return {
        type: "compact",
        ...(args.length > 0 ? { customInstructions: args } : {}),
      };

    case "abort":
      return { type: "abort" };

    case "state":
      return { type: "get_state" };

    case "messages":
      return { type: "get_messages" };

    default:
      return null;
  }
}
