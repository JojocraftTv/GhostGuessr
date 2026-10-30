import { start } from "./app.js";

try {
  start();
} catch (error) {
  console.error("[GhostGuessr] failed to start", error);
}
