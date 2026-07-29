#!/bin/ash
# shellcheck shell=dash

# Focused helper module loaded into the main ash process.

safe_paths_add() {
    [ -n "$1" ] || return

    case ":$SAFE_PATHS:" in
        *":$1:"*) ;;
        *)
            SAFE_PATHS="${SAFE_PATHS:+$SAFE_PATHS:}$1"
            export SAFE_PATHS
            ;;
    esac
}

safe_paths_clear() {
    SAFE_PATHS=""
    export SAFE_PATHS
}
