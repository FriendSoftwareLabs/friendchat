#!/bin/bash

# Default Friend paths (to be modified)
FRIEND_FOLDER=$(pwd)
QUIT="Installation aborted. Please restart script to complete it."

# Installs Dialog
sudo apt-get install dialog

# Asks for friendup directory
FRIEND_FOLDER="/Home/{$USER}/friendup"
while true; do
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the path to the FriendUp directory." 11 60 "$FRIEND_FOLDER" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ $temp != "" ]; then
        FRIEND_FOLDER="$temp"
    fi

    # Verifies the directory
    if [ ! -f "$FRIEND_FOLDER/build/cfg/cfg.ini" ]; then
        dialog --backtitle "Friend Chat installer" --msgbox "\
Friend was not found in this directory,\n\
or Friend was not properly installed.\n\n\
Please check the path, or re-install Friend.\n\n\
Aborting Friend Chat installation." 10 45
        clear
        exit 1
    else
        break
    fi
done

# Friend Chat folders
FRIEND_BUILD="$FRIEND_FOLDER/build"
FRIENDCHATSERVERS_FOLDER="$FRIEND_BUILD/services"
FRIENDCHATAPP_FOLDER="$FRIEND_FOLDER/interfaces/web_client/apps/FriendChat"

# Checks if TLS keys are defined
NEWTLS="0"
if [ ! -f "$FRIEND_BUILD/cfg/crt/key.pem" ]
then
    dialog --backtitle "Friend Chat installer" --msgbox "\
Friend Chat needs TLS keys to work.\n\n\
This script will now create them for you.\n\
Please answer the following questions..." 11 70
    clear

    # Calls openssl to create the keys
    echo "Calling openssl to create the keys."
    openssl req -newkey rsa:2048 -nodes -sha512 -x509 -days 3650 -nodes -out "$FRIEND_BUILD/cfg/crt/certificate.pem" -keyout "$FRIEND_BUILD/cfg/crt/key.pem"
    NEWTLS="1"
fi

# Get information from setup.ini if it exists
turnAddress="your_turn_server.com"
stunAddress="your_stun_server.com"
turnUser="your_turn_username"
turnPass="your_turn_password"
helloDbName="friendchat"
presenceDbName="presence"
if [ -f "$FRIEND_BUILD/cfg/setup.ini" ]; then
    dbhost=$(sed -nr "/^\[FriendCore\]/ { :l /^dbhost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    dbuser=$(sed -nr "/^\[FriendCore\]/ { :l /^dbuser[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    dbpass=$(sed -nr "/^\[FriendCore\]/ { :l /^dbpass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    dbport=$(sed -nr "/^\[FriendCore\]/ { :l /^dbport[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    friendCoreDomain=$(sed -nr "/^\[FriendCore\]/ { :l /^domain[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    turnAddress=$(sed -nr "/^\[TurnStun\]/ { :l /^turn[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    stunAddress=$(sed -nr "/^\[TurnStun\]/ { :l /^stun[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    turnUser=$(sed -nr "/^\[TurnStun\]/ { :l /^user[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    turnPass=$(sed -nr "/^\[TurnStun\]/ { :l /^pass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    helloDbName=$(sed -nr "/^\[FriendChat\]/ { :l /^dbname[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    helloDbHost=$(sed -nr "/^\[FriendChat\]/ { :l /^dbhost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    helloDbPort=$(sed -nr "/^\[FriendChat\]/ { :l /^dbport[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    helloDbUser=$(sed -nr "/^\[FriendChat\]/ { :l /^dbuser[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    helloDbPass=$(sed -nr "/^\[FriendChat\]/ { :l /^dbpass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    presenceDbName=$(sed -nr "/^\[Presence\]/ { :l /^dbname[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    presenceDbHost=$(sed -nr "/^\[Presence\]/ { :l /^dbhost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    presenceDbPort=$(sed -nr "/^\[Presence\]/ { :l /^dbport[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    presenceDbUser=$(sed -nr "/^\[Presence\]/ { :l /^dbuser[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    presenceDbPass=$(sed -nr "/^\[Presence\]/ { :l /^dbpass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
else
    # Get information from cfg/cfg.ini and define default values
    dbhost=$(sed -nr "/^\[DatabaseUser\]/ { :l /^host[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbname=$(sed -nr "/^\[DatabaseUser\]/ { :l /^dbname[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbuser=$(sed -nr "/^\[DatabaseUser\]/ { :l /^login[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbpass=$(sed -nr "/^\[DatabaseUser\]/ { :l /^password[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbport=$(sed -nr "/^\[DatabaseUser\]/ { :l /^port[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    friendCoreDomain=$(sed -nr "/^\[FriendCore\]/ { :l /^fchost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
fi
helloDbHost="$dbhost"
helloDbPort="$dbport"
helloDbUser="$dbuser"
helloDbPass="$dbpass"
presenceDbHost="$dbhost"
presenceDbPort="$dbport"
presenceDbUser="$dbuser"
presenceDbPass="$dbpass"
