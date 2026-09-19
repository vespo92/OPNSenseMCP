# Safety Modes (Dry-Run & Read-Only)

## Overview

Every tool call this server exposes can eventually turn into a live change
on a production router — a firewall rule, a NAT mapping, a raw `pfctl`
command over SSH. `OPNSENSE_DRY_RUN` and `OPNSENSE_READ_ONLY` exist to put a
governor on that: an operator-set environment variable that a model can
never see, set, or talk its way around, no matter which tool it calls.

Both variables are read once from `process.env` and applied *after* any
config supplied through the `configure` tool is parsed, so a tool call can
widen nothing.

## Why two chokepoints, not 147 tools

This server exposes 147 MCP tools, and a growing list at that. Gating
safety mode inside each tool's handler would mean re-auditing all of them
every time a new one is added, and one miss is a real router change. Instead
mode enforcement lives at the two places every mutation actually has to pass
through to reach the router, regardless of which tool triggered it:

```
MCP Tool → (validation, resource logic) → OPNSenseAPIClient.post/put/delete → axios → router
MCP Tool → (validation, resource logic) → SSHExecutor.execute            → ssh2  → router
```

Every `create_*`, `update_*`, `delete_*`, `toggle_*`, `apply_*`, `restore_*`,
and `fix_*`-style tool bottoms out in one of those two calls (directly, or
via a resource class like `VlanResource`/`FirewallRuleResource`/
`CLIExecutorResource`, all of which themselves call back into
`OPNSenseAPIClient`). Gate the two chokepoints once, and every tool built on
top of them is covered automatically — including any added later.

## OPNSenseAPIClient (`src/api/client.ts`)

`OPNSenseAPIClient.post/put/delete` each start with a call to a private
`guardMutation(method, path, data)`:

- **`readOnly: true`** — logs a warning, records the attempt (via the same
  `recorder` hook macros use), and throws `OPNSenseAPIError` with a 403-style
  message before axios is ever touched. Nothing is sent.
- **`dryRun: true`** — logs what *would* have been sent, records it, and
  returns a synthetic success without calling axios:
  ```ts
  {
    result: 'dry-run',
    dryRun: true,
    message: 'DRY RUN: would have sent POST /firewall/filter/addRule — request was not executed.',
    wouldSend: { method: 'POST', path: '/firewall/filter/addRule', data: { rule: { ... } } }
  }
  ```
  The caller gets back something shaped like a normal API response, so tool
  handlers don't need special-casing — they report success with the
  simulated payload instead of a real one.
- **Neither flag set** — behaves exactly as before; this is a pure addition,
  not a rewrite of the request path.

`GET` requests are **never gated**. They can't mutate router state, and the
server needs them to keep working in both modes so an agent (or a human
reviewing dry-run output) can still see current state, list rules, and
diagnose.

`isDryRun()` / `isReadOnly()` are exposed on the client if resource code
ever needs to branch on mode explicitly.

## SSHExecutor (`src/resources/ssh/executor.ts`)

The SSH path is a second, separate blast-radius surface: `ssh_execute`,
`cli_execute`, and several targeted fix/reload tools ultimately call
`SSHExecutor.execute(command)`, which runs a whitelisted shell command
directly on the router (`configctl`, `pfctl`, `service`, `rm`, `cp`, `kill`,
...). There's no structured payload here to simulate the way there is for a
JSON API body — it's an arbitrary command string — so the gating works
differently:

1. `execute()` first checks the command against the existing
   `COMMAND_WHITELIST` (unchanged — this is the pre-existing security
   boundary, not new).
2. It then checks the command against `READ_ONLY_COMMAND_PATTERNS`, a
   conservative, explicit set of regexes for commands that are read-only
   even though their binary is whitelisted — e.g. `pfctl -s ...` (show
   state) is safe, but `pfctl -d`/`-e`/`-f` (disable/enable/reload the
   firewall) is not; `netstat`, `ping`, `route get`, `ifconfig` (without
   `up`/`down`/`create`/`destroy`) are always safe.
3. If the command **matches** the read-only pattern set, it runs normally —
   in *either* safety mode — because it cannot change router state. This is
   what keeps diagnostics like `ssh_show_pf_rules` and `cli_show_routing`
   useful even under `OPNSENSE_READ_ONLY=true`.
4. If it does **not** match:
   - `readOnly: true` → returns a failure result (`success: false`,
     `exitCode: 1`) explaining the block, without opening an SSH connection.
   - `dryRun: true` → returns a synthetic success (`success: true`,
     `stdout: "DRY RUN: command was not executed: <cmd>"`), again without
     connecting.

Anything not explicitly recognized as read-only is treated as a potential
mutation by default — the allowlist is deliberately narrow.

## Tool-list filtering (defense in depth)

`OPNSENSE_READ_ONLY=true` additionally:

- Removes all statically-known write-capable tools (`WRITE_TOOL_NAMES` in
  `src/index.ts`, ~70 of the 147) from the `ListTools` response, so a model
  never sees them as an option in the first place.
- Hard-rejects a call to one of those tools by name in the `CallTool`
  handler, even if a client cached an older tool list.

This layer is **not** the actual safety boundary — the two chokepoints above
already reject or simulate the underlying request regardless of which tool
called it. It exists to fail fast with a clear error and to keep the model
from even attempting a call that's guaranteed to be blocked. `ssh_*`/`cli_*`
tools are deliberately excluded from this list: the `SSHExecutor` already
gates per-command (see above), which is more precise than blocking the
whole tool — blanket-blocking `ssh_show_routing` along with `ssh_execute`
would break legitimate read-only diagnostics for no safety benefit.

## Configuration

```bash
# Block every mutating API call and every non-read-only SSH command.
# Write-capable tools are also hidden from the tool list.
OPNSENSE_READ_ONLY=true

# Let write tools be called, but simulate the request instead of sending it.
OPNSENSE_DRY_RUN=true
```

If both are set, `OPNSENSE_READ_ONLY` wins — dry-run only matters once
read-only is off.

Recommended rollout for a new deployment against a real router: start with
`OPNSENSE_READ_ONLY=true`, switch to `OPNSENSE_DRY_RUN=true` once you trust
the agent's judgment enough to see what it *would* do, then remove both.

See [CONFIGURATION.md](../../CONFIGURATION.md#safety-modes) for the
environment variable reference and MCP client config examples.

## Tests

- `tests/unit/api-client-safety.test.ts` — dry-run/read-only/normal-mode
  behavior of `OPNSenseAPIClient.post/put/delete`, GET passthrough, and
  recorder integration.
- `tests/unit/ssh-executor-safety.test.ts` — dry-run/read-only/normal-mode
  behavior of `SSHExecutor.execute`, including the read-only command
  allowlist and the pre-existing base whitelist.
