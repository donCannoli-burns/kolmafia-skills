# Protocol reference

The authoritative user-facing protocol is documented in the repository README.

The machine-readable markers are versioned with `v=1`:

- `AGENTSKILL_DEF:v1:` — hex-encoded UTF-8 skill definition stored inside a native KoLmafia alias.
- `AGENTSKILL_BEGIN|v=1|...` — beginning of one framed prompt.
- `AGENTSKILL_END|v=1|...` — matching end of the same prompt.
- `AGENTSKILL_SYNC|v=1|reason=...` — request for the external agent to refresh its alias view.

The Python helper only returns complete begin/end pairs with matching request IDs and skill names. Skill definitions are guidance, not execution authorization.
