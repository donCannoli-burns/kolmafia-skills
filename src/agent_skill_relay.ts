// TypeScript contract for the executable KoLmafia relay.
// Runtime behavior is implemented in kolmafia/scripts/agent_skill_relay.js.

export type AgentSkillCommand =
  | "--install"
  | "--help"
  | "--list"
  | "--sync"
  | "__sync__ <reason>"
  | "make-a-new-skill <name> :: <definition>"
  | "invoke <name> <runtime-prompt>";

export const USER_NAMESPACE = "/skill@";
export const STORAGE_NAMESPACE = "agentskill.";
export const CREATOR_SKILL = "make-a-new-skill";
export const PROTOCOL_VERSION = 1;
export const MAX_SKILL_PROMPT = 12000;

export function isValidSkillName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(name);
}
