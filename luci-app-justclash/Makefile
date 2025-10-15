include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-justclash
PKG_VERSION:=0.4.0
PKG_RELEASE:=1

LUCI_TITLE:=LuCI justclash app
LUCI_DEPENDS:=+luci-base +justclash
LUCI_PKGARCH:=all
LUCI_LANG.ru:=Русский (Russian)
LUCI_LANG.en:=English

PKG_MAINTAINER:=SaltyMonkey <https://github.com/SaltyMonkey>
PKG_LICENSE:=GPL-2.0-or-later

LUCI_LANGUAGES:=en ru

define Package/$(PKG_NAME)/description
	LuCI web interface for the JustClash proxy service.
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	rm -rf /tmp/luci-index*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload
	[ -f "/sbin/luci-reload" ] && /sbin/luci-reload
	[ -f "/etc/init.d/uhttpd" ] && /etc/init.d/uhttpd reload
fi
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)$(HTDOCS)
	$(CP) $(PKG_BUILD_DIR)/htdocs/* $(1)$(HTDOCS)/
	$(INSTALL_DIR) $(1)/
	$(CP) $(PKG_BUILD_DIR)/root/* $(1)/
	sed -i -e 's/__COMPILED_VERSION_VARIABLE__/$(PKG_VERSION)/g' $(1)$(HTDOCS)/luci-static/resources/view/justclash/common.js || true
endef

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,$(PKG_NAME)))