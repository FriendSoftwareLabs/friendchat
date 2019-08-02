# default variables
FRIEND_PATH 			?=	$(PWD)/packaging/build
FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH=$(PWD)/packaging/debian-friendchat/debian/friendup-friendchat/opt/friendup/installation_files
FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH=$(PWD)/packaging/ubuntu-friendchat/debian/friendup-friendchat/opt/friendup/installation_files

#
#compilation
#

all:
	@echo "Making default compilation with debug."

#
# Debian packages
#

deb-debian-friendchat:
	@echo "Valid targets are: make deb-friendchat"
	cd packaging/debian-friendchat && dpkg-buildpackage -b -uc

installforpackage-friendchat-debian:
	@echo "Make install for package"
	mkdir -p $(FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH)
	cp packaging/debian-friendchat/debian/postinst $(PWD)/packaging/debian-friendchat/debian/friendup-friendchat/DEBIAN/
	cp -r $(PWD)/client $(FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH)/
	cp -r $(PWD)/server $(FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH)/
	cp $(PWD)/install.sh $(FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH)/
	cp $(PWD)/install_package.sh $(FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH)/
	cp $(PWD)/LICENSE $(FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH)/
	cp $(PWD)/updateAll.sh $(FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH)/

#
# Ubuntu packages
#

deb-ubuntu-friendcore:
	@echo "Make package"
	cd packaging/ubuntu-friendchat && dpkg-buildpackage -b -uc

installforpackage-friendcore-ubuntu:
	@echo "Make install for package"
	mkdir -p $(FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH)
	cp packaging/debian-friendchat/debian/postinst $(PWD)/packaging/debian-friendchat/debian/friendup-friendchat/DEBIAN/
	cp -r $(PWD)/client $(FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH)/
	cp -r $(PWD)/server $(FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH)/
	cp $(PWD)/install.sh $(FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH)/
	cp $(PWD)/install_package.sh $(FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH)/
	cp $(PWD)/LICENSE $(FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH)/
	cp $(PWD)/updateAll.sh $(FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH)/
#	make FRIEND_PATH=$(FRIEND_DEB_TGT_PATH) release install
#FIXME: cruft is copied to the target directory (eg. FriendNetwork server logs)

#
#
#

clean:
	@echo "Clean process in progress."
	rm -rf ${FRIEND_FRIENDCHAT_DEB_DEBIAN_TGT_PATH}
	rm -rf ${FRIEND_FRIENDCORE_DEB_UBUNTU_TGT_PATH}

install:
	@echo "Installing to: $(FRIEND_PATH)"

