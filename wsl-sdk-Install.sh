#!/bin/bash

# --- Configuration ---
OPENWRT_VERSION="24.10.1"
TARGET="x86"
SUBTARGET="64"
ARCH="x86_64"
GCC_VER="13.3.0"
SDK_FILENAME="openwrt-sdk-${OPENWRT_VERSION}-${TARGET}-${SUBTARGET}_gcc-${GCC_VER}_musl.Linux-${ARCH}.tar.zst"
SDK_URL="https://downloads.openwrt.org/releases/${OPENWRT_VERSION}/targets/${TARGET}/${SUBTARGET}/${SDK_FILENAME}"
SDK_DIR="$HOME/openwrt-sdk"
FORCE_DOWNLOAD=false

# --- Error handler ---
error_exit() {
  echo "❌ Error: $1" >&2
  exit 1
}

# --- Update system and install dependencies ---
echo "📦 Updating package list..."
sudo apt update || error_exit "Failed to run apt update"

echo "⬆️ Upgrading installed packages..."
sudo apt upgrade -y || error_exit "Failed to run apt upgrade"

echo "🔧 Installing required dependencies..."
sudo apt install build-essential clang flex bison g++ gawk \
    gcc-multilib g++-multilib gettext git libncurses5-dev libssl-dev \
    python3-setuptools rsync swig unzip zlib1g-dev file wget zstd || error_exit "Failed to install dependencies"

# --- Prepare SDK directory ---
mkdir -p "$SDK_DIR" || error_exit "Failed to create SDK directory"
cd "$SDK_DIR" || error_exit "Failed to enter SDK directory"

# --- Download SDK ---
if [ "$FORCE_DOWNLOAD" = true ] || [ ! -f "$SDK_FILENAME" ]; then
  echo "🔽 Downloading SDK: $SDK_FILENAME"
  wget "$SDK_URL" || error_exit "Failed to download SDK"
else
  echo "✅ SDK already downloaded: $SDK_FILENAME"
fi

# --- Extract SDK ---
if ls -d openwrt-sdk-"${OPENWRT_VERSION}"* 1>/dev/null 2>&1; then
  echo "✅ SDK already extracted"
else
  echo "📦 Extracting SDK..."
  tar -xf "$SDK_FILENAME" || error_exit "Failed to extract SDK"
fi

# --- Enter SDK directory ---
SDK_FOLDER=$(find . -maxdepth 1 -type d -name "openwrt-sdk-${OPENWRT_VERSION}-*")
cd "$SDK_FOLDER" || error_exit "Failed to enter SDK directory"

# --- Update and install feeds ---
echo "🔄 Updating and installing feeds..."
./scripts/feeds update -a && ./scripts/feeds install -a || error_exit "Failed to update feeds"

echo "🎉 OpenWrt SDK ${OPENWRT_VERSION} installation complete!"