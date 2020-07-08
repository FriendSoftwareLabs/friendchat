# Live

## Protocol

All events are detailed in the 'Events' section

### ping/pong
Presence server will send `'ping'` events to check if the clients live session is alive.
```
{
	type : 'ping',
	data : <string/timestamp>
}
```

The timestamp must be returned in a `'pong'` event:
```
{
	type : 'pong',
	data : <string/timestamp>
}
```

### setup

First, a 'initialize' event is received. This event carries the data required for initial setup:
```
{
	type : 'initialize',
	data : <config object>
}
```

The config has a list of peers, start listening for events for each one. Events for the peer will
have its `type` set to the `peerId`. To send events to a remote peer, set the `type` of the event
to the `peerId`.

__Each pair__ of peers will be in a host-client relationship, and this is decided with a sequence 
of synchronization events:
1. Set a current timestamp and store it.
2. In a 2s interval, send a `'sync'` event, with `data` set to the selected timestamp:
```
{
	type : 'sync',
	data : <timestamp>
}
```
3. Receive `'sync'` events from remote peer. Compare timestamp received with the local timestamp.
If they are the same, pick a short but random timeout and restart the process.
If the local timestamp is the lower number, set self as host
If the remote timestamp is the lower number, remote will function as host
4. Stop sending `'sync'` events. Send a `'sync-accept'` event to confirm timestamps:
```
{
	type : 'sync-accept',
	data : [
		<local timestamp>,
		<remote timestamp>
	],
}
```
5. If the local side was __not__ chosen as host, send an `'open'` event to the host.
6. Host receives `'open'` event and replies with a `'meta'` event. The meta event holds state
and send/receive permissions for that side of the pair.
```
{
	type : 'meta',
	data : <meta object>
}
```
7. Client receives `'meta'` event from host and sends its own `'meta'` event to the host.

### webRTC setup

Both sides must now create their webRTC session and add their local audio/video streams to it.
The sessions will begin its own setup. This requires sending multiple events to the 
remote peer. Events from webRTC must must be of type `'webrtc-stream'` if its a normal
peer-to-peer connection. It is then addressed to the peer by wrapping it:
```
{
	type : <peerId>,
	data : {
		type : 'webrtc-stream',
		data : <webrtc event>
	}
}
```

The webRTC events sent/reveived at this point are:
1. `'negotiate'` events for deciding who sends SDP.
2. `'candidate'` for ICE candidates, with a `null`
event to indicate end of candidates.
3. `'sdp'` for exchangeing SDP.

#### negotiate

If both sides create a SDP offer, they can end in a deadlock where they expect a SDP answer
they will not get. But the client must be able to renegotiate its SDP if something changes.
To solve this the client side can `'request'` negotiation, and the host side will either
`'accept'` or `'deny'` this.
```
{
	type : 'negotiate',
	data : 'request' | 'accept' | 'deny'
}

```

For client side:
Before creating a SDP offer, first send a `'request'` to the host. The host will answer with
`'accept'` if its okay. If the answer is `'deny`, the client must wait a few seconds and try again
if it still needs to change its SDP. This need might have gone away if the host renegotiated SDP
from its side during the timeout.
1. negotiation is needed
2. send `'reqeust'`
3.a response is `'deny'`. Waiting a few seconds before going back to step 2
3.b response is `'accept'`. Create offer SDP and send it

For host side:
If host receives a `'request'` it must check its own state to see if it should answer with
`'accept'` or `'deny'`. Host should not send `'accept'` if its webRTC signaling state is
not `'stable'` or is in a SDP offer/answer process. If the host sends `'accept`, it must
for a short while afterwards __not__ create its own SDP offer.

#### ICE candidates

ICE candidates are the connection interfaces that peer has available, like a internet public IP,
LAN IP or TURN. STUN is used for the peer to discover its own public IP(s). Candidates should be
sent to the other peer when available. After the last candidate has been sent, a `null` candidate
should be sent.
```
{
	type : 'canidate',
	data : <canidate string>,
}
```

#### SDP

The SDP represents all the information the peers need to agree on to set up a direct connection 
to the other peer. After audio/video tracks are added to, or removed from the webRTC session, it
needs to be renegotiated. One peer will create an offer, pass it to the other peer which creates
an answer and passes it back.
```
{
	type : 'sdp',
	data : <SDP object>, 
}
```

The SDP object should have a obj.type of either `'offer'` or `'answer'` set by 
the webRTC session object.

1. Both peers create a webRTC session
2. Both peers add their local audio/video tracks to the session
3. Both webRTC sessions will now be in a state of needing negotiation.
4. __Only one__ peer creates an offer SDP. The host side should do this. If the host is slow, the
client side might have time to send a `'negotiation, request'`. As long as this is handled 
according to protocol, its not a problem
5. The SDP offer is send to the other peer
6. The peer that now received the SDP offer adds it to its webRTC session and creates an
SDP answer.
7. The SDP answer is sent back to the first peer.
8. Receiveing the answer, the first peer adds it to its webRTC session

When SDP is accepted, the webRTC sessions produce audio/video tracks sent by the 
remote peer, to be shown to the user.

### normal operation

#### join
If someone joins the session, a `'join'` event will be received from presence.
```
{
	type : 'join',
	data : {
		peerId   : <peerId>,
		identity : <id object>
	}
}
```

#### leave
If someone leaves the session, a `'leave'` event be recevieved from presence.
```
{
	type : 'leave',
	data : peerId,
}
```

### ending call
When ending the call, send a `'close'` event to the app. The app will tell the server, and 
the server will tell all participants.
```
{
	type : 'close'
}
```

## Native

If .friendApp property is defined in the initial config FriendChat receives on startup it will
switch from starting live in an a workspace view to letting the native app take over. This means
redirecting events to be sent and received over the friendApp interface.

### FriendChat to Native app

First the event is sent to workspace, packed in a 'native-app' event:
```
{
	type   : 'native-app',
	viewId : <uuid string>,
	data   : <event object>
}
```

Workspace apiwrapper handles this event and passes on viewId and data. Data is stringified.
```
friendApp.receiveLive( viewId, jsonString )
```

### Native app to FriendChat

Frist the app sends the event to workspace as a json string, by calling:
```
Workspace.receiveLive( viewId, jsonString )
```

Worspace passes this on to FriendChat as a view event after parsing the json string:
```
{
	type   : 'native-view',
	viewId : <uuid string>,
	data   : <event object>
}
```

### Native view setup

Setup sequence is slightly different from a Workspace view. The native app view
immediatly receives a viewId and 'initialize' event on friendApp.receiveLive, with 
the configuration object:
Init:
```
{
	type : 'initialize',
	data : <live config object>
}
```
This config object does not have the 'liveFragments' property.

The native app is then expected to reply with a 'ready' event:
```
{
	type : 'ready'
}
```

After FriendChat has received the 'ready' event, standard protocol resumes.

## Events

### Initial Config object
With the `'initialize'` event, a config object is received. This holds all the data required
for inital setup:
```
{
	liveFragments : <lots of html for bulding the UI>
	emojiis       : {},
	liveConf      : {
		guestAvatar   : <image/png as base64 string>,
		identities    : <map of peerId:identityObject>, // name, avatar etc of participants
		isGuest       : <bool>, // this is a guest connection
		isPrivate     : <bool>, // is this a private room ( user to user chat )
		isTempRoom    : <bool>, // is this room persisted to db
		localSettings : <object> // client side settings, like prefered camera
		logTail       : <array>, // array of latest messages in the room
		peerList      : <array>, // list of peerIds of the current participants
		roomName      : <string>,
		rtcConf       : <object>, // conf for setting up signaling, webRTC and things
		userId        : <string> // your own peerId
	}
}
```

#### identity
An identity holds info about an entity. This is usually a user, but can also be a room or workgroup
Here is an example user id with the most relevant fields:
```
{
	clientId : <uuid string>,
	name     : <string>,
	avatar   : <image/png as base64 string>,
	isAdmin  : <bool> // friendup system admin
	isOnline : <bool> // user login status
}
```

#### localSettings
These settings are specific to this device and are stored in the client.
```
{
	preferedDevices     : {
		audioinput  : <object>,
		audiooutput : <object>,
		videoinput  : <object>
	},
	streamUserListState : <string>,
	ui-user-stuff       : <bool>,
	ui-visible          : <bool>,
}
```

#### rtcConf
This object holds various config and live state things
```
{
	isRecording : <bool>, // is the stream recorded server side
	mode        : <object>, // if the live session is in a special mode, this is set. Null otherwise
	permissions : {
		send      : { // this client will send these tracks
			audio   : <bool>,
			video   : <bool>
		},
		recevie   : { // this client wants to receive these tracks from peers
			audio   : <bool>,
			video   : <bool>
		},
	},
	quality     : <object>, // meta info for video quality, specific WxH and framerate is defined in the client
	speaking    : {
		current : <peerId>, OR null
		last    : <peerId> // always defined
	},
	topology    : <string 'peer' | 'star' | 'stream'> // usually 'peer',
}
```

### meta
This event holds state and send/receive expectations for that side of the pair.
```
{
	browser : <string>, // 'chrome', 'firefox', etc
	sending : { // this client will have these tracks available to send
		audio : <bool>,
		video : <bool>
	},
	receive : { // this client wants to receive these tracks
		audio : <bool>,
		video : <bool>
	},
	state : {
		isMuted         : <bool>, // this clients audio track is muted
		isBlinded       : <bool>, // this clients video track is blank
		screenMode      : <string, 'contain' | 'cover' >,
		screenShare     : <bool>, // this client is sharing the screen
		useDefaultCodec : <bool>, // this client must use the default webRTC codec, VP8
	}
}
```