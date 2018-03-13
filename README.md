# Friend Chat

Friend Chat is a chat integration platform for Friend. It is built to make
it fairly straightforward to add access to 3rd party chat APIs. It is a
client - server architecture where the server handles the connection to the
remote API and presents the content to the client. Multiple clients can
be connected per account, all staying in sync. Accounts are created and
logged in through Friend, no extra setup required.

## Video / Audio Conferencing, aka Live

Friend Chat allows peer to peer video and audio calls over webRTC, supported 
by the presence service. The limits to number of participants is 
practical; the bandwidth and power of your device.

#### Invites

Live invites can be sent through any module. It is sent as a data string, 
and as long as the invitee is also using Friend Chat, it will be intercepted
and presented to the user. The live session is then established over the 
presence service.

#### Guests

Any live session can be shared through a clickable link. This is a public invite
and can be used by any number of people until it is explicitly canceled. People 
using this link will join as a guest with a randomly generated name.

#### Share your screen or app

Screen-sharing is available for chrome through an extension. The option 
is found in the live view menu, and will either prompt you install the 
extension or offer to initiate screen sharing.

## Modules

Modules allow integration with 3rd party chat services. They have a server part 
that communicates  with the remote service/server and a client part with a custom
UI that presents the data. Current modules are IRC, Presence and Treeroot. Presence 
is always there and IRC is added by default.

#### IRC

Internet Relay Chat, because it would be weird not to have it. Covers 
most basic needs and commands. An abbreviated list of commands if you are new to IRC:
* /nick new_nick - change your nick
* /action does something silly - *me does something silly*
* /join #channel_name - join a channel
* /part - in channel, leave the channel

This can also be changed in settings. More commands and how irc works in general 
can be found on the internet.

#### Presence

Presence provides temporary or persistent many-to-many rooms for chatting and 
video / audio conferencing. Invites to presence rooms can be sent through the other 
modules. More info in the [FriendSoftwareLabs/presence](https://github.com/FriendSoftwareLabs/presence) repository!

#### Treeroot

The Treeroot module integrates the chat part of the Treeroot system. It provides
one to one chat, optionally end to end encrypted. You'll need to add the module
( 'add chat account' in the menu ) then log in with ( or create a new ) Treeroot 
account.

## Setup

#### Requirements

* A properly installed Friend Core server, running with TLS encryption. If your
current Friend Core is not using TLS encryption, the installation script will
offer you the option to create self-signed keys and will do the correct
modifications in Friend Core configuration files.
Please note that self-signed keys will generate warning messages from your
browser, and the only way (starting from Chrome v57) to avoid these warnings
is to have the keys certified by an external party.
* A domain name for both Friend Core and Friend Chat servers. If you are running
things localy, defining it in etc/hosts and pointing to localhost or a 
virtual machine will be fine. For example :
'127.0.0.1   test.localfriend'.
Enter this very domain name when the installation script asks for it. The
script will update Friend Core accordingly and configure Friend Chat.
In order for Friend Chat to work within the Friend Workspace, you must
connect to your machine using the domain name you entered during installation.
For example, connecting to your Friend machine with
https://localhost:6502 and having the Friend Chat domain as 'test.localfriend'
will not work, even if 'test.localfriend' points to 127.0.0.1...
* Ports used by the server components are 3000 ( https GET ), 3001 ( https/wss ),
27960 ( TCP with TLS ), 27970 ( https/wss ). Except for 27960, which is a 
FriendChat-Presence servers connection, these ports need to be open or proxied for
 a working setup.
* STUN/TURN: while setting up the STUN/TURN servers(s) is not part of this installation,
they are vital to a working live chats/conference setup. Public STUN servers 
are out there ( google it, also google has one ), but TURN servers are far more 
resource intensive and you will likely have to set up your own. Ports used for these
are usually UPD 3478, 5349 and they set up p2p connections in the UDP 40k-65k range.
* mysql - which should be already installed for Friend Core. Friend Chat and
Presence servers need their own database. The installation script will create
them for you.
* node.js will be installed by the installation script if not found.
* Presence server - will be automatically cloned from GIT and installed by the
installation script directly in Friend build folder.

#### How to install Friend Chat?

Go to the directory where you cloned Friend Chat from GIT.
Run './install.sh' and answer the questions.
The installation script will gather as much data from the Friend Core
installation as it can, and will show as many pre-filled value as it can.
You can restart this script at any time, after pulling changes from GIT
for example.

#### Launching Friend Chat and Presence servers

The installation script automatically adds systemd service files.

To start:

* `sudo systemctl start friendchat-server`
* `sudo systemctl start presence-server`

To enable automatic start:

* `sudo systemctl enable friendchat-server`
* `sudo systemctl enable presence-server`

To view logs in case of problems:
* `sudo journalctl -fu friendchat-server`
* `sudo journalctl -fu presence-server`

#### Accessing Friend Chat application from the Workspace

After installing Friend Chat and its servers, and restarting Friend Core (`sudo systemctl restart friendcore`),
you will have to install the Friend Chat application in your Friend
machine. In the Workspace menu, choose the 'Tools / Software' option,
locate Friend Chat in the list and click install. You will then find the
Friend Chat icon in the 'System:Software/Internet' folder.
The Friend Chat client has been localized in English and French.

Friend Chat depends on the user existing in Friend and calls Friend Core to
authenticate them when they log in.

Upon launch, Friend Chat automatically opens the Friend IRC chat room where
you can meet the team behind Friend and many other developers. Feel free to ask
any question you have in mind, or ask for advice on how to resolve eventual
problems.

## Developers

If you intent to work on the source code of the Friend Chat client application,
the Friend Chat server or the Presence server, please read the following.

#### Friend Chat client

You will find the sourcecode of the Friend Chat client application in the
'client' folder of the friendchat directory.
To test your modifications, run the `update.sh` script : it will copy the
modified files in the Friend build/resources/webclient/apps/FriendChat directory.
Please note that after updating the files, in order for the new files to be
used by Friend Core, you will have to clear the cache by using the
Workspace menu option 'System / Clear cache'.
Another alternative is to stop Friend Core, update the files, and restart
Friend Core.

#### Friend Chat server

You will find the sourcecode of the Friend Chat server in the 'server' folder
of the friendchat directory.
As for the client, you will need to run the `update.sh` script to copy the
modified files in the Friend build/services/FriendChat folder.
`update.sh` also calls `npm install` automatically
to update the node.js modules used by the Friend Chat server : if you copy
the files manually, do not forget to do a `npm install` afterward.
The server will be automatically stopped and restarted by the script.


#### Presence server

The Friend Chat installation script clones the Presence server directly into
the Friend build/services/Presence directory. If you intent to work on it,
we suggest that you clone the server in another more accessible directory.
The Presence server [can be found on Github](https://github.com/FriendSoftwareLabs/presence).
You can update the files by using its own `update.sh` script,
which will copy the modifications to their proper location and run
`npm install` automatically. The server will be automatically stopped and restarted by the script.

## Branches

* Create a new branch for each feature or patch.
* Only finished features or patches will be merged with master.
* All commits to master must be reviewed by atleast one person ( Espen )
* Squash commit log on merge to master. Make the merge commit descriptive.
* Dev is for fooling around / testing. It will be updated from master.

The purpose here is to keep master git log as a useful history, for things 
like writing patch notes and checking up on what was added when by who.

#### Version, x.y.z

* x is incremented when the team feels like it.
* y is incremented when a feature is merged into master.
* z is incremented when a patch is merged into master.

## License

FriendChat is licenced under AGPL3
