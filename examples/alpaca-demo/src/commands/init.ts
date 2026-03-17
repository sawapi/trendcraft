/**
 * CLI command: init
 *
 * Generate a default trading.json config file and run preflight checks.
 */

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONFIG_FILE, generateDefaultConfig } from "../config/trading-config.js";
import { createLogger } from "../util/logger.js";

const log = createLogger("INIT");

const ENV_EXAMPLE = resolve(import.meta.dirname, "../../.env.example");
const ENV_FILE = resolve(import.meta.dirname, "../../.env");

export async function initCommand(): Promise<void> {
  log.info("Initializing alpaca-demo project...\n");

  // 1. Generate trading.json
  if (existsSync(DEFAULT_CONFIG_FILE)) {
    log.info(`Config file already exists: ${DEFAULT_CONFIG_FILE}`);
    log.info("  To regenerate, delete the file first.");
  } else {
    const config = generateDefaultConfig();
    writeFileSync(DEFAULT_CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
    log.info(`Created config file: ${DEFAULT_CONFIG_FILE}`);
    log.info("  Edit this file to customize your trading setup.");
  }

  // 2. Check .env
  if (!existsSync(ENV_FILE)) {
    if (existsSync(ENV_EXAMPLE)) {
      log.warn(
        `.env file not found. Copy .env.example to .env and fill in your Alpaca credentials:\n  cp ${ENV_EXAMPLE} ${ENV_FILE}`,
      );
    } else {
      log.warn(".env file not found. Create one with ALPACA_API_KEY and ALPACA_API_SECRET.");
    }
  } else {
    log.info(".env file found.");
  }

  // 3. Run preflight if possible
  console.log("");
  log.info("Next steps:");
  log.info("  1. Edit data/trading.json with your desired strategies and symbols");
  log.info("  2. Ensure .env has valid Alpaca credentials");
  log.info("  3. Run: pnpm run dev preflight");
  log.info("  4. Run: pnpm run dev live --config data/trading.json");
}
