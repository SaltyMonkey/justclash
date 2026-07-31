#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC1091

_HELPERS_LIBDIR="${JUSTCLASH_HELPERS_LIBDIR:-/usr/lib/justclash/helpers}"

. "$_HELPERS_LIBDIR/strings.sh" || return 1
. "$_HELPERS_LIBDIR/files.sh" || return 1
. "$_HELPERS_LIBDIR/formatting.sh" || return 1
. "$_HELPERS_LIBDIR/validation.sh" || return 1
. "$_HELPERS_LIBDIR/safe_paths.sh" || return 1
. "$_HELPERS_LIBDIR/system_info.sh" || return 1

unset _HELPERS_LIBDIR
