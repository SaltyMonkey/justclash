#!/bin/ash
# shellcheck shell=dash

# Runtime operation status convention:
#   0 - success, including an idempotent no-op
#   1 - generic failure or a false predicate result
#   2 - invalid input or configuration
#   3 - required resource is missing
#   4 - runtime state conflict
#   5 - filesystem operation failed
#   6 - external command failed
#   7 - change could not be applied or was rolled back
#
# Predicates keep the usual 0/1 contract. Each operation documents the subset
# it returns; apparently even integers need an API contract once shell grows up.

_RUNTIME_LIBDIR="${JUSTCLASH_RUNTIME_LIBDIR:-/usr/lib/justclash/runtime}"

# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/preflight.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/http.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/core.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/core_update.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/service_data.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/ntpd.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/dnsmasq.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/workdir.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/nftables.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/policy_routing.sh" || return 1

# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/scheduler.sh" || return 1
# shellcheck disable=SC1091
. "$_RUNTIME_LIBDIR/diagnostics.sh" || return 1

unset _RUNTIME_LIBDIR
