#!/usr/bin/env bash

# update.sh
# Copies the modified files in the friendchat/client directory to
# the proper location in Friend build directory structure.

if [ -z "$FRIEND" ]; then
    echo "No path found, make sure to start with updateAll.sh in parent directory"
    exit 0
fi

echo "updating client, path: $FRIEND"

appPath="$FRIEND/resources/webclient/apps/FriendChat"
# Creates destination directory if it does not exist
if [ ! -d "$appPath" ]; then
    mkdir "$appPath"
fi

# Copy the files
echo "Copying files to $FRIEND directory."
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update.sh' \
	--exclude '/install.sh' \
	--exclude '/readme.txt' \
	. "$appPath"

# Write version info
/bin/bash version.sh $appPath

# End
echo ""
echo "Update successfully completed."
echo ""
