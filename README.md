### DeMarkX Markdown Fixer GitHub Action

Deterministic Markdown repair engine for GitHub CI. Auto-heals syntax, enforces GFM compliance, and applies safe fixes back to your branch.

## What is DeMarkX? Most Markdown tools just complain about errors. DeMarkX heals them.

It uses an AST-based repair engine to identify structural issues and automatically fix them with full determinism.
It is idempotent, running it once has the same effect as running it ten times.

### Key Features

- Heals Headers: Fixes missing spaces after # (e.g., #Title → # Title).
- Normalizes Structure: Ensures consistent spacing between blocks and list items.
- Repair Fences: Auto-closes unclosed code blocks and normalizes backtick counts.
- List Alignment: Corrects malformed numbered (1.Item) and bulleted (-Item) lists.
- CI Native: Designed to run on every Pull Request or Push.
- Safe Fixes Only: High-confidence repairs that won't mangle your content.

### Quickstart

Add a

### .github/workflows/demarkx.yml

file to your repository:

```bash
 name: DeMarkX Markdown Repair

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  heal:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Required for auto-committing fixes
    steps:

      - uses: actions/checkout@v4

      - name: Heal Markdown
        uses: SheikhJaveed/demarkx-action@v1.0.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          apply-safe-fixes: true
          dry-run: false
```

### Configuration

### Input Description Default

| Input              | Description                                 | Default        |
| ------------------ | ------------------------------------------- | -------------- |
| `github-token`     | **Required.** The repository `GITHUB_TOKEN` | N/A            |
| `apply-safe-fixes` | Automatically repair and commit safe fixes  | `true`         |
| `dry-run`          | Report issues without modifying files       | `false`        |
| `max-files`        | Limit number of files processed per run     | `50`           |
| `skip-paths`       | Comma-separated paths to ignore             | `node_modules` |


## How it works 
DeMarkX does not use regex-based patching.

It parses Markdown into an Abstract Syntax Tree (AST), applies deterministic architectural repairs, and regenerates a clean Markdown string.

### Safe vs. Inferred Fixes

- Safe Fixes: Standard-compliant repairs like missing spaces or broken fences.
- Inferred Fixes: Logic corrections where the engine "guesses" your intent (e.g., deeply nested list re-alignment).
<br>
Default behavior only applies Safe Fixes to ensure your docs are never corrupted.

