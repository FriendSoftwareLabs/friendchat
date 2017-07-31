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
