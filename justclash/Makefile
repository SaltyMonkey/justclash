include $(TOPDIR)/rules.mk

PKG_NAME:=justclash
PKG_VERSION:=0.6.2
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

PKG_MAINTAINER:=SaltyMonkey <https://github.com/SaltyMonkey>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=net
	CATEGORY:=Network
	TITLE:=$(PKG_NAME)
	DEPENDS:=+nftables +coreutils-base64 +jq +curl +kmod-nft-tproxy +kmod-nf-tproxy
	CONFLICTS:=banip mihomo nextdns sing-box podkop https-dns-proxy luci-app-passwall luci-app-passwall2 dns-failsafe-proxy
	PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
	Transparent proxy solution for OpenWrt based on mihomo clash core.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/lib/justclash
	$(INSTALL_BIN) ./files/usr/lib/justclash/helpers.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/compat.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/logging.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/migration.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/uri.sh $(1)/usr/lib/justclash/

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/justclash $(1)/usr/bin/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/justclash $(1)/etc/config/

	$(INSTALL_DIR) $(1)/etc/justclash
	$(INSTALL_CONF) ./files/etc/justclash/default.config $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/rulesets.txt $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/block.rulesets.txt $(1)/etc/justclash/

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/justclash $(1)/etc/init.d/

	sed -i -e 's|__COMPILED_VERSION_VARIABLE__|$(PKG_VERSION)|g' $(1)/usr/bin/justclash

	sed -i -e 's|__CORE_RELEASE_CHECK_URL_VARIABLE__|https://api.github.com/repos/MetaCubeX/mihomo/releases/latest|g' $(1)/usr/bin/justclash
	sed -i -e 's|__CORE_RELEASE_DOWNLOAD_URL_VARIABLE__|https://github.com/MetaCubeX/mihomo/releases/download|g' $(1)/usr/bin/justclash
	sed -i -e 's|__INBUILD_RULESETS_FILES_DOWNLOAD_URL_VARIABLE__|https://cdn.jsdelivr.net/gh/saltymonkey/mrs-parsed-data|g' $(1)/usr/bin/justclash
	sed -i -e 's|__DASHBOARD_DEFAULT_URL_VARIABLE__|https://github.com/Zephyruso/zashboard/releases/latest/download/dist-no-fonts.zip|g' $(1)/usr/bin/justclash
endef

define Package/justclash/conffiles
/etc/config/justclash
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	#[ -f "/usr/bin/mihomo" ] && rm -rf "/usr/bin/mihomo"
	[ -f "/tmp/justclash" ] && rm -rf "/tmp/justclash"
fi
exit 0
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ "$${IPKG_NO_SCRIPT}" = "1" ] && exit 0
[ -s $${IPKG_INSTROOT}/lib/functions.sh ] || exit 0
. $${IPKG_INSTROOT}/lib/functions.sh

# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	# randomize api password if default value detected
	RANDOM_API_PASSWORD=$(echo "$(date +%s%N)$RANDOM" | md5sum | cut -c1-32)
	sed -i -e 's|abcdefghijklmnopqrstuvwxyz1234567890|${RANDOM_API_PASSWORD}|g' /etc/config/justclash
	sed -i -e 's|abcdefghijklmnopqrstuvwxyz1234567890|${RANDOM_API_PASSWORD}|g' /etc/justclash/default.config
	# randomize failover mac string if placeholder value detected
	RANDOM_MAC_REPLACEMENT=$(echo "$(date +%s%N)$RANDOM" | md5sum | cut -c1-30)
	sed -i -e "s|__COMPILED_DEFAULT_MAC_VARIABLE__|${RANDOM_MAC_REPLACEMENT}|g" /usr/lib/justclash/helpers.sh || true
fi

default_postinst $$0 $$@
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))