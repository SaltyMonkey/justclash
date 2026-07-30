#!/bin/ash
# shellcheck shell=dash

_CONFIG_LIBDIR="${JUSTCLASH_CONFIG_LIBDIR:-/usr/lib/justclash/config}"

# shellcheck disable=SC1091
. "$_CONFIG_LIBDIR/defaults.sh" || return 1
# shellcheck disable=SC1091
. "$_CONFIG_LIBDIR/validate.sh" || return 1
# shellcheck disable=SC1091
. "$_CONFIG_LIBDIR/load.sh" || return 1
# shellcheck disable=SC1091
. "$_CONFIG_LIBDIR/reset.sh" || return 1

unset _CONFIG_LIBDIR
