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

var log = require( './Log' )( 'ChatSocket' );
var Account = require( './Account' );
var DbAccount = require( './DbAccount' );

var util = require( 'util' );
var SocketManager = require( './SocketManager' );

var ns = {};

ns.ChatSockets = function( tlsConf, serverPort, state ) {
	const self = this;
	SocketManager.call( self, tlsConf, serverPort );
	self.state = state;
	self.init();
}

util.inherits( ns.ChatSockets, SocketManager );

ns.ChatSockets.prototype.init = function() {
	const self = this;
	self.messageMap = self.messageMap || {
		'/create' : create,
		'/read' : load,
		'/remove' : remove,
		'/login' : login,
	};
	
	function create( e, sid ) { self.createAccount( e, sid ); }
	function load( e, sid ) { self.loadAccounts( e, sid ); }
	function remove( e, sid ) { self.removeAccount( e, sid ); }
	function login( e, sid ) { self.accountLogin( e, sid ); }
}

ns.ChatSockets.prototype.receiveMessage = function( msg, socketId ) {
	const self = this;
	if ( !msg || !( msg.type == 'request' )) {
		log( 'invalid request', msg, 4 );
		return;
	}
	
	if ( !msg.data ) {
		log( '--- ERROR ---' );
		log( 'receiveMessage - has no data', msg );
		return;
	}
	
	var data = msg.data;
	var handler = self.messageMap[ data.url ];
	if( !handler ) {
		log( 'receiveMessage - url not found: ', msg );
		msg.data.response = {
			success : false,
			status : 403,
		};
		self.send( msg, socketId );
		return;
	}
	
	handler( data, socketId );
}

ns.ChatSockets.prototype.send = function( msg, socketId ) {
	const self = this;
	const wrap = {
		type : 'request',
		data : msg,
	};
	const socket = self.getSocket( socketId );
	if ( !socket )
		return;
	
	socket.send( wrap );
}

ns.ChatSockets.prototype.loadAccounts = function( msg, socketId ) {
	const self = this;
	const userId = self.socketToUserId[ socketId ];
	if ( !userId ) {
		let err = new Error();
		self.logUserIdErr( socketId, err.stack );
		done();
		return;
	}
	
	const dbAccount = new DbAccount( self.state.db, userId );
	dbAccount.on( 'ready', dbReady );
	dbAccount.on( 'error', dbError );
	function dbError( err ) {
		log( 'loadAccounts.dbError', err );
		msg.response = {
			status : 500,
			message : 'db failed'
		};
		done();
		return;
	}
	
	function dbReady() {
		dbAccount.get( null, accountsBack );
	}
	
	function accountsBack( accounts ) {
		msg.response = {
			status : 200,
			data : accounts,
		},
		done();
	}
	
	function done() {
		dbAccount.conn.release();
		self.send( msg, socketId );
	}
}

ns.ChatSockets.prototype.createAccount = function( msg, socketId ) {
	const self = this;
	log( 'createAccount', msg );
	let dbAccount = null;
	const args = msg.data;
	const ret = {
		status : 403,
		success : false
	};
	
	if ( !args.name ) {
		ret.message = 'invalid input';
		done();
		return;
	}
	
	const userId = self.socketToUserId[ socketId ];
	if ( !userId ) {
		let err = new Error();
		self.logUserIdErr( socketId, err.stack );
		done();
		return;
	}
	
	dbAccount = new DbAccount( self.state.db, userId );
	dbAccount.once( 'ready', dbReady );
	
	function dbReady() {
		dbAccount.set( args, setBack );
	}
	
	function setBack( clientId ) {
		if ( !clientId ) {
			log( 'account.create - could not insert', msg );
			ret.message = 'denied - probably exists';
			done();
			return;
		}
		
		dbAccount.get( clientId, getBack );
	}
	
	function getBack( account ) {
		if ( !account ) {
			log( 'createaccount - could not load account', account );
			ret.message = 'could not load account';
			done();
			return;
		}
		
		ret.success = true;
		ret.status = 200;
		ret.data = account;
		done();
	}
	
	function done() {
		if( dbAccount )
			dbAccount.conn.release();
		
		msg.data = null;
		msg.response = ret;
		self.send( msg, socketId );
	}
}

ns.ChatSockets.prototype.removeAccount = function( msg, socketId ) {
	const self = this;
	var args = msg.data;
	var dbAccount = null;
	var ret = {
		success : false,
		status : 403
	};
	msg.response = ret;
	
	if ( !args.name ) {
		ret.message = 'missing input';
		done();
		return;
	}
	
	const userId = self.socketToUserId[ socketId ];
	if ( !userId ) {
		let err = new Error();
		self.logUserIdErr( socketId, err.stack );
		done();
		return;
	}
	
	dbAccount = new DbAccount( self.state.db, userId );
	dbAccount.once( 'ready', dbReady );
	function dbReady() {
		dbAccount.getAccountId( args.name, idBack );
	}
	
	function idBack( clientId ) {
		if( !clientId ) {
			ret.message = "wrong password, probably";
			done();
			return;
		}
		
		dbAccount.remove( clientId, removeBack );
	}
	
	function removeBack( clientId ) {
		if ( !clientId ) {
			ret.success = false;
			ret.status = 400;
			done();
			return;
		}
		
		ret.success = clientId;
		ret.status = 200;
		done();
	}
	
	function done() {
		if( dbAccount )
			dbAccount.conn.release();
		
		self.send( msg, socketId );
	}
}

ns.ChatSockets.prototype.accountLogin = function( msg, socketId ) {
	const self = this;
	var args = msg.data;
	var dbAccount = null;
	args.password = null; // pasword deprecated
	
	if ( !args.name ) {
		msg.response = {
			status : 400,
			message : 'missing arguments',
		};
		done();
		return;
	}
	
	const userId = self.socketToUserId[ socketId ];
	if ( !userId ) {
		let err = new Error();
		self.logUserIdErr( socketId, err.stack );
		done();
		return;
	}
	
	dbAccount = new DbAccount( self.state.db, userId );
	dbAccount.on( 'ready', dbReady );
	dbAccount.on( 'error', dbError );
	function dbError( err ){
		log( 'postLogin.dbError', err );
		msg.response = {
			status : 500,
			message : 'db le derpette',
		};
		done();
		return;
	}
	
	function dbReady() {
		dbAccount.getAccountId( args.name, idBack );
	}
	
	function idBack( accountId ) {
		if ( !accountId ) {
			msg.response = {
				status : 403,
				message : 'auth fail',
			};
			done();
			return;
		}
		
		loadAccount( accountId );
	}
	function loadAccount( accountId ) {
		dbAccount.get( accountId, doLogin );
	}
	function doLogin( dbAcc ) {
		if ( !dbAcc ) {
			msg.response = 'could not load account?';
			done();
			return;
		}
		
		if ( !dbAcc.clientId || !dbAcc.name )
			throw new Error( 'account.login - critical - missing clientId and/or name' );
		
		let account = self.state.account[ dbAcc.clientId ];
		
		// fresh login, need an account instance
		if ( !account ) {
			dbAcc.onclose = removeAccount;
			account = new Account( dbAcc, self.state.db );
			self.state.account[ account.clientId ] = account;
			
			function removeAccount() {
				self.unsetAccount( account.clientId );
			}
		}
		
		// hand over socket to account
		const socket = self.getSocket( socketId );
		if ( !socket ) {
			self.unsetAccount( account.clientId );
			return;
		}
		
		socket.release( 'msg' );
		self.setSession( socket, account.clientId );
		account.attachSession( socket );
		
		// setting last login
		dbAccount.touch( account.clientId );
		
		msg.response = {
			status : 200,
			success : true,
			data : dbAcc,
		};
		done();
	}
	
	function done() {
		const loggedInIds = Object.keys( self.state.account );
		const loggedInList = loggedInIds.map( getName );
		
		if( dbAccount && dbAccount.conn )
			dbAccount.conn.release();
		
		self.send( msg, socketId );
		
		function getName( accId ) {
			return self.state.account[ accId ].name;
		}
	}
}

// this is the account calling close on itself, it just needs to be deleted here
ns.ChatSockets.prototype.unsetAccount = function( id ) {
	const self = this;
	const account = self.state.account[ id ];
	if ( !account ) {
		log( 'unsetAccount - wut, no account found for???', id );
		return;
	}
	
	delete self.state.account[ id ];
	//removeSessions();
	account.close();
	
	/*
	function removeSessions() {
		const accountSessions = account.sessionKeys;
		accountSessions.forEach( close );
		function close( sessionId ) {
			const socket = self.sessions[ sessionId ]; // a session is really just a
			                                         // socket with  a sessionid set
			self.removeSocket( socket.id );
		}
	}
	*/
}

ns.ChatSockets.prototype.getParent = function( id ) {
	const self = this;
	const account = self.state.account[ id ];
	if ( !account )
		return null;
	return account;
}

ns.ChatSockets.prototype.logUserIdErr = function( socketId, stack ) {
	const self = this;
	log( 'accountLogin - no userId for socket', {
		socketId : socketId,
		idMap    : self.socketToUserId,
		stack    : stack,
	});
}

module.exports = ns.ChatSockets;
