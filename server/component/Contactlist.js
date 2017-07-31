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
