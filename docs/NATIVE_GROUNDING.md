# Native KoLmafia grounding

The build was grounded against current upstream KoLmafia source for these behaviors:

- aliases are persisted by `net.sourceforge.kolmafia.persistence.Aliases` in `settings/GLOBAL_aliases.txt`;
- `AliasCommand` delegates writes to the native alias subsystem;
- old-style aliases containing `%%` receive the remaining gCLI text;
- JavaScript exposes KoLmafia runtime-library functions through `require("kolmafia")`;
- login/logout lifecycle preferences are executed by KoLmafia's normal CLI.

Relevant upstream classes include `Aliases`, `AliasCommand`, `LoginManager`, `LogoutManager`, and `JavascriptRuntime`.

This project keeps the Python side read-only and leaves lifecycle-hook installation human-controlled.
