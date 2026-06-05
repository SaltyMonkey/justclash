# JustClash

[![License: GPL-2.0](https://img.shields.io/badge/License-GPL--2.0-blue.svg)](https://opensource.org/licenses/GPL-2.0)
[![OpenWrt Compatibility](https://img.shields.io/badge/OpenWrt-24.x%20%7C%2025.x-emerald)](https://openwrt.org)

> [!CAUTION]
> **DISCLAIMER / ОТКАЗ ОТ ОТВЕТСТВЕННОСТИ**
>
> ### English Version
>
> **1. Educational & Scientific Purpose:**
> This project is a non-commercial educational demonstration created for scientific and technical research in embedded systems, Linux network stack configurations (`nftables`/`tproxy`), and OpenWrt UCI/LuCI integration. It is provided "AS IS" without any warranties of any kind.
>
> **2. Compliance with Local Laws:**
> *   **No Censorship Circumvention:** This software does not contain, distribute, host, or pre-configure any tools, keys, servers, subscription links, or methods intended to bypass state-mandated internet filters, government registry blocks (such as Roskomnadzor registry in the RF), or Internet Service Provider (ISP) restrictions.
> *   **Nature of Included Rulesets:** The included default rulesets are public domain/IP classification databases provided solely as metadata definitions for traffic categorization.
>     *   These lists **do not** contain any circumvention tools, access keys, or communication channels.
>     *   By default, without user-provided external routing destination configurations, all traffic matching these lists routes through the default WAN gateway directly and remains subject to all local ISP blocks.
> *   **No Access to Circumvention Tools Provided:** The repository does **not** provide any commercial or free access to circumvention tools or external routing servers. It is up to the user to configure the routing targets.
> *   **Compliance with Encryption Laws:** The software is a general-purpose network package manager and does not implement custom encryption standards. The user is solely responsible for ensuring that their network setups comply with local import, export, and cryptography regulations.
>
> **3. Limitation of Liability:**
> The authors accept no responsibility or liability for any consequences, legal claims, network downtime, data loss, or hardware damage arising from the use or misuse of this software.
>
> **4. Trademark and Commercial Use:**
> The JustClash name and logo cannot be used to sell hardware, paid access to external networks, or commercial configurations. We are not affiliated with any commercial network providers or sellers. See our [Trademark Policy](TRADEMARK.md) for details.
>
> ---
>
> ### Русская версия
>
> **1. Исключительно образовательные и научные цели:**
> Данный проект является некоммерческой демонстрацией и предназначен исключительно для технического изучения сетевого стека Linux (`nftables`, `tproxy`), автоматизации системных служб и интеграции интерфейсов управления в среде OpenWrt. Код предоставляется по принципу «как есть» (AS IS).
>
> **2. Соответствие законодательству РФ (ФЗ № 149-ФЗ и др.):**
> *   **Отсутствие средств обхода блокировок:** Данное программное обеспечение **не содержит, не распространяет и не настраивает по умолчанию** какие-либо средства обхода ограничений доступа, ключи, подписки или методы, предназначенные для получения доступа к заблокированным информационным ресурсам.
> *   **Статус встроенных списков (Rulesets):** Встроенные по умолчанию списки правил маршрутизации представляют собой исключительно публичные классификаторы доменных имён и IP-диапазонов (метаданные), служащие для демонстрации работы с бинарным форматом MRS.
>     *   Данные списки **не являются средствами обхода ограничений доступа** и не содержат серверов, ключей доступа или туннелей.
>     *   По умолчанию (без добавления пользователем собственных внешних серверов маршрутизации) весь трафик к этим ресурсам направляется напрямую через сеть провайдера и подвергается стандартной фильтрации со стороны оператора связи.
> *   **Инструмент маршрутизации, а не сервис:** Утилита является исключительно локальным инструментом для управления маршрутизацией трафика и не предоставляет никаких услуг по предоставлению средств обхода ограничений доступа, сторонних серверов или каналов связи. Все конфигурации заполняются конечным пользователем самостоятельно.
> *   **Соблюдение правил использования шифрования:** Проект не содержит специализированных средств шифрования, кроме встроенных в ядро используемых сторонних бинарных файлов. Пользователь самостоятельно несет ответственность за соблюдение законодательства РФ в области использования шифровальных (криптографических) средств и защиты информации.
>
> **3. Ограничение ответственности:**
> Разработчики проекта не несут ответственности за любые прямые или косвенные последствия использования данного ПО, включая сбои в работе сети провайдера связи, порчу оборудования (роутера), а также за возможные нарушения пользователем законодательства своей страны при настройке маршрутизации.
>
> **4. Товарный знак и коммерческое использование:**
> Имя и логотип JustClash запрещено использовать для продажи роутеров, платного доступа к внешним узлам маршрутизации или коммерческих настроек. Мы не имеем отношения ни к каким коммерческим сетям или продавцам оборудования. Подробнее читайте в [Политике товарного знака](TRADEMARK_RU.md).

---

## Overview

**JustClash** is an orchestration package and Web UI designed for OpenWrt routers. It acts as a configuration and lifecycle management control layer for the **mihomo** core.

Instead of requiring users to manually write complex JSON or YAML files, JustClash bridges OpenWrt's native configuration system with Mihomo's runtime environment—handling service supervision, config compilation, and firewall hookups automatically.

### Design Philosophy: A Complete External Dashboard Replacement
Most OpenWrt routing clients act as simple launchers, forcing users to access external, third-party dashboards hosted on separate ports (like YACD or Metacubexd) to switch routing groups, check latency, or view logs.

JustClash is designed to **fully replace the need for external panels** by implementing a feature-complete dashboard directly inside OpenWrt's native administration interface. Users can switch active nodes, monitor active connections, close sockets in real time, and stream live logs directly within the system panel.

*Note: For users who still prefer dedicated dashboards, JustClash retains a background downloader to fetch, host, and serve external panels locally from the router.*

---

## Interfaces & Operation Modes

JustClash is designed to run in two operational modes, allowing full configuration and management either via a headless command-line interface (CLI) or through an integrated web administration interface:

### 1. CLI & System Daemon (Headless Mode)
JustClash functions as a robust headless system service. The underlying CLI engine `/usr/bin/justclash.sh` provides automated core management, cron schedulers, and detailed system diagnostics. Users can perform all operations, monitor service state, update core binaries, and configure rules directly via SSH.

### 2. LuCI Web Interface (Web UI Mode)
For interactive administration, JustClash exposes a feature-complete, responsive dashboard and settings suite directly inside the native OpenWrt LuCI panel (accessible via **Services → JustClash**). The interface is organized across 10 dedicated sections:

### Diagnostics & Status Views

*   **Status (Dashboard & Service Control):** A comprehensive diagnostics dashboard displaying service state, system telemetry, and controls:
    *   *Service Actions:* Start, stop, or restart the proxy service, and toggle system boot autostart directly from the UI.
    *   *Interactive Log & Config Viewers:* View running configurations (Mihomo YAML, OpenWrt UCI configuration, active firewall `nftables` tables) in popup modal windows, with a one-click reset to defaults.
    *   *Real-time Bandwidth & Volume Tracker:* Displays instantaneous upload/download network speeds and cumulative transferred data totals since service startup using WebSocket pollers.
    *   *System Telemetry Cards:* Monitor process memory/CPU usage, process ID (PID), service uptime, OS and OpenWrt versions, CPU architecture, hostname, hardware model, system time, NTP sync status, and storage space usage.
    *   *Diagnostics & Maintenance:* Run interactive network diagnostics (ping, traceroute, DNS resolve, firewall scans) and update the core binaries, rulesets, or dashboard assets directly via built-in APIs.
*   **Nodes (Proxy Group & Latency Manager):** A real-time controller to manage outbound paths and subscriptions:
    *   *Routing Mode Selector:* Toggle the global routing mode (Rule-based, Global proxy, or Direct routing) instantly.
    *   *Active Group Cards:* Displays all proxy groups (e.g. `GLOBAL`, `Proxy`, etc.) showing their type, current selected node, and available fallbacks.
    *   *Instant Switcher:* Click any proxy option card in the list to switch active outbound routes immediately.
    *   *Latency (Delay) Testing:* Run parallel HTTP latency delay tests (concurrency controlled to avoid network congestion) and display real-time response times (ms) or timeouts on color-coded metadata labels.
    *   *Proxy Providers Tracker:* View dynamic proxy subscription details, updated timestamps, manual pull updates, and provider-specific delay tests.
*   **Rules (Active Rules Inspector):** A live, interactive inspector showing active routing rules directly from the running core:
    *   *Real-time Filtering:* Instantly filter rules on the fly by type, payload, or target proxy/group name.
    *   *Visual Classification:* Color-coded badges distinguish rule types (e.g., Blue for domains/keywords, Green for IP/CIDR ranges, Orange for Classical rules).
    *   *Dynamic Runtime Toggles:* Temporarily enable or disable individual rules dynamically in runtime (resets upon service restart).
*   **Connections (Active Connections Manager):** A WebSocket-backed connection tracker allowing real-time monitoring and control of active network sockets:
    *   *Traffic Metadata Visualizer:* Displays protocol, connection endpoints, target domain name/sniffed SNI, routing chains (groups traversed), and matched rules.
    *   *Interactive Modal Inspector:* Click any connection row to inspect its raw JSON metadata structure and copy it to the clipboard.
    *   *Socket Control:* Instantly close/terminate individual connections or perform a global teardown of all active connections with a single click.
    *   *Advanced Filtering & Refresh Control:* Filter active connections by Host/Sniff, Source/Endpoint IP, Chains, or Rules, and customize the WebSocket refresh interval (from 250ms up to 5s).
*   **System logs:** Retrieves and parses OpenWrt system logs to debug service startup, firewall injection issues, and conflict warnings.
*   **Realtime logs:** Streams live, color-coded logging outputs (Debug, Info, Warning, Error) directly from the running Mihomo core using WebSocket connections to the API controller port.

### Setup Configurations

*   **Setup: Rulesets (Custom Rulesets Management):** Allows defining custom domain or IP-CIDR list sources:
    *   *Source Toggles:* Includes interactive checkboxes to hide/show built-in lists or make URL strings clickable links for checking lists in the browser.
    *   *Character Validation:* Real-time checking restricts names to valid alphanumeric characters, hyphens, and underscores.
    *   *Duplicate and Reserved Checks:* Automatically blocks inputting duplicate keys or using reserved built-in identifiers.
    *   *Mihomo-native Download & Cache:* The compiler maps configuration endpoints directly to Mihomo ruleset objects, enabling Mihomo to download, validate, and cache remote rulesets natively (using configurable intervals and size limits).
    *   *Custom Authorization Headers:* Supports defining custom HTTP `Authorization` headers for authenticating private/restricted remote ruleset downloads.
    *   *Local Rulesets Translation:* Translates local filesystem paths into native file-based rulesets for offline or local configurations.
*   **Setup: Routing (Outbound-Centric Rules & Groups):** Instead of global rules arrays, routing rules are declared directly **inside each node's setup panel**:
    *   *Predefined Lists Association:* Select which ruleset lists should be routed specifically through a particular outbound node.
    *   *Subnet & Suffix Rules:* Map target domain suffixes, target subnets, and local source subnets directly within the node parameters.
    *   *Outbound Providers:* Load dynamic external subscriptions with custom health checks, node filtering, and overrides (force specific routing chains or physical interface bindings for fetched nodes).
*   **Setup: Service (System-level Orchestration):**
    *   *Startup & Initialization:* Configure WAN connectivity checks (timeouts), delayed startup to prevent CPU bottlenecks, time synchronization (ntpd) prior to launching Mihomo, and options to skip startup checks.
    *   *Storage & Memory Optimization:* Flash wear protection options to store external rulesets and core metadata cache databases in temporary RAM storage (`/tmp`) or in persistent flash memory (`/etc/justclash/`).
    *   *Traffic Rules & Packet Filtering (nftables):* Define traffic interception rules, bind rules to client interfaces (e.g., `br-lan`), set policy routing priority (PBR), specify router traffic redirection, exclude specific destination ports or router socket owners (UIDs), and configure redirection/blocking actions for client QUIC, DoT, DoH, DoQ, and NTP traffic.
    *   *Scheduled Tasks (Cron Automation):* Register and manage cron entries on the host system to automatically restart Mihomo on a schedule.
    *   *External Resources:* Configure download sources for the core (GitHub or Custom URL with version.txt validation) and custom zip mirrors for Zashboard, Metacubexd, and YACD-meta dashboards.
*   **Setup: Proxy (Mihomo Core Runtime Settings):**
    *   *Basic Settings:* Configure core logging severity, bind outbound connections to a specific interface, set the TPROXY listen port, enable/configure mixed ports (HTTP/SOCKS5) with access authentication, set TCP concurrent connection options, adjust Keep-Alive parameters, and enable profile/fake-IP persistence.
    *   *Controller/API Settings:* Choose the API controller bind interface, toggle dashboard hosting, select default web dashboards, and set API passwords/tokens.
    *   *DNS Settings:* Set the DNS listen port, configure custom/system hosts policies, define nameserver policies (domain-specific DNS), list default nameservers, configure proxy-server nameservers (for resolving proxy hosts), and map rulesets to fake-IP or real-IP resolution lists.
    *   *Sniffer Settings:* Enable traffic sniffing, parse pure IP connections, specify domain lists to exclude/force-sniff, and define CIDR-based source or destination address bypass rules.
    *   *NTP Settings:* Enable the core's built-in NTP client, specify upstream NTP servers/ports, define check intervals, and toggle writing time corrections to the system clock.

## How It Works (Architecture)

All operations are automated and managed via an OpenWrt system service (`/etc/init.d/justclash`). The lifecycle is fully handled automatically during system boot, shutdowns, or when changes are applied in the LuCI interface:

1.  **Configuration:** Settings are managed interactively through the LuCI Web UI or directly edited in the UCI config file (`/etc/config/justclash`).
2.  **Compilation & Translation:** The `/etc/init.d/justclash` service script invokes the backend manager engine (`/usr/bin/justclash.sh`). This script reads the UCI settings, parses and decodes proxy subscription URIs, and compiles them into a single, unified YAML configuration file optimized for the Mihomo core.
3.  **Firewall & DNS Redirection:** The service automatically injects `nftables` rules to intercept client and router traffic (applying rules like PBR, QUIC/DoH blocking, etc.) and hooks the system's DNS forwarding (`dnsmasq`) to route name resolution queries to the core.
4.  **Execution & Supervision:** The service starts and monitors the `mihomo` daemon process.
5.  **Teardown & Cleanup:** On service stops or restarts, the `init.d` script automatically tears down all injected `nftables` tables, reverts DNS configurations, and terminates the core process cleanly.

---

## Requirements

### Dependencies
*   **Core packages:** `nftables`, `jq`, `curl`, `coreutils-base64`
*   **Kernel modules:** `kmod-nft-tproxy`, `kmod-nf-tproxy`
*   **Web UI:** `luci-base`

### System
*   **OpenWrt:** Version 24.10 or newer (uses modern `nftables` syntax).
*   **Hardware Compatibility:** Works on a wide variety of architectures supported by both OpenWrt and Mihomo:
    *   **x86_64 / 386:** The setup defaults to the standard **`amd64`** (v1) Mihomo build. This ensures out-of-the-box compatibility and avoids `Illegal instruction` crashes caused by `amd64-v3` builds on hypervisors (Proxmox, VMware, Hyper-V, KVM, etc. with default CPU emulation) or older CPUs without AVX2/FMA3 support. On modern systems (e.g., modern bare-metal x86_64 routers, or virtual machines where the CPU type is configured as `host`), it is still recommended to manually download and replace the core binary with the **`amd64-v3`** (or **`amd64-v4`** if the CPU supports AVX-512) build to benefit from instruction set optimizations.
    *   **ARM:** Support for `arm64` (aarch64), `armv7` (neon-vfp), `armv6` (neon/vfp), and `armv5`.
    *   **MIPS:** Support for both big-endian and little-endian configurations, including hardfloat/softfloat variants (`mips-hardfloat`, `mips-softfloat`, `mipsle-hardfloat`, `mipsle-softfloat`, `mips64`, `mips64le`).
    *   **RISC-V:** Support for `riscv64` platforms.
    *   **LoongArch:** Support for `loong64-abi2` platforms.

---

## Installation

### Option 1: Quick Online Installer (Recommended)
Run the following script to automatically download dependencies and install the latest version:
```bash
sh <(wget -O - https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh)
```

The setup script supports additional flags for custom or automated deployment:
*   `--automated`, `--auto`, `-y`: Non-interactive automated mode. Automatically removes conflicting packages, skips translation downloads (installs only the base English package), and exits upon completion without opening the menu.
*   `--silent`, `-s`: Suppresses all regular standard output (`stdout`). Error messages and system validation warnings will still be printed to `stderr`.
*   `--update-core`, `-u`: Core-only update mode. Runs basic system diagnostics and updates only the Mihomo core binary, bypassing packages download and installation.
*   `--skip-space-check`: Bypasses the minimum free storage space check.

Example of silent non-interactive installation:
```bash
sh <(wget -O - https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh) --automated --silent
```

Example of automated core-only update:
```bash
sh <(wget -O - https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh) --update-core
```

### Option 2: Prebuilt Packages
1. Download `justclash`, `luci-app-justclash`, and optionally translations from the Releases page.
2. Copy files to your router via SCP.
3. Install:
   * **APK-based systems (OpenWrt 25):**
     ```bash
     apk add --allow-untrusted justclash-*.apk luci-app-justclash-*.apk
     ```
   * **OPKG-based systems (OpenWrt 24):**
     ```bash
     opkg install justclash-*.ipk luci-app-justclash-*.ipk
     ```

### Option 3: Compile from Source
Build native packages using Docker SDK containers:
* **For IPK (OpenWrt 24):**
  ```bash
  docker compose -f Docker-compose.yml up --build ipk-builder
  ```
* **For APK (OpenWrt 25):**
  ```bash
  docker compose -f Docker-compose.yml up --build apk-builder
  ```
The output files will be copied to `./output/ipk/` or `./output/apk/`.

---

## Usage

*   **Access Web Interface:** Navigate to **Services → JustClash** in your OpenWrt admin panel.
*   **Service Control:**
    ```bash
    /etc/init.d/justclash start   # Start service
    /etc/init.d/justclash stop    # Stop service
    /etc/init.d/justclash restart # Apply new config changes
    ```
*   **CLI Helpers & Diagnostics:**
    ```bash
    justclash.sh help
    ```

---

## License

Licensed under the **GPL-2.0 License**. See [LICENSE](LICENSE) for details.