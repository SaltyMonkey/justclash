# Workspace Rules

- **Response Style (Claude-style)**: Apply the communication guidelines in the [claude-style skill](.agents/skills/claude-style/SKILL.md), unless the user requests a different style. Keep implementation decisions governed by the task and the rules below.
- **Code Standards**: When writing, analyzing or modifying code, always adhere to the OpenWrt constraints and POSIX shell standards defined in the [code-review skill](.agents/skills/code-review/SKILL.md).
- **Localization (i18n)**: When adding or modifying user-facing text wrapped in `_("...")` inside LuCI JS views (`luci-app-justclash/htdocs/luci-static/resources/view/justclash/*.js`), update the localization templates (`.pot` and `.po`). Run `translation-sync.sh` from `luci-app-justclash`: use WSL (`wsl -e bash -c 'cd "<path_to_luci-app-justclash>" && bash ./translation-sync.sh'`) when running on Windows, or run `bash ./translation-sync.sh` natively when running on Linux. Always clean up generated backup files (`*.po~`).

## Implementation scope

- For small changes, follow the structure and conventions of the surrounding code. Keep refactoring outside the requested behavior change unless it is necessary to complete it correctly.
- Introduce helpers or abstractions only when they provide a concrete benefit for the current task, such as reducing real complexity or keeping shared behavior consistent. Do not treat removing a few repeated declarations as sufficient justification on its own.
- Add validation and failure paths only for concrete correctness requirements. Do not introduce a new startup failure to enforce a preference or convention; preserve valid existing configurations.
- When the user narrows the task, remove code, checks, translations, and documentation introduced for the discarded part. Preserve unrelated work.
