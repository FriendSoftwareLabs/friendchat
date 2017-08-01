/*©agpl*************************************************************************
*                                                                              *
* This file is part of FRIEND UNIFYING PLATFORM.                               *
*                                                                              *
* This program is free software: you can redistribute it and/or modify         *
* it under the terms of the GNU Affero General Public License as published by  *
* the Free Software Foundation, either version 3 of the License, or            *
* (at your option) any later version.                                          *
*                                                                              *
* This program is distributed in the hope that it will be useful,              *
* but WITHOUT ANY WARRANTY; without even the implied warranty of               *
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the                 *
* GNU Affero General Public License for more details.                          *
*                                                                              *
* You should have received a copy of the GNU Affero General Public License     *
* along with this program.  If not, see <http://www.gnu.org/licenses/>.        *
*                                                                              *
*****************************************************************************©*/

'use strict';
var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.contact = library.contact || {};

// Contact basemodel
(function( ns, undefined ) {
	ns.Contact = function( conf ) {
		if( !( this instanceof ns.Contact ))
			return new ns.Contact( conf );
		
		var self = this;
		
		self.moduleId = conf.moduleId;
		self.parentPath = conf.parentPath || '';
		self.clientId = self.data.clientId;
		self.displayName = self.data.displayName || self.data.name;
		self.conn = null;
		self.view = null;
		self.chat = null;
		self.live = null;
		self.messageMap = {};
		self.chatCrypts = {};
		self.encryptMessages = false;
		
		self.contactInit( conf.parentView );
	}
	
	ns.Contact.prototype.contactInit = function( parentView ) {
		var self = this;
		
		self.interceptTypes = {
			'live-invite'    : Application.i18n( 'i18n_live_invite' ),
			'calendar-event' : Application.i18n( 'i18n_calendar_event' ),
		};
		
		self.interceptMap = {
			'live-invite'    : startLive,
			'calendar-event' : addCalendarEvent,
		};
		
		function startLive( event, from ) { self.startLive( event, from ); }
		function addCalendarEvent( event, from ) { self.addCalendarEvent( event, from ); }
		
		self.messageMap = {
			'log' : log,
			'message' : message,
			'notification' : notification,
			'viewtheme' : updateViewTheme,
		};
		
		function log( msg ) { self.handleLog( msg ); }
		function message( msg ) { self.doMessageIntercept( msg ); }
		function notification( msg ) { self.handleNotification( msg ); }
		function updateViewTheme( msg ) { self.updateViewTheme( msg ); }
		
		self.conn = new library.system.Message({
			id : self.clientId,
			parent : self.moduleId,
			handler : receiveMsg,
		});
		function receiveMsg( msg ) { self.receiveMsg( msg ); }
		
		self.view = new library.component.SubView({
			parent : parentView,
			type : self.clientId,
		});
		
		self.setIdentity(); // must be implemented by every extension, see reference
	}
	
	// Reference only
	ns.Contact.prototype.setIdentity = function() {
		var self = this;
		self.identity = {
			clientId : null,
			name : null,
			avatar : null,
		};
	}
	
	ns.Contact.prototype.receiveMsg = function( msg ) {
		var self = this;
		var handler = self.messageMap[ msg.type ];
		if( !handler ) {
			console.log( 'unknown message type', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Contact.prototype.doMessageIntercept = function( data ) {
		var self = this;
		var intercept = self.checkIntercept( data.message );
		var didIntercept = false;
		if ( intercept ) {
			didIntercept = self.handleIntercept( data, intercept );
		}
		
		if ( didIntercept )
			return;
		
		self.onChatMessage( data );
		self.chatMessage( data );
	}
	
	ns.Contact.prototype.onChatMessage = function( msg ) {
		var self = this;
		if ( !self.chatView ) {
			self.whenChatClosed( msg );
			return;
		} else
			self.whenChatOpen( msg );
	}
	
	ns.Contact.prototype.whenChatClosed = function( msg ) {
		var self = this;
		if ( hello.account.settings.popupChat === true ) {
			api.Say( 'Message received' );
			self.startChat(); // contact must implement
			return;
		}
		
		if ( !msg.from )
			return;
		
		hello.playMsgAlert();
		self.messageWaiting( true );
	}
	
	ns.Contact.prototype.whenChatOpen = function( msg ) {
		var self = this;
		if ( !msg.from )
			return;
		
		hello.playMsgAlert();
		if ( !self.chatView.view.isMinimized )
			return;
		
		hello.app.notify({
			title : self.identity.name,
			text  : msg.message,
			callback : nClose,
			clickCallback : nClick
		});
		
		function nClose( res ) { console.log( 'nClose', res ); }
		function nClick( res ) {
			self.chatView.view.setFlag( 'minimized', false );
		}
		
	}
	
	// returns true if the intercept was acted on, otherwise returns false
	ns.Contact.prototype.handleIntercept = function( msg, intercept ) {
		var self = this;
		var event = intercept.data;
		var handler = self.interceptMap[ event.type ];
		if ( !handler ) {
			console.log( 'Contact.handleIntercept - no handler for', intercept );
			return false;
		}
		
		var notify = self.getInterceptNotification( msg, intercept );
		self.handleNotification( notify );
		
		// stop if it is from yourself ( aka from == null )
		if ( !msg.from )
			return true;
		
		handler( event.data, msg.from );
		return true;
	}
	
	ns.Contact.prototype.getInterceptNotification = function( msg, intercept ) {
		var self = this;
		var message = !!msg.from ? 'Received: ' : 'Sent: ';
		var type = 'unknown';
		if ( intercept.data && intercept.data.type )
			type = intercept.data.type;
		else
			type = intercept.type || type;
		
		type = self.interceptTypes[ type ] || type;
		message += type;
		
		if ( !self.identity && msg.from ) // no identity means this is a room
			message += ' from ' + msg.from; // so lets give a bit more infos
		
		return {
			level : 'warn',
			from : msg.from,
			message : message,
			time : msg.time,
		};
	}
	
	ns.Contact.prototype.chatMessage = function( msg ) {
		var self = this;
		var wrap = {
			type : 'message',
			data : msg,
		};
		self.toChat( wrap );
	}
	
	ns.Contact.prototype.handleLog = function( log ) {
		var self = this;
		if ( !log ) {
			nullMessage();
			return;
		}
		
		var intercept = self.checkIntercept( log.data.message );
		if ( intercept ) {
			var notify = self.getInterceptNotification( log.data, intercept );
			log.type = 'notification';
			log.data = notify;
		}
		
		var wrap = {
			type : 'log',
			data : log,
		};
		
		self.toChat( wrap );
		
		function nullMessage() {
			var nullEvent = {
				type : 'log',
				data : null,
			};
			self.toChat( nullEvent );
		}
	}
	
	ns.Contact.prototype.handleNotification = function( data ) {
		var self = this;
		var msg = {
			type : 'notification',
			data : data,
		};
		self.toChat( msg );
	}
	
	ns.Contact.prototype.messageWaiting = function( state ) {
		var self = this;
		state = state || false;
		state = state.toString();
		self.toView({
			type : 'messagewaiting',
			data : state,
		});
	}
	
	ns.Contact.prototype.sendMessage = function( str ) {
		var self = this;
		self.send({
			type : 'message',
			data  : str
		});
	}
	
	ns.Contact.prototype.sendCryptoMessage = function( data ) {
		var self = this;
		var msg = {
			type : 'cryptomessage',
			data : data,
		};
		self.send( msg );
	}
	
	ns.Contact.prototype.checkIntercept = function( message ) {
		var self = this;
		if ( !hello.intercept )
			throw new Error( 'intercept has not been initiated' );
		
		var intercept = hello.intercept.check( message );
		if ( intercept ) {
			return intercept;
		}
		
		return false;
	}
	
	ns.Contact.prototype.startLive = function( invite, from ) {
		var self = this;
		var invite = invite || null;
		var module = hello.module.get( self.moduleId );
		var user = module.identity;
		
		if ( invite )
			joinSession( user, invite );
		else
			setupSession( user );
		
		function joinSession( user, invite ) {
			var host = self.identity || { name : from }; // this contact is inviting you
			hello.rtc.askClient( invite, host, user );
		}
		
		function setupSession( user ) {
			var contact = self.identity; // create a session and invite this contact
			contact.invite = sendInvite;
			var rtcSession = hello.rtc.getSession();
			/*
			if ( rtcSession && !rtcSession.isHost ) {
				hello.log.show();
				hello.log.notify( 'You are not the host of the Live session, '
					+ 'so you may not send invites.' );
				return;
			}
			*/
			
			if ( rtcSession )
				hello.rtc.invite( contact );
			else
				hello.rtc.createRoom( [ contact ], user );
		}
		
		function sendInvite( invite ) {
			self.sendMessage( invite );
		}
	}
	
	ns.Contact.prototype.addCalendarEvent = function( event, from ) {
		var self = this;
		console.log( 'addCalendarEvent', {
			e : event,
			f : from,
		});
		
		if ( self.identity )
			from = self.identity.name;
		
		var message = 'Calendar event from ' + from;
		var cal = new api.Calendar();
		cal.addEvent( event, message, addBack );
		function addBack( res ) {
			console.log( 'calendar addback', res );
		}
	}
	
	ns.Contact.prototype.showOptions = function( e ) {
		var self = this;
		
		if( self.optionsView ) {
			return;
		}
	}
	
	ns.Contact.prototype.updateRequest = function( data ) {
		data.clientId = self.clientId;
		var req = {
			url : 'contact/update',
			verb : 'post',
			data : data,
			holdOnSuccess : true
		};
		
		component.tool.requestOverlay( req, updateCallback, view._window );
		function updateCallback( response ) {
			if ( !response.success ) {
				console.log( 'udapteCallback: denied for ' + self.getName())
				return;
			}
			
			// view.sendMessage( updated );
		}
	}
	
	ns.Contact.prototype.removeRequest = function( e ) {
		e.preventDefault();
		var req = {
			url : 'contact/remove',
			verb : 'post',
			data : {
				clientId : self.clientId
			}
		};
		
		hello.request.send( req, removeCallback );
		function removeCallback( result ) {
			if ( !result || !result.success ) {
				console.log( 'remove contact denied: '
					+ self.getName()
					+ ' - ' + self.displayName );
				console.log( result );
				return;
			}
			
			self.optionsView.close();
			self.remove();
		}
	}
	
	ns.Contact.prototype.updateViewTheme = function( filepath ) {
		var self = this;
		self.viewTheme = filepath;
		if ( !self.chatView || !self.chatView.view )
			return;
		
		self.chatView.view.setViewTheme( filepath );
	}
	
	ns.Contact.prototype.remove = function() {
		var self = this;
		console.log( 'app.Contact.remove - not implemented' );
	}
	
	ns.Contact.prototype.getName = function() {
		var self = this;
		return self.identity.name || self.clientId || self.type;
	}
	
	ns.Contact.prototype.toView = function( msg ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
	ns.Contact.prototype.toChat = function( event ) {
		var self = this;
		if ( !self.chatView )
			return;
		
		if ( self.chatView.send )
			self.chatView.send( event );
		else
			self.chatView.sendMessage( event );
	}
	
	ns.Contact.prototype.send = function( msg ) {
		var self = this;
		var wrap = {
			type : self.clientId,
			data : msg,
		};
		self.conn.send( wrap );
	}
	
	ns.Contact.prototype.contactClose = function() {
		var self = this;
		self.conn.close();
		self.view.close();
		if ( self.chatView )
			self.chatView.close();
	}
	ns.Contact.prototype.close = ns.Contact.prototype.contactClose;
	
})( library.contact );

//
// PRESENCEROOM
(function( ns, undefined ) {
	ns.PresenceRoom = function( conf ) {
		var self = this;
		self.type = 'presence';
		self.data = conf.room;
		self.host = conf.host;
		self.user = conf.user;
		self.userId = conf.userId;
		
		ns.Contact.call( self, conf );
		
		self.identities = {};
		self.onlineList = [];
		self.users = {};
		self.peers = [];
		
		self.init();
	}
	
	ns.PresenceRoom.prototype = Object.create( ns.Contact.prototype );
	
	// Public
	
	ns.PresenceRoom.prototype.joinLive = function( conf ) {
		var self = this;
		conf = conf || {};
		if ( self.live )
			return; // we already are in a live _in this room_
		
		conf.roomId = self.clientId;
		conf.identities = self.identities;
		self.live = hello.rtc.createSession( conf, liveToServer, onClose );
		if ( !self.live )
			return; // session wasnt created, because :reasons:
		
		// tell server
		const join = {
			type : 'live-join',
			data : conf,
		};
		self.send( join );
		
		// tell main view
		const userJoin = {
			type : 'user-join',
		}
		self.liveToView( userJoin );
		
		// events from live view we care about, everything else is passed on
		self.live.on( 'chat', chat );
		self.live.on( 'invite', invite );
		
		function chat( e ) { self.sendChatEvent( e ); }
		function invite( e ) { self.handleLiveInvite( e ); }
		function onClose( e ) {
			self.closeLive();
			const leave = {
				type : 'leave',
			}
			self.liveToServer( leave );
		}
		
		// event sink
		function liveToServer( type, data ) {
			const event = {
				type : type,
				data : data,
			};
			self.liveToServer( event );
		}
	}
	
	ns.PresenceRoom.prototype.getInviteToken = function( type, callback ) {
		var self = this;
		type = type || 'private';
		var reqId = null;
		if ( callback )
			reqId = self.setRequest( callback )
		
		var getInv = {
			type : type,
			data : {
				reqId : reqId,
				token : null,
			},
		};
		self.handleLiveInvite( getInv );
	}
	
	ns.PresenceRoom.prototype.close = function() {
		var self = this;
		if ( self.live )
			self.live.close();
		
		self.contactClose();
	}
	
	// Private
	
	ns.PresenceRoom.prototype.init = function() {
		var self = this;
		self.messageMap[ 'initialize' ] = init;
		self.messageMap[ 'persistent' ] = persistent;
		self.messageMap[ 'identity' ] = identity;
		self.messageMap[ 'invite' ] = invite;
		self.messageMap[ 'name' ] = roomName;
		self.messageMap[ 'join' ] = userJoin;
		self.messageMap[ 'leave' ] = userLeave;
		self.messageMap[ 'live' ] = live;
		self.messageMap[ 'chat' ] = chat;
		self.messageMap[ 'online' ] = online;
		self.messageMap[ 'offline' ] = offline;
		
		function init( e ) { self.handleInitialize( e ); }
		function persistent( e ) { self.handlePersistent( e ); }
		function identity( e ) { self.handleIdentity( e ); }
		function invite( e ) { self.handleInvite( e ); }
		function roomName( e ) { self.handleRoomName( e ); }
		function userJoin( e ) { self.handleJoin( e ); }
		function userLeave( e ) { self.handleLeave( e ); }
		function live( e ) { self.handleLive( e ); }
		function chat( e ) { self.handleChat( e ); }
		function online( e ) { self.handleOnline( e ); }
		function offline( e ) { self.handleOffline( e ); }
		
		self.bindView();
		self.send({
			type : 'initialize',
		});
	}
	
	ns.PresenceRoom.prototype.bindView = function() {
		const self = this;
		self.view.on( 'persist', persist );
		self.view.on( 'rename', rename );
		self.view.on( 'video', video );
		self.view.on( 'audio', audio );
		self.view.on( 'chat', chat );
		self.view.on( 'leave', leave );
		
		function persist( e ) { self.persistRoom( e ); }
		function rename( e ) { self.renameRoom( e ); }
		function video( e ) { self.startVideo( e ); }
		function audio( e ) { self.startAudio( e ); }
		function chat( e ) { self.toggleChat( e ); }
		function leave( e ) { self.leaveRoom( e ); }
		
	}
	
	ns.PresenceRoom.prototype.persistRoom = function( name ) {
		const self = this;
		const persist = {
			type : 'persist',
			data : {
				name       : name,
				persistent : true,
			},
		};
		self.send( persist );
	}
	
	ns.PresenceRoom.prototype.renameRoom = function( name ) {
		const self = this;
		const rename = {
			type : 'rename',
			data : name,
		};
		self.send( rename );
	}
	
	ns.PresenceRoom.prototype.startVideo = function() {
		const self = this;
		const permissions = {
			video : true,
			audio : true,
		};
		const constraints = {
			video : true,
			audio : true,
		};
		self.setupLive( permissions, constraints );
	}
	
	ns.PresenceRoom.prototype.startAudio = function() {
		const self = this;
		const permissions = {
			video : false,
			audio : true,
		};
		const constraints = {
			video : false,
			audio : true,
		};
		self.setupLive( permissions, constraints );
	}
	
	ns.PresenceRoom.prototype.toggleChat = function() {
		const self = this;
		if ( self.chatView ) {
			self.closeChat();
		} else
			self.openChat();
		
	}
	
	ns.PresenceRoom.prototype.openChat = function() {
		const self = this;
		self.messageWaiting( false );
		const initData = {
			roomName   : self.identity.name,
			users      : self.users,
			identities : self.identities,
			onlineList : self.onlineList,
			peers      : self.peers,
			ownerId    : self.ownerId,
			userId     : self.userId,
		};
		self.chatView = new library.view.PresenceChat(
			initData,
			eventSink,
			onClose
		);
		
		self.chatView.on( 'chat', chat );
		self.chatView.on( 'live-upgrade', goLive );
		
		function eventSink( e ) { console.log( 'unhandled chat view event', e ); }
		function onClose( e ) {
			self.closeChat();
		}
		
		function chat( e ) { self.sendChatEvent( e ); }
		function goLive( e ) {
			if ( 'video' === e )
				self.startVideo();
			else
				self.startAudio();
		}
	}
	
	ns.PresenceRoom.prototype.closeChat = function() {
		const self = this;
		self.chatView.close();
		self.chatView = null;
	}
	
	ns.PresenceRoom.prototype.leaveRoom = function() {
		const self = this;
		const leave = { type : 'leave' };
		self.send( leave );
	}
	
	ns.PresenceRoom.prototype.handleInitialize = function( state ) {
		const self = this;
		self.ownerId = state.ownerId;
		self.identities = state.identities;
		self.onlineList = state.online;
		self.persistent = state.persistent;
		self.identity.name = state.name;
		self.users = state.users;
		self.peers = state.peers;
		
		self.toView({
			type : 'owner',
			data : ( self.userId === self.ownerId ),
		});
		
		self.toView({
			type : 'persistent',
			data : {
				persistent : self.persistent,
				name       : self.identity.name,
			},
		});
		
		self.updateViewUsers();
		self.updateIdentities();
		
		// update main view with # of peers in a live session
		const uptdPeers = {
			type : 'peers',
			data : state.peers,
		};
		self.liveToView( uptdPeers );
	}
	
	ns.PresenceRoom.prototype.handlePersistent = function( event ) {
		const self = this;
		self.identity.name = event.name;
		
		const persistent = {
			type : 'persistent',
			data : event,
		};
		self.toView( persistent );
	}
	
	ns.PresenceRoom.prototype.handleIdentity = function( event ) {
		const self = this;
		if ( !event.userId || !event.identity )
			return;
		
		self.identities[ event.userId ] = event.identity;
		self.updateIdentities( event.userId );
	}
	
	ns.PresenceRoom.prototype.updateIdentities = function( userId ) {
		const self = this;
		var uptd  = null;
		if ( userId )
			uptd = {
				type : 'identity',
				data : {
					userId   : userId,
					identity : self.identities[ userId ],
				},
			};
		else
			uptd = {
				type : 'identities',
				data : self.identities,
			};
		
		if ( self.live )
			self.live.send( uptd );
		
		if ( self.chatView )
			self.chatView.send( uptd );
	}
	
	ns.PresenceRoom.prototype.handleInvite = function( event ) {
		const self = this;
		if ( 'revoke' !== event.type )
			event = self.buildInvites( event );
		
		if ( event.data.reqId ) {
			self.handleRequest( event.data );
		}
		
		const inv = {
			type : 'invite',
			data : event,
		};
		
		if ( self.chatView )
			self.chatView.send( inv );
		
		if ( self.live )
			self.live.send( inv );
	}
	
	ns.PresenceRoom.prototype.handleRoomName = function( name ) {
		const self = this;
		console.log( 'presenceRoom.handleRoomName', name );
	}
	
	ns.PresenceRoom.prototype.handleJoin = function( user ) {
		var self = this;
		self.users.push( user );
		const join = {
			type : 'join',
			data : user,
		};
		self.toChat( join );
		self.updateViewUsers();
	}
	
	ns.PresenceRoom.prototype.handleLeave = function( userId ) {
		const self = this;
		self.users = self.users.filter( notUserId );
		const leave = {
			type : 'leave',
			data : userId,
		};
		self.toChat( leave );
		self.updateViewUsers();
		
		function notUserId( user ) {
			return user.clientId !== userId;
		}
	}
	
	ns.PresenceRoom.prototype.handleOnline = function( userId ) {
		const self = this;
		self.onlineList.push( userId );
		const online = {
			type : 'online',
			data : userId,
		};
		self.toChat( online );
		self.updateViewUsers();
	}
	
	ns.PresenceRoom.prototype.handleOffline = function( userId ) {
		const self = this;
		self.onlineList = self.onlineList.filter( notUID );
		const offline = {
			type : 'offline',
			data : userId,
		};
		self.toChat( offline );
		self.updateViewUsers();
		
		function notUID( id ) {
			return id !== userId;
		}
	}
	
	ns.PresenceRoom.prototype.updateViewUsers = function( event ) {
		const self = this;
		const users = {
			type : 'users',
			data : {
				users  : self.users.length,
				online : self.onlineList.length,
			},
		};
		self.toView( users );
	}
	
	ns.PresenceRoom.prototype.setupLive = function( permissions, constraints ) {
		const self = this;
		const conf = {
			permissions : permissions || null,
			constraints : constraints || null,
		};
		
		self.joinLive( conf );
	}
	
	ns.PresenceRoom.prototype.handleLive = function( event ) {
		const self = this;
		if ( 'open' === event.type ) {
			if ( !self.live )
				return;
			
			self.live.initialize( event.data );
			return;
		}
		
		if ( 'close' === event.type ) {
			self.handleCloseLive( event.data );
			return;
		}
		
		if ( 'ping' === event.type ) {
			if ( !self.live )
				return;
			
			const pong = {
				type : 'pong',
				data : event.data,
			}
			self.liveToServer( pong );
			return;
		}
		
		if ( 'peers' === event.type
			|| 'join' === event.type
			|| 'leave' === event.type
		) {
			self.liveToView( event );
			self.updatePeers( event );
		}
		
		if ( !self.live )
			return;
		
		self.live.send( event );
	}
	
	ns.PresenceRoom.prototype.handleChat = function( event ) {
		const self = this;
		const chat = {
			type : 'chat',
			data : event,
		}
		
		if (( 'log' !== event.type ) &&
			( 'state' !== event.type )
		) {
			self.onMessage( event.data );
		}
		
		self.toChat( chat );
		
		if ( self.live )
			self.live.send( chat );
	}
	
	ns.PresenceRoom.prototype.onMessage = function( msg ) {
		const self = this;
		// dont if from self
		if ( msg.fromId === self.userId )
			return;
		
		// dont if chat or live is open
		if ( self.chatView || self.live )
			return;
		
		// show msg bubble in main view
		self.messageWaiting( true );
	}
	
	ns.PresenceRoom.prototype.setRequest = function( callback ) {
		const self = this;
		if ( !callback )
			return;
		
		self.requests = self.requests || {};
		const reqId = friendUP.tool.uid( 'req' );
		self.requests[ reqId ] = callback;
		return reqId;
	}
	
	ns.PresenceRoom.prototype.handleRequest = function( event ) {
		const self = this;
		if ( !event.reqId || !self.requests )
			return;
		
		const callback = self.requests[ event.reqId ];
		if ( !callback )
			return;
		
		delete self.requests[ event.reqId ];
		callback( event );
	}
	
	ns.PresenceRoom.prototype.buildInvites = function( event ) {
		const self = this;
		if ( 'state' === event.type )
			event.data = parseState( event.data );
		else
			event.data = build( event.data );
		
		return event;
		
		function build( conf ) {
			if ( 'string' === typeof( conf ))
				conf = { token : conf };
				
			const data = {
				type   : 'live',
				token  : conf.token,
				host   : conf.host,
				roomId : self.clientId,
				vers   : 2,
			};
			const bundle = {
				type : 'live-invite',
				data : data,
			};
			conf.link = hello.intercept.buildURL( bundle, false, 'Join me live' )
				+ '&theme=borderless';
			conf.data = hello.intercept.buildJSON( bundle );
			return conf;
		}
		
		function parseState( state ) {
			if ( state.publicToken )
				state.publicToken = build({
					token : state.publicToken,
					host : state.host,
				});
			
			state.privateTokens = state.privateTokens
				.map( buildPriv );
			
			return state;
			
			function buildPriv( token ) {
				return build({
					token : token,
					host : state.host,
				});
			}
		}
	}
	
	ns.PresenceRoom.prototype.liveToView = function( event ) {
		const self = this;
		if ( !self.view )
			return;
		
		const wrap = {
			type : 'live',
			data : event,
		};
		
		self.view.sendMessage( wrap );
		if ( self.chatView )
			self.chatView.send( wrap );
	}
	
	ns.PresenceRoom.prototype.updatePeers = function( event ) {
		const self = this;
		if ( 'peers' === event.type ) {
			self.peers = event.data;
			return;
		}
		
		const pid = event.data.peerId;
		if ( 'join' === event.type ) {
			self.peers.push( pid );
			return;
		}
		
		if ( 'leave' === event.type ) {
			self.peers = self.peers.filter( notPID );
		}
		
		function notPID( peerId ) {
			return peerId !== pid;
		}
	}
	
	ns.PresenceRoom.prototype.setIdentity = function() {
		var self = this;
		self.identity = {
			clientId : self.clientId,
			name     : self.data.name || null,
			avatar   : null,
		};
	}
	
	ns.PresenceRoom.prototype.sendChatEvent = function( event ) {
		const self = this;
		const chat = {
			type : 'chat',
			data : event,
		};
		self.send( chat );
	}
	
	ns.PresenceRoom.prototype.handleLiveInvite = function( event ) {
		const self = this;
		const invite = {
			type : 'invite',
			data : event,
		};
		self.send( invite );
	}
	
	ns.PresenceRoom.prototype.liveToServer = function( event ) {
		var self = this;
		var wrap = {
			type : 'live',
			data : event,
		};
		self.send( wrap );
	}
	
	ns.PresenceRoom.prototype.closeLive = function() {
		const self = this;
		if ( !self.live )
			return;
		
		self.live.close();
		const userLeave = {
			type : 'user-leave',
		};
		self.liveToView( userLeave );
	}
	
	ns.PresenceRoom.prototype.handleCloseLive = function( liveId ) {
		const self = this;
		// close the things
		if ( !liveId ) {
			clearView();
			close();
			return;
		}
		
		// no live here
		if ( !self.live ) {
			clearView();
			return;
		}
		
		// yep, we're closing
		if ( liveId === self.live.id ) {
			clearView();
			close();
			return;
		}
		
		// a live was told to close, but not this one
		return;
		
		//
		function clearView() {
			const userLeave = {
				type : 'user-leave',
			};
			self.liveToView( userLeave );
		}
		
		function close() {
			if ( !self.live )
				return;
			
			var live = self.live;
			delete self.live;
			live.close();
		}
	}
	
})( library.contact );

//
// SUBSCRIBER
(function( ns, undefined ) {
	ns.Subscriber = function( conf ) {
		if ( !( this instanceof ns.Subscriber ))
			return new ns.Subscriber( conf );
		
		var self = this;
		self.data = conf.subscriber;
		
		library.contact.Contact.call( self, conf );
		self.init();
	}
	
	ns.Subscriber.prototype = Object.create( library.contact.Contact.prototype );
	
	ns.Subscriber.prototype.init = function() {
		var self = this;
		self.bindView();
	}
	
	ns.Subscriber.prototype.setIdentity = function() {
		var self = this;
		self.identity = {
			clientId : self.clientId,
			name : self.displayName,
			avatar : null,
		};
	}
	
	ns.Subscriber.prototype.bindView = function() {
		var self = this;
		self.view.on( 'allow', allow );
		self.view.on( 'deny', deny );
		self.view.on( 'cancel', cancel );
		
		function allow( msg ) { self.allow(); }
		function deny( msg ) { self.deny(); }
		function cancel( msg ) { self.cancel(); }
	}
	
	ns.Subscriber.prototype.allow = function() {
		var self = this;
		self.conn.send({
			type : 'subscription',
			data : {
				type : 'allow',
				clientId : self.clientId
			}
		});
	}
	
	ns.Subscriber.prototype.deny = function() {
		var self = this;
		self.conn.send({
			type : 'subscription',
			data : {
				type : 'deny',
				clientId : self.clientId
			}
		});
	}
	
	ns.Subscriber.prototype.cancel = function() {
		var self = this;
		self.conn.send({
			type : 'subscription',
			data : {
				type : 'cancel',
				clientId : self.clientId
			}
		});
	}
	
})( library.contact );


// TREEROOT CONTACT
(function( ns, undefined ) {
	ns.TreerootContact = function( conf ) {
		if ( !( this instanceof ns.TreerootContact ))
			return new ns.TreerootContact( conf );
		
		var self = this;
		self.type = 'treeroot';
		self.data = conf.contact;
		
		ns.Contact.call( self, conf );
		
		self.encryptMessages = conf.msgCrypto;
		self.publicKey = conf.contact.publicKey;
		self.encrypt = conf.encrypt;
		self.decrypt = conf.decrypt;
		
		self.init();
	}
	
	ns.TreerootContact.prototype = Object.create( ns.Contact.prototype );
	
	ns.TreerootContact.prototype.init = function() {
		var self = this;
		
		self.setAvatar();
		self.bindView();
		self.setupDormant();
		
		self.messageMap[ 'message' ] = preMessage;
		self.messageMap[ 'log' ] = preLog;
		self.messageMap[ 'chatencrypt' ] = addChatEncrypt;
		self.messageMap[ 'publickey' ] =  updatePublicKey;
		
		if ( self.data.enc ) {
			self.addChatEncrypt( self.data.enc );
		}
		
		function preMessage( e ) { self.preprocessMessage( e ); }
		function preLog( e ) { self.preprocessLog( e ); }
		function addChatEncrypt( e ) { self.addChatEncrypt( e ); }
		function updatePublicKey( e ) { self.updatePublicKey( e ); }
	}
	
	ns.TreerootContact.prototype.setIdentity = function() {
		var self = this;
		self.identity = {
			clientId : self.clientId,
			name : self.displayName,
			avatar : null,
		};
	}
	
	ns.TreerootContact.prototype.setupDormant = function() {
		const self = this;
		self.door = new api.DoorDir({
			title : self.identity.name,
			path  : self.data.Username + '/',
		}, self.parentPath );
		
		const getId = new api.DoorFun({
			title   : 'GetIdentity',
			execute : getIdentity,
		}, self.door.fullPath );
		
		const sendMsg = new api.DoorFun({
			title   : 'SendMessage',
			execute : sendMessage,
		}, self.door.fullPath );
		
		hello.dormant.addDir( self.door );
		hello.dormant.addFun( getId );
		hello.dormant.addFun( sendMsg );
		
		function getIdentity() {
			return self.identity;
		}
		
		function sendMessage( msg ) {
			console.log( 'dormant.contact.sendMessage', {
				self : self,
				msg : msg,
			});
		}
	}
	
	ns.TreerootContact.prototype.bindView = function() {
		var self = this;
		
		// buttons
		self.view.on( 'chat', startChat );
		self.view.on( 'live', startLive );
		// option menu
		self.view.on( 'option', option );
		self.view.on( 'remove', remove );
		
		function startChat( msg ) { self.startChat( msg ); }
		function startLive() { self.startLive(); }
		function option( msg ) { console.log( 'contact.option', msg ); }
		function remove( msg ) { self.removeRequest( msg ); }
	}
	
	ns.TreerootContact.prototype.setAvatar = function() {
		var self = this;
		var module = hello.module.get( self.moduleId );
		var host = module.module.host;
		// TODO - domain based
		if ( !self.data.imagePath || !self.data.imagePath.Filename ) {
			self.identity.avatar =
				'https://' + host
				+ '/admin/gfx/arenaicons/user_johndoe_32.png';
			return;
		}
		
		var pathObj = self.data.imagePath;
		self.identity.avatar = 'https://' + host + '/' + pathObj.DiskPath + pathObj.Filename;
	}
	
	ns.TreerootContact.prototype.updatePublicKey = function( pKey ) {
		var self = this;
		self.publicKey = pKey;
	}
	
	ns.TreerootContact.prototype.addChatEncrypt = function( data ) {
		var self = this;
		var crypter = self.decryptMsgKey( data.key, data.id );
		if ( !crypter )
			return;
		
		const bundle = {
			crypter : crypter,
		};
		self.setCrypto( bundle, data.id );
	}
	
	ns.TreerootContact.prototype.setupChatEncrypt = function() {
		var self = this;
		var seed = Math.random().toString().split( '.' )[ 1 ];
		var cryptoId = window.SHA256( friendUP.tool.uid());
		const crypter = new library.component.FCrypto({ seed : seed });
		const keys = self.getCryptoKeys( crypter );
		const bundle = {
			crypter : crypter,
			keys    : keys,
		};
		self.chatCrypto = bundle;
		self.chatCryptoId = cryptoId;
		return bundle;
	}
	
	ns.TreerootContact.prototype.decryptMsgKey = function( encKey ) {
		const self = this;
		var res = self.decrypt( encKey );
		if ( !res.success ) {
			console.log( 'decrypting chat key derped', { key : encKey, res : res });
			return null;
		}
		
		if ( !res.plaintext || !res.plaintext.length ) {
			console.log( 'decrypted chatKey plaintext missing' );
			return null;
		}
		
		const privKey = res.plaintext.split( '<!--split-->' )[ 0 ];
		const conf = {
			privateKey : privKey,
		};
		const crypter = new library.component.FCrypto( conf );
		if ( !crypter )
			return null;
		
		return crypter;
	}
	
	ns.TreerootContact.prototype.setCrypter = function( crypter, id ) {
		const self = this;
		if ( !crypter || !id ) {
			console.log( 'setCrypter - missing inputs', {
				self    : self,
				crypter : crypter,
				id      : id,
			});
			throw new Error( 'see log ^^^' );
		}
		
		const bundle = {
			crypter : crypter,
		};
		self.chatCrypto = bundle;
		self.chatCryptoId = id;
		return bundle;
	}
	
	ns.TreerootContact.prototype.setCrypto = function( bundle, id ) {
		const self = this;
		self.chatCrypto = bundle;
		if ( id )
			self.chatCryptoId = id;
		else
			self.chatCryptoId = null;
	}
	
	ns.TreerootContact.prototype.getCrypto = function( id ) {
		const self = this;
		if ( !id )
			return self.chatCrypto || null;
		
		if ( self.chatCryptoId !== id )
			return null
		else
			return self.chatCrypto || null;
	}
	
	ns.TreerootContact.prototype.getCryptoKeys = function( crypter ) {
		const self = this;
		const keys = crypter.getKeys();
		const chatKey = keys.priv;
		const sender = self.encrypt( chatKey );
		const receiver = window.fcrypt.encryptString( chatKey, self.publicKey );
		const chatKeys = {
			sender   : sender.cipher,
			receiver : receiver.cipher,
		};
		return chatKeys;
	}
	
	ns.TreerootContact.prototype.preprocessMessage = function( msg ) {
		var self = this;
		if ( msg.dec )
			msg = self.decryptMessage( msg );
		
		self.doMessageIntercept( msg );
	}
	
	ns.TreerootContact.prototype.preprocessLog = function( msg ) {
		var self = this;
		if ( !msg ) {
			self.handleLog( null );
			return;
		}
		
		if ( ( 'message' === msg.type ) && ( msg.data.dec ) )
			msg.data = self.decryptMessage( msg.data );
		
		self.handleLog( msg );
	}
	
	ns.TreerootContact.prototype.decryptMessage = function( msg ) {
		var self = this;
		var crypter = null;
		var msgCrypter = null;
		msg.cipherText = msg.message;
		const bundle = self.getCrypto( msg.dec.id );
		if ( bundle && bundle.crypter )
			crypter = bundle.crypter;
		else
			msgCrypter = self.decryptMsgKey( msg.dec.key, msg.dec.id );
		
		if ( !crypter && !msgCrypter ) {
			console.log( 'decryptMessage - could not decrypt chat key', {
				self : self,
				msg  : msg,
			});
			msg.message = '[ error : could not decrypt key ]';
			return msg;
		}
		
		if ( crypter )
			var de = crypter.de( msg.message );
		
		if ( !de || !de.success ) {
			msgCrypter = self.decryptMsgKey( msg.dec.key, msg.dec.id );
			de = msgCrypter.de( msg.message );
		}
		
		if ( !de || !de.success ) {
			console.log( 'decryptMessage - could not decrypt message', {
				msg : msg,
				self : self,
			});
			msg.message = '[ error : could not decrypt message ]';
			return msg;
		}
		
		if ( msgCrypter )
			self.setCrypter( msgCrypter, msg.dec.id );
		
		msg.message = de.plaintext;
		msg.cipherText = de.cipherText;
		msg.encrypted = true;
		return msg;
	}
	
	ns.TreerootContact.prototype.startChat = function() {
		var self = this;
		self.openChat( ready );
		function ready() {
			self.getChatLog();
			self.messageWaiting( false );
		}
	}
	
	ns.TreerootContact.prototype.getChatLog = function() {
		var self = this;
		var fetchLog = {
			type : 'log',
		}
		self.send( fetchLog );
	}
	
	ns.TreerootContact.prototype.openChat = function( readyCallback ) {
		var self = this;
		var module = hello.module.get( self.moduleId );
		
		if ( self.chatView )
			self.chatView.close();
		
		var chatConf = {
			onready : readyCallback,
			onmessage : onMessage,
			onlive : liveInvite,
			onencrypt : toggleEncrypt,
			onclose : onClose,
			state : {
				contact : self.identity,
				user : module.identity,
				encryptIsDefault : true,
				canEncrypt : true,
				doEncrypt : !!self.encryptMessages,
				multilineCap : true,
			},
		};
		self.chatView = new library.view.IMChat( chatConf );
		function onMessage( e ) { self.sendChatMessage( e ); }
		function liveInvite( e ) { self.startLive(); }
		function toggleEncrypt( e ) { self.toggleEncrypt(); }
		function onClose( e ) { self.chatView = null; }
	}
	
	ns.TreerootContact.prototype.toggleEncrypt = function( force ) {
		var self = this;
		if ( 'undefined' !== typeof( force ))
			var toggle = !!force;
		else
			var toggle = !self.encryptMessages;
		
		self.encryptMessages = toggle;
		if ( self.chatView )
			self.chatView.toggleEncrypt( toggle );
	}
	
	ns.TreerootContact.prototype.sendChatMessage = function( msg ) {
		var self = this;
		if ( !self.encryptMessages ) {
			self.sendMessage( msg );
			return;
		}
		
		self.encryptMessage( msg );
	}
	
	ns.TreerootContact.prototype.encryptMessage = function( str ) {
		const self = this;
		var bundle = self.getCrypto();
		if ( !bundle || !bundle.crypter )
			bundle = self.setupChatEncrypt();
		
		if ( !bundle.keys )
			bundle.keys = self.getCryptoKeys( bundle.crypter );
		
		const crypter = bundle.crypter;
		var en = crypter.en( str );
		if ( !en.success ) {
			fail( 'Failed to encrypt, message not sent' );
			return;
		}
		
		str = en.cipher;
		var msg = {
			message : str,
			encId   : self.chatCryptoId,
			encKeys : bundle.keys,
		};
		
		self.sendCryptoMessage( msg );
		
		function fail( message ) {
			var failMsg = {
				type : 'cryptofail',
				data : {
					message : message,
				},
			};
			self.toChat( failMsg );
		}
	}
	
	ns.TreerootContact.prototype.removeRequest = function( e ) {
		var self = this;
		self.conn.send({
			type : 'subscription',
			data : {
				type : 'unsubscribe',
				clientId : self.clientId,
			},
		});
	}
	
	ns.TreerootContact.prototype.close = function() {
		var self = this;
		if ( self.chatView )
			self.chatView.close();
		
		self.contactClose();
	}
	
})( library.contact );


// IRC CHANNEL
(function( ns, undefined ) {
	ns.IrcChannel = function( conf ) {
		if ( !( this instanceof ns.IrcChannel ))
			return new ns.IrcChannel( conf );
		
		var self = this;
		self.type = 'irc';
		self.data = conf.channel;
		self.viewTheme = conf.viewTheme;
		self.user = conf.user;
		
		ns.Contact.call( this, conf );
		
		self.chatView = null;
		
		self.init();
	}
	
	ns.IrcChannel.prototype = Object.create( ns.Contact.prototype );
	
	ns.IrcChannel.prototype.init = function() {
		var self = this;
		delete self.interceptMap[ 'live-invite' ];
		
		if ( self.data.users )
			self.setState( self.data );
		
		self.bindServerEvents();
		self.bindView();
		self.setSettingsMaps();
	}
	
	ns.IrcChannel.prototype.setIdentity = function() {
		var self = this;
		self.room = {
			name : self.data.displayName,
		};
	}
	
	ns.IrcChannel.prototype.bindServerEvents = function() {
		var self = this;
		//self.messageMap[ 'message' ] = handleMessage;
		self.messageMap[ 'action' ] = handleAction;
		self.messageMap[ 'join' ] = userJoin;
		self.messageMap[ 'mode' ] = modeChange;
		self.messageMap[ 'usermode' ] = userModeChange;
		self.messageMap[ 'nick' ] = nickChange;
		self.messageMap[ 'userlist' ] = userList;
		self.messageMap[ 'part' ] = userPart;
		self.messageMap[ 'quit' ] = userQuit;
		self.messageMap[ 'kick' ] = kick;
		self.messageMap[ 'ban' ] = ban;
		self.messageMap[ 'log' ] = logMsg;
		self.messageMap[ 'topic' ] = updateTopic;
		self.messageMap[ 'setting' ] = setting;
		self.messageMap[ 'state' ] = handleState;
		self.messageMap[ 'user' ] = updateUser;
		
		function handleMessage(  e ) { self.handleMessage( e ); }
		function handleAction(   e ) { self.handleAction( e ); }
		function modeChange(     e ) { self.modeChange( e ); }
		function userModeChange( e ) { self.userModeChange( e ); }
		function userList(       e ) { self.userList( e ); }
		function updateTopic(    e ) { self.updateTopic( e ); }
		function userJoin(       e ) { self.userJoin( e ); }
		function userPart(       e ) { self.userPart( e ); }
		function userQuit(       e ) { self.userQuit( e ); }
		function kick(           e ) { self.userKicked( e ); }
		function ban(            e ) { self.userBanned( e ); }
		function nickChange(     e ) { self.nickChange( e ); }
		function logMsg(         e ) { self.handleLog( e ); }
		function setting(        e ) { self.updateSetting( e ); }
		function handleState(    e ) { self.showChannel( e ); }
		function updateUser(     e ) { self.updateUser( e ); }
	}
	
	ns.IrcChannel.prototype.onChatMessage = function( msg ) {
		var self = this;
		if ( !self.chatView ) {
			self.messageWaiting( true );
			return;
		}
		
		//self.chatMessage( msg );
	}
	
	ns.IrcChannel.prototype.handleAction = function( msg ) {
		var self = this;
		if ( !self.chatView ) {
			self.messageWaiting( true );
			return;
		}
		
		self.toChat({
			type : 'action',
			data : msg,
		});
	}
	
	ns.IrcChannel.prototype.setState = function( state ) {
		var self = this;
		self.topic = state.topic;
		self.mode = state.mode;
		state.users.forEach( add );
		function add( user ) { self.userJoin( user ); }
	}
	
	ns.IrcChannel.prototype.modeChange = function( data ) {
		var self = this;
		self.mode = data.mode;
		self.toChat({
			type : 'mode',
			data : self.mode,
		});
	}
	
	ns.IrcChannel.prototype.userModeChange = function( data ) {
		var self = this;
		self.toChat({
			type : 'usermode',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userList = function( data ) {
		var self = this;
		self.toChat({
			type : 'participants',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userJoin = function( user ) {
		var self = this;
		self.toChat({
			type : 'join',
			data : user,
		});
	}
	
	ns.IrcChannel.prototype.userPart = function( data ) {
		var self = this;
		self.toChat({
			type : 'part',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userQuit = function( data ) {
		var self = this;
		self.toChat({
			type : 'quit',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userKicked = function( data ) {
		const self = this;
		self.toChat({
			type : 'kick',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.userBanned = function( data ) {
		const self = this;
		self.toChat({
			type : 'ban',
			data : data,
		});
	}
	
	ns.IrcChannel.prototype.nickChange = function( update ) {
		var self = this;
		var nickUpdate = {
			type : 'nick',
			data : update,
		};
		
		self.toChat( nickUpdate );
	}
	
	ns.IrcChannel.prototype.updateUser = function( update ) {
		var self = this;
		self.user = update;
		var idUpdate = {
			type : 'user',
			data : update,
		};
		self.toChat( idUpdate );
	}
	
	ns.IrcChannel.prototype.updateTopic = function( msg ) {
		var self = this;
		var wrap = {
			type : 'topic',
			data : msg,
		};
		self.toView( wrap );
		self.toChat( wrap );
	}
	
	ns.IrcChannel.prototype.bindView = function() {
		var self = this;
		self.view.on( 'channel', toggleChannelView );
		self.view.on( 'leave', leave );
		self.view.on( 'topic', changeTopic );
		self.view.on( 'mode', changeMode );
		
		function toggleChannelView( msg ) {
			if ( self.chatView )
				self.closeChannel();
			else
				self.getChannelState();
		}
		
		function leave( msg ) { self.leave( msg ); }
		function changeTopic( msg ) { self.changeTopic( msg ); }
		function changeMode( msg ) { self.changeMode( msg ); }
	}
	
	ns.IrcChannel.prototype.leave = function( msg ) {
		var self = this;
		self.send({
			type : 'leave',
		});
	}
	
	ns.IrcChannel.prototype.changeTopic = function( msg ) {
		var self = this;
		console.log( 'channel.changeTopic - NYI', msg );
	}
	
	ns.IrcChannel.prototype.changeMode = function( msg ) {
		var self = this;
		console.log( 'channel.changeMode - NYI', msg );
	}
	
	ns.IrcChannel.prototype.getChannelState = function() {
		var self = this;
		var msg = {
			type : 'state',
		};
		self.send( msg );
	}
	
	ns.IrcChannel.prototype.showChannel = function( state ) {
		var self = this;
		if ( self.chatView )
			self.chatView.close();
		
		if ( !state  ) {
			self.getChannelState();
			return;
		}
		
		state.user = self.user;
		state.participants = state.users;
		delete state.users;
		self.messageWaiting( false );
		var conf = {
			viewConf : {
				title     : self.room.name,
				viewTheme : self.viewTheme,
			},
			onmessage   : sendMessage,
			onsettings  : toggleSettings,
			onprivate   : openPrivate,
			onhighlight : onHighlight,
			onclose     : onclose,
			state       : state,
		};
		self.chatView = new library.view.Conference( conf, readyBack );
		
		function sendMessage( e ) { self.sendMessage( e ); }
		function onclose( e ) { self.chatView = null; }
		function toggleSettings( e ) { self.toggleSettings( e ); }
		function openPrivate( e ) { self.openPrivateWindow( e ); }
		function onHighlight( e ) { self.handleHighlight( e ); }
		function readyBack() {
			self.send({ type : 'log' });
		}
		
	}
	
	ns.IrcChannel.prototype.openPrivateWindow = function( participant ) {
		var self = this;
		var module = hello.module.get( self.moduleId );
		module.openPrivate( participant.name );
	}
	
	ns.IrcChannel.prototype.handleHighlight = function() {
		var self = this;
		if ( !hello.account.settings.msgAlert )
			return;
		
		hello.playMsgAlert();
	}
	
	ns.IrcChannel.prototype.toggleSettings = function( msg ) {
		var self = this;
		if ( self.settingsView )
			self.settingsView.close();
		else
			self.showSettings();
	}
	
	ns.IrcChannel.prototype.showSettings = function() {
		var self = this;
		if ( self.settingsView )
			return;
		
		var topic = self.topic.topic || 'no topic';
		var mode = {
			kittiesOnly : true,
			noASL : false,
		};
		var conf = {
			type : 'conference',
			title : self.room.name,
			onsave : saveHandler,
			onclose : closeHandler,
			settings : {
				topic : topic,
				mode : mode,
			},
		};
		
		self.settingsView = new library.view.Settings( conf );
		
		function saveHandler( msg ) { self.updateSetting( msg ); }
		function closeHandler( msg ) { self.settingsView = null; }
	}
	
	ns.IrcChannel.prototype.setSettingsMaps = function() {
		var self = this;
		self.settingSaveMap = {
			topic : setTopic,
			mode : setMode,
		};
		
		function setTopic( msg ) { self.setTopic( msg ); }
		function setMode( msg ) { self.setMode( msg ); }
	}
	
	ns.IrcChannel.prototype.updateSetting = function( data ) {
		var self = this;
		var handler = self.settingSaveMap[ data.setting ];
		if ( !handler ) {
			console.log( 'channel.updateSetting - no handler for', data );
			return;
		}
		
		handler( data.value );
	}
	
	ns.IrcChannel.prototype.setTopic = function( topic ) {
		var self = this;
		var topicMsg = '/topic ' + topic;
		self.sendMessage( topicMsg );
		
		if ( !self.settingsView )
			return;
		
		var update = {
			setting : 'topic',
			value : topic,
			success : true,
		};
		self.settingsView.saved( update );
	}
	
	ns.IrcChannel.prototype.setMode = function( mode ) {
		var self = this;
		if ( !self.settingsView )
			return;
		
		var update = {
			setting : 'mode',
			value : {},
			success : false,
		}
		self.settingsView.saved( update );
	}
	
	ns.IrcChannel.prototype.closeChannel = function( msg ) {
		var self = this;
		self.chatView.close();
		self.chatView = null;
	}
	
})( library.contact );

(function( ns, undefined ) {
	ns.IrcPrivMsg = function( conf ) {
		if ( !( this instanceof ns.IrcPrivMsg ))
			return new ns.IrcPrivMsg( conf );
		
		var self = this;
		self.data = conf.contact;
		self.user = conf.user;
		self.viewTheme = conf.viewTheme;
		
		ns.Contact.call( self, conf );
		
		self.chatView = null;
		
		self.init();
	}
	
	ns.IrcPrivMsg.prototype = Object.create( ns.Contact.prototype );
	
	ns.IrcPrivMsg.prototype.init = function() {
		var self = this;
		self.bindView();
		
		self.messageMap[ 'nick' ] = updateIdentity;
		self.messageMap[ 'user' ] = updateUser;
		self.messageMap[ 'action' ] = handleAction;
		
		function updateIdentity( msg ) { self.updateIdentity( msg ); }
		function updateUser( msg ) { self.updateUser( msg ); }
		function handleAction( msg ) { self.handleAction( msg ); }
	}
	
	ns.IrcPrivMsg.prototype.setIdentity = function() {
		var self = this;
		self.identity = {
			clientId : self.clientId,
			name : self.data.name,
			avatar : library.component.Identity.prototype.avatarAlt,
		};
	}
	
	ns.IrcPrivMsg.prototype.updateIdentity = function( data ) {
		var self = this;
		if ( self.identity.name !== data.current )
			return;
		
		self.identity.name = data.update;
		var update = {
			type : 'identity',
			data : self.identity,
		};
		self.toView( update );
		
		if ( !self.chatView )
			return;
		
		self.chatView.setTitle( 'Chatting with ' + self.identity.name );
		self.toChat( update );
	}
	
	ns.IrcPrivMsg.prototype.updateUser = function( data ) {
		var self = this;
		self.user.name = data.name;
		var update = {
			type : 'user',
			data : data,
		};
		self.toChat( update );
	}
	
	ns.IrcPrivMsg.prototype.handleAction = function( msg ) {
		var self = this;
		self.onChatMessage( msg );
		self.toChat({
			type : 'action',
			data : msg,
		});
	}
	
	ns.IrcPrivMsg.prototype.bindView = function() {
		var self = this;
		self.view.on( 'chat', toggleChat );
		self.view.on( 'live', sendLiveInvite );
		self.view.on( 'remove', removePrivate );
		
		function toggleChat( msg ) {
			if ( self.chatView )
				self.chatView.close();
			else
				self.startChat();
		}
		function sendLiveInvite( msg ) { self.startLive(); }
		function removePrivate( msg ) { self.remove(); }
	}
	
	ns.IrcPrivMsg.prototype.remove = function() {
		var self = this;
		var module = hello.module.get( self.moduleId );
		module.removePrivate( self.identity.name );
	}
	
	ns.IrcPrivMsg.prototype.startChat = function() {
		var self = this;
		self.messageWaiting( false );
		self.openChat( chatReady );
		function chatReady() {
			self.getLog();
		}
	}
	
	ns.IrcPrivMsg.prototype.openChat = function( readyBack ) {
		var self =this;
		if ( self.chatView ) {
			self.chatView.activate();
			return;
		}
		
		var conf = {
			onready : readyBack,
			onmessage : onMessage,
			onlive : onLive,
			onclose : onClose,
			onhighlight : onHighlight,
			state : {
				contact : self.identity,
				user : self.user,
			},
			viewConf : {
				viewTheme : self.viewTheme,
			}
		};
		self.chatView = new library.view.IMChat( conf );
		
		function onMessage( msg ) { self.fromChat( msg ); }
		function onLive( msg ) { self.startLive(); }
		function onClose() { self.chatView = null; }
		function onHighlight( e ) { self.handleHighlight(); }
	}
	
	ns.IrcPrivMsg.prototype.handleHighlight = function() {
		var self = this;
		return;
		if ( !hello.account.settings.msgAlert )
			return;
		
		hello.playMsgAlert();
	}
	
	ns.IrcPrivMsg.prototype.getLog = function() {
		var self = this;
		var askLog = {
			type : 'log',
		};
		self.send( askLog );
	}
	
	ns.IrcPrivMsg.prototype.fromChat = function( msg ) {
		var self = this;
		self.sendMessage( msg );
		return;
		/*
		if ( msg[ 0 ] === '/' )
		else
			self.sendMessage( msg );
		*/
	}
	
	ns.IrcPrivMsg.prototype.sendCommand = function( msg ) {
		var self = this;
		module = hello.module.get( self.moduleId );
		module.sendCommand( msg );
	}
	
})( library.contact );
