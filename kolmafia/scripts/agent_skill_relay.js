/*
 * kolmafia-skills native CLI/session relay.
 * Spaceless gCLI namespace: /skill@<name>
 */

var km = require("kolmafia");

var DEF_PREFIX = "AGENTSKILL_DEF:v1:";
var BEGIN_PREFIX = "AGENTSKILL_BEGIN|v=1|";
var END_PREFIX = "AGENTSKILL_END|v=1|";
var SYNC_PREFIX = "AGENTSKILL_SYNC|v=1|";
var MAX_SKILL_PROMPT = 12000;
var CREATOR = "make-a-new-skill";
var CREATOR_PROMPT = "Create skills with /skill@make-a-new-skill <name> :: <definition>. Keep definitions concise, do not store secrets, verify with /skill@--list, and treat skill prompts as guidance rather than game-action authorization.";

function joinArgs(argsLike) {
  var out = [];
  for (var i = 0; i < argsLike.length; i++) {
    if (argsLike[i] !== undefined && argsLike[i] !== null) out.push(String(argsLike[i]));
  }
  return out.join(" ").replace(/^\s+|\s+$/g, "");
}

function validName(name) {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(name);
}

function normalizeName(name) {
  return String(name || "").toLowerCase().replace(/^\s+|\s+$/g, "");
}

function utf8ToHex(text) {
  var encoded = encodeURIComponent(String(text));
  var hex = "";
  for (var i = 0; i < encoded.length; i++) {
    var ch = encoded.charAt(i);
    if (ch === "%") {
      hex += encoded.substr(i + 1, 2).toLowerCase();
      i += 2;
    } else {
      var code = ch.charCodeAt(0).toString(16);
      if (code.length < 2) code = "0" + code;
      hex += code;
    }
  }
  return hex;
}

function hexToUtf8(hex) {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  var encoded = "";
  for (var i = 0; i < hex.length; i += 2) encoded += "%" + hex.substr(i, 2);
  try {
    return decodeURIComponent(encoded);
  } catch (e) {
    return null;
  }
}

function requestId() {
  return String(new Date().getTime()) + "-" + String(Math.floor(Math.random() * 1000000));
}

function emitSync(reason) {
  km.print(SYNC_PREFIX + "reason=" + String(reason || "manual"));
}

function emitFrame(name, skillPrompt, userPrompt) {
  var id = requestId();
  km.print(BEGIN_PREFIX + "id=" + id + "|name=" + name);
  km.print(skillPrompt);
  if (userPrompt) {
    km.print("");
    km.print("USER_SKILL_PROMPT:");
    km.print(userPrompt);
  }
  km.print(END_PREFIX + "id=" + id + "|name=" + name);
}

function definitionAliasCommand(name, prompt) {
  return "alias agentskill." + name + " => ashq print(\"" + DEF_PREFIX + utf8ToHex(prompt) + "\")";
}

function invocationAliasCommand(name) {
  return "alias /skill@" + name + " => call agent_skill_relay.js invoke " + name + " %%";
}

function getDefinition(name) {
  var output = km.cliExecuteOutput("agentskill." + name);
  var match = String(output || "").match(/AGENTSKILL_DEF:v1:([0-9a-fA-F]+)/);
  if (!match) return null;
  return hexToUtf8(match[1]);
}

function listSkills() {
  var output = String(km.cliExecuteOutput("alias agentskill.") || "");
  var rx = /agentskill\.([a-z0-9][a-z0-9._-]{0,63})/ig;
  var seen = {};
  var names = [];
  var m;
  while ((m = rx.exec(output)) !== null) {
    var n = normalizeName(m[1]);
    if (!seen[n]) {
      seen[n] = true;
      names.push(n);
    }
  }
  names.sort();
  km.print("Agent skills (" + names.length + "):");
  for (var i = 0; i < names.length; i++) km.print("  /skill@" + names[i]);
}

function installBuiltins() {
  var commands = [
    "alias /skill => call agent_skill_relay.js --legacy-guard",
    "alias /skill@--help => call agent_skill_relay.js --help",
    "alias /skill@--list => call agent_skill_relay.js --list",
    "alias /skill@--sync => call agent_skill_relay.js --sync",
    "alias /skill@make-a-new-skill => call agent_skill_relay.js make-a-new-skill %%",
    definitionAliasCommand(CREATOR, CREATOR_PROMPT)
  ];
  for (var i = 0; i < commands.length; i++) {
    if (!km.cliExecute(commands[i])) {
      km.print("Failed while installing agent-skill aliases: " + commands[i], "red");
      return false;
    }
  }
  km.setProperty("agentSkill", "1");
  emitSync("install");
  km.print("Agent-skill aliases installed. Try /skill@--list");
  return true;
}

function addSkill(payload) {
  var split = payload.indexOf("::");
  if (split < 0) return { ok: false, error: "Expected: <name> :: <skill prompt>" };

  var name = normalizeName(payload.substring(0, split));
  var prompt = payload.substring(split + 2).replace(/^\s+|\s+$/g, "");

  if (!validName(name)) {
    return { ok: false, error: "Skill name must match [a-z0-9][a-z0-9._-]{0,63}." };
  }
  if (name === CREATOR) {
    return { ok: false, error: CREATOR + " is a reserved built-in skill name." };
  }
  if (!prompt) return { ok: false, error: "Skill prompt cannot be empty." };
  if (prompt.length > MAX_SKILL_PROMPT) {
    return { ok: false, error: "Skill prompt is too large (max " + MAX_SKILL_PROMPT + " characters)." };
  }

  if (!km.cliExecute(definitionAliasCommand(name, prompt))) {
    return { ok: false, error: "KoLmafia rejected the native definition alias." };
  }
  if (!km.cliExecute(invocationAliasCommand(name))) {
    return { ok: false, error: "Definition saved, but KoLmafia rejected /skill@" + name + "." };
  }

  emitSync("make-a-new-skill");
  return { ok: true, name: name, prompt: prompt };
}

function maybeHandleScrapePref() {
  var mode = String(km.getProperty("agentSkill") || "");
  if (mode === "scrape") {
    emitSync("pref-scrape");
    km.setProperty("agentSkill", "1");
  }
}

function showHelp() {
  km.print("KoLmafia agent skills (spaceless alias namespace)");
  km.print("  /skill@<skill-name> <runtime prompt>");
  km.print("  /skill@--list");
  km.print("  /skill@--sync");
  km.print("  /skill@--help");
  km.print("  /skill@make-a-new-skill <new-name> :: <new skill definition>");
  km.print("Bootstrap/repair: call agent_skill_relay.js --install");
  km.print("Preference: agentSkill=1 enables; agentSkill=0 disables; agentSkill=scrape requests a rescrape on next invocation.");
}

function invokeSkill(name, userPrompt) {
  var skillName = normalizeName(name);
  if (!validName(skillName)) {
    km.print("Invalid skill name: " + skillName, "red");
    return;
  }
  var definition = getDefinition(skillName);
  if (definition === null) {
    km.print("Unknown agent skill: " + skillName + ". Use /skill@--list.", "red");
    return;
  }
  emitFrame(skillName, definition, userPrompt || "");
}

function main() {
  var raw = joinArgs(arguments);

  if (raw.indexOf("__sync__") === 0) {
    var reason = raw.substring("__sync__".length).replace(/^\s+|\s+$/g, "") || "lifecycle";
    emitSync(reason);
    return;
  }

  if (raw === "--install" || raw === "install") {
    installBuiltins();
    return;
  }

  if (raw.indexOf("--legacy-guard") === 0) {
    km.print("Bare /skill is disabled as a safety guard. Use /skill@--help, /skill@--list, /skill@make-a-new-skill, or /skill@<name>.", "red");
    return;
  }

  maybeHandleScrapePref();

  if (String(km.getProperty("agentSkill") || "1") === "0") {
    km.print("Agent skills are disabled. Set agentSkill = 1 to enable.", "red");
    return;
  }

  if (!raw || raw === "--help" || raw === "help") {
    showHelp();
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

  if (raw.indexOf("make-a-new-skill") === 0) {
    var creatorPayload = raw.substring("make-a-new-skill".length).replace(/^\s+/, "");
    var added = addSkill(creatorPayload);
    if (!added.ok) {
      km.print(added.error, "red");
      return;
    }
    emitFrame(CREATOR, CREATOR_PROMPT, "Created /skill@" + added.name + ". Verify it with /skill@--list, then invoke /skill@" + added.name + " <task>.");
    return;
  }

  if (raw.indexOf("invoke ") === 0) {
    var invocation = raw.substring(7);
    var firstSpace = invocation.search(/\s/);
    var name = firstSpace < 0 ? invocation : invocation.substring(0, firstSpace);
    var userPrompt = firstSpace < 0 ? "" : invocation.substring(firstSpace + 1).replace(/^\s+/, "");
    invokeSkill(name, userPrompt);
    return;
  }

  km.print("Unknown relay command. Use /skill@--help or call agent_skill_relay.js --install.", "red");
}

module.exports.main = main;
