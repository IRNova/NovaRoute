import { NextResponse } from "next/server";
import { isLocalRequest } from "@/dashboardGuard";

/**
 * POST /api/setup/free-providers
 *
 * Only auto-configure providers that truly need NO credentials (noAuth).
 * Providers requiring OAuth/API key are NOT auto-configured —
 * users set them up manually from the dashboard.
 */
export async function POST(request) {
  // x-real-ip / x-forwarded-for are client-supplied: a remote caller could send
  // "x-real-ip: 127.0.0.1" and pass as local. isLocalRequest() keys on the
  // stamp custom-server.js derives from the TCP socket instead.
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [{ createProviderConnection }, REGISTRY] = await Promise.all([
      import("@/models"),
      import("open-sse/providers/registry/index.js"),
    ]);

    const registry = REGISTRY.default || REGISTRY;

    // ONLY truly noAuth providers — zero credentials needed.
    // Local runtimes + CLI tools are excluded: they must be installed and
    // verified first via the provider page's "Install & Configure" action,
    // otherwise dead active connections pollute routing with errors.
    const noAuthProviders = registry.filter(
      (r) => r.noAuth === true && r.category !== "local" && r.category !== "cli"
    );

    const results = [];
    for (const provider of noAuthProviders) {
      try {
        const created = await createProviderConnection({
          provider: provider.id,
          authType: "none",
          name: "Free",
          isActive: true,
          providerSpecificData: {},
        });
        results.push({
          provider: provider.id,
          name: provider.display?.name || provider.id,
          id: created.id,
        });
      } catch (err) {
        results.push({ provider: provider.id, error: err.message });
      }
    }

    return NextResponse.json({ configured: results.length, providers: results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
