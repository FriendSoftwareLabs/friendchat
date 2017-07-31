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

var log = require( '../component/Log')('RequestHandler');

this.RequestHandler = function() {
	var self = this;
	self.routes = {};
}

this.RequestHandler.prototype.message = function( data, socket ) {
	var self = this;
	if (!data || !data.url || !socket ) {
			log( 'missing stuff', arguments );
			return;
	}
	
	data.route = tokenize( data.url );
	if ( !data.route )
		return;
	
	var part = data.route.shift();
	var response = buildResponse( data, socket );
	
	if ( self.routes[ part ] )
		self.routes[ part ].message( data, response );
	else {
		log( 'route not found for: ', part );
		log( 'in request: ', data );
	}
}

this.RequestHandler.prototype.use = function( route, router ) {
	this.routes[ route ] = router;
}

function buildResponse( msg, socket ) {
	var response = {};
	response.send = function( data ) {
		msg.response = data;
		socket.send({
			type : 'request',
			data : msg,
		});
	}
	return response;
}

function tokenize( route ) {
	try {
		var parts = route.split('/');
	} catch ( ex ) {
		log( ex );
		return;
	}
	
	return parts.filter( isPart ).map( addPreSlash );
	
	function isPart( part ) {
		if ( part )
			return true;
	}
	
	function addPreSlash( part ) {
		return '/' + part;
	}
}


module.exports = this.RequestHandler;
