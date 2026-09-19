# EAA Gatekeeper

Static accessibility review for React pull requests, with the legal citation attached.

On every pull request it scans the changed JSX, posts an inline review comment on each
offending line, and sets a commit status that keeps the branch unmergeable until the file
is clean. Push a fix and the status turns green on its own.

Each inline comment carries:

- the violation and the offending line of code
- the WCAG 2.1 success criterion and the corresponding EN 301 549 clause
- a note that conformance is required under the European Accessibility Act
- a suggested fix
- a self-contained prompt you can paste into any AI coding agent

## How it works

```
pull_request event
  -> GET /pulls/{n}/files          changed files + patches
  -> parse @@ hunk headers         which new-side lines are in the diff
  -> ESLint + eslint-plugin-jsx-a11y on the changed .jsx/.tsx
  -> join each violation to data/rule-map.json for its citation
  -> DELETE stale comments from earlier runs
  -> POST /pulls/{n}/reviews       inline comments, event COMMENT
  -> POST /statuses/{sha}          success or failure on the PR head SHA
```

Static analysis only — no browser, no axe-core, no rendering. The scan is a lint run, so
it finishes in about 20 seconds and needs no secrets beyond the built-in `GITHUB_TOKEN`.

Violations on lines the pull request does not touch cannot be anchored as inline comments,
so they are listed in the review summary instead.

## The rule map

`data/rule-map.json` is the single source of truth. Which ESLint rules run is derived from
its keys, so a violation can never be reported without a citation, and the set that ships
covers the rules the demo component triggers:

| ESLint rule | WCAG 2.1 | EN 301 549 |
| --- | --- | --- |
| `jsx-a11y/alt-text` | 1.1.1 Non-text Content (A) | 9.1.1.1 |
| `jsx-a11y/heading-has-content` | 1.3.1 Info and Relationships (A) | 9.1.3.1 |
| `jsx-a11y/click-events-have-key-events` | 2.1.1 Keyboard (A) | 9.2.1.1 |
| `jsx-a11y/no-autofocus` | 2.4.3 Focus Order (A) | 9.2.4.3 |
| `jsx-a11y/label-has-associated-control` | 3.3.2 Labels or Instructions (A) | 9.3.3.2 |
| `jsx-a11y/anchor-is-valid` | 4.1.2 Name, Role, Value (A) | 9.4.1.2 |

**Extending it is one JSON entry.** Add a key with `wcag`, `en301549`, `fix` and `prompt`
and the scanner enforces it on the next run — no code change. `eslint-plugin-jsx-a11y`
ships roughly 30 more rules that can be mapped the same way. A startup assertion rejects
an entry with any field missing, so a half-finished addition fails loudly rather than
producing a comment with a hole in its citation.

For web content, EN 301 549 clause 9.x mirrors the WCAG success criterion number, which is
what makes the mapping mechanical rather than a matter of interpretation.

## Setup

The workflow needs exactly these permissions:

```yaml
permissions:
  contents: read # checkout
  pull-requests: write # create, list and delete review comments
  statuses: write # commit status
```

To make the gate binding rather than advisory, add `EAA Gatekeeper` as a required status
check in branch protection. Without that the status still shows red but nothing stops a
merge. The context only becomes selectable after the action has reported it once.

## Limitations

Worth being explicit, because the output cites law:

- **Static analysis catches structural failures only.** Missing alt text, unlabelled
  inputs and unreachable controls are visible in the syntax tree. Colour contrast, reading
  order, focus behaviour and anything depending on runtime state are not.
- **A clean run is not a conformance claim.** It means the six mapped rules found nothing.
- **Pull requests from forks get a read-only `GITHUB_TOKEN`**, so comments and statuses
  cannot be written. Same-repo branches only.
- **The citations are a fixed table, not generated.** No model produces the legal text, so
  it cannot drift or hallucinate, but it also only covers what the table covers.
- Not legal advice.

## Development

```
npm ci
npm run build     # tsc -> dist/
npm run typecheck
```

`demo/BadForm.jsx` is the test fixture. Removing an accessibility attribute from it and
opening a pull request is the fastest way to see the gate work end to end.
