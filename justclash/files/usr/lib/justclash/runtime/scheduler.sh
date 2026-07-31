#!/bin/ash
# shellcheck shell=dash

# Generic cron primitives. OpenWrt cron internals belong here, where they are
# actually used, instead of enjoying a sightseeing tour through main.

SCHEDULER_CRONTAB_PATH="/etc/crontabs/root"
SCHEDULER_INITD_PATH="/etc/init.d/cron"

cron_make_if_missing() {
    [ -f "$SCHEDULER_CRONTAB_PATH" ] || touch "$SCHEDULER_CRONTAB_PATH"
}

cron_job_check() {
    local pattern="$1"

    cron_make_if_missing
    grep -qF "$pattern" "$SCHEDULER_CRONTAB_PATH"
}

cron_entry_build() {
    local schedule="$1"
    local command="$2"

    printf '%s %s\n' "$schedule" "$command"
}

cron_entry_apply() {
    local pattern="$1"
    local expected_entry="$2"
    local name="$3"

    cron_make_if_missing
    if grep -qF "$expected_entry" "$SCHEDULER_CRONTAB_PATH"; then
        return 0
    fi

    sed -i "\|${pattern}|d" "$SCHEDULER_CRONTAB_PATH"
    printf '%s\n' "$expected_entry" >>"$SCHEDULER_CRONTAB_PATH"

    if "$SCHEDULER_INITD_PATH" enabled; then
        "$SCHEDULER_INITD_PATH" restart
        log info "$name cron job added and cron service restarted"
    else
        log info "$name cron job added (cron service not enabled)"
    fi
}

# Returns 0 when applied, 2 when the schedule is empty or invalid.
cron_job_add() {
    local schedule="$1"
    local pattern="$2"
    local command="$3"
    local name="$4"
    local expected_entry

    cron_make_if_missing

    if [ -z "$schedule" ]; then
        log error "$name cron schedule string is empty. Cron job was not added."
        return 2
    fi

    if ! val_cron_expr "$schedule"; then
        log error "$name cron schedule string is invalid: $schedule. Cron job was not added."
        return 2
    fi

    expected_entry=$(cron_entry_build "$schedule" "$command")
    cron_entry_apply "$pattern" "$expected_entry" "$name"
}

cron_job_remove() {
    local pattern="$1"
    local name="$2"

    cron_make_if_missing
    if cron_job_check "$pattern"; then
        sed -i "\|${pattern}|d" "$SCHEDULER_CRONTAB_PATH"
        if "$SCHEDULER_INITD_PATH" enabled; then
            "$SCHEDULER_INITD_PATH" restart
            log info "$name cron job removed and cron service restarted"
        else
            log info "$name cron job removed (cron service not enabled)"
        fi
    fi
}
