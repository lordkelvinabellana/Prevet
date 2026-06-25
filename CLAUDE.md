# ⚠️ Read PROGRESS.md first

This is the **Car Pre-Vetting Tool** capstone. Build state and the immediate
next step are tracked in [PROGRESS.md](./PROGRESS.md) — read it first. The full,
detailed plan (product rules, architecture, data model, chunks) is in
[PLAN.md](./PLAN.md).

@AGENTS.md

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
