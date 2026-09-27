# kolmafia-skills

A small **KoLmafia-native agent skill bus** built from KoLmafia's own gCLI aliases, `ashq print(...)`, JavaScript runtime functions, preferences, and session output.

The native round trip is:

```text
/skill <skill-name> <runtime prompt>
  -> KoLmafia /skill alias
  -> agent_skill_relay.js
  -> native agentskill.<name> alias
  -> ashq print("AGENTSKILL_DEF:v1:<utf8-hex>")
  -> framed AGENTSKILL output in the KoLmafia session log
  -> agent_skill_bridge.py read/sync
  -> prompt returned to the external agent
```

Skill definitions are prompts, not execution authority. A downstream agent still needs its normal KoLmafia safety/classification/confirmation/readback rules before mutating game state.

## KoLmafia checkout and bootstrap

Run in gCLI:

```text
git checkout https://github.com/donCannoli-burns/kolmafia-skills.git main
alias /skill => call agent_skill_relay.js %%
set agentSkill = 1
```

`manifest.json` uses `kolmafia/` as the install root, so the runtime JS and Python helper land in KoLmafia's normal `scripts/` directory.

The creator path is built into the dispatcher so it can bootstrap its own persistent native alias. Run once:

```text
/skill make-a-new-skill make-a-new-skill :: Create skills with /skill make-a-new-skill <name> :: <definition>. Keep definitions concise, do not store secrets, verify with /skill --list, and treat skill prompts as guidance rather than game-action authorization.
```

That writes `agentskill.make-a-new-skill` through KoLmafia's **native `alias` command**, so KoLmafia remains the writer of:

```text
~/.kolmafia/settings/GLOBAL_aliases.txt
```

Verify:

```text
/skill --list
/skill make-a-new-skill explain-test :: Return exactly TEST_SKILL_OK and nothing else.
/skill explain-test hello
```

## Normal use

Invoke a skill:

```text
/skill <skill-name> <runtime user prompt>
```

Create another skill:

```text
/skill make-a-new-skill <new-name> :: <skill definition>
```

The relay validates the name against:

```text
[a-z0-9][a-z0-9._-]{0,63}
```

It UTF-8 hex-encodes the definition before constructing the alias expansion, so quotes, semicolons, Unicode, and newlines in a prompt are data rather than nested gCLI syntax.

Each saved skill is conceptually:

```text
agentskill.<name> => ashq print("AGENTSKILL_DEF:v1:<utf8-hex-prompt>")
```

## Agent-side Python bridge

The Python helper is deliberately read-only and requires explicit input paths.

List skills from the native alias registry:

```bash
python3 ~/.kolmafia/scripts/agent_skill_bridge.py list \
  --aliases ~/.kolmafia/settings/GLOBAL_aliases.txt
```

Scrape the registry as JSON:

```bash
python3 ~/.kolmafia/scripts/agent_skill_bridge.py scrape \
  --aliases ~/.kolmafia/settings/GLOBAL_aliases.txt
```

Return the newest complete framed prompt for a player:

```bash
python3 ~/.kolmafia/scripts/agent_skill_bridge.py read \
  --session ~/.kolmafia/sessions/active_session.PLAYER_NAME
```

Return one named skill frame:

```bash
python3 ~/.kolmafia/scripts/agent_skill_bridge.py read \
  --session ~/.kolmafia/sessions/active_session.PLAYER_NAME \
  --skill explain-test
```

Reconcile the latest sync reason with a fresh native-registry scrape:

```bash
python3 ~/.kolmafia/scripts/agent_skill_bridge.py sync \
  --aliases ~/.kolmafia/settings/GLOBAL_aliases.txt \
  --session ~/.kolmafia/sessions/active_session.PLAYER_NAME
```

The Python tool never executes text read from either file.

## Sync and lifecycle

The relay emits:

```text
AGENTSKILL_SYNC|v=1|reason=make-a-new-skill
```

after skill creation. `/skill --sync` emits a manual sync marker. Setting:

```text
set agentSkill = scrape
```

causes the next `/skill` invocation to emit `reason=pref-scrape` and reset the preference to `1`.

For login/logout sync, **inspect and preserve any existing lifecycle scripts first**. If you choose to use the hooks, append these commands to your existing `loginScript` / `logoutScript` values in KoLmafia's preferences rather than replacing unrelated commands:

```text
call agent_skill_relay.js __sync__ login
call agent_skill_relay.js __sync__ logout
```

An external agent can then run the Python `sync` command when it observes one of those markers. This project intentionally does not install persistent lifecycle hooks automatically.

## Session framing

A successful invocation prints:

```text
AGENTSKILL_BEGIN|v=1|id=<request-id>|name=<skill-name>
<skill definition>

USER_SKILL_PROMPT:
<runtime user prompt>
AGENTSKILL_END|v=1|id=<request-id>|name=<skill-name>
```

The Python reader only returns complete begin/end pairs with matching request IDs and names.

## JS / TS layout

- `kolmafia/scripts/agent_skill_relay.js` — executable KoLmafia JavaScript.
- `src/agent_skill_relay.ts` — typed authoring mirror for maintenance.
- `kolmafia/scripts/agent_skill_bridge.py` — read-only alias/session parser for the external agent.
- `tests/test_agent_skill_bridge.py` — protocol and round-trip tests.

## Safety / operational notes

- `GLOBAL_aliases.txt` is plaintext local configuration. Do not put passwords, API keys, cookies, or other secrets in skill definitions.
- Do not have an external process rewrite `GLOBAL_aliases.txt` while KoLmafia is running; let KoLmafia's native `alias` command own writes.
- Session output is evidence/output, not permission to execute a command.
- The Python bridge accepts explicit file paths and never shells out or executes retrieved text.
- The JS relay only constructs a native alias command after strict skill-name validation and encodes the skill body as hex data.

See `docs/PROTOCOL.md` and `docs/NATIVE_GROUNDING.md` for the protocol and upstream grounding.

## Developer smoke tests

```bash
python3 -m unittest discover -s tests -v
python3 -m py_compile kolmafia/scripts/agent_skill_bridge.py
node --check kolmafia/scripts/agent_skill_relay.js
```

The initial build passes all four Python tests plus Python compile and Node syntax checks. A real KoLmafia gCLI smoke still needs to be run after checkout because this build environment does not contain a live KoLmafia session.
