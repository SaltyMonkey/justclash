# JustClash Quick Start

[Documentation](README.md)

Let's start with one website. You'll add a connection, tell JustClash to use it
for that website, and check that it works. The rest of your traffic will keep
using the normal internet route. You can add more sites once this first setup
works.

Have these ready:

- an OpenWrt router with working internet and SSH access;
- a connection link or a Mihomo-compatible subscription;
- at least 33 MiB free in `/overlay`, plus free RAM for the core download in `/tmp`.

Already using JustClash? Follow [Update and Backup](guides/maintenance.md) to
keep your settings. For a first installation, review
[Security and access](guides/security.md) before running the installer.

## 1. Install JustClash

### Online Installer

Connect to your router over SSH, then download and run the installer:

```sh
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh
```

Choose **Install JustClash package** and follow the prompts. The installer
detects your package manager, installs JustClash and its LuCI pages, and downloads
the stable slim Mihomo core for your router. When it finishes, refresh LuCI and
open **Services → JustClash**.

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

First, tell JustClash where to find the device you'll test from. Open
**Setup: Service → Traffic rules** and use these settings:

| Setting | Value for this first test |
| --- | --- |
| Routing mode | Partial Interception |
| Create nftables | Enabled |
| Client traffic interfaces | The bridge used by your test device, usually `br-lan` |
| Change DNS settings at startup | Enabled |

**Partial Interception** is enough for this first website rule. **Create nftables**
sets up traffic interception for the selected client interfaces and the router.
You can choose a different [routing mode](concepts/routing.md) later.

Under **Setup: DNS**, keep the supplied defaults for now. Your test device needs
to use the router for DNS so JustClash can recognize the website you choose.
Temporarily turn off browser secure DNS or system private DNS while testing.

Choose **Save** before leaving a page. We'll apply the settings together after
adding your connection and website rule.

## 3. Add an Outbound

An **outbound** is the connection JustClash sends your chosen traffic through.
You'll find these connections under **Setup: Routing → Proxies**.

If you have a single connection link, add a row:

1. Enable it and give it a name, such as `First_Outbound`.
2. Set **Mode** to `uri` and paste your connection link into **Link**.
3. Leave **Connect through** and **Bind to interface** empty for this setup.
4. Save the row, then save the page.

If you have a Mihomo JSON definition, choose `object` and paste it into
**JSON object**. To use an existing WAN or system VPN directly, enter `direct://`
as the link and choose its outgoing network device under **Bind to interface**.
The VPN must already work in OpenWrt. See [interface binding](guides/routing.md#bind-to-an-interface)
or [Multi-WAN](guides/multiwan.md) for those setups.

### Use a Subscription Instead

If your provider gave you a subscription, use this path for step 3:

1. Under **Setup: Routing → Proxy providers**, add an enabled row named
   `First_Provider`.
2. Paste the subscription link into **Subscription URL**.
3. Keep **Get subscription with** set to `DIRECT` if you can download the
   subscription without a proxy. Keep the other presets.
4. Save the row and page.

The provider will supply its nodes to the group you'll create next. You can
skip creating `First_Outbound`; there's no need to copy the subscription's nodes
one by one.

## 4. Choose What Goes Through It

A **group** gives your website rule a stable destination: you can change the
connection later while keeping the rule. Under **Proxy groups**, add an enabled
row named `First_Group` and set **Group type** to `select`.

Add the connection you just saved:

- **Single connection:** add `First_Outbound` under **Proxies**. On the
  **Health check** tab, also enter that name under **Default selected**.
- **Subscription:** add `First_Provider` under **Providers**. Leave
  **Default selected** empty; you'll choose a node after starting the service.

Keep the other presets. This group lets you choose a connection manually.

Now open the group's **Manual rules** tab and add a website under **Domain suffix**.
Enter only the domain, without a scheme or path. Its subdomains will match too.
Save the row and leave **Default rule → Send traffic to** set to `DIRECT` so
other traffic keeps its normal route.

For a ready-made category, choose a list under the group's
**Rulesets → Use with rules**. You can add your own lists later using
[Custom rulesets](guides/rulesets.md).

Groups are optional for a single outbound. If you prefer, put the website rule
directly on `First_Outbound` and skip creating the group. Keep each rule in one
place so its route is easy to follow.

## 5. Apply and Start

Choose **Save & Apply**, then open **Status**. If the service is stopped, choose
**Start**. Wait until both JustClash and Mihomo show as running.

If they don't start, open **Service logs** and read the first error. You can use
these logs and edit Setup pages while the core is stopped. The live pages,
including **Nodes** and **Connections**, need a running core and working controller
access.

## 6. Check the Result

If you created a group, open **Nodes** and find `First_Group`. It should contain
your outbound or the nodes from your subscription. Choose the connection you
want to use.

On your test device, open the website you added. Then look for its new connection
under **Connections**: the chain should show `First_Group` and your selected
outbound. If you put the rule directly on an outbound, you'll see that outbound
without a group.

If the result hasn't changed, close the website's existing connections and clear
the device's DNS cache before trying again. Restarting the browser may also help;
an already open connection keeps the route it started with.

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
