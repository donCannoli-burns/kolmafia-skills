#!/usr/bin/env python3
"""Read-only parser for KoLmafia agent-skill aliases and framed session output."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator

NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
DEF_RE = re.compile(r"AGENTSKILL_DEF:v1:([0-9a-fA-F]+)")
BEGIN_RE = re.compile(r"AGENTSKILL_BEGIN\|v=1\|id=([^|\s]+)\|name=([a-z0-9][a-z0-9._-]{0,63})")
END_RE = re.compile(r"AGENTSKILL_END\|v=1\|id=([^|\s]+)\|name=([a-z0-9][a-z0-9._-]{0,63})")
SYNC_RE = re.compile(r"AGENTSKILL_SYNC\|v=1\|reason=([^\s<]+)")


def validate_name(name: str) -> str:
    name = name.strip().lower()
    if not NAME_RE.fullmatch(name):
        raise ValueError("invalid skill name")
    return name


def parse_aliases(path: Path) -> dict[str, str]:
    skills: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        parts = raw.split("\t", 1)
        if len(parts) != 2 or not parts[0].startswith("agentskill."):
            continue
        name = parts[0][len("agentskill."):].strip().lower()
        if not NAME_RE.fullmatch(name):
            continue
        match = DEF_RE.search(parts[1])
        if match:
            try:
                skills[name] = bytes.fromhex(match.group(1)).decode("utf-8")
            except (ValueError, UnicodeDecodeError):
                pass
    return dict(sorted(skills.items()))


@dataclass
class Frame:
    request_id: str
    name: str
    prompt: str


def iter_frames(lines: Iterable[str]) -> Iterator[Frame]:
    request_id = None
    name = None
    body: list[str] = []
    for raw in lines:
        line = raw.rstrip("\r\n")
        begin = BEGIN_RE.search(line)
        if begin:
            request_id, name, body = begin.group(1), begin.group(2), []
            continue
        if request_id is None:
            continue
        end = END_RE.search(line)
        if end and end.group(1) == request_id and end.group(2) == name:
            yield Frame(request_id, name or "", "\n".join(body).strip("\n"))
            request_id = name = None
            body = []
            continue
        body.append(line)


def read_latest(path: Path, skill: str | None = None) -> Frame | None:
    frames = list(iter_frames(path.read_text(encoding="utf-8", errors="replace").splitlines()))
    if skill:
        wanted = validate_name(skill)
        frames = [frame for frame in frames if frame.name == wanted]
    return frames[-1] if frames else None


def latest_sync(path: Path) -> str | None:
    reason = None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = SYNC_RE.search(line)
        if match:
            reason = match.group(1)
    return reason


def native_alias_command(name: str, prompt: str) -> str:
    name = validate_name(name)
    if not prompt:
        raise ValueError("prompt cannot be empty")
    marker = "AGENTSKILL_DEF:v1:" + prompt.encode("utf-8").hex()
    return f'alias agentskill.{name} => ashq print("{marker}")'


def main() -> int:
    p = argparse.ArgumentParser(description="Read-only KoLmafia agent-skill parser")
    sub = p.add_subparsers(dest="command", required=True)

    lp = sub.add_parser("list")
    lp.add_argument("--aliases", required=True)

    sp = sub.add_parser("scrape")
    sp.add_argument("--aliases", required=True)

    rp = sub.add_parser("read")
    rp.add_argument("--session", required=True)
    rp.add_argument("--skill")
    rp.add_argument("--json", action="store_true")

    yp = sub.add_parser("sync")
    yp.add_argument("--aliases", required=True)
    yp.add_argument("--session", required=True)

    ep = sub.add_parser("encode")
    ep.add_argument("--name", required=True)
    ep.add_argument("--prompt", required=True)

    args = p.parse_args()
    try:
        if args.command == "list":
            print("\n".join(parse_aliases(Path(args.aliases))))
        elif args.command == "scrape":
            print(json.dumps({"version": 1, "skills": parse_aliases(Path(args.aliases))}, indent=2, ensure_ascii=False))
        elif args.command == "read":
            frame = read_latest(Path(args.session), args.skill)
            if frame is None:
                return 2
            print(json.dumps(frame.__dict__, ensure_ascii=False) if args.json else frame.prompt)
        elif args.command == "sync":
            print(json.dumps({"version": 1, "reason": latest_sync(Path(args.session)), "skills": parse_aliases(Path(args.aliases))}, indent=2, ensure_ascii=False))
        elif args.command == "encode":
            print(native_alias_command(args.name, args.prompt))
        return 0
    except (FileNotFoundError, ValueError, UnicodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
