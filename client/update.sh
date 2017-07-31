#!/usr/bin/env bash

# update.sh
# Copies the modified files in the friendchat/client directory to
# the proper location in Friend build directory structure.

# Edit this line if your Friend directory is not the same as this one
FRIEND="/home/$USER/friendup"

# Eventually asks for the good directory
if [ ! -f "$FRIEND/build/cfg/cfg.ini" ]; then
    while true; do
        temp=$(dialog --backtitle "Friend Chat client update" --inputbox "\
Please enter the path to the FriendUP directory." 11 60 "$FRIEND" --output-fd 1)
        if [ $? = "1" ]; then
            clear
            echo "Update aborted."
            exit 1
        fi
        if [ $temp != "" ]; then
            FRIEND="$temp"
        fi

        # Verifies the directory
        if [ ! -f "$FRIEND/build/cfg/cfg.ini" ]; then
            dialog --backtitle "Friend Chat client update" --msgbox "\
Friend was not found in this directory,\n\
or Friend was not properly installed." 10 50
        else
            clear
            break;
        fi
    done
fi

# Creates destination directory if it does not exist
if [ ! -d "$FRIEND/build/resources/webclient/apps/FriendChat" ]; then
    mkdir "$FRIEND/build/resources/webclient/apps/FriendChat"
fi

# Copy the files
echo "Copying files to $FRIEND directory."
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update.sh' \
	--exclude '/install.sh' \
	--exclude '/readme.txt' \
	. "$FRIEND/build/resources/webclient/apps/FriendChat"

# End
echo ""
echo "Update successfully completed."
echo ""
