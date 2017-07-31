# FriendChat

FriendChat is a chat integration platform for Friend. It is built to make 
it fairly straightforward to add access to 3rd party chat APIs. It is a
client - server architecture where the server handles the connection to the
remote API and presents the content to the client. Multiple clients can
be connected per account, all staying in sync. Accounts are created and
logged in through Friend, no extra setup required.

### Video / Audio Conferencing, aka Live

FriendChat allows p2p video and audio calls over webRTC, supported by the presence 
service. The limit to number of participants is practical; the bandwidth and 
power of your device.

#### Invites

Live invites can be sent through any module. It is sent as a string, 
and as long as the invitee is also using FriendChat, it will be intercepted 
and presented to the user. The live session is then established over the 
presence service.

#### Guests

Any live session can be shared through a clickable link. This is a public invite 
and can be used by any number of people until it is explicitly canceled. People 
using this link will join as a guest with a randomly generated name.

### Modules

Modules are integrations towards 3rd party chat services. They have a server part 
that communicates  with the remote service/server and a client part with a custom
UI that presents the data. Current modules are IRC, Presence and Treeroot. Presence 
is always there and IRC is added by default.

#### IRC

Internet Relay Chat, because it would be weird not to have it. Covers 
most basic needs and commands. An abbrevated list of commands if you are new to IRC:
* /nick new_nick - change your nick
* /action something silly - do something silly
* /join #channel_name - join a channel
* /part - in channel, leave the channel

Except for the sillyness, this can also be found in settings.

#### Presence

Presence provides temporary or persistent many-to-many rooms for chatting and 
video / audio conferencing. Invites to presence rooms can be sent through the other 
modules. More info in the FriendSoftwareLabs/presence repository!

#### Treeroot

The Treeroot module integrates the chat part of the Treeroot system. It provides
one to one chat, optionaly end to end encrypted. You'll need to add the module 
( 'add chat account' in the menu ) then log in with ( or create a new ) Treeroot 
account.

## Setup

Requirements
* FriendCore
* node.js
* mysql
* presence server

FriendChat depends on the user existing in Friend and calls FriendCore to
authenticate them when they log in.

### Client



### Server


## License

FriendChat is licenced under AGPL3