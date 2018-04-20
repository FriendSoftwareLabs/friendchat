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
using this link will join as a guest with either a randomly generated name or 
one they choose themselves.

#### Share your screen or app

Screen sharing is available for chrome through an extension. The option 
is found in the live view menu, and will either prompt you install the 
extension or offer to initiate screen sharing.

## Modules

Modules are integrations towards 3rd party chat services. They have a server part 
that communicates  with the remote service/server API and a client part with a custom
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
modules. More info in the FriendSoftwareLabs/presence repository!

#### Treeroot

The Treeroot module integrates the chat part of the Treeroot system. It provides
one to one chat, optionally end to end encrypted. You'll need to add the module
( 'add chat account' in the menu ) then log in with ( or create a new ) Treeroot 
account.