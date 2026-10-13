<h1 align="center">JustClash</h1>

<p align="center">
  <a href="https://opensource.org/licenses/GPL-2.0"><img src="https://img.shields.io/badge/License-GPL--2.0-blue.svg" alt="License: GPL-2.0"/></a>
  <a href="https://openwrt.org"><img src="https://img.shields.io/badge/OpenWrt-24.x%20%7C%2025.x-emerald" alt="OpenWrt Compatibility"/></a>
  <br/>
  <a href="https://github.com/saltymonkey/justclash/releases/latest"><img src="https://img.shields.io/github/v/release/saltymonkey/justclash?filter=%21%2A_rc%2A&amp;sort=date&amp;display_name=tag&amp;label=JustClash%20release" alt="Latest JustClash release"/></a>
  <a href="https://github.com/saltymonkey/justclash/releases"><img src="https://img.shields.io/github/v/release/saltymonkey/justclash?include_prereleases&amp;filter=%2A_rc%2A&amp;sort=date&amp;display_name=tag&amp;label=JustClash%20RC&amp;color=orange" alt="Latest JustClash RC release"/></a>
  <a href="https://github.com/MetaCubeX/mihomo/releases/latest"><img src="https://img.shields.io/github/v/release/MetaCubeX/mihomo?sort=date&amp;display_name=tag&amp;label=Mihomo%20latest&amp;color=blueviolet" alt="Latest Mihomo release"/></a>
</p>

<p align="center">
  <img src=".github/assets/logo.png" alt="JustClash logo" width="260"/>
</p>

<p align="center">
  Native OpenWrt traffic orchestration service and LuCI interface for managing Mihomo routing, outbounds, and lifecycle—without requiring a third-party dashboard.
</p>

<p align="center">
  <a href="info/README.md">Documentation</a> ·
  <a href="info/getting-started.md">Quick start</a> ·
  <a href="info/concepts/routing.md">Routing architecture</a> ·
  <a href="info/guides/security.md">Security concerns</a> ·
  <a href="info/guides/maintenance.md">Update / backup / remove</a> ·
  <a href="info/reference/uci.md">UCI reference</a> ·
  <a href="DISCLAIMER.md">Disclaimer</a>
</p>

> [!IMPORTANT]
> JustClash manages local routing and runtime configuration. It does not provide remote servers, subscriptions, access credentials, or preconfigured external routing destinations.

> [!CAUTION]
> **Disclaimer / Отказ от ответственности**
>
> This non-commercial educational and technical research project is provided “AS IS”. Read the full bilingual [Disclaimer / Отказ от ответственности](DISCLAIMER.md), including compliance, liability, and trademark terms, before use.

> [!WARNING]
> Before installing or using JustClash, read [Security and access](info/guides/security.md). It covers administrator access, controller and Mixed Port protection, credential handling, download privacy, and external resource risks.
>
> Installation and operation download external software and data, including the Mihomo core, dashboards, rulesets, geodata, and configured subscriptions. HTTPS and core archive checks reduce transport and integrity risks, but do not guarantee safe third-party content.

## About

JustClash connects OpenWrt's native UCI configuration system with the Mihomo runtime. It compiles router settings into a working core configuration, manages the service lifecycle, and installs the required firewall and DNS hooks.

The LuCI application provides service controls, node selection, active connections, rules, traffic statistics, and realtime logs. The service can also be managed entirely through UCI, init scripts, and the command line.

Saved settings and service controls work while Mihomo is stopped; live data
requires a reachable core API. See [LuCI Page Availability](info/troubleshooting/luci.md).

## Highlights

| Capability | Description |
| --- | --- |
| Native OpenWrt integration | UCI configuration, procd supervision, fw4/nftables hooks, and LuCI CSR views |
| Full and partial routing | Choose complete traffic interception or selective lower-overhead routing |
| Runtime control | Switch nodes, inspect rules and connections, terminate sockets, and view live logs |
| Mihomo-native providers | Proxy providers and rule providers are downloaded and updated by the core |
| APK and IPK packages | OpenWrt 25.x is the primary APK target; OpenWrt 24.x remains supported through IPK |
| Headless management | LuCI is optional for users who prefer UCI and CLI administration |

## Getting Started

1. Follow the [Quick Start](info/getting-started.md) to install the packages and create the first outbound.
2. Read [Choosing a Routing Mode](info/concepts/routing.md) before selecting full or partial routing.
3. Use the [UCI structure reference](info/reference/uci.md) for manual configuration.

The online installer detects the router package manager automatically. Interactive installation asks only which translation package should be installed; automated installation uses the English LuCI package without an additional translation.

New installations use the slim kernel version of Mihomo by default. The core repository remains editable in LuCI.

## Documentation

The [documentation index](info/README.md) groups setup guides, network scenarios,
troubleshooting, and references by task. Start with
[Getting started](info/getting-started.md); for an existing installation, go to
[Maintenance](info/guides/maintenance.md).

## Architecture

```mermaid
flowchart LR
    Settings[UCI and LuCI settings] --> Compiler[JustClash compiler]
    Compiler --> Runtime[Mihomo configuration]
    Compiler --> Network[nftables and DNS hooks]
    Runtime --> Core[Mihomo core]
    Core --> Control[LuCI and CLI control]
    Core --> Providers[Proxy and rule providers]
```

The service owns the complete lifecycle: validation, configuration compilation, firewall setup, core supervision, and cleanup. More detail is available in [Routing Architecture](info/concepts/routing.md).

## Screenshots

<p align="center">
  <img src="imgs/status.png" alt="JustClash status dashboard" width="900"/>
</p>

<details>
<summary>Interface gallery</summary>

| Nodes | Routing |
| --- | --- |
| ![Node selection](imgs/nodes.png) | ![Routing configuration](imgs/routing.png) |

| Connections | Rulesets |
| --- | --- |
| ![Active connections](imgs/connections.png) | ![Ruleset configuration](imgs/rulesets.png) |

| Service logs | Realtime logs |
| --- | --- |
| ![Service logs](imgs/service_logs.png) | ![Realtime logs](imgs/realtime_logs.png) |

</details>

## Compatibility

Supports OpenWrt 24.x (OPKG/IPK) and 25.x (APK). See the [Quick Start](info/getting-started.md) for installation instructions.

## License

Licensed under the [GPL-2.0 License](LICENSE).
