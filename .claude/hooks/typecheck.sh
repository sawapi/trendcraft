#!/bin/bash

# Read hook input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only run typecheck for TypeScript/TSX files
if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  # Determine which tsconfig to use based on file path
  if [[ "$FILE_PATH" == *"examples/chart-viewer"* ]]; then
    cd "$CLAUDE_PROJECT_DIR/examples/chart-viewer" && npx tsc --noEmit --pretty 2>&1 | head -20
  else
    cd "$CLAUDE_PROJECT_DIR" && npx tsc --noEmit --pretty 2>&1 | head -20
  fi
fi

exit 0
