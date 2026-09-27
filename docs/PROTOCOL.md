# Protocol reference

The gCLI namespace is spaceless: `/skill@<token>`.

Built-ins are `/skill@--help`, `/skill@--list`, `/skill@--sync`, and `/skill@make-a-new-skill <name> :: <definition>`.

A created skill has two KoLmafia-native aliases: `agentskill.<name>` stores `AGENTSKILL_DEF:v1:<utf8-hex>`, while `/skill@<name>` forwards runtime text to `agent_skill_relay.js` with `%%`.

Machine markers remain `AGENTSKILL_DEF:v1:`, `AGENTSKILL_BEGIN|v=1|...`, `AGENTSKILL_END|v=1|...`, and `AGENTSKILL_SYNC|v=1|reason=...`.

`call agent_skill_relay.js --install` installs/repairs the built-ins, removes the legacy `/skill` alias, preloads `make-a-new-skill`, and enables `agentSkill`. Skill definitions are guidance, not execution authorization.
