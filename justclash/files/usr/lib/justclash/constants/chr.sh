#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC2034

# Shared character constants: NL separates UCI lists and YAML/nft sidecar records;
# CR and TAB are used with NL by helpers/strings.sh for escaping and stripping.
# Readonly in this shell; sourced modules use them without export.
# Command substitution strips trailing newlines; keep the sentinel until after it.
NL="$(printf '\n.')"
NL="${NL%.}"
CR="$(printf '\r')"
TAB="$(printf '\t')"

readonly NL CR TAB
