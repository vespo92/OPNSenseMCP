/**
 * Startup connectivity-probe policy.
 *
 * Lives in its own module rather than in index.ts because index.ts starts the
 * MCP server as a side effect of being imported, which makes the decision
 * logic untestable there.
 */

/**
 * Decide whether a failed connectivity probe should stop the server coming up.
 *
 * `testConnection()` probes `GET /core/firmware/info`, which OPNsense gates
 * behind the `page-system-firmware-manualupdate` privilege. A least-privilege
 * API key — the recommended way to run this against a firewall — will not have
 * it, and gets a 403 even though its credentials are perfectly valid.
 *
 * Treating that as fatal aborted initialization before any resource was
 * constructed, leaving all ~125 tools null so every call failed with
 * "Cannot read properties of null" — including tools whose own privilege was
 * granted. A 403 therefore means "carry on": the key authenticated, it just
 * cannot read this one endpoint, and each tool can surface its own permission
 * error at call time.
 *
 * Anything else — 401, a network error, a non-OPNsense host — stays fatal, so
 * genuinely broken configuration still fails loudly at startup instead of
 * presenting as a wall of confusing per-tool errors.
 */
export function isProbeDeniedByPrivilege(
  test: { success: boolean; statusCode?: number }
): boolean {
  return !test.success && test.statusCode === 403;
}
