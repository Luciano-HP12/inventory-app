import { MessageChannel } from "node:worker_threads";

console.info("Inventory worker started");

let isShuttingDown = false;
const keepAlive = new MessageChannel();
keepAlive.port1.on("message", (message: unknown) => {
  void message;
});

function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`Received ${signal}; stopping Inventory worker`);
  keepAlive.port1.close();
  keepAlive.port2.close();
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
