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

---

## Overview

**JustClash** is an orchestration package and Web UI designed for OpenWrt routers. It acts as a configuration and lifecycle management control layer for the **mihomo** core.

Instead of requiring users to manually write complex JSON or YAML files, JustClash bridges OpenWrt's native configuration system with Mihomo's runtime environment—handling service supervision, config compilation, and firewall hookups automatically.

### Design Philosophy: A Complete External Dashboard Replacement
Most OpenWrt proxy clients act as simple launchers, forcing users to access external, third-party dashboards hosted on separate ports (like YACD or Metacubexd) to switch proxy groups, check latency, or view logs.

JustClash is designed to **fully replace the need for external panels** by implementing a feature-complete dashboard directly inside OpenWrt's native administration interface. Users can switch active nodes, monitor active connections, close sockets in real time, and stream live logs directly within the system panel.

*Note: For users who still prefer dedicated dashboards, JustClash retains a background downloader to fetch, host, and serve external panels locally from the router.*

---

## JustClash Core Features

The system features are configured across five main administration sections inside the Web UI:

### 1. Startup & Initialization
*   **Awaiting WAN Connectivity:** Prevents core load-failures on boot by checking for default internet gateway availability with a user-configurable timeout.
*   **Delayed Startup:** Delays service initialization on startup to prevent CPU bottlenecks on low-spec routers.
*   **Time Synchronization Hook:** Forces clock synchronization prior to launching Mihomo, ensuring secure TLS downloads and API connections do not fail due to out-of-date system time.
*   **Environment Conflict Scanner:** Scans the active system for concurrent routing packages (such as `zapret`, `byedpi`, `youtubeUnblock`, or residual `podkop` entries) and prints warning alerts in the log to prevent routing loops.

### 2. Storage & Memory Optimization
*   **Flash Wear Protection:** Allows storing external rulesets and core metadata cache databases either in temporary RAM storage (`/tmp`) or in persistent flash memory (`/etc/justclash/`), minimizing writing cycles on routers using NAND/NOR flash.

### 3. Traffic Rules & Packet Filtering (nftables)
*   **Target Interface Binding:** Binds traffic interception rules to specific local network devices.
*   **Port & Subnet Exclusions:** Prevents specific local source IPs, target subnets, or application ports (e.g. Bittorrent) from being redirected through the proxy rules.
*   **Encrypted DNS Redirection profiles:** Specialized packet capturing rules to block or allow encrypted DNS tunnels like DoT, DoH, and DoQ at the firewall level.
*   **QUIC Redirection Control:** Configure firewall actions (block, bypass, or redirect) for UDP port 443 (QUIC/HTTP3) connections to prevent protocol leaks.
*   **NTP Query Capturing:** Intercepts system or client NTP requests to synchronize router time reliably.

### 4. Scheduled Tasks (Cron Automation)
*   **Cron-Backed Schedules:** Dynamically schedules automated service restarts and core checks by directly registering and managing cron entries on the host system.

### 5. External Resources & Dashboard Hosting
*   **Multiple Web UI Provisioning:** Automatically downloads, extracts, and hosts external dashboards (Zashboard, Metacubexd, and YACD-meta) directly on the router's local web server directory.
*   **Custom Mirror Support:** Configure custom download mirrors for both Mihomo binary releases and ruleset repositories.
*   **Hardware Fingerprint (HWID):** Appends a unique hash (derived from MAC addresses and board model) to provider requests to help count authorized devices.

### 6. Logging & Real-time Monitoring
*   **System Service Logs:** Retrieves and parses OpenWrt system logs to debug service startup, firewall injection issues, and conflict warnings.
*   **Real-time Core Logs:** Streams live, color-coded logging outputs (Debug, Info, Warning, Error) directly from the running Mihomo core using WebSocket connections to the API controller port.

---

## Ruleset & Routing Configuration

JustClash structures routing rules and connection providers under two dedicated administration layouts:

### 1. Custom Rulesets Management
Allows defining custom domain or IP-CIDR list sources:
*   **Source Toggles:** Includes interactive checkboxes to hide/show built-in lists or make URL strings clickable links for checking lists in the browser.
*   **Character Validation:** Real-time checking restricts names to valid alphanumeric characters, hyphens, and underscores.
*   **Duplicate and Reserved Checks:** Automatically blocks inputting duplicate keys or using reserved built-in identifiers.
*   **Backend MRS Translation:** The compiler hashes list configurations. It maps endpoints to remote rulesets (with interval updates downloaded via `curl`) and maps local paths to local file-based rulesets on the router.

### 2. Outbound-Centric Rules & Groups
Instead of global rules arrays, routing rules are declared directly **inside each proxy's setup panel**:
*   **Predefined Lists Association:** Select which ruleset lists should be routed specifically through a particular proxy.
*   **Subnet & Suffix Rules:** Map target domain suffixes, target subnets, and local source subnets directly within the proxy parameters.
*   **Proxy Providers:** Load dynamic external subscriptions with custom health checks, node filtering, and overrides (force specific proxy chains or physical interface bindings for fetched nodes).

---

## How It Works (Architecture)

1. **Configuration:** Settings are managed via the LuCI Web UI or by editing the configuration file on the router.
2. **Compilation:** The init script calls the backend manager script, which loads configurations, parses proxy link URIs, and outputs a unified config file for the core.
3. **Firewall & DNS Hooking:** The script applies temporary packet redirection rules and adjusts system DNS settings to intercept queries.
4. **Execution:** Mihomo runs using the compiled configuration, routing connections based on the user's setup.

---

## Requirements

### Dependencies
*   **Core packages:** `nftables`, `jq`, `curl`, `coreutils-base64`
*   **Kernel modules:** `kmod-nft-tproxy`, `kmod-nf-tproxy`
*   **Web UI:** `luci-base`

### System
*   **OpenWrt:** Version 24.10 or newer (uses modern `nftables` syntax).

---

## Installation

### Option 1: Quick Online Installer (Recommended)
Run the following script to automatically download dependencies and install the latest version:
```bash
sh <(wget -O - https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh)
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