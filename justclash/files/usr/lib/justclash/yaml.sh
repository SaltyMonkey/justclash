#!/bin/ash
# shellcheck shell=dash
# YAML builders use the dynamically scoped state declared by core_generate_yaml().
# NL is a readonly newline from constants.sh; it separates records in build buffers.
# Keep their calls synchronous: subshells, pipelines, and background jobs cannot
# propagate assignments back to that state. Shell needed one architectural trapdoor.

# shellcheck disable=SC1091
. "/usr/lib/justclash/yaml/compose.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/yaml/providers.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/yaml/rules.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/yaml/groups.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/yaml/proxies.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/yaml/document.sh" || return 1
