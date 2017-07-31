#!/bin/bash

QUIT="Installation aborted. Please restart script to complete it."
GIT="https://github.com/FriendSoftwareLabs/presence.git"

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

# Checks friend default directory
FRIEND_FOLDER="/home/$USER/friendup"
# Asks for friendup directory
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
FRIENDCHATSERVER_FOLDER="$FRIEND_BUILD/services/FriendChat"
FRIENDCHATAPP_FOLDER="$FRIEND_BUILD/resources/webclient/apps/FriendChat"

# Checks if TLS keys are defined
NEWTLS="0"
if [ ! -f "$FRIEND_BUILD/cfg/crt/key.pem" ]
then
    dialog --backtitle "Friend Chat installer" --msgbox "\
Friend Chat needs TLS keys to work.\n\n\
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
fi

# Get information from setup.ini if it exists
turnAddress="your_turn_server.com"
stunAddress="your_stun_server.com"
turnUser="your_turn_username"
turnPass="your_turn_password"
helloDbName="friendchat"
presenceDbName="presence"
friendNetwork="0"
if [ -f "$FRIEND_BUILD/cfg/setup.ini" ]; then
    dbhost=$(sed -nr "/^\[FriendCore\]/ { :l /^dbhost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    dbuser=$(sed -nr "/^\[FriendCore\]/ { :l /^dbuser[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    dbpass=$(sed -nr "/^\[FriendCore\]/ { :l /^dbpass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    dbport=$(sed -nr "/^\[FriendCore\]/ { :l /^dbport[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    dbname=$(sed -nr "/^\[FriendCore\]/ { :l /^dbname[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
    friendNetwork=$(sed -nr "/^\[FriendNetwork\]/ { :l /^enable[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/setup.ini")
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
    # New version of installer not used, get information from cfg/cfg.ini
    dbhost=$(sed -nr "/^\[DatabaseUser\]/ { :l /^host[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbname=$(sed -nr "/^\[DatabaseUser\]/ { :l /^dbname[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbuser=$(sed -nr "/^\[DatabaseUser\]/ { :l /^login[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbpass=$(sed -nr "/^\[DatabaseUser\]/ { :l /^password[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    dbport=$(sed -nr "/^\[DatabaseUser\]/ { :l /^port[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    friendCoreDomain=$(sed -nr "/^\[FriendCore\]/ { :l /^fchost[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    friendNetwork=$(sed -nr "/^\[FriendNetwork\]/ { :l /^enabled[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" "$FRIEND_BUILD/cfg/cfg.ini")
    helloDbHost="$dbhost"
    helloDbPort="$dbport"
    helloDbUser="$dbuser"
    helloDbPass="$dbpass"
    presenceDbHost="$dbhost"
    presenceDbPort="$dbport"
    presenceDbUser="$dbuser"
    presenceDbPass="$dbpass"
fi

# Asks for Friend Chat information
dialog --backtitle "Friend Chat installer" --msgbox "\
Friend Chat needs a TURN and STUN server to function.\n\n\
It also needs a Friend Chat and Presence server installed\n\
each one of them with their own database.\n\n\
This script will now ask for all the necessary information\n\
and then install the files automatically into your Friend folder." 13 70

while true; do
    temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the domain name on which Friend Chat is to run.\n\n\
Important! Friend Chat will not run on 'localhost' if\n\
you are running Friend from a virtual machine..." 12 70 "$friendCoreDomain" --output-fd 1)
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
Please enter the turn server address:" 10 50 "$turnAddress" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        turnAddress="$temp"
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
Please enter the stun server address:" 10 50 "$stunAddress" --output-fd 1)
    if [ $? = "1" ]; then
        clear
        echo "$QUIT"
        exit 1
    fi
    if [ "$temp" != "" ]; then
        stunAddress="$temp"
    fi
    dialog --defaultno --backtitle "Friend installer" --yesno "\
Using the following values for Friend Chat:\n\n\
Friend Chat domain: $friendCoreDomain\n\
Presence server database name: $presenceDbName\n\
Presence server database username: $presenceDbUser\n\
Presence server database password: $presenceDbPass\n\
Friend Chat server database name: $helloDbName\n\
Friend Chat server database username: $helloDbUser\n\
Friend Chat server database password: $helloDbPass\n\
TURN server address: $turnAddress\n\
TURN server username: $turnUser\n\
TURN server password: $turnPass\n\
STUN server address: $stunAddress\n\
Please check the values and confirm..." 19 75
    if [ $? = "0" ]; then
        break;
    fi
done

# Installs node.js
echo "Checking for node.js and npm"

installNode() {
	curl -L http://git.io/n-install | bash
	n 4.5.0
}

nv=$(node -v)
npm=$(npm -v)
if [ -z $nv ]; then
    dialog --backtitle "Friend installer" --yesno "\
Friend Chat need Node.js to work and it was not found.\n\n\
If you want to install it manually,\n\
exit and restart this script.\n\
Recommended version of Node for Friend Chat is 4.4.4\n\
We also suggest you install 'n' to manage node versions.\n\n\
Install node automatically?" 13 60
    if [ $? -eq "0" ]; then
        installNode
        nv=$(node -v)
        npm=$(npm -v)
    else
        clear
        echo "$QUIT"
        exit 1
    fi
fi

if [ "v4.5.0" != "$nv" ]; then
    dialog --backtitle "Friend installer" --yesno "\
Warning! node version found: $nv.\n\
Recommended version: v4.5.0\n\n\
Choose YES to switch to version 4.5.0,\n\
or NO to use the current version..." 11 60
    if [ $? -eq "0" ]; then
        echo "Calling 'n' to change the version of node."
        n 4.5.0
    fi
fi

if [ -z "$npm" ]; then
    dialog --backtitle "Friend installer" --msgbox "\
Node was found, but not npm." 10 70
    clear
    echo "Friend Chat installation aborted."
	exit 1
fi

# Asks for database root password
while true; do
    mysqlRootPass=$(dialog --backtitle "Friend installer" --passwordbox "Please enter mysql root password:" 8 50 --output-fd 1)
    if [ $? = "1" ]
    then
        clear
        exit 1
    fi
    # Checks mysql root password
    mysql --host=$dbhost --port=$dbport --user=root --password=$mysqlRootPass \
          --execute="SELECT mu.User FROM mysql.user AS mu WHERE mu.User='$dbuser'"
    if [ $? == "0" ]; then
        break;
    fi
    dialog --backtitle "Friend installer" --msgbox "Invalid password, please try again." 8 50 --output-fd 1
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
    git clone $GIT .
else
    echo "Pulling new changes to Presence server from GIT"
    cd "$PRESENCE_FOLDER"
    git pull
fi
cd "$FRIENDCHAT_FOLDER"

# Copies example.config.js file to config.js
cp "$PRESENCE_FOLDER"/example.config.js "$PRESENCE_FOLDER"/config.js

# Pokes the new values in the presence/config.js file
sed -i -- "s/presence_database_host/${presenceDbHost//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/3306/${presenceDbPort//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/presence_database_user/${presenceDbUser//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/presence_database_password/${presenceDbPass//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/presence_database_name/${presenceDbName//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/presence_domain/${friendCoreDomain//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/path_to_key.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/key.pem/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/path_to_cert.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/certificate.pem/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/friendcore_domain/${friendCoreDomain//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/stun_url.com/${stunAddress//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/turn_url.com/${turnAddress//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/turn_username/${turnUser//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/turn_password/${turnPass//\//\\/}/g" "$PRESENCE_FOLDER"/config.js
sed -i -- "s/Do not edit this file!/This file can be edited/g" "$PRESENCE_FOLDER"/config.js

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
if [ ! -d "$FRIENDCHATSERVER_FOLDER" ]; then
    mkdir "$FRIENDCHATSERVER_FOLDER"
fi
cd server
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/example.update_to_fup.sh' \
	--exclude '/update_to_fup.sh' \
	. "$FRIENDCHATSERVER_FOLDER"
cd "$FRIENDCHAT_FOLDER"

# Copies example.config.js file to config.js
cp "$FRIENDCHATSERVER_FOLDER"/example.config.js "$FRIENDCHATSERVER_FOLDER"/config.js

# Pokes the new values in the presence/config.js file
sed -i -- "s/hello_database_host/${dbhost//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/3206/${dbport//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/hello_database_user/${helloDbUser//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/hello_database_password/${helloDbPass//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/hello_database_name/${helloDbName//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/path_to_key.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/key.pem/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/path_to_cert.pem/${FRIEND_BUILD//\//\\/}\/cfg\/crt\/certificate.pem/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/friendcore_host/${friendCoreDomain//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/presence_domain/${friendCoreDomain//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/stun_url.com/${stunAddress//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/turn_url.com/${turnAddress//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/turn_username/${turnUser//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/turn_password/${turnPass//\//\\/}/g" "$FRIENDCHATSERVER_FOLDER"/config.js
sed -i -- "s/Do not edit this file/This file can be edited/g" "$FRIENDCHATSERVER_FOLDER"/config.js

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
		--execute="SOURCE $FRIENDCHATSERVER_FOLDER/scripts/sql/tables.sql"
fi
sleep 1

# Switch to user if not switched before
export MYSQL_PWD=$helloDbPass

echo "Running update procedures"
mysql $mysqlconnectdb \
	--execute="SOURCE $FRIENDCHATSERVER_FOLDER/scripts/sql/procedures.sql"

# Removes dangerous variable
export MYSQL_PWD=''

# Initialize node module
cd "$FRIENDCHATSERVER_FOLDER"
npm install
cd "$FRIENDCHAT_FOLDER"

# Installation of the Friend Chat application
# ---------------------------------------------

# Copies files into Friend build directory
if [ ! -d "$FRIENDCHATAPP_FOLDER" ]; then
    mkdir "$FRIENDCHATAPP_FOLDER"
fi
cd client
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update_to_fup.sh' \
	. "$FRIENDCHATAPP_FOLDER"
cd "$FRIENDCHAT_FOLDER"

# Copies example.local.config.js file to local.config.js
cp "$FRIENDCHATAPP_FOLDER/example.local.config.js" "$FRIENDCHATAPP_FOLDER/local.config.js"

# Pokes the new values in the local.config.js file
sed -i -- "s/friendcore_host/${friendCoreDomain//\//\\/}/g" "$FRIENDCHATAPP_FOLDER/local.config.js"

# Copy servers autostart
if [ ! -d "$FRIEND_BUILD/autostart" ]; then
    mkdir "$FRIEND_BUILD/autostart"
fi
cp "startfriendchat.sh" "$FRIEND_BUILD/autostart/startfriendchat.sh"
cp "startpresence.sh" "$FRIEND_BUILD/autostart/startpresence.sh"

# Creates or updates the build/cfg/cfg.ini file
echo "[DatabaseUser]" > "$FRIEND_BUILD/cfg/cfg.ini"
echo "login = $dbuser" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "password = $dbpass" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "host = $dbhost" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "dbname = $dbname" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "port = $dbport" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo " " >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "[FriendCore]" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "fchost = $friendCoreDomain" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "port = 6502" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "fcupload = storage/" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo " " >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "[Core]" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "port = 6502" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "SSLEnable = 1" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo " " >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "[FriendNetwork]" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "enabled = $friendNetwork" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo " " >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "[FriendChat]" >> "$FRIEND_BUILD/cfg/cfg.ini"
echo "enabled = 1" >> "$FRIEND_BUILD/cfg/cfg.ini"

# Saves setup.ini configuration file
echo "; Friend installation configuration file" > "$FRIEND_BUILD"/cfg/setup.ini
echo "; Please respect spaces if you edit this manually" >> "$FRIEND_BUILD"/cfg/setup.ini
echo " " >> "$FRIEND_BUILD"/cfg/setup.ini
echo "[FriendCore]" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbuser = $dbuser" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbhost = $dbhost" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbport = $dbport" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbname = $dbname" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbpass = $dbpass" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "domain = $friendCoreDomain" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "TLS = 1" >> "$FRIEND_BUILD"/cfg/setup.ini
echo " " >> "$FRIEND_BUILD"/cfg/setup.ini
echo "[TurnStun]" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "turn = $turnAddress" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "stun = $stunAddress" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "user = $turnUser" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "pass = $turnPass" >> "$FRIEND_BUILD"/cfg/setup.ini
echo " " >> "$FRIEND_BUILD"/cfg/setup.ini
echo "[FriendNetwork]" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "enable = $friendNetwork" >> "$FRIEND_BUILD"/cfg/setup.ini
echo " " >> "$FRIEND_BUILD"/cfg/setup.ini
echo "[FriendChat]" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "enable = 1" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbname = $helloDbName" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbhost = $helloDbHost" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbport = $helloDbPort" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbuser = $helloDbUser" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbpass = $helloDbPass" >> "$FRIEND_BUILD"/cfg/setup.ini
echo " " >> "$FRIEND_BUILD"/cfg/setup.ini
echo "[Presence]" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbname = $presenceDbName" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbhost = $presenceDbHost" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbport = $presenceDbPort" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbuser = $presenceDbUser" >> "$FRIEND_BUILD"/cfg/setup.ini
echo "dbpass = $presenceDbPass" >> "$FRIEND_BUILD"/cfg/setup.ini

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
