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

var WSS = require( 'ws' ).Server;
var log = require( './Log')( 'WebSocketServer' );
var ns = {};

(function ( ns, undefined ) {
	ns.WebSocketServer = function( conf ) {
		if ( !( this instanceof ns.WebSocketServer ))
			return new ns.WebSocketServer( conf );
		
		var self = this;
		self.conf = conf;
		
		if ( self.conf.tls )
			return self.createSecure();
		else
			return self.createPlain();
	}
	
	ns.WebSocketServer.prototype.createSecure = function() {
		var self = this;
		var https = require( 'https' );
		var httpsOptions = {
			key : self.conf.tls.key,
			cert : self.conf.tls.cert,
		};
		var port = self.conf.port;
		var httpsServer = https.createServer( httpsOptions, fakeListen ).listen( port );
		var wss = new WSS({ server : httpsServer });
		return wss;
		
		function fakeListen() {}
	}
	
	ns.WebSocketServer.prototype.createPlain = function() {
		var self = this;
		var port = self.conf.port;
		var wss = new WSS({ port : port });
		return wss;
	}
})( ns );


module.exports = ns.WebSocketServer;