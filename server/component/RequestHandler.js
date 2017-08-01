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
