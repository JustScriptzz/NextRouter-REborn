export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Render's outbound network doesn't reliably route IPv6. Node's global
    // fetch (undici) tries IPv6 first when a host advertises AAAA records
    // (e.g. Tailscale Funnel hosts) and fails outright instead of falling
    // back to IPv4, surfacing as a generic "fetch failed". Force IPv4-only
    // DNS resolution for every outbound fetch in the app.
    const { Agent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
  }
}
