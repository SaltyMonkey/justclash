---
name: justclash-docs
description: Write, update, and review JustClash Markdown documentation against its OpenWrt shell implementation, LuCI views, and UCI validation schema. Use for README, quick start, guides, reference documentation, and release notes, including documentation updates after behavior changes.
---

# JustClash documentation

Produce documentation that lets an OpenWrt user complete a task and verify the result. Match the requested scope; a small behavior change normally needs a small documentation change.

## Working approach

- Infer the audience and purpose from the request and the existing document. Ask only when missing information materially changes the result; do not require approval for each outline, section, or paragraph.
- Inspect the relevant implementation and documents before writing. Treat conversation history and commit titles as leads to verify, rather than proof of current behavior.
- Edit the requested Markdown files directly. Preserve unrelated changes and the language of each document unless the user requests otherwise.
- Keep this skill self-contained. Other writing skills can supplement it when requested, but are not prerequisites and should not impose an additional interview on routine edits.

Locate the repository root and start with `info/README.md`, the documentation index, before choosing files. If the index moves, follow the root README. Paths below are repository-relative starting points, not guarantees about future layout; find moved files rather than recreating an old path.

## Check claims against the implementation

Read only the files and portions relevant to the task:

| Question | Source to inspect |
| --- | --- |
| LuCI labels, choices, dependencies, required fields, and UI defaults | `luci-app-justclash/htdocs/luci-static/resources/view/justclash/pages/` and the relevant shared helpers |
| Deletion cleanup, routing selectors, and pending UI changes | The Routing page and `luci-app-justclash/htdocs/luci-static/resources/view/justclash/lib/routing.js` |
| UCI types, optional fields, and validation defaults | `justclash/files/usr/lib/justclash/config/validate.sh`, its configuration readers, and `justclash/files/usr/lib/justclash/constants.sh` |
| Generated core configuration | `justclash/files/usr/lib/justclash/yaml/` and the relevant URI parser |
| Startup, manual commands, and procd behavior | `justclash/files/usr/bin/justclash.sh`, `justclash/files/etc/init.d/justclash`, and `runtime/` |
| Supported URI forms, including `direct://` | `justclash/files/usr/lib/justclash/uri/` |
| Release version and changes | Both package Makefiles, relevant diffs, and the resulting implementation |

Trace a setting through its readers when needed. Distinguish UI defaults, schema defaults, persisted UCI values, and generated output. Check dependencies before describing a field as required or optional. Native schema checks are not necessarily exhaustive or identical to LuCI validation; do not claim that all fields or referenced names are validated. Do not call an option obsolete merely because it is absent from a supplied example or one particular UI view.

Distinguish pending LuCI edits, saved UCI changes, applying changes, and service restart when the distinction affects instructions. Likewise, verify manual CLI and procd paths before claiming they behave identically.

When code, schema, UI, and documentation disagree, identify the discrepancy. Do not quietly invent a consistent behavior or modify implementation during a documentation-only task. Verify external framework or core behavior against primary documentation when local code does not establish the answer.

Respect the user's sensitive-data restrictions before reading configs, logs, examples, or source sections containing protected values. Request separate authorization when needed; use permitted material meanwhile. Use clearly marked placeholders in documentation and redact diagnostics. Installing or invoking this skill does not authorize access to secrets or network identifiers.

## Give each document a purpose

For an ordinary edit, use the existing organization. When restructuring is requested, choose a coherent layout, move useful material rather than dropping it, and update the index and incoming links throughout the repository. Check references in scripts and UI help links as well as Markdown. Retain compatibility pages when an old path is published by runtime code or is otherwise known to be externally consumed, unless changing that integration is within scope.

- `README.md`: project orientation, prerequisites, and links to the next useful document.
- `info/README.md`: routes for new users, common tasks, troubleshooting, and reference material; one main index rather than duplicated full contents lists.
- Current organization: `info/getting-started.md`, `info/guides/`, `info/concepts/`, `info/reference/`, and `info/troubleshooting/`. Follow each directory's purpose instead of requiring numbered filenames or adding unrelated topics to the quick start.
- Quick start: a short path to a working setup with concrete UI actions and verification. Link advanced alternatives rather than explaining all of them inline.
- Explanations: how routing components relate and why a user would choose them.
- UCI reference: types, defaults, optionality, dependencies, and relevant semantics verified against implementation. The existing reference is not proof that an option behaves as described.
- Task guides: focused tasks, prerequisites, steps, expected results, and troubleshooting tied to observable symptoms.
- CLI and API references: actual supported commands, arguments, return values, and operational side effects.
- `RELEASENOTES.md`: user-visible changes, compatibility implications, and migration steps when necessary. Combine related changes; avoid a commit-by-commit transcript.

Keep each detailed explanation in one main location. Elsewhere, provide only the context needed for the current task and a link to that explanation. Small reminders are useful; repeated tutorials and parameter tables are not. Preserve useful examples when removing repetition.

## Terminology and examples

- Prefer **outbound** for an egress entry. Use **provider** for a subscription source and **group** for a named selection of outbounds or provider-supplied nodes. Preserve literal LuCI labels and UCI keys, even when they use different terminology.
- When documenting routing choices, explain that a standalone outbound can be used directly. Recommend groups where stable references, selecting nodes, or switching sources makes them convenient; do not repeat this explanation in unrelated guides or present groups as mandatory.
- Distinguish a direct outbound from the built-in `DIRECT` action. Verify interface binding and URI-versus-JSON behavior before writing examples.
- State actions with the actual interface labels and relevant dependencies. Explain what changes and how the user confirms it worked; include internal details only when they affect a decision.
- Keep user-facing documentation neutral and direct. Avoid promotional filler, unexplained jargon, and sarcasm in the manuals.
- Use minimal, coherent examples with placeholders for private or user-specific values. Do not invent endpoints or replace authorized public installation commands with unusable placeholders. Authorization to inspect an existing value does not by itself authorize publishing it. Ensure commands, section types, keys, and cross-references agree with the implementation. Never describe a placeholder example as tested against a live router.

## Verify the result

- Review the changed text for unsupported claims, omitted prerequisites, contradictions, and repetition with its linked documents.
- Check changed local links and anchors, Markdown fences, and `git diff --check`. Verify any executable examples safely when appropriate and authorized; do not apply router configuration to test prose.
- For substantial guides, read the result as someone without the conversation context: can they locate the controls, perform the task, and recognize success? Fix missing steps rather than adding general background everywhere.
- Report the documents changed, the meaningful checks performed, and any unresolved discrepancy or verification limit. Do not claim runtime testing from a source review.
