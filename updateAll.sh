#!/bin/sh

FRIEND=""

if [ -f "fup.path" ]; then
    FRIEND=`cat fup.path`
    echo "found fup.path: $FRIEND"
fi

if [ -z "$FRIEND" ]; then
    FRIEND="/home/$USER/friendup"
fi

echo "FRIEND: $FRIEND"
FRIEND_CHECK=$FRIEND

# Eventually asks for the good directory
if [ ! -f "$FRIEND_CHECK/build/cfg/cfg.ini" ]; then
    while true; do
        temp=$(dialog --backtitle "Friend Chat update" --inputbox "\
Please enter the path to the FriendUP directory." 11 60 "$FRIEND_CHECK" --output-fd 1)
        if [ $? = "1" ]; then
            #clear
            echo "Update aborted."
            exit 1
        fi
        if [ $temp != "" ]; then
            FRIEND_CHECK="$temp"
        fi
        
        # Verifies the directory
        if [ ! -f "$FRIEND_CHECK/build/cfg/cfg.ini" ]; then
            dialog --backtitle "Friend Chat client update" --msgbox "\
Friend was not found in this directory,\n\
or Friend was not properly installed." 10 50
        else
            #clear
            break;
        fi
    done
fi

if [ "$FRIEND" != "$FRIEND_CHECK" ]; then
    echo "new path found: $FRIEND_CHECK"
    echo "$FRIEND_CHECK" > fup.path
    FRIEND="$FRIEND_CHECK"
fi

cd server/
. ./update.sh
cd ..

cd client/
. ./update.sh
