// Refuse to start a second dev server: two `next dev` processes share .next-dev
// and overwrite each other's chunks ("Cannot read properties of undefined (reading 'call')").
import net from "node:net";

const port = Number(process.env.PORT ?? 3000);
const probe = net.createServer();
probe.once("error", () => {
  console.error(`\nA dev server is already running on http://localhost:${port}. Use it, or stop it first (Ctrl+C in its terminal).\n`);
  process.exit(1);
});
probe.once("listening", () => probe.close(() => process.exit(0)));
probe.listen(port);
