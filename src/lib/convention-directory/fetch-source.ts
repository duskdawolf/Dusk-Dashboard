import { lookup } from "node:dns/promises";
import { Agent, request } from "node:https";
import { BlockList } from "node:net";
import { safePublicUrl, sameOfficialHost } from "./model";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(network, prefix);

export async function fetchOfficialSource(
  source: string,
  redirects = 0,
): Promise<string> {
  if (!safePublicUrl(source) || redirects > 3)
    throw new Error("Invalid official source URL or redirect limit");
  const url = new URL(source);
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { family: 4, all: true }),
    new Promise<never>((_, reject) => {
      dnsTimer = setTimeout(
        () => reject(new Error("Official source DNS timed out")),
        5000,
      );
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((a) => blocked.check(a.address)))
    throw new Error("Official source must resolve to a public address");
  // Pin validated DNS for the connection; reject cross-host redirects and do not
  // forward cookies/credentials. Avoid DNS rebinding and internal network access.
  const response = await new Promise<{ body: string; redirect?: string }>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          agent: new Agent({ proxyEnv: process.env }),
          method: "GET",
          headers: {
            accept: "application/json,text/html",
            "user-agent": "Dusk-Convention-Directory/31.2",
          },
          lookup: (_hostname, _options, callback) =>
            callback(null, addresses[0].address, 4),
        },
        (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const target = new URL(res.headers.location, url).href;
            res.resume();
            if (!sameOfficialHost(source, target)) {
              reject(
                new Error(
                  "Official source redirected to another host; administrator review required",
                ),
              );
              return;
            }
            resolve({ body: "", redirect: target });
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(
              new Error(`Official source returned HTTP ${res.statusCode}`),
            );
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 2_000_000)
              req.destroy(new Error("Official source exceeds 2 MB"));
            else chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({ body: Buffer.concat(chunks).toString("utf8") }),
          );
          res.on("error", reject);
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error("Official source timed out")),
        15000,
      );
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    },
  );
  return response.redirect
    ? fetchOfficialSource(response.redirect, redirects + 1)
    : response.body;
}
