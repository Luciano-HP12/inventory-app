import { createApp } from "./app.js";

const DEFAULT_PORT = 3000;
const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
const port =
  Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

const server = createApp().listen(port, () => {
  console.info(`Inventory API listening on http://localhost:${port}`);
});

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`Received ${signal}; closing Inventory API`);

  server.close((error) => {
    if (error) {
      console.error("Inventory API failed to close cleanly", error);
      process.exitCode = 1;
    }

    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
