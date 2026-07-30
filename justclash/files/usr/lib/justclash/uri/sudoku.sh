#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_sudoku_url() {
    local link="$1" dialer_proxy="$2" name="$3" interface_name="$4" routing_mark="$5" ip_version="$6"
    local padding_min="${7:-5}" padding_max="${8:-15}"
    raw="$link"
    raw="${raw#sudoku://}"

    local b64
    b64="$(printf '%s' "$raw" | tr -- '-_' '+/')"
    local rem=$((${#b64} % 4))
    if [ "$rem" -eq 2 ]; then
        b64="${b64}=="
    elif [ "$rem" -eq 3 ]; then
        b64="${b64}="
    fi

    payload="$(printf '%s' "$b64" | base64 -d 2>/dev/null)" || {
        echo "Error: failed to decode sudoku:// link" >&2
        return 1
    }

    printf '%s\n' "$payload" | jq -c \
        --arg name "$name" \
        --arg dialer_proxy "$dialer_proxy" \
        --arg interface_name "$interface_name" \
        --arg routing_mark "$routing_mark" \
        --arg ip_version "$ip_version" \
        --argjson padding_min "$padding_min" \
        --argjson padding_max "$padding_max" '

    {
        name: $name,
        type: "sudoku",
        server: .h,
        port: .p,
        key: .k,
        udp: true
    }

    # aead-method (default: chacha20-poly1305)
    + (if (.e? and (.e | length > 0))
        then {"aead-method": .e}
        else {"aead-method": "chacha20-poly1305"}
      end)

    # table-type supports symmetric and directional upstream modes.
    + {
        "table-type": (
          if (.a? and (.a != null)) then
            (
              .a
              | tostring
              | ascii_downcase
              | if . == "ascii" or . == "prefer_ascii" then
                    "prefer_ascii"
                elif . == "entropy" or . == "prefer_entropy" or . == "" then
                    "prefer_entropy"
                elif . == "up_ascii_down_entropy" or . == "up_entropy_down_ascii" then
                    .
                elif . == "up_prefer_ascii_down_prefer_entropy" then
                    "up_ascii_down_entropy"
                elif . == "up_prefer_entropy_down_prefer_ascii" then
                    "up_entropy_down_ascii"
                else
                    .
                end
            )
          else
            "prefer_entropy"
          end
        )
      }

    # padding
    + {
        "padding-min": $padding_min,
        "padding-max": $padding_max
      }

    # custom-tables
    + (if (.ts? and (.ts | type == "array") and (.ts | length > 0))
        then {"custom-tables": .ts}
        else {}
      end)

    # custom-table
    + (if ((.ts? | not) or (.ts | length == 0)) and (.t? and (.t | length > 0))
        then {"custom-table": .t}
        else {}
      end)

    # enable-pure-downlink = NOT(PackedDownlink)
    + (if (.x? != null)
        then {"enable-pure-downlink": (.x | not)}
        else {"enable-pure-downlink": true}
      end)

    # httpmask object (upstream style)
    + (if (.hd? != null) or (.hm? and (.hm | length > 0)) or (.ht? != null) or (.hh? and (.hh | length > 0)) or (.hx? and (.hx | length > 0)) or (.hy? and (.hy | length > 0))
        then {"httpmask": (
            {}
            + (if (.hd? != null) then {disable: .hd} else {} end)
            + (if (.hm? and (.hm | length > 0)) then {mode: .hm} else {} end)
            + (if (.ht? != null) then {tls: .ht} else {} end)
            + (if (.hh? and (.hh | length > 0)) then {host: .hh} else {} end)
            + (if (.hy? and (.hy | length > 0)) then {"path-root": .hy} else {} end)
            + (if (.hx? and (.hx | length > 0)) then {multiplex: .hx} else {} end)
        )}
        else {}
      end)

    # dialer-proxy
    + (if ($dialer_proxy | length > 0)
        then {"dialer-proxy": $dialer_proxy}
        else {}
      end)
    + (if ($interface_name | length > 0)
        then {"interface-name": $interface_name}
        else {}
      end)
    + (if ($routing_mark | length > 0)
        then {"routing-mark": ($routing_mark | tonumber)}
        else {}
      end)
    + (if ($ip_version | length > 0)
        then {"ip-version": $ip_version}
        else {}
      end)
    '
}
