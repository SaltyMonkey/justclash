# Inbounds

[Documentation](../README.md)

Each inbound has its own port, users, and outbound route. Supported types are
**Mixed Port** (`mixed`), **SOCKS** (`socks`), and **HTTP** (`http`). Mixed Port
accepts HTTP proxy requests, HTTPS tunnels through CONNECT, and SOCKS connections;
the other types accept their respective protocol. UDP is enabled for Mixed Port
and SOCKS. Each inbound uses one wildcard listener with `listen: 0.0.0.0`.
Firewall policy determines which clients can connect.
Applications must explicitly use a listener; transparent TProxy interception is
configured separately. Wildcard listening lets applications on the router and
trusted LAN or VPN networks use the same inbound through a reachable router
address, without binding it to one network. Review
[listening and firewall access](security.md#inbound-listening-and-firewall)
before enabling it.

## Configure in LuCI

Open **Services → JustClash → Setup: Inbounds**, immediately after **Setup: Routing**.
The **Inbounds** table uses the same add, edit, clone, reorder, and remove
controls as the outbound/group tables.

1. Configure OpenWrt firewall access to the inbound port for trusted clients,
   covering TCP and UDP and both IPv4 and IPv6 where supported.
2. Under **Setup: Inbounds**, add a row and select **Mixed Port**, **SOCKS**, or
   **HTTP**. Keep the generated **Name** or enter your own using 1–64 ASCII letters,
   digits, hyphens, or underscores.
3. Set **Port**, add at least one **Authentication** entry, and choose **Send traffic to**.
4. Enable the row and use **Save & Apply**.

For enabled rows, LuCI rejects a port already assigned to JustClash DNS, TProxy,
the API controller, or another enabled inbound. The same check runs when enabling
a saved row. It checks configuration conflicts, not ports occupied by unrelated
services such as SSH or the router's web server.

Each row is an anonymous `inbound` UCI section. No listener is created until a row
is added. There is no per-inbound bind setting.
Disabled sections and sections without a name are skipped with a warning in the
service log.
**Client traffic interfaces** controls transparent interception and does not
restrict inbound access. Inbounds also work when **Create nftables** is disabled.

Wildcard listening covers all interfaces, including WAN; it does not itself grant
access through the firewall. Mihomo's Go listener can accept IPv6 as well as IPv4
on systems supporting dual stack, even with `listen: 0.0.0.0`. The JustClash IPv6
setting does not force this inbound socket to use IPv4 only. Restrict access with
the router's firewall; JustClash does not create inbound access rules automatically.

## Authentication Format

**Authentication** accepts one `<USER>:<PASSWORD>` entry per user. The first colon
separates the fields; additional colons are part of the password. Each inbound has
its own list. Entries are edited in the modal form and are not shown in the table.
The list and new-entry field are masked by default; use the reveal button to
show or hide them.
Empty authentication or an invalid entry causes the entire inbound to be skipped
with a warning in the service log. Each emitted inbound requires at least one
account. LuCI requires a nonempty authentication list and validates each entry
before saving. Usernames and passwords must be nonempty; LuCI rejects whitespace
and control characters within an entry. Local applications also need credentials.
Inbound accounts permit proxy use and do not grant access to Mihomo's controller.
The controller's API password is separate; see
[Controller and proxy access](security.md#controller-and-proxy-access).

Authentication does not encrypt the HTTP/SOCKS transport. Use trusted networks or
a separately protected tunnel and configure firewall access for the inbound port.
Do not publish credentials or raw generated configurations.

## Routing Policy

| Send traffic to | Result |
| --- | --- |
| `BY RULES` | Continue through normal Mihomo routing; no inbound-specific rule is added |
| `DIRECT` | Send traffic directly after core traffic blocking |
| `REJECT` | Reject traffic after core traffic blocking |
| Outbound or group name | Use the selected outbound or group after core traffic blocking |

Each listener receives an internal name derived from its UCI section. Fixed routes
use `IN-NAME` rules, so two listeners can select different exits independently.
**Drop in core** QUIC rules run before these inbound rules. Fixed inbound routes
precede blocklist IP rules, groups, individual outbounds, and the final rule; use
`BY RULES` when clients should follow the normal blocklists and routing policy.

Deleting a referenced outbound or group in LuCI resets the inbound to `BY RULES`.
Renaming that outbound or group updates the inbound's route reference.

## UCI Example

First configure firewall access as described above. Replace the
placeholders locally; do not paste credentials into support messages.

```sh
inbound_section="$(uci add justclash inbound)"
uci set "justclash.$inbound_section.enabled=1"
uci set "justclash.$inbound_section.type=mixed"
uci set "justclash.$inbound_section.name=<INBOUND_NAME>"
uci set "justclash.$inbound_section.port=<PORT>"
uci set "justclash.$inbound_section.exit_rule=BY RULES"
uci add_list "justclash.$inbound_section.authentication=<USER>:<PASSWORD>"
uci commit justclash
service justclash reload
```

## Verify and Remove

Configure an application with a reachable router address, port, and credentials. Verify
that it connects and uses the selected route under **Connections**. Test separate
listeners independently, including the rejection of incorrect credentials.

Disable a row to stop its listener while retaining its settings. Remove the row to
delete it. Apply the changes to update the running core.

Inbound ports are not checked for conflicts by JustClash preflight. If a listener
is unavailable, check Mihomo logs for a bind error and choose an unused port.
The rest of the service can run even if one inbound fails to bind.
