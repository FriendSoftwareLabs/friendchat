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
	const self = this;
	self.tls = tlsConf;
	self.port = port;
	
	self.sockets = {}; // connections not logged in
	self.sessions = {}; // logged in, can now be restored from the client
	self.socketToUserId = {};
	self.key = null;
	self.cert = null;
	self.pool = null;
	
	self.initWS();
}

ns.SocketManager.prototype.initWS = function() {
	const self = this;
	const watchConf = {
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
				tls  : self.tls,
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
	const self = this;
	if ( !self.pool )
		throw new Error( 'SocketManager - no pool' );
	
	self.pool.on( 'error', poolError );
	self.pool.on( 'close', poolClose );
	self.pool.on( 'headers', poolHeader );
	self.pool.on( 'connection', poolConnection );
	
	function poolConnection( conn ) {
		const sid = self.makeSocketId();
		const conf = {
			id   : sid,
			conn : conn,
		};
		const socket = new Socket( conf );
		const patience = 1000 * 10; // 10 seconds before closing the socket,
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
			socket.release( 'authenticate' );
			socket.release( 'session' );
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
	
	let token = null;
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
		
		self.socketToUserId[ socket.id ] = token.userId;
		self.bind( socket );
	}
	
	function close() {
		socket.close();
	}
}

ns.SocketManager.prototype.validateAuthToken = function( bundle ) {
	const self = this;
	if ( !bundle )
		return false;
	
	const tokens = bundle.data.tokens;
	
	const validatedToken = {};
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
	const self = this;
	const data = {
		module  : 'system',
		command : 'userinfoget',
		authid  : token.authId,
	};
	
	const req = {
		path    : '/system.library/module/',
		data    : data,
		success : success,
		error   : error,
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
	const self = this;
	const sId = socket.id;
	self.sockets[ sId ] = socket;
	socket.on( 'close'   , e => self.removeSocket(   sId ));
	socket.on( 'session' , e => self.handleSession(  e, sId ));
	socket.on( 'msg'     , e => self.receiveMessage( e, sId ));
	
	socket.authenticate( true );
}

ns.SocketManager.prototype.receiveMessage = function( msg, socketId ) {
	log( 'receiveMessage() is redefined in chatsockets )', msg );
}

ns.SocketManager.prototype.unbind = function( socket ) {
	const self = this;
	if ( !socket )
		return;
	
	socket.release( 'session' );
	socket.release( 'msg' );
}

ns.SocketManager.prototype.checkSession = function( sessionId, socket ) {
	const self = this;
	const session = self.getSession( sessionId );
	if ( !session ) {
		socket.unsetSession()
			.then( e => {
				socket.close();
			})
			.catch( e => {
				socket.close();
			});
			
		return;
	}
	
	self.replaceSession( session, socket );
	socket.close();
}

// restore a session, maybe
ns.SocketManager.prototype.handleSession = function( sessionId, socketId ) {
	const self = this;
	if ( !sessionId ) { // empty session id menas the client is closing the session
		self.removeSocket( socketId );
		return;
	}
	
	const session = self.getSession( sessionId );
	const socket = self.getSocket( socketId );
	self.replaceSession( session, socket );
	self.removeSocket( socket.id );
}

ns.SocketManager.prototype.replaceSession = function( session, socket ) {
	const self = this;
	if ( !socket || !session ) {
		log( 'replaceSession - missing stuffs', {
			soId : !!socket,
			seId : !!session,
		});
		if ( socket )
			self.removeSocket( socket.id );
		
		return;
	}
	
	const conn = socket.detach();
	if ( !conn ) {
		socket.close();
		return;
	}
	
	session.attach( conn );
}

ns.SocketManager.prototype.setSession = function( socket, parentId ) {
	const self = this;
	const sessionId = self.makeSessionId();
	socket.setSession( sessionId, parentId );
	self.sessions[ sessionId ] = socket;
}

ns.SocketManager.prototype.getSession = function( id ) {
	const self = this;
	var session = self.sessions[ id ];
	if ( !session )
		return null;
	
	return session;
}

ns.SocketManager.prototype.getSocket = function( sId ) {
	const self = this;
	return self.sockets[ sId ] || null;
}

ns.SocketManager.prototype.removeSocket = async function( sId ) {
	const self = this;
	const socket = self.getSocket( sId );
	if ( !socket ) {
		log( 'removeSocket - no socket', sId );
		return;
	}
	
	if ( socket.sessionId ) {
		const parent = self.getParent( socket.parentId );
		if ( parent )
			parent.detachSession( sId );
		
		delete self.sessions[ socket.sessionId ];
		await socket.unsetSession();
	}
	
	delete self.socketToUserId[ sId ];
	delete self.sockets[ sId ];
	socket.close();
}

ns.SocketManager.prototype.makeSocketId = function() {
	const self = this;
	let newId = null;
	let exists = false;
	do {
		newId = uuid.get();
		exists = !!self.sessions[ newId ];
	} while ( exists )
	
	return newId;
}

ns.SocketManager.prototype.makeSessionId = function() {
	const self = this;
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
	const self = this;
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
