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

# Installs Dialog if needed
PATH_TO_DIALOG=$(which dialog)
if [ ! -x "${PATH_TO_DIALOG}" ]; then
	echo "dialog not found, it will be installed"
	sudo apt-get install dialog
fi

# Welcome
	dialog --backtitle "Friend Chat installer" --yesno "\
Welcome to the Friend Chat installer.\n\n\
Do you want to proceed with installation?" 10 55
if [ $? -eq "1" ]; then
	echo "$QUIT"
	exit 1
fi

# node.js
echo "Checking for node and npm"

nv=$(node -v)
npm=$(npm -v)

# node exists
if [ -z $nv ]; then
    dialog --backtitle "Friend Chat installer" --msgbox "\
Friend Chat server requires node.js.\n\n\
This installer will exit. Please install node.js,\n\
then restart this script.\n\
\n\
Note #1: A useful tool for managing node is 'n',\n\
instructions at: https://github.com/tj/n\n\
Note #2: If you intend to run the servers as\n\
system services, make sure node is available\n\
globably, not just for the user ( for 'n', use sudo )" 17 65
    echo "Friend Chat installation aborted."
    exit 1
fi

# node version
if [[ "$nv" =~ ^v1[0-9]\.* ]]; then
    echo "Found compatible node.js version: $nv"
else
    dialog --backtitle "Friend Chat installer" --msgbox "\
Incompatible node version found: $nv.\n\
Required version is 10.x or higher.\n\
\n\
This installer will exit. Please update node,\n\
then restart this script." 11 60
    echo "Friend Chat installation aborted."
    exit 1
fi

# npm exists
if [ -z "$npm" ]; then
	dialog --backtitle "Friend Chat installer" --msgbox "\
node was found, but not npm. This is usually bad,\n\
please fix your node.js installation \n\
" 10 70
	echo "Friend Chat installation aborted."
	exit 1
fi

# Asks for friendup directory
#FRIEND_FOLDER="/home/$USER/friendup"
FRIEND_FOLDER="/opt/friendos"
while true; do
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the path to the FriendUp directory." 11 60 "$FRIEND_FOLDER" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ $temp != "" ]; then
		FRIEND_FOLDER="$temp"
	fi

	# Verifies the directory
	if [ ! -f "$FRIEND_FOLDER/cfg/cfg.ini" ]; then
		dialog --backtitle "Friend Chat installer" --msgbox "\
Friend was not found in this directory,\n\
or Friend was not properly installed." 10 50
	else
		break;
	fi
done

# ask for git tmp folder
INSTALL_TMP="/home/$USER/install_tmp"
while true; do
	if [ -f "$INSTALL_TMP/install.ini" ]; then
		echo "Found tmp folder and install.ini, skipping tmp folder setup"
		break;
	fi
	
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
A temporary folder for clonig git repos will be used" 11 60 "$INSTALL_TMP" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ $temp != "" ]; then
		INSTALL_TMP="$temp"
	fi
	
	# creates directory if it does not exist
	if [ ! -d "$INSTALL_TMP" ]; then
		echo "creating tmp dir $INSTALL_TMP"
		mkdir "$INSTALL_TMP"
		if [ $? -ne 0 ]; then
			dialog --backtitle "Friend Chat installer" --msgbox "\
Could not create directory, please try again" 10 50
		else
			break;
		fi
	else
		break;
	fi
done

# setup relevant folders
FRIENDCHAT_FOLDER=$(pwd)
PRESENCE_GIT="$INSTALL_TMP/presence"
PRESENCE_FOLDER="$FRIEND_FOLDER/services/Presence"
FC_SERVER_FOLDER="$FRIEND_FOLDER/services/FriendChat"
FC_CLIENT_FOLDER="$FRIEND_FOLDER/resources/webclient/apps/FriendChat"
echo $INSTALL_TMP
echo $PRESENCE_GIT
echo $PRESENCE_FOLDER
echo $FC_SERVER_FOLDER
echo $FC_CLIENT_FOLDER

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
		echo "$QUIT"
		exit 1
	fi
fi

# FriendCore config file
FUP_CFG_FILE="$FRIEND_FOLDER/cfg/cfg.ini"

# setup files that might exist, created by previous runs of the friendup and/or friendchat installer
FUP_INI_FILE="$FRIEND_FOLDER/cfg/setup.ini"
FC_INI_FILE="$INSTALL_TMP/install.ini"

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

# remove qotation marks
dbhost=${dbhost%\"}
dbhost=${dbhost#\"}
friendCoreDomain=${friendCoreDomain%\"}
friendCoreDomain=${friendCoreDomain#\"}

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
	stunHost=$(sed -nr "/^\[Presence\]/ { :l /^stun_srv[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
	turnHost=$(sed -nr "/^\[Presence\]/ { :l /^turn_srv[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
	turnUser=$(sed -nr "/^\[Presence\]/ { :l /^turn_user[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
	turnPass=$(sed -nr "/^\[Presence\]/ { :l /^turn_pass[ ]*=/ { s/.*=[ ]*//; p; q;}; n; b l;}" $FC_INI_FILE)
else
	helloDbName="friendchat"
	helloDbHost="$dbhost"
	helloDbPort="$dbport"
	helloDbUser="friendchat"
	helloDbPass=""
	presenceDbName="presence"
	presenceDbHost="$dbhost"
	presenceDbPort="$dbport"
	presenceDbUser="presence"
	presenceDbPass=""
	stunHost="your_stun_server.com:xxxx"
	turnHost="your_turn_server.com:xxxx"
	turnUser="your_turn_username"
	turnPass="your_turn_password"
fi

# Checks if TLS keys are defined
NEWTLS="0"
SELFSIGNED="false"
if [ ! -f "$FRIEND_FOLDER/cfg/crt/key.pem" ]
then
	dialog --backtitle "Friend Chat installer" --msgbox "\
Friend Chat requires TLS/SSL to work.\n\n\
This script will now create them for you.\n\
Please answer the following questions..." 11 70

	# Call openssl to create the keys
	if [ ! -d "$FRIEND_FOLDER/cfg/crt" ]; then
		mkdir "$FRIEND_FOLDER/cfg/crt"
	fi
	echo "Calling openssl to create the keys."
	openssl req -newkey rsa:2048 -nodes -sha512 -x509 -days 3650 -nodes -out "$FRIEND_FOLDER/cfg/crt/certificate.pem" -keyout "$FRIEND_FOLDER/cfg/crt/key.pem"
	TLSNEW="1"
	SELFSIGNED="true"
else
	temp=$(openssl verify -CAfile "$FRIEND_FOLDER/cfg/crt/certificate.pem" -CApath "$FRIEND_FOLDER/cfg/crt/certificate.pem" "$FRIEND_FOLDER/cfg/crt/certificate.pem")
	if [ "$temp" == "$FRIEND_FOLDER/cfg/crt/certificate.pem: OK" ]; then
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
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		friendCoreDomain="$temp"
	fi
	
	# hello db
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Friend Chat server database.
Please enter the name of the Friend Chat database." 11 60 "$helloDbName" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		helloDbName="$temp"
	fi
	
	# hello db user
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Friend Chat server database.\n\n\
Please enter a mysql user name for the Friend Chat,\n\
server database. It can be an existing user name or,\n\
a new one but must be different from 'root'." 13 65 "$helloDbUser" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		helloDbUser="$temp"
	fi
	
	# hello db pass
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Friend Chat server database.\n\n\
Please enter the password\n\
for mysql user $helloDbUser:" 10 50 "$helloDbPass" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		helloDbPass="$temp"
	fi
	
	# presence db
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Presence server database.\n\n\
Please enter the name of the Presence database." 12 55 "$presenceDbName" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		presenceDbName="$temp"
	fi
	
	# presence db user
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Presence server database.\n\n\
Please enter a mysql user name for Presence,\n\
it can be an existing user name or a new one,\n\
but must be different from 'root'." 13 65 "$presenceDbUser" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		presenceDbUser="$temp"
	fi
	
	#presence db pass
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Presence server database.\n\n\
Please enter the password\n\
for mysql user $presenceDbUser:" 10 45 "$presenceDbPass" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		presenceDbPass="$temp"
	fi
	
	# turn server host:port
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the turn server domain:port" 10 50 "$turnHost" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		turnHost="$temp"
	fi
	
	# turn user
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the turn server username:" 10 50 "$turnUser" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		turnUser="$temp"
	fi
	
	# turn pass
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the turn server password:" 10 50 "$turnPass" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		turnPass="$temp"
	fi
	
	# stun host:port
	temp=$(dialog --backtitle "Friend Chat installer" --inputbox "\
Please enter the stun server domain:port" 10 50 "$stunHost" --output-fd 1)
	if [ $? = "1" ]; then
		echo "$QUIT"
		exit 1
	fi
	if [ "$temp" != "" ]; then
		stunHost="$temp"
	fi
	
	dialog --defaultno --backtitle "Friend Chat installer" --yesno "\
Using the following values for Friend Chat:\n\
\n\
Domain: $friendCoreDomain\n\
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

# SAVE THE THINGS
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
echo "turn_srv = $turnHost" >> $FC_INI_FILE
echo "turn_user = $turnUser" >> $FC_INI_FILE
echo "turn_pass = $turnPass" >> $FC_INI_FILE
echo "stun_srv = $stunHost" >> $FC_INI_FILE

echo "install.ini written"

# Asks for database root password
while true; do
    mysqlSudo=0
    mysqlRootPass=$(dialog\
    --backtitle "Friend Chat installer"\
    --passwordbox "Please enter mysql root password, or leave it empty to run with 'sudo'" 8 50\
    --output-fd 1)
    if [ $? = "1" ]
    then
        echo "$QUIT"
        exit 1
    fi
    # Checks mysql root password
    if [ -z "$mysqlRootPass" ]; then
        mysqlSudo=1
        break;
    else
        mysql -u root -p$mysqlRootPass -e ";"
        if [ $? == "0" ]; then
            break;
        fi
        dialog\
        --backtitle "Friend Chat installer"\
        --msgbox "Invalid mysql password, please try again." 8 55\
        --output-fd 1
    fi
done

mysqlAdminConnect="--host=$dbhost --port=$dbport --user=root"
if [ $mysqlSudo -eq 1 ]; then
    mysqlRootCall="sudo mysql"
else
    mysqlRootCall="mysql"
fi

echo "mysql root call: $mysqlRootCall"

# Evaluate return codes and abort script if not 0
# $1 - return code
# $2  - <string> description of thing
function check_return_value(){
	if [ $1 -eq 0 ]; then
		:
	else
		echo "Something failed, aborting: $2"
		exit 1
	fi
}

PRESENCE_NPM_ERROR=0
HELLO_NPM_ERROR=0

# INSTALLATION OF THE PRESENCE SERVER
# -----------------------------------

# close or update from git
if [ ! -d "$PRESENCE_GIT" ]
then
	echo "Cloning Presence server from GIT"
	cd $INSTALL_TMP
	git clone $P_GIT
	check_return_value $? "presence git clone"
else
	cd $PRESENCE_GIT
	git pull
	check_return_value $? "presence git pull"
fi

# Copies files into Friend build directory
if [ ! -d "$PRESENCE_FOLDER" ]; then
	mkdir "$PRESENCE_FOLDER"
fi

cd $PRESENCE_GIT
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update.sh' \
	--exclude '/install.sh' \
	. "$PRESENCE_FOLDER"

cd $PRESENCE_FOLDER

# setup
if [ ! -e $PRESENCE_CFG_FILE ]
then
	# Copies example.config.js file to config.js
	cp "$PRESENCE_FOLDER/example.config.js" $PRESENCE_CFG_FILE
	check_return_value $? "presence copy config file"

	# Pokes the new values in the presence/config.js file
	sed -i -- "s/presence_database_host/${presenceDbHost//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/3306/${presenceDbPort//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/presence_database_user/${presenceDbUser//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/presence_database_password/${presenceDbPass//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/presence_database_name/${presenceDbName//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/presence_domain/${friendCoreDomain//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/path_to_key.pem/${FRIEND_FOLDER//\//\\/}\/cfg\/crt\/key.pem/g" $PRESENCE_CFG_FILE
	sed -i -- "s/path_to_cert.pem/${FRIEND_FOLDER//\//\\/}\/cfg\/crt\/certificate.pem/g" $PRESENCE_CFG_FILE
	sed -i -- "s/friendcore_domain/${friendCoreDomain//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/stun_url.com/${stunHost//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/turn_url.com/${turnHost//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/turn_username/${turnUser//\//\\/}/g" $PRESENCE_CFG_FILE
	sed -i -- "s/turn_password/${turnPass//\//\\/}/g" $PRESENCE_CFG_FILE
fi

export MYSQL_PWD=$mysqlRootPass
# Connection strings
mysqlconnect="--host=$dbhost --port=$dbport --user=$presenceDbUser"
mysqlconnectdb=$mysqlconnect" --database=$presenceDbName"

# Checks if user is already present or not
userExists=$($mysqlRootCall $mysqlAdminConnect \
	--execute="SELECT mu.User FROM mysql.user AS mu WHERE mu.User='$presenceDbUser'")
	
check_return_value $? "presence user check"

if [ "$userExists" == "" ]; then
	echo "Setting up user: $presenceDbUser"
	# Creates user
	$mysqlRootCall $mysqlAdminConnect \
		--execute="CREATE USER $presenceDbUser@$dbhost IDENTIFIED BY '$presenceDbPass';"
else
	echo "User $presenceDbUser already exists, skipping"
fi

# Checks if database is already created
dbpresent=$($mysqlRootCall $mysqlAdminConnect \
	--execute="SHOW DATABASES LIKE '$presenceDbName'")
if [[ $dbpresent == *"$presenceDbName"* ]]; then
	echo "Database $presenceDbName was found, skipping"
	# Grants access to db in case user did not exist
	$mysqlRootCall $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $presenceDbName.* TO $presenceDbUser@$dbhost;"
	# apply privileges
	$mysqlRootCall $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
else
	# Creates database
	echo "Creating database: $presenceDbName"
	$mysqlRootCall $mysqlAdminConnect \
		--execute="CREATE DATABASE $presenceDbName"
	# Grants access to db
	$mysqlRootCall $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $presenceDbName.* TO $presenceDbUser@$dbhost;"
	# apply privileges
	$mysqlRootCall $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
	# Switch to user
	export MYSQL_PWD=$presenceDbPass
	# Creates tables
	echo "Creating tables"
	mysql $mysqlconnectdb \
		--execute="SOURCE $PRESENCE_FOLDER/db/tables.sql"
		
	check_return_value $? "presence create tables"
fi
sleep 1

# Deletes dangerous variable
export MYSQL_PWD=''

# Initialize node module
cd "$PRESENCE_FOLDER"
npm install
if [ $? -ne 0 ]; then
	PRESENCE_NPM_ERROR=1
fi

# INSTALLATION OF FRIEND CHAT SERVER
# ----------------------------------

# Copies files into Friend build directory
if [ ! -d "$FC_SERVER_FOLDER" ]; then
	mkdir "$FC_SERVER_FOLDER"
fi

cd "$FRIENDCHAT_FOLDER/server"
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update.sh' \
	. "$FC_SERVER_FOLDER"

if [ ! -e $FC_CFG_FILE ]
then
    # Copies example.config.js file to config.js
    cp "$FC_SERVER_FOLDER/example.config.js" $FC_CFG_FILE
    check_return_value $? "friendchat server copy config file"

    # Pokes the new values in the freidncaht config.js file
    sed -i -- "s/dev : false/dev : $SELFSIGNED/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_host/${dbhost//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/3306/${dbport//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_user/${helloDbUser//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_password/${helloDbPass//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/hello_database_name/${helloDbName//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/path_to_key.pem/${FRIEND_FOLDER//\//\\/}\/cfg\/crt\/key.pem/g" $FC_CFG_FILE
    sed -i -- "s/path_to_cert.pem/${FRIEND_FOLDER//\//\\/}\/cfg\/crt\/certificate.pem/g" $FC_CFG_FILE
    sed -i -- "s/friendcore_host/${friendCoreDomain//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/presence_domain/${friendCoreDomain//\//\\/}/g" $FC_CFG_FILE
    sed -i -- "s/Do not edit this file/This file can be edited/g" $FC_CFG_FILE
fi

# Temporary store the password in system variable to avoid warnings
export MYSQL_PWD=$mysqlRootPass
# Set database connexion variables
#mysqlAdminConnect="--host=$dbhost --port=$dbport --user=root"
mysqlconnect="--host=$dbhost --port=$dbport --user=$helloDbUser"
mysqlconnectdb=$mysqlconnect" --database=$helloDbName"

# Checks if user is already present or not, and creates it eventually
userExists=$($mysqlRootCall $mysqlAdminConnect \
	--execute="SELECT mu.User FROM mysql.user AS mu WHERE mu.User='$helloDbUser'")
	
check_return_value $? "friendchat db user check"

if [ "$userExists" == "" ]; then
	echo "Setting up user: $helloDbUser"
	# Creates user
	$mysqlRootCall $mysqlAdminConnect \
		--execute="CREATE USER $helloDbUser@$dbhost IDENTIFIED BY '$helloDbPass';"
else
	echo "User $helloDbUser already exists, skipping"
fi

# Checks for database existence and creates it if not present
dbpresent=$($mysqlRootCall $mysqlAdminConnect \
	--execute="SHOW DATABASES LIKE '$helloDbName'")
if [[ $dbpresent == *"$helloDbName"* ]]; then
	echo "Database $helloDbName was found, skipping"
	# Grants access to db in case user did not exist
	$mysqlRootCall $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $helloDbName.* TO $helloDbUser@$dbhost;"
	# apply privileges
	$mysqlRootCall $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
else
	# Creates database
	echo "Creating database: $helloDbName"
	$mysqlRootCall $mysqlAdminConnect \
		--execute="CREATE DATABASE $helloDbName"
	# Grants access to db
	$mysqlRootCall $mysqlAdminConnect \
		--execute="GRANT ALL PRIVILEGES ON $helloDbName.* TO $helloDbUser@$dbhost;"
	# apply privileges
	$mysqlRootCall $mysqlAdminConnect \
		--execute="FLUSH PRIVILEGES;"
	# Switch to user
	export MYSQL_PWD=$helloDbPass
	# Creates tables
	echo "Creating tables"
	mysql $mysqlconnectdb \
		--execute="SOURCE $FC_SERVER_FOLDER/scripts/sql/tables.sql"
	
	
	check_return_value $? "friendchat create tables"
fi
sleep 1

# Removes dangerous variable
export MYSQL_PWD=''

# Initialize node module
cd "$FC_SERVER_FOLDER"
npm install
if [ $? -ne 0 ]; then
	HELLO_NPM_ERROR=1
fi

# Installation of the Friend Chat application
# ---------------------------------------------

# Copies files into Friend build directory
if [ ! -d "$FC_CLIENT_FOLDER" ]; then
	mkdir "$FC_CLIENT_FOLDER"
fi

cd "$FRIENDCHAT_FOLDER/client"
rsync -ravl \
	--exclude '/.git*' \
	--exclude '/update_to_fup.sh' \
	. "$FC_CLIENT_FOLDER"

if [ ! -e "$FC_CLIENT_FOLDER/local.config.js" ]
then
	# Copies example.local.config.js file to local.config.js
	cp "$FC_CLIENT_FOLDER/example.local.config.js" "$FC_CLIENT_FOLDER/local.config.js"
	check_return_value $? "friendchat client copy config file"

	# Pokes the new values in the local.config.js file
	sed -i -- "s/friendcore_host/${friendCoreDomain//\//\\/}/g" "$FC_CLIENT_FOLDER/local.config.js"
fi

# SYSTEMD
#--------
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
	echo "Description=${DESCRIPTION}" >> $TMP
	echo 'After=network.target' >> $TMP
	
	echo '[Service]' >> $TMP
	echo 'Type=simple' >> $TMP
	echo "User=${USER}" >> $TMP
	echo "WorkingDirectory=${WORKDIR}" >> $TMP
	echo "ExecStart=${EXE}" >> $TMP
	echo 'Restart=always' >> $TMP
	echo 'RestartSec=3' >> $TMP
	
	echo '[Install]' >> $TMP
	echo 'WantedBy=multi-user.target' >> $TMP
	
	echo "Superuser password is required to copy $TMP to /etc/systemd/system and enable the service"
	sudo cp $TMP /etc/systemd/system/
	sudo systemctl enable ${NAME}
	
	echo 'Service is installed and enabled'
	echo "Use standard systemd commands to control the service:"
	echo "systemctl start ${NAME}"
	echo "systemctl stop ${NAME}"
	echo "systemctl restart ${NAME}"
}

USE_SYSD="0"
dialog --backtitle "Friend Chat installer" --yesno "\
Do you wish to set up systemd to run FriendChat and Presence servers as system services?\n
This requires superuser access on your system" 10 50
HELLO_EXE=$FRIEND_FOLDER/services/FriendChat/hello.js
PRES_EXE=$FRIEND_FOLDER/services/Presence/presence.js
sudo chmod u+x $HELLO_EXE
sudo chmod u+x $PRES_EXE

if [ $? -eq "0" ]; then
	USE_SYSD="1"
	install_systemd_service "${HELLO_EXE}" "friendchat-server" "FriendChat server"
	install_systemd_service "${PRES_EXE}" "presence-server" "Presence server"
else
	echo "systemd setup declined"
fi

# Enable Friend Chat in Friend
FUP_CFG_PATH="$FRIEND_FOLDER/cfg/cfg.ini"
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

# done
if [ "$TLSNEW" == "1" ]; then
	dialog --backtitle "Friend Chat installer" --msgbox "\
Warning : FriendCore MUST have TLS/SSL enabled, set it in FriendCore config:\n\
[Core]\n\
SSLEnable = 1\n\n\

Make sure to access Friend on a secure connection( https ):\n\
https://$friendCoreDomain:6502" 12 60
fi

COMPLETE_MSG=""
if [ "$USE_SYSD" == "1" ]; then
	COMPLETE_MSG="\
To start the servers use:\n\
sudo systemctl start friendchat-server\n\
sudo systemctl start presence-server\n\
\n\
To start automatically at boot:\n\
sudo systemctl enable friendchat-server\n\
sudo systemctl enable presence-server"
else
	COMPLETE_MSG="\
To start the servers:\n\
FriendChat : $FC_SERVER_FOLDER\n\
> node hello.js\n\
Presence : $PRESENCE_FOLDER\n\
> node presence.js\n\
\n\
or start them with the provided respawn script that also\n\
write to 'error.log' and 'restart.log' in each respective folder:\n\
> nohup sh phoenix_hello.sh &\n\
> nohup sh phoenix_presence.sh &\n"
fi

dialog --backtitle "Friend Chat installer" --msgbox "\
Installation complete!\n\n\
$COMPLETE_MSG\n\n\
You can now remove $INSTALL_TMP" 20 70

echo "You can now remove $PRESENCE_GIT"
exit 0
