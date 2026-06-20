# SplitMate — Telegram bill-splitting bot

## Summary
SplitMate is a small Telegram bot that helps users split bills and store named expenses. It supports five commands: /start, /split, /save, /list and /clear. Saved expenses are private to each Telegram user and persisted in Redis (via the provided toolkit). Amounts are stored and shown with two decimals and no currency symbol.

## Audience
Individual Telegram users who want a quick, private way to split bills and keep a short list of named expenses.

## Core entities
- User: identified by Telegram user_id. All saved data is scoped to this user_id.
- Expense: { name: string, total: string (two-decimal string), timestamp: ISO-8601 string }

## Integrations & notification targets
- Telegram Bot API for receiving commands and sending replies.
- Redis (accessed via the provided toolkit) for persistent storage of saved expenses.
- No external notifications, no webhooks to other services.

## Interaction flows (commands & exact behavior)
All commands handle missing/invalid input with helpful usage or error messages.

1) /start
- Behavior: Reply with a short welcome and one-line usage hint.
- Example reply: "Welcome to SplitMate! Use /split, /save, /list, /clear. Type /help for usage." (no /help command required beyond usage examples below).

2) /split <total> <people>
- Purpose: Divide a numeric total among an integer number of people and show per-person amounts.
- Input rules:
  - total: numeric (may include decimal point). Parsed using decimal arithmetic, validated as finite and >= 0.
  - people: integer, must be > 0.
  - Both arguments are required; if missing, bot replies with usage: "Usage: /split <total> <people> — e.g. /split 123.45 4"
- Validation errors:
  - Non-numeric total -> "Error: total must be a number (e.g. 123.45)."
  - Non-integer or <= 0 people -> "Error: people must be a positive integer."
- Rounding & distribution algorithm (deterministic, cent-accurate):
  - Convert total to cents using round-half-up to nearest cent.
  - Integer-divide cents by people: quotient and remainder.
  - If remainder == 0: reply "Each person pays X.YY" where X.YY is quotient/100.
  - If remainder != 0: distribute so that 'remainder' people pay (quotient+1)/100 and the remaining pay quotient/100. Reply example:
    "Split 100.00 among 3: 1 person pays 33.34 and 2 people pay 33.33."
  - All displayed amounts use two decimals, no currency symbol.
- Rationale: exact cent distribution ensures sum of per-person amounts equals original total.

3) /save <name> <total>
- Purpose: store a named expense in Redis under the calling user's namespace.
- Input rules:
  - name: single token (no spaces). If a user needs spaces they must use underscores or another token convention; the bot will treat the first whitespace-delimited token as name.
  - total: numeric (validated as in /split) and >= 0.
  - Usage message if missing: "Usage: /save <name> <total> — e.g. /save dinner 45.50"
- Validation errors:
  - Missing args -> usage
  - Non-numeric total -> "Error: total must be a number (e.g. 45.50)."
  - Empty name or name containing only whitespace -> usage
- Behavior:
  - Store or overwrite the expense with that name for the user. Reply: "Saved 'NAME' = TOTAL (timestamp)" where TOTAL is two decimals.
  - Overwrite policy: saving an existing name replaces the previous expense (reply includes "overwritten" wording).

4) /list
- Purpose: show all saved expenses for the calling user.
- Behavior:
  - If no saved expenses: reply "No saved expenses. Use /save NAME TOTAL to add one."
  - Otherwise, list items in descending timestamp order (newest first). Each line: "NAME — TOTAL — saved at TIMESTAMP" (TIMESTAMP in ISO-8601 local/UTC consistent format).
  - If there are many items, list all (the expected usage is small lists); the builder may later add pagination if needed.

5) /clear
- Purpose: remove all saved expenses for the calling user.
- Behavior:
  - Immediately delete all saved expenses for the user and reply "Cleared N expenses." where N is the number removed (0 if none).
  - No interactive confirmation required (simple, explicit command).

## Persistence (exact keys & formats)
- Redis key pattern: splitmate:{user_id}:expenses
- Data structure: Redis hash (HSET) where field = expense name (string) and value = JSON string: {"amount":"12.34","ts":"2026-06-20T12:34:56Z"}
- Ordering: store timestamp in ISO-8601; /list retrieves all hash fields and sorts by timestamp descending in application code.
- Concurrency: single HSET/HGET/HDEL operations are atomic in Redis. Overwrites are allowed and are plain replacements.

## Security & privacy
- All saved expenses are per-user, keyed by Telegram user_id. No cross-chat or group sharing.
- The bot must not persist or forward user Telegram tokens or other PII beyond user_id and expense data.

## Payments
- No payment processing or links. This bot only calculates and stores numeric values.

## Non-goals
- No group-shared expenses; no multi-user settlements, no currency conversions, no receipts or photo uploads, no payment collection.

## Error message examples (for implementation)
- Missing args: "Usage: /split <total> <people> — e.g. /split 123.45 4"
- Invalid number: "Error: total must be a number (e.g. 123.45)."
- Invalid people: "Error: people must be a positive integer."
- /save misuse: "Usage: /save <name> <total> — name must be a single token (no spaces)."
- General unexpected error: "Sorry, something went wrong. Try again later."

## Assumptions & defaults
- Saved expenses are stored PER-USER (visible only to that Telegram user). Rationale: user requested per-user privacy and this simplifies data model.
- Amounts use 2 decimals and no currency symbol in storage and display. Rationale: keeps formatting consistent and locale-agnostic.
- Expense names are single tokens (no spaces). Rationale: simple command parsing; users can use underscores if needed.
- Saving an expense with an existing name overwrites the previous entry. Rationale: simple behavior and easy to implement; user can re-save to update values.
- /clear deletes immediately with no confirmation, returning a count of removed items. Rationale: keeps the command simple; owner wanted limited scope.
- Redis key pattern is splitmate:{user_id}:expenses and values are JSON strings with amount and timestamp. Rationale: simple, readable, and easy to extend.
- Split rounding: convert to integer cents (round half-up), distribute remainder so total of per-person shares equals original total. Rationale: avoids floating-point rounding errors and ensures cent-perfect splits.

