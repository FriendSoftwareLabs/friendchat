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

var net = require( 'net' );
var tls = require( 'tls' );
var util = require( 'util' );
var events = require( './Emitter' );

var log = require( './Log' )( 'IRC' );
var clog = require( './Log' )( 'IRC.Client' );
var tlog = require( './Log' )( 'IRC.Channel' );
var plog = require( './Log' )( 'IRC.Private' );
var uuid = require( './UuidPrefix' )( 'irc' );

var ns = {};

// IRC module
ns.IRC = function( conn ) {
	if ( !( this instanceof ns.IRC ))
		return new ns.IRC( conn );
	
	var self = this;
	self.type = 'irc';
	self.conn = conn;
	
	self.ircClient = null;
	self.init();
}

// Public

// static
ns.IRC.prototype.getSetup = function( username ) {
	const setup = {
		settings : {
			nick : username,
		},
	};
	return setup;
}

ns.IRC.prototype.connect = function( conf ) {
	var self = this;
	if ( conf && conf.mod )
		conf = conf.mod;
	
	self.ircConf = conf || self.ircConf;
	
	if ( self.ircClient  ) {
		self.reconnect();
		return;
	}
	
	self.ircClient = new ns.IrcClient( self.conn, self.ircConf );
}

ns.IRC.prototype.kill = function( doneBack ) {
	var self = this;
	if ( self.ircClient )
		self.ircClient.close();
	
	self.conn.release();
	delete self.conn;
	delete self.ircClient;
	
	if ( doneBack )
		doneBack( true );
}

// Pirvate

ns.IRC.prototype.init = function() {
	var self = this;
	
	self.conn.on( 'connect'    , connect );
	self.conn.on( 'initclient' , initClient );
	self.conn.on( 'reconnect'  , reconnect );
	self.conn.on( 'disconnect' , disconnect );
	self.conn.on( 'stop'       , stop );
	self.conn.on( 'kill'       , kill );
	
	function connect(    e, cid ) {          self.connect( e, cid ); }
	function initClient( e, cid ) { self.initializeClient( e, cid ); }
	function reconnect(  e, cid ) {        self.reconnect( e, cid ); }
	function disconnect( e, cid ) {       self.disconnect( e, cid ); }
	function stop(       e, cid ) { log( 'stop event', self.ircConf ); }
	function kill(       e, cid ) {             self.kill( e, cid ); }
}



ns.IRC.prototype.reconnect = function( msg ) {
	var self = this;
	if ( !self.ircClient ) {
		self.connect();
		return;
	}
	
	self.ircClient.stop();
	var moduleSettings = self.conn.getSettings( settingsBack );
	function settingsBack( settings ) {
		self.ircClient.start( settings );
	}
}

ns.IRC.prototype.disconnect = function( msg ) {
	var self = this;
	if ( !self.ircClient )
		return;
	
	self.ircClient.stop();
}

ns.IRC.prototype.initializeClient = function( e, socketId ) {
	var self = this;
	self.conn.emitState();
	var state = self.conn.getState();
	if ( state.type !== 'online' ) {
		return;
	}
	
	var clientState = self.ircClient.getClientState();
	var initStateEvent = {
		type : 'initstate',
		data : clientState,
	};
	
	self.conn.send( initStateEvent, socketId );
}

ns.IRC.prototype.ircMessage = function( msg ) {
	var self = this;
	self.ircClient.message( msg );
}

// IRCCLIENT
// maintains state for multiclient purposes, channel logs
ns.IrcClient = function( client, conf ) {
	if ( !( this instanceof ns.IrcClient ))
		return new ns.IrcClient( client, conf );
	
	var self = this;
	self.clientId = conf.clientId;
	self.client = client;
	self.conf = conf;
	
	self.idToTargetMap = {};
	self.targets = {};
	self.targetKeys = [];
	
	self.consoleLog = [];
	self.parser = null;
	
	self.sendQueue = [];
	self.currentNick = null;
	self.nickRetries = 0;
	self.nickRetryMax = 5;
	self.nickChangeTimeout = null;
	self.idleSince = null;
	self.autoAwayTimer = null;
	self.awayTime = 0;
	self.isAway = false;
	
	self.stopped = true;
	
	self.init();
}

ns.IrcClient.prototype.init = function() {
	var self = this;
	self.receiveParts = [];
	self.rxEOM = /\r\n$/i;
	
	self.setSettings();
	self.parser = new ns.Parse();
	self.cmd = new ns.CmdChecker( self.targets );
	self.setMessageMap(); // things from the client
	self.setCommandMap(); // things from the server
	
	var logId   = self.client.on( 'log'     , getLog        );
	var msgId   = self.client.on( 'message' , handleMessage );
	var cmdId   = self.client.on( 'command' , handleCommand );
	var rawId   = self.client.on( 'raw'     , handleRaw     );
	var privId  = self.client.on( 'private' , handlePrivate );
	var settsId = self.client.on( 'settings', getSettings   );
	var settId  = self.client.on( 'setting' , updateSetting );
	self.clientListenerId = [];
	self.clientListenerId.push( logId );
	self.clientListenerId.push( msgId );
	self.clientListenerId.push( cmdId );
	self.clientListenerId.push( rawId );
	self.clientListenerId.push( settsId );
	self.clientListenerId.push( settId );
	
	function getLog(        e, cid ) { self.getConsoleLog(    e, cid  ); }
	function handleMessage( e, cid ) { self.handleMessage(    e, cid  ); }
	function handleCommand( e, cid ) { self.parseCommand(     e, cid  ); }
	function handleRaw(     e, cid ) { self.handleRawCommand( e, cid  ); }
	function handlePrivate( e, cid ) { self.handlePrivate(    e, cid  ); }
	function getSettings(   e, cid ) { self.getSettings(      e, cid  ); }
	function updateSetting( e, cid ) { self.updateSetting(    e, cid  ); }
	
	self.connect();
}

ns.IrcClient.prototype.start = function( conf ) {
	var self = this;
	self.clearState();
	self.setSettings( conf );
	self.connect();
}

ns.IrcClient.prototype.connect = function() {
	var self = this;
	if ( !hasRequiredInfo()) {
		return;
	}
	
	self.clearSendQueue();
	self.stopped = false;
	var connecting = {
		message : self.conf.host,
		time : Date.now(),
	};
	self.connectionState( 'connecting', connecting );
	var useTLS = !!self.conf.settings.connect.tls;
	var conf = {
		host : self.conf.host,
		port : useTLS ? 6697 : 6667,
	};
	if ( self.conf.port )
		conf.port = self.conf.port;
	
	try {
		if ( useTLS )
			self.conn = tls.connect( conf, connectBack );
		else
			self.conn = net.connect( conf, connectBack );
		
	} catch ( ex ) {
		var error = {
			type : 'connex',
			data : {
				message : 'connection exception: ' + ex,
				time : Date.now(),
			},
		};
		self.consoleError( error );
		self.connectionState( 'error', error );
		return;
	}
	
	self.conn.setEncoding( 'utf8' );
	self.conn.on( 'data', receive );
	self.conn.on( 'end', connEnd );
	self.conn.on( 'error', connErr );
	
	function receive( data ) { self.receive( data ); }
	function connEnd( e ) { self.connEnd( e ); }
	function connErr( e ) { self.connError( e ); }
	
	function connectBack( e ) {
		if ( self.conf.settings.connect.sasl )
			self.SASLAuth();
		else
			self.register();
	}
	
	function hasRequiredInfo() {
		if ( !self.conf.host || !self.conf.host.length ) {
			emitHostNotSetErr();
			return false;
		}
		
		if ( !self.conf.login && !self.conf.settings.nick ) {
			emitNickNotSetErr();
			return false;
		}
		
		return true;
		
		function emitHostNotSetErr() {
			var err = {
				type : 'hostnotset',
				data : {
					message : 'Host is not set',
					time : Date.now(),
				},
			};
			send( err );
		}
		
		function emitNickNotSetErr() {
			var err = {
				type : 'nicknotset',
				data : {
					time : Date.now(),
					message : 'No login / nick set',
				},
			};
			send( err );
		}
		
		function send( err ) {
			self.consoleError( err );
			self.setConnectionError( err );
		}
	}
}

ns.IrcClient.prototype.connEnd = function( e ) {
	var self = this;
	self.clearState();
	self.connectionState( 'offline' );
}

ns.IrcClient.prototype.connError = function( e ) {
	var self = this;
	clog( 'connError', e );
	var err = {
		type : 'connerror',
		data : {
			time : Date.now(),
			message : e,
		},
	};
	self.setConnectionError( err );
	self.consoleError( err );
}

ns.IrcClient.prototype.clearState = function() {
	var self = this;
	self.clearTargets();
}

ns.IrcClient.prototype.connectionState = function( state, data ) {
	var self = this;
	if ( !state )
		return self.client.getState();
	
	self.client.setState( state, data );
	if ( 'offline' !== state && 'error' !== state )
		return;
	
	self.clearTargets();
	var clear = {
		type : 'clear',
	};
	self.toClient( clear );
}

ns.IrcClient.prototype.setConnectionError = function( data ) {
	var self = this;
	self.connectionState( 'error', data );
}

ns.IrcClient.prototype.send = function( string, isMessage ) {
	var self = this;
	if ( isMessage ) {
		if ( self.isAway )
			self.setNotAway();
		else
			self.resetIdle();
	}
	
	if ( !string || !string.length ) {
		clog( 'send - invalid string', string );
		return;
	}
	
	string = string + '\r\n';
	try {
		self.conn.write( string );
	} catch ( ex ) {
		clog( 'send - conn.write exception', ex );
	}
}

ns.IrcClient.prototype.setNotAway = function() {
	var self = this;
	self.isAway = false;
	self.resetIdle();
	self.setNick();
}

ns.IrcClient.prototype.doAutoAway = function() {
	var self = this;
	if ( self.isAway )
		return;
	
	var now = Date.now();
	var idleTime = now - self.idleSince;
	var idleMinutes = ( idleTime / 1000 / 60 );
	var away = 'AWAY :Auto-away after ' + self.conf.settings.autoAway + ' minutes';
	self.send( away );
}

ns.IrcClient.prototype.setAway = function() {
	var self = this;
	if ( self.isAway )
		return;
	
	self.isAway = true;
	self.setNick();
}

ns.IrcClient.prototype.getIdle = function() {
	var self = this;
	
	var now = Date.now();
	var idleTime = now - self.idleSince;
	return idleTime;
}

ns.IrcClient.prototype.resetIdle = function() {
	var self = this;
	var autoAwayTime = self.conf.settings.autoAway;
	if ( self.autoAwayTimer ) {
		clearTimeout( self.autoAwayTimer );
		self.autoAwayTimer = null;
	}
	
	self.idleSince = Date.now();
	
	if ( !autoAwayTime || !self.conf.settings.awayNick )
		return;
	
	var autoAwayTimeMs = 1000 * 60 * autoAwayTime;
	self.autoAwayTimer = setTimeout( setAway, autoAwayTimeMs );
	function setAway() {
		self.autoAwayTimer = null;
		self.doAutoAway();
	}
}

ns.IrcClient.prototype.queueSend = function( msg ) {
	var self = this;
	self.sendQueue.push( msg );
}

ns.IrcClient.prototype.executeSendQueue = function() {
	var self = this;
	if ( !self.conn )
		return;
	
	self.sendQueue.forEach( send );
	self.sendQueue = [];
	function send( msg ) {
		self.send( msg );
	}
}

ns.IrcClient.prototype.clearSendQueue = function() {
	var self = this;
	self.sendQueue = [];
}

ns.IrcClient.prototype.receive = function( data ) {
	var self = this;
	self.receiveParts.push( data );
	var EOM = data.match( self.rxEOM );
	if ( !EOM ) {
		return;
	}
	
	var message = self.receiveParts.join( '' );
	self.receiveParts = [];
	self.parseServerMessage( message );
}

ns.IrcClient.prototype.parseServerMessage = function( data ) {
	var self = this;
	var messages = data.split( '\r\n' );
	messages.forEach( parse );
	function parse( string ) {
		if ( !string )
			return;
		
		var msgTokens = self.parser.process( string );
		if ( !msgTokens ) {
			clog( 'could not parse :', string );
			clog( 'data : ', data );
			return;
		}
		
		self.handleServerMessage( msgTokens );
	}
}

ns.IrcClient.prototype.queueServerMessage = function() {
	var self = this;
}

ns.IrcClient.prototype.getClientState = function() {
	var self = this;
	var state = {
		connection : self.client.state,
		identity : {
			name : self.currentNick,
		},
	};
	
	state.targets = self.targetKeys.map( addTargetState );
	return state;
	
	function addTargetState( key ) {
		var target = self.targets[ key ];
		var targetState = target.getState();
		return targetState;
	}
}

ns.IrcClient.prototype.getSettings = function() {
	var self = this;
	var msg = {
		type : 'settings',
		data : self.conf,
	};
	self.toClient( msg );
}

ns.IrcClient.prototype.setSettings = function( conf ) {
	var self = this;
	if ( !conf && !self.conf )
		throw new Error( 'no conf' );
	
	conf = conf || self.conf;
	var settings = self.conf.settings || {};
	var connect = settings.connect || {};
	
	self.conf = {
		host        : conf.host,
		port        : conf.port || 0,
		displayName : conf.displayName,
		login       : conf.login || '',
		password    : conf.password || '',
		settings    : {
			nick      : settings.nick || '',
			awayNick  : settings.awayNick || '',
			autoAway  : settings.autoAway || 0,
			autoBack  : !!settings.autoBack,
			msgAlert  : settings.msgAlert || false,
			user      : settings.user || '',
			realName  : settings.realName || '',
			mode      : settings.mode || '',
			join      : settings.join || [],
			ircTheme  : settings.ircTheme || '',
			perform   : settings.perform || '',
			connect   : {
				tls         : !!connect.tls,
				sasl        : !!connect.sasl,
				autoconnect : !!connect.autoconnect,
				doPerform   : !!connect.doPerform,
				autojoin    : !!connect.autojoin,
				autoshow    : !!connect.autoshow,
			},
		},
	};
}

ns.IrcClient.prototype.updateSetting = function( data ) {
	var self = this;
	var key = data.setting;
	if ( 'undefined' === typeof( data.value ))
		data.value = '';
	
	if ( !key )
		throw new Error( 'updateSetting - missing data' );
	
	var fnName = 'update' + key[ 0 ].toUpperCase() + key.slice( 1 );
	if ( !self[ fnName ]) {
		clog( 'updateSetting - fn not found', { fn : fnName, d : data });
		return null;
	}
	
	self[ fnName ]( data.value );
}

ns.IrcClient.prototype.updateHost = function( value ) {
	var self = this;
	value = value || '';
	self.doPersist( 'host', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.reconnect();
	}
}

ns.IrcClient.prototype.updatePort = function( value ) {
	var self = this;
	value = value || 0;
	value = parseInt( value, 10 );
	self.doPersist( 'port', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.reconnect();
	}
}

ns.IrcClient.prototype.updateDisplayName = function( value ) {
	var self = this;
	value = value || 'irc'
	self.doPersist( 'displayName', value, persistBack );
	function persistBack( update ) {
		if ( update.success)
			return;
		
		self.conf.displayName = value;
	}
}

ns.IrcClient.prototype.updateLogin = function( value ) {
	var self = this;
	value = value || '';
	self.doPersist( 'login', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.conf.login = update.value;
		const state = self.connectionState();
		if ( state.type !== 'online' )
			self.reconnect();
	}
}

ns.IrcClient.prototype.updatePassword = function( value ) {
	var self = this;
	value = value || '';
	self.doPersist( 'password', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.conf.password = update.value;
	}
}

ns.IrcClient.prototype.updateConnect = function( value ) {
	var self = this;
	value = value || {};
	self.doPersist( 'connect', value, persistBack );
	function persistBack( update ) {
		if ( update.success ) {
			var doReconnect = (
					( self.conf.settings.connect.tls != update.value.tls ) ||
					( self.conf.settings.connect.sasl != update.value.sasl )
				);
		}
		
		self.conf.settings.connect = update.value;
		if ( doReconnect )
			self.reconnect();
	}
}

ns.IrcClient.prototype.updateNick = function( value ) {
	var self = this;
	self.doPersist( 'nick', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.conf.settings.nick = update.value;
		var state = self.connectionState();
		if ( state.type !== 'online' )
			self.reconnect();
		else
			self.setNick();
	}
}

ns.IrcClient.prototype.updateAwayNick = function( value ) {
	var self = this;
	self.doPersist( 'awayNick', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.conf.settings.awayNick = update.value;
		self.resetIdle();
		self.setNick();
	}
}

ns.IrcClient.prototype.updateAutoAway = function( value ) {
	var self = this;
	var time = parseInt( value, 10 );
	if ( !time )
		time = 0;
	
	self.doPersist( 'autoAway', time, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.conf.settings.autoAway = update.value;
	}
}

ns.IrcClient.prototype.updateAutoBack = function( value ) {
	var self = this;
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.conf.settings.autoBack = update.value;
	}
}

ns.IrcClient.prototype.updateMsgAlert = function( value ) {
	var self = this;
	self.doPersist( 'msgAlert', value, persistBack );
	function persistBack( update ) {
		if ( !update.succes )
			return;
		
		self.conf.settings.msgAlert = update.value;
	}
}

ns.IrcClient.prototype.updatePerform = function( value ) {
	var self = this;
	self.doPersist( 'perform', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		self.conf.settings.perform = update.value;
	}
}

ns.IrcClient.prototype.updateJoin = function( value ) {
	var self = this;
	self.doPersist( 'join', value, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		var channels = update.value;
		self.conf.settings.join = channels;
		self.doJoin( update.value );
	}
}

ns.IrcClient.prototype.doJoin = function( channels ) {
	var self = this;
	channels.forEach( joinIfNew );
	checkHasLeft( channels );
	function joinIfNew( channelName ) {
		var exists = self.targets[ channelName ];
		if ( exists )
			return;
		
		var msg = 'JOIN ' + channelName;
		self.send( msg );
	}
	
	function checkHasLeft( channels ) {
		var currentChannels = self.getCurrentChannels();
		var leftChannels = currentChannels.filter( isNotInUpdate );
		leftChannels.forEach( leave );
		
		function isNotInUpdate( name ) { return !!( channels.indexOf( name ) === -1 ); }
		function leave( name ) {
			var msg = 'PART ' + name;
			self.send( msg );
		}
	}
}

ns.IrcClient.prototype.updateIrcTheme = function( filepath ) {
	var self = this;
	self.doPersist( 'ircTheme', filepath, persistBack );
	function persistBack( update ) {
		if ( !update.success )
			return;
		
		var filepath = update.value;
		self.conf.settings.ircTheme = filepath;
	}
}

ns.IrcClient.prototype.doPersist = function( setting, value, callback ) {
	var self = this;
	var update = {
		setting : setting,
		value : value,
		success : false,
	};
	self.client.persistSetting( update, updateBack );
	
	function updateBack( res ) {
		if ( !res )
			res = { success : false };
		
		if ( !res.success )
			clog( 'doPersist - failed to update DB?????', res );
		
		self.updateClientSetting( res );
		callback( res );
	}
}

ns.IrcClient.prototype.reconnect = function( data ) {
	var self = this;
	if ( self.stopped )
		return;
	
	self.toSelf({
		type : 'reconnect',
	});
}

ns.IrcClient.prototype.updateClientSetting = function( update ) {
	var self = this;
	var wrap = {
		type : 'setting',
		data : {
			type : update.setting,
			data : update,
		},
	};
	self.toClient( wrap );
}

ns.IrcClient.prototype.SASLAuth = function() {
	var self = this;
	self.send( 'CAP REQ :sasl' );
	self.send( 'NICK ' + self.conf.settings.nick );
	self.send( 'USER ' + self.conf.settings.user + ' dont bother' + ' :' + self.conf.settings.realName );
}

ns.IrcClient.prototype.register = function() {
	var self = this;
	// PASS <password>
	let passMsg = null;
	if ( self.conf.password && self.conf.password.length )
		passMsg = 'PASS ' + self.conf.password;
	
	// NICK <nickname>
	let nick = self.conf.login;
	if ( !nick || !nick.length )
		nick = self.conf.settings.nick;
	
	const nickMsg = 'NICK ' + nick;
	
	// USER <username> <hostname> <servername> :<realname>
	const userMsg = 'USER ' + self.conf.settings.user + ' dont bother' + ' :' + self.conf.settings.realName;
	
	if ( passMsg )
		self.send( passMsg );
	
	self.send( nickMsg );
	self.send( userMsg );
}

ns.IrcClient.prototype.onRegistered = function() {
	var self = this;
	self.connectionState( 'online' );
	self.resetIdle();
	doPerform();
	doAutojoin();
	
	function doPerform() {
		self.sendPerform;
	}
	
	function doAutojoin() {
		var autojoin = self.conf.settings.connect.autojoin;
		if ( !autojoin )
			return;
		
		self.autojoinChannels();
	}
}

ns.IrcClient.prototype.sendPerform = function() {
	var self = this;
	var perform = self.conf.settings.connect.doPerform;
	if ( !perform )
		return;
	
	var msg = self.conf.settings.perform;
	self.handleMessage( msg );
}

ns.IrcClient.prototype.autojoinChannels = function() {
	var self = this;
	if ( !self.conf.settings.join )
		return;
	
	var channels = self.conf.settings.join.join( ',' );
	if ( !channels)
		return;
	
	var msg = 'JOIN ' + channels;
	self.send( msg );
}

ns.IrcClient.prototype.handleServerMessage = function( tokenized ) {
	var self = this;
	var handler = self.commandMap[ tokenized.command ];
	if ( !handler ) {
		self.cmdUnhandled( tokenized );
		return;
	}
	
	//log( 'server message', tokenized, 4 );
	handler( tokenized );
}

ns.IrcClient.prototype.setNick = function() {
	var self = this;
	if ( !self.currentNick ) {
		clog( 'no current nick, abort' );
		return;
	}
	
	var nick = self.conf.settings.nick;
	var awayNick = self.conf.settings.awayNick;
	
	if ( self.isAway ) {
		nick = awayNick.length ? awayNick : nick;
	}
	
	if ( !nick || !nick.length ) {
		clog( 'setNick - no nick?', nick );
		return;
	}
	
	if ( nick === self.currentNick ) {
		return;
	}
	
	self.sendNick( nick );
}

ns.IrcClient.prototype.sendNick = function( nick ) {
	var self = this;
	var nickMsg = 'NICK ' + nick;
	self.send( nickMsg );
}

ns.IrcClient.prototype.setCommandMap = function() {
	var self = this;
	self.commandMap = {
		'ERROR'        : error,
		'CAP'          : cap,
		'AUTHENTICATE' : authenticate,
		'JOIN'         : join,
		'KICK'         : kick,
		'MODE'         : mode,
		'NOTICE'       : notice,
		'NICK'         : nick,
		'PART'         : part,
		'PING'         : ping,
		'PRIVMSG'      : privmsg,
		'TOPIC'        : topic,
		'QUIT'         : quit,
		'001'          : registered,
		'002'          : ircHost,
		'003'          : ircInfo,
		'004'          : ircInfo,
		'005'          : ircInfo,
		'305'          : notAway,
		'306'          : away,
		'331'          : rpl_notopic,
		'332'          : rpl_topic,
		'333'          : rpl_topicSetBy,
		'353'          : nicklist,
		'366'          : nicklistEnd,
		'375'          : motd,
		'372'          : motd,
		'376'          : motd,
		'431'          : noNickGiven,
		'433'          : nickInUse,
		'438'          : nickChangeTooFast,
		'900'          : saslLoggedIn,
		'901'          : saslCatch,
		'902'          : saslCatch,
		'903'          : saslCatch,
		'904'          : saslFail,
		'905'          : saslCatch,
		'906'          : saslCatch,
		'907'          : saslCatch,
		'908'          : saslCatch,
	};
	
	function away(              e ) { self.cmdAway(              e ); }
	function error(             e ) { self.cmdERROR(             e ); }
	function cap(               e ) { self.cmdCap(               e ); }
	function authenticate(      e ) { self.cmdAuthenticate(      e ); }
	function ircHost(           e ) { self.cmdHost(              e ); }
	function ircInfo(           e ) { self.cmdInfo(              e ); }
	function join(              e ) { self.cmdJoin(              e ); }
	function kick(              e ) { self.cmdKick(              e ); }
	function mode(              e ) { self.cmdMode(              e ); }
	function motd(              e ) { self.cmdMotd(              e ); }
	function nick(              e ) { self.cmdNick(              e ); }
	function nicklist(          e ) { self.cmdNickList(          e ); }
	function nicklistEnd(       e ) { self.cmdNickListEnd(       e ); }
	function nickInUse(         e ) { self.cmdNickInUse(         e ); }
	function nickChangeTooFast( e ) { self.cmdNickChangeTooFast( e ); }
	function noNickGiven(       e ) { self.cmdNoNickGiven(       e ); }
	function notAway(           e ) { self.cmdNotAway(           e ); }
	function notice(            e ) { self.cmdNotice(            e ); }
	function part(              e ) { self.cmdPart(              e ); }
	function ping(              e ) { self.cmdPing(              e ); }
	function privmsg(           e ) { self.cmdPrivMsg(           e ); }
	function quit(              e ) { self.cmdQuit(              e ); }
	function registered(        e ) { self.cmdRegistered(        e ); }
	function rpl_notopic(       e ) { self.rpl_notopic(          e ); }
	function rpl_topic(         e ) { self.rpl_topic(            e ); }
	function rpl_topicSetBy(    e ) { self.rpl_topicSetBy(       e ); }
	function topic(             e ) { self.cmdTopic(             e ); }
	function saslLoggedIn(      e ) { self.cmdSaslLoggedIn(      e ); }
	function saslFail(          e ) { self.cmdSaslFail(          e ); }
	function saslCatch(         e ) { self.cmdSaslCatch(         e ); }
}

ns.IrcClient.prototype.cmdUnhandled = function( tokens ) {
	var self = this;
	//clog( 'unhandled command', tokens, 3 );
	var message = tokens.command + ' - ' + tokens.params.list.join( ' ' );
	var unMsg = {
		message : message,
		time : tokens.time,
	};
	self.consoleMessage( unMsg );
}

ns.IrcClient.prototype.cmdERROR = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var reason = msg.data.target[ 0 ].data;
	clog( 'cmdERROR', tokens );
	if ( reason === 'Closing' ) {
		
	}
	var error = {
		type : 'connerror',
		data : {
			time : Date.now(),
			message : 'cmdERROR: ' + JSON.stringify( msg ),
		},
	};
	self.setConnectionError( error );
	self.consoleError( error );
}

ns.IrcClient.prototype.cmdCap = function( tokens ) {
	var self = this;
	var accept = tokens.params.list;
	if ( accept[ 0 ] === 'ACK' )
		continueSASL();
	else
		abortSASL();
	
	function continueSASL() {
		self.send( 'AUTHENTICATE PLAIN' );
	}
	
	function abortSASL() {
		self.connError( 'SASL failed - try something else..' );
	}
}

ns.IrcClient.prototype.cmdAuthenticate = function( tokens ) {
	var self = this;
	var passString = self.conf.login + '\x00' + self.conf.login + '\x00' + self.conf.password; // WTF
	var b64Pass = utf8ToBase64( passString );
	self.send( 'AUTHENTICATE ' + b64Pass );
	
	function utf8ToBase64( str ) {
		var buf = new Buffer( str, 'utf8' );
		return buf.toString( 'base64' );
	}
}

ns.IrcClient.prototype.cmdSaslLoggedIn = function( tokens ) {
	var self = this;
	self.send( 'CAP END' );
}

ns.IrcClient.prototype.cmdSaslFail = function( tokens ) {
	var self = this;
	clog( 'cmdSaslFail', tokens, 3 );
}

ns.IrcClient.prototype.cmdSaslCatch = function( tokens ) {
	var self = this;
	//clog( 'cmdSaslCatch', tokens, 3 );
}

ns.IrcClient.prototype.cmdNoNickGiven = function( tokens ) {
	var self =this;
	var msg = self.formatMessage( tokens );
	msg.type = 'NONICK';
	self.consoleError( msg );
	self.toClient( msg );
}

ns.IrcClient.prototype.cmdNickInUse = function( tokens ) {
	var self = this;
	self.connectionState( 'online' );
	if (( self.nickRetries >= self.nickRetryMax ) && self.nickRetryMax ) {
		abort();
		return;
	}
	
	var tried = tokens.params.list[ 0 ];
	var tryAgain = tried + '_';
	self.nickRetries++;
	self.sendNick( tryAgain );
	
	function abort() {
		self.consoleNotification( 'Nick in use, retried too many times: ' + tried );
	}
}

ns.IrcClient.prototype.cmdNickChangeTooFast = function( tokens ) {
	var self = this;
	var tried = tokens.params.list[ 1 ];
	var message = tokens.params.list[ 2 ];
	var wait = getNum( message );
	wait = wait || 30 // default 30 sec wait
	wait = wait + 10 // adding 10 sec, because servers cant into time
	wait = wait * 1000 // millisconds
	
	if ( self.nickChangeTimeout )
		clearTimeout( self.nickChangeTimeout );
	
	self.nickChangeTimeout = setTimeout( retryNickChange, wait );
	self.consoleNotification( 'Nick changed too fast, waiting ' + ( wait / 1000) + ' seconds.' );
	
	function retryNickChange() {
		self.nickChangeTimeout = null;
		self.sendNick( tried );
	}
	
	function getNum( string ) {
		if ( !string || !string.length )
			return;
		
		var parts = string.split( ' ' );
		var nums = parts.map( parse );
		var reals = nums.filter( real );
		if ( !reals.length )
			return 0;
		
		return reals.pop();
		
		function parse( part ) { return parseInt( part, 10 ); }
		function real( num ) { return !!num; }
	}
}

ns.IrcClient.prototype.cmdRegistered = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var nick = tokens.params.target[ 0 ].data;
	self.currentNick = nick;
	self.identityChange( nick );
	self.onRegistered();
}

ns.IrcClient.prototype.cmdNotice = function( tokens ) {
	var self = this;
	var notice = {
		message : tokens.params.list.join( ' ' ),
		time : tokens.time,
	};
	self.checkNotice( notice );
	self.consoleMessage( notice );
}

ns.IrcClient.prototype.cmdHost = function( tokens ) {
	var self = this;
	var hostMsg = {
		message : tokens.params.list.join(),
		time : tokens.time,
	};
	self.consoleMessage( hostMsg );
}

ns.IrcClient.prototype.cmdInfo = function( tokens ) {
	var self = this;
	var infoMsg = {
		message : tokens.params.list.join(),
		time : tokens.time,
	};
	self.consoleMessage( infoMsg );
}

ns.IrcClient.prototype.cmdMotd = function( tokens ) {
	var self = this;
	var motdMsg = {
		message : tokens.params.list.join(),
		time : tokens.time,
	};
	self.consoleMessage( motdMsg );
}

ns.IrcClient.prototype.cmdJoin = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var target = msg.data.target[ 0 ].data;
	var who = msg.data.source;
	var time = msg.data.time;
	
	if ( msg.data.target.length > 1 )
		clog( 'cmdJoin - more than one target???', msg );
	
	if ( who === self.currentNick )
		selfJoin();
	else
		userJoin();
	
	function selfJoin() {
		var channels = msg.data.target;
		channels.forEach( join );
		function join( target ) {
			self.joinChannel({
				target : target.data,
				time : time,
			});
		}
	}
	
	function userJoin() {
		var channel = self.targets[ target ];
		if ( !channel || !channel.join ) {
			clog( 'cmdJoin.userJoin - no channel for', { target : target, targets : self.targets }, 3 );
			return;
		}
		
		channel.join({
			who : who,
			time : time,
		});
	}
}

ns.IrcClient.prototype.cmdKick = function( tokens ) {
	const self = this;
	const msg = self.formatMessage( tokens );
	const data = msg.data;
	const channelName = data.target[ 0 ].data;
	
	const channel = self.targets[ channelName ];
	if ( !channel )
		return;
	
	channel.handleKick( data );
}

ns.IrcClient.prototype.cmdMode = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var target = msg.data.target[ 0 ];
	if ( target.type == 'channel' )
		setChannelMode( target.data, msg.data );
	else
		setNickMode( msg.data );
	
	function setChannelMode( chanName, data ) {
		var channel = self.targets[ chanName ];
		if ( !channel ) {
			clog( 'cmdMode - no channel for ', { c : self.targets, m :msg }, 2 );
			return;
		}
		
		channel.setMode( data );
	}
	
	function setNickMode( data ) {
		var modeMsg = {
			message : '>> mode ' + data.params[ 0 ] + ' on ' + target.data,
			time : data.time,
		}
		self.consoleMessage( modeMsg );
	}
}

ns.IrcClient.prototype.cmdNick = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var oldNick = msg.data.source;
	var newNick = msg.data.target[ 0 ].data;
	var time = msg.data.time;
	var update = {
		current : oldNick,
		update : newNick,
		time : time,
	};
	
	if ( isSelf( oldNick )) {
		self.currentNick = newNick;
		updateSettings( newNick );
		self.identityChange( newNick );
		self.callOnChannels( 'nick', update );
		return;
	}
	
	self.nickChange( update );
	
	function isSelf( nick ) {
		return nick === self.currentNick;
	}
	
	function updateSettings( newNick ) {
		if ( !self.isAway )
			self.updateNick( newNick );
		
		if ( self.isAway )
			self.updateAwayNick( newNick );
	}
}

ns.IrcClient.prototype.cmdNickList = function( tokens ) {
	var self = this;
	var params = tokens.params.list;
	params.shift(); // getting rid of '=' / '@' - might be important?
	var channelName = params.shift();
	var channel = self.targets[ channelName ];
	if ( !channel ) {
		clog( 'cmdNickList - no channel found', tokens );
		return;
	}
	
	var nicks = params[ 0 ].split( ' ' );
	nicks = nicks.filter( notEmpty );
	channel.nickList( nicks );
	
	function notEmpty( nick ) {
		if ( !nick || !nick.length )
			return false;
		
		return true;
	}
}

ns.IrcClient.prototype.cmdNickListEnd = function( tokens ) {
	var self = this;
}

ns.IrcClient.prototype.cmdAway = function( tokens ) {
	var self = this;
	self.setAway();
}

ns.IrcClient.prototype.cmdNotAway = function( tokens ) {
	var self = this;
	self.setNotAway();
}

ns.IrcClient.prototype.cmdPing = function( tokens ) {
	var self = this;
	// PONG <server1> [ <server2> ]
	var msg = self.formatMessage( tokens );
	var pong = 'PONG ' + msg.data.params.join( ' ' );
	self.send( pong );
	msg.data.params.push( 'PING? PONG!' );
	var wrap = self.messageWrap({
		message : 'PING? PONG!',
		time : msg.data.time,
	});
	self.emitToConsole( wrap );
}

ns.IrcClient.prototype.rpl_notopic = function( tokens ) {
	var self = this;
}

ns.IrcClient.prototype.rpl_topic = function( tokens ) {
	var self = this;
	var data = tokens.params;
	var target = data.list.shift();
	var topicEvent = {
		from : null,
		topic : data.list.shift(),
		time : null,
	};
	var channel = self.getTarget( target );
	if ( !channel ) {
		clog( 'rpl_topic - target is not a channel', target );
		return;
	}
	
	channel.rplTopic( topicEvent );
}

ns.IrcClient.prototype.rpl_topicSetBy = function( tokens ) {
	var self = this;
	var data = tokens.params;
	var target = data.list.shift();
	var topicEvent = {
		from : data.list.shift(),
		topic : null,
		time : parseInt( data.list.shift() + '000' ),
	};
	var channel = self.getTarget( target );
	if ( !channel ) {
		clog( 'rpl_topicSetBy - target is not a channel', target );
		return;
	}
	
	channel.rplTopic( topicEvent );
}

ns.IrcClient.prototype.cmdTopic = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var source = msg.data.source;
	var topic = ( msg.data.params.join() || '' );
	var time  = msg.data.time;
	var targetName = msg.data.target[ 0 ].data;
	
	var target = self.targets[ targetName ];
	target.cmdTopic({
		from : source,
		topic : topic,
		time : time,
	});
}

ns.IrcClient.prototype.cmdPrivMsg = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var data = msg.data;
	var targets = msg.data.target;
	var msgEvent = {
		from : data.source,
		message : data.params.join( ' ' ),
		time : data.time,
	};
	targets.forEach( sendTo );
	function sendTo( targetMeta ) {
		var target = null;
		if ( targetMeta.type === 'nick' ) {
			target = self.getPrivate( msg.data.source );
		}
		
		if ( targetMeta.type === 'channel' )
			target = self.targets[ targetMeta.data ];
		
		self.dispatchMessage( target, msgEvent );
	}
}

ns.IrcClient.prototype.dispatchMessage = function( target, data ) {
	var self = this;
	if ( !target ) {
		clog( 'dispatchMessage - no target!? *tableflip*', { t : target, d : data, });
		return;
	}
	
	if ( 0 === data.message.indexOf( '\x01ACTION ' ))
		actionMsg();
	else
		privMsg();
	
	function privMsg() {
		target.privMsg( data );
	}
	
	function actionMsg() {
		data.message = removeAction( data.message );
		target.actionMsg( data );
		
		function removeAction( str ) {
			if ( !str || ( 'string' !== typeof( str )) )
				return str;
			
			return str.replace( /^\x01ACTION\s/, '' );
		}
	}
}

ns.IrcClient.prototype.cmdPart = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var who = msg.data.source;
	var time = msg.data.time;
	var targetName = msg.data.target[ 0 ].data;
	
	if ( who === self.currentNick ) {
		self.leave( targetName, time );
		return;
	}
	
	var message = msg.data.params.join();
	var target = self.targets[ targetName ];
	target.part({
		who : who,
		mesasge : message,
		time : time,
	});
}

ns.IrcClient.prototype.cmdQuit = function( tokens ) {
	var self = this;
	var msg = self.formatMessage( tokens );
	var who = msg.data.source;
	var quitMsg = msg.data.params.join( ' ' );
	var quitEvent = {
		type : 'quit',
		data : {
			who : who,
			message : quitMsg,
			time : msg.data.time,
		},
	};
	self.toClient( quitEvent );
	self.callOnChannels( 'quit', quitEvent.data );
}

ns.IrcClient.prototype.checkNotice = function( notice ) {
	var self = this;
	var matchSASL = notice.message.match( /SASL/ );
	if ( matchSASL )
		self.handleSASLRequired();
	
}

ns.IrcClient.prototype.handleSASLRequired = function() {
	var self = this;
	clog( 'handleSASLRequired - returning lol' );
	return;
	
	var connOptsStr = JSON.stringify( self.conf.settings.connect );
	var connOpts = JSON.parse( connOptsStr );
	connOpts.sasl = true;
	self.updateConnect( connOpts );
}

ns.IrcClient.prototype.identityChange = function( name ) {
	var self = this;
	var update = {
		type : 'identity',
		data : {
			name : name,
		},
	};
	self.toClient( update );
}

ns.IrcClient.prototype.nickChange = function( data ) {
	var self = this;
	var nickUpdate = {
		type : 'nick',
		data : data,
	};
	
	var targetKeys = Object.keys( self.targets );
	targetKeys.forEach( update );
	self.toClient( nickUpdate );
	
	function update( key ) {
		var target = self.getTarget( key );
		if ( isPrivate() && isTarget( data.current ))
			updatePrivate( key );
		else
			updateChannel( key );
		
		function isPrivate() { return !!( target instanceof ns.Private ); }
		function isTarget( nick ) {
			return !!( target.name === nick );
		}
	}
	
	function updatePrivate( key ) {
		var target = self.removeTarget( key );
		if ( !target )
			return;
		
		target.nick( data );
		self.addTarget( target );
	}
	
	function updateChannel( key ) {
		var target = self.getTarget( key );
		target.nick( data );
	}
	
}

ns.IrcClient.prototype.getPrivate = function( nick ) {
	var self = this;
	var target = self.targets[ nick ];
	if ( target )
		return target;
	
	target = self.createPrivate( nick );
	return target;
}

ns.IrcClient.prototype.createPrivate = function( nick, forceOpen ) {
	var self = this;
	if ( self.targets[ nick ]) {
		return self.targets[ nick ];
	}
	
	const clientId = 'priv-' + self.clientId.split( '-' )[ 1 ] + '-' + nick;
	var conf = {
		clientId : clientId,
		name     : nick,
		conn     : self.client,
		toServer : sendToServer,
	};
	var privObj = new ns.Private( conf );
	self.addTarget( privObj );
	
	var open = {
		type : 'open',
		data : {
			target : {
				clientId : privObj.clientId,
				name : nick,
			},
			forceOpen : forceOpen,
		},
	};
	
	self.sendPrivate( open );
	
	return privObj;
	
	function sendToServer( msg, source ) {
		self.parseCommand( msg, source );
	}
}

ns.IrcClient.prototype.removePrivate = function( nick ) {
	var self = this;
	var target = self.removeTarget( nick );
	if ( !target ) {
		clog( 'no such target', { n : nick, t : self.targets });
		return;
	}
	
	target.close();
	var remove = {
		type : 'remove',
		data : target.clientId,
	};
	self.sendPrivate( remove );
}

ns.IrcClient.prototype.sendPrivate = function( action ) {
	var self = this;
	var priv = {
		type : 'private',
		data : action,
	};
	self.toClient( priv );
}

ns.IrcClient.prototype.joinChannel = function( data ) {
	var self = this;
	var name = data.target;
	if ( self.targets[ name ]) {
		clog( 'join - already in channel', name );
		return;
	}
	
	var isStored = self.conf.settings.join.indexOf( name );
	if ( isStored == -1 ) {
		self.conf.settings.join.push( name );
		self.doPersist( 'join', self.conf.settings.join, persistBack );
	}
	
	var chanObj = self.addChannel( name );
	var joinedEvent = {
		type : 'join',
		data : {
			displayName : name,
			clientId : chanObj.clientId,
			time : data.time,
		},
	}
	self.toClient( joinedEvent );
	
	function persistBack( update ) {
		self.updateClientSetting( update );
	}
}

ns.IrcClient.prototype.leave = function( targetName, time ) {
	var self = this;
	var target = self.removeTarget( targetName );
	if ( !target ) {
		clog( 'leave.target - no exist', target );
		return;
	}
	target.close();
	
	persist();
	sendLeaveEvent();
	
	function persist() {
		var join = self.conf.settings.join;
		var indexOf = join.indexOf( targetName );
		var notInJoin = !!( indexOf == -1 );
		if ( notInJoin ) {
			log( 'leave - not in join?', { t: targetName, j : self.conf.settings.join });
			return;
		}
		
		join.splice( indexOf, 1 );
		self.doPersist( 'join', join, persistBack );
		function persistBack( update ) {
			self.conf.settings.join = update.value;
			self.updateClientSetting( update );
		}
	}
	
	function sendLeaveEvent() {
		var leaveEvent = {
			type : 'leave',
			data : {
				clientId : target.clientId,
				time : time,
			},
		}
		self.toClient( leaveEvent );
	}
}

ns.IrcClient.prototype.getCurrentChannels = function() {
	var self = this;
	var targetNames = Object.keys( self.targets );
	var channels = targetNames.filter( isChannel );
	return channels;
	
	function isChannel( name ) { return !!( self.targets[ name ].type === 'channel' ); }
}

ns.IrcClient.prototype.getCurrentPrivates = function() {
	var self = this;
	return [];
}

ns.IrcClient.prototype.setMessageMap = function() {
	var self = this;
}

ns.IrcClient.prototype.handleRawCommand = function( msg ) {
	var self = this;
	self.send( msg );
}

ns.IrcClient.prototype.handleMessage = function( msg ) {
	var self = this;
	// check first character
	if ( notWhitespace( msg ) && notSlash( msg ))
		msg = '/' + msg;
	
	self.parseCommand( msg );
	
	function notWhitespace( str ) { return str[ 0 ] !== ' '; }
	function notSlash( str ) { return str[ 0 ] !== '/'; }
}

ns.IrcClient.prototype.parseCommand = function( msg, source ) {
	var self = this;
	var str = makeString( msg );
	if ( !str ) {
		clog( 'parseCommand - could not make string', msg );
		return;
	}
	
	msg = str;
	
	if ( !msg.length ) {
		discard( msg );
		return;
	}
	
	let cmds = self.cmd.check( msg, source );
	if ( !cmds ) {
		clog( 'parseCommand - could not make command', msg );
		return;
	}
	
	clog( 'parseCommand - cmds', cmds, 4 );
	cmds.forEach( cmd => {
		self.send( cmd.message );
		if ( cmd.type === 'privmsg' )
			copyToSelf( cmd );
	});
	//self.send( cmd.message );
	
	
	
	function makeString( str ) {
		try {
			return String( msg );
		} catch ( e ) {
			clog( 'could not string', msg );
			return null;
		}
	}
	
	function copyToSelf( msg ) {
		var target = self.getTarget( msg.target.name );
		if ( !target ) {
			clog( 'nope on target', msg );
			return;
		}
		
		var wrap = {
			from : null,
			message : msg.raw,
			time : Date.now(),
		};
		self.dispatchMessage( target, wrap );
		//target.privMsg( wrap );
	}
}

ns.IrcClient.prototype.handlePrivate = function( msg ) {
	var self = this;
	if ( msg.type === 'open' ) {
		self.createPrivate( msg.data, true );
		return;
	}
	
	if ( msg.type === 'remove' ) {
		self.removePrivate( msg.data );
		return;
	}
	
	clog( 'unknown private event', msg );
}

ns.IrcClient.prototype.getConsoleLog = function() {
	var self = this;
	self.consoleLog.forEach( send );
	function send( msg ) {
		var wrap = {
			type : 'log',
			data : msg,
		};
		self.emitToConsole( wrap );
	}
}

ns.IrcClient.prototype.parseMessage = function( msg ) {
	var self = this;
	self.send( msg.data );
}

ns.IrcClient.prototype.msgQuit = function( quitMsg ) {
	var self = this;
	quitMsg = quitMsg || 'quit';
	var msg = 'QUIT ' + quitMsg;
	self.send( msg );
}

ns.IrcClient.prototype.addChannel = function( name ) {
	var self = this;
	if ( !self.clientId )
		return;
	
	const modPart = self.clientId.split( '-' )[ 1 ];
	const clientId = 'channel-' + modPart + '-' + name;
	var conf = {
		clientId : clientId,
		name     : name,
		toServer : sendToServer,
	};
	
	var chanObj = new ns.Channel( self.client, conf );
	self.addTarget( chanObj );
	return chanObj;
	
	function sendToServer( msg, source ) { self.parseCommand( msg, source ); }
}

ns.IrcClient.prototype.getTarget = function( name ) {
	var self = this;
	return self.targets[ name ];
}

ns.IrcClient.prototype.getTargetById = function( id ) {
	var self = this;
	var name = self.idToTargetMap[ id ];
	return self.targets[ name ];
}

ns.IrcClient.prototype.addTarget = function( target ) {
	var self = this;
	var name = target.name;
	var exists = self.targets[ name ];
	if ( exists ) {
		clog( 'addTarget - target already exists', exists );
		return exists;
	}
	
	self.targets[ name ] = target;
	self.targetKeys.push( name );
	self.idToTargetMap[ target.clientId ] = name;
	return null;
}

ns.IrcClient.prototype.removeTarget = function( name ) {
	var self = this;
	var target = self.targets[ name ];
	if ( !target ) {
		clog( 'removeTarget - invalid target name', name );
		return;
	}
	
	delete self.targets[ name ];
	delete self.idToTargetMap[ target.clientId ];
	self.targetKeys = Object.keys( self.targets );
	
	return target;
}

ns.IrcClient.prototype.getTargetFromPrefix = function( string ) {
	var self = this;
	if ( !string )
		return '';
	
	string = string.trim();
	if ( string[ 0 ] == ':' )
		string = string.slice( 1 );
	
	return string.split( '!' )[0];
}

ns.IrcClient.prototype.formatMessageSplitTarget = function( data ) {
	var self = this;
	var source = self.getTargetFromPrefix( data.prefix );
	var target = data.params.target;
	var params = data.params.list;
	var messages = target.map( getMessage );
	
	function getMessage( targetObj ) {
		var msg = {
			type : data.command,
			data : {
				source : source,
				target : targetObj,
				params : params,
				time : Date.now(),
			},
		};
		return msg;
	}
	
	return messages;
}

ns.IrcClient.prototype.formatMessage = function( data ) {
	var self = this;
	var source = self.getTargetFromPrefix( data.prefix );
	var target = data.params.target;
	var params = data.params.list;
	var time = data.time;
	var msg = {
		type : data.command,
		data : {
			source : source,
			target : target,
			params : params,
			time : time,
		},
	};
	return msg;
}

ns.IrcClient.prototype.toTarget = function( msg ) {
	var self = this;
	var targetName = msg.data.target[ 0 ].data;
	var target = self.targets[ targetName ];
	var wrap = self.messageWrap( msg );
	if ( !target ) {
		clog( 'toTarget - no target: msg', msg.data );
		clog( 'totarget - targets', self.targets );
		return;
	}
	
	target.log.push( msg );
}

ns.IrcClient.prototype.consoleMessage = function( msg ) {
	var self = this;
	var wrap = self.messageWrap( msg );
	self.toConsole( wrap );
}

ns.IrcClient.prototype.consoleNotification = function( msg ) {
	var self = this;
	var wrap = {
		type : 'notification',
		data : msg,
	};
	self.toConsole( wrap );
}

ns.IrcClient.prototype.consoleError = function( msg ) {
	var self = this;
	var wrap = {
		type : 'error',
		data : msg,
	};
	self.toConsole( wrap );
}

ns.IrcClient.prototype.toConsole = function( msg ) {
	var self = this;
	if ( !msg.type )
		msg = self.messageWrap( msg );
	
	self.consoleLog.push( msg );
	self.emitToConsole( msg );
}

ns.IrcClient.prototype.messageWrap = function( data ) {
	var self = this;
	var msg = {
		type : 'message',
		data : data,
	};
	return msg;
}

ns.IrcClient.prototype.callOnChannels = function( fnName, msg ) {
	var self = this;
	var targetKeys = Object.keys( self.targets );
	targetKeys.forEach( callOn );
	function callOn( targetKey ) {
		var target = self.targets[ targetKey ];
		if ( !target[ fnName ] || !( typeof target[ fnName ] === 'function')) {
			return;
		}
		
		try {
			target[ fnName ]( msg );
		} catch ( e ) {
			clog( 'callOnChannels - exception', e );
			clog( 'fnName', fnName );
			clog( 'target', target );
		}
	}
}

ns.IrcClient.prototype.emitToConsole = function( msg ) {
	var self = this;
	var wrap = {
		type : 'message',
		data : msg,
	};
	self.toClient( wrap );
}

ns.IrcClient.prototype.toSelf = function( msg ) { // hacky, indeed
	var self = this;
	if ( !self.client )
		return;
	
	self.client.receiveMsg( msg );
}

ns.IrcClient.prototype.toClient = function( msg ) {
	var self = this;
	if ( !self.client )
		return;
	
	self.client.send( msg );
}

ns.IrcClient.prototype.stop = function() {
	var self = this;
	self.connectionState( 'offline' );
	self.disconnect();
	self.clearTargets(); // closes channels and priv messages
	self.stopped = true;
}

ns.IrcClient.prototype.clearTargets = function() {
	var self = this;
	self.targetKeys.forEach( close );
	self.targets = {};
	self.targetKeys = [];
	self.idToTargetMap = {};
	
	function close( name ) {
		var channel = self.targets[ name ];
		channel.close();
	}
}

ns.IrcClient.prototype.disconnect = function() {
	var self = this;
	if ( !self.conn ) {
		clog( 'disconnect - no conn, returning' );
		return;
	}
	
	var conn = self.conn;
	delete self.conn;
	conn.removeAllListeners();
	
	conn.on( 'error', function() {});
	conn.on( 'close', function() {
		clog( 'conn closed', {
			rx : conn.bytesRead,
			tx : conn.bytesWritten,
		});
	});
	
	try {
		conn.destroy();
	} catch ( ex ) {
		clog( 'end - conn.close expeception' );
	}
	
}

ns.IrcClient.prototype.close = function( msg ) {
	var self = this;
	self.msgQuit( msg );
	
	if ( self.cmd )
		self.cmd.close();
	
	self.stop();
	offClient();
	delete self.client;
	
	function offClient() {
		self.clientListenerId.forEach( off );
		function off( id ) { self.client.off( id ); }
	}
}

// CHANNEL
// datamodel of a channel
ns.Channel = function( conn, conf ) {
	if ( !( this instanceof ns.Channel ))
		return new ns.Channel( conf );
	
	var self = this;
	self.clientId = conf.clientId;
	self.name = conf.name;
	self.server = conf.toServer;
	self.logMax = conf.logMax || 50;
	self.type = 'channel';
	self.client = null;
	
	self.topic = {};
	self.mode = {};
	self.users = {};
	self.log = [];
	
	self.logTrimTimer = null;
	
	self.init( conn );
}

// Public

ns.Channel.prototype.handleKick = function( data ) {
	const self = this;
	const victim = data.params[ 0 ];
	const kick = {
		type : 'kick',
		data : {
			kicker : data.source,
			victim : victim,
			time   : data.time,
		},
	};
	self.toClient( kick );
	self.removeUser( victim );
}

ns.Channel.prototype.setMode = function( data ) {
	const self = this;
	var modeMsg = data.params[ 0 ];
	var target = data.params[ 1 ];
	if ( !target ) {
		self.setChannelMode( data );
		return;
	}
	
	const mode = modeMsg.split( '' )[ 1 ];
	if ( 'b' === mode )
		self.setUserBan( data );
	else
		self.setUserLevel( data );
}

ns.Channel.prototype.close = function() {
	var self = this;
	clearInterval( self.logTrimTimer );
	self.client.close();
	delete self.name;
	delete self.client;
	delete self.server;
}

// Private

ns.Channel.prototype.modeMap = {
	'@' : 'm',
	'o' : 'm',
	'v' : 'v',
};

ns.Channel.prototype.modeOrder = [ 'm', 'v' ];

ns.Channel.prototype.init = function( parentConn ) {
	var self = this;
	self.client = new events.EventNode( self.clientId, parentConn, unknownEvent );
	self.client.on( 'message', message );
	self.client.on( 'log', getLog );
	self.client.on( 'leave', leave );
	self.client.on( 'state', getState );
	
	function message(  e, cid ) {   self.message( e, cid ); }
	function getLog(   e, cid ) {    self.getLog( e, cid ); }
	function cmdTopic( e, cid ) {  self.cmdTopic( e, cid ); }
	function leave(    e, cid ) {     self.leave( e, cid ); }
	function getState( e, cid ) { self.sendState( e, cid ); }
	
	var timeout = 1000 * 60 * 10; // 10 minutes
	self.logTrimTimer = setInterval( trimLog, timeout );
	function trimLog() { self.trimLog(); }
	
	function unknownEvent( e ) { tlog( 'unknownEvent', e ); }
}

ns.Channel.prototype.getState = function() {
	var self = this;
	var users = [];
	for ( var user in self.users ) {
		var userObj = self.users[ user ];
		users.push( userObj );
	}
	
	var state =  {
		type : self.type,
		clientId : self.clientId,
		displayName : self.name,
		topic : self.topic,
		mode : self.mode,
		users : users,
	};
	
	return state;
}

ns.Channel.prototype.sendState = function( e, cid ) {
	var self = this;
	var state = self.getState();
	var msg = {
		type : 'state',
		data : state,
	};
	
	self.toClient( msg, cid );
}

ns.Channel.prototype.message = function( msg ) {
	var self = this;
	try {
		msg = String( msg );
	} catch ( e ) {
		tlog( 'could not string', msg );
		return;
	}
	
	if ( !msg )
		return;
	
	var isCommand = msg[ 0 ] === '/';
	if ( isCommand ) {
		self.toServer( msg );
		return;
	}
	
	var message = 'PRIVMSG ' + self.name + ' ' + msg;
	self.toServer( message );
}

ns.Channel.prototype.getLog = function( msg, cid ) {
	var self = this;
	tlog( 'getLog', self.log );
	self.log.forEach( send );
	function send( msg ) {
		var wrap = {
			type : 'log',
			data : msg,
		};
		self.toClient( wrap, cid );
	}
}

ns.Channel.prototype.addLog = function( msg ) {
	var self = this;
	self.log.push( msg );
	if ( self.log.length > self.maxLog * 2 )
		self.trimLog();
}

ns.Channel.prototype.trimLog = function() {
	var self = this;
	var overMax = self.log.length - self.logMax;
	if ( overMax > 0 )
		self.log = self.log.slice( -self.logMax );
}

ns.Channel.prototype.rplTopic = function( data ) {
	var self = this;
	self.setTopic( data );
}

ns.Channel.prototype.cmdTopic = function( data ) {
	var self = this;
	self.setTopic( data );
}

ns.Channel.prototype.setTopic = function( data ) {
	var self = this;
	self.topic.topic = data.topic || self.topic.topic;
	self.topic.from = data.from || self.topic.from || self.name;
	self.topic.time = data.time || self.topic.time;
	
	if ( self.topic.topic && self.topic.from )
		updateClient();
	
	function updateClient() {
		var msg = {
			type : 'topic',
			data : self.topic,
		};
		
		self.toClient( msg );
		if ( data.name && data.topic )
			self.addLog( msg );
	}
}

ns.Channel.prototype.setChannelMode = function( data ) {
	const self = this;
	const source = { name : data.source, };
	const modeMsg = data.params.shift();
	const update = {};
	const modeEvent = {
		type : 'mode',
		data : {
			source : source,
			update : update,
			mode   : modeMsg,
			time   : data.time,
		},
	};
	self.toClient( modeEvent );
}

ns.Channel.prototype.setUserBan = function( data ) {
	const self = this;
	const banner = data.source;
	const mode = data.params[ 0 ];
	const victim = data.params[ 1 ];
	const ban = {
		type : 'ban',
		data : {
			banner : banner,
			victim : victim,
			mode   : mode,
			time   : data.time,
		},
	};
	self.toClient( ban );
}

ns.Channel.prototype.setUserLevel = function( data ) {
	var self = this;
	const source = data.source;
	const modeChange = data.params[ 0 ];
	const mode = modeRemap( modeChange );
	const target = data.params[ 1 ];
	const user = self.getUsers( target );
	if ( !user ) {
		tlog( 'setMode - no user for ', target );
		return;
	}
	
	user.mode = toggleMode( user.mode, mode );
	self.updateUser( user.name, user );
	var modeEvent = {
		type : 'usermode',
		data : {
			source : self.users[ source ],
			target : user,
			mode   : modeChange,
			time   : data.time,
		},
	};
	self.toClient( modeEvent );
	
	function toggleMode( current, change ) {
		current = current || '';
		var parts = change.split( '' );
		var sign = parts[ 0 ];
		var mode = parts[ 1 ];
		if ( !current && ( sign === '+' ))
			return mode;
		
		var currentArr = current.split( '' );
		var modeIndex = currentArr.indexOf( mode );
		if ( sign === '+' )
			add( mode );
		else
			remove( mode );
		
		currentArr.sort( modeOrder );
		var modeStr = currentArr.join( '' );
		return modeStr;
		
		function add( mode ) {
			if ( modeIndex == -1 )
				currentArr.push( mode );
		}
		
		function remove( mode ) {
			if ( modeIndex == -1 )
				return;
			
			currentArr.splice( modeIndex, 1 );
		}
		
		function modeOrder( a, b ) {
			if ( !a || !b )
				return 0;
			
			var ai = self.modeOrder.indexOf( a );
			var bi = self.modeOrder.indexOf( b );
			return ai - bi;
		}
	}
	
	function modeRemap( modeStr ) {
		var parts = modeStr.split( '' );
		var mode = parts.map( replace );
		return mode.join( '' );
		
		function replace( mode ){
			return self.modeMap[ mode ] || mode;
		}
	}
}

ns.Channel.prototype.leave = function() {
	var self = this;
	var msg = 'PART ' + self.name;
	self.toServer( msg );
}

ns.Channel.prototype.join = function( data ) {
	var self = this;
	var user = self.addUser( data.who );
	user.time = data.time;
	var join = {
		type : 'join',
		data : user,
	};
	self.toClient( join );
}

ns.Channel.prototype.nickList = function( nicks ) {
	var self = this;
	var nickList = nicks.map( add );
	function add( nick ) {
		return self.addUser( nick );
	}
	var nicksMsg = {
		type : 'userlist',
		data : nickList,
	};
	self.toClient( nicksMsg );
}

ns.Channel.prototype.nickListEnd = function() {
	var self = this;
}

ns.Channel.prototype.nick = function( data ) {
	var self = this;
	var name = data.current;
	var update = {
		name : data.update,
	};
	self.updateUser( name, update );
}

ns.Channel.prototype.privMsg = function( data ) {
	var self = this;
	var msg = {
		type : 'message',
		data : data,
	};
	self.addLog( msg );
	self.toClient( msg );
}

ns.Channel.prototype.actionMsg = function( data ) {
	var self = this;
	var msg = {
		type : 'action',
		data : data,
	};
	self.addLog( msg );
	self.toClient( msg );
}

ns.Channel.prototype.part = function( data ) {
	var self = this;
	self.removeUser( data.who );
	var part = {
		type : 'part',
		data : data,
	};
	self.addLog( part );
	self.toClient( part );
}

ns.Channel.prototype.quit = function( data ) {
	var self = this;
	self.removeUser( data.who );
	var quit = {
		type : 'quit',
		data : data,
	};
	self.addLog( quit );
	// not sent to client from here, it would duplicate messages
}

ns.Channel.prototype.addUser = function( nick ) {
	var self = this;
	var user = {
		mode : '',
		name : null,
	};
	
	var hasMode = nick.match( /^[@\+]{1}/ );
	if ( hasMode ) {
		var mode = hasMode[ 0 ];
		user.mode = self.modeMap[ mode ];
		user.name = nick.slice( 1 );
	}
	else
		user.name = nick;
	
	self.users[ user.name ] = user;
	return user;
}

ns.Channel.prototype.getUsers = function( name ) {
	var self = this;
	if ( name )
		return self.users[ name ] || null;
	
	return self.users;
}

ns.Channel.prototype.updateUser = function( name, update ) {
	var self = this;
	var current = self.users[ name ];
	if ( !current )
		return;
	
	var updatedUser = {
		name : update.name || current.name,
		mode : update.mode || current.mode,
	};
	
	self.removeUser( name );
	self.users[ updatedUser.name ] = updatedUser;
}

ns.Channel.prototype.removeUser = function( name ) {
	var self = this;
	var user = self.users[ name ];
	if ( !user )
		return null;
	
	delete self.users[ name ];
	return user;
}

ns.Channel.prototype.toServer = function( msg ) {
	var self = this;
	self.server( msg, self.name );
}

ns.Channel.prototype.toClient = function( msg, cid ) {
	var self = this;
	self.client.send( msg, cid );
}


// PRIVATES
// datamodel of a private chat
ns.Private = function( conf ) {
	if ( !( this instanceof ns.Private ))
		return new ns.Private( conf );
	
	var self = this;
	self.type = 'private';
	self.clientId = conf.clientId;
	self.name = conf.name;
	self.server = conf.toServer;
	self.clientConn = conf.conn;
	self.client = null;
	
	self.log = [];
	
	self.init();
}

ns.Private.prototype.close = function() {
	var self = this;
	self.client.close();
	delete self.name;
	delete self.client;
	delete self.server;
}

ns.Private.prototype.init = function() {
	var self = this;
	self.client = new events.EventNode( self.clientId, self.clientConn, unknownEvent );
	delete self.clientConn;
	self.client.on( 'message', sendMessage );
	self.client.on( 'log', sendLog );
	self.client.on( 'remove', remove );
	
	function sendMessage( e, cid ) { self.sendMessage( e, cid ); }
	function sendLog(     e, cid ) { self.sendLog(     e, cid ); }
	function remove(      e, cid ) { self.remove(      e, cid ); }
	
	function unknownEvent( e ) {
		plog( 'unknown event', e );
	}
}

ns.Private.prototype.getState = function() {
	var self = this;
	var state =  {
		type : self.type,
		clientId : self.clientId,
		name : self.name,
	};
	return state;
}

ns.Private.prototype.nick = function( data ) {
	var self = this;
	if ( data.current === self.name )
		self.name = data.update;
}

ns.Private.prototype.privMsg = function( data ) {
	var self = this;
	var msgEvent = {
		type : 'message',
		data : data,
	};
	self.addLog( msgEvent );
	self.toClient( msgEvent );
}

ns.Private.prototype.actionMsg = function( data ) {
	var self = this;
	var actionEvent = {
		type : 'action',
		data : data,
	};
	self.addLog( actionEvent );
	self.toClient( actionEvent );
}

ns.Private.prototype.sendMessage = function( message ) {
	var self = this;
	if ( 'string' !== typeof( message )) {
		plog( 'sendMessage - not string', message );
		return;
	}
	
	var isCommand = ( '/' === message[ 0 ] ) || ( 0 === message.indexOf( '\x01ACTION ' ));
	if ( isCommand ) {
		self.toServer( message );
		return;
	}
	
	var msg = 'PRIVMSG ' + self.name + ' ' + message;
	self.toServer( msg );
}

ns.Private.prototype.addLog = function( msg ) {
	var self = this;
	self.log.push( msg );
}

ns.Private.prototype.sendLog = function( e, cid ) {
	var self = this;
	if ( !self.log.length ) {
		send( null );
		return;
	}
	
	self.log.forEach( send );
	function send( msg ) {
		var log = {
			type : 'log',
			data : msg,
		};
		
		self.toClient( log, cid );
	}
}

ns.Private.prototype.remove = function() {
	var self = this;
}

ns.Private.prototype.toClient = function( msg, cid ) {
	var self = this;
	self.client.send( msg, cid );
}

ns.Private.prototype.toServer = function( msg ) {
	var self = this;
	self.server( msg, self.name );
}

// PARSE
// .process() takes a irc message string and returns a msg object:
//
// msg = {
//    prefix : 'string',
//    command : 'string',
//    params : {
//        target : [],  -- the target may be a list of targets, so always an array of strings
//        list : [],  -- remaining parameters, if any, as an array of strings
//    },
// },
//
ns.Parse = function() {
	if ( !( this instanceof ns.Parse ))
		return new ns.Parse();
	
	var self = this;
	self.init();
}

ns.Parse.prototype.init = function() {
	var self = this;
	self.rxPrefix = /^:[^\s]+?\x20/;
	self.targetLexer = new ns.TargetLexer();
}

ns.Parse.prototype.process = function( msgString ) {
	var self = this;
	var msg = {
		prefix : null,
		command : null,
		params : {
			target : null,
			list : null,
		},
		time : Date.now(),
		source : msgString,
	};
	
	// prefix
	msgString = setPrefix( msgString );
	// command;
	msgString = setCommand( msgString );
	if ( !msg.command )
		return null;
	
	// params
	setParams ( msgString );
	return msg;
	
	function setPrefix( string ) {
		var match = string.match( self.rxPrefix );
		if ( !match )
			return string;
		
		var prefix = match[ 0 ];
		msg.prefix = prefix.slice( 1, -1 );
		return string.slice( prefix.length );
	}
	
	function setCommand( string ) {
		// match uppercase command starting with a letter, or 3 digit code. End with a space.
		// if there is a match, the command is at index 1, OR the code is at index 2
		string = string.toString();
		self.commandRX = self.commandRX || /^(?:(?:[A-Z][A-Z0-9]+)|(?:[0-9]{3}))\x20/;
		var command = string.match( self.commandRX );
		if ( !command ) {
			clog( 'no command found - msg', msg );
			clog( 'no command found - string', string.toString() );
			return null;
		}
		
		msg.command = command[ 0 ].toString().trim();
		return string.slice( command[ 0 ].length );
	}
	
	function setParams( string ) {
		var specialList = string.split( ':' );
		var normalParams = specialList.shift();
		var specialParam = specialList.join( ':' );
		var params = null;
		if ( normalParams ) {
			params = normalParams.split( /\x20/ );
			params.push( specialParam );
		}
		else
			params = [ specialParam ];
		
		params = params.filter( isValue );
		var targetString = params.shift();
		var target = self.targetLexer.process( targetString );
		msg.params.target = target;
		msg.params.list = params;
		
		function isValue( item ) {
			if ( !item || ( typeof( item ) !== 'string' ))
				return false;
			
			return true;
		}
	}
}


// TARGETLEXER
ns.TargetLexer = function() {
	if ( !( this instanceof ns.TargetLexer ))
		return new ns.TargetLexer();
	
	var self = this;
	self.init();
}

ns.TargetLexer.prototype.init = function() {
	var self = this;
	// https://tools.ietf.org/html/rfc1459#page-8
	self.channelRX = /^((?:#|&)[^\x00\x07\x0A\x0D\x20,]+)$/;
	self.userRX = /(^[^\x00\x0D\x0A\x20]+@[\S]+)$/;
	self.nickRX = /^\w[\w-\[\]\\`\^{}]*$/;
}

ns.TargetLexer.prototype.process = function( string ) {
	var self = this;
	if ( !string )
		return false;
	
	var list = string.split( ',' );
	var targetList = list.map( tokenize );
	return targetList;
	
	function tokenize( target ) {
		if ( !target )
			return false;
		
		return self.tokenize( target );
	}
}

ns.TargetLexer.prototype.tokenize = function( part  ) {
	var self = this;
	var channel = part.match( self.channelRX );
	if ( channel )
		return { type : 'channel', data : channel[ 0 ]};
	
	var user = part.match( self.userRX );
	if ( user )
		return { type : 'user', data : user[ 0 ]};
	
	var nick = part.match( self.nickRX );
	if ( nick )
		return { type : 'nick', data : nick[ 0 ]};
	
	return false;
}

module.exports = ns.IRC;


// CMDCHECKER

ns.CmdChecker = function( targetsRef ) {
	if ( !( this instanceof ns.CmdChecker ))
		return new ns.CmdChecker( targetsRef );
	
	var self = this;
	self.targets = targetsRef;
	self.init();
}

ns.CmdChecker.prototype.close = function() {
	var self = this;
	delete self.targets;
}

ns.CmdChecker.prototype.init = function() {
	var self = this;
	self.channelRX = /^((?:#|&)[^\x00\x07\x0A\x0D\x20,]+)/;
	self.cmdMap = {
		'TOPIC'   : buildTopic,
		'JOIN'    : buildJoin,
		'NICK'    : buildNickMsg,
		'NAME'    : buildNickMsg,
		'MSG'     : buildPrivMsg,
		'PRIVMSG' : buildPrivMsg,
		'QUERY'   : buildPrivMsg,
		'MODE'    : buildModeMsg,
		'AWAY'    : buildAwayMsg,
		'PART'    : buildPartMsg,
		'LEAVE'   : buildPartMsg,
		'QUIT'    : buildQuitMsg,
		'ME'      : buildActionMsg,
		'ACTION'  : buildActionMsg,
		'OP'      : buildModeO,
		'VOICE'   : buildModeV,
		'KICK'    : buildKickMsg,
		'BAN'     : buildBanMsg,
	};
	
	function buildTopic( args, source ) {
		if ( source )
			args = self.setTarget( args, source );
		
		var cmd = [];
		cmd.push( args.shift()); // TOPIC
		cmd.push( args.shift()); // <channel>
		cmd.push( ':' + args.join( '\x20' )); // topic goes after :
		
		var message = cmd.join( '\x20' );
		let meta = self.buildMeta( 'topic', cmd[ 1 ], message );
		return [ meta ];
	}
	
	function buildJoin( args ) {
		if ( !self.isChannel( args[ 1 ]))
			return null;
		
		var message = args.join( '\x20' );
		var meta = self.buildMeta( 'join', null, message );
		return [ meta ];
	}
	
	function buildPrivMsg( args ) {
		var target = args[ 1 ];
		var body = args.slice( 2 );
		var raw = body.join( ' ' );
		let raws = raw.split( '\n' );
		let metas = raws.map( raw => {
			var message = 'PRIVMSG ' + target + ' :' + raw;
			var meta = self.buildMeta( 'privmsg', target, message );
			meta.raw = raw;
			return meta;
		});
		return metas;
	}
	
	function buildNickMsg( args ) {
		var msg = 'NICK ' + args[ 1 ];
		var meta = self.buildMeta( 'nick', null, msg );
		return [ meta ];
	}
	
	function buildAwayMsg( args ) {
		args.shift(); // discard the command
		var message = 'AWAY :' + args.join( ' ' );
		var meta = self.buildMeta( 'away', null, message );
		return [ meta ];
	}
	
	function buildPartMsg( args, source ) {
		if ( source && !( args[ 1 ] && self.isChannel( args[ 1 ] )) )
			args = self.setTarget( args, source );
		
		var msg = args.join( ' ' );
		var meta = self.buildMeta( 'part', args[ 1 ], msg );
		return [ meta ];
	}
	
	function buildQuitMsg( args ) {
		var msg = args.join( ' ' );
		var meta = self.buildMeta( 'quit', null, msg );
		return [ meta ];
	}
	
	function buildActionMsg( args, source ) {
		args[ 0 ] = 'ACTION';
		var raw = args.join( ' ' );
		raw =  '\x01' + raw + '\x01';// add the weird stuff
		var message = 'PRIVMSG ' + source + ' :' + raw;
		var meta = self.buildMeta( 'privmsg', source, message );
		meta.raw = raw
		return [ meta ];
	}
	
	function buildModeMsg( args, source ) {
		if ( source && !self.isChannel( args[ 1 ] ))
			args = self.setTarget( args, source );
		
		var target = args[ 1 ];
		var msg = args.join( ' ' );
		var meta = self.buildMeta( 'mode', target, msg );
		return [ meta ];
	}
	
	function buildModeO( args, source ) {
		args.shift(); // remove 'op'
		if ( self.isChannel( args[ 0 ] )) // keep the target if its there
			source = args.shift();
		
		args.unshift( '+o' );
		args.unshift( 'MODE' );
		if ( source && !self.isChannel( args[ 1 ]) )
			args = self.setTarget( args, source );
		
		let mode = buildModeMsg( args );
		return mode;
	}
	
	function buildModeV( args, source ) {
	}
	
	function buildKickMsg( args, source ) {
		if ( source && !self.isChannel( args[ 1 ] ))
			args = self.setTarget( args, source );
		
		const target = args[ 1 ];
		const msg = args.join( ' ' );
		const meta = self.buildMeta( 'kick', target, msg );
		return [ meta ];
	}
	
	function buildBanMsg( args, source ) {
		args.shift(); // get rid of 'BAN'
		args.unshift( '+b' );
		args.unshift( 'MODE' );
		const meta = buildModeMsg( args, source );
		return meta;
	}
}

ns.CmdChecker.prototype.check = function( str, source ) {
	var self = this;
	var args = str.split( /\x20/ );
	var command = self.normalize( args[ 0 ]);
	var cmdHandler = self.getHandler( command );
	if ( !cmdHandler )
		return false;
	
	args[ 0 ] = command;
	var cmd = cmdHandler( args, source );
	if ( !cmd )
		return false;
	
	return cmd;
}

ns.CmdChecker.prototype.normalize = function( str ) {
	var self = this;
	if ( str[ 0 ] == '/' )
		str = str.slice( 1 );
	
	return str.toUpperCase();
}

ns.CmdChecker.prototype.getHandler = function( cmd ) {
	var self = this;
	cmd = cmd.toUpperCase();
	return self.cmdMap[ cmd ];
}

ns.CmdChecker.prototype.setTarget = function( args, target ) {
	var self = this;
	var targetPosArg = args[ 1 ];
	
	if ( !targetPosArg ) {
		args.push( target );
		return args;
	}
	
	if ( targetPosArg === target )
		return args;
	
	if ( self.isTarget( targetPosArg ))
		return args;
	
	var cmd = args.shift();
	args.unshift( target );
	args.unshift(  cmd );
	return args;
}

ns.CmdChecker.prototype.isTarget = function( test ) {
	var self = this;
	var found = self.targets[ test ];
	return !!found;
}

ns.CmdChecker.prototype.isChannel = function( str ) {
	var self = this;
	if ( !str )
		return false;
	
	var foundChannel = str.match( self.channelRX );
	return !!foundChannel;
}

ns.CmdChecker.prototype.updateTarget = function( update ) {
	var self = this;
	self.target = update;
}

ns.CmdChecker.prototype.buildMeta = function( type, target, message ) {
	var self = this;
	var targetType = null;
	if ( target )
		targetType = self.isChannel( target ) ? 'channel' : 'private';
	
	var meta = {
		type : type,
		target : {
			type : targetType,
			name : target,
		},
		message : message,
	};
	return meta;
}
