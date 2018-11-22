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

var log = require('./Log')('DbAccount');
var util = require('util');
var events = require('events');
var uuid = require( './UuidPrefix' )( 'account' );
var conf = require( './Config' );

var accountDefaults = global.config.server.defaults.account;
var nativeKeys = {
	'name' : true,
};

this.DbAccount = function( pool, userId ) {
	if ( !pool )
		throw new Error( 'missing params' );
	
	var self = this;
	self.conn = null;
	self.userId = String( userId ) || null;
	
	pool.getConnection( setConnection );
	function setConnection( err, conn ) {
		if (err) {
			self.emit('err', err);
			return;
		}
		
		self.conn = conn;
		self.emit( 'ready', '' );
	}
}

util.inherits( this.DbAccount, events.EventEmitter );


this.DbAccount.prototype.get = function( clientId, callback ) {
	var self = this;
	if ( !self.userId )
		throw new Error( 'account.get - self.userId not set' );
	
	var values = [ self.userId ];
	if ( clientId )
		values.push( clientId );
	else
		values.push( null );

	var query = self.buildCall( 'account_get', values.length );
	self.conn.query( query, values, getBack );
	function getBack( err, rows ) {
		if ( err ) {
			log( 'account.get - error', err );
			callback( false );
			return;
		}
		
		var accounts = rows[ 0 ];
		accounts = accounts.map( parseSettings );
		accounts = accounts.map( setDefaults );
		
		if ( clientId )
			callback( accounts[ 0 ]);
		else
			callback( accounts );
		
		function parseSettings( account ) {
			var settingsObj = parse( account.settings ) || {};
			account.settings = settingsObj;
			return account;
		}
		
		function setDefaults( account ) {
			account = global.config.setMissing( account, accountDefaults );
			return account;
		}
	}
}

this.DbAccount.prototype.set = function( account, callback ) {
	var self = this;
	var fields = [
		'clientId',
		'userId',
		'name',
		'settings',
	];
	
	account.clientId = uuid.v4();
	account.settings = stringify( accountDefaults.settings );
	var values = [];
	fields.forEach( add );
	function add( field, index ) {
		values[ index ] = account[ field ];
	}
	
	var query = self.buildCall( 'account_set', values.length );
	self.conn.query( query, values, setBack );
	function setBack( err, result ) {
		if ( err) {
			log( 'account.set - query error', err );
			callback( false );
			return;
		}
		
		callback( account.clientId );
	}
}

this.DbAccount.prototype.touch = function( clientId, callback ) { // callback is optional
	var self = this;
	var values = [ clientId ];
	var query = self.buildCall( 'account_touch', values.length );
	self.conn.query( query, values, touchBack );
	function touchBack( err, result ) {
		if ( err ) {
			log( 'account.touch - error', err );
			if ( callback )
				callback( false );
			return;
		}
		
		if ( callback )
			callback( true );
	}
}

this.DbAccount.prototype.getAccountId = function( name, callback ) {
	var self = this;
	var values = [
		self.userId,
		name,
	];
	var query = self.buildCall( 'account_get_id', values.length );
	self.conn.query( query, values, accIdBack );
	function accIdBack( err, rows ) {
		if ( err ) {
			log( 'account.getAccountId - error', err );
			callback( false );
			return;
		}
		
		var account = rows[ 0 ][ 0 ];
		if ( !account ) {
			log( 'getAccountId - no account', values );
			callback( false );
			return;
		}
		
		callback( account.clientId );
	}
}

this.DbAccount.prototype.update = function( account, callback ) {
	var self = this;
	if ( !account.clientId )
		throw new Error( 'dbAccount.update - clientId required' );
	
	var keys = [
		'clientId',
		'settings',
	];
	var values = keys.map( add );
	var query = self.buildCall( 'account_update', values.length );
	self.conn.query( query, values, queryBack );
	
	function queryBack( err, res ) {
		if ( err ) {
			log( 'update.queryBack - error', err );
			callback( false );
			return;
		}
		
		callback( true );
	}
	
	function add( key ) {
		var value = account[ key ];
		if ( typeof value === 'undefined' )
			value = null;
		
		return value;
	}
}

this.DbAccount.prototype.updateSetting = function( data, callback ) {
	var self = this;
	var clientId = data.clientId
	var account = {
		clientId : clientId,
	};
	if ( isNative( data.setting )) {
		account[ data.setting ] = data.value;
		update( account );
	}
	else
		loadFirst();
	
	function update( account ) {
		self.update( account, updateBack );
	}
	
	function loadFirst() {
		self.get( clientId, getBack );
		function getBack( row ) {
			if ( !row ) {
				callback( false );
				return;
			}
			addSetting( row );
		}
		
		function addSetting( row ) {
			var settings = row.settings || {};
			settings[ data.setting ] = data.value;
			account.settings = stringify( settings );
			update( account );
		}
	}
	
	function updateBack() {
		callback( true );
	}
	
	function isNative( key ) { return !!nativeKeys[ key ]; }
}

this.DbAccount.prototype.updatePass = function( currentPass, newPass, callback ) {
	var self = this;
}

this.DbAccount.prototype.remove = function( clientId, callback ) {
	var self = this;
	var values = [ clientId ];
	var query = self.buildCall( 'account_remove', values.length );
	self.conn.query( query, values, removeBack );
	function removeBack( err, res ) {
		if ( err ) {
			log( 'account.remove - err', err );
			callback( false );
			return;
		}
		
		callback( clientId );
	}
}

this.DbAccount.prototype.buildCall = function( procName, paramsLength ) {
	var self = this;
	var phStr = self.getPlaceholderString( paramsLength );
	var call = "CALL " + procName + "(" + phStr + ")";
	return call;
}

this.DbAccount.prototype.getPlaceholderString = function( length ) {
	var arr = new Array( length );
	var str = arr.join( '?,' );
	str += '?';
	return str;
}

module.exports = this.DbAccount;


// Helpers
function parse( string ) {
	try {
		return JSON.parse( string );
	} catch ( e ) {
		return null;
	}
}

function stringify( obj ) {
	try {
		return JSON.stringify( obj );
	} catch( e ) {
		return '';
	}
}


