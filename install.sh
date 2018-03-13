#!/bin/bash

#
# Friend Chat installation script
#
# This script will install Friend Chat within an existing Friend Core
# installation. If you have not installed Friend Core, you must do it before
# running it (it will detect it and abort).
#
# This script installs the three components that turns Friend Chat into to life:
# 1) The Friend Chat server
# 2) The Presence server
# 3) The Friend Chat client application
#
# You will need TLS keys: if they are not already present for Friend Core,
# this script will offer you the option to create self-signed keys using
# openssl. After Friend Chat installation, Friend Core will run in TLS mode.
# Self-signed keys will generate a warning in your browser the first
# time you connect to your Friend machine : just proceed to the Workspace
# by ignoring it..
#

QUIT="Installation aborted. Please restart script to complete it."
P_GIT="https://github.com/FriendSoftwareLabs/presence.git"

if [ ! -e /usr/bin/node ]
then
	echo "/usr/bin/node not found. Install node.js and/or symlink to /usr/bin/node"
	exit 1
fi

# Installs Dialog
sudo apt-get install dialog

# Welcome
    dialog --backtitle "Friend Chat installer" --yesno "\
Welcome to the Friend Chat installer.\n\n\
Do you want to proceed with installation?" 10 55
if [ $? -eq "1" ]; then
    clear
    echo "$QUIT"
    exit 1
fi

# Installs node.js
echo "Checking for node and npm"

nv=$(node -v)
npm=$(npm -v)
if [ -z $nv ]; then
    dialog --backtitle "Friend Chat installer" --yesno "\
Friend Chat needs node.js to work and it was not found.\n\n\
Choose YES to install it automatically\n\
or NO to install it manually; the script will exit.\n\
\n\
Please note: it is advised to install and manage node.js\n\
using 'n', instruction at: https://github.com/tj/n " 16 65
    if [ $? -eq "0" ]; then
        curl -L http://git.io/n-install | bash
        nv=$(node -v)
        npm=$(npm -v)
    else
        clear
        echo "$QUIT"
        exit 1
    fi
fi

if [ "$nv" \< "v8.6.0" ]; then
    dialog --backtitle "Friend Chat installer" --yesno "\
Warning! node version found: $nv.\n\
Recommended version: v8.6.0 and above.\n\n\
Choose YES to switch to version 8.6.0',\n\
or NO to abort this script..." 11 60
    if [ $? -eq "0" ]; then
        echo "Calling 'n' to change the version of node."
        n 8.6.0
    else
        clear
        echo "$QUIT"
        exit 1
    fi
fi

if [ -z "$npm" ]; then
    dialog --backtitle "Friend Chat installer" --msgbox "\
node was found, but not npm. This is usually bad,\n\
please fix your node.js installation \n\
\n\
Please note: it is advised to install and manage node.js\n\
using 'n', instruction at: https://github.com/tj/n
" 10 70
    clear
    echo "Friend Chat installation aborted."
    exit 1
fi

# Asks for friendup directory
FRIEND_FOLDER="/home/$USER/friendup"
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
or Friend was not properly installed." 10 50
    else
        break;
    fi
done

# Friend Chat folders
FRIENDCHAT_FOLDER=$(pwd)
FRIEND_BUILD="$FRIEND_FOLDER/build"
PRESENCE_FOLDER="$FRIEND_BUILD/services/Presence"
FC_SERVER_FOLDER="$FRIEND_BUILD/services/FriendChat"
FC_CLIENT_FOLDER="$FRIEND_BUILD/resources/webclient/apps/FriendChat"

# check for hello and presence config.js files
# and warn that they will not be overwritten
FC_CLIENT_CFG_FILE="$FC_CLIENT_FOLDER/local.config.js"
FC_CFG_FILE="$FC_SERVER_FOLDER/config.js"
PRESENCE_CFG_FILE="$PRESENCE_FOLDER/config.js"

if [ -f $FC_CLIENT_CFG_FILE ]
then
    FOUND_APP_CFG="Friend Chat app config found at\n\
$FC_CLIENT_CFG_FILE\n\n"
fi

if [ -f $FC_CFG_FILE ]
then
    FOUND_HELLO_CFG="Friend Chat server config found at\n\
$FC_CFG_FILE\n\n"
fi

if [ -f $PRESENCE_CFG_FILE ]
then
    echo "Found presenc cfg"
    FOUND_PRESENCE_CFG="Presence server config found at\n\
$PRESENCE_CFG_FILE\n"
fi


if [[ -f $FC_CLIENT_CFG_FILE || -f $FC_CFG_FILE || -f $PRESENCE_CFG_FILE ]]
then
    dialog --backtitle "Friend Chat installer" --yesno "\
$FOUND_APP_CFG\
$FOUND_HELLO_CFG\
$FOUND_PRESENCE_CFG\
\n\
If you continue, these files will NOT be
overwritten with new values.\n\
Remove the relevant file and restart the installer\n\
if you wish to create a fresh one.\n\
\n\
Abort installer?" 20 75
    if [ $? -eq "0" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
fi

# FriendCore config file
FUP_CFG_FILE="$FRIEND_BUILD/cfg/cfg.ini"

# setup files that might exist, created by previous runs of the friendup and/or friendchat installer
FUP_INI_FILE="$FRIEND_BUILD/cfg/setup.ini"
FC_INI_FILE="$FC_SERVER_FOLDER/friendchat_setup.ini"

# load friend core things
if [ -f $FUP_INI_FILE ]; then
    dbhost=$(sed -nr "/^\[FriendCore\]/ { :l /^dbhost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FUP_INI_FILE)
    dbport=$(sed -nr "/^\[FriendCore\]/ { :l /^dbport[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FUP_INI_FILE)
    friendCoreDomain=$(sed -nr "/^\[FriendCore\]/ { :l /^domain[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FUP_INI_FILE)
else
    # New version of installer not used, get information from cfg/cfg.ini
    dbhost=$(sed -nr "/^\[DatabaseUser\]/ { :l /^host[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FUP_CFG_FILE)
    dbport=$(sed -nr "/^\[DatabaseUser\]/ { :l /^port[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FUP_CFG_FILE)
    friendCoreDomain=$(sed -nr "/^\[FriendCore\]/ { :l /^fchost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FUP_CFG_FILE)

    # Removes eventual ';' left by previous versions of Friend Core installers
    dbhost=${dbhost//;}
    friendCoreDomain=${friendCoreDomain//;}
fi

# load friendchat things
if [ -f $FC_INI_FILE ]
then
    helloDbName=$(sed -nr "/^\[FriendChat\]/ { :l /^dbname[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    helloDbHost=$(sed -nr "/^\[FriendChat\]/ { :l /^dbhost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    helloDbPort=$(sed -nr "/^\[FriendChat\]/ { :l /^dbport[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    helloDbUser=$(sed -nr "/^\[FriendChat\]/ { :l /^dbuser[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    helloDbPass=$(sed -nr "/^\[FriendChat\]/ { :l /^dbpass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    presenceDbName=$(sed -nr "/^\[Presence\]/ { :l /^dbname[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    presenceDbHost=$(sed -nr "/^\[Presence\]/ { :l /^dbhost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    presenceDbPort=$(sed -nr "/^\[Presence\]/ { :l /^dbport[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    presenceDbUser=$(sed -nr "/^\[Presence\]/ { :l /^dbuser[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    presenceDbPass=$(sed -nr "/^\[Presence\]/ { :l /^dbpass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    stunHost=$(sed -nr "/^\[TurnStun\]/ { :l /^stun[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    turnHost=$(sed -nr "/^\[TurnStun\]/ { :l /^turn[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    turnUser=$(sed -nr "/^\[TurnStun\]/ { :l /^user[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
    turnPass=$(sed -nr "/^\[TurnStun\]/ { :l /^pass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
else
    helloDbName="friendchat"
    helloDbHost="$dbhost"
    helloDbPort="$dbport"
    helloDbUser="$dbuser"
    helloDbPass="$dbpass"
    presenceDbName="presence"
    presenceDbHost="$dbhost"
    presenceDbPort="$dbport"
    presenceDbUser="$dbuser"
    presenceDbPass="$dbpass"
    stunHost="your_stun_server.com:xxxx"
    turnHost="your_turn_server.com:xxxx"
    turnUser="your_turn_username"
    turnPass="your_turn_password"
fi

# Checks if TLS keys are defined
NEWTLS="0"
SELFSIGNED="false"
if [ ! -f "$FRIEND_BUILD/cfg/crt/key.pem" ]
then
    dialog --backtitle "Friend Chat installer" --msgbox "\
Friend Chat requires TLS/SSL to work.\n\n\
This script will now create them for you.\n\
Please answer the following questions..." 11 70
    clear

    # Call openssl to create the keys
    if [ ! -d "$FRIEND_BUILD/cfg/crt" ]; then
        mkdir "$FRIEND_BUILD/cfg/crt"
    fi
    echo "Calling openssl to create the keys."
    openssl req -newkey rsa:2048 -nodes -sha512 -x509 -days 3650 -nodes -out "$FRIEND_BUILD/cfg/crt/certificate.pem" -keyout "$FRIEND_BUILD/cfg/crt/key.pem"
    TLSNEW="1"
    SELFSIGNED="true"
else
    temp=$(openssl verify -CAfile "$FRIEND_BUILD/cfg/crt/certificate.pem" -CApath "$FRIEND_BUILD/cfg/crt/certificate.pem" "$FRIEND_BUILD/cfg/crt/certificate.pem")
    if [ "$temp" == "$FRIEND_BUILD/cfg/crt/certificate.pem: OK" ]; then
        SELFSIGNED="true";
    fi
fi

# Asks for Friend Chat information
dialog --backtitle "Friend Chat installer" --msgbox "\
FriendChat service will be installed.\n\
Presence service will be installed.\n\
FriendChat client app will be installed.\n\
\n\
mySQL databases will be added for the services.\n\
\n\
The live/p2p part of Friend Chat also requires\n\
access to TURN and STUN servers to be useful.\n\
These are not set up here, but here is a \n\
project that has proven useful to us:\n\
https://github.com/coturn/coturn\n\
\n\
The installer will now ask for all the necessary\n\
information and then set things up within Friend." 19 60

while true; do
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the FQDN the Friend Chat client app\n\
will use to connect to the Friend Chat service.\n\
This is most likely the same domain on which FriendCore\n\
is running" 12 70 "$friendCoreDomain" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        friendCoreDomain="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Presence server database.\n\n\
Please enter the name of the Presence database." 12 55 "$presenceDbName" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        presenceDbName="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Presence server database.\n\n\
Please enter a mysql user name for Presence,\n\
it can be an existing user name or a new one,\n\
but must be different from 'root'." 13 65 "$presenceDbUser" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        presenceDbUser="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Presence server database.\n\n\
Please enter the password\n\
for mysql user $presenceDbUser:" 10 45 "$presenceDbPass" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        presenceDbPass="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Friend Chat server database.
Please enter the name of the Friend Chat database." 11 60 "$helloDbName" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        helloDbName="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Friend Chat server database.\n\n\
Please enter a mysql user name for the Friend Chat,\n\
server database. It can be an existing user name or,\n\
a new one but must be different from 'root'." 13 65 "$helloDbUser" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        helloDbUser="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Friend Chat server database.\n\n\
Please enter the password\n\
for mysql user $helloDbUser:" 10 50 "$helloDbPass" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        helloDbPass="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the turn server address:" 10 50 "$turnHost" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        turnHost="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the turn server username:" 10 50 "$turnUser" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        turnUser="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the turn server password:" 10 50 "$turnPass" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        turnPass="$temp"
    fi
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the stun server address:" 10 50 "$stunHost" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        stunHost="$temp"
    fi
    dialog --defaultno --backtitle "Friend Chat installer" --yesno "\
Using the following values for Friend Chat:\n\
\n\
Friend Chat domain: $friendCoreDomain\n\
Friend Chat server database name: $helloDbName\n\
Friend Chat server database username: $helloDbUser\n\
Friend Chat server database password: $helloDbPass\n\
Presence server database name: $presenceDbName\n\
Presence server database username: $presenceDbUser\n\
Presence server database password: $presenceDbPass\n\
TURN server address: $turnHost\n\
TURN server username: $turnUser\n\
TURN server password: $turnPass\n\
STUN server address: $stunHost\n\n\
Please check the values and confirm..." 20 75
    if [ $? = "0" ]; then
        break;
    fi
done

# Asks for database root password
while true; do
    mysqlRootPass=$(dialog --backtitle "Friend Chat installer" --passwordbox "Please enter mysql root password:" 8 50 --output-fd 1)
    if [ $? = "1" ]
    then
        clear
        echo "$QUIT"
        exit 1
    fi
    # Checks mysql root password
    mysql -u root -p$mysqlRootPass -e ";"
    if [ $? == "0" ]; then
        break;
    fi
    dialog --backtitle "Friend Chat installer" --msgbox "Invalid mysql password, please try again." 8 55 --output-fd 1
done
clear

# INSTALLATION OF THE PRESENCE SERVER
# -----------------------------------

# Clone or pull 'presence' from GIT
if [ ! -d "$PRESENCE_FOLDER" ]
then
    echo "Cloning Presence server from GIT"
    mkdir "$PRESENCE_FOLDER"
    cd "$PRESENCE_FOLDER"
    git clone $P_GIT .
else
    echo "Pulling new changes to Presence server from GIT"
    cd "$PRESENCE_FOLDER"
    git pull
fi
cd "$FRIENDCHAT_FOLDER"

if [ ! -e $PRESENCE_CFG_FILE ]
then
    # Copies example.config.js file to config.js
    cp "$PRESENCE_FOLDER"/example.config.js $PRESENCE_CFG_FILE

    # Pokes the new values in the presence/config.js file
    sed -i -- "s/presence_database_host/${presenceDbHost//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/3306/${presenceDbPort//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/presence_database_user/${presenceDbUser//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/presence_database_password/${presenceDbPass//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/presence_database_name/${presenceDbName//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/presence_domain/${friendCoreDomain//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/path_to_key.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/key.pem/g" $PRESENCE_CFG_FILE
    sed -i -- "s/path_to_cert.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/certificate.pem/g" $PRESENCE_CFG_FILE
    sed -i -- "s/friendcore_domain/${friendCoreDomain//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/stun_url.com/${stunHost//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/turn_url.com/${turnHost//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/turn_username/${turnUser//\//\\/}/g" $PRESENCE_CFG_FILE
    sed -i -- "s/turn_password/${turnPass//\//\\/}/g" $PRESENCE_CFG_FILE
fi
# Temporary store the password in system variable to avoid warnings
export MYSQL_PWD=$mysqlRootPass

# Connection strings
mysqlAdminConnect="--host=$dbhost --port=$dbport --user=root"
mysqlconnect="--host=$dbhost --port=$dbport --user=$presenceDbUser"
mysqlconnectdb=$mysqlconnect" --database=$presenceDbName"

# Checks if user is already present or not, and creates it eventually
userExists=$(mysql $mysqlAdminConnect \
	--execute="SELECT mu.User FROM mysql.user AS mu WHERE mu.User='$presenceDbUser'")
if [ "$userExists" == "" ]; then
	echo "Setting up user: $presenceDbUser"
	# Creates user
	mysql $mysqlAdminConnect \
		--execute="CREATE USER $presenceDbUser@$dbhost IDENTIFIED BY '$presenceDbPass';"
else
	echo "User $presenceDbUser already exists, skipping"
fi

# Checks if database is already created
dbpresent=$(mysql $mysqlAdminConnect \
	--execute="SHOW DATABASES LIKE '$presenceDbName'")
if [[ $dbpresent == *"$presenceDbName"* ]]; then
	echo "Database $presenceDbName was found, skipping"
	# Grants access to db in case user did not exist
	mysql $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $presenceDbName.* TO $presenceDbUser@$dbhost;"
	# Cleans memory
	mysql $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
else
	# Creates database
	echo "Creating database: $presenceDbName"
	mysql $mysqlAdminConnect \
		--execute="CREATE DATABASE $presenceDbName"
	# Grants access to db
	mysql $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $presenceDbName.* TO $presenceDbUser@$dbhost;"
	# Cleans memory
	mysql $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
	# Switch to user
	export MYSQL_PWD=$presenceDbPass
	# Creates tables
	echo "Creating tables"
	mysql $mysqlconnectdb \
		--execute="SOURCE $PRESENCE_FOLDER/db/tables.sql"
fi
sleep 1

# Switch to user if not already done
export MYSQL_PWD=$presenceDbPass

echo "Running update procedures"
mysql $mysqlconnectdb \
	--execute="SOURCE $PRESENCE_FOLDER/db/procedures.sql"

# Deletes dangerous variable
export MYSQL_PWD=''

# Initialize node module
cd "$PRESENCE_FOLDER"
npm install
cd "$FRIENDCHAT_FOLDER"

# INSTALLATION OF FRIEND CHAT SERVER
# ----------------------------------

# Copies files into Friend build directory
if [ ! -d "$FC_SERVER_FOLDER" ]; then
    mkdir "$FC_SERVER_FOLDER"
fi
cd server
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/example.update_to_fup.sh' \
	--exclude '/update_to_fup.sh' \
	. "$FC_SERVER_FOLDER"
cd $FRIENDCHAT_FOLDER

if [ ! -e $FC_CFG_FILE ]
then
    # Copies example.config.js file to config.js
    cp "$FC_SERVER_FOLDER/example.config.js" $FC_CFG_FILE

    # Pokes the new values in the presence/config.js file
    sed -i -- "s/dev : false/dev : $SELFSIGNED/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_host/${dbhost//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/3306/${dbport//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_user/${helloDbUser//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_password/${helloDbPass//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_name/${helloDbName//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/path_to_key.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/key.pem/g" $FC_CFG_FILE
    sed -i -- "s/path_to_cert.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/certificate.pem/g" $FC_CFG_FILE
    sed -i -- "s/friendcore_host/${friendCoreDomain//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/presence_domain/${friendCoreDomain//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/Do not edit this file/This file can be edited/g" $FC_CFG_FILE
fi
# Temporary store the password in system variable to avoid warnings
export MYSQL_PWD=$mysqlRootPass

# Set database connexion variables
mysqlAdminConnect="--host=$dbhost --port=$dbport --user=root"
mysqlconnect="--host=$dbhost --port=$dbport --user=$helloDbUser"
mysqlconnectdb=$mysqlconnect" --database=$helloDbName"

# Checks if user is already present or not, and creates it eventually
userExists=$(mysql $mysqlAdminConnect \
	--execute="SELECT mu.User FROM mysql.user AS mu WHERE mu.User='$helloDbUser'")
if [ "$userExists" == "" ]; then
	echo "Setting up user: $helloDbUser"
	# Creates user
	mysql $mysqlAdminConnect \
		--execute="CREATE USER $helloDbUser@$dbhost IDENTIFIED BY '$helloDbPass';"
else
	echo "User $helloDbUser already exists, skipping"
fi

# Checks for database existence and creates it if not present
dbpresent=$(mysql $mysqlAdminConnect \
	--execute="SHOW DATABASES LIKE '$helloDbName'")
if [[ $dbpresent == *"$helloDbName"* ]]; then
	echo "Database $helloDbName was found, skipping"
	# Grants access to db in case user did not exist
	mysql $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $helloDbName.* TO $helloDbUser@$dbhost;"
	# Cleans memory
	mysql $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
else
	# Creates database
	echo "Creating database: $helloDbName"
	mysql $mysqlAdminConnect \
		--execute="CREATE DATABASE $helloDbName"
	# Grants access to db
	mysql $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $helloDbName.* TO $helloDbUser@$dbhost;"
	# Cleans memory
	mysql $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
	# Switch to user
	export MYSQL_PWD=$helloDbPass
	# Creates tables
	echo "Creating tables"
	mysql $mysqlconnectdb \
		--execute="SOURCE $FC_SERVER_FOLDER/scripts/sql/tables.sql"
fi
sleep 1

# Switch to user if not switched before
export MYSQL_PWD=$helloDbPass

echo "Running update procedures"
mysql $mysqlconnectdb \
	--execute="SOURCE $FC_SERVER_FOLDER/scripts/sql/procedures.sql"

# Removes dangerous variable
export MYSQL_PWD=''

# Initialize node module
cd "$FC_SERVER_FOLDER"
npm install
cd "$FRIENDCHAT_FOLDER"

# Installation of the Friend Chat application
# ---------------------------------------------

# Copies files into Friend build directory
if [ ! -d "$FC_CLIENT_FOLDER" ]; then
    mkdir "$FC_CLIENT_FOLDER"
fi
cd client
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update_to_fup.sh' \
	. "$FC_CLIENT_FOLDER"
cd "$FRIENDCHAT_FOLDER"

if [ ! -e "$FC_CLIENT_FOLDER/local.config.js" ]
then
    # Copies example.local.config.js file to local.config.js
    cp "$FC_CLIENT_FOLDER/example.local.config.js" "$FC_CLIENT_FOLDER/local.config.js"

    # Pokes the new values in the local.config.js file
    sed -i -- "s/friendcore_host/${friendCoreDomain//\//\\/}/g" "$FC_CLIENT_FOLDER/local.config.js"
fi

#installs new systemd script, starts it and enables autostart, arguments:
# $1 - path to executable
# $2 - service file name (no spaces)
# $3 - service description
function install_systemd_service(){
	USER=`whoami`
	NAME=$2
	TMP=/tmp/${NAME}.service
	EXE=$1
	WORKDIR=$(dirname "${EXE}")
	DESCRIPTION=$3

	echo "Writing systemd script to temporary file $TMP"

	echo '[Unit]' > $TMP
	echo 'Description=${DESCRIPTION}' >> $TMP
	echo 'After=network.target' >> $TMP

	echo '[Service]' >> $TMP
	echo 'Type=simple' >> $TMP
	echo "User=${USER}" >> $TMP
	echo "WorkingDirectory=${WORKDIR}" >> $TMP
	echo "ExecStart=/usr/bin/node ${EXE}" >> $TMP
	echo 'Restart=always' >> $TMP
	echo 'RestartSec=3' >> $TMP

	echo '[Install]' >> $TMP
	echo 'WantedBy=multi-user.target' >> $TMP

	echo "Root password is required to copy $TMP to /etc/systemd/system and enable the service"
	sudo cp $TMP /etc/systemd/system/
	suco systemctl enable ${NAME}

	echo 'Service is installed and enabled'
	echo "Use standard systemd commands to control the service:"
	echo "systemctl start ${NAME}"
	echo "systemctl stop ${NAME}"
	echo "systemctl restart ${NAME}"
}

install_systemd_service "${FRIEND_BUILD}/services/FriendChat/hello.js" "friendchat-server" "FriendChat server (hello)"
install_systemd_service "${FRIEND_BUILD}/services/Presence/presence.js" "presence-server" "FriendChat server (presence)"


# Saves setup.ini configuration file
echo "; Friend installation configuration file" > $FC_INI_FILE
echo "; Please respect spaces if you edit this manually" >> $FC_INI_FILE
echo " " >> $FC_INI_FILE
echo "[FriendChat]" >> $FC_INI_FILE
echo "dbname = $helloDbName" >> $FC_INI_FILE
echo "dbuser = $helloDbUser" >> $FC_INI_FILE
echo "dbpass = $helloDbPass" >> $FC_INI_FILE
echo " " >> $FC_INI_FILE
echo "[Presence]" >> $FC_INI_FILE
echo "dbname = $presenceDbName" >> $FC_INI_FILE
echo "dbuser = $presenceDbUser" >> $FC_INI_FILE
echo "dbpass = $presenceDbPass" >> $FC_INI_FILE
echo "stun = $stunHost" >> $FC_INI_FILE
echo "turn = $turnHost" >> $FC_INI_FILE
echo "user = $turnUser" >> $FC_INI_FILE
echo "pass = $turnPass" >> $FC_INI_FILE

# Enable Friend Chat in Friend
FUP_CFG_PATH="$FRIEND_BUILD/cfg/cfg.ini"
CFG_IS_SET="0"
while read line; do
    if [[ $line == "[FriendChat]" ]]
    then
        CFG_IS_SET="1"
    fi
done <$FUP_CFG_PATH

if [ $CFG_IS_SET -eq "0" ]
then
    echo "[FriendChat]" >> $FUP_CFG_PATH
    echo "enabled = 1" >> $FUP_CFG_PATH
fi

# Successful installation
if [ "$TLSNEW" == "1" ]; then
    dialog --backtitle "Friend Chat installer" --msgbox "          Installation complete.\n\n\
Warning : Friend Core is now running in TLS mode!\n\
From now on, you have access to your Friend machine at :\n\
https://$friendCoreDomain:6502" 12 60
else
    dialog --backtitle "Friend Chat installer" --msgbox "          Installation complete." 9 45
fi
clear

# Clean exit
echo "Friend Chat installation successful."
exit 0
