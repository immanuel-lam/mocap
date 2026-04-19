import express from "express";
import { createServer } from "http";
import os from "os";
import qrcode from "qrcode-terminal";
import { Bonjour } from "bonjour-service";
import { setupWss } from "./ws";
import { setupHttp } from "./http";

const app = express();
const server = createServer(app);
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: "50mb" }));
setupHttp(app);
setupWss(server);

server.listen(PORT, "0.0.0.0", () => {
  const localIPs = (
    Object.values(os.networkInterfaces()).flat() as os.NetworkInterfaceInfo[]
  )
    .filter((i) => i?.family === "IPv4" && !i.internal)
    .map((i) => i.address);

  console.log(`\n[server] listening on port ${PORT}`);
  localIPs.forEach((ip) => console.log(`  http://${ip}:${PORT}`));

  if (localIPs[0]) {
    qrcode.generate(`http://${localIPs[0]}:${PORT}`, { small: true });
  }

  try {
    const bonjour = new Bonjour();
    const primaryIP = localIPs[0] ?? "";
    bonjour.publish({
      name: "mocap",
      type: "mocap",
      port: PORT,
      protocol: "tcp",
      txt: { ip: primaryIP },
    });
    console.log("[bonjour] _mocap._tcp published with ip=" + primaryIP + "\n");
  } catch (e) {
    console.warn("[bonjour] unavailable:", e);
  }
});
