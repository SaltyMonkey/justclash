# JustClash

> [!WARNING]
> This repository serves as an educational demonstration on handling external binary files, along with fundamental Linux scripting techniques, network configuration setups, and routing integration within OpenWrt and FriendlyWrt environments. It provides practical examples to illustrate these concepts for learning and experimentation purposes. Please note that it is not designed or suitable for production use, as it may contain unoptimized code, potential security vulnerabilities, or incomplete features that could lead to instability in real-world applications. This project is created for scientific and technical purposes, aiming to advance knowledge in embedded systems and networking without any commercial intent. The author bears no responsibility for how the project is used, including any potential misuse, damages, or consequences arising from its application. Use it responsibly in controlled, non-critical settings only.

## Overview

**JustClash** is a simple service package for OpenWrt that manages the Mihomo/Clash core in tproxy mode. The project showcases how to wrap, configure, and control external proxy binaries, automate Linux service management, and interact with network and routing components in a router environment.

## Features

- Launches and supervises the Mihomo/Clash core as a system service.
- Integration of external binaries with Linux shell scripting.
- Simplified network and routing configuration (tproxy, Mixed port, firewall, policy routing).
- Integrates with OpenWrt service management.
- All configuration is handled via UCI (`/etc/config/justclash`).
- LuCI web interface for controlling and monitoring the service.
- Diagnostic tools for DNS, ICMP, and routing.
- Safe config reset, backup, and restore functionality.

## Project Structure

- `justclash/` — Main service scripts, init.d, config templates, helpers.
- `luci-app-justclash/` — LuCI web interface for controlling and monitoring the service.
- `Makefile` — OpenWrt-compatible package build scripts.
- Files for build systems, Docker, syntax checkers, git and related automation.

## Requirements

### justclash (from justclash/Makefile)
- `nftables`
- `coreutils-base64`
- `jq`
- `curl`
- `kmod-nft-tproxy`
- `kmod-nf-tproxy`

### luci-app-justclash (from luci-app-justclash/Makefile)
- `luci-base`
- `justclash`

- **Firmware:**
  - Requires OpenWrt 24+
  - FriendlyWrt 20240115+ (untested).
  - LuCI and the above dependencies should be available.

## Installation

### 1. One-Line Install Script

You can install JustClash with a single command using the provided install script:

```
sh <(wget -O - https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh)
```

This method will allow automatically download, execute the installation script and install justclash with minimal manual input, handling the setup for you.

### 2. Download Prebuilt Packages from Releases

Prebuilt packages are available in the [Releases](https://github.com/SaltyMonkey/justclash/releases) section of the repository. To install:

1. Download the latest `justclash` and `luci-app-justclash` packages for your architecture from the Releases page.
2. Transfer the packages to your router.
3. **Install them using:**

   - **For OpenWrt (ipk packages):**
     ```
     opkg install justclash_*.ipk luci-app-justclash_*.ipk luci-i18n-justclash-ru-*.ipk
     ```

   - **For OpenWrt (apk packages):**
    ```
    apk add --allow-untrusted justclash-*.apk luci-app-justclash-*.apk luci-i18n-justclash-ru-*.apk
    ```

### 3. Build from Source (using Docker)

You can build the JustClash packages using the provided Dockerfiles (with OpenWRT SDK):

- **For OpenWrt (ipk packages):**

    ```
    docker build -t justclash-builder-ipk -f Dockerfile-ipk .
    ```

- **For OpenWrt (apk packages):**

    ```
    docker build -t justclash-builder-apk -f Dockerfile-apk .
    ```

After the build, extract the resulting packages from the container and install as explained above.

### 4. Build from Source (using Docker Compose)

You can build the JustClash packages using the provided Docker compose file (with OpenWRT SDK), output volume mount: /output:

- **For OpenWrt (ipk packages):**

```
docker compose -f 'Docker-compose.yml' up -d --build 'ipk-builder'
```

- **For OpenWrt (apk packages):**

```
docker compose -f 'Docker-compose.yml' up -d --build 'apk-builder'

```
## Usage

1. Configure via LuCI: **Services → JustClash**.
2. Or edit `/etc/config/justclash` directly (YAML editing is not supported).
3. Start/stop/restart the service manually:

    ```
    /etc/init.d/justclash start
    /etc/init.d/justclash stop
    /etc/init.d/justclash restart
    ```

    or

    ```
    service justclash stop
    service justclash start
    service justclash restart
    ```
4. Use diagnostic commands for DNS, ICMP, and routing tests and etc. Check command below for more information.

    ```
    /usr/bin/justclash help
    ```

## Limitations

- **TUN mode is not supported.** Only tproxy mode is available.
- This is a demonstration of service integration, not a full-featured proxy solution.
- Use at your own risk; no production support.

## License

GPL-2.0

---

**Issues and feature requests are accepted via GitHub Issues.**