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
