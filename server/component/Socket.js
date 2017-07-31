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

// Socket
var log = require( './Log' )( 'Socket' );
var util = require( 'util' );
var events = require( 'events' );

var ns = {};
ns.Socket = function( conf ) {
	if( !( this instanceof ns.Socket ))
		return new ns.Socket( conf );
	
	var self = this;
	self.id = conf.id;
	self.conn = conf.conn;
	
	self.onclose = null;
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

util.inherits( ns.Socket, events.EventEmitter );

// PUBLIC INTERFACE

ns.Socket.prototype.send = function( msg, callback ) {
	var self = this;
	var wrap = {
		type : 'msg',
		data : msg,
	};
	self.sendOnSocket( wrap, callback );
}

ns.Socket.prototype.setSession = function( sessionId, parentId ) {
	var self = this;
	if ( sessionId ) {
		self.sessionId = sessionId;
		self.parentId = parentId;
	}
	
	var sessionEvent = {
		type : 'session',
		data : self.sessionId,
	};
	self.sendOnSocket( sessionEvent );
}

ns.Socket.prototype.authenticate = function( success ) {
	var self = this;
	if ( self.authenticated === success )
		return;
	
	self.authenticated = success;
	var auth = {
		type : 'authenticate',
		data : true,
	};
	self.sendOnSocket( auth );
}

ns.Socket.prototype.attach = function( conn ) {
	var self = this;
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
	var self = this;
	self.cleanup();
	var conn = self.conn;
	delete self.conn;
	return conn;
}

ns.Socket.prototype.unsetSession = function( callback ) {
	var self = this;
	self.sessionId = false;
	var sessionEvent = {
		type : 'session',
		data : false,
	};
	
	self.sendOnSocket( sessionEvent, callback );
}

ns.Socket.prototype.close = function() {
	var self = this;
	if ( self.onclose )
		delete self.onclose;
	
	self.closeWs();
	self.cleanup();
}

// PRIVATES

ns.Socket.prototype.init = function() {
	var self = this;
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
	var self = this;
	self.unbind();
	self.dontPing();
}

ns.Socket.prototype.bind = function() {
	var self = this;
	self.cancelErrorTimer();
	self.cancelPingClose();
	
	self.conn.on( 'error', onError );
	self.conn.on( 'close', onClose );
	self.conn.on( 'message', onMessage );
	function onError( e ) { self.connError( e ); }
	function onClose( e ) { self.connClose( e ); }
	function onMessage( e ) { self.receiveMessage( e ); }
}

ns.Socket.prototype.unbind = function() {
	var self = this;
	if ( !self.conn )
		return;
	
	self.conn.removeAllListeners( 'error' );
	self.conn.removeAllListeners( 'close' );
	self.conn.removeAllListeners( 'message' );
}

ns.Socket.prototype.receiveMessage = function( msgString ) {
	var self = this;
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
	var self = this;
	if ( self.pingInterval )
		self.dontPing();
	
	self.pingInterval = setInterval( ping, self.pingStep );
	function ping() {
		self.sendPing();
	}
}

ns.Socket.prototype.dontPing = function() {
	var self = this;
	if ( self.pingInterval ) {
		clearInterval( self.pingInterval );
		self.pingInterval = null;
	}
	
	self.clearPingTimers();
}

ns.Socket.prototype.sendPing = function() {
	var self = this;
	if ( !self.conn || !( 1 === self.conn.readyState )) {
		self.emit( 'ping', null );
		return;
	}
	
	var now = Date.now();
	var pingMsg = {
		type : 'ping',
		data : now,
	};
	self.sendOnSocket( pingMsg, pingSent );
	
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
	
	function pingSent( success ) {
		if ( !success )
			self.emit( 'ping', null );
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
	var self = this;
	var pong = {
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
	var self = this;
	if ( self.pingoutTimer )
		return;
	
	self.pingoutTimer = setTimeout( kill, self.sessionTimeout );
	function kill() {
		self.pingoutTimer = null;
		self.kill();
	}
}

ns.Socket.prototype.cancelPingClose = function() {
	var self = this;
	if ( !self.pingoutTimer )
		return;
	
	clearTimeout( self.pingoutTimer );
	self.pingoutTimer = null;
}

ns.Socket.prototype.sendConn = function( msg, callback ) {
	const self = this;
	self.sendOnSocket( msg, callback );
}

ns.Socket.prototype.sendOnSocket = function( msgObj, callback ) {
	var self = this;
	if ( !self.conn ) {
		self.sendQueue.push( msgObj );
		done();
		return false;
	}
	
	var msgString = toString( msgObj );
	try {
		self.conn.send( msgString, done );
	} catch ( e ) {
		//log( '_conn.send() try error', e );
		done( e );
	}
	
	function done( err ) {
		/*
		if ( err )
			log( '_conn.send() failed to send', { e : err, m : msgObj }, 2 );
		*/
		
		var success = !err;
		if ( callback ) {
			if ( 'function' !== typeof callback )
				throw new Error( 'hey fucko, this isnt a function' );
			
			callback( success );
		}
	}
}

ns.Socket.prototype.executeSendQueue = function() {
	var self = this;
	self.sendQueue.forEach( send );
	self.sendQueue = [];
	
	function send( msg ) {
		self.sendOnSocket( msg );
	}
}

ns.Socket.prototype.connError = function( event ) {
	var self = this;
	self.handleError();
}

ns.Socket.prototype.connClose = function( event ) {
	var self = this;
	self.handleError();
}

ns.Socket.prototype.handleError = function() {
	var self = this;
	if ( !self.sessionId ) {
		self.kill();
		return;
	}
	
	// already erroring
	if ( self.errorTimer )
		return;
	
	// timeout
	self.errorTimer = setTimeout( kill, self.sessionTimeout );
	function kill() {
		self.errorTimer = null;
		self.kill();
	}
}

ns.Socket.prototype.cancelErrorTimer = function() {
	var self = this;
	if ( !self.errorTimer )
		return;
	
	clearTimeout( self.errorTimer );
	self.errorTimer = null;
}

ns.Socket.prototype.kill = function() {
	var self = this;
	if ( !self.onclose )
		return;
	
	self.cleanup();
	var onclose = self.onclose;
	delete self.onclose;
	onclose();
}

ns.Socket.prototype.closeWs = function() {
	var self = this;
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
	var self = this;
	if ( self.errorTimer ) {
		clearTimeout( self.errorTimer );
		self.errorTimer = null;
	}
	
	self.unbind();
	self.dontPing();
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
