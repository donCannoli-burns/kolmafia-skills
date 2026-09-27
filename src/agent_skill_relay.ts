// TypeScript authoring mirror for agent_skill_relay.js.
// KoLmafia executes the checked-in .js artifact; this file documents the typed intent.

declare function require(name: string): any;
declare const module: { exports: { main?: (...args: unknown[]) => void } };

const km = require("kolmafia");
const DEF_PREFIX = "AGENTSKILL_DEF:v1:";
const BEGIN_PREFIX = "AGENTSKILL_BEGIN|v=1|";
const END_PREFIX = "AGENTSKILL_END|v=1|";
const SYNC_PREFIX = "AGENTSKILL_SYNC|v=1|";
const MAX_SKILL_PROMPT = 12000;

function joinArgs(argsLike: IArguments): string {
  const out: string[] = [];
  for (let i = 0; i < argsLike.length; i++) {
    if (argsLike[i] !== undefined && argsLike[i] !== null) out.push(String(argsLike[i]));
  }
  return out.join(" ").trim();
}

function validName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(name);
}

function normalizeName(name: unknown): string {
  return String(name || "").toLowerCase().trim();
}

function utf8ToHex(text: string): string {
  const encoded = encodeURIComponent(text);
  let hex = "";
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded.charAt(i);
    if (ch === "%") {
      hex += encoded.substr(i + 1, 2).toLowerCase();
      i += 2;
    } else {
      let code = ch.charCodeAt(0).toString(16);
      if (code.length < 2) code = "0" + code;
      hex += code;
    }
  }
  return hex;
}

function hexToUtf8(hex: string): string | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  let encoded = "";
  for (let i = 0; i < hex.length; i += 2) encoded += "%" + hex.substr(i, 2);
  try {
    return decodeURIComponent(encoded);
  } catch (_) {
    return null;
  }
}

function emitSync(reason: string): void {
  km.print(SYNC_PREFIX + "reason=" + (reason || "manual"));
}

function emitFrame(name: string, skillPrompt: string, userPrompt: string): void {
  const id = String(new Date().getTime()) + "-" + String(Math.floor(Math.random() * 1000000));
  km.print(BEGIN_PREFIX + "id=" + id + "|name=" + name);
  km.print(skillPrompt);
  if (userPrompt) {
    km.print("");
    km.print("USER_SKILL_PROMPT:");
    km.print(userPrompt);
  }
  km.print(END_PREFIX + "id=" + id + "|name=" + name);
}

function getDefinition(name: string): string | null {
  const output = String(km.cliExecuteOutput("agentskill." + name) || "");
  const match = output.match(/AGENTSKILL_DEF:v1:([0-9a-fA-F]+)/);
  return match ? hexToUtf8(match[1]) : null;
}

function listSkills(): void {
  const output = String(km.cliExecuteOutput("alias agentskill.") || "");
  const rx = /agentskill\.([a-z0-9][a-z0-9._-]{0,63})/gi;
  const seen: Record<string, boolean> = {};
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = rx.exec(output)) !== null) {
    const name = normalizeName(match[1]);
    if (!seen[name]) {
      seen[name] = true;
      names.push(name);
    }
  }
  names.sort();
  km.print("Agent skills (" + names.length + "):");
  names.forEach((name) => km.print("  " + name));
}

function addSkill(payload: string): { ok: boolean; error?: string; name?: string } {
  const split = payload.indexOf("::");
  if (split < 0) return { ok: false, error: "Expected: <name> :: <skill prompt>" };
  const name = normalizeName(payload.substring(0, split));
  const prompt = payload.substring(split + 2).trim();
  if (!validName(name)) return { ok: false, error: "Invalid skill name." };
  if (!prompt) return { ok: false, error: "Skill prompt cannot be empty." };
  if (prompt.length > MAX_SKILL_PROMPT) return { ok: false, error: "Skill prompt is too large." };
  const command = `alias agentskill.${name} => ashq print("${DEF_PREFIX}${utf8ToHex(prompt)}")`;
  if (!km.cliExecute(command)) return { ok: false, error: "KoLmafia rejected the alias command." };
  emitSync("make-a-new-skill");
  return { ok: true, name };
}

function main(): void {
  const raw = joinArgs(arguments);
  if (raw.indexOf("__sync__") === 0) {
    emitSync(raw.substring("__sync__".length).trim() || "lifecycle");
    return;
  }

  if (String(km.getProperty("agentSkill") || "") === "scrape") {
    emitSync("pref-scrape");
    km.setProperty("agentSkill", "1");
  }
  if (String(km.getProperty("agentSkill") || "1") === "0") {
    km.print("Agent skills are disabled. Set agentSkill = 1 to enable.", "red");
    return;
  }
  if (!raw || raw === "help" || raw === "--help") {
    km.print("/skill <skill-name> <skill prompt> | /skill --list | /skill --sync | /skill make-a-new-skill <name> :: <definition>");
    return;
  }
  if (raw === "--list" || raw === "list") {
    listSkills();
    return;
  }
  if (raw === "--sync" || raw === "sync") {
    emitSync("manual");
    return;
  }

  const firstSpace = raw.search(/\s/);
  const skillName = normalizeName(firstSpace < 0 ? raw : raw.substring(0, firstSpace));
  const userPrompt = firstSpace < 0 ? "" : raw.substring(firstSpace + 1).trim();
  if (!validName(skillName)) {
    km.print("Invalid skill name: " + skillName, "red");
    return;
  }

  if (skillName === "make-a-new-skill" && userPrompt.indexOf("::") >= 0) {
    const added = addSkill(userPrompt);
    if (!added.ok) {
      km.print(added.error, "red");
      return;
    }
    const bootstrap = getDefinition("make-a-new-skill") || "Create and verify the requested skill using the native KoLmafia alias registry.";
    emitFrame("make-a-new-skill", bootstrap, `Created agentskill.${added.name}. Verify it with /skill ${added.name} <task>.`);
    return;
  }

  const definition = getDefinition(skillName);
  if (definition === null) {
    km.print("Unknown agent skill: " + skillName + ". Use /skill --list.", "red");
    return;
  }
  emitFrame(skillName, definition, userPrompt);
  if (skillName === "make-a-new-skill") emitSync("make-a-new-skill-help");
}

module.exports.main = main;
