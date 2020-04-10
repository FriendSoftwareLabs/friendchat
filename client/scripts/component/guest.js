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
		self.conn.on( 'ready', ready );
		self.conn.on( 'account', account );
		
		function ready( e ) { self.handleConnReady( e ); }
		function account( e ) { self.handleAccount( e ); }
	}
	
	ns.GuestAccount.prototype.handleConnReady = function( e ) {
		const self = this;
		const init = {
			type : 'initialize',
		};
		self.send( init );
	}
	
	ns.GuestAccount.prototype.handleAccount = function( loginEvent ) {
		const self = this;
		const accId = loginEvent.data;
		self.accountId = accId;
		self.acc = new library.component.RequestNode( accId, self.conn, accSink );
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
	
	ns.GuestAccount.prototype.handleInit = function( state ) {
		const self = this;
		if ( self.account )
			return;
		
		self.account = state.account;
		self.idc = new library.component.IdCache( self.acc );
		self.idc.get( self.accountId )
			.then( selfBack )
			.catch( selfBoop );
			
		function selfBack( id ) {
			console.log( 'GuestAccount.selfBack', id );
		}
		
		function selfBoop( err ) {
			console.log( 'GuestAccount.selfBoop', err );
		}
	}
	
	ns.GuestAccount.prototype.handleJoinedRoom = function( event ) {
		const self = this;
		const conf = event.joined;
		self.roomId = conf.clientId;
		const roomConf = {
			roomId      : self.roomId,
			identity    : conf,
			permissions : self.permissions,
			idCache     : self.idc,
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
		self.id = conf.roomId;
		self.clientId = conf.roomId;
		self.identity = conf.identity;
		self.permissions = conf.permissions;
		self.idc = conf.idCache;
		
		self.conn = null;
		self.identities = {};
		
		self.init( accConn );
	}
	
	ns.GuestRoom.prototype =
		Object.create( library.contact.PresenceRoom.prototype );
	
	// Public
	
	// Private
	
	ns.GuestRoom.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.send( event );
	}
	
	ns.GuestRoom.prototype.init = function( accConn ) {
		const self = this;
		self.conn = new library.component.EventNode( self.id, accConn, roomSink );
		self.conn.on( 'initialize', init );
		self.conn.on( 'identity', identity );
		self.conn.on( 'live', live );
		self.conn.on( 'chat', chat );
		self.conn.on( 'invite', e => self.handleInvite( e ));
		
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
		self.live.on( 'invite', invite );
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
		function invite( e ) {
			const inv = {
				type : 'invite',
				data : e,
			};
			self.send( inv );
		}
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
		
		if ( 'join' === event.type ) {
			const peerId = event.data.peerId;
			self.idc.get( peerId )
				.then( idBack )
				.catch( idBoopies );
			
			function idBack( id ) {
				const update = {
					userId   : id.clientId,
					identity : id,
				};
				self.updateIdentity( update );
			}
			
			function idBoopies( err ) {
				console.log( 'GuestRoom.handleLive - join, failed to fetch id', {
					event : event,
					err   : err,
				});
			}
		}
		
		if ( 'open' === event.type ) {
			if ( !self.live )
				return;
			
			const init = event.data;
			const peerList = init.liveConf.peerList;
			self.idc.getList( peerList )
				.then( listBack )
				.catch( listBump );
			
			return;
			
			function listBack( idList ) {
				const ids = {};
				idList.forEach( id => {
					ids[ id.clientId ] = id;
				});
				init.identities = ids;
				self.live.initialize( init );
			}
			
			function listBump( err ) {
				console.log( 'GuestRoom.handleLive - open event, id list err', err );
			}
		}
		
		if ( self.live )
			self.live.send( event );
	}
	
	ns.GuestRoom.prototype.handleChat = function( event ) {
		const self = this;
		const chat = {
			type : 'chat',
			data : event,
		};
		self.live.send( chat );
	}
	
	ns.GuestRoom.prototype.handleLiveToRoom = function( event ) {
		const self = this;
		console.log( 'handleLiveToRoom', event );
		const live = {
			type : 'live',
			data : event,
		};
		self.send( live );
	}
	
	ns.GuestRoom.prototype.handleLiveChat = function( event ) {
		const self = this;
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
