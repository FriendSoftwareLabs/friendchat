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

var fs = require( 'fs' );
var WSS = require( './WebSocketServer' );
var log = require( './Log' )( 'SocketManager' );
var uuid = require( './UuidPrefix' )( 'socket' );
var Socket = require( './Socket' );
var TLSWatch = require( './TLSWatch' );
var fcRequest = require( './FcRequest' )( global.config.server.fc );

var ns = {};

ns.SocketManager = function( tlsConf, port ) {
	var self = this;
	self.tls = tlsConf;
	self.port = port;
	
	self.sockets = {}; // connections not logged in
	self.sessions = {}; // logged in, can now be restored from the client
	self.key = null;
	self.cert = null;
	self.pool = null;
	
	self.initWS();
}

ns.SocketManager.prototype.initWS = function() {
	var self = this;
	var watchConf = {
		keyPath  : self.tls.keyPath,
		certPath : self.tls.certPath,
		onchange : onChange,
		onerr    : onErr,
	};
	self.tlsWatch = new TLSWatch( watchConf );
	function onChange( tlsBundle ) {
		self.tls = tlsBundle;
		setupWss( successBack );
		function successBack( success ) {
			if ( success )
				self.tlsWatch.acceptUpdate();
			else
				self.tlsWatch.denyUpdate();
		}
	}
	
	function onErr( err ) {
		log( 'tlsWatch err', err );
	}
	
	function setupWss( callback ) {
		if ( self.pool )
			closePool( setWss );
		else
			setWss();
		
		function setWss() {
			var conf = {
				port : self.port,
				tls : self.tls,
			};
			
			try {
				self.pool = new WSS( conf );
			} catch( e ) {
				self.pool = null;
				callback( false );
				return;
			}
			
			self.bindPool();
			callback( true );
		}
	}
	
	function closePool( callback ) {
		var pool = self.pool;
		self.releasePool();
		delete self.pool;
		pool._server.close( callback );
	}
	
	// watch files
	
	// create pool
	
}

ns.SocketManager.prototype.bindPool = function() {
	var self = this;
	if ( !self.pool )
		throw new Error( 'SocketManager - no pool' );
	
	self.pool.on( 'error', poolError );
	self.pool.on( 'close', poolClose );
	self.pool.on( 'headers', poolHeader );
	self.pool.on( 'connection', poolConnection );
	
	function poolConnection( conn ) {
		var sid = self.makeSocketId();
		var conf = {
			id : sid,
			conn : conn,
		};
		var socket = new Socket( conf );
		var patience = 1000 * 10; // 10 seconds before closing the socket,
		                          //if no auth message is received
		socket.authTimeout = setTimeout( closeSocket, patience );
		socket.on( 'authenticate', checkAuth );
		socket.on( 'session', checkSession );
		const authChallenge = {
			type : 'authenticate',
			data : null,
		};
		socket.sendConn( authChallenge );
		
		function closeSocket() {
			log( 'authenticate - timelimit hit, closing socket' );
			removeListeners( socket );
			socket.close();
		}
		
		function checkAuth( msg ) {
			clearDMZ( socket );
			self.authenticate( msg, socket );
		}
		
		function checkSession( msg ) {
			clearDMZ( socket );
			self.checkSession( msg, socket );
		}
		
		function clearDMZ( socket ) {
			if ( socket.authTimeout )
				clearTimeout( socket.authTimeout );
			delete socket.authTimeout;
			removeListeners( socket );
		}
		
		function removeListeners( socket ) {
			socket.removeAllListeners( 'authenticate' );
			socket.removeAllListeners( 'session' );
		}
	};
	
	function poolHeader( event ) { }//log( 'pool header', event ); }
	function poolClose( event ) { log( 'pool close event', event ); }
	function poolError( event ) { log( 'pool error event', event ); }
}

ns.SocketManager.prototype.releasePool = function() {
	const self = this;
	self.pool.removeAllListeners();
}

ns.SocketManager.prototype.authenticate = function( bundle, socket ) {
	const self = this;
	if ( !bundle ) {
		log( 'authenticate - no bundle', bundle );
		close();
		return;
	}
	
	var token = null;
	if ( 'authid' === bundle.type )
		token = self.validateAuthToken( bundle );
	
	if ( !token ) {
		log( 'authenticate - token not valid', bundle );
		close();
		return;
	}
	
	self.authRequest( token, authBack );
	function authBack( data ) {
		if ( !data ) {
			close();
			return;
		}
		
		if ( data.ID !== token.userId ) {
			log( 'authenticate - invalid user id', { d : data, m : bundle });
			close();
			return;
		}
		
		self.bind( socket );
	}
	
	function close() {
		socket.close();
	}
}

ns.SocketManager.prototype.validateAuthToken = function( bundle ) {
	var self = this;
	if ( !bundle )
		return false;
	
	const tokens = bundle.data.tokens;
	
	var validatedToken = {};
	try {
		validatedToken.authId = tokens.authId.toString();
		validatedToken.userId = tokens.userId.toString();
	} catch ( e ) {
		log( 'validateAuthToken - tokens failed .toString()', tokens );
		return false;
	}
	
	if ( !validatedToken.authId.length || !validatedToken.userId.length )
		return false;
	
	return validatedToken;
}

ns.SocketManager.prototype.authRequest = function( token, callback ) {
	var self = this;
	var data = {
		module  : 'system',
		command : 'userinfoget',
		authid  : token.authId,
	};
	
	var req = {
		path : '/system.library/module/',
		data : data,
		success : success,
		error : error,
	};
	fcRequest.post( req );
	
	function success( data ) {
		callback( data );
	}
	
	function error( err ) {
		log( 'authRequest.error', err );
		callback( false );
	}
}

ns.SocketManager.prototype.bind = function( socket ) {
	var self = this;
	var sid = socket.id;
	self.sockets[ sid ] = socket;
	
	socket.onclose = onClose;
	socket.on( 'session', sessionEvent );
	socket.on( 'msg', msg );
	
	socket.authenticate( true );
	
	function onClose() {
		self.removeSocket( sid );
	}
	function sessionEvent( e ) { self.handleSession( e, socket.id ); }
	function msg( e ) { self.receiveMessage( e, socket.id ); }
}

ns.SocketManager.prototype.receiveMessage = function( msg, socketId ) {
	log( 'receiveMessage(), your implementation here', msg );
}

ns.SocketManager.prototype.unbind = function( socket ) {
	var self = this;
	if ( !socket )
		return;
	
	socket.removeAllListeners( 'session' );
	socket.removeAllListeners( 'msg' );
}

ns.SocketManager.prototype.checkSession = function( sessionId, socket ) {
	var self = this;
	var session = self.getSession( sessionId );
	if ( !session ) {
		socket.unsetSession( unsetBack );
		function unsetBack() {
			socket.close();
		}
		return;
	}
	
	self.replaceSession( session, socket );
}

// restore a session, maybe
ns.SocketManager.prototype.handleSession = function( sessionId, socketId ) {
	var self = this;
	if ( !sessionId ) { // empty session id menas the client is closing the session
		log( 'handleSession - sid null, closing' );
		self.removeSocket( socketId );
		//socket.close();
		return;
	}
	
	var session = self.getSession( sessionId );
	var socket = self.sockets[ socketId ];
	self.replaceSession( session, socket );
}

ns.SocketManager.prototype.replaceSession = function( session, socket ) {
	var self = this;
	if ( !socket || !session ) {
		log( 'replaceSession - missing stuffs', {
			soId : socket.id,
			seId : session.id,
		});
		self.removeSocket( socket );
		return;
	}
	
	const sid = socket.id;
	var conn = socket.detach();
	if ( !conn ) {
		self.removeSocket( socket );
		return;
	}
	
	session.attach( conn );
	self.removeSocket( socket );
}

ns.SocketManager.prototype.setSession = function( socket, parentId ) {
	var self = this;
	var sessionId = self.makeSessionId();
	socket.setSession( sessionId, parentId );
	self.sessions[ sessionId ] = socket;
}

ns.SocketManager.prototype.getSession = function( id ) {
	var self = this;
	var session = self.sessions[ id ];
	if ( !session )
		return null;
	
	return session;
}

ns.SocketManager.prototype.removeSocket = function( subject ) {
	var self = this;
	var id = null;
	var socket = null;
	
	// subject might be a id or actual socket
	if ( 'string' === typeof( subject )) {
		id = subject;
		socket = self.sockets[ id ];
	} else {
		subject.close();
	}
	
	if ( !socket )
		return;
	
	if ( socket.sessionId )
		removeSession( socket.sessionId, sessionClosed );
	else
		sessionClosed();
	
	function sessionClosed() {
		self.unbind( socket );
		socket.close();
		delete self.sockets[ id ];
	}
	
	function removeSession( sid, callback ) {
		var session = self.sessions[ sid ];
		if ( !session )
			return;
		
		delete self.sessions[ sid ];
		var parent = self.getParent( session.parentId );
		if ( parent )
			parent.detachSession( session.id );
		
		session.unsetSession( callback );
	}
}

ns.SocketManager.prototype.makeSocketId = function() {
	var self = this;
	do {
		var newId = uuid.get();
		var exists = !!self.sessions[ newId ];
	} while ( exists )
	
	return newId;
}

ns.SocketManager.prototype.makeSessionId = function() {
	var self = this;
	var sid = uuid.get( 'session' );
	return sid;
}

ns.SocketManager.prototype.on = function( subscriber, callback ) {
	ns.subscriber[ subscriber ] = callback;
}

ns.SocketManager.prototype.off = function( subscriber ) {
	delete ns.subscriber[ subscriber ];
}

ns.SocketManager.prototype.randomClose = function( socket ) {
	var self = this;
	var delay = getDelay();
	setTimeout( doClose, delay );
	
	function doClose() {
		socket.closeWs();
	}
	
	function getDelay() {
		var delay = 1000 * 15 // 15 sec
		delay = delay * Math.random(); // scale
		delay += 5000; // min 5 sec, max 19.9999999 sec ( math.random is [-) )
		return delay;
	}
}

module.exports = ns.SocketManager;
