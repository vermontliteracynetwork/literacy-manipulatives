# Standing instructions for this repo

## Every push to main also goes to the independent work dashboard
Direct teacher rule (2026-11-18): "always push to independent dash when pushed to main". The dashboard
(`vermontliteracynetwork/Dashboard`, branch `claude/new-session-nwv821`) frames this site in its Computer's Literacy
Manipulatives app. Every time this repo is pushed to `main`, the same turn, in the dashboard: add a What's New entry
(`src/lib/changelog.ts`) when students would notice the change, add or update a dev plan item
(`docs/DEVELOPMENT_PLAN.md`), push it to `main`, and republish its Build Queue page. See the dashboard's CLAUDE.md,
"Literacy Manipulatives main pushes come here too".

## Only the Symbolic Grammar Engine is shared
Direct teacher rule (2026-11-18): the dashboard's code and this site's code are separate; the only shared piece is the
Symbolic Grammar Engine (her curriculum). Never copy code between the two.

## Quiet build
No narration between tool calls. One short report at the end.
