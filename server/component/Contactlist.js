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
	const self = this;
	self.serviceId = {};
	self.clientId = {};
}

this.Contactlist.prototype.set = function( contact ) {
	const self = this;
	if ( !contact.serviceId || !contact.clientId ) {
		log( 'missing .serviceId or .clientId: ', contact );
		return;
	}
	
	self.serviceId[ contact.serviceId ] = contact;
	self.clientId[ contact.clientId ] = contact;
	
	self.updateProps();
}

this.Contactlist.prototype.update = function( contact ) {
	const self = this;
	self.set( contact );
}

this.Contactlist.prototype.remove = function( id ) {
	const self = this;
	var contact = self.get( id );
	if ( !contact ) {
		log( 'no contact for id: ', id );
		return;
	}
	
	delete self.serviceId[ contact.serviceId ];
	delete self.clientId[ contact.clientId ];
	
	self.updateProps();
}

this.Contactlist.prototype.get = function( id ) {
	const self = this;
	if( self.serviceId[ id ] )
		return self.serviceId[ id ];
	else
		return self.clientId[ id ];
}

this.Contactlist.prototype.getServiceIdList = function() {
	const self = this;
	return self.sids || [];
}

this.Contactlist.prototype.getClientIdList = function() {
	const self = this;
	return self.cids || [];
}

this.Contactlist.prototype.updateProps = function() {
	const self = this;
	let sids = Object.keys( self.serviceId );
	let cids = Object.keys( self.clientId );
	self.length = sids.length;
	self.sids = sids;
	self.cids = cids;
}

module.exports = this.Contactlist;
