# Elsewhere development record

This is the narrative record of what we built, what feedback changed, what we learned, and the tradeoffs we accepted. It describes the project from its first published commit through the first persistent conversational planner.

Start with the [development journal](journal.md). The [current status and gaps](status.md) distinguish working local behavior from architectural plans, earlier explorations and deployed behavior. The [commit map](commits.md) connects the retrospective chapters to Git history.

## How to read this history

The original three published commits are preserved. Much of the later work was developed locally across several conversations without intermediate commits. It is now being organized retrospectively into dependency-ordered sections. These are not backdated original development milestones, independently deployed releases, or a claim that every historical intermediate passed today's tests. Shared database foundations are grouped early; the application composition is integrated after its dependencies. The final snapshot is the verified local implementation.

Each new section commit records its purpose, lessons, decisions and tradeoffs in its message. The journal adds product context that would make a commit message too long. Code comments and focused implementation notes remain the source for technical detail.

## Publication boundaries

- This review branch does not rewrite the existing published commits or update production `main`.
- `apps/web/vercel.json` disables Git deployments for `codex/development-history` specifically; other branches keep their existing Vercel behavior. This preserves the instruction to publish source without automatically deploying the app.
- `.env` files, keys, database passwords, local build/deployment state and dependency directories stay ignored.
- Three local library/account captures containing a real trip are excluded. Public screenshots use empty forms, example inputs, prototype previews or the explicitly named QA trip. The historical connection-status screenshot has no connection credentials.
- Historical notes about blockers remain as history. Later dated corrections and the current status page supersede them.
