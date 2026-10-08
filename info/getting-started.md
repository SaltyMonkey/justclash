# JustClash Quick Start

[Documentation](README.md)

This guide gets one website working through one outbound. Other traffic stays
on the normal internet connection. Once this works, you can add more sites,
subscriptions, or automatic failover without guessing which part failed.

You need a working OpenWrt internet connection, SSH access, enough free storage,
and a connection link, Mihomo JSON outbound, subscription, or an existing WAN/VPN
path to use directly. If you are upgrading an existing installation, use
[Update and Backup](guides/maintenance.md)
instead of resetting its settings.

You can route through an individual outbound, or through a group that selects
one. Groups are recommended for convenient switching; they are optional. A
subscription provider supplies nodes to a group. See
[Outbounds, providers, and groups](guides/routing.md#how-the-components-fit-together)
for the full model. The setup below uses one group and one outbound.

## 1. Install JustClash

### Online Installer

Connect to the router over SSH and run:

```sh
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh
```

Follow the installer prompts. It detects the package manager, installs the
service and LuCI packages, and downloads the Mihomo core for your router.
For unattended installation, a specific release, or a core-only update, see
[Installer Options](guides/maintenance.md#update-with-the-online-installer).

### Manual Installation from a Release

If you prefer local packages, download `justclash` and `luci-app-justclash`
from the same release. Use `.apk` for APK-based OpenWrt or `.ipk` for OPKG;
both packages have architecture `all`. Follow the
[checksum and installation instructions](guides/maintenance.md#verify-manual-release-files).

The Mihomo core is a separate, CPU-specific download. After manual package
installation, open **Services → JustClash → Status** and choose **Update core**,
or run `justclash.sh resources core update` over SSH.

## 2. Set Up Traffic and DNS

Open **Services → JustClash**. Use the **Setup: Service**, **Setup: DNS**, and
**Setup: Routing** pages to edit saved settings; **Status** controls the service.

Under **Setup: Service → Traffic rules**, set:

| Setting | Value for this first test |
| --- | --- |
| Routing mode | Partial Interception |
| Create nftables | Enabled |
| Client traffic interfaces | The bridge used by your test device, usually `br-lan` |
| Change DNS settings at startup | Enabled |

With this setup, selected traffic enters Mihomo and the rest keeps using normal
routing. The nftables switch covers both selected clients and router traffic.
If you want the default rule to handle all selected connections, read
[Choosing a Routing Mode](concepts/routing.md) before choosing
Full Interception.

Open **Setup: DNS** and keep the shipped nameservers, Fake-IP ranges, and
real-IP exceptions for now. You do not need to build a new resolver list for
the first test. Make sure the test device uses the router for DNS; temporarily
turn off browser secure DNS or system private DNS while checking this path.

Choose **Save** on each page. Apply everything together after adding the outbound
and rule below.

## 3. Add an Outbound

For a single connection or a direct WAN/VPN path, open
**Setup: Routing → Proxies** and add an entry:

1. Enable it and name it `First_Outbound`.
2. Choose the source using the table below.
3. Leave **Connect through** empty. Set **Bind to interface** if this connection
   must use a particular outgoing device; otherwise leave it empty.
4. Save the row.

| Connection source | Mode | What to enter |
| --- | --- | --- |
| Remote server | `uri` | Paste its connection link into **Link** |
| Direct through a WAN or existing system VPN | `uri` | Set **Link** to exactly `direct://` and select the outgoing device in **Bind to interface** |
| Mihomo JSON definition | `object` | Paste it into **JSON object**; put `interface-name` inside the object if binding is needed |

**Bind to interface** selects a network device, not an OpenWrt logical network
or firewall zone. A system VPN must already be working; `direct://` does not
create it. The binding also works with remote-server URI entries. For multiple
paths and automatic switching, see [Multi-WAN and Failover](guides/multiwan.md).

### Use a Subscription Instead

If you have a Mihomo-compatible subscription, create an enabled entry named
`First_Provider` under **Setup: Routing → Proxy providers**, paste its link into
**Subscription URL**, and leave **Get subscription with** set to `DIRECT` for the first download when the
subscription is directly reachable. Keep the other presets and save the row.
You do not need to create `First_Outbound` or copy each imported node manually.
Use this provider in the group below.

## 4. Choose What Goes Through It

Under **Proxy groups**, add an enabled group named `First_Group`:

1. Set **Group type** to `select`.
2. For a single outbound, add `First_Outbound` under **Proxies** and enter its
   name as **Default selected** on the **Health check** tab. For a subscription,
   add `First_Provider` under **Providers**, leave **Default selected** empty,
   and choose an imported node under **Nodes** after startup.
3. Keep the other presets for now. A `select` group lets you choose its member
   manually; it does not provide automatic failover.
4. On the group's **Manual rules** tab, add one website under **Domain suffix**.
   Enter just its domain, without a scheme or path; subdomains match too.
5. Save the row.

Keep **Default rule → Send traffic to** set to `DIRECT`. The website rule
belongs on `First_Group`; do not add a duplicate on `First_Outbound`.

For a ready-made category instead of one website, use the group's
**Lists → Use with rules** field. This selects existing rulesets; adding your
own source is covered in [User-Defined Rulesets](guides/rulesets.md).

With a manually configured outbound, you can also skip the group and add the
**Domain suffix** or ruleset directly on `First_Outbound` instead.

## 5. Apply and Start

Save the edited rows, then choose **Save & Apply** to commit the configuration
and reload the service. See [Configuration lifecycle](concepts/configuration-lifecycle.md)
for the difference between editing, saving, and applying changes.

Choose **Save & Apply**, then open **Status**. If the service is stopped,
choose **Start**. Confirm that both JustClash and Mihomo are running before
opening live pages.

If startup fails, open **Service logs** first. Those logs and the saved Setup
pages work while Mihomo is stopped. **Nodes**, **Rules**, **Connections**, and
**Realtime logs** need the running core and a reachable controller API.

## 6. Check the Result

If you used a group, open **Nodes** and confirm that `First_Group` contains
`First_Outbound` or the subscription's imported nodes. Select the intended member.
Make a new connection to the website or category you added and look for it under
**Connections**. Its chain should include the group and selected outbound.
If you configured the rule directly on the outbound, expect that outbound
without an intermediate group.

If the client cached an earlier DNS answer, clear its DNS cache and retry.
Restarting the browser or closing the old connection may also be needed to
avoid testing a connection established before the change.

| What you see | What to check next |
| --- | --- |
| Service will not start | Read the first error in Service logs; check that the core is installed and the reported setting is valid |
| Expected group or outbound is missing | Check that the entries you created are enabled and the routing page was applied |
| Website stays direct or is absent from Connections | Check the domain suffix, client interface, and whether the client actually uses router DNS |
| Nodes or Connections reports an API error | Check Status first, then controller access, API credentials, and TLS |

For command-line diagnostics, run `justclash.sh check`. See
[Startup Troubleshooting](troubleshooting/startup.md) or
[LuCI Page Availability](troubleshooting/luci.md) if the result is still unclear.

## Continue Configuring

Use the [documentation index](README.md) to find routing, DNS, network scenarios,
maintenance, and reference material. For more connections or a subscription, go
to [Configure routing](guides/routing.md).
