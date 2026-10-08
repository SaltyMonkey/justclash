# LuCI Pages and Core Availability

JustClash has two kinds of LuCI pages: saved configuration and service management, and live data from Mihomo. Live data requires a running core and a reachable controller API. A live page may still open while its data is unavailable; an error or an empty list does not mean the saved UCI configuration has disappeared.

## What Works While Mihomo Is Stopped

| Page | Usable with the core stopped | Data and actions |
| --- | --- | --- |
| Status | Service controls remain usable | Service state, start/stop, diagnostics, and core/data updates. Traffic, memory, runtime mode, and updating active rulesets need the core API. |
| Setup: Service | Yes | Saved startup, firewall, and service settings. |
| Setup: Proxy | Yes | Saved core, listener, and controller settings. |
| Setup: DNS | Yes | Saved DNS settings. |
| Setup: Routing | Yes | Saved outbounds, providers, groups, and routing assignments. |
| Setup: Rulesets | Yes | Saved ruleset definitions. |
| Service logs | Yes | JustClash's startup and service journal through rpcd. Use this page to investigate a core that fails to start. |
| Nodes | Live data and actions unavailable | Active groups and providers, node selection, delay tests, and runtime mode changes through the Mihomo API. |
| Rules | Live data and actions unavailable | Rules loaded into the running core and their runtime enabled/disabled state. |
| Connections | Live data and actions unavailable | Active core connections and actions to close them. |
| Realtime logs | Live stream unavailable | The live Mihomo log stream through WebSocket. It is separate from Service logs. |

Use **Setup: Routing** and **Setup: Rulesets** to edit saved routing configuration while the core is stopped. **Rules** shows the current runtime rules; it is not the saved-configuration editor. Likewise, **Nodes** controls active selections, while **Setup: Routing** defines saved outbounds and groups.

## What the Current UI Shows

- **Nodes and Rules:** an API request failure produces a load-error notification, but the page can still render an empty list. Check Status before assuming that there are no groups or rules.
- **Connections and Realtime logs:** the page can open without an active stream. It may remain empty, or retain the last received entries after a disconnect.
- **Status:** service controls remain available, while live metrics may stay at zero or their last received values. Runtime mode can appear as **Unknown** if its API request fails. These values alone do not establish whether the controller is reachable.

Check the service state on **Status** first. If startup fails, use **Service logs**, which reads the service journal without requiring a running Mihomo core.

## When a Live Page Is Unavailable

- **Mihomo is not running:** open **Status** and start JustClash. Reload **Nodes** or **Rules** afterwards; **Connections** and **Realtime logs** normally reconnect automatically. If startup fails, inspect **Service logs** first.
- **API access was denied:** check the API password under **Setup: Proxy**, apply the intended settings, and reload the page. A running service does not guarantee that the browser has valid API credentials.
- **The API cannot be reached or times out:** confirm the service state, controller access, and API TLS settings. The browser connects directly to the Mihomo controller using the host used to open LuCI; rpcd does not relay these live requests.
- **LuCI uses HTTPS:** the controller must be reachable through HTTPS/WSS with a certificate accepted by the browser. A running core can still be inaccessible because the browser blocks HTTP/WS mixed content or rejects its certificate.
- **The API reports an HTTP error or an invalid response:** check the installed Mihomo version and **Service logs**. Check LuCI error notifications when Nodes or Rules cannot load their data.
- **JustClash settings cannot be loaded:** reload LuCI and check the account's configuration permissions. Changing the core state will not repair a LuCI configuration-access failure.

Status keeps service controls available while the core is stopped. Opening a live page does not start the service or modify saved settings.

Connections and Realtime logs retry ordinary connection failures automatically while the page is open, including when it was opened while the core was stopped. Existing rows or log entries are the last received snapshot until the stream reconnects. If the browser blocks connection setup, correct API/TLS settings and reload the page. Reload after changing API credentials or TLS settings as well.

An empty live list is meaningful only after the API connection succeeds: the core may have no active connections, no log events at the selected level, or no selectable groups/providers.
