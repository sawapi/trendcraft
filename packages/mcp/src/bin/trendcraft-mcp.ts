import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server keeps running until stdio closes; nothing else to do here.
}

main().catch((err) => {
  // stdout is reserved for the MCP transport; route errors to stderr.
  process.stderr.write(
    `[trendcraft-mcp] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
