'use strict';

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

var library = window.library || {};
library.component = library.component || {};

(function( ns, undefined ) {
	ns.GuestRoom = function( conn, permissions, onclose ) {
		const self = this;
		self.conn = conn;
		self.permissions = permissions;
		self.onclose = onclose;
		
		self.roomId = null;
		self.identities = {};
		
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
	
	ns.GuestRoom.prototype.handleInit = function( data ) {
		const self = this;
		const acc = data.account;
		self.userId = acc.clientId;
	}
	
	ns.GuestRoom.prototype.handleJoinedRoom = function( room ) {
		const self = this;
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
		console.log( 'unhandled room event', e );
	}
	
	ns.GuestRoom.prototype.handleRoomInit = function( state ) {
		const self = this;
		self.users = state.users;
		self.identities = state.identities;
		const perms = self.permissions || {
			send : {
				audio : true,
				video : true,
			},
			receive : {
				audio : true,
				video : true,
			},
		};
		
		const conf = {
			roomId      : self.roomId,
			isGuest     : true,
			permissions : perms,
		};
		self.live = new library.rtc.RtcSession( conf, liveEvent, onclose );
		self.live.on( 'chat', chat );
		self.live.on( 'live-name', liveName );
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
		function liveName( e ) { self.handleLiveName( e ); }
		function onclose( e ) {
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
	
	ns.GuestRoom.prototype.updateIdentity = function( data ) {
		const self = this;
		let uid = data.userId;
		let id = data.identity;
		self.identities[ uid ] = id;
		const uptd = {
			type : 'identity',
			data : data,
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
			
			let init = event.data;
			init.identities = self.identities;
			self.live.initialize( init );
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
	
	ns.GuestRoom.prototype.handleLiveName = function( name ) {
		const self = this;
		const id = self.identities[ self.userId ];
		if ( !name || !name.length || !id ) {
			console.log( 'handleLiveName - invalid', {
				uid  : self.userId,
				name : name,
				id   : id,
			});
			return;
		}
		
		id.name = name;
		const idUpdate = {
			type : 'identity',
			data : id,
		};
		self.sendToRoom( idUpdate );
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
