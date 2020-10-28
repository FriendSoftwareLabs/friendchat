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
var events = require('events');
var uuid = require( './UuidPrefix' )( 'account' );
var conf = require( './Config' );

var accountDefaults = global.config.server.defaults.account;
var nativeKeys = {
	'name' : true,
};

this.DbAccount = function( pool, friendId, accountId ) {
	if ( !pool )
		throw new Error( 'missing params' );
	
	const self = this;
	self.pool = pool;
	self.friendId = String( friendId ) || null;
	self.accountId = accountId;
}

this.DbAccount.prototype.close = function() {
	const self = this;
	delete self.pool;
	delete self.friendId;
}

this.DbAccount.prototype.get = async function( clientId ) {
	const self = this;
	if ( !self.friendId )
		throw new Error( 'account.get - self.friendId not set' );
	
	const values = [ self.friendId ];
	if ( clientId )
		values.push( clientId );
	else
		values.push( null );
	
	const query = self.buildCall( 'account_get', values.length );
	let res = null;
	try {
		res = await self.pool.query( query, values );
	} catch( ex ) {
		log( 'get - query ex', ex );
		return false;
	}
	
	let accounts = res[ 0 ];
	accounts = accounts.map( parseSettings );
	accounts = accounts.map( setDefaults );
	
	if ( clientId )
		return accounts[ 0 ];
	else
		return accounts;
	
	function parseSettings( account ) {
		const settingsObj = parse( account.settings ) || {};
		account.settings = settingsObj;
		return account;
	}
	
	function setDefaults( account ) {
		account = global.config.setMissing( account, accountDefaults );
		return account;
	}
}

this.DbAccount.prototype.set = async function( account ) {
	const self = this;
	const fields = [
		'clientId',
		'userId',
		'name',
		'settings',
	];
	
	account.clientId = uuid.v4();
	account.settings = stringify( accountDefaults.settings );
	const values = [];
	fields.forEach( add );
	function add( field, index ) {
		values[ index ] = account[ field ];
	}
	
	const query = self.buildCall( 'account_set', values.length );
	let res = null;
	try {
		res = await self.pool.query( query, values );
	} catch( ex ) {
		log( 'set - query ex', ex );
		return false;
	}
	
	return account.clientId;
}

this.DbAccount.prototype.touch = async function( clientId ) {
	const self = this;
	const values = [ clientId ];
	const query = self.buildCall( 'account_touch', values.length );
	try {
		await self.pool.query( query, values );
	} catch( ex ) {
		log( 'touch - query ex', ex );
		return false;
	}
	
	return true;
}

this.DbAccount.prototype.getAccountId = async function( name ) {
	const self = this;
	const values = [
		self.friendId,
		name,
	];
	const query = self.buildCall( 'account_get_id', values.length );
	let res;
	try {
		res = await self.pool.query( query, values );
	} catch( ex ) {
		log( 'getAccountId - query ex', ex );
		return false;
	}
	
	const account = res[ 0 ][ 0 ];
	if ( !account ) {
		log( 'getAccountId - no account', {
			values : values,
			res    : res,
		});
		return false;
	}
	
	return account.clientId;
}

this.DbAccount.prototype.update = async function( account ) {
	const self = this;
	if ( !account.clientId )
		throw new Error( 'dbAccount.update - clientId required' );
	
	const keys = [
		'clientId',
		'settings',
	];
	const values = keys.map( add );
	const query = self.buildCall( 'account_update', values.length );
	let res = null;
	try {
		res = await self.pool.query( query, values );
	} catch( ex ) {
		log( 'update - query ex', ex );
		return false;
	}
	
	return true;
	
	function add( key ) {
		var value = account[ key ];
		if ( typeof value === 'undefined' )
			value = null;
		
		return value;
	}
}

this.DbAccount.prototype.updateSetting = async function( data ) {
	const self = this;
	const clientId = data.clientId
	const account = {
		clientId : clientId,
	};
	if ( isNative( data.setting )) {
		account[ data.setting ] = data.value;
		return await self.update( account );
	}
	
	let row = null;
	row = await self.get( clientId );
	if ( !row )
		return false;

	const settings = row.settings || {};
	settings[ data.setting ] = data.value;
	account.settings = stringify( settings );
	return await self.update( account );
	
	function isNative( key ) { return !!nativeKeys[ key ]; }
}

this.DbAccount.prototype.updatePass = async function( currentPass, newPass ) {
	const self = this;
	throw new Error( 'DbAccount.updatePass - not yet implemented' );
}

this.DbAccount.prototype.remove = async function( clientId ) {
	const self = this;
	const values = [ clientId ];
	const query = self.buildCall( 'account_remove', values.length );
	let res = null;
	try {
		res = await self.pool.query( query, values, removeBack );
	} catch( ex ) {
		log( 'remove - query ex', ex );
		return false;
	}
	
	return clientId;
}

// activuty

this.DbAccount.prototype.setActivity = async function( activityId, timestamp, event ) {
	const self = this;
	if ( !activityId || !timestamp ) {
		log( 'setActivity - invalid things', [ activityId, timestamp ]);
		resolve( false );
		return;
	}
	
	const eventStr = stringify( event );
	if ( !eventStr || !eventStr.length ) {
		log( 'setActivity - invalid event', event );
		resolve( false );
		return;
	}
	
	const values = [
		activityId,
		timestamp,
		eventStr,
		self.accountId,
	];
	const query = self.buildCall( 'activity_set', values.length );
	let res = null;
	try {
		res = await self.pool.query( query, values );
	} catch( ex ) {
		log( 'setActivity - query ex', ex );
		return false;
	}
	
	return eventStr;
}

this.DbAccount.prototype.getActivity = async function() {
	const self = this;
	const values = [ self.accountId ];
	const query = self.buildCall( 'activity_get', values.length );
	let res = null;
	try {
		res = await self.pool.query( query, values );
	} catch( ex ) {
		log( 'getActivity - query ex', ex );
		return null;
	}
	
	const rows = res[ 0 ];
	const items = {};
	rows.map( row => {
		const id = row.clientId;
		const eventStr = row.event;
		const event = parse( eventStr );
		items[ id ] = event;
	});
	return items;
}

this.DbAccount.prototype.removeActivity = async function( activityId ) {
	const  self = this;
	if ( null == activityId )
		throw new Error( '' );
	const values = [
		activityId,
	];
	const query = self.buildCall( 'activity_remove_item', values.length );
	let res = null;
	try {
		res = await self.pool.query( query, values );
	} catch( ex ) {
		log( 'removeActivity - query ex', ex );
		return false;
	}
	
	return true;
}

this.DbAccount.prototype.clearActivities = async function( accountId ) {
	const self = this;
	log( 'clearActivities - NYI', accountId );
}

// things

this.DbAccount.prototype.buildCall = function( procName, paramsLength ) {
	const self = this;
	const phStr = self.getPlaceholderString( paramsLength );
	const call = "CALL " + procName + "(" + phStr + ")";
	return call;
}

this.DbAccount.prototype.getPlaceholderString = function( length ) {
	const arr = new Array( length );
	let str = arr.join( '?,' );
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


