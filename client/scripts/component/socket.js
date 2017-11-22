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
		
		var self = this;
		
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
		self.reconnectAttempt = 1; // delay is multiplied with attempts
		                           //to find how long the next delay is
		self.reconnectMaxAttempts = 8; // 0 to keep hammering
		self.reconnectScale = {
			min : 5,
			max : 8,
		}; // random in range, makes sure not all the sockets
		   // in the world reconnect at the same time
		
		self.init();
	}
	
	// PUBLIC INTERFACE
	
	ns.Socket.prototype.send = function( msgObj ) {
		var self = this;
		var wrap = {
			type : 'msg',
			data : msgObj,
		};
		self.sendOnSocket( wrap );
	}
	
	ns.Socket.prototype.reconnect = function() {
		var self = this;
		self.allowReconnect = true;
		self.doReconnect();
	}
	
	// code and reason can be whatever, the socket is closed anyway,
	// whats the server going to do? cry more lol
	ns.Socket.prototype.close = function( code, reason ) {
		var self = this;
		self.unsetSession();
		self.allowReconnect = false;
		self.onmessage = null;
		self.onstate = null;
		self.onend = null;
		self.wsClose( code, reason );
	}
	
	// PRIVATES
	
	ns.Socket.prototype.init = function() {
		var self = this;
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
		var self = this;
		if ( self.ws )
			return;
		
		if ( !self.url || !self.url.length ) {
			console.log( 'socket.url', self.url );
			throw new Error( 'no url provided for socket' );
		}
		
		self.setState( 'connecting' );
		console.log( 'Socket: connecting to', self.url );
		var protocol = self.protocol.length ? self.protocol : null;
		try {
			self.ws = new window.WebSocket( self.url );
		} catch( e ) {
			self.logEx( e, 'connect' );
		}
		
		self.attachHandlers();
	}
	
	ns.Socket.prototype.attachHandlers = function() {
		var self = this;
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
		var self = this;
		self.ws.onopen = null;
		self.ws.onclose = null;
		self.ws.onerror = null;
		self.ws.onmessage = null;
	}
	
	ns.Socket.prototype.doReconnect = function() {
		var self = this;
		if ( self.ws ) {
			self.cleanup();
		}
		
		if ( !reconnectAllowed() ){
			self.ended();
			return false;
		}
		
		if ( self.reconnectTimer )
			return true;
		
		var delay = calcDelay();
		var showReconnectLogTimeLimit = 1000 * 5; // 5 seconds
		if ( delay > showReconnectLogTimeLimit )
			self.setState( 'reconnect', delay );
		
		self.reconnectTimer = window.setTimeout( reconnect, delay );
		
		function reconnect() {
			self.reconnectTimer = null;
			self.reconnectAttempt += 1;
			self.connect();
		}
		
		function reconnectAllowed() {
			var checks = {
				allow : self.allowReconnect,
				hasTriesLeft : !tooManyTries(),
				hasSession : !!self.session,
			};
			
			var allow = !!( true
				&& checks.allow
				&& checks.hasTriesLeft
				&& checks.hasSession
			);
			
			if ( !allow ) {
				console.log( 'not allowed to reconnect', checks )
				return false;
			}
			return true;
			
			function tooManyTries() {
				if ( !self.reconnectMaxAttempts )
					return false;
				
				if ( self.reconnectAttempt >= self.reconnectMaxAttempts )
					return true;
				
				return false;
			}
		}
		
		function calcDelay() {
			var delay = self.reconnectDelay;
			var multiplier = calcMultiplier();
			var tries = self.reconnectAttempt;
			return delay * multiplier * tries;
		}
		
		function calcMultiplier() {
			var min = self.reconnectScale.min;
			var max = self.reconnectScale.max;
			var gap = max - min;
			var scale = Math.random();
			var point = gap * scale;
			var multiplier = min + point;
			return multiplier;
		}
	}
	
	ns.Socket.prototype.setState = function( type, data ) {
		var self = this;
		var state = {
			type : type,
			data : data,
		};
		self.state = state;
		if ( self.onstate )
			self.onstate( state );
	}
	
	ns.Socket.prototype.handleOpen = function( e ) {
		var self = this;
		self.reconnectAttempt = 0;
		console.log( 'Socket: connection open', self.url );
		// we're waiting for authenticate challenge
	}
	
	ns.Socket.prototype.handleClose = function( e ) {
		var self = this;
		console.log( 'Socket: connection closed', self.url );
		self.cleanup();
		self.setState( 'close' );
		self.doReconnect();
	}
	
	ns.Socket.prototype.handleError = function( e ) {
		var self = this;
		console.log( 'Socket: connection error for', self.url );
		self.cleanup();
		self.setState( 'error' );
		self.doReconnect();
	}
	
	ns.Socket.prototype.handleMessage = function( e ) {
		var self = this;
		var msg = friendUP.tool.objectify( e.data );
		var handler = self.messageMap[ msg.type ];
		if ( !handler ) {
			if ( self.onmessage )
				self.onmessage( msg.data );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Socket.prototype.handleAuth = function( success ) {
		var self = this;
		if ( null == success ) {
			self.sendAuth();
			return;
		}
		
		self.authenticated = success;
		if ( !self.authenticated )
			self.ended();
		else
			self.setReady();
	}
	
	ns.Socket.prototype.handleSession = function( sessionId ) {
		var self = this;
		if ( sessionId && ( self.session === sessionId )) {
			self.setReady();
			return;
		}
		
		self.session = sessionId;
		if ( !self.session ) {
			self.allowReconnect = false;
			self.ended();
		}
		
		self.setReady();
	}
	
	ns.Socket.prototype.restartSession = function() {
		var self = this;
		var session = {
			type : 'session',
			data : self.session,
		};
		self.sendOnSocket( session, true );
		self.session = null;
	}
	
	ns.Socket.prototype.unsetSession = function() {
		var self = this;
		self.session = false;
		var msg = {
			type : 'session',
			data : self.session,
		};
		self.sendOnSocket( msg );
	}
	
	ns.Socket.prototype.sendAuth = function() {
		var self = this;
		if ( self.session ) {
			self.restartSession();
			return;
		}
		
		var authMsg = {
			type : 'authenticate',
			data : self.authBundle,
		};
		self.sendOnSocket( authMsg, true );
	}
	
	ns.Socket.prototype.setReady = function() {
		var self = this;
		self.ready = true;
		self.setState( 'open' );
		self.startPing();
		self.executeSendQueue();
	}
	
	ns.Socket.prototype.sendOnSocket = function( msgObj, force ) {
		var self = this;
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
			self.logEx( e, 'sendOnSocket' );
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
		var self = this;
		self.sendQueue.forEach( send );
		self.sendQueue = [];
		function send( msg ) {
			self.sendOnSocket( msg );
		}
	}
	
	ns.Socket.prototype.startPing = function() {
		var self = this;
		if ( self.pingInterval )
			self.stopPing();
		
		self.pingInterval = window.setInterval( ping, self.pingStep );
		function ping() { self.sendPing(); }
	}
	
	ns.Socket.prototype.sendPing = function( msg ) {
		var self = this;
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
		var self = this;
		self.doReconnect();
	}
	
	ns.Socket.prototype.handlePong = function( timestamp ) {
		var self = this;
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
		var self = this;
		self.sendPong( e );
	}
	
	ns.Socket.prototype.sendPong = function( data ) {
		var self = this;
		var pongMsg = {
			type : 'pong',
			data : data,
		}
		self.sendOnSocket( pongMsg );
	}
	
	ns.Socket.prototype.stopPing = function() {
		var self = this;
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
		var self = this;
		if ( !self.onend )
			return;
		
		var onend = self.onend;
		delete self.onend;
		onend();
	}
	
	ns.Socket.prototype.cleanup = function() {
		var self = this;
		self.ready = false;
		self.stopPing();
		self.clearHandlers();
		self.wsClose();
		delete self.ws;
	}
	
	ns.Socket.prototype.wsClose = function( code, reason ) {
		var self = this;
		if ( !self.ws )
			return;
		
		code = code || 1000;
		reason = reason || 'screw you guys, im going home';
		
		try {
			self.ws.close( code, reason );
		} catch (e) {
			self.logEx( e, 'close' );
		}
	}
	
	ns.Socket.prototype.logEx = function( e, fnName ) {
		var self = this;
		console.log( 'socket.' + fnName + '() exception: ' );
		console.log( e );
	}
	
})( library.component );
