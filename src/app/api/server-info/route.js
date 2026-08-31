import os from "os";
import { NextResponse } from "next/server";

// Public server info: LAN IPv4 addresses + detected public IP + runtime port,
// used by the Endpoint page to show connectable addresses (local / server / domain).

const PUBLIC_IP_TTL_MS = 6 * 60 * 60 * 1000;
const publicIpCache = { ip: null, ts: 0 };

// Best-effort public IP detection, cached for 6h. Never throws.
async function resolvePublicIp() {
  if (publicIpCache.ip && Date.now() - publicIpCache.ts < PUBLIC_IP_TTL_MS) {
    return publicIpCache.ip;
  }
  const services = ["https://api.ipify.org", "https://ifconfig.me/ip"];
  for (const url of services) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(2500),
        headers: { "User-Agent": "curl/8.5.0" },
      });
      if (!res.ok) continue;
      const ip = (await res.text()).trim();
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        publicIpCache.ip = ip;
        publicIpCache.ts = Date.now();
        return ip;
      }
    } catch { /* try next service */ }
  }
  return publicIpCache.ip;
}

export async function GET() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [iface, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (!addr.internal && addr.family === "IPv4") {
        ips.push({ iface, ip: addr.address });
      }
    }
  }
  const publicIp = await resolvePublicIp();
  return NextResponse.json({
    ips,
    port: Number(process.env.PORT) || 20128,
    hostname: os.hostname(),
    ...(publicIp ? { publicIp } : {}),
  });
}
