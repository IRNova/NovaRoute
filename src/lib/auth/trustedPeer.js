/**
 * Peer-address trust anchors.
 *
 * custom-server.js wraps the HTTP server, derives the client IP from the TCP
 * socket and stamps request headers. It also sets a per-boot random stamp
 * (NR_PEER_STAMP) that only the wrapper process knows, so app code can tell
 * "this header was stamped by my own wrapper" apart from a header forged by a
 * direct client (possible when the app runs behind a bare standalone server).
 */
export function hasTrustedPeerStamp(request) {
  const stamp = process.env.NR_PEER_STAMP;
  if (!stamp) return false;
  const header = request?.headers?.get?.("x-9r-proxy-stamp");
  return typeof header === "string" && header === stamp;
}
