/**
 * TUI entry point — renders the ink app
 */

import { render } from "ink";
import React from "react";
import type { SessionOptions } from "../trading/session.js";
import { App } from "./App.js";

export type ConsoleCommandOptions = SessionOptions;

export async function consoleCommand(opts: ConsoleCommandOptions): Promise<void> {
  const { waitUntilExit } = render(<App options={opts} />);
  await waitUntilExit();
}
