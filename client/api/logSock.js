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

var api = window.api || {};

(function( ns, undefined ) {
	ns.LogSock = function( host, name ) {
		const self = this;
		self.name = name;
		self.host = host;
		self.port = 12321;
		self.maxTries = 0;
		self.connectTries = 0;
		self.tryTimeout = 1000 * 1;
		self.maxDelay = 1000 * 30;
		self.online = false;
		self.eventBuffer = [];
		
		self.init();
	}
	
	ns.LogSock.prototype.close = function() {
		const self = this;
		if ( self.log )
			window.console.log = self.log;
		
		if ( self.conn )
			self.disconnect();
		
		delete self.log;
		delete self.host;
		delete self.port;
	}
	
	ns.LogSock.prototype.reconnect = function() {
		const self = this;
		if ( self.conn )
			delete self.conn.onclose;
		
		self.disconnect();
		self.setInitLog();
		self.connectTries = 0;
		self.connect();
	}
	
	ns.LogSock.prototype.setName = function( name ) {
		const self = this;
		self.name = name;
		self.sendName();
	}
	
	ns.LogSock.prototype.handleViewLog = function( args, viewName ) {
		const self = this;
		self.sendLog( args[ 0 ], args[ 1 ], args[ 2 ], viewName );
	}
	
	// Private
	
	ns.LogSock.prototype.init = function() {
		const self = this;
		self.log = window.console.log;
		self.setInitLog();
		self.connect();
	}
	
	ns.LogSock.prototype.setInitLog = function() {
		const self = this;
		window.console.log = logSock;
		
		function logSock( a, b ) {
			self.log( a, b );
			if ( !self.online )
				self.buffer( a, b );
			else
				self.sendLog( a, b );
			
		}
	}
	
	ns.LogSock.prototype.connect = function() {
		const self = this;
		const host = 'wss://' + self.host + ':' + self.port;
		let ws = null;
		if ( null != self.reconnectTimeout )
			return;
		
		if ( !!self.maxTries && ( self.connectTries >= self.maxTries )) {
			console.log( 'LogSock.connect - ran out of reconnect tries, aborting', {
				tries : self.connectTries,
				max   : self.maxTries,
			});
			self.setOffline();
			return;
		}
		
		if ( self.connectTries == 0 ) {
			tryConnect();
			return;
		}
		
		let delay = self.tryTimeout * self.connectTries;
		if ( delay > self.maxDelay )
			delay = self.maxDelay;
		
		window.setTimeout( tryConnect, delay );
		
		function tryConnect() {
			self.connectTries++;
			try {
				ws = new window.WebSocket( host );
			} catch( e ) {
				console.log( 'LogSock.connect - failed to connect', {
					e    : e,
					host : host,
				});
				self.reconnectTimeout = window.setTimeout( reconnect, self.tryTimeout );
				return;
			}
			
			self.bindWS( ws );
		}
		
		function reconnect() {
			self.connect();
		}
	}
	
	ns.LogSock.prototype.bindWS = function( ws ) {
		const self = this;
		ws.onopen = onOpen;
		ws.onclose = onClose;
		ws.onerror = onError;
		
		function onOpen() {
			ws.onopen = null;
			self.setOpen( ws );
		}
		
		function onClose( e ) {
			ws.onclose = null;
			self.online = false;
			self.cleanupWS();
			self.connect();
		}
		
		function onError( err ) {
			if ( self.conn )
				return;
			
			ws.onopen = null;
			ws.onerror = null;
			ws.onmessage = null;
		}
	}
	
	ns.LogSock.prototype.setOpen = function( ws ) {
		const self = this;
		if ( self.conn )
			self.cleanupWS();
		
		self.conn = ws;
		self.setOnline();
		self.conn.onmessage = e => self.handleServerEvent( e );
	}
	
	ns.LogSock.prototype.handleServerEvent = function( e ) {
		const self = this;
		console.log( 'LogSock.handleServerEvent', e );
	}
	
	ns.LogSock.prototype.setOnline = function() {
		const self = this;
		self.online = true;
		self.connectTries = 0;
		if ( self.name )
			self.sendName();
		
		self.eventBuffer.forEach( e => self.sendLog( e[ 0 ], e[ 1 ], e[ 2 ], e[ 3 ] ));
		self.eventBuffer = [];
	}
	
	ns.LogSock.prototype.setOffline = function() {
		const self = this;
		self.online = false;
	}
	
	ns.LogSock.prototype.disconnect = function() {
		const self = this;
		self.cleanupWS();
	}
	
	ns.LogSock.prototype.cleanupWS = function() {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.onmessage = null;
		self.conn.onopen = null;
		self.conn.onclose = null;
		self.conn.onerror = null;
		
		try {
			self.conn.close();
		} catch( e ) {}
		
		delete self.conn;
	}
	
	ns.LogSock.prototype.buffer = function( a, b ) {
		const self = this;
		self.eventBuffer.push([ a, b, Date.now() ]);
		if ( 300 > self.eventBuffer.length )
			return;
		
		self.eventBuffer = self.eventBuffer.slice( -200 );
	}
	
	ns.LogSock.prototype.sendLog = function( a, b, time, viewName ) {
		const self = this;
		time = time || Date.now();
		viewName = viewName || null;
		if ( !self.conn || !self.online ) {
			self.eventBuffer.push([ a, b, time, viewName ]);
			return;
		}
		
		const event = {
			type : 'log',
			data : {
				time     : time,
				viewName : viewName,
				args     : [ a, b ],
			},
		};
		self.send( event );
	}
	
	ns.LogSock.prototype.sendName = function() {
		const self = this;
		const name = {
			type : 'init',
			data : {
				name : self.name,
			},
		};
		self.send( name );
	}
	
	ns.LogSock.prototype.send = function( event ) {
		const self = this;
		let eventStr = null;
		try {
			eventStr = JSON.stringify( event );
		} catch( e ) {
			//console.log( 'LogSock - json err', e );
			return;
		}
		
		try {
			self.conn.send( eventStr );
		} catch( e ) {
			//console.log( 'LogSock - send err', e );
			return;
		}
	}
	
})( api );

(function( ns, undefined ) {
	ns.LogSockView = function() {
		const self = this;
		if ( !window.View || !window.View.send ) {
			console.log( 'LogSockView - are you sure this is a view?' );
			return;
		}
		
		self.log = null;
		
		self.init();
	}
	
	ns.LogSockView.prototype.close = function() {
		const self = this;
	}
	
	// private
	
	ns.LogSockView.prototype.init = function() {
		const self = this;
		self.log = console.log;
		console.log = logSock;
		
		function logSock( a, b ) {
			self.log( a, b );
			self.sendLog([ a, b, Date.now() ]);
		}
	}
	
	ns.LogSockView.prototype.sendLog = function( args ) {
		const self = this;
		window.View.sendTypeEvent( 'log-sock', args );
	}
	
})( api );
