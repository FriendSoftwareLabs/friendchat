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

var log = require('./Log')('contactlist');
var DbContact = require('./DbContact');

this.Contactlist = function() {
	var self = this;
	self.serviceId = {};
	self.clientId = {};
}

this.Contactlist.prototype.set = function( contact ) {
	if ( !contact.serviceId || !contact.clientId ) {
		log( 'missing .serviceId or .clientId: ', contact );
		return;
	}
	
	this.serviceId[ contact.serviceId ] = contact;
	this.clientId[ contact.clientId ] = contact;
}

this.Contactlist.prototype.update = function( contact ) {
	this.set( contact );
}

this.Contactlist.prototype.remove = function( id ) {
	var contact = this.get( id );
	if ( !contact ) {
		log( 'no contact for id: ', id );
		return;
	}
	
	delete this.serviceId[ contact.serviceId ];
	delete this.clientId[ contact.clientId ];
}

this.Contactlist.prototype.get = function( id ) {
	var self = this;
	if( self.serviceId[ id ] )
		return self.serviceId[ id ];
	else
		return self.clientId[ id ];
}

this.Contactlist.prototype.getServiceIdList = function() {
	return Object.keys( this.serviceId );
}

this.Contactlist.prototype.getClientIdList = function() {
	return Object.keys( this.clientId );
}

module.exports = this.Contactlist;
