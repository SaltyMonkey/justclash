#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC1091

# DEFAULT_* fallbacks are supplied by constants.sh, loaded by the CLI first.
. "/usr/lib/justclash/config/validate.sh" || return 1
. "/usr/lib/justclash/config/load.sh" || return 1
. "/usr/lib/justclash/config/reset.sh" || return 1
