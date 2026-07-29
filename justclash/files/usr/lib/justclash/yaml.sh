#!/bin/ash
# shellcheck shell=dash
# YAML builders use the dynamically scoped state declared by core_generate_yaml().
# Keep their calls synchronous: subshells, pipelines, and background jobs cannot
# propagate assignments back to that state. Shell needed one architectural trapdoor.

_YAML_LIBDIR="${JUSTCLASH_YAML_LIBDIR:-/usr/lib/justclash/yaml}"

# shellcheck disable=SC1091
. "$_YAML_LIBDIR/compose.sh" || return 1
# shellcheck disable=SC1091
. "$_YAML_LIBDIR/providers.sh" || return 1
# shellcheck disable=SC1091
. "$_YAML_LIBDIR/rules.sh" || return 1
# shellcheck disable=SC1091
. "$_YAML_LIBDIR/groups.sh" || return 1
# shellcheck disable=SC1091
. "$_YAML_LIBDIR/proxies.sh" || return 1
# shellcheck disable=SC1091
. "$_YAML_LIBDIR/document.sh" || return 1

unset _YAML_LIBDIR
