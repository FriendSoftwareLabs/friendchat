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

// Socket
var log = require( './Log' )( 'Socket' );
var util = require( 'util' );
var events = require( './Emitter' );

var ns = {};
ns.Socket = function( conf ) {
	if( !( this instanceof ns.Socket ))
		return new ns.Socket( conf );
	
	const self = this;
	events.Emitter.call( self );
	self.id = conf.id;
	self.conn = conf.conn;
	
	self.pingInterval = null; // holds the 'setInterval' id for pings
	self.pingStep = 1000 * 15; // 10 sec - time between pings sent
	self.pingTimeout = 1000 * 10;
	self.pingTimers = {};
	self.authenticated = false;
	self.sessionId = false;
	self.parentId = null;
	self.sessionTimeout = 1000 * 60 // 1 minute
	self.errorTimer = null;
	self.pingoutTimer = null;
	self.sendQueue = [];
	
	self.init();
}

util.inherits( ns.Socket, events.Emitter );

// PUBLIC INTERFACE

ns.Socket.prototype.send = function( msg ) {
	const self = this;
	const wrap = {
		type : 'msg',
		data : msg,
	};
	return self.sendOnSocket( wrap );
}

ns.Socket.prototype.setSession = function( sessionId, parentId ) {
	const self = this;
	if ( sessionId ) {
		self.sessionId = sessionId;
		self.parentId = parentId;
	}
	
	const sessionEvent = {
		type : 'session',
		data : self.sessionId,
	};
	return self.sendOnSocket( sessionEvent );
}

ns.Socket.prototype.authenticate = function( success ) {
	const self = this;
	if ( self.authenticated === success )
		return;
	
	self.authenticated = success;
	const auth = {
		type : 'authenticate',
		data : true,
	};
	return self.sendOnSocket( auth );
}

ns.Socket.prototype.attach = function( conn ) {
	const self = this;
	if ( !conn )
		throw new Error( 'u wot m8? Socket.attach - no conn' );
	
	if ( !self.sessionId ) {
		log( 'attach - no session, attach not allowed', self.id );
		return;
	}
	
	if ( self.conn )
		self.cleanup();
	
	self.conn = conn;
	self.conn.id = self.id;
	self.start();
	self.setSession();
	self.executeSendQueue();
}

ns.Socket.prototype.detach = function() {
	const self = this;
	self.cleanup();
	const conn = self.conn;
	delete self.conn;
	return conn;
}

ns.Socket.prototype.unsetSession = function() {
	const self = this;
	self.sessionId = false;
	const sessionEvent = {
		type : 'session',
		data : false,
	};
	
	return self.sendOnSocket( sessionEvent );
}

// used from account
ns.Socket.prototype.kill = function() {
	const self = this;
	self.cleanup();
	self.emit( 'close' );
}

// used from socketmanager
ns.Socket.prototype.close = function() {
	const self = this;
	self.emitterClose();
	self.cleanup();
	self.closeWs();
}

// PRIVATES

ns.Socket.prototype.init = function() {
	const self = this;
	if ( !self.conn || !self.id ) {
		log( 'missing things', { c : self.conn, id : self.id });
		throw new Error( 'missing stuff' );
	}
	
	self.conn.id = self.id;
	self.connMap = {
		'ping' : ping,
		'pong' : pong,
	};
	function ping( msg ) { self.handlePing( msg ); }
	function pong( msg ) { self.handlePong( msg ); }
	
	self.start();
}

ns.Socket.prototype.start = function() {
	const self = this;
	if ( !self.conn ) {
		log( 'start - no conn, aborting' );
		return;
	}
	
	self.bind();
	self.doPing();
}

ns.Socket.prototype.stop = function() {
	const self = this;
	self.unbind();
	self.dontPing();
}

ns.Socket.prototype.bind = function() {
	const self = this;
	self.cancelErrorTimer();
	self.cancelPingClose();
	
	self.conn.on( 'error', e => self.connError( e ));
	self.conn.on( 'close', e => self.connClose( e ));
	self.conn.on( 'message', e => self.receiveMessage( e ));
}

ns.Socket.prototype.unbind = function() {
	const self = this;
	if ( !self.conn )
		return;
	
	self.conn.removeAllListeners( 'error' );
	self.conn.removeAllListeners( 'close' );
	self.conn.removeAllListeners( 'message' );
}

ns.Socket.prototype.receiveMessage = function( msgString ) {
	const self = this;
	var msgObj = toJSON( msgString );
	if( !msgObj ) {
		log( 'receiveMessage - could not JSON', msgString );
		return;
	}
	
	self.handleEvent( msgObj );
}

ns.Socket.prototype.handleEvent = function( event ) {
	const self = this;
	var handler = self.connMap[ event.type ];
	if ( handler ) {
		handler( event.data );
		return;
	}
	
	self.emit( event.type, event.data );
}

ns.Socket.prototype.doPing = function() {
	const self = this;
	if ( self.pingInterval )
		self.dontPing();
	
	self.pingInterval = setInterval( ping, self.pingStep );
	function ping() {
		self.sendPing();
	}
}

ns.Socket.prototype.dontPing = function() {
	const self = this;
	if ( self.pingInterval ) {
		clearInterval( self.pingInterval );
		self.pingInterval = null;
	}
	
	self.clearPingTimers();
}

ns.Socket.prototype.sendPing = async function() {
	const self = this;
	if ( !self.conn || !( 1 === self.conn.readyState )) {
		self.emit( 'ping', null );
		return;
	}
	
	const now = Date.now();
	const pingMsg = {
		type : 'ping',
		data : now,
	};
	const success = await self.sendOnSocket( pingMsg );
	if ( !success ) {
		self.emit( 'ping', null );
		return;
	}
	
	const timer = setTimeout( pingTimeout, self.pingTimeout );
	self.pingTimers[ now ] = timer;
	
	function pingTimeout() {
		let timer = self.pingTimers[ now ];
		if ( null == timer )
			return;
		
		delete self.pingTimers[ now ];
		self.emit( 'ping', null );
		self.startPingClose();
	}
}

ns.Socket.prototype.handlePong = function( stamp ) {
	const self = this;
	const timer = self.pingTimers[ stamp ];
	if ( self.pingoutTimer && ( null != timer ))
		self.cancelPingClose();
	
	if ( null == timer )
		return;
	
	clearTimeout( timer );
	delete self.pingTimers[ stamp ];
	
	const now = Date.now();
	const pingTimeMs = now - stamp;
	self.emit( 'ping', pingTimeMs );
}

ns.Socket.prototype.handlePing = function( msg ) {
	const self = this;
	const pong = {
		type : 'pong',
		data : msg,
	};
	self.sendOnSocket( pong );
}

ns.Socket.prototype.clearPingTimers = function() {
	const self = this;
	const stamps = Object.keys( self.pingTimers );
	stamps.forEach( clear );
	function clear( stamp ) {
		let timer = self.pingTimers[ stamp ]
		delete self.pingTimers[ stamp ];
		if ( null == timer )
			return;
		
		clearTimeout( timer );
	}
}

ns.Socket.prototype.startPingClose = function() {
	const self = this;
	if ( self.pingoutTimer )
		return;
	
	self.pingoutTimer = setTimeout( kill, self.sessionTimeout );
	function kill() {
		self.pingoutTimer = null;
		self.kill();
	}
}

ns.Socket.prototype.cancelPingClose = function() {
	const self = this;
	if ( !self.pingoutTimer )
		return;
	
	clearTimeout( self.pingoutTimer );
	self.pingoutTimer = null;
}

ns.Socket.prototype.sendConn = function( msg ) {
	const self = this;
	return self.sendOnSocket( msg );
}

ns.Socket.prototype.sendOnSocket = function( msgObj ) {
	const self = this;
	return new Promise(( resolve, reject ) => {
		if ( !self.conn ) {
			self.sendQueue.push( msgObj );
			resolve( false );
			return;
		}
		
		const msgString = toString( msgObj );
		try {
			self.conn.send( msgString, done );
		} catch ( e ) {
			done( e );
		}

		function done( err ) {
			var success = !err;
			resolve( success );
		}
	});
}

ns.Socket.prototype.executeSendQueue = function() {
	const self = this;
	self.sendQueue.forEach( send );
	self.sendQueue = [];
	 
	function send( msg ) {
		self.sendOnSocket( msg );
	}
}

ns.Socket.prototype.connError = function( event ) {
	const self = this;
	self.handleClose();
}

ns.Socket.prototype.connClose = function( event ) {
	const self = this;
	self.handleClose();
}

ns.Socket.prototype.handleClose = function() {
	const self = this;
	if ( !self.sessionId ) {
		self.kill();
		return;
	}
	
	// already erroring
	if ( null != self.errorTimer )
		return;
	
	// time out
	self.errorTimer = setTimeout( kill, self.sessionTimeout );
	function kill() {
		self.errorTimer = null;
		self.kill();
	}
}

ns.Socket.prototype.cancelErrorTimer = function() {
	const self = this;
	if ( !self.errorTimer )
		return;
	
	clearTimeout( self.errorTimer );
	self.errorTimer = null;
}

ns.Socket.prototype.closeWs = function() {
	const self = this;
	if ( !self.conn )
		return;
	
	try {
		self.conn.close();
	} catch ( e ) {
		log( '_socket.close() error', e );
	}
	
	delete self.conn;
}

ns.Socket.prototype.cleanup = function() {
	const self = this;
	self.cancelErrorTimer();
	self.cancelPingClose();
	self.dontPing();
	self.unbind();
}

function toString( obj ) {
	try {
		return  JSON.stringify( obj );
	} catch( e ) {
		return obj.toString();
	}
}

function toJSON( string ) {
	try {
		return JSON.parse( string );
	} catch ( e ) {
		log( 'onMessage.parse failed', string );
		return false;
	}
}

module.exports = ns.Socket;
