# kolmafia-skills

KoLmafia-native agent skill bus using a spaceless gCLI namespace.

Commands:

- `/skill@--help`
- `/skill@--list`
- `/skill@--sync`
- `/skill@make-a-new-skill <name> :: <definition>`
- `/skill@<skill-name> <runtime prompt>`

Each normal skill has two native aliases: `agentskill.<name>` stores the hex-encoded definition and `/skill@<name>` invokes the relay. Run `call agent_skill_relay.js --install` after checkout/update to install or repair the built-ins, install a safe dead-end `/skill` guard, preload `make-a-new-skill`, enable `agentSkill`, and emit a sync marker. The guard prevents an accidental bare `/skill` from falling through to KoLmafia's chat slash-command path.

Existing install:

```text
git update donCannoli-burns-kolmafia-skills-main
git sync donCannoli-burns-kolmafia-skills-main
call agent_skill_relay.js --install
/skill@--list
```

Create and invoke:

```text
/skill@make-a-new-skill explain-test :: Return exactly TEST_SKILL_OK and nothing else.
/skill@explain-test hello
```

Skill names must match `[a-z0-9][a-z0-9._-]{0,63}`. The Python bridge remains read-only and reads the native alias registry/session framing; skill prompts are guidance, not execution authorization.
