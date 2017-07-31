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

var log = require( './Log' )( 'Router' );

this.Router = function( routeName ) {
	var self = this;
	self.routeName = routeName;
	self.route = {
		post : {},
		get : {},
	};
}

this.Router.prototype.message = function( msg, res ) {
	var verb = msg.verb.toLowerCase();
	var part = msg.route.shift();
	
	var endpoint = this.route[ verb ][ part ];
	if ( !endpoint ) {
		log( 'route not found: ', part );
		res.send({
			success : false,
			message : 'invalid endpoint',
		});
		return;
	}
	
	endpoint( msg, res );
}

this.Router.prototype.post = function( route, handler ) {
	this.route.post[ route ] = handler;
}

this.Router.prototype.get = function( route, handler ) {
	this.route.get[ route ] = handler;
}

module.exports = this.Router;
