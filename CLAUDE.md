# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Feltwork is shelved.** It was an earlier design system, rolled out to four sites in August 2026 and then reverted everywhere. Nothing consumes it. `README.md` records what it is and how it would be picked back up.

Do not confuse it with **Felt**, the identity of `@doshi-experiments/design-system` since release 0.6.0. Shared UI work belongs in that repository, not here.

## Never publish PII or sensitive information

Nothing personal or sensitive goes to GitHub, under any circumstances, without Rishabh's direct approval of that specific content. That covers commits, branches, pull requests, issues, comments, release notes, screenshots and test fixtures, and it applies even when the repository is private.

- Personal data: names other than Rishabh's public name, email addresses, phone numbers, home addresses, dates of birth.
- Financial data: account or card numbers, balances, real transactions, statements, payees, anything from bank exports or Actual Budget.
- Secrets and infrastructure: `.env` contents, API keys, tokens, passwords, private hostnames and IP addresses, Tailscale names.
- Anything copied from a real export, inbox, database or log.

Use synthetic fixtures instead. Before every commit and push, check the staged diff and any new untracked files for this kind of content. If something looks sensitive, or you are unsure, stop and ask; do not commit it, push it or open a pull request with it. Earlier approval of a different change does not cover this one.

## Commands

```sh
npm run fonts    # copy fonts
npm run bake     # re-bake tex/felt-1024.png
```

Only change this repository if asked to revive or archive it.
