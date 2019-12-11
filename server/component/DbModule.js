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

var uuid = require( './UuidPrefix' )( 'module' );
var log = require( './Log' )( 'DbModule' );
var util = require( 'util' );
var events = require( 'events' );

// used by update to determine if something goes in the settings string or not.
// if not defined here, it does.
var nativeKeys = {
	'displayName' : true,
	'host' : true,
	'port' : true,
	'login' : true,
	'password' : true,
};

this.DbModule = function( pool, accountId, clientId ) {
	var self = this;
	self.conn = null;
	self.accountId = accountId;
	self.clientId = clientId;
	
	pool.getConnection( setConnection );
	function setConnection( err, conn ) {
		if ( err ) {
			self.emit( 'err', err );
			return;
		}
		
		self.conn = conn;
		self.emit( 'ready', null );
	}
}

util.inherits( this.DbModule, events.EventEmitter );

this.DbModule.prototype.get = function( callback ) {
	var self = this;
	var values = null;
	
	if ( self.clientId ) {
		values = [ self.accountId, self.clientId ];
		var phStr = self.getPlaceholderString( values.length );
		var query = "CALL module_get(" + phStr + ")";
	}
	else {
		values = [ self.accountId ];
		var phStr = self.getPlaceholderString( values.length );
		var query = "CALL modules_get(" + phStr + ")"; // plural
	}
	
	self.conn.query( query, values, loadBack );
	function loadBack( err, rows, fields ) {
		if (err) {
			callback( false );
			return;
		}
		
		var moduleRows = rows[ 0 ];
		var modules = moduleRows.map( parseSettings );
		if ( self.clientId ) {
			callback( modules[ 0 ] );
			return;
		}
		
		callback( modules );
	}
	
	function parseSettings( module ) {
		const settingsObj = parse( module.settings );
		if ( 'string' === typeof( settingsObj ))
			module.settings = {};
		else
			module.settings = settingsObj || {};
		
		return module;
	}
}

this.DbModule.prototype.set = function( module, callback ) {
	var self = this;
	module.accountId = self.accountId;
	module.clientId = uuid.v4();
	module = addDefaults( module );
	module.settings = stringify(( module.settings || {} ));
	
	var fields = [
		'accountId',
		'clientId',
		'type',
		'displayName',
		'host',
		'port',
		'login',
		'password',
		'settings',
	];
	var values = [];
	fields.forEach( add );
	function add( field, index ) {
		values[ index ] = module[ field ] || null;
	}
	
	var phStr = self.getPlaceholderString( fields.length );
	var query = "CALL module_set(" + phStr + ")";
	self.conn.query( query, values, queryBack );
	function queryBack( err, res ) {
		if ( err ) {
			log( 'module.set - error', err );
			callback( false );
			return;
		}
		
		callback( module.clientId );
	}
	
	function addDefaults( module ) {
		var defaults = global.config.server.defaults.module[ module.type ];
		if ( !defaults ){
			log( 'addDefaults - no defaults for', module );
			return module;
		}
		module = global.config.setMissing( module, defaults );
		return module;
	}
}

this.DbModule.prototype.update = function( module, callback ) {
	var self = this;
	if ( !self.clientId )
		throw new Error( 'dbModule.update - missing clientId' );
	
	module.clientId = self.clientId;
	if ( module.settings )
		module.settings = stringify( module.settings );
	
	var fields = [
		'clientId',
		'displayName',
		'host',
		'port',
		'login',
		'password',
		'settings',
	];
	var values = [];
	
	fields.forEach( add );
	function add( field, index ) {
		var value = module[ field ];
		if ( 'undefined' === typeof( value ))
			value = null;
		values[ index ] = value;
	}
	
	var phStr = self.getPlaceholderString( fields.length );
	var query = "CALL module_update( " + phStr + " )";
	self.conn.query( query, values, queryBack );
	function queryBack( err, result ) {
		if ( err ) {
			log( 'module.update - err', err );
			callback( false );
			return;
		}
		
		callback( module );
	}
}

this.DbModule.prototype.remove = function( clientId, callback ) {
	var self = this;
	var values = [
		self.accountId,
		clientId
	];
	var phStr = self.getPlaceholderString( values.length );
	var query = "CALL module_remove( " + phStr + " )";
	
	self.conn.query( query, values, queryBack );
	function queryBack( err, result ) {
		if ( err ) {
			log( 'module.remove - error', err );
			callback( false );
			return;
		}
		
		callback( result );
	}
}

this.DbModule.prototype.updateSetting = function( pair, callback ) {
	var self = this;
	var module = {};
	if ( isNative( pair.setting )) {
		update( pair );
	}
	else
		loadFirst();
	return;
	
	function update( pair ) {
		module[ pair.setting ] = pair.value;
		self.update( module, updateBack );
	}
	
	function loadFirst() {
		self.get( getBack );
		function getBack( row ) {
			if ( !row ) {
				callback( false );
				return;
			}
			addSetting( row );
		}
		
		function addSetting( row ) {
			module.settings = row.settings || {};
			module.settings[ pair.setting ] = pair.value;
			update( module );
		}
	}
	
	function updateBack() {
		callback( true );
	}
	
	function isNative( key ) { return !!nativeKeys[ key ]; }
}

this.DbModule.prototype.getPlaceholderString = function( length ) {
	var arr = new Array( length );
	var str = arr.join( '?,' );
	str += '?';
	return str;
}

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
		return null;
	}
}

module.exports = this.DbModule;
