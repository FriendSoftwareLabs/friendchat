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

library.component = library.component || {};

// SOCKET
(function( ns, undefined ) {
	ns.Socket = function( conf ) {
		if ( !( this instanceof ns.Socket ))
			return new ns.Socket( conf );
		
		const self = this;
		// REQUIRED CONFIG
		self.url = conf.url;
		self.protocol = conf.protocol;
		self.authBundle = conf.authBundle;
		self.onmessage = conf.onmessage;
		self.onstate = conf.onstate;
		self.onend = conf.onend;
		
		// PROPERTIES USEFUL TO PUBLIC
		self.ready = false;
		
		// INTERNAL
		self.ws = null;
		self.session = null;
		self.sendQueue = [];
		self.allowReconnect = true;
		self.pingInterval = null; // reference to setInterval id
		self.pingStep = 1000 * 15; // time between pings
		self.pingTimeouts = {}; // references to timeouts for sent pings
		self.pingMaxTime = 1000 * 10; // timeout
		self.reconnectDelay = 200; // ms
		self.reconnectAttempt = 0; // delay is multiplied with attempts
		                           //to find how long the next delay is
		self.reconnectMaxAttempts = 7; // 0 to keep hammering
		self.reconnectScale = {
			min : 5,
			max : 8,
		}; // random in range, makes sure not all the clients
		   // in the world reconnect at the same time
		
		self.init();
	}
	
	// PUBLIC INTERFACE
	
	ns.Socket.prototype.send = function( msgObj ) {
		const self = this;
		var wrap = {
			type : 'msg',
			data : msgObj,
		};
		self.sendOnSocket( wrap );
	}
	
	ns.Socket.prototype.reconnect = function() {
		const self = this;
		console.log( 'Socket.reconnect', self.session );
		self.allowReconnect = true;
		self.doReconnect( true );
	}
	
	// code and reason can be whatever; the socket is closed anyway,
	// whats the server going to do? cry more lol
	ns.Socket.prototype.close = function( code, reason ) {
		const self = this;
		self.unsetSession();
		self.allowReconnect = false;
		self.onmessage = null;
		self.onstate = null;
		self.onend = null;
		self.wsClose( code, reason );
	}
	
	// PRIVATES
	
	ns.Socket.prototype.init = function() {
		const self = this;
		if ( !self.onmessage || !self.onstate || !self.onend ) {
			console.log( 'Socket - missing handlers', {
				onmessage : self.onmessage,
				onstate : self.onstate,
				onend : self.onend,
			});
			throw new Error( 'Socket - missing handlers' );
		}
		
		self.messageMap = {
			'authenticate' : authenticate,
			'session'      : session,
			'ping'         : ping,
			'pong'         : pong,
		};
		
		function authenticate( e ) { self.handleAuth( e ); }
		function session( e ) { self.handleSession( e ); }
		function ping( e ) { self.handlePing( e ); }
		function pong( e ) { self.handlePong( e ); }
		
		self.connect();
	}
	
	ns.Socket.prototype.connect = function() {
		const self = this;
		if ( self.ws )
			self.cleanup();
		
		if ( !self.url || !self.url.length ) {
			console.log( 'socket.url', self.url );
			throw new Error( 'no url provided for socket' );
		}
		
		self.clearConnectTimeout();
		self.setState( 'connect', self.url );
		var protocol = self.protocol.length ? self.protocol : null;
		try {
			self.ws = new window.WebSocket( self.url );
		} catch( e ) {
			console.log( 'connect ws ex', e );
			self.ended();
			return;
		}
		
		self.attachHandlers();
		self.connectTimeout = window.setTimeout( connectTimedout, 1000 * 15 );
		function connectTimedout( e ) {
			self.handleConnectTimeout();
		}
	}
	
	ns.Socket.prototype.attachHandlers = function() {
		const self = this;
		if ( !self.ws ) {
			console.log( 'Socket.attachHandlers - no ws', self.ws );
			return false;
		}
		
		self.ws.onopen = onOpen;
		self.ws.onclose = onClose;
		self.ws.onerror = onError;
		self.ws.onmessage = onMessage;
		
		function onOpen( e ) { self.handleOpen( e ); }
		function onClose( e ) { self.handleClose( e ); }
		function onError( e ) { self.handleError( e ); }
		function onMessage( e ) { self.handleMessage( e ); }
	}
	
	ns.Socket.prototype.clearHandlers = function() {
		const self = this;
		if ( !self.ws )
			return;
		
		self.ws.onopen = null;
		self.ws.onclose = null;
		self.ws.onerror = null;
		self.ws.onmessage = null;
	}
	
	ns.Socket.prototype.handleConnectTimeout = function() {
		const self = this;
		self.setState( 'timeout', 'ERR_CONN_TIMEOUT' );
		self.doReconnect();
	}
	
	ns.Socket.prototype.clearConnectTimeout = function() {
		const self = this;
		if ( null == self.connectTimeout )
			return;
		
		window.clearTimeout( self.connectTimeout );
		self.connectTimeout = null;
	}
	
	ns.Socket.prototype.doReconnect = function( noDelay ) {
		const self = this;
		self.cleanup();
		if ( !self.allowReconnect )	{
			console.log( 'WS reconnect aborting, disallowed', {
				allow   : self.allowReconnect,
				atempts : self.reconnectAttempt,
				session : self.session,
			});
			
			self.ended();
			return false;
		}
		
		if ( noDelay ) {
			self.clearReconnect();
			self.reconnectAttempt = 0;
			reconnect();
			return;
		}
		
		if ( null != self.reconnectTimer )
			return;
		
		if ( tooManyTries()) {
			//self.setState( 'reconnect', null );
			return;
		}
		
		const delay = calcDelay();
		const now = Date.now();
		const reconnectTime = now + delay;
		self.setState( 'reconnect', reconnectTime );
		self.reconnectTimer = window.setTimeout( reconnect, delay );
		
		function reconnect() {
			delete self.reconnectTimer;
			self.reconnectAttempt++;
			self.connect();
		}
		
		function tooManyTries() {
			if ( !self.reconnectMaxAttempts )
				return false;
			
			if ( self.reconnectAttempt >= self.reconnectMaxAttempts )
				return true;
			
			return false;
		}
		
		function calcDelay() {
			let delay = self.reconnectDelay;
			const multiplier = calcMultiplier();
			const fails = self.reconnectAttempt + 1;
			delay = delay * multiplier * fails;
			delay = Math.floor( delay );
			return delay;
		}
		
		function calcMultiplier() {
			const min = self.reconnectScale.min;
			const max = self.reconnectScale.max;
			const gap = max - min;
			const scale = Math.random();
			const point = gap * scale;
			const multiplier = min + point;
			return multiplier;
		}
	}
	
	ns.Socket.prototype.clearReconnect = function() {
		const self = this;
		if ( null == self.reconnectTimer )
			return;
		
		window.clearTimeout( self.reconnectTimer );
		delete self.reconnectTimer;
	}
	
	ns.Socket.prototype.setState = function( type, data ) {
		const self = this;
		if ( !self.onstate )
			return;
		
		const state = {
			type : type,
			data : data,
		};
		self.onstate( state );
	}
	
	ns.Socket.prototype.handleOpen = function( e ) {
		const self = this;
		console.log( 'WS.handleOpen' );
		self.clearConnectTimeout();
		self.setState( 'open', e );
		// ..waiting for authenticate challenge
	}
	
	ns.Socket.prototype.handleClose = function( e ) {
		const self = this;
		console.log( 'WS handleClosed', e );
		self.setState( 'close', e );
		self.doReconnect();
	}
	
	ns.Socket.prototype.handleError = function( e ) {
		const self = this;
		console.log( 'WS handleError', e );
		self.setState( 'error', e );
	}
	
	ns.Socket.prototype.handleMessage = function( e ) {
		const self = this;
		const msg = friendUP.tool.objectify( e.data );
		const handler = self.messageMap[ msg.type ];
		if ( !handler ) {
			if ( self.onmessage )
				self.onmessage( msg.data );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Socket.prototype.handleAuth = function( success ) {
		const self = this;
		if ( null == success ) {
			self.sendAuth();
			return;
		}
		
		if ( !success ) {
			console.log( 'hello.ws.handleAuth - failed to auth', self.authBundle );
			const err = {
				type : 'error',
				data : 'Authentication with server failed',
			};
			self.setState( err );
			self.ended();
			return;
		}
		
		self.setReady();
		self.setState( 'auth', success );
	}
	
	ns.Socket.prototype.handleSession = function( sessionId ) {
		const self = this;
		self.session = sessionId;
		if ( !self.session ) {
			self.ended();
			return;
		} else
			self.reconnectAttempt = 0;
		
		if ( !self.ready )
			self.setReady();
		
		self.setState( 'session', self.session );
	}
	
	ns.Socket.prototype.restartSession = function() {
		const self = this;
		var session = {
			type : 'session',
			data : self.session,
		};
		self.sendOnSocket( session, true );
		self.session = null;
	}
	
	ns.Socket.prototype.unsetSession = function() {
		const self = this;
		self.session = null;
		const msg = {
			type : 'session',
			data : self.session,
		};
		self.sendOnSocket( msg );
	}
	
	ns.Socket.prototype.sendAuth = function() {
		const self = this;
		if ( self.session ) {
			self.restartSession();
			return;
		}
		
		const authMsg = {
			type : 'authenticate',
			data : self.authBundle,
		};
		self.sendOnSocket( authMsg, true );
	}
	
	ns.Socket.prototype.setReady = function() {
		const self = this;
		self.ready = true;
		self.startPing();
		self.executeSendQueue();
	}
	
	ns.Socket.prototype.sendOnSocket = function( msgObj, force ) {
		const self = this;
		if ( !wsReady() ) {
			queue( msgObj );
			return;
		}
		
		if ( !socketReady( force )) {
			queue( msgObj );
			return;
		}
		
		var msgStr = friendUP.tool.stringify( msgObj );
		try {
			self.ws.send( msgStr );
		} catch (e) {
			console.log( 'send on ws ex', e );
		}
		
		function queue( msg ) {
			if ( !self.sendQueue )
				self.sendQueue = [];
			
			self.sendQueue.push( msg );
		}
		
		function socketReady( force ) {
			if ( self.ready )
				return true;
			
			if ( force )
				return true;
			
			return false;
		}
		
		function wsReady() {
			var ready = !!( self.ws && ( self.ws.readyState === 1 ));
			return ready;
		}
	}
	
	ns.Socket.prototype.executeSendQueue = function() {
		const self = this;
		self.sendQueue.forEach( send );
		self.sendQueue = [];
		function send( msg ) {
			self.sendOnSocket( msg );
		}
	}
	
	ns.Socket.prototype.startPing = function() {
		const self = this;
		if ( self.pingInterval )
			self.stopPing();
		
		self.pingInterval = window.setInterval( ping, self.pingStep );
		function ping() { self.sendPing(); }
	}
	
	ns.Socket.prototype.sendPing = function( msg ) {
		const self = this;
		if ( !self.pingInterval ) {
			self.stopPing();
			return;
		}
		
		var timestamp = Date.now();
		var ping = {
			type : 'ping',
			data : timestamp,
		};
		
		self.sendOnSocket( ping );
		
		// set timeout
		var tsStr = timestamp.toString();
		var timeoutId = window.setTimeout( triggerTimeout, self.pingMaxTime );
		self.pingTimeouts[ tsStr ] = timeoutId;
		function triggerTimeout() {
			self.handlePingTimeout();
		}
	}
	
	ns.Socket.prototype.handlePingTimeout = function() {
		const self = this;
		self.doReconnect();
	}
	
	ns.Socket.prototype.handlePong = function( timestamp ) {
		const self = this;
		var timeSent = timestamp;
		var tsStr = timeSent.toString();
		var timeoutId  = self.pingTimeouts[ tsStr ];
		if ( timeoutId ) {
			window.clearTimeout( timeoutId );
			delete self.pingTimeouts[ tsStr ];
		}
		
		var now = Date.now();
		var pingTime = now - timeSent;
		self.setState( 'ping', pingTime );
	}
	
	ns.Socket.prototype.handlePing = function( e ) {
		const self = this;
		self.sendPong( e );
	}
	
	ns.Socket.prototype.sendPong = function( data ) {
		const self = this;
		var pongMsg = {
			type : 'pong',
			data : data,
		}
		self.sendOnSocket( pongMsg );
	}
	
	ns.Socket.prototype.stopPing = function() {
		const self = this;
		if ( self.pingInterval )
			window.clearInterval( self.pingInterval );
		
		self.pingInterval = null;
		
		var pingIds = Object.keys( self.pingTimeouts );
		pingIds.forEach( clear );
		self.pingTimeouts = {};
		
		function clear( tsStr ) {
			var timeout = self.pingTimeouts[ tsStr ];
			if ( !timeout )
				return;
			
			window.clearTimeout( timeout );
		}
	}
	
	ns.Socket.prototype.ended = function() {
		const self = this;
		const onend = self.onend;
		delete self.onend;
		if ( !onend )
			return;
		
		onend();
	}
	
	ns.Socket.prototype.cleanup = function() {
		const self = this;
		self.ready = false;
		self.stopPing();
		self.clearHandlers();
		self.clearReconnect();
		self.clearConnectTimeout();
		self.wsClose();
		delete self.ws;
	}
	
	ns.Socket.prototype.wsClose = function( code, reason ) {
		const self = this;
		if ( !self.ws )
			return;
		
		code = code || 1000;
		reason = reason || 'screw you guys, im going home';
		
		try {
			self.ws.close( code, reason );
		} catch (e) {
			console.log( 'close ws ex', e );
		}
	}
	
})( library.component );
