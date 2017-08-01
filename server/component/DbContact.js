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

'use strict';

var log = require('./Log')('DbContact');
var util = require('util');
var events = require('events');
var uuid = require( './UuidPrefix' )( 'DBContact' );

var ns = this;

this.DbContact = function( pool, accountId, moduleId ) {
	if ( !( this instanceof ns.DbContact ) )
		return new this.DbContact( pool, accountId, moduleId );
	
	var self = this;
	self.conn = null;
	self.accountId = accountId;
	self.moduleId = moduleId;
	
	pool.getConnection( setConnection );
	function setConnection( err, conn ) {
		if (err) {
			log( 'problem fetching connection from pool', err );
			return false;
		}
		
		self.conn = conn;
		self.emit( 'ready' );
	}
}

util.inherits(this.DbContact, events.EventEmitter);

this.DbContact.prototype.get = function( callback ) {
	var self = this;
	
	var query = "SELECT * FROM contact WHERE accountId = " + self.conn.escape( self.accountId );
	
	if( self.moduleId )
		query += " AND moduleId = " + self.conn.escape( self.moduleId );
	
	self.conn.query( query, contactsBack )
	function contactsBack( err, rows ) {
		if ( err ) {
			log( err )
			callback( false );
			return false;
		}
		
		callback( rows );
	}
}

this.DbContact.prototype.set = function( contact, callback ) {
	var self = this;
	if ( !self.accountId || !self.moduleId )
		return false;
	
	contact.subscribeTo = false;
	contact.subscribeFrom = false;
	contact.accountId = self.accountId;
	contact.moduleId = self.moduleId;
	contact.clientId = 'id-' + uuid.v1();

	var queryTmpl = "INSERT INTO contact"
				+ " ( displayName, clientId, serviceId, accountId, moduleId, subscribeTo, subscribeFrom )"
		+ " VALUES ( $displayName, $clientId, $serviceId, $accountId, $moduleId, $subscribeTo, $subscribeFrom )";
		
	var query = queryTmpl.replace( /(\$([\w]+))/g, getQuoted );
	self.conn.query( query, queryBack );
	function queryBack( err, res ) {
		if ( err ) {
			log( 'set - err', {
				e : err,
				c : contact, });
			callback( err );
			return;
		}
		
		callback( null, contact );
	}
	
	function getQuoted() {
		var key = arguments[ 2 ];
		return self.conn.escape( contact[ key ] );
	}
}

this.DbContact.prototype.update = function( contact, callback ) {
	var self = this;
	var queryTmpl = "UPDATE contact SET"
		+ " displayName = $displayName"
		+ " WHERE clientId = $clientId";
	var query = replaceInTemplate.call(self, queryTmpl, contact );
	self.conn.query( query, queryBack );
	function queryBack( err, res ) {
		if ( err ) {
			log( 'update', err );
			callback( false );
			return;
		}
		
		callback( true );
	}
}

this.DbContact.prototype.remove = function( clientId, callback ) {
	var self = this;
	var query = "DELETE FROM contact WHERE clientId = " + this.conn.escape( clientId );
	self.conn.query( query, queryBack );
	function queryBack( err, res ) {
		if ( err ) {
			log( 'remove', err );
			queryBack( false );
			return;
		}
		
		callback( true );
	}
}


function replaceInTemplate( queryTmpl, queryValues ) {
	var self = this;
	
	return queryTmpl.replace( /(\$([\w]+))/g, getQuoted );
	function getQuoted() {
		var key = arguments[ 2 ];
		return self.conn.escape( queryValues[ key ] );
	}
}

module.exports = this.DbContact;
