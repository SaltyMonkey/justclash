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

# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/preflight.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/downloads.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/core.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/core_update.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/ntpd.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/dnsmasq.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/workdir.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/nftables.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/policy_routing.sh" || return 1

# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/scheduler.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/runtime/diagnostics.sh" || return 1
