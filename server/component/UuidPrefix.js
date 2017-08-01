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

var log = require( './Log' )( 'Uuid-prefix' );
var uuid = require( 'uuid' );
var ns = {};

ns.UuidPrefix = function( prefix ) {
	if ( !( this instanceof ns.UuidPrefix ))
		return new ns.UuidPrefix( prefix );
	
	var self = this;
	self.prefix = prefix || 'id';
}

ns.UuidPrefix.prototype.get = function( prefix ) {
	var self = this;
	return self.v4( prefix );
}

ns.UuidPrefix.prototype.v1 = function( prefix ) {
	var self = this;
	var prefix = prefix || self.prefix;
	return prefix + '-' + uuid.v1();
}

ns.UuidPrefix.prototype.v4 = function( prefix ) {
	var self = this;
	var prefix = prefix || self.prefix;
	return prefix + '-' + uuid.v4();
}

module.exports = ns.UuidPrefix;
