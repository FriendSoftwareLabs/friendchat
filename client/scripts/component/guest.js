'use strict';

/*©agpl*************************************************************************
*                                                                              *
* Friend Unifying Platform                                                     *
* ------------------------                                                     *
*                                                                              *
* Copyright 2014-2016 Friend Software Labs AS, all rights reserved.            *
* Hillevaagsveien 14, 4016 Stavanger, Norway                                   *
* Tel.: (+47) 40 72 96 56                                                      *
* Mail: info@friendos.com                                                      *
*                                                                              *
*****************************************************************************©*/

var library = window.library || {};
library.component = library.component || {};

(function( ns, undefined ) {
	ns.GuestRoom = function( conn, onclose ) {
		const self = this;
		self.conn = conn;
		self.onclose = onclose;
		
		self.roomId = null;
		
		self.init();
	}
	
	// Public
	
	ns.GuestRoom.prototype.close = function() {
		const self = this;
		self.releaseConn();
		delete self.conn;
		delete self.onclose;
	}
	
	// Private
	
	ns.GuestRoom.prototype.init = function() {
		const self = this;
		self.conn.on( 'ready', ready );
		self.conn.on( 'initialize', init );
		self.conn.on( 'join', joinedRoom );
		
		function ready( e ) { self.handleConnReady( e ); }
		function init( e ) { self.handleInit( e ); }
		function joinedRoom( e ) { self.handleJoinedRoom( e ); }
	}
	
	ns.GuestRoom.prototype.handleConnReady = function( e ) {
		const self = this;
		console.log( 'handleConnReady', e );
		const init = {
			type : 'initialize',
		};
		self.send( init );
	}
	
	ns.GuestRoom.prototype.handleInit = function( e ) {
		const self = this;
		console.log( 'handleInitialize', e );
	}
	
	ns.GuestRoom.prototype.handleJoinedRoom = function( room ) {
		const self = this;
		console.log( 'GuestRoom - handleJoinedRoom', room );
		self.roomId = room.clientId;
		self.room = new library.component.EventNode( self.roomId, self.conn, extraRoomEvent );
		self.room.on( 'initialize', init );
		self.room.on( 'identity', identity );
		self.room.on( 'live', live );
		self.room.on( 'chat', chat );
		
		const initEvent = {
			type : 'initialize',
		};
		self.sendToRoom( initEvent );
		
		function extraRoomEvent( e ) { self.handleRoomEvent( e ); }
		function init( e ) { self.handleRoomInit( e ); }
		function identity( e ) { self.updateIdentity( e ); }
		function live( e ) { self.handleLiveEvent( e ); }
		function chat( e ) { self.handleChatEvent( e ); }
	}
	
	ns.GuestRoom.prototype.handleRoomEvent = function( e ) {
		const self = this;
		console.log( 'unhandled room event', e );;
	}
	
	ns.GuestRoom.prototype.handleRoomInit = function( state ) {
		const self = this;
		self.users = state.users;
		self.identities = state.identities;
		const conf = {
			roomId      : self.roomId,
			identities  : self.identities,
			isGuest     : true,
			permissions : {
				video : true,
				audio : true,
			},
			constraints : {
				video : true,
				audio : true,
			},
		};
		self.live = new library.rtc.RtcSession( conf, liveEvent, onclose );
		self.live.on( 'chat', chat );
		const joinLive = {
			type : 'live-join',
			data : null,
		};
		self.sendToRoom( joinLive );
		
		function liveEvent( e, d ) {
			self.handleLiveToRoom({
				type : e,
				data : d,
			});
		}
		function chat( e ) { self.handleLiveChat( e ); }
		function onclose( e ) {
			console.log( 'guest live onclose' );
			const leave = {
				type : 'leave',
			};
			self.handleLiveToRoom( leave );
			const onclose = self.onclose;
			delete self.onclose;
			if ( onclose )
				onclose();
		}
	}
	
	ns.GuestRoom.prototype.updateIdentity = function( event ) {
		const self = this;
		console.log( 'GuestRoom - updateIdentity', event );
		const uptd = {
			type : 'identity',
			data : event,
		};
		self.handleLiveEvent( uptd );
	}
	
	ns.GuestRoom.prototype.handleLiveEvent = function( event ) {
		const self = this;
		if ( 'ping' === event.type ) {
			if ( !self.live )
				return;
			
			const pong = {
				type : 'pong',
				data : event.data,
			};
			self.handleLiveToRoom( pong );
			return;
		}
		
		if ( 'open' === event.type ) {
			if ( !self.live )
				return;
			
			self.live.initialize( event.data );
			return;
		}
		
		if ( self.live )
			self.live.send( event );
	}
	
	ns.GuestRoom.prototype.handleChatEvent = function( event ) {
		const self = this;
		//console.log( 'handleChatEvent', event );
		const chat = {
			type : 'chat',
			data : event,
		};
		self.live.send( chat );
	}
	
	ns.GuestRoom.prototype.handleLiveToRoom = function( event ) {
		const self = this;
		const live = {
			type : 'live',
			data : event,
		};
		self.sendToRoom( live );
	}
	
	ns.GuestRoom.prototype.handleLiveChat = function( event ) {
		const self = this;
		//console.log( 'guest.handleLiveChat', event );
		const chat = {
			type : 'chat',
			data : event,
		};
		self.sendToRoom( chat );
	}
	
	ns.GuestRoom.prototype.sendToRoom = function( event ) {
		const self = this;
		self.room.send( event );
		//self.send( toRoom );
	}
	
	ns.GuestRoom.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.send( event );
	}
	
	ns.GuestRoom.prototype.releaseConn = function() {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.release( 'join' );
		self.conn.release( self.roomId );
	}
	
})( library.component );
