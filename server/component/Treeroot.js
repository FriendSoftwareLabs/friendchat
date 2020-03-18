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

var Contactlist = require('./Contactlist');
var https = require( 'https' );
var querystring = require( 'querystring' );
var xmlAway = require( 'xml2js' );
var util = require( 'util' );
var uuid = require( './UuidPrefix' )( 'treeroot' );
var events = require( './Emitter' );

var ns = {};

ns.Treeroot = function( clientConnection, clientId ) {
	const self = this;
	self.log = require( './Log' )( 'Treeroot' );
	self.type = 'treeroot';
	self.client = clientConnection;
	self.conf = null;
	self.clientId = clientId;
	self.source = null;
	self.uniqueId = null;
	self.sessionId = null;
	self.account = {};
	self.contacts = new Contactlist();
	self.contactState = {};
	self.subscriptions = new Contactlist();
	self.longpolls = {};
	self.longpollMsgTimeout = 240;
	self.longpollContactsTimeout = 512;
	self.requestQueue = [];
	self.updateQueue = [];
	self.cryptoQueue = [];
	self.subsAllowed = [];
	self.initReady = false;
	self.cryptOngoing = false;
	self.recoveryKey = null;
	self.tryDBPass = null;
	self.tryUserPass = null;
	self.validLogin = false;
	self.reqLoopActive = false;
	self.reqLoopInterval = null;
	self.contactsUpdater = null;
	self.contactsUpdateStep = 1000 * 10; // 10 seconds
	self.contactMsgTimeout = 1000 * 20 // 20 sec before letting messages through
	self.msgUpdateStep = 1000 * 2 // 2 sec
	self.reqMaxRetries = 0;
	self.reqRetryBaseStep = 500;
	self.requestsOnTimeout = [];
	self.stopped = true;
	
	self.init();
}

// Public

//static
ns.Treeroot.prototype.getSetup = function( conf, username ) {
	return conf || {};
}

// Private

ns.Treeroot.prototype.apiPath = '/api-json/v1';
ns.Treeroot.prototype.registerPath = '/components/register/';
ns.Treeroot.prototype.passResetPath = '/components/register/recover/';
ns.Treeroot.prototype.registerActivatePath = '/components/register/activate/';
ns.Treeroot.prototype.authPath = '/authenticate/';
//ns.Treeroot.prototype.uniqueIdPath = '/authentication/uniqueid/';
ns.Treeroot.prototype.logoutPath = '/menu/logout/';
ns.Treeroot.prototype.contactPath = '/components/contacts/';
ns.Treeroot.prototype.relationsPath = '/components/contacts/relations/';
ns.Treeroot.prototype.subscriptionPath = '/components/contacts/requests/';
ns.Treeroot.prototype.imagesPath = '/components/library/';
ns.Treeroot.prototype.getMessagesPath = '/components/chat/messages/';
//ns.Treeroot.prototype.getLastMessagePath = '/components/chat/lastmessage/';
ns.Treeroot.prototype.postMessagePath = '/components/chat/post/';

ns.Treeroot.prototype.init = function() {
	const self = this;
	self.source = 'hello-' + self.clientId.split( '-' )[ 1 ];
	
	self.client.on( 'connect', connect );
	self.client.on( 'reconnect', reconnect );
	self.client.on( 'disconnect', disconnect );
	self.client.on( 'initialize', initClient );
	self.client.on( 'keyexchange', keyExchange );
	self.client.on( 'settings', getSettings );
	self.client.on( 'setting', updateSetting );
	self.client.on( 'register', registerAccount );
	self.client.on( 'subscription', onSubscription );
	self.client.on( 'pass-reset', resetPassphrase );
	self.client.on( 'stop', stop );
	self.client.on( 'kill', kill );
	
	function connect( e ) { self.connect( e ); }
	function reconnect( e ) { self.reconnect( e ); }
	function disconnect( e ) { self.disconnect( e ); }
	function initClient( e, socketId ) { self.handleClientInit( socketId ); }
	function keyExchange( e, socketId ) { self.handleKeyExchange( e, socketId ); }
	function getSettings( e, socketId ) { self.getSettings( socketId ); }
	function updateSetting( e, socketId ) { self.updateSetting( e ); }
	function registerAccount( e, socketId ) { self.register( e, socketId ); }
	function onSubscription( e ) { self.subscription( e ); }
	
	function resetPassphrase( e, socketId ) { self.resetPassphrase( e, socketId ); }
	function stop( e ) { self.log( 'treeroot stop event - this isnt evenn a real handler!?', self.conf ); }
	function kill( callback ) { self.kill( callback ); }
	
	//self.requests = new events.RequestNode( self.client, null );
	self.client.on( 'user-list', getUserList );
	self.client.on( 'search-available', searchAvailable );
	function getUserList( e ) { return self.getUserList( e ); }
	function searchAvailable( e ) { return self.handleSearchAvailable( e ); }
	
	//
	self.settingsUpdateMap = {
		'host'           : updateHost,
		'login'          : updateLogin,
		'password'       : updatePassword,
		'logLimit'       : updateLogLimit,
		'onlyOneClient'  : updateOnlyOneClient,
		'msgCrypto'      : updateMsgCrypto,
		'cryptoAccepted' : updateCryptoAccepted,
		'msgAlert'       : updateMsgAlert,
	};
	
	function updateHost( e, socketId ) { self.updateHost( e, socketId ); }
	function updateLogin( e, socketId ) { self.updateLogin( e, socketId ); }
	function updatePassword( e, socketId ) { self.updatePassword( e, socketId ); }
	function updateLogLimit( e, socketId ) { self.updateLogLimit( e, socketId ); }
	function updateOnlyOneClient( e, socketId ) { self.updateOnlyOneClient( e, socketId ); }
	function updateMsgCrypto( e, socketId ) { self.updateMsgCrypto( e, socketId ); }
	function updateCryptoAccepted( e, socketId ) {
		self.updateCryptoAccepted( e, socketId );
	}
	function updateMsgAlert( e, socketId ) { self.updateMsgAlert( e, socketId ); }
	
	//
	self.keyExEventMap = {
		'uniqueid'       : uniqueId,
		'publickey'      : publicKey,
		'signtemppass'   : signTempPass,
		'password-retry' : retryPassword,
	};
	
	function uniqueId( e, socketId ) { self.sendUniqueId( socketId ); }
	function publicKey( e, socketId ) { self.handleClientPublicKey( e, socketId ); }
	function signTempPass( e, socketId ) { self.sendSignedPass( e, socketId ); }
	function retryPassword( e, socketId ) { self.retryDBPassword( e, socketId ); }
	
	//
	self.contactEvents = {
		'log'           : log,
		'message'       : message,
		'subscription'  : subscription,
		'cryptomessage' : cryptoMessage,
	};
	
	function log( clientId, data, socketId ) { self.getLog( clientId, socketId ); }
	function message( clientId, data, socketId ) { self.postMessage( clientId, data ); }
	function subscription( clientId, data, socketId ) { self.subscription( data ); }
	function cryptoMessage( clientId, data, socketId ) { self.postCryptoMessage( clientId, data ); }
	
	self.subscriptionMap = {
		'subscribe' : subscribeTo,
		'unsubscribe' : unsubscribe,
		'allow' : allow,
		'deny' : deny,
		'cancel' : cancel
	}
	
	function subscribeTo( e ) { self.subscribe( e ); }
	function unsubscribe( e ) { self.unsubscribe( e ); }
	function allow( e ) { self.allowSubscription( e ); }
	function deny( e ) { self.denySubscription( e ); }
	function cancel( e ) { self.cancelSubscription( e ); }
}

ns.Treeroot.prototype.connect = function( conf ) {
	const self = this;
	if ( conf && conf.mod )
		conf = conf.mod;
	
	self.validHost = true;
	self.clearReconnect();
	
	if ( conf )
		self.setConf( conf );
	
	if ( !self.conf.host || !self.conf.login ) {
		self.kill( killback );
		function killback() {
			self.setConnectionError( 'info-missing', self.conf );
		}
		return;
	}
	
	if ( !self.stopped )
		self.kill( start );
	else
		start();
	
	function start() {
		self.stopped = false;
		self.clearRequestQueue();
		self.connectionStatus( 'connecting', Date.now());
		self.getUniqueId( idBack );
		
		function idBack( success ) {
			if ( !success )
				return;
			
			self.initKeyExchange();
		}
	}
}

ns.Treeroot.prototype.hostError = function( message ) {
	const self = this;
	var data = {
		host : self.conf.host,
		message : message || '',
	};
	self.setConnectionError( 'host', data );
}

ns.Treeroot.prototype.identityError = function( message ) {
	const self = this;
	var data = {
		identity : self.conf.login,
		message : message || '',
	};
	self.setConnectionError( 'identity', data );
}

ns.Treeroot.prototype.planReconnect = function() {
	const self = this;
	if ( self.reconnectTimeout ) {
		self.log( 'alredy planning reconnect', self.reconnectTimeout );
		return;
	}
	
	var timeout = 1000 * 30;
	var reconnectTimestamp = Date.now() + timeout;
	self.setConnectionError( 'reconnecting', reconnectTimestamp );
	self.reconnectTimeout = setTimeout( reconnect, timeout );
	function reconnect() {
		self.reconnect();
	}
}

ns.Treeroot.prototype.clearReconnect = function() {
	const self = this;
	if ( !self.reconnectTimeout )
		return;
	
	clearTimeout( self.reconnectTimeout );
	self.reconnectTimeout = null;
}

ns.Treeroot.prototype.reconnect = function( conf ) {
	const self = this;
	self.setNotLoggedIn();
	if ( !self.conf.host || !self.conf.login ) {
		self.disconnect();
		return;
	}
	
	self.clearReconnect();
	self.connecting = true;
	self.kill( killed );
	function killed() {
		self.connect( conf );
	}
}

ns.Treeroot.prototype.disconnect = function( callback ) {
	const self = this;
	self.clearReconnect();
	self.kill( killed );
	function killed() {
		if ( callback )
			callback();
	}
}

ns.Treeroot.prototype.kill = function( callback ) {
	var self = this;
	self.sessionId = null;
	self.initReady = false;
	self.stop( stopped );
	
	function stopped() {
		if( callback )
			callback( true );
	}
}

ns.Treeroot.prototype.setConf = function( data ) {
	const self = this;
	self.conf = self.conf || {};
	self.conf.host = data.host || self.conf.host || '';
	self.conf.port = data.port || self.conf.port || '';
	self.conf.login = data.login || self.conf.login || '';
	self.conf.password = data.password || self.conf.password || '';
	self.conf.displayName = data.displayName || self.conf.displayName || '';
	self.conf.settings = data.settings || self.conf.settings || {};
	
	self.updateLogFn();
	
	// remove protocol from host string, if it has one
	var clean = self.cleanHost();
	if ( !clean )
		clean = "";
	
	if ( clean !== self.conf.host )
		self.updateHost( clean );
}

ns.Treeroot.prototype.cleanHost = function( string ) {
	const self = this;
	var source = string || self.conf.host;
	if ( !source ) {
		self.log( 'no host', {
			input : string,
			conf : self.conf.host
		});
		return null;
	}
	
	if ( !source.split ) {
		self.log( 'cleanHost - invalid source', source );
		return null;
	}
	
	var pair = source.split( '://' );
	var clean = pair[ pair.length - 1 ];
	return clean;
}

ns.Treeroot.prototype.updateLogFn = function() {
	const self = this;
	var treeStr = 'Treeroot';
	if ( self.conf.host )
		treeStr += '-' + self.conf.host;
	if ( self.conf.login )
		treeStr += '-' + self.conf.login;
	
	self.log = require( './Log' )( treeStr );
}

ns.Treeroot.prototype.handleClientInit = function( socketId ) {
	const self = this;
	if ( !self.conf.login ) {
		self.client.emitState();
		return;
	}
	
	if ( !self.sessionId ) {
		self.queueCrypto( socketId );
		return;
	}
	
	self.initializeClient( socketId );
}

ns.Treeroot.prototype.getUniqueId = function( callback ) {
	const self = this;
	var postData = {
		'Username' : self.conf.login,
		'Source' : self.source,
	};
	
	var req = {
		type : 'request',
		path : self.authPath,
		data : postData,
		callback : response,
	};
	
	self.queueRequest( req, true );
	function response( data ) {
		if ( !data )
			return;
		
		if ( !data.uniqueid ) {
			self.uniqueId = null;
			self.identityError();
			callback( false );
			return;
		}
		
		self.uniqueId = data.uniqueid; //.split( '' ).join( '' );
		callback( true );
	}
}

ns.Treeroot.prototype.initKeyExchange = function() {
	const self = this;
	self.sessionId = null;
	if ( self.cryptoQueue.length )
		self.executeCryptoQueue();
	else
		self.sendUniqueId();
}

ns.Treeroot.prototype.queueCrypto = function( socketId ) {
	const self = this;
	self.cryptoQueue = self.cryptoQueue || [];
	self.cryptoQueue.push( socketId );
}

ns.Treeroot.prototype.executeCryptoQueue = function() {
	const self = this;
	self.cryptoQueue.forEach( sendCryptoInit );
	self.cryptoQueue = [];
	
	function sendCryptoInit( socketId ) {
		self.sendUniqueId( socketId );
	}
}

ns.Treeroot.prototype.handleKeyExchange = function( msg, socketId ) {
	const self = this;
	if ( msg.type == 'err' ) {
		self.handleKeyExClientError( msg.data );
		return;
	}
	
	self.client.emitState( socketId );
	if ( self.cryptOngoing && self.cryptOngoing != socketId ) {
		self.queueCrypto( socketId );
		return;
	}
	
	var handler = self.keyExEventMap[ msg.type ];
	if ( !handler ) {
		self.log( 'handleKeyExchange - unknown event', msg );
		return;
	}
	
	handler( msg.data, socketId );
}

ns.Treeroot.prototype.handleKeyExClientError = function( err ) {
	var self = this;
	self.log( 'handleKeyExClientError', err );
	if ( 'decrypt-temppass' === err.type ) {
		self.log( 'keyExClientError - decrpyt temppass, resetting pass', err );
		self.resetCrypto();
		return;
	}
	
	if ( 'sign-temppass' === err.type ) {
		self.log( 'keyExClientError - signtemppass, reconnecting', err );
		self.reconnect();
		return;
	}
	
}

ns.Treeroot.prototype.sendUniqueId = function( socketId ) {
	const self = this;
	if ( !self.uniqueId ) {
		self.queueCrypto( socketId );
		return;
	}
	
	self.cryptoSetupState = {
		user           : self.conf.login,
		uniqueId       : null,
		dbPass         : null,
		userPass       : null,
		publicKey      : null,
		recoveryKey    : null,
		serverTempPass : null,
	};
	
	self.tryDBPass = self.conf.password;
	const msg = {
		type : 'uniqueid',
		data : {
			uniqueId : self.uniqueId,
			hashedPass : self.tryDBPass,
		},
	};
	
	self.clientKeyEx( msg, socketId );
	self.cryptoSetupState.uniqueId = self.uniqueId;
	self.cryptoSetupState.dbPass = self.tryDBPass;
}

ns.Treeroot.prototype.handleClientPublicKey = function( data, socketId ) {
	const self = this;
	if ( !!self.cryptOngoing )
		return;
	
	self.cryptOngoing = socketId;
	if ( !self.cryptoSetupState )
		self.cryptoSetupState = {};
	
	if ( data.hashedPass !== self.cryptoSetupState.dbPass )
		self.cryptoSetupState.userPass = data.hashedPass;
	
	self.cryptoSetupState.publicKey = data.publicKey;
	self.cryptoSetupState.recoveryKey = data.recoveryKey;
	self.cryptoSetupState.keys = data.keys;
	
	if ( self.tryDBPass !== data.hashedPass )
		self.tryUserPass = data.hashedPass;
	
	self.recoveryKey = data.recoveryKey || null;
	self.sendPublicKey( data.publicKey, data.recoveryKey, pubKeyReply );
	function pubKeyReply( tempPass ) {
		if ( !tempPass ) {
			self.log( 'handleClientPublicKey - error for', self.conf );
			// re init from unique key probably
			return;
		}
		
		self.clientSignPass( tempPass, socketId );
	}
}

ns.Treeroot.prototype.sendPublicKey = function( pubKey, recoveryKey, callback ) {
	const self = this;
	if ( !self.uniqueId ) {
		self.log( 'sendPublicKey - uniqueId oppsie', { uid : self.uniqueId, u : self.conf });
		return;
	}
	
	var postData = {
		'Source' : self.source,
		'UniqueID' : self.uniqueId,
		'PublicKey' : pubKey,
	};
	
	if ( recoveryKey )
		postData[ 'RecoveryKey' ] = self.recoveryKey;
	
	var req = {
		path : self.authPath,
		data : postData,
		callback : response,
	};
	
	self.queueRequest( req );
	function response( data ) {
		if ( !data.password ) {
			self.log( 'sendPublicKey - failed', data );
			return;
		}
		
		callback( data.password );
	}
}

ns.Treeroot.prototype.clientSignPass = function( tempPass, socketId ) {
	var self = this;
	if ( !self.cryptoSetupState ) {
		try {
			throw Error( 'clientSignPass - no cryptoSetupState' );
		} catch( err ) {
			self.log( 'trace for thing', err );
		}
		return;
	} else
		self.cryptoSetupState.serverTempPass = tempPass;
	
	var signPassEvent = {
		type : 'signtemppass',
		data : tempPass,
	};
	self.clientKeyEx( signPassEvent, socketId );
}

ns.Treeroot.prototype.sendSignedPass = function( data, socketId ) {
	var self = this;
	const signature = data.signed;
	self.cryptoSetupState.signedPass = signature;
	self.cryptoSetupState.clearText = data.clearText;
	var postData = {
		'Source'    : self.source,
		'UniqueID'  : self.uniqueId,
		'Signature' : signature,
	};
	
	var req = {
		type     : 'request',
		path     : self.authPath,
		data     : postData,
		callback : response,
	};
	
	self.queueRequest( req );
	function response( res, req, xml ) {
		if ( !res ) {
			self.log( 'sendSignedPass - incomplete result, disconnecting' );
			self.setConnectionError( 'host', { host : self.conf.host } );
			return;
		}
		
		if ( !res.sessionid ) {
			self.log( 'sendSignedPass - failed, response', {
				res : res,
				req : req,
				xml : xml,
			});
			self.keyExchangeFailed();
			return;
		}
		
		var sessionId = res.sessionid;
		self.keyExchangeComplete( sessionId, socketId );
	}
}

ns.Treeroot.prototype.keyExchangeComplete = function( sessionId, socketId ) {
	var self = this;
	//self.log( 'keyExComplete', self.cryptoSetupState, 4 );
	self.cryptoSetupState = null;
	if ( self.tryUserPass )
		self.updatePassword( self.tryUserPass, passBack );
	else {
		self.tryDBPass = null;
		completeSetup();
	}
	
	function passBack( success ) {
		self.tryUserPass = null;
		completeSetup();
	}
	
	function completeSetup() {
		self.validLogin = true;
		self.cryptOngoing = null;
		self.sessionId = sessionId;
		self.getAccountInfo( accountBack );
	}
	
	function accountBack( success ) {
		if ( !success ) {
			self.reconnect();
			return;
		}
		
		self.connectionStatus( 'online' );
		self.executeCryptoQueue();
		self.startContactUpdate();
		self.initializeClient( socketId );
	}
}

ns.Treeroot.prototype.keyExchangeFailed = function() {
	var self = this;
	//self.log( 'keyExFail', self.cryptoSetupState, 4 );
	self.cryptoSetupState = null;
	if ( self.tryDBPass ) {
		self.askRetry();
		return;
	}
	
	self.resetCrypto( resetDone );
	function resetDone() {
		self.getUniqueId( uidBack );
	}
	
	function uidBack( success ) {
		if ( !success )
			return;
		
		self.cryptOngoing = null;
		self.sendUniqueId();
	}
}

ns.Treeroot.prototype.askRetry = function() {
	const self = this;
	self.setConnectionError();
	const event = {
		type : 'password-old-failed',
		data : { time : Date.now() },
	};
	self.clientKeyEx( event );
}

ns.Treeroot.prototype.retryDBPassword = function( response, socketId ) {
	const self = this;
	if ( !response )
		return;
	
	if ( response.retry )
		self.reconnect();
	else
		self.resetCrypto();
}


ns.Treeroot.prototype.resetCrypto = function( callback ) {
	var self = this;
	self.tryDBPass = null;
	self.tryUserPass = null;
	self.updatePassword( '', passBack );
	function passBack( success ) {
		if ( !success ) {
			self.log( 'failed to reset password in DB??', update );
		}
		
		self.conf.password = '';
		self.reconnect();
	}
}

ns.Treeroot.prototype.initializeClient = function( socketId ) {
	const self = this;
	self.client.emitState( socketId );
	var connState = self.client.getState();
	if ( !connState || connState.type != 'online' ) {
		return;
	}
	
	var state = {
		account : self.account,
		contacts : [],
		subscriptions : [],
	};
	
	var contactIds = self.contacts.getClientIdList();
	contactIds.forEach( addToState );
	function addToState( id ) {
		let contact = self.contacts.get( id );
		let cState = self.contactState[ contact.serviceId ];
		if ( cState.encId ) {
			contact.enc = {
				id  : cState.encId,
				key : cState.encKey,
			};
		}
		let data = {
			contact : contact,
			cState  : {
				lastMessage : cState.lastMessage,
			},
		};
		state.contacts.push( data );
	}
	
	var subIds = self.subscriptions.getClientIdList();
	subIds.forEach( addSubToState );
	function addSubToState( id ) {
		var sub = self.subscriptions.get( id );
		state.subscriptions.push( sub );
	}
	
	var initStateEvent = {
		type : 'initstate',
		data : state,
	};
	self.toClient( initStateEvent, socketId );
}

ns.Treeroot.prototype.clientKeyEx = function( msg, socketId ) {
	const self = this;
	var keyExEvent = {
		type : 'keyexchange',
		data : msg,
	};
	self.toClient( keyExEvent, socketId );
}

ns.Treeroot.prototype.toClient = function( msg, socketId ) {
	const self = this;
	self.client.send( msg, socketId );
}

ns.Treeroot.prototype.toClientContact = function( msg, clientId, socketId ) {
	const self = this;
	var wrap = {
		type : clientId,
		data : msg,
	};
	self.toClient( wrap, socketId );
	//self.client.send( msg, socketId, clientId );
}

ns.Treeroot.prototype.toContactHandler = function( clientId, msg, socketId ) {
	const self = this;
	var contact = self.contacts.get( clientId );
	if( !contact ) {
		self.log( 'no contact for: ', msg );
		return;
	}
	
	var handler = self.contactEvents[ msg.type ];
	if ( !handler ) {
		self.log( 'toContactHandler - no handler for', msg );
		return;
	}
	
	handler( clientId, msg.data, socketId );
}

ns.Treeroot.prototype.getSettings = function( socketId ) {
	const self = this;
	var msg = {
		type : 'settings',
		data : self.conf,
	};
	self.toClient( msg, socketId );
}

ns.Treeroot.prototype.updateSetting = function( pair ) {
	const self = this;
	var handler = self.settingsUpdateMap[ pair.setting ];
	if ( !handler ) {
		self.log( 'updateSetting - no handler for ', pair );
		return;
	}
	
	handler( pair.value );
}

ns.Treeroot.prototype.updateHost = function( value ) {
	const self = this;
	var newHost = self.cleanHost( value );
	self.doPersist( 'host', newHost, persistBack );
	function persistBack( hostUpdate ) {
		self.updateClientSetting( hostUpdate );
		if ( !hostUpdate.success )
			return;
		
		self.validLogin = false;
		self.conf.host = hostUpdate.value;
		self.updateLogFn();
		self.reconnect();
	}
}

ns.Treeroot.prototype.updateLogin = function( value, callback ) {
	const self = this;
	self.doPersist( 'login', value, persistBack );
	function persistBack( update ) {
		self.updateClientSetting( update );
		if ( !update.success )
			return;
		
		self.validLogin = false;
		self.conf.password = null;
		self.conf.login = update.value;
		self.updateLogFn();
		if ( callback )
			callback( update );
		else
			self.reconnect();
	}
}

ns.Treeroot.prototype.updatePassword = function( value, callback ) {
	const self = this;
	self.doPersist( 'password', value, persistBack );
	function persistBack( update ) {
		if ( !update.success ) {
			self.log( 'failed to update DB??', update );
			return;
		}
		
		self.validLogin = false;
		self.conf.password = update.value;
		update.value = '';
		self.updateClientSetting( update );
		if ( callback )
			callback( true );
		else
			self.reconnect();
	}
}

ns.Treeroot.prototype.updateMsgCrypto = function( bool ) {
	const self = this;
	self.doPersist( 'msgCrypto', bool, persistBack );
	function persistBack( update ) {
		self.updateClientSetting( update );
		if ( !update.success )
			return;
		
		self.conf.settings.msgCrypto = update.value;
	}
}

ns.Treeroot.prototype.updateCryptoAccepted = function( bool ) {
	const self = this;
	self.doPersist( 'cryptoAccepted', bool, persistBack );
	function persistBack( update ) {
		self.updateClientSetting( update );
		if ( !update.success )
			return;
		
		self.conf.settings.cryptoAccepted = update.value;
	}
}

ns.Treeroot.prototype.updateMsgAlert = function( bool ) {
	const self = this;
	self.doPersist( 'msgAlert', bool, persistBack );
	function persistBack( update ) {
		self.updateClientSetting( update );
		if ( !update.success )
			return;
		
		self.conf.settings.msgAlert = update.value;
	}
}

ns.Treeroot.prototype.updateLogLimit = function( number ) {
	const self = this;
	self.doPersist( 'logLimit', number, persistBack );
	function persistBack( update ) {
		self.updateClientSetting( update );
		if ( !update.success )
			return;
		
		self.conf.settings.logLimit = update.value;
	}
}

ns.Treeroot.prototype.updateOnlyOneClient = function( bool ) {
	const self = this;
	self.doPersist( 'onlyOneClient', bool, persistBack );
	function persistBack( update ) {
		self.updateClientSetting( update );
		if ( !update.success )
			return;
		
		self.conf.settings.onlyOneClient = update.value;
	}
}

ns.Treeroot.prototype.doPersist = function( setting, value, callback ) {
	const self = this;
	var update = {
		setting : setting,
		value : value,
		success : false,
	};
	self.client.persistSetting( update, backCheck );
	function backCheck( res ) {
		if ( !res )
			res = { success : false };
		
		callback( res );
	}
}

ns.Treeroot.prototype.updateClientSetting = function( update ) {
	const self = this;
	var wrap = {
		type : 'setting',
		data : {
			type : update.setting,
			data : update,
		},
	};
	self.toClient( wrap );
}

ns.Treeroot.prototype.connectionStatus = function( state, data ) {
	const self = this;
	data = data || {};
	self.client.setState( state, data );
}

ns.Treeroot.prototype.setConnectionError = function( type, data ) {
	const self = this;
	type = type || 'error';
	data = data || {
		message : self.conf.host + ' - unspecified error',
		time : Date.now(),
	};
	
	var errEvent = {
		type : type,
		data : data,
	};
	self.connectionStatus( 'error', errEvent );
}

// .stop also sets Offline >.>
ns.Treeroot.prototype.setConnectionOffline = function( data ) {
	const self = this;
	data = data || {
		message : self.conf.host + ' offline',
		time : Date.now(),
	};
	self.connectionStatus( 'offline', data );
}

ns.Treeroot.prototype.stop = function( callback ) {
	const self = this;
	self.clearRequestTimeouts();
	self.stopContactUpdate();
	self.stopMessageUpdate();
	self.stopRequestLoop();
	self.clearLongpolls();
	self.stopped = true;
	
	self.unloadContacts();
	if ( isOnline())
		self.connectionStatus( 'offline', Date.now());
	
	if ( callback )
		callback( true );
	
	function isOnline() {
		if ( !self.client )
			return false;
		
		var connStatus = self.client.getState();
		if ( !connStatus || 'online' != connStatus.type )
			return false;
		
		return true;
	}
}

// TODO turn this into a 'clear passwords and stuff' function
ns.Treeroot.prototype.logout = function( callback ) {
	const self = this;
	if ( callback )
		callback( true );
	return; // there is no logout in the api, apparently..
	
	
	var postData = {
		
	};
	
	self.queueRequest({
		type : 'request',
		path : self.logoutPath,
		data : postData,
		callback : postResponse
	});
	
	function postResponse( data ) {
		if( callback )
			callback( data );
	}
}


ns.Treeroot.prototype.unloadContacts = function() {
	const self = this;
	removeContacts();
	removeSubscriptions();
	self.contactState = {};
	
	function removeContacts() {
		var clientIds = self.contacts.getClientIdList();
		clientIds.forEach( remove );
		function remove( clientId ) {
			self.removeContact( clientId );
		}
	}
	
	function removeSubscriptions() {
		var clientIds = self.subscriptions.getClientIdList();
		clientIds.forEach( remove );
		function remove( clientId ) {
			self.removeSubscription( clientId );
		}
	}
}

ns.Treeroot.prototype.startContactUpdate = function() {
	const self = this;
	self.updateContacts();
	self.startLongpollContacts();
	
	/*
	if ( self.contactsUpdater ) {
		self.stopContactUpdate();
	}
	
	self.isUpdatingContacts = false;
	self.contactsUpdater = setInterval( doUpdate, self.contactsUpdateStep );
	function doUpdate() {
		if ( !self.contactsUpdater )
			return;
		
		if ( self.sessionId )
			self.updateContacts();
	}
	*/
}

ns.Treeroot.prototype.stopContactUpdate = function() {
	const self = this;
	self.stopLongpollContacts();
	return;
	
	if ( !self.contactsUpdater )
		return;
	
	clearInterval( self.contactsUpdater );
	self.contactsUpdater = null;
}

ns.Treeroot.prototype.startMessageUpdates = function( contactId ) {
	const self = this;
	return;
	var contact = self.contacts.get( contactId );
	if ( !contact ) {
		self.log( 'statContactUpdates: no contact for id ' + contactId );
		return;
	}
	
	var cState = self.contactState[ contactId ];
	if ( !cState )
		return;
	
	if ( cState.msgUpdater ) {
		clearInterval( cState.msgUpdater );
		cState.msgUpdater = null;
	}
	
	self.startMessageLongPoll( contactId );
	if ( cState.idleTimeout ) {
		clearTimeout( cState.idleTimeout );
		cState.idleTimeout = null;
	}
	
	cState.idleTimeout = setTimeout( stopUpdates, 300000 );
	function stopUpdates() {
		self.stopMessageUpdate( contactId );
	}
}

ns.Treeroot.prototype.startMessageLongPoll = function( contactId ) {
	const self = this;
	const cState = self.contactState[ contactId ];
	if ( !cState )
		return;
	
	if ( cState.longpoll ) {
		//self.log( 'startMessageLongPoll - already polling ' + contactId );
		return;
	}
	
	cState.longpoll = true;
	doLongpoll();
	
	function doLongpoll() {
		self.longpollMessages( contactId, null, longBack );
		function longBack( res ) {
			if ( res )
				self.messagesToClient( res, contactId );
			
			if ( cState.longpoll )
				setTimeout( doLongpoll, 1 );
			
		}
	}
}

ns.Treeroot.prototype.doMessageUpdate = function( contactId ) {
	const self = this;
	let cState = self.contactState[ contactId ];
	if ( !cState ) {
		self.log( 'no contact state for', { cid : contactId, state : self.contactState });
		return;
	}
	
	if ( cState.isMsgUpdate )
		return;
	
	cState.isMsgUpdate = true;
	self.getNewMessages( contactId, null, messagesBack );
	function messagesBack( messages ) {
		if ( !messages )
			return;
		
		let cState = self.contactState[ contactId ];
		if ( !cState )
			return;
		
		self.messagesToClient( messages, contactId );
		cState.isMsgUpdate = false;
	}
}

ns.Treeroot.prototype.stopMessageUpdate = function( serviceId ) {
	const self = this;
	if ( serviceId )
		stopChatUpdate( serviceId )
	else {
		var contactKeys = Object.keys( self.contactState );
		contactKeys.forEach( stopChatUpdate );
	}
	
	function stopChatUpdate( serviceId ) {
		self.stopMessageLongpoll( serviceId );
		var cState = self.contactState[ serviceId ];
		if ( !cState )
			return;
		
		if ( cState.msgUpdater ) 
			clearInterval( cState.msgUpdater );
		
		if ( cState.idleTimeout )
			clearTimeout( cState.idleTimeout )
		
		cState.msgUpdater = null;
		cState.idleTimeout = null;
	}
}

ns.Treeroot.prototype.stopMessageLongpoll = function( contactId ) {
	const self = this;
	const cState = self.contactState[ contactId ];
	if ( !cState )
		return;
	
	cState.longpoll = false;
}

ns.Treeroot.prototype.getUserList = function( event, socketId ) {
	var self = this;
	return new Promise(( resolve, reject ) => {
		self.fetchContact( null, usersBack );
		function usersBack( res ) {
			let users = [];
			if ( res.response != 'ok' ) {
				self.log( 'getUserList - failed', res );
				send( null, users );
				return;
			}
			
			users = res.items.Contacts;
			users = users.filter( isNotContactSubOrSelf );
			var userList = users.map( buildUserObj );
			send( null, userList );
			
			function send( err, list ) {
				if ( err )
					reject( err );
				else
					resolve( list );
			}
			
			function isNotContactSubOrSelf( user ) {
				var contact = self.contacts.get( user.ID );
				var sub = self.subscriptions.get( user.ID );
				
				if ( contact )
					return false;
				
				if ( sub )
					return false;
				
				if ( user.ID === self.account.id )
					return false;
				
				return true;
			}
			
			function buildUserObj( user ) {
				let name = user.DisplayName || user.Username;
				var userObj = {
					id       : user.ID,
					name     : name,
					email    : user.Email,
					alias    : user.Username,
				};
				
				//userObj.displayName = userObj.name || userObj.username;
				return userObj;
			}
		}
	});
}

ns.Treeroot.prototype.handleSearchAvailable = async function( searchStr ) {
	const self = this;
	const filterRX = new RegExp( searchStr, 'i' );
	let pool = await self.getUserList();
	if ( !pool || !pool.length )
		return [];
	
	const list = pool.filter( item => {
		if ( item.name.match( filterRX ))
			return true;
		
		if ( item.email && item.email.match( filterRX ))
			return true;
		
		if ( item.alias && item.alias.match( filterRX ))
			return true;
		
		return false;
	});
	
	return list.map( user => {
		return {
			id   : user.id,
			name : user.name,
		};
	});
}

ns.Treeroot.prototype.addContact = function( relation ) {
	const self = this;
	var contactState = self.contactState[ relation.ID ];
	var contact = self.contacts.get( relation.ID );
	if ( contactState || contact ) {
		return;
	}
	
	contact = setContactData( relation );
	self.contacts.set( contact );
	self.contactState[ contact.serviceId ] = {
		lastMessageId : null,
		isMsgUpdate   : false,
		idleTimeout   : null,
		msgUpdater    : null,
		msgQueue      : [],
	};
	
	// check if recentely accepted subscription
	var cState = self.contactState[ contact.serviceId ];
	var allowIndex = self.subsAllowed.indexOf( contact.serviceId );
	if ( -1 !== allowIndex ) {
		self.subsAllowed.splice( allowIndex, 1 );
		self.client.on( contact.clientId, tmpContactMsg );
		setTimeout( switchMsgHandler, self.contactMsgTimeout );
	} else
		self.client.on( contact.clientId, contactMsg );
	
	function switchMsgHandler() {
		self.client.release( contact.clientId );
		self.client.on( contact.clientId, contactMsg );
		if ( !cState.msgQueue || !cState.msgQueue.length )
			return;
		
		cState.msgQueue.forEach( sendMsg );
		function sendMsg( msg ) {
			contactMsg( msg.data, msg.sId );
		}
	}
	
	function tmpContactMsg( data, socketId ) {
		var msg = {
			data : data,
			sId  : socketId,
		};
		cState.msgQueue.push( msg );
	}
	
	function contactMsg( data, socketId ) {
		self.toContactHandler( contact.clientId, data, socketId );
	}
	
	if ( relation.LastMessageData )
		cState.lastMessage = self.buildMessage(
			relation.LastMessageData,
			relation.ID,
		);
	
	const add = {
		type : 'add',
		data : {
			contact : contact,
			cState  : {
				lastMessage : cState.lastMessage,
			},
		},
	};
	self.contactEvent( add );
	
	return contact.serviceId;
	
	function setContactData( relation ) {
		var contact = relation;
		contact.serviceId = relation.ID;
		contact.publicKey = relation.PublicKey;
		contact.clientId = 'treeroot-' + self.clientId.split( '-')[ 1 ] + '-' + contact.serviceId ;
		contact.displayName = relation.Name || relation.Username;
		contact.email = relation.Email;
		contact.online = !!relation.IsOnline;
		let imgObj = relation.ProfileImage;
		let imgPath = '';
		if ( imgObj && imgObj.DiskPath && imgObj.Filename )
			imgPath = 'https://' + self.conf.host + '/' + imgObj.DiskPath + imgObj.Filename;
		
		contact.imagePath = imgPath;
		contact.unreadMessages = relation.UnSeenMessages;
		
		return contact;
	}
}

ns.Treeroot.prototype.addSubscription = function( request ) {
	const self = this;
	var sub = self.subscriptions.get( request.ID );
	if( sub ) // subscription already added
		return;
	
	sub = setSubData( request );
	self.subscriptions.set( sub );
	var add = {
		type : 'add',
		data : sub,
	};
	
	self.subscriptionEvent( add );
	return sub.serviceId;
	
	function setSubData( request ) {
		var sub = request;
		sub.serviceId = request.ID;
		sub.clientId = self.source + 'Subscription-' + request.ID;
		sub.isRecieved = request.ID === request.SenderID;
		sub.displayName = request.Name.length ? request.Name : request.Username;
		return sub;
	}
}

ns.Treeroot.prototype.removeContact = function( serviceId ) {
	const self = this;
	var contact = self.contacts.get( serviceId );
	if ( !contact )
		return;
	
	self.client.release( contact.clientId );
	
	var remove = {
		type : 'remove',
		data : {
			clientId : contact.clientId,
		}
	};
	self.contactEvent( remove );
	
	if ( self.contactState[ serviceId ] ) {
		self.stopMessageUpdate( serviceId );
		delete self.contactState[ serviceId ];
	}
	
	self.contacts.remove( serviceId );
}

ns.Treeroot.prototype.removeSubscription = function( serviceId ) {
	const self = this;
	var sub = self.subscriptions.get( serviceId );
	
	if( !sub )
		return;
	
	var action = {
		type : 'remove',
		data : {
			clientId : sub.clientId
		}
	};
	self.subscriptionEvent( action );
	
	self.subscriptions.remove( sub.serviceId );
}

ns.Treeroot.prototype.contactEvent = function( action ) {
	const self = this;
	var wrap = {
		type : 'contact',
		data : action,
	};
	self.toClient( wrap );
}

ns.Treeroot.prototype.subscriptionEvent = function( action ) {
	const self = this;
	var wrap = {
		type : 'subscription',
		data : action,
	};
	self.toClient( wrap );
}

ns.Treeroot.prototype.getLog = function( clientId, socketId ) {
	const self = this;
	var contact = self.contacts.get( clientId );
	if ( !contact ) {
		self.log( 'no contact for clientId', clientId )
		return;
	}
	
	var cId = contact.serviceId;
	self.startMessageUpdates( cId );
	self.getMessages( cId, null, messagesBack );
	function messagesBack( messages ) {
		if ( !messages ) {
			sendNullMessage();
			return;
		}
		
		self.messagesToClient( messages, cId, 'log', socketId );
		sendNullMessage();
	}
	
	function sendNullMessage() {
		var contact = self.contacts.get( cId );
		if ( !contact )
			return;
		
		var clientId = contact.clientId;
		var msg = {
			type : 'log',
			data : null,
		};
		self.toClientContact( msg, clientId, socketId );
	}
}

ns.Treeroot.prototype.postMessage = function( clientId, message ) {
	const self = this;
	var contact = self.contacts.get( clientId );
	var cId = contact.serviceId;
	var postData = {
		'ContactID' : cId,
		'Message' : message,
		'Date' : self.getNow(),
	};
	
	let req = {
		type : 'request',
		path : self.postMessagePath,
		data : postData,
		callback : postResponse
	};
	self.queueRequest( req );
	
	function postResponse( data ) {
		if ( !data ) {
			self.log( 'postMessage - null data for req', req );
			return;
		}
		
		self.postResponse( cId, data, req );
	}
}

ns.Treeroot.prototype.postCryptoMessage = function( clientId, data ) {
	const self = this;
	var contact = self.contacts.get( clientId );
	var cId = contact.serviceId;
	
	var postData = {
		'ContactID' : cId,
		'Message'   : data.message,
		'Date'      : self.getNow(),
		'IsCrypto'  : 1,
		'CryptoID'  : data.encId,
	};
	
	if ( data.encKeys ) {
		var keys = {
			receivers : {
				sender : data.encKeys.sender,
			},
		};
		keys.receivers[ contact.serviceId ] = data.encKeys.receiver;
		postData[ 'CryptoKeys' ] = JSON.stringify( keys );
	}
	
	let req = {
		type     : 'request',
		path     : self.postMessagePath,
		data     : postData,
		callback : postResponse,
	};
	self.queueRequest( req );
	
	function postResponse( data ) {
		if ( !data ) {
			self.log( 'postCryptoMessage - null response', req );
			return;
		}
		
		self.postResponse( cId, data, req );
	}
}

ns.Treeroot.prototype.postResponse = function( serviceId, data, req ) {
	const self = this;
	return;
	var cId = serviceId;
	const lmId = parseInt( data.data, 10 );
	self.getMessage( cId, lmId, messageBack );
	function messageBack( messages ) {
		if ( !messages )
			return;
		
		self.messagesToClient( messages, cId );
	}
}

ns.Treeroot.prototype.getNewMessages = function(
	contactId,
	lastMessageId,
	callback )
{
	const self = this;
	var contact = self.contacts.get( contactId );
	if ( !contact ) {
		self.log( 'no contact: ', contactId );
		return;
	}
	
	lastMessageId = lastMessageId
		|| self.contactState[ contactId ].lastMessageId
		|| null;
	
	var postData = {
		'ContactID' : contactId,
	};
	
	if ( null != lastMessageId )
		postData[ 'LastMessage' ] = lastMessageId;
	
	var req = {
		path : self.getMessagesPath,
		data : postData,
		callback : messageBack,
	};
	
	self.queueRequest( req );
	function messageBack( data ) {
		var messages = self.handleMessages( data, contactId );
		callback( messages );
	}
}

ns.Treeroot.prototype.getMessage = function( contactId, msgId, callback ) {
	const self = this;
	const contact = self.contacts.get( contactId );
	if ( !contact )
		return;
	
	if ( !msgId ) {
		self.log( 'getMessage - no msg id', msgId );
		return;
	}
	
	const postData = {
		'ContactID' : contactId,
		'MessageID' : msgId,
	};
	
	const req = {
		path     : self.getMessagesPath,
		data     : postData,
		callback : messageBack,
	};
	self.queueRequest( req );
	function messageBack( res ) {
		var messages = self.handleMessages( res, contactId );
		callback( messages );
	}
}

ns.Treeroot.prototype.getMessages = function(
	contactId,
	limit,
	callback
) {
	const self = this;
	var contact = self.contacts.get( contactId );
	if ( !contact ) {
		self.log( 'no contact for id: ', contactId );
		return;
	}
	
	limit = limit
		|| self.conf.settings.logLimit
		|| 20;
	var postData = {
		'ContactID' : contactId,
		'Limit' : limit,
	};
	
	self.queueRequest({
		path : self.getMessagesPath,
		data : postData,
		callback : getMessagesResponse,
	});
	
	function getMessagesResponse( data ) {
		var messages = self.handleMessages( data, contactId );
		callback( messages );
	}
}

ns.Treeroot.prototype.longpollMessages = function(
	contactId,
	lastMessageId,
	callback
) {
	const self = this;
	const cState = self.contactState[ contactId ];
	if ( !cState )
		return;
	
	if ( cState.isPollingMessages ) {
		self.log( 'longpollMessages - already longing', contactId );
		return;
	}
	
	cState.isPollingMessages = true;
	const contact = self.contacts.get( contactId );
	if ( !contact ) {
		self.log( 'no contact: ', contactId );
		return;
	}
	
	lastMessageId = lastMessageId
		|| cState.lastMessageId
		|| null;
	
	var postData = {
		'ContactID'   : contactId,
		'Test'        : true,
		'Loop'        : self.longpollMsgTimeout,
	};
	
	if ( null != lastMessageId )
		postData[ 'LastMessage' ] = lastMessageId;
	
	var req = {
		path     : self.getMessagesPath,
		data     : postData,
		callback : messageBack,
		longpoll : contactId,
	};
	
	self.queueRequest( req );
	function messageBack( data ) {
		var messages = self.handleMessages( data, contactId );
		cState.isPollingMessages = false;
		callback( messages );
	}
}

ns.Treeroot.prototype.handleMessages = function( data, contactId ) {
	const self = this;
	if ( !data || !data.items )
		return null;
	
	var encId = data.items.CryptoID;
	var encKey = data.items.CryptoKey;
	self.setupChatEncrypt( encId, encKey, contactId  );
	var messages = self.parseMessageData( data.items.Messages );
	return messages;
}

ns.Treeroot.prototype.setupChatEncrypt = function( encId, encKey, contactId ) {
	const self = this;
	if ( !encId || !encKey )
		return;
	
	var cState = self.contactState[ contactId ];
	if ( !cState )
		return;
	
	if ( cState.encKey
		&& cState.encId
		&& ( cState.encKey === encKey )
		&& ( cState.encId === encId )
	) {
		return;
	}
	
	cState.encId = encId
	cState.encKey = encKey;
	var contact = self.contacts.get( contactId );
	var enc = {
		type : 'chatencrypt',
		data : {
			id : encId,
			key : encKey,
		},
	};
	self.toClientContact( enc, contact.clientId );
}

ns.Treeroot.prototype.parseMessageData = function( data ) {
	if( !data )
		return null;
	
	if( !( data instanceof Array ))
		return [ data ];
	
	data.reverse();
	return data;
	
	function objToArr( obj ) {
		var keys = Object.keys( obj );
		var arr = keys.map( getValue );
		return arr;
		
		function getValue( key ) {
			return obj[ key ];
		}
	}
}

ns.Treeroot.prototype.messagesToClient = function(
	messages,
	contactId,
	type,
	socketId )
{
	const self = this;
	if( !messages )
		return;
	
	const contact = self.contacts.get( contactId );
	if( !contact ) {
		self.log( 'wtf, no contact for: ', contactId );
		return;
	}
	
	messages = messages.map( msg => {
		let built = self.buildMessage( msg, contactId, type );
		return built;
	});
	messages.forEach( toClient );
	self.startMessageUpdates( contactId );
	function toClient( msg ) {
		if ( !msg )
			return;
		
		self.toClientContact( msg, contact.clientId, socketId );
	}
}

ns.Treeroot.prototype.buildMessage = function( data, contactId, type ) {
	const self = this;
	if ( data.Message === undefined )
		return null;
	
	const contact = self.contacts.get( contactId );
	const cState = self.contactState[ contactId ];
	if ( !contact || !cState ) {
		console.log( 'contact', contact );
		return null;
	}
	
	let lastMessageId = cState.lastMessageId || 0;
	if ( 'log' !== type ) {
		if ( data.ID <= lastMessageId )
			return null;
		
		cState.lastMessageId = data.ID;
	}
	
	let timestamp = null;
	if ( data.TimeCreated )
		timestamp = data.TimeCreated * 1000;
	else
		timestamp = Date.parse( data.Date );
	
	var from = contact.serviceId == data.PosterID ? contact.clientId : null;
	var msgId = 'mid-' + data.ID;
	var msg = {
		type : 'message',
		data : {
			mid     : msgId,
			from    : from,
			message : data.Message,
			time    : timestamp,
		},
	};
	
	if ( data.IsCrypto )
		msg.data = addCrypto( msg.data, data, cState );
	
	if ( type )
		msg =  wrapIn( type, msg );
	
	cState.lastMessage = msg;
	return msg;
	
	function wrapIn( type, msg ) {
		var wrap = {
			type : type,
			data : msg,
		}
		return wrap;
	}
	
	function addCrypto( msg, data, cState ) {
		var id = data.CryptoID;
		var key = data.CryptoKey;
		if ( !id || !key ) {
			//self.log( 'messageToClient.addCrypto - missing stuff', data );
			return msg;
		}
		
		msg.dec = {};
		/*
		if ( id === cState.encId )
			msg.dec.id = id;
		else {
		*/
		msg.dec.id = id;
		msg.dec.key = key;
		//}
		
		return msg;
	}
}

ns.Treeroot.prototype.fetchContact = function( contactId, callback ) {
	const self = this;
	var postData = {};
	
	if ( contactId )
		postData[ 'ContactID' ] = contactId;
	
	self.queueRequest({
		path : self.contactPath,
		data : postData,
		callback : contactResponse
	});
	
	function contactResponse( result ) {
		done( result );
	}
	
	function done( result ) {
		if( typeof callback == 'function' )
			callback( result );
	}
}

ns.Treeroot.prototype.fetchContacts = function( callback ) {
	const self = this;
	var postData = {
	};
	
	var req = {
		type : 'request',
		path : self.relationsPath,
		data : postData,
		callback : contactsResponse
	};
	self.queueRequest( req );
	function contactsResponse( data, req, res ) {
		if ( !data ) {
			self.log( 'fetchContacts - failed - req:', req );
			done( false );
			return;
		}
		
		var contacts = {
			relations : [],
			requests : [],
		};
		
		if ( !data.items ) {
			done( contacts );
			return;
		}
		
		contacts.relations = self.getArr( data.items.Relations );
		contacts.requests = self.getArr( data.items.Requests );
		done( contacts, req, res );
	}
	
	function done( result, req, res ) {
		if( callback )
			callback( result, req, res );
	}
}

ns.Treeroot.prototype.startLongpollContacts = function() {
	const self = this;
	if ( self.isPollingContacts )
		return;
	
	self.isPollingContacts = true;
	longpollContacts();
	
	function longpollContacts( lastActivity ) {
		if ( !self.isPollingContacts )
			return;
		
		self.longpollContacts( longBack );
		function longBack( res ) {
			self.lastActivity = null;
			if ( !self.isPollingContacts )
				return;
			
			if ( res && res.timestamp )
				self.lastActivity = res.timestamp;
			
			if ( res && res.items )
				self.handleContactsUpdate( res.items );
			
			setTimeout( resend, 1 );
			function resend() {
				longpollContacts();
			}
		}
	}
}

ns.Treeroot.prototype.longpollContacts = function( callback ) {
	const self = this;
	if ( self.contactsLongpollSent )
		return;
	
	self.contactsLongpollSent = true;
	const postData = {
		'LastActivity'   : self.lastActivity || ( Math.floor( Date.now() / 1000 )),
		'Test'           : true,
		'Loop'           : self.longpollContactsTimeout,
	};
	
	if ( self.lastActivityId )
		postData[ 'LastActivityID' ] = self.lastActivityId;
	
	var req = {
		path     : self.relationsPath,
		data     : postData,
		callback : contactsBack,
		longpoll : 'contacts',
	};
	self.queueRequest( req );
	function contactsBack( data, req, res ) {
		self.contactsLongpollSent = false;
		callback( data );
	}
}

ns.Treeroot.prototype.stopLongpollContacts = function() {
	const self = this;
	self.isPollingContacts = false;
}

ns.Treeroot.prototype.handleContactsUpdate = function( event ) {
	const self = this;
	self.lastActivityId = event.LastActivityID;
	let items = event.LastActivityData;
	let rels = event.Relations;
	let subs = event.Requests;
	if ( !items )
		items = getLegacyMeta( event.TypeActivity );
	
	if ( !items || !items.length )
		return;
	
	items.forEach( handleEvent );
	self.checkContacts( rels, subs );
	
	function handleEvent( meta ) {
		if ( !meta || !meta.type )
			return;
		
		if ( 'Relation' === meta.type ) {
			rels = checkRelationRemoved( rels, meta.id );
		}
		
		if ( 'Message' === meta.type ) {
			self.handleHasNewMessage( rels, meta );
		}
	}
	
	function checkRelationRemoved( rels, id ) {
		rels = rels.filter( notRemoved );
		return rels;
		function notRemoved( rel ) {
			if ( 'Removed' === rel.Status ) {
				self.handleRelationRemoved( rel, id );
				return false;
			}
			
			return true;
		}
	}
	
	function getLegacyMeta( str ) {
		let meta = parse( str );
		if ( !meta )
			return [];
		
		return [ meta ];
	}
	
	function parse( type ) {
		let res = null;
		if ( !type )
			return null;
		
		try {
			res = JSON.parse( type );
		} catch( e ) {
			return null;
		}
		
		return res;
	}
}

ns.Treeroot.prototype.handleRelationRemoved = function( rel, uid ) {
	const self = this;
	self.removeContact( uid );
	self.removeSubscription( uid );
}

ns.Treeroot.prototype.handleHasNewMessage = function( rels, meta ) {
	const self = this;
	const rel = rels[ 0 ];
	const cId = meta.id;
	const cState = self.contactState[ cId ];
	if ( null == rel.LastMessage ) {
		self.log( 'handleHasMessage - LastMessage is not defined', rel );
		return;
	}
	
	const lmId = parseInt( cState.lastMessageId, 10 );
	self.getNewMessages(
		cId,
		lmId,
		messagesBack
	);
	
	function messagesBack( messages ) {
		if ( !messages ) {
			self.log( 'handleHasNewMessage - no messages back???', messages );
			return;
		}
		
		self.messagesToClient( messages, cId );
	}
}

ns.Treeroot.prototype.fetchContactImages = function( imageIds, callback ) {
	const self = this;
	var postData = {
		'Images' : imageIds,
	};
	
	self.queueRequest({
		type     : 'request',
		path     : self.imagesPath,
		data     : postData,
		callback : imagesResponse,
	});
	
	function imagesResponse( data ) {
		if ( !data || !data.items ) {
			callback( [] );
			return;
		}
		
		var imageData = self.getArr( data.items.Images );
		callback( imageData );
	}
}

ns.Treeroot.prototype.subscription = function( sub ) {
	const self = this;
	const handler = self.subscriptionMap[ sub.type ];
	if ( !handler ) {
		self.log( 'subscription type unknow', sub );
		return;
	}
	
	handler( sub.data );
}

// TODO ( maybe? )
// simple subscription check instead of doing a full contacts update
ns.Treeroot.prototype.checkSubscriptionWaiting = function( callback ) {
	const self = this;
	var postData = {};
	
	self.queueRequest({
		type : 'request',
		path : self.relationsPath,
		data : postData,
		callback : checkBack
	});
	
	function checkBack( result ) {
		callback( [] );
	}
}

ns.Treeroot.prototype.unsubscribe = function( clientId ) {
	const self = this;
	var contact = self.contacts.get( clientId );
	if ( !contact ) {
		self.log( 'unsubscribe, invalid contact', clientId );
		return;
	}
	
	var postData = {
		DeleteID : contact.serviceId
	};
	
	self.subscriptionRequest( postData, unsubBack );
	function unsubBack( result ) {
		if ( !result ) {
			self.log( 'remove contact failed ', result );
			return;
		}
		
		//self.updateContacts();
	}
}

ns.Treeroot.prototype.subscribe = function( sub ) {
	const self = this;
	const idTypes = [
		'ContactID',
		'ContactEmail',
		'ContactNumber', // phone number
		'ContactUsername',
	];
	
	const typeIndex = idTypes.indexOf( sub.idType );
	if ( typeIndex == -1 ) {
		self.log( 'subscribe: invalid id type', sub.idType );
		return;
	}
	
	const postData = {};
	postData[ idTypes[ typeIndex ]] = sub.id;
	
	self.subscriptionRequest( postData, subBack );
	function subBack( result ) {
		let ok = false;
		if ( result && result.response && 'ok' === result.response )
			ok = true;
		
		const subConfirm = {
			type : 'confirm',
			data : {
				reqId    : sub.reqId,
				response : ok,
			},
		};
		self.subscriptionEvent( subConfirm );
	}
}

ns.Treeroot.prototype.allowSubscription = function( clientId ) {
	const self = this;
	const contact = self.subscriptions.get( clientId );
	if ( !contact ) {
		self.log( 'allowSubscription, invalid contact', clientId );
		return;
	}
	
	const postData = {
		AllowID : contact.serviceId
	};
	
	self.subsAllowed.push( contact.serviceId );
	self.subscriptionRequest( postData, allowSubBack );
	function allowSubBack( result ) {
		if( !result ) {
			self.log( 'allow sub faile', result );
			return;
		}
		
		//self.updateContacts();
	}
}

ns.Treeroot.prototype.denySubscription = function( clientId ) {
	const self = this;
	var contact = self.subscriptions.get( clientId );
	if ( !contact ) {
		self.log( 'denySubscription, invalid contact', clientId );
		return;
	}
	
	var postData = {
		DenyID : contact.serviceId
	};
	
	self.subscriptionRequest( postData, denyBack );
	function denyBack( result ) {
		if( !result ) {
			self.log( 'deny sub failed', result );
			return;
		}
		
		//self.updateContacts();
	}
}

ns.Treeroot.prototype.cancelSubscription = function( clientId ) {
	const self = this;
	var contact = self.subscriptions.get( clientId );
	var postData = {
		CancelID : contact.serviceId
	};
	
	self.subscriptionRequest( postData, cancelBack );
	function cancelBack( result ) {
		if ( !result ) {
			self.log( 'cancel request failed', result );
			return;
		}
		
		
		//self.updateContacts();
	}
}

ns.Treeroot.prototype.subscriptionRequest = function( postData, callback ) {
	const self = this;
	self.queueRequest({
		type : 'request',
		path : self.subscriptionPath,
		data : postData,
		callback : callback,
	});
}

ns.Treeroot.prototype.updateContacts = function() {
	const self = this;
	if ( self.isUpdatingContacts )
		return;
	
	self.isUpdatingContacts = true;
	
	self.fetchContacts( contactsBack );
	function contactsBack( result ) {
		if ( !result ) {
			return;
		}
		
		let relations = result.relations;
		let requests = result.requests;
		if ( !relations.length && !requests.length )
			sendNullContact();
		
		self.checkContacts( relations, requests );
		self.isUpdatingContacts = false;
		
		function sendNullContact() {
			var action = {
				type : 'add',
				data : {
					contact : null
				}
			};
			self.contactEvent( action );
		}
	}
}

ns.Treeroot.prototype.checkContacts = function( relations, requests ) {
	const self = this;
	relations = relations || [];
	requests = requests || [];
	const newRelations = [];
	const newRelationIds = [];
	let contactServiceIds = null;
	sortContacts();
	
	function sortContacts() {
		relations.forEach( addNew );
		function addNew( relation ) {
			if( self.contacts.get( relation.ID ))
				return;
			
			newRelations.push( relation );
			newRelationIds.push( relation.ID );
		}
		
		getProfileImageData();
	}
	
	function getProfileImageData() {
		var imageIdString = newRelations
			.filter( notNullId )
			.map( getImageId )
			.join(',');
			
		function notNullId( relation ) {
			return relation.ImageID != 0;
		}
		function getImageId( relation ) {
			return relation.ImageID;
		}
		
		if ( imageIdString )
			self.fetchContactImages( imageIdString, addProfileImageToRelation );
		else
			addProfileImageToRelation( [] );
	}
	
	function addProfileImageToRelation( imageData ) {
		imageData;
		newRelations.forEach( addImageData );
		
		function addImageData( relation ) {
			var profileImage = imageData.filter( matchIds )[ 0 ];
			relation.ProfileImage = profileImage || null;
			
			function matchIds( imageObj ) {
				if ( imageObj.ID === relation.ImageID )
					return true;
				return false;
			}
		}
		
		//removeOldContacts();
		addNewContacts();
	}
	
	function removeOldContacts() {
		contactServiceIds = self.contacts.getServiceIdList();
		contactServiceIds.forEach( check );
		
		function check( serviceId ) {
			if ( isOld( serviceId ) ) {
				self.removeContact( serviceId );
			}
			
			function isOld( serviceId ) {
				return !relations.some( isMatch );
				function isMatch( relation ) {
					return relation.ID == serviceId;
				}
			}
		}
		
		addNewContacts();
	}
	
	function addNewContacts() {
		newRelations.forEach( add );
		function add( relation ) {
			self.addContact( relation );
			self.removeSubscription( relation.ID );
		}
		
		updateStatus();
	}
	
	function updateStatus() {
		self.contactChecksNum = relations.length;
		self.contactChecksDone = 0;
		if ( relations.length )
			relations.forEach( checkRelation );
		else
			updateSubscriptions();
		
		function checkRelation( relation ) {
			checkRelationStatus( relation, back );
			function back() {
				self.contactChecksDone += 1;
				if ( self.contactChecksDone !== self.contactChecksNum )
					return;
				
				updateSubscriptions();
			}
		}
		
		function checkRelationStatus( relation, done ) {
			var relation = relation;
			var contact = self.contacts.get( relation.ID );
			if ( !contact ) {
				self.log( 'no contact for relation', relation );
				done( false );
				return;
			}
			
			var contactState = self.contactState[ contact.serviceId ];
			if ( !contactState ) {
				self.log( 'updateStatus missing data, ' + self.getNow() );
				self.log( 'relation', relation );
				self.log( 'contact', contact );
				self.log( 'contactState', contactState );
				done( false );
				return;
			}
			
			onlineChange( relation, contact, contactState );
			done( true );
		}
		
		function onlineChange( relation, contact, contactState ) {
			var str = relation.Username
				+ ': relation.IsOnline - '
				+ relation.IsOnline
				+ ', contact.online - '
				+ ( !!contact.online ).toString();
			//self.log( str );
			
			var isOnline = !!relation.IsOnline;
			if( isOnline === contact.online ) {
				return;
			}
			
			contact.online = isOnline;
			var online = isOnline ? 'online' : 'offline';
			var presence = {
				type : 'presence',
				data : {
					value : online,
					clientId : contact.clientId,
					time : Date.now(),
				},
			};
			self.contactEvent( presence );
		}
		
		function hasCryptSetup( relation, contact, cState, done ) {
			if ( cState.cryptChecked || ( cState.encId && cState.encKey )) {
				done();
				return;
			}
			
			cState.cryptChecked = true;
			self.getMessages( contact.serviceId, 1 , done );
		}
	}
	
	function updateSubscriptions() {
		var currentSubIds = self.subscriptions.getServiceIdList();
		requests.forEach( addNew );
		done( true );
		
		function removeOld() {
			var old = currentSubIds.filter( notInRequests );
			function notInRequests( subId ) {
				return !requests.some( match );
				function match( request ) {
					return request.ID == subId;
				}
			}
			
			old.forEach( remove );
			function remove( subId ) {
				self.removeSubscription( subId );
			}
		}
		
		function addNew( request ) {
			self.addSubscription( request );
		}
	}
	
	function done( success ) {
		if( typeof callback == 'function' )
			callback( success );
		
		self.isUpdatingContacts = false;
	}
}

ns.Treeroot.prototype.checkHasMessage = function( relation, serviceId, done ) {
	const self = this;
	const contactState = self.contactState[ serviceId ];
	let rlm = relation.LastMessage;
	let clmid = contactState.lastMessageId;
	if ( rlm )
		rlm = parseInt( rlm, 10 );
	
	if ( !rlm && clmid ) {
		done();
		return;
	}
	
	// no message v0v
	if ( null == rlm ) {
		done();
		return;
	}
	
	// no new message( ? )
	if ( rlm === clmid ) {
		done();
		return;
	}
	
	// only triggers on first update with a contact that have a LastMessage id
	if ( null == clmid )
		contactState.lastMessageId = rlm;
	
	// well, then. lets do this
	let reqTime = Date.now();
	let lastMsgId = null;
	if ( clmid ) {
		if ( clmid < rlm )
			lastMsgId = clmid;
		
	} else
		lastMsgId = rlm;
	
	self.getNewMessages(
		serviceId,
		lastMsgId,
		messagesBack
	);
	
	function messagesBack( messages ) {
		if ( !messages ) {
			done();
			return;
		}
		
		let resTime = Date.now();
		let runTimeMS = resTime - reqTime;
		self.messagesToClient( messages, serviceId );
		done();
	}
}

ns.Treeroot.prototype.getAccountInfo = function( callback ) {
	const self = this;
	// session gets added to postData in request dispatch
	// auth without user / pass returns user id if you have a valid session
	var postData = {
	};
	
	var req = {
		type : 'request',
		path : self.authPath,
		data : postData,
		callback : idBack,
	};
	
	self.queueRequest( req );
	function idBack( res ) {
		if ( !res || res.response != 'ok' || !res.data ) {
			self.log( 'getAccountInfo - no id', res );
			done( false );
			return;
		}
		
		var accountId = res.data;
		self.fetchContact( accountId, accountBack );
	}
	function accountBack( res ) {
		if ( !res || !res.response || ( res.response.toLowerCase() !== 'ok' )) {
			self.log( 'getAccountInfo - failed', res );
			done( false );
			return;
		}
		
		var acc = res.items.Contacts[ 0 ];
		self.account = {};
		self.account.name = acc.Name || acc.DisplayName || acc.Username || acc.Email;
		self.account.id = acc.ID;
		self.account.avatarId = parseInt( acc.ImageID, 10 );
		
		if ( self.account.avatarId )
			self.fetchContactImages( self.account.avatarId, imageBack );
		else
			done( true );
	}
	function imageBack( res ) {
		if( !res ) {
			self.log( 'getAccountInfo - no imageback' );
			self.account.imagePath = null;
		}
		else
			self.account.imagePath = res[ 0 ];
		
		done( true );
	}
	
	function done( success ) {
		if ( !success ) {
			callback( false );
			self.log( 'getAccountInfo - failed', self.account );
			return;
		}
		
		var msg = {
			type : 'account',
			data : {
				account : self.account,
			},
		};
		
		self.toClient( msg );
		callback( success );
	}
}

ns.Treeroot.prototype.setNotLoggedIn = function() {
	const self = this;
	self.account = null;
	const unset = {
		type : 'account',
		data : null,
	};
	self.toClient( unset );
}

ns.Treeroot.prototype.resetPassphrase = function( e, socketId ) {
	const self = this;
	var postData = {
		Email : self.conf.login,
	};
	
	var req = {
		type     : 'request',
		path     : self.passResetPath,
		data     : postData,
		callback : response,
	};
	self.queueRequest( req, true );
	function response( res ) {
		if ( !res.data ) {
			self.log( 'resetPassphrase - no recovery key', res );
			//return;
		}
		
		var askNewPass = {
			type : 'pass-ask-auth',
			data : {
				uniqueId : self.uniqueId,
			},
		};
		self.toClient( askNewPass );
	}
}

ns.Treeroot.prototype.register = function( data, socketId ) {
	const self = this;
	var required = [
		'Email',
		'Username',
		'Password',
	];
	data.Password = data.Passphrase;
	if ( missing( data )) {
		regFailed( 'missing data' );
		return;
	}
	
	var postData = {
		'Email' : data.Email,
		'Username' : data.Username,
		'Password' : data.Password,
		// optional
		'Firstname' : data.Firstname || '',
		'Middlename' : data.Middlename || '',
		'Lastname' : data.Lastname || '',
		'Gender' : data.Gender || '',
		'Mobile' : data.Mobile || '',
		'Image' : data.Image || '',
	};
	
	var req = {
		path : self.registerPath,
		data : postData,
		callback : response,
	};
	self.stopped = false;
	self.queueRequest( req, true );
	function response( res ) {
		if ( res.response != 'ok' ) {
			regFailed( res.reason );
			self.setConnectionError( 'info-missing', self.conf );
			return
		}
		
		data.AuthKey = res.data;
		self.activate( data, socketId );
	}
	
	function regFailed( reason ) {
		var email = 'This e-mail address is already registered with '
					+ self.conf.host + '.';
		var regEvent = {
			type : 'register',
			data : {
				success : false,
				message : reason || 'Create account failed',
				error : {
					Email : email,
				},
				data : data,
			},
		};
		self.toClient( regEvent, socketId );
	}
	
	function missing( data ) {
		return !required.every( isValid );
		function isValid( field ) {
			var value = data[ field ];
			if ( typeof( value ) !== 'string' )
				return false;
			
			if ( !value.length )
				return false;
			
			return true;
		}
	}
}

ns.Treeroot.prototype.activate = function( data, socketId ) {
	const self = this;
	var postData = {
		Email : data.Email,
		UserType : '0',
		AuthKey : data.AuthKey,
		Source : self.source,
	};
	
	var req = {
		type : 'request',
		path : self.registerActivatePath,
		data : postData,
		callback : response,
	};
	
	self.queueRequest( req );
	function response( res ) {
		if ( res.response != 'ok' ) {
			self.log( 'activate failed', res );
			activateFailed( res.reason || JSON.stringify( res ));
			return;
		}
		
		self.connectionStatus( 'connecting', Date.now() );
		self.uniqueId = res.data;
		var registerSuccess = {
			type : 'register',
			data : {
				success : true,
				data : data,
			},
		};
		self.toClient( registerSuccess, socketId );
		self.updateLogin( data.Email, loginUpdated );
		function loginUpdated() {
			self.getUniqueId( uidBack );
		}
		
		function uidBack( success ) {
			if ( !success )
				return;
			
			self.sendUniqueId();
		}
	}
	
	function activateFailed( reason ) {
		var activateFail = {
			type : 'register',
			data : {
				success : false,
				message : reason,
			},
		};
		self.toClient( activateFail, socketId );
	}
}

ns.Treeroot.prototype.tryRegisterDataLogin = function( data ) {
	const self = this;
	log ( 'tryRegisterdataLogiun - NYI', data );
	return;
	
	self.getUniqueId( successBack );
	function successBack() {
		
	}
}

ns.Treeroot.prototype.getPostOptions = function( path, dataLength ) {
	const self = this;
	return {
		hostname : self.conf.host,
		port : 443,
		rejectUnauthorized : false,
		path : path,
		method : 'POST',
		headers : self.getPostHeader( dataLength ),
	};
}

ns.Treeroot.prototype.queueRequest = function( request, infront ) {
	const self = this;
	if ( !request )
		throw new Error( 'queueRequest called with no request' );
	
	if ( !request.callback ) {
		self.log( 'request does not have a callback', request, 4 );
		throw new Error( 'request does not have callback' );
	}
	
	if ( request.type == 'request' ) {
		if ( infront )
			self.requestQueue.unshift( request );
		else
			self.requestQueue.push( request );
	}
	else {
		self.updateQueue.push( request );
	}
	
	if ( !self.reqLoopActive )
		self.startRequestLoop();
}

ns.Treeroot.prototype.nextRequest = function() {
	const self = this;
	if ( self.requestQueue.length )
		return self.requestQueue.shift();
	if( self.updateQueue.length ) {
		var item = self.updateQueue.shift();
		return item;
	}
	
	self.stopRequestLoop();
	return false;
}

ns.Treeroot.prototype.clearRequestQueue = function() {
	const self = this;
	self.requestQueue.forEach( returnRequest );
	self.updateQueue.forEach( returnRequest );
	self.requestQueue = [];
	self.updateQueue = [];
	
	function returnRequest( req ) {
		if ( req.callback )
			req.callback( false );
		
		req.callback = null;
	}
}

ns.Treeroot.prototype.clearRequestTimeouts = function() {
	const  self = this;
	self.requestsOnTimeout.forEach( clear );
	self.requestsOnTimeout = [];
	function clear( id ) {
		clearTimeout( id );
	}
}

ns.Treeroot.prototype.startRequestLoop = function() {
	const self = this;
	if ( self.reqLoopInterval ) {
		clearInterval( self.reqLoopInterval );
		self.reqLoopInterval = null;
	}
	
	self.timeStep = 50;
	self.busy = false;
	self.reqLoopActive = true;
	self.failedRequests = 0;
	self.maxFailedRequests = 10;
	
	self.reqLoopInterval = setInterval( step, self.timeStep );
	function step() {
		if ( !self.reqLoopActive )
			return;
		
		if ( self.busy )
			return;
		
		if ( self.failedRequests > self.maxFailedRequests ) {
			self.log( 'too many requests failed, stopping', self.requestQueue, 4 );
			self.stop();
			return;
		}
		
		self.doRequestStep();
	}
}

ns.Treeroot.prototype.stopRequestLoop = function() {
	const self = this;
	if ( self.reqLoopInterval ) {
		clearInterval( self.reqLoopInterval );
		self.reqLoopInterval = null;
	}
	
	self.clearRequestQueue();
	self.reqLoopActive = false;
}

ns.Treeroot.prototype.doRequestStep = function() {
	const self = this;
	var request = self.nextRequest();
	if ( !request )
		return;
	
	if ( request.longpoll ) {
		self.registerLongpoll( request );
		setTimeout( anotherOnePlease, 1 );
	} else
		self.busy = true;
	
	self.sendRequest( request, reqBack );
	function reqBack( err, data, req ) {
		if ( request.longpoll )
			self.finishLongpoll( request.longpoll );
		else
			self.busy = false;
		
		if ( err ) {
			self.failedRequests++;
			self.handleRequestError( err, request );
			return;
		}
		
		self.failedRequests = 0;
		self.handleResponse( data, request, req );
	}
	
	function anotherOnePlease() {
		self.doRequestStep();
	}
}

ns.Treeroot.prototype.registerLongpoll = function( id ) {
	const self = this;
	if ( self.longpolls[ id ])
		abortLongpoll( id );
	
	self.longpolls[ id ] = true;
	return true;
	
	function abortLongpoll( id ) {
		self.abortLongpoll( id );
	}
}

ns.Treeroot.prototype.setLongpoll = function( id, req ) {
	const self = this;
	self.longpolls[ id ] = req;
}

ns.Treeroot.prototype.finishLongpoll = function( id ) {
	const self = this;
	delete self.longpolls[ id ];
}

ns.Treeroot.prototype.abortLongpoll = function( id ) {
	const self = this;
	const req = self.longpolls[ id ];
	delete self.longpolls[ id ];
	if ( !req )
		return;
	
	if ( 'boolean' === typeof( req ))
		return;
	
	try {
		req.abort();
	} catch( e ) {
		self.log( 'exp while aborting longpoll', e );
	}
}

ns.Treeroot.prototype.clearLongpolls = function() {
	const self = this;
	let ids = Object.keys( self.longpolls );
	ids.forEach( abort );
	self.longpolls = {};
	
	function abort( id ) {
		self.abortLongpoll( id );
	}
}

ns.Treeroot.prototype.sendRequest = function( request, done ) {
	const self = this;
	var path = self.apiPath + request.path;
	var data = request.data || {};
	if ( self.sessionId )
		data[ 'SessionID' ] = self.sessionId;
	
	var query = querystring.stringify( data );
	var options = self.getPostOptions( path, query.length );
	var req = https.request( options, requestBack );
	if ( request.longpoll )
		self.setLongpoll( request.longpoll, req );
	
	let d = new Date();
	let rq = {
		timestamp : Date.now(),
		time      : d.toLocaleString() + ':' + d.getMilliseconds(),
		path      : path,
		query     : query,
		options   : options,
	};
	req.on( 'error', errorResponse );
	req.write( query );
	req.end();
	
	function errorResponse( err ) {
		done( err.code, null );
	}
	
	function requestBack( res ) {
		var chunks = [];
		res.on( 'data', read );
		res.on( 'end', end );
		
		function read( chunk ) { chunks.push( chunk ); }
		function end() {
			var data = chunks.join( '' );
			done( null, data, rq );
		}
	}
}

ns.Treeroot.prototype.handleRequestError = function( errCode, request ) {
	const self = this;
	if ( self.shouldRetry( request ) )
		self.requeueRequest( request, 'ERR_HOST_' + errCode );
	else
		request.callback( false );
}

ns.Treeroot.prototype.handleResponse = function( xml, request, reqData ) {
	const self = this;
	self.delouse( xml, dataBack );
	function dataBack( data ) {
		if ( !data ) {
			/*
			self.log( 'failed to parse data for',{
				req  : request,
				data : data,
				raw  : xml,
				user : self.conf.login,
			}, 4 );
			*/
			done( false );
			return;
		}
		
		let res = null;
		if ( data.response )
			res = data;
		else
			res = data.xml;
		
		if ( !res ) {
			self.log( 'no data in response - req',
				{ r : request, d : data, u : self.conf.login }, 4 );
			done( false );
			return;
		}
		
		checkResponse( res );
	}
	
	function checkResponse( data ) {
		var success = data.response;
		if ( success && ( 'ok' === success.toLowerCase() )) {
			done( data );
			return;
		}
		
		// nothing to list
		if ( '0002' === data.code ) {
			done( false );
			return;
		}
		
		// Wrong username or password
		if ( '0003' === data.code ) {
			done( data );
			return;
		}
		
		// session not found
		if ( '0004' === data.code ) {
			done( false );
			self.reconnect();
			return;
		}
		
		if ( self.shouldRetry( request ) )
			self.requeueRequest( request, 'ERR_RESPONSE_NOT_OK' );
		else
			done( false );
	}
	
	function done( res ) {
		if ( !request.callback )
			return;
		
		//self.log( 'requestResponse', res );
		request.callback( res, reqData, xml );
	}
}

ns.Treeroot.prototype.shouldRetry = function( req ) {
	const self = this;
	if ( self.stopped )
		return false;
	
	if ( 'request' !== req.type )
		return false;
	
	if ( !self.reqMaxRetries )
		return true;
	
	if ( req.attempts && req.attempts > self.reqMaxRetries ) {
		self.log( 'too many failed attempts on request, discarding', req );
		return false;
	}
	
	return true;
}

ns.Treeroot.prototype.requeueRequest = function( req, errCode ) {
	const self = this;
	self.connectionStatus( 'connecting', Date.now());
	req.attempts = req.attempts ? ( req.attempts + 1 ) : 1;
	var timeout = self.reqRetryBaseStep * req.attempts;
	if ( req.attempts > 5 ) {
		timeout = timeout * 3; // increasing timeout after 5 attempts
		if ( 1000 * 15 < timeout )
			timeout = 1000 * 20; // and capping to 20 sec
		
		const now = Date.now();
		self.setConnectionError( 'host', {
			host : self.conf.host,
			err : errCode,
			time : now,
			retry : now + timeout,
			attempts : req.attempts,
		});
	}
	
	var reqTimeoutId = setTimeout( requeueReq, timeout );
	self.requestsOnTimeout.push( reqTimeoutId );
	function requeueReq() {
		var idIndex = self.requestsOnTimeout.indexOf( reqTimeoutId );
		if ( -1 === idIndex )
			return;
		
		if ( self.stopped )
			return;
		
		self.requestsOnTimeout.splice( idIndex, 1 );
		self.queueRequest( req, true );
	}
}

ns.Treeroot.prototype.getArr = function( data ) {
	const self = this;
	if ( !data )
		return [];
	
	if ( data instanceof Array )
		return data;
	
	return [ data ];
}

ns.Treeroot.prototype.delouse = function( xml, callback ) {
	const self = this;
	// first, lets pretend its json
	let json = self.objectify( xml );
	if ( json ) {
		callback( json );
		return;
	}
	
	// ohokay, so its xml :(((((((
	var clean = null;
	var options = {
		explicitArray : false,
		valueProcessors : [ numbers ],
	};
	
	function numbers( str ) {
		var num = Number( str );
		if ( num.toString() === str )
			return num;
			
		return str;
	}
	
	var parser = new xmlAway.Parser( options );
	try {
		parser.parseString( xml, parsed );
	} catch( e ) {
		self.log( 'delouse catch', e );
		callback( null );
	}
	
	function parsed( err, res ) {
		if ( err ) {
			self.log( 'parsed.err', { err : err, xml : xml });
			callback( false );
			return;
		}
		
		var cpy = self.stringify( res );
		var obj = self.objectify( cpy );
		callback( obj );
	}
}

ns.Treeroot.prototype.objectify = function( str ) {
	const self = this;
	if ( 'string' !== typeof( str ))
		return str;
	
	str = str.trim();
	try {
		return JSON.parse( str );
	} catch( e ) {
		return null;
	}
}

ns.Treeroot.prototype.stringify = function( obj ) {
	const self = this;
	if ( 'object' !== typeof( obj ))
		return obj;
	
	try {
		return JSON.stringify( obj );
	} catch ( e ) {
		return obj;
	}
}

ns.Treeroot.prototype.getPostHeader = function( length ) {
	const self = this;
	return {
		'Content-Type' : 'application/x-www-form-urlencoded',
		'Content-Length' : length
	}
}

ns.Treeroot.prototype.getNow = function() {
	const self = this;
	// 1970-01-13 21:02:09
	var now = new Date();
	var dateString = '';
	dateString += now.getFullYear() + '-';
	dateString += pad(( now.getMonth() + 1 )) + '-'; // months start at 0 apparently,
	                                                 // because fuck you
	dateString += pad( now.getDate()) + ' ';
	dateString += pad( now.getHours()) + ':';
	dateString += pad( now.getMinutes()) + ':';
	dateString += pad( now.getSeconds());
	
	return dateString;
	
	function pad( num ) {
		return ( num < 10 ? '0' + num : num );
	}
}

module.exports = ns.Treeroot;


/*

function msgCodes ( $code, $reason = false ) {
	if( !$code ) return false;
	 // List of all the possible errors
	 $ers = array(
	 	'0000' => 'Missing protocol identifier',
	 	'0001' => 'No variables specified',
	 	'0002' => 'Nothing to list',
	 	'0003' => 'Wrong username / or password',
	 	'0004' => 'Session not found',
	 	'0005' => 'Session expired',
	 	'0006' => 'Account exists',
	 	'0007' => 'Registration failed',
	 	'0008' => 'Invitation not found',
	 	'0009' => 'Parameters allready exists',
	 	'0010' => 'Keygen failed',
	 	'0011' => 'Activation failed',
	 	'0012' => 'Access denied'
	 );
	 $rse = array(
	 	'0000' => 'You need to specify the protocol you wish to use in the URL.',
	 	'0001' => 'You have forgotten the parameters.',
	 	'0002' => 'There is nothing to list from the database.',
	 	'0003' => 'You need to provide the correct username / or password.',
	 	'0004' => 'You need to provide username and password, or session ID.',
	 	'0005' => 'You need to reauthenticate.',
	 	'0006' => 'Your account is allready registrated try authenticating instead.',
	 	'0007' => 'Account registration failed, contact node administrator.',
	 	'0008' => 'Your parameters doesn\'t match invited list.',
	 	'0009' => 'One or more of your parameters allready exists.',
	 	'0010' => 'Creation of key/token failed, contact support.',
	 	'0011' => 'Parameters didn\'t match or account is allready activated.',
	 	'0012' => 'Your request has been denied.'
	 );
	 return ( $reason ? $rse[ $code ] : $ers[ $code ] );
}

*/
