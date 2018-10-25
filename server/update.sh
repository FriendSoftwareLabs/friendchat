#!/usr/bin/env bash

# update.sh
# Copies the modified files in the friendchat/server directory to
# the proper location in Friend build directory structure.

if [ -z "$FRIEND" ]; then
    echo "No path found, make sure to start with updateAll.sh in parent directory"
    exit 0
fi

echo "Stopping friendchat-server system service"
sudo systemctl stop friendchat-server

# Creates destination directory if it does not exist
FRIENDCHAT_SERVER="$FRIEND/build/services/FriendChat"
if [ ! -d "$FRIENDCHAT_SERVER" ]; then
    mkdir "$FRIENDCHAT_SERVER"
fi

# Copy the files
echo "Copying files to $FRIENDCHAT_SERVER directory."
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update.sh' \
	--exclude '/install.sh' \
	--exclude '/readme.txt' \
	. "$FRIENDCHAT_SERVER"

# Remove old startup script (if still exists)
rm -f ${FRIEND}/build/autostart/startfriendchat.sh

# Run npm
echo "Calling 'npm install'."
TEMP=$(pwd)
cd "$FRIENDCHAT_SERVER"
npm install
cd "$TEMP"

# End
echo ""
echo "Update successfully completed."
echo "Starting friendchat-server system service"
sudo systemctl start friendchat-server

echo ""
