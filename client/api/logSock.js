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
	ns.LogSock = function( host ) {
		const self = this;
		console.log( 'LogSock', host );
		self.host = host;
		self.port = 12321;
		
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
	
	// Private
	
	ns.LogSock.prototype.init = function() {
		const self = this;
		self.log = window.console.log;
		window.console.log = logSock;
		self.connect();
		
		function logSock( a, b ) {
			self.log( a, b );
			self.send( a, b );
		}
	}
	
	ns.LogSock.prototype.connect = function() {
		const self = this;
		const host = 'wss://' + self.host + ':' + self.port;
		console.log( 'LogSock.connect', host );
		let ws = null;
		try {
			ws = new window.WebSocket( host );
		} catch( e ) {
			console.log( 'LogSock.connect - failed to connect', {
				e    : e,
				host : host,
			});
			return;
		}
		
		ws.onopen = onOpen;
		ws.onclose = onClose;
		ws.onerror = onError;
		
		function onOpen() {
			self.conn = ws;
			self.conn.onmessage = e => self.handleServerEvent( e );
		}
		
		function onClose( e ) {
			self.cleanupWS();
		}
		
		function onError( err ) {
			console.log( 'LogSock onError', err );
		}
	}
	
	ns.LogSock.prototype.handleServerEvent = function( e ) {
		const self = this;
		console.log( 'LogSock.handleServerEvent', e );
	}
	
	ns.LogSock.prototype.disconnect = function() {
		const self = this;
		self.cleanupWS();
	}
	
	ns.LogSock.prototype.cleanupWS = function() {
		const self = this;
		if ( !self.conn )
			return;
		
		delete self.conn.onopen;
		delete self.conn.onclose;
		delete self.conn.onerror;
		delete self.conn.onmessage;
		delete self.conn;
	}
	
	ns.LogSock.prototype.send = function( a, b ) {
		const self = this;
		if ( !self.conn )
			return;
		
		const event = {
			type : 'log',
			data : [ a, b ],
		};
		
		let eventStr = null;
		try {
			eventStr = JSON.stringify( event );
		} catch( e ) {
			console.log( 'LogSock - could not stringify', a );
			return;
		}
		
		self.conn.send( eventStr );
	}
	
})( api );

(function( ns, undefined ) {
	ns.LogSockView = function() {
		const self = this;
		console.log( 'LogSockView', window.View );
		if ( !window.View || !window.View.send ) {
			console.log( 'LogSockView - are you sure this is a view?' );
			return;
		}
		
		self.init();
	}
	
	ns.LogSockView.prototype.close = function() {
		const self = this;
	}
	
	// private
	
	ns.LogSockView.prototype.init = function() {
		const self = this;
	}
	
})( api );
