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

var log = require( './Log' )( 'Account' );
//var MsgHandler = require( './MsgHandler' );
var ModCtrl = require( './ModCtrl' );
var DbAccount = require( './DbAccount' );

var ns = {};

ns.Account = function( conf, dbPool ) {
	if( !( this instanceof ns.Account ))
		return new ns.Account( state, conf );
	
	var self = this;
	self.db = dbPool;
	self.onclose = conf.onclose;
	self.clientId = conf.clientId;
	self.userId = conf.userId;
	self.name = conf.name;
	self.isFirstLogin = !conf.lastLogin;
	self.advancedUI = conf.settings.advancedUI;
	self.sessions = {};
	self.sessionKeys = [];
	self.mods = null;
	self.msgMap = null;
	
	self.init();
}

ns.Account.prototype.init = function() {
	var self = this;
	if ( !self.isFirstLogin && null == self.advancedUI )
		self.advancedUI = true;
	
	self.setupModCtrl( self.advancedUI );
	
	self.msgMap = {
		'ping'    : keepAlive,
		'module'  : moduleEvent,
		'account' : accountMsg,
	};
	function keepAlive( e, sessionId ) { self.keepAlive( e, sessionId ); }
	function moduleEvent( e, sessionId ) { self.mods.receiveMsg( e, sessionId ); }
	function accountMsg( e, sessionId ) { self.accountMsg( e, sessionId ); }
	
	self.accountMsgMap = {
		'ready'    : clientReady,
		'settings' : getSettings,
		'setting'  : saveSetting,
	};
	
	function clientReady( e, sessionId ) { self.clientReady( e, sessionId ); }
	function getSettings( e, sessionId ) { self.getSettings( sessionId ); }
	function saveSetting( e, sessionId ) { self.saveSetting( e, sessionId ); }
	
	if ( self.isFirstLogin )
		return;
	
	self.mods.initializeModules();
}

ns.Account.prototype.attachSession = function( session ) {
	var self = this;
	const sid = session.id;
	self.sessions[ sid ] = session;
	self.sessionKeys = Object.keys( self.sessions );
	
	session.on( 'msg', msg );
	
	function msg( msg ) {
		self.receiveMsg( msg, sid );
	}
}

ns.Account.prototype.detachSession = function( id ) {
	var self = this;
	var session = self.sessions[ id ];
	if ( !session ) {
		log( 'detachScoket - no session found for ' + id + ' in', self.sessions );
		return null;
	}
	
	session.removeAllListeners( 'msg' );
	self.removeSession( id );
	return session;
}

ns.Account.prototype.removeSession = function( sessionId ) {
	var self = this;
	delete self.sessions[ sessionId ];
	self.sessionKeys = Object.keys( self.sessions );
	if ( !self.sessionKeys.length )
		self.logout();
}

ns.Account.prototype.receiveMsg = function( msg, sessionId ) {
	var self = this;
	var handler = self.msgMap[ msg.type ];
	if ( handler ) {
		handler( msg.data, sessionId );
		return;
	}
	
	// not account event, pass on to ModCtrl
	msg = self.mods.receiveMsg( msg, sessionId );
	if ( !msg ) // if a handler is found for the event, it gets eaten and null is returned
		return;
	
	log( 'receiveMsg - unknown event', msg );
}

ns.Account.prototype.keepAlive = function( data, sessionId ) {
	var self = this;
	var pong = {
		type : 'pong',
		data : data,
	};
	self.toClient( pong, sessionId );
}

ns.Account.prototype.accountMsg = function( msg, sessionId ) {
	var self = this;
	var handler = self.accountMsgMap[ msg.type ];
	if ( !handler ) {
		log( 'accountMsg - no handler for ', msg );
		return;
	}
	
	handler( msg.data, sessionId );
}

ns.Account.prototype.clientReady = function( firstLoginConf, sessionId ) {
	var self = this;
	if ( null != firstLoginConf )
		self.doFirstLoginSetup( firstLoginConf );
	else
		self.mods.initializeClient( sessionId );
}

ns.Account.prototype.getSettings = function( sessionId ) {
	var self = this;
	var dbAccount = new DbAccount( self.db, self.userId );
	dbAccount.once( 'ready', dbReady );
	function dbReady( err ) {
		dbAccount.get( self.clientId, accountBack );
	}
	function accountBack( account ) {
		var msg  = {
			type : 'settings',
			data : account,
		};
		self.sendAccountMsg( msg, sessionId );
		dbAccount.conn.release();
	}
}

ns.Account.prototype.saveSetting = function( data, sessionId ) {
	var self = this;
	var dbAccount = new DbAccount( self.db, self.userId );
	dbAccount.once( 'ready', dbReady );
	function dbReady( err ) {
		data.clientId = self.clientId;
		dbAccount.updateSetting( data, updateBack );
	}
	
	function updateBack( success ) {
		data.success = success;
		done();
	}
	
	function done() {
		if ( dbAccount )
			dbAccount.conn.release();
		var wrap = {
			type : 'setting',
			data : data,
		};
		self.sendAccountMsg( wrap );
	}
}

ns.Account.prototype.updateClientSetting = function( update ) {
	var self = this;
}

ns.Account.prototype.doFirstLoginSetup = function( conf ) {
	const self = this;
	// save ui choice
	self.saveSetting({
		setting : 'advancedUI',
		value   : conf.advancedUI,
	});
	
	// setup modCtrl
	self.setupModCtrl( conf.advancedUI );
	
	// add default modules for choice
	let mods = null;
	if ( conf.advancedUI )
		mods = [ 'presence', 'irc' ];
	else
		mods = [ 'presence', 'treeroot' ];
		
	self.mods.addDefaultModules( mods, self.name );
}

ns.Account.prototype.setupModCtrl = function( allowAdvanced ) {
	const self = this;
	const modConf = {
		db            : self.db,
		accountId     : self.clientId,
		allowAdvanced : allowAdvanced,
		onsend        : onModSend,
	};
	self.mods = new ModCtrl( modConf );
	function onModSend( e, sid ) { self.toClient( e, sid ); }
}

ns.Account.prototype.logout = function() {
	const self = this;
	log( 'logout', self.name );
	self.mods.close();
	var onclose = self.onclose;
	delete self.onclose;
	if ( !!onclose && ( 'function' === typeof( onclose )))
		onclose();
}

ns.Account.prototype.close = function() {
	var self = this;
	if ( self.sessionKeys && self.sessionKeys.length )
		allSessionsMustDie();
	
	self.sessions = {};
	self.sessionKeys = [];
	delete self.onclose;
	delete self.db;
	
	function allSessionsMustDie() {
		self.sessionKeys.forEach( remove );
		function remove( sessionKey ) {
			self.sessions[ sessionKey ].close();
			delete self.sessions[ sessionKey ];
		}
	}
}

ns.Account.prototype.sendAccountMsg = function( msg, sessionId ) {
	var self = this;
	var wrap = {
		type : 'account',
		data : msg,
	};
	self.toClient( wrap, sessionId );
}

ns.Account.prototype.toClient = function( msg, sessionId ) {
	var self = this;
	if ( !self.sessionKeys.length ) {
		return;
	}
	
	if ( sessionId )
		toSocket( msg, sessionId );
	else
		broadcast( msg );
	
	function toSocket( msg, sessionId ) {
		var session = self.sessions[ sessionId ];
		if ( !session ) {
			return;
		}
		
		session.send( msg );
	}
	
	function broadcast( msg ) {
		self.sessionKeys.forEach( sendTo );
		function sendTo( sessionId ) {
			self.sessions[ sessionId ].send( msg );
		}
	}
}

module.exports = ns.Account;
