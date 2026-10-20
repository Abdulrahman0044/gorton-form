/**
 * Scan uploaded letters using a local ClamAV clamd service (INSTREAM protocol).
 * The server never forwards staff documents to a third-party scanning website.
 * In production, MALWARE_SCAN_REQUIRED=true prevents unscanned uploads.
 */
import { createConnection } from "node:net";

export async function scanUpload(contents: Buffer): Promise<void> {
  const host = process.env.CLAMAV_HOST?.trim();
  // Public production deployments fail closed if antivirus is not configured.
  const required = process.env.NODE_ENV === "production" || process.env.MALWARE_SCAN_REQUIRED === "true";
  if (!host) {
    if (required) throw new Error("Antivirus scanning is not configured");
    return;
  }
  const port = Number(process.env.CLAMAV_PORT || 3310);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid antivirus port");

  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    let response = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(30_000);
    socket.on("timeout", () => finish(new Error("Antivirus scan timed out")));
    socket.on("error", () => finish(new Error("Antivirus service unavailable")));
    socket.on("connect", () => {
      socket.write("nINSTREAM\n");
      for (let offset = 0; offset < contents.length; offset += 64 * 1024) {
        const chunk = contents.subarray(offset, Math.min(contents.length, offset + 64 * 1024));
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.length, 0);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", chunk => {
      response += chunk.toString("utf8");
      if (response.length > 4096) return finish(new Error("Unexpected antivirus response"));
      if (response.includes("\n") || response.includes("\0")) {
        const answer = response.split(/[\n\0]/, 1)[0].trim();
        if (/^stream: OK$/.test(answer)) finish();
        else if (/^stream: .* FOUND$/.test(answer)) finish(new Error("Malware detected in uploaded file"));
        else finish(new Error("Antivirus rejected the file"));
      }
    });
    socket.on("end", () => { if (!settled) finish(new Error("Antivirus closed without a scan result")); });
  });
}
