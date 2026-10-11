import { createApp } from "./app.js";
import { loadApiConfig } from "./config/environment.js";

const config = loadApiConfig();

const server = createApp().listen(config.port, () => {
  console.info(`Inventory API listening on http://localhost:${config.port}`);
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
