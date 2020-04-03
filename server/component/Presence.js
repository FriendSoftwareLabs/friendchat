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

const log = require( './Log' )( 'Presence' );
const confLog = require( './Log' )( 'Presence.Config' );
const connLog = require( './Log')( 'Presence.ServerConn' );
const uuid = require( './UuidPrefix' )( 'live' );
const events = require( './Emitter' );
const tls = require( 'tls' );
const WS = require( 'ws' );
const util = require( 'util' );
const fs = require( 'fs' );

var ns = {};

ns.Presence = function( clientConn, clientId ) {
	if ( !( this instanceof ns.Presence ))
		return new ns.Presence( clientConn, clientId );
	
	const self = this;
	self.type = 'presence';
	self.client = clientConn;
	self.id = clientId;
	
	self.server = null;
	self.conf = null;
	self.rooms = {};
	self.authBundle = null;
	self.identity = null;
	self.account = null;
	self.contacts = {};
	
	self.init();
}

// Public

// static
ns.Presence.prototype.getSetup = function( conf, username ) {
	return conf || {};
}

// Private

ns.Presence.prototype.init = function() {
	const self = this;
	self.client.on( 'connect', connect );
	self.client.on( 'reconnect', reconnect );
	self.client.on( 'initialize', initialize );
	self.client.on( 'kill', kill );
	
	// e - event
	// sid - socket id
	function connect( e, sid ) { self.connect( e, sid ); }
	function reconnect( e, sid ) { self.reconnect( e, sid ); }
	function initialize( e, sid ) { self.initialize( e, sid ); }
	function kill( e, sid ) { self.close( e ); }
	
	self.conf = new ns.Config( self.client );
	self.conf.on( 'host', connUpdated );
	self.conf.on( 'port', connUpdated );
	self.conf.on( 'login', loginUpdated );
	
	function connUpdated( e ) { self.handleConnUpdate( e ); }
	function loginUpdated( e ) { self.handleLoginUpdate( e ); }
	
	self.client.send({
		type : 'initialize',
		data : true,
	});
}

ns.Presence.prototype.initialize = function( initConf, socketId ) {
	const self = this;
	if ( initConf )
		updateInit( initConf );
	
	if ( !self.server || !self.server.connected )
		self.connect();
	else
		self.sendAccount( socketId );
	
	self.client.emitState();
	
	function updateInit( conf ) {
		if ( conf.authBundle )
			self.authBundle = conf.authBundle;
		
		if ( conf.identity )
			self.identity = conf.identity;
	}
}

ns.Presence.prototype.connect = function( conf, socketId ) {
	const self = this;
	if ( conf && conf.mod ) {
		conf.mod.host = conf.conf.host;
		conf.mod.port = conf.conf.port;
		conf = conf.mod;
	}
	
	if ( conf && ( self.type !== conf.type )) {
		log( 'connect - invalid conf', conf );
		return;
	}
	
	if ( conf )
		self.conf.set( conf );
	
	if ( !self.authBundle )
		return;
	
	if ( !self.identity )
		return;
	
	const connOpts = {
		auth    : self.authBundle,
		host    : self.conf.host,
		port    : self.conf.port,
	};
	
	if ( self.server )
		self.server.reconnect( connOpts );
	else
		self.setupServerConn( connOpts );
}

ns.Presence.prototype.setupServerConn = function( opts ) {
	const self = this;
	self.server = new ns.ServerConn(
		opts,
		onState,
		onClose
	);
	self.server.on( 'account', doAccountStuff );
	self.server.on( 'ready', connReady );
	
	function onState( e ) { self.handleConnState( e ); }
	function onClose( e ) { self.handleConnClosed( e ); }
	function connReady( e ) { self.handleConnReady( e ); }
	function doAccountStuff( e ) { self.handleAccountStage( e ); }
}

ns.Presence.prototype.reconnect = function() {
	const self = this;
	//self.clear();
	self.connect();
}

ns.Presence.prototype.disconnect = function() {
	const self = this;
	self.clear();
	self.releaseServerConn();
}

// server conn things

ns.Presence.prototype.handleConnReady = function() {
	const self = this;
	if ( !self.accountId )
		return;
	
	self.doLoggedInThings( self.accountId );
}

ns.Presence.prototype.handleConnState = function( state ) {
	const self = this;
	self.client.setState( state );
}

ns.Presence.prototype.handleConnClosed = function( err ) {
	const self = this;
	self.clear();
	const state = {
		type : 'error',
		data : err,
	};
	self.client.setState( state );
	self.releaseServerConn();
}

ns.Presence.prototype.clear = function() {
	const self = this;
	self.accountId = null;
}

// account things

ns.Presence.prototype.handleAccountStage = function( event ) {
	const self = this;
	// general event
	if ( !event || !event.type ) {
		defaultHandler();
		return;
	}
	
	// replies to sent account events
	if ( 'create' === event.type ) {
		handleCreate( event.data );
		return;
	}
	
	if ( 'login' === event.type ) {
		handleLogin( event.data );
		return;
	}
	
	//
	function defaultHandler() {
		// atempt to login in
		self.tryLogin();
	}
	
	function handleCreate( data ) {
		/*
			if we created an account, data will be the account,
			potentially with a error prop.
			
			null data is from a login attempt where the account
			was not found and the server is hinting that we need to
			create one, so do that
		*/
		if ( !data )
			self.createAccount();
		else
			self.accountCreated( data );
	}
	
	function handleLogin( data ) {
		/*
			null means a create attempt, but account exists
			data means succesful login
		*/
		if ( null == data )
			self.tryLogin();
		else
			self.doLoggedInThings( data );
	}
	
	function askClient( type ) {
		var ask = {
			type : type,
			data : null,
		}
		self.client.send( ask );
	}
}

ns.Presence.prototype.createAccount = function() {
	const self = this;
	if ( !self.identity ) {
		log( 'createAccount - no identity' );
		return;
	}
	
	let login = self.identity.alias;
	let name = self.identity.name;
	if ( !login || !login.length ) {
		askClientFor( 'login' );
		return;
	}
	
	var accInfo = {
		login : login,
		name  : name,
		pass  : null,
	};
	var create = {
		type : 'create',
		data : accInfo,
	};
	self.server.send( create );
	
	function askClientFor( type ) {
		const ask = {
			type : type,
		};
		self.client.send( ask );
	}
}

ns.Presence.prototype.accountCreated = function( acc ) {
	const self = this;
	self.conf.update( 'login', acc.login );
	const login = {
		type : 'login',
		data : acc.login,
	};
	self.server.send( login );
}

ns.Presence.prototype.tryLogin = function() {
	const self = this;
	if ( !self.identity ) {
		log( 'tryLogin - no login', {
			conf : self.conf,
			id   : self.identity,
		}, 3 );
		return;
	}
	
	self.identity.fUsername = self.identity.fUsername || self.identity.alias;
	const login = {
		type : 'login',
		data : self.identity,
	};
	self.server.send( login );
}

ns.Presence.prototype.doLoggedInThings = function( accountId ) {
	const self = this;
	if ( !self.accountId )
		self.bindAccount( accountId );
	
	self.client.setState( 'online', Date.now());
	self.sendAccount();
}

ns.Presence.prototype.sendAccount = function( socketId ) {
	const self = this;
	if ( !self.accountId )
		return;
	
	const acc = {
		type : 'account',
		data : self.accountId,
	};
	self.client.send( acc, socketId );
}

ns.Presence.prototype.bindAccount = function( accId ) {
	const self = this;
	self.accountId = accId;
	self.client.on( accId, toPresence );
	self.server.on( accId, toClients );
	
	function toPresence( event ) {
		const wrap = {
			type : accId,
			data : event,
		};
		self.server.send( wrap );
	}
	
	function toClients( event ) {
		const wrap = {
			type : accId,
			data : event,
		};
		self.client.send( wrap );
	}
}

// conf updates

ns.Presence.prototype.handleConnUpdate = function( value ) {
	const self = this;
	/*
	var conf = {
		host : self.conf.host,
		port : self.conf.port,
	};
	*/
	self.connect();
}

ns.Presence.prototype.handleLoginUpdate = function( value ) {
	const self = this;
	log( 'handleLoginUpdate - NYI', value );
	//self.reconnect();
}

//
ns.Presence.prototype.releaseServerConn = function() {
	const self = this;
	if ( !self.server )
		return;
	
	self.server.close();
	delete self.server;
}

ns.Presence.prototype.close = function( callback ) {
	const self = this;
	self.releaseServerConn();
	
	if ( self.conf )
		self.conf.close();
	
	if ( self.client )
		self.client.close();
	
	delete self.conf;
	delete self.client;
	
	if ( callback )
		setTimeout( callback, 10 );
}

/*
// Config
*/
ns.Config = function( client ) {
	if ( !( this instanceof ns.Config ))
		return new ns.Config( client );
	
	const self = this;
	events.Emitter.call( self );
	self.client = client;
	self.init();
}

util.inherits( ns.Config, events.Emitter );

ns.Config.prototype.labels = [
	'host',
	'port',
	'displayName',
	'login',
	'password',
	'settings',
];

// Public

ns.Config.prototype.set = function( conf ) {
	const self = this;
	
	self.labels.forEach( set );
	function set( label ) {
		self[ label ] = conf[ label ];
	}
}

ns.Config.prototype.get = function() {
	const self = this;
	confLog( 'get', self );
	var conf = {};
	self.labels.forEach( add );
	return conf;
	
	function add( label ) {
		conf[ label ] = self[ label ];
	}
}

ns.Config.prototype.update = function( prop, value ) {
	const self = this;
	const update = {
		setting : prop,
		value   : value,
	};
	self.receiveUpdate( update );
}

ns.Config.prototype.close = function() {
	const self = this;
	self.release(); // from Emitter
	self.client.off( 'settings' );
	
	delete self.client;
}

// Private

ns.Config.prototype.init = function() {
	const self = this;
	self.client.on( 'settings', get );
	self.client.on( 'setting', set );
	
	function get( e, socketId ) { self.emitConfig( socketId ); }
	function set( e, socketId ) { self.receiveUpdate( e, socketId ); }
}

ns.Config.prototype.emitConfig = function( socketId ) {
	const self = this;
	var wrap = {
		type : 'settings',
		data : self.get(),
	};
	self.send( wrap, socketId );
}

ns.Config.prototype.receiveUpdate = function( update, socketId ) {
	const self = this;
	confLog( 'receiveUpdate', update );
	if ( !update.setting )
		return;
	
	self.doPersist( update.setting, update.value, persistBack );
	function persistBack( update ) {
		self.updateClient( update );
		if ( !update.success )
			return;
		
		var base = isBase( update.setting );
		if ( base )
			self[ update.setting ] = update.value;
		else
			self.settings[ update.setting ] = update.value;
		
		self.emit( update.setting, update.value ); // from Emitter
	}
	
	function isBase( setting ) {
		return self.labels.some( match );
		function match( item ) {
			return item === setting;
		}
	}
}

ns.Config.prototype.doPersist = function( setting, value, callback ) {
	const self = this;
	var update = {
		setting : setting,
		value   : value,
		success : false,
	};
	self.client.persistSetting( update, setBack );
	function setBack( res ) {
		if ( !res )
			res = { success : false };
		
		callback( res );
	}
}

ns.Config.prototype.updateClient = function( update ) {
	const self = this;
	var wrap = {
		type : 'setting',
		data : {
			type : update.setting,
			data : update,
		},
	};
	self.send( wrap );
}

ns.Config.prototype.send = function( msg ) {
	const self = this;
	if ( !self.client )
		return;
	
	self.client.send( msg );
}


/*
// ServerConn
*/
ns.ServerConn = function( conf, onstate, onclose ) {
	if ( !( this instanceof ns.ServerConn ))
		return new ns.ServerConn( conf );
	
	const self = this;
	events.Emitter.call( self );
	
	self.auth = conf.auth;
	self.host = conf.host;
	self.port = conf.port;
	self.onstate = onstate;
	self.onclose = onclose;
	
	self.socket = null;
	self.connected = false;
	self.connectAttempt = 0;
	self.maxConnectAttempts = 0;
	self.parts = [];
	
	self.init();
}

util.inherits( ns.ServerConn, events.Emitter );

// Public

ns.ServerConn.prototype.connect = function( conf ) {
	const self = this;
	if ( conf ) {
		self.host = ( null == conf.host ) ? self.host : conf.host;
		self.port = ( null == conf.port ) ? self.port : conf.port;
	}
	
	if ( self.connectTimeout || self.isConnecting )
		return;
	
	if ( !self.host || !self.port ) {
		// set disconnected state
		return null;
	}
	
	self.isConnecting = true;
	/*
	const opts = {
		host : self.host,
		port : self.port,
	};
	*/
	
	//self.socket = tls.connect( opts );
	//self.socket.setEncoding( 'utf8' );
	const host = 'wss://' + self.host + ':' + self.port;
	const subProto = '';
	const opts = {
		rejectUnauthorized : false,
	};
	self.socket = new WS( host, subProto, opts );
	
	//self.socket.on( 'secureConnect', open );
	self.socket.on( 'open', open );
	self.socket.on( 'close', closed );
	self.socket.on( 'error', error );
	self.socket.on( 'message', onData );
	//self.socket.on( 'end', ended );
	//self.socket.on( 'data', onData );
	
	function open( e ) { self.handleOpen(); }
	function closed( e ) { self.handleClose( e ); }
	function error( e ) { self.handleError( e ); }
	//function ended( e ) { self.handleEnded( e ); }
	function onData( e ) { self.handleData( e ); }
}

ns.ServerConn.prototype.send = function( msg ) {
	const self = this;
	const wrap = {
		type : 'msg',
		data : msg,
	};
	self.sendOnSocket( wrap );
}

ns.ServerConn.prototype.reconnect = function( conf ) {
	const self = this;
	self.connectAttempt = 0;
	if ( self.connectTimeout ) {
		clearTimeout( self.connectTimeout );
		self.connectTimeout = null;
	}
	
	self.disconnect();
	self.connect( conf );
}

ns.ServerConn.prototype.disconnect = function() {
	const self = this;
	self.connected = false;
	self.isConnecting = false;
	self.clearSocket();
	
	const offline = {
		type : 'offline',
		data : Date.now(),
	};
	self.emitState( offline );
}

ns.ServerConn.prototype.close = function() {
	const self = this;
	if ( self.socket )
		self.disconnect();
	
	delete self.host;
	delete self.port;
	delete self.onstate;
	delete self.onclose;
	
	self.emitterClose();
}

// Private

ns.ServerConn.prototype.init = function() {
	const self = this;
	self.connMap = {
		'authenticate' : auth,
		'session'      : session,
		'ping'         : ping,
		'pong'         : pong,
	};
	
	function auth( e ) { self.handleAuthenticate( e ); }
	function session( e ) { self.handleSession( e ); }
	function ping( e ) { self.handlePing( e ); }
	function pong( e ) { self.handlePong( e ); }
	
	self.connect();
}

ns.ServerConn.prototype.emitState = function( state ) {
	const self = this;
	if ( !self.onstate )
		return;
	
	self.onstate( state );
}

ns.ServerConn.prototype.handleOpen = function() {
	const self = this;
	connLog( 'handleOpen' );
	self.connected = true;
	self.isConnecting = false;
	self.connectAttempt = 0;
	if ( self.onopen )
		self.onopen( true );
	
	const status = {
		type : 'open',
		data : Date.now(),
	}
	self.emitState( status );
}

ns.ServerConn.prototype.handleClose = function() {
	const self = this;
	connLog( 'handleClose' );
	const status = {
		type : 'offline',
		data : Date.now(),
	}
	self.emitState( status );
	if ( self.connected )
		self.handleDisconnect();
	
	self.connected = false;
}

ns.ServerConn.prototype.handleError = function( err ) {
	const self = this;
	connLog( 'handleError', err );
	self.handleDisconnect( err );
}

ns.ServerConn.prototype.handleEnded = function( err ) {
	const self = this;
	self.handleDisconnect( err );
}

ns.ServerConn.prototype.handleDisconnect = function( err ) {
	const self = this;
	self.isConnecting = false;
	self.clearSocket();
	const error = {
		type : 'error',
		data : 'ERR_CONN_DISCONNECT',
	};
	self.emitState( error );
	self.tryReconnect();
}

ns.ServerConn.prototype.tryReconnect = function( instant ) {
	const self = this;
	if ( !self.auth ) {
		self.disconnect();
		return;
	}
	
	if ( self.maxConnectAttempts
		&& ( self.connectAttempt >= self.maxConnectAttempts )) {
		self.onclose( 'ERR_CONN_GIVING_UP' );
		return;
	}
	
	if ( self.connectTimeout || self.isConnecting )
		return;
	
	self.clearSocket();
	self.connectAttempt++;
	let timeout = calcTimeout( self.connectAttempt );
	if ( instant ) {
		timeout = 1;
		return;
	}
	
	self.connectTimeout = setTimeout( connect, timeout );
	const reconn = {
		type : 'connecting',
		data : Date.now() + timeout,
	};
	self.emitState( reconn );
	
	function connect() {
		self.connectTimeout = null;
		self.connect();
	}
	
	function calcTimeout( attempt ) {
		let base = attempt * 2 * 1000;
		let variable = Math.floor( Math.random() * ( base / 2 ));
		let timeout = base + variable;
		return timeout;
	}
}

ns.ServerConn.prototype.handleData = function( str ) {
	const self = this;
	let event = null;
	try {
		event = JSON.parse( str );
	} catch ( e ) {
		self.parts.push( str );
	}
	
	if ( !event && ( 2 <= self.parts.length ))
		event = self.tryParts();
	
	if ( !event )
		return;
	
	var msg = event.data;
	if ( 'msg' === event.type ) {
		self.emit( msg.type, msg.data );
		return;
	}
	
	self.handleConMsg( event );
}

ns.ServerConn.prototype.storePart = function() {
	const self = this;
}

ns.ServerConn.prototype.tryParts = function() {
	const self = this;
	const whole = self.parts.join( '' );
	let obj = null;
	try {
		obj = JSON.parse( whole );
	} catch( e ) {
		//connLog( 'still nope on parts' );
	}
	
	if ( !obj )
		return null;
	
	self.parts = [];
	self.partTime = 0;
	return obj;
}

ns.ServerConn.prototype.handleConMsg = function( event ) {
	const self = this;
	const handler = self.connMap[ event.type ];
	if ( !handler ) {
		connLog( 'handleConMsg - no handler for', event );
		return;
	}
	
	handler( event.data );
}

ns.ServerConn.prototype.handleAuthenticate = function( success ) {
	const self = this;
	// yep, authenticated. that should do it, lets do nothing.
	if ( true === success )
		return;
	
	// authenticate attempt failed
	if ( false === success ) {
		if ( self.onclose )
			self.onclose( 'ERR_AUTH_DENIED' );
		return;
	}
	
	// success is null, do things
	// we have a session, try restoring
	if ( self.session ) {
		self.sendSession();
		return;
	}
	
	// no auth passed, silly goose
	if ( !self.auth ) {
		self.onclose( 'ERR_AUTH_NULL' );
		return;
	}
	
	// :auth:
	const auth = {
		type : 'authenticate',
		data : self.auth,
	};
	self.sendCon( auth );
}

ns.ServerConn.prototype.handleSession = function( sessionId ) {
	const self = this;
	self.session = sessionId;
	/*
	if ( false === sessionId ) {
		self.tryReconnect( true );
		return;
	}
	*/
}

ns.ServerConn.prototype.handlePing = function( timestamp ) {
	const self = this;
	const pong = {
		type : 'pong',
		data : timestamp,
	};
	self.sendCon( pong );
}

ns.ServerConn.prototype.handlePong = function( e ) {
	const self = this;
}

ns.ServerConn.prototype.sendSession = function() {
	const self = this;
	const sess = {
		type : 'session',
		data : self.session,
	};
	self.sendCon( sess );
	self.session = false;
}

ns.ServerConn.prototype.sendCon = function( event ) {
	const self = this;
	self.sendOnSocket( event );
}

ns.ServerConn.prototype.sendOnSocket = function( event ) {
	const self = this;
	if ( !self.connected || !self.socket )
		return;
	
	let str = null;
	try {
		str = JSON.stringify( event );
		self.socket.send( str );
	} catch( ex ) {
		connLog( 'failed to ssend', {
			ex  : ex,
			str : str,
		}, 3 );
		return;
	}
}

ns.ServerConn.prototype.clearSocket = function() {
	const self = this;
	if ( !self.socket )
		return;
	
	const socket = self.socket;
	delete self.socket;
	try {
		socket.close();
	} catch( e ) {
		connLog( 'tried destroying socket, but it oopsied', e );
	}
	socket.removeAllListeners();
}

module.exports = ns.Presence;