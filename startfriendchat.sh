#!bin/bash

# Autostart script for Friend Chat's Presence server
# --------------------------------------------------

# Gets value from setup.ini
if [ -f "cfg/cfg.ini" ]
then
    friendChat=$(sed -nr "/^\[FriendChat\]/ { :l /^enabled[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "cfg/cfg.ini")
    if [ "$friendChat" == "1" ]
    then
        echo "Starting Friend Chat server."
        cd services/FriendChat
        node hello.js
        echo "Friend Chat server ended."
    fi
fi

