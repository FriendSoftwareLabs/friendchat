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

const log = require( './Log' )( 'Presence' );
const confLog = require( './Log' )( 'Presence.Config' );
const connLog = require( './Log')( 'Presence.ServerConn' );
const uuid = require( './UuidPrefix' )( 'live' );
const events = require( './Emitter' );
const tls = require( 'tls' );
const util = require( 'util' );
const fs = require( 'fs' );

var ns = {};

ns.Presence = function( clientConn, clientId ) {
	if ( !( this instanceof ns.Presence ))
		return new ns.Presence( clientConn, clientId );
	
	var self = this;
	self.type = 'presence';
	self.client = clientConn;
	self.id = clientId;
	
	self.server = null;
	self.conf = null;
	self.rooms = {};
	self.authBundle = null;
	self.identity = null;
	self.account = null;
	
	self.init();
}

ns.Presence.prototype.init = function() {
	var self = this;
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
}

ns.Presence.prototype.initialize = function( initConf, socketId ) {
	var self = this;	
	if ( !self.authBundle )
		self.authBundle = initConf.authBundle;
	
	if ( !self.identity )
		self.identity = initConf.identity;
	
	if ( self.account )
		self.updateClientAccount( socketId );
	
	if ( !self.server || !self.server.connected )
		self.connect();
	
	self.client.emitState();
	self.updateClientRooms( socketId );
}

ns.Presence.prototype.connect = function( conf, socketId ) {
	const self = this;
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
	
	var connOpts = {
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
	self.server.on( 'initialize', init );
	
	function onState( e ) { self.handleConnState( e ); }
	function onClose( e ) { self.handleConnClosed( e ); }
	function connReady( e ) { self.handleConnReady( e ); }
	function init( e ) { self.handleInitialize( e ); }
	function doAccountStuff( e ) { self.handleAccountStage( e ); }
}

ns.Presence.prototype.reconnect = function() {
	const self = this;
	self.clear();
	self.connect();
}

ns.Presence.prototype.disconnect = function() {
	const self = this;
	self.clear();
	self.releaseServerConn();
}

ns.Presence.prototype.clear = function() {
	const self = this;
	const roomIds = Object.keys( self.rooms );
	roomIds.forEach( releaseRoom );
	self.rooms = {};
	
	//
	if ( self.account )
		self.client.release( self.account.clientId );
	
	//
	if ( self.server ) {
		self.server.release( 'join' );
		self.server.release( 'close' );
	}
	
	self.account = null;
	
	const clearEv = { type : 'clear' };
	self.client.send( clearEv );
	
	function releaseRoom( id ) {
		self.client.release( id );
		if ( self.server )
			self.server.release( id );
	}
}

ns.Presence.prototype.releaseServerConn = function() {
	const self = this;
	if ( !self.server )
		return;
	
	self.server.release();
	self.server.close();
	delete self.server;
}

ns.Presence.prototype.closeRooms = function() {
	var self = this;
	log( 'closeRooms - NYI', self.rooms );
}

// server conn things

ns.Presence.prototype.handleConnReady = function() {
	const self = this;
	const init = {
		type : 'initialize',
	};
	self.server.send( init );
}

ns.Presence.prototype.handleConnState = function( state ) {
	var self = this;
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
	self.server.close();
	delete self.server;
}

// account things

ns.Presence.prototype.updateClientAccount = function( socketId ) {
	const self = this;
	const account = {
		type : 'account',
		data : self.account,
	};
	self.client.send( account, socketId );
}

ns.Presence.prototype.handleAccountStage = function( event ) {
	const self = this;
	// general event
	if ( !event && !self.conf.login ) {
		self.createAccount();
		return;
	}
	
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
		
		/*
		else
			self.doLoggedInThings( data );
		*/
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
	var self = this;
	if ( !self.identity ) {
		log( 'createAccount - no identity' );
		return;
	}
	
	const login = self.identity.alias;
	const name = self.identity.name;
	if ( !login || !login.length ) {
		askClientFor( 'login' );
		return;
	}
	
	if ( !name || !name.length ) {
		askClientFor( 'name' );
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
	if ( !self.identity || !self.identity.alias ) {
		log( 'tryLogin - no login', {
			conf : self.conf,
			id   : self.identity,
		}, 3 );
		return;
	}
	
	const login = {
		type : 'login',
		data : self.identity,
	};
	self.server.send( login );
}

ns.Presence.prototype.handleInitialize = function( state ) {
	var self = this;
	if ( self.account ) {
		log( 'handleInitialize - already initialized', state, 3 );
		return;
	}
	
	// account
	self.account = state.account;
	self.client.setState( 'online', Date.now() );
	self.client.on( self.account.clientId, toAccount );
	self.updateClientAccount();
	
	function toAccount( e ) { self.server.send( e ); }
	
	// rooms
	state.rooms
		.forEach( add );
	
	self.server.on( 'join', joined );
	self.server.on( 'close', closed );
	function joined( e ) { self.handleJoinedRoom( e ); }
	function closed( e ) { self.handleRoomClosed( e ); }
	
	function add( room ) {
		self.handleJoinedRoom( room );
	}
}

// room things

ns.Presence.prototype.updateClientRooms = function( clientId ) {
	const self = this;
	const roomIds = Object.keys( self.rooms );
	const roomsList = roomIds
		.map( build );
	
	const rooms = {
		type : 'rooms',
		data : roomsList,
	};
	self.client.send( rooms, clientId );
	
	function build( rid ) {
		const room = self.rooms[ rid ];
		return {
			clientId   : rid,
			persistent : room.persistent,
			name       : room.name,
		};
	}
}

// room things - from client

// room things - from server

ns.Presence.prototype.handleJoinedRoom = function( room ) {
	var self = this;
	if ( null == room )
		return;
	
	const rid = room.clientId;
	if ( self.rooms[ rid ])
		return;
	
	self.rooms[ rid ] = room;
	self.server.on( rid, toClient );
	self.client.on( rid, toServer );
	var joined = {
		type : 'join',
		data : room,
	};
	self.client.send( joined );
	
	function toClient( e ) { self.handleRoomToClientEvent( e, rid ); }
	function toServer( e, cid ) { self.handleRoomToServerEvent( e, cid, rid ); }
}

ns.Presence.prototype.handleRoomToClientEvent = function( event, roomId ) {
	var self = this;
	if ( 'persistent' === event.type ) {
		self.rooms[ roomId ].persistent = event.data.persistent;
		self.rooms[ roomId ].name = event.data.name;
	}
	
	self.client.send( event, null, roomId );
}

ns.Presence.prototype.handleRoomToServerEvent = function( event, clientId, roomId ) {
	var self = this;
	const wrap = {
		type : roomId,
		data : event,
	};
	self.server.send( wrap );
}

ns.Presence.prototype.handleRoomClosed = function( roomId ) {
	const self = this;
	delete self.rooms[ roomId ];
	
	self.server.release( roomId );
	self.client.release( roomId );
	const closed = {
		type : 'close',
		data : roomId,
	};
	self.client.send( closed );
}

// conf updates

ns.Presence.prototype.handleConnUpdate = function( value ) {
	var self = this;
	var conf = {
		host : self.conf.host,
		port : self.conf.port,
	};
	self.connect();
}

ns.Presence.prototype.handleLoginUpdate = function( value ) {
	var self = this;
	log( 'handleLoginUpdate - NYI', value );
	//self.reconnect();
}

//

ns.Presence.prototype.close = function( callback ) {
	var self = this;
	if ( self.conf )
		self.conf.close();
	
	if ( self.server )
		self.server.close();
	
	if ( self.client )
		self.client.close();
	
	delete self.conf;
	delete self.server;
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
	
	var self = this;
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
	var self = this;
	confLog( 'set', conf );
	self.labels.forEach( set );
	function set( label ) {
		self[ label ] = conf[ label ];
	}
}

ns.Config.prototype.get = function() {
	var self = this;
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
	var self = this;
	self.release(); // from Emitter
	self.client.off( 'settings' );
	
	delete self.client;
}

// Private

ns.Config.prototype.init = function() {
	var self = this;
	self.client.on( 'settings', get );
	self.client.on( 'setting', set );
	
	function get( e, socketId ) { self.emitConfig( socketId ); }
	function set( e, socketId ) { self.receiveUpdate( e, socketId ); }
}

ns.Config.prototype.emitConfig = function( socketId ) {
	var self = this;
	var wrap = {
		type : 'settings',
		data : self.get(),
	};
	self.send( wrap, socketId );
}

ns.Config.prototype.receiveUpdate = function( update, socketId ) {
	var self = this;
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
	var self = this;
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
	var self = this;
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
	var self = this;
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
	
	var self = this;
	events.Emitter.call( self );
	
	self.auth = conf.auth;
	self.host = conf.host;
	self.port = conf.port;
	self.onstate = onstate;
	self.onclose = onclose;
	
	self.socket = null;
	self.connected = false;
	self.connectAttempt = 0;
	self.maxConnectAttempts = 1;
	self.parts = [];
	
	self.init();
}

util.inherits( ns.ServerConn, events.Emitter );

// Public

ns.ServerConn.prototype.connect = function( conf ) {
	var self = this;
	if ( conf ) {
		self.host = ( null == conf.host ) ? self.host : conf.host;
		self.port = ( null == conf.port ) ? self.port : conf.port;
	}
	
	if ( self.connectTimeout )
		return;
	
	if ( !self.host || !self.port ) {
		// set disconnected state
		return null;
	}
	
	var opts = {
		host : self.host,
		port : self.port,
	};
	
	self.socket = tls.connect( opts );
	self.socket.setEncoding( 'utf8' );
	
	self.socket.on( 'secureConnect', open );
	self.socket.on( 'close', closed );
	self.socket.on( 'error', error );
	self.socket.on( 'end', ended );
	self.socket.on( 'data', onData );
	
	function open( e ) { self.handleOpen(); }
	function closed( e ) { self.handleClose( e ); }
	function error( e ) { self.handleError( e ); }
	function ended( e ) { self.handleEnded( e ); }
	function onData( e ) { self.handleData( e ); }
}

ns.ServerConn.prototype.send = function( msg ) {
	var self = this;
	var wrap = {
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
	var self = this;
	self.connected = false;
	if ( !self.socket )
		return;
	
	const offline = {
		type : 'offline',
		data : Date.now(),
	};
	self.emitState( offline );
	
	const socket = self.socket;
	delete self.socket;
	try {
		socket.destroy();
	} catch( e ) {
		connLog( 'tried destroying socket, but it oopsied', e );
	}
	socket.removeAllListeners( 'secureConnect' );
	socket.removeAllListeners( 'close' );
	socket.removeAllListeners( 'error' );
	socket.removeAllListeners( 'end' );
	socket.removeAllListeners( 'data' );
	socket.unref();
	
	socket.on( 'error', function(){});
}

ns.ServerConn.prototype.close = function() {
	var self = this;
	if ( self.socket )
		self.disconnect();
	
	delete self.host;
	delete self.port;
	delete self.onstate;
	delete self.onclose;
	
	self.release();
}

// Private

ns.ServerConn.prototype.init = function() {
	var self = this;
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
	var self = this;
	if ( !self.onstate )
		return;
	
	self.onstate( state );
}

ns.ServerConn.prototype.handleOpen = function() {
	var self = this;
	self.connected = true;
	self.connectAttempt = 0;
	if ( self.onopen )
		self.onopen( true );
	
	var status = {
		type : 'open',
		data : Date.now(),
	}
	self.emitState( status );
}

ns.ServerConn.prototype.handleClose = function() {
	var self = this;
	self.connected = false;
	var status = {
		type : 'offline',
		data : Date.now(),
	}
	self.emitState( status );
}

ns.ServerConn.prototype.handleError = function( err ) {
	const self = this;
	connLog( 'handleError', err );
	self.handleDisconnect();
	
}

ns.ServerConn.prototype.handleEnded = function( err ) {
	const self = this;
	self.handleDisconnect( err );
}

ns.ServerConn.prototype.handleDisconnect = function( err ) {
	const self = this;
	self.disconnect();
	const error = {
		type : 'error',
		data : 'ERR_CONN_DISCONNECT',
	};
	self.emitState( error );
	self.tryReconnect();
}

ns.ServerConn.prototype.tryReconnect = function() {
	var self = this;
	if ( self.connectTimeout ||
		( !self.session &&  !self.auth )
	) {
		return;
	}
	
	if ( self.connectAttempt >= self.maxConnectAttempts ) {
		self.onclose( 'ERR_CONN_REFUSED' );
		return;
	}
	
	self.connectAttempt++;
	const reconn = {
		type : 'connecting',
		data : Date.now(),
	};
	self.emitState( reconn );
	self.connectTimeout = setTimeout( connect, 1000 * 10 );
	function connect() {
		self.connectTimeout = null;
		self.connect();
	}
}

ns.ServerConn.prototype.handleData = function( str ) {
	var self = this;
	var event = null;
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
		connLog( 'still nope on parts' );
	}
	
	if ( !obj )
		return null;
	
	self.parts = [];
	self.partTime = 0;
	return obj;
}

ns.ServerConn.prototype.handleConMsg = function( event ) {
	var self = this;
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
	if ( false === sessionId ) {
		self.disconnect();
		if ( self.onclose )
			self.onclose( 'ERR_SESSION_INVALID' );
		
		return;
	}
	
	if ( !self.session )
		self.disconnect();
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
	var self = this;
	self.sendOnSocket( event );
}

ns.ServerConn.prototype.sendOnSocket = function( event ) {
	var self = this;
	if ( !self.connected || !self.socket )
		return;
	
	var str = null;
	try {
		str = JSON.stringify( event );
	} catch( e ) {
		connLog( 'failed to string', event );
		return;
	}
	
	self.socket.write( str );
}

module.exports = ns.Presence;