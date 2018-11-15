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
	ns.GuestAccount = function( conn, permissions, onclose ) {
		const self = this;
		self.conn = conn;
		self.permissions = permissions;
		self.onclose = onclose;
		
		self.roomId = null;
		self.room = null;
		
		self.init();
	}
	
	// Public
	
	ns.GuestAccount.prototype.close = function() {
		const self = this;
		if ( self.conn )
			self.conn.close();
		
		delete self.conn;
		delete self.onclose;
	}
	
	// Private
	
	ns.GuestAccount.prototype.init = function() {
		const self = this;
		console.log('GuestAccount.init', self );
		self.conn.on( 'ready', ready );
		self.conn.on( 'account', account );
		
		function ready( e ) { self.handleConnReady( e ); }
		function account( e ) { self.handleAccount( e ); }
	}
	
	ns.GuestAccount.prototype.handleConnReady = function( e ) {
		const self = this;
		console.log( 'handleConnReady', e );
		const init = {
			type : 'initialize',
		};
		self.send( init );
	}
	
	ns.GuestAccount.prototype.handleAccount = function( loginEvent ) {
		const self = this;
		console.log( 'GuestAccount.handleAccount', loginEvent );
		const accId = loginEvent.data;
		self.accountId = accId;
		self.acc = new library.component.EventNode( accId, self.conn, accSink );
		self.acc.on( 'initialize', initialize );
		self.acc.on( 'join', joinedRoom );
		
		const init = {
			type : 'initialize',
			data : null,
		};
		self.send( init );
		
		function accSink() { console.log( 'GuestAccount.accSink', arguments ); }
		function initialize( e ) { self.handleInit( e ); }
		function joinedRoom( e ) { self.handleJoinedRoom( e ); }
	}
	
	/*
	ns.GuestAccount.prototype.handleInit = function( data ) {
		const self = this;
		console.log( 'GuestAccount.handleInit', data );
		const acc = data.account;
		self.userId = acc.clientId;
	}
	*/
	
	ns.GuestAccount.prototype.handleInit = function( state ) {
		const self = this;
		console.log( 'GuestAccount.handleInit', state );
		if ( self.account )
			return;
		
		self.account = state.account;
		self.idc = new library.component.IdCache( self.acc );
	}
	/*
	ns.GuestAccount.prototype.handleJoinedRoom = function( room ) {
		const self = this;
		console.log( 'GuestAccount.handleJoinedRoom', room );
		self.roomId = room.clientId;
		self.roomName = room.name;
		self.room = new library.component.GuestRoom( self.roomId, self.conn, extraRoomEvent );
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
		function live( e ) { self.handleLive( e ); }
		function chat( e ) { self.handleChat( e ); }
	}
	*/
	ns.GuestAccount.prototype.handleJoinedRoom = function( conf ) {
		const self = this;
		console.log( 'GuestAccount.handleJoinedRoom', conf );
		self.roomId = conf.clientId;
		const roomConf = {
			roomId   : self.roomId,
			identity : conf,
			idCache  : self.idc,
		};
		self.room = new library.component.GuestRoom( roomConf, self.acc );
	}
	
	ns.GuestAccount.prototype.send = function( event ) {
		const self = this;
		if ( !self.acc )
			return;
		
		self.acc.send( event );
	}
	
})( library.component );


(function( ns, undefined ) {
	ns.GuestRoom = function( conf, accConn ) {
		const self = this;
		console.log( 'GuestRoom', {
			conf    : conf,
			accConn : accConn,
		});
		self.id = conf.roomId;
		self.identity = conf.identity;
		self.idc = conf.idCache;
		
		self.conn = null;
		self.identities = {};
		
		self.init( accConn );
	}
	
	// Public
	
	ns.GuestRoom.prototype.close = function() {
		const self = this;
		if ( self.conn )
			self.conn.close();
		
		delete self.conn;
	}
	
	// Private
	
	ns.GuestRoom.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.send( event );
	}
	
	ns.GuestRoom.prototype.init = function( accConn ) {
		const self = this;
		console.log( 'GuestRoom.init', self );
		self.conn = new library.component.EventNode( self.id, accConn, roomSink );
		self.conn.on( 'initialize', init );
		self.conn.on( 'identity', identity );
		self.conn.on( 'live', live );
		self.conn.on( 'chat', chat );
		
		const initEvent = {
			type : 'initialize',
		};
		self.send( initEvent );
		
		function roomSink() {
			console.log( 'GuestRoom event sink', arguments );
		}
		
		function init( e ) { self.handleInit( e ); }
		function identity( e ) { self.updateIdentity( e ); }
		function live( e ) { self.handleLive( e ); }
		function chat( e ) { self.handleChat( e ); }
		
	}
	
	ns.GuestRoom.prototype.handleInit = function( state ) {
		const self = this;
		console.log( 'GuestRoom.handleInit', state );
		self.users = state.users;
		self.identities = state.identities || {};
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
			roomId      : self.id,
			roomName    : self.identity.name,
			isGuest     : true,
			permissions : perms,
			isStream    : state.settings.isStream,
			guestAvatar : state.guestAvatar,
		};
		self.live = new library.rtc.RtcSession( conf, liveEvent, onclose );
		self.live.on( 'chat', chat );
		self.live.on( 'live-name', liveName );
		const joinLive = {
			type : 'live-join',
			data : null,
		};
		self.send( joinLive );
		
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
		console.log( 'updateIdentity', data );
		let uid = data.userId;
		let id = data.identity;
		self.identities[ uid ] = id;
		const uptd = {
			type : 'identity',
			data : data,
		};
		self.handleLive( uptd );
	}
	
	ns.GuestRoom.prototype.handleLive = function( event ) {
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
	
	ns.GuestRoom.prototype.handleChat = function( event ) {
		const self = this;
		//console.log( 'handleChat', event );
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
		self.send( live );
	}
	
	ns.GuestRoom.prototype.handleLiveChat = function( event ) {
		const self = this;
		//console.log( 'guest.handleLiveChat', event );
		const chat = {
			type : 'chat',
			data : event,
		};
		self.send( chat );
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
		self.send( idUpdate );
	}
	
})( library.component );
