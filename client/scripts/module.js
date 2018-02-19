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
var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.module = library.module || {};

// BASEMODULE
(function( ns, undefined ) {
	ns.BaseModule = function( conf ) {
		if ( !( this instanceof ns.BaseModule ))
			return new ns.BaseModule( conf );
		
		var self = this;
		self.module = conf.module;
		self.parentView = conf.parentView
		self.clientId = self.module.clientId;
		self.onremove = conf.onremove;
		
		self.identity = null;
		self.contacts = {};
		self.messageMap = null;
		self.updateMap = null;
		self.conn = null;
		self.view = null;
		self.connectionState = null;
		self.settingsView = null;
		self.nativeKeys = null;
		self.initialized = false;
		
		self.initBaseModule();
	}
	
	// Public
	
	ns.BaseModule.prototype.reconnect = function() {
		console.log( 'BaseModule.reconnect() - implement in module', self );
		throw new Error( '^^^ BaseModule.reconnect() - implement in module' );
	}
	
	// Private
	
	ns.BaseModule.prototype.initBaseModule = function() {
		var self = this;
		// server stuff
		self.conn = new library.system.Message({
			id : self.clientId,
			handler : receiveMsg
		});
		
		function receiveMsg( msg ) { self.receiveMsg( msg ); }
		
		self.messageMap = {
			'initstate' : initState,
			'connection' : connection,
			'settings' : showSettings,
			'setting' : updateSetting,
		};
		
		function initState( msg ) { self.initializeState( msg ); }
		function connection( msg ) { self.connection( msg ); }
		function showSettings( msg ) { self.showSettings( msg ); }
		function updateSetting( msg ) { self.updateSetting( msg ); }
		
		self.connectionMap = {
			'connecting' : function( e ) { self.handleConnecting( e ); },
			'online'     : function( e ) { self.handleOnline( e ); },
			'error'      : function( e ) { self.handleConnectionError( e ); },
			'offline'    : function( e ) { self.handleOffline( e ); }
		};
		self.connectionErrorMap = {};
		
		// view stuff
		self.view = new library.component.SubView({
			parent : self.parentView,
			type : self.clientId,
		});
		
		self.view.on( 'settings', getSettings );
		self.view.on( 'reconnect', reconnect );
		self.view.on( 'disconnect', disconnect );
		self.view.on( 'remove', remove );
		self.view.on( 'query', queryBack );
		
		function getSettings( e ) { self.getSettings( e ); }
		function reconnect( e ) { self.reconnectNow( e ); }
		function disconnect( e ) { self.disconnectNow( e ); }
		function remove( e ) { self.remove( e ); }
		function queryBack( e ) { self.queryUserBack( e ); }
		
		self.updateMap = {};
		self.setName();
		self.setIdentity();
	}
	
	ns.BaseModule.prototype.receiveMsg = function( msg ) {
		var self = this;
		var handler = self.messageMap[ msg.type ];
		if ( !handler ) {
			console.log( 'app.BaseModule.receiveMsg - no handler for', {
				msg : msg,
				handlers : self.messageMap,
			});
			return;
		}
		
		handler( msg.data );
	}
	
	ns.BaseModule.prototype.initialize = function() {
		var self = this;
		var clientInit = {
			type : 'initclient',
			data : {
				clientId : self.clientId,
			},
		};
		
		self.send( clientInit );
	}
	
	ns.BaseModule.prototype.initializeState = function( data ) {
		var self = this;
		throw new Error( 'initializeState - baseModule, implement in module' );
	}
	
	ns.BaseModule.prototype.connection = function( state ) {
		var self = this;
		self.state = state;
		self.view.sendMessage({
			type : 'connection',
			data : state,
		});
		
		var handler = self.connectionMap[ state.type ];
		if ( !handler ) {
			console.log( 'no handler for connection event', state );
			self.clearViewInfo();
			return;
		}
		
		handler( state.data );
	}
	
	ns.BaseModule.prototype.handleConnecting = function( data ) {
		var self = this;
		//console.log( 'connecting', data );
	}
	
	ns.BaseModule.prototype.handleOnline = function( data ) {
		var self = this;
		//console.log( 'online', data );
	}
	
	ns.BaseModule.prototype.handleConnectionError = function( error ) {
		var self = this;
		var handler = self.connectionErrorMap[ error.type ];
		if ( !handler ) {
			console.log( 'no handler for connection error', error );
			return;
		}
		
		handler( error.data );
	}
	
	ns.BaseModule.prototype.handleOffline =  function( e ) {
		var self = this;
		self.viewInfo( 'offline', e );
	}
	
	ns.BaseModule.prototype.queryUser = function( type, message, value, callback ) {
		var self = this;
		self.queryCallbacks = self.queryCallbacks || {};
		var id = friendUP.tool.uid( 'query' );
		self.queryCallbacks[ id ] = callback;
		var query = {
			type : type,
			data : {
				message : message,
				value : value,
				callbackId : id,
			},
		};
		
		var wrap = {
			type : 'query',
			data : query,
		};
		self.toView( wrap );
	}
	
	ns.BaseModule.prototype.queryUserBack = function( data ) {
		var self = this;
		var callback = self.queryCallbacks[ data.callbackId ];
		if ( !callback ) {
			console.log( 'no callbak found for', data );
			return;
		}
		
		callback( data.value );
	}
	
	ns.BaseModule.prototype.clearViewInfo = function() {
		var self = this;
		self.viewInfo( 'clear' );
	}
	
	ns.BaseModule.prototype.viewInfo = function( type, data ) {
		var self = this;
		var data = {
			type : type,
			data : data,
		};
		var wrap = {
			type : 'info',
			data : data,
		};
		self.toView( wrap );
	}
	
	ns.BaseModule.prototype.showModuleInitializing = function() {
		var self = this;
		self.viewInfo( 'initializing' );
	}
	
	ns.BaseModule.prototype.remove = function() {
		var self = this;
		self.onremove();
	}
	
	ns.BaseModule.prototype.reconnectNow = function() {
		var self = this;
		var msg = {
			type : 'reconnect',
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.disconnectNow = function() {
		var self = this;
		var msg = {
			type : 'disconnect',
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.getSettings = function() {
		var self = this;
		if ( self.settingsView )
			return;
		
		var msg = {
			type : 'settings',
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.showSettings = function( settings ) {
		var self = this;
		if ( !settings )
			throw new Error( 'BaseModule.showSettings - '
				+ 'no settings object. Hint : use .getSettings()' );
			
		if ( self.settingsView )
			return;
		
		var conf = {
			type : settings.type || self.type,
			title : settings.host,
			onsave : saveHandler,
			onclose : closeHandler,
			settings : settings,
		};
		
		self.settingsView = new library.view.Settings( conf );
		
		function closeHandler() { self.settingsView = null; }
		function saveHandler( data ) { self.saveSetting( data ); }
	}
	
	ns.BaseModule.prototype.saveSetting = function( data ) {
		var self = this;
		data.clientId = self.clientId; // treeroot legacy
		var msg = {
			type : 'setting',
			data : data,
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.updateSetting = function( msg ) {
		var self = this;
		if ( self.settingsView )
			self.settingsView.saved( msg.data );
		
		var handler = self.updateMap[ msg.type ];
		if ( !handler ) {
			console.log( 'updateSetting - no handler for ', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.BaseModule.prototype.updateView = function( update ) {
		var self = this;
		var wrap = {
			type : 'update',
			data : update,
		};
		self.view.sendMessage( wrap );
	}
	
	ns.BaseModule.prototype.settingSaved = function( data ) {
		var self = this;
		self.settingsView.saved( data );
	}
	
	ns.BaseModule.prototype.getAvatar = function() {
		var self = this;
		return self.identity.avatar
			|| 'https://treeroot.org/admin/gfx/arenaicons/user_johndoe_32.png';
	}
	
	ns.BaseModule.prototype.setName = function( name ) {
		var self = this;
		self.module.name = name
			|| self.module.name
			|| self.module.displayName
			|| 'no-display-name';
	}
	
	ns.BaseModule.prototype.setIdentity = function() {
		var self = this;
		self.identity = hello.identity;
		if ( !self.identity.name )
			self.identity.name = self.identity.alias;
	}
	
	ns.BaseModule.prototype.toView = function( msg ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
	ns.BaseModule.prototype.cleanContacts = function() {
		var self = this;
		for ( id in self.contacts ) {
			callClose( id );
		}
		
		function callClose( id ) {
			self.removeContact( id );
		}
	}
	
	
	ns.BaseModule.prototype.removeContact = function( clientId ) {
		var self = this;
		if ( !clientId || !self.contacts[ clientId ]) {
			console.log( 'invalid clientId', clientId);
			return;
		}
		
		self.view.sendMessage({
			type: 'remove',
			data : clientId,
		});
		
		self.contacts[ clientId ].close();
		delete self.contacts[ clientId ];
	}
	
	ns.BaseModule.prototype.setLocalData = function( data, callback ) {
		var self = this;
		api.ApplicationStorage.setItem( self.clientId, data, setBack );
		function setBack( result ) {
			if ( result.success == false ) {
				var err = result.message || 'error';
				callback( err );
				return;
			}
			
			callback( null );
		}
	}
	
	ns.BaseModule.prototype.getLocalData = function( callback ) {
		var self = this;
		api.ApplicationStorage.getItem( self.clientId, getBack );
		function getBack( result ) {
			if ( !hasData( result.data )) {
				callback( null );
				return;
			}
			
			callback( result.data );
		}
		
		function hasData( data ) {
			if ( typeof data === 'undefined' )
				return false;
			if ( data === null )
				return false;
			
			return true;
		}
	}
	
	ns.BaseModule.prototype.clearLocalData = function( callback ) {
		var self = this;
		api.ApplicationStorage.removeItem( self.clientId, removeBack );
		function removeBack( result ) {
			if ( !result.success ) {
				var err = result.message || 'some error';
				callback( err );
				return;
			}
			
			callback( null );
		}
	}
	
	ns.BaseModule.prototype.send = function( msg ) {
		var self = this;
		self.conn.send( msg );
	}
	
	ns.BaseModule.prototype.baseClose = function() {
		var self = this;
		self.cleanContacts();
		self.conn.close();
		self.view.close();
	}
	ns.BaseModule.prototype.close = ns.BaseModule.prototype.baseClose;
	
})( library.module );


// Presence
(function( ns, undefined ) {
	ns.Presence = function( conf ) {
		if ( !( this instanceof ns.Presence ))
			return new ns.Presence( conf );
		
		var self = this;
		library.module.BaseModule.call( self, conf );
		
		self.type = 'presence';
		self.roomRequests = {};
		self.init();
	}
	
	ns.Presence.prototype = Object.create( library.module.BaseModule.prototype );
	
	// 'public'
	
	// BaseModule.reconnect
	ns.Presence.prototype.reconnect = function() {
		const self = this;
		console.log( 'Presence.reconnect' );
	}
	
	ns.Presence.prototype.create = function( identity ) {
		var self = this;
		console.log( 'Presence.create', identity );
	}
	
	ns.Presence.prototype.join = function( invite, identity ) {
		var self = this;
		console.log( 'Presence.join', {
			in : invite,
			id : identity,
		});
	}
	
	ns.Presence.prototype.leave = function( roomId ) {
		var self = this;
		console.log( 'Presence.leave', roomId );
	}
	
	// Private
	
	ns.Presence.prototype.init = function() {
		var self = this;
		if ( !self.module.settings.identity )
			self.module.settings.identity
		
		// server
		self.messageMap[ 'initialize' ] = initialize;
		self.messageMap[ 'login' ] = loginChallenge;
		self.messageMap[ 'password' ] = passChallenge;
		self.messageMap[ 'account' ] = handleAccount;
		self.messageMap[ 'identity' ] = handleIdentity;
		self.messageMap[ 'invite' ] = handleInvite;
		self.messageMap[ 'rooms' ] = setupRooms;
		self.messageMap[ 'join' ] = joinedRoom;
		self.messageMap[ 'close' ] = roomClosed;
		self.messageMap[ 'clear' ] = clear;
		
		function initialize( e ) { self.handleInitialize( e ); }
		function loginChallenge( e ) { self.loginChallenge( e ); }
		function passChallenge( e ) { self.passChallenge( e ); }
		function handleAccount( e ) { self.handleAccount( e ); }
		function handleIdentity( e ) { self.handleIdentity( e ); }
		function handleInvite( e ) { self.handleInvite( e ); }
		function setupRooms( e ) { self.setupRooms( e ); }
		function joinedRoom( e ) { self.handleJoin( e ); }
		function roomClosed( e ) { self.handleRoomClosed( e ); }
		function clear( e ) { self.clear( e ); }
		
		// view
		self.view.on( 'create', createRoom );
		
		function createRoom( e ) { self.handleCreateRoom( e ); }
		
		// lets go
		self.setup();
	}
	
	ns.Presence.prototype.setup = function() {
		var self = this;
		// register as service provider with the rtc bridge
		const serviceConf = {
			onroom      : onRoom,
			onhost      : onHost,
			onevent     : onEvent,
			onclose     : onClose,
			oninvite    : onInvite,
			onidentity  : onIdentity,
		}
		self.service = new library.component.RTCService( serviceConf );
		hello.rtc.setServiceProvider( self.service );
		
		function onRoom( e ) { self.handleServiceOnRoom( e ); }
		function onHost( e ) { return self.account.host; }
		function onEvent( e ) { self.handleServiceOnEvent( e ); }
		function onClose( e ) { self.handleServiceOnClose( e ); }
		function onInvite( e ) { self.handleServiceOnInvite( e ); }
		function onIdentity() { return self.identity; }
		
		self.sendInit();
	}
	
	ns.Presence.prototype.initialize = function( state ) {
		const self = this;
		console.log( 'Presence.initialize', state );
	}
	
	ns.Presence.prototype.handleInitialize = function() {
		const self = this;
		self.sendInit();
	}
	
	ns.Presence.prototype.sendInit = function() {
		const self = this;
		const authBundle = hello.getAuthBundle();
		const init = {
			type : 'initialize',
			data : {
				authBundle : authBundle,
				identity   : hello.identity,
			},
		};
		self.send( init );
	}
	
	ns.Presence.prototype.clear = function() {
		const self = this;
		self.cleanContacts();
		self.accountId = null
		
	}
	
	// from service
	
	ns.Presence.prototype.handleServiceOnRoom = function( event ) {
		var self = this;
		var reqId = friendUP.tool.uid( 'req' );
		var session = event.data;
		self.roomRequests[ reqId ] = {
			action  : event.type,
			session : session,
		};
		
		var roomConf = {
			req    : reqId,
			invite : session.invite || null,
			name   : null,
		}
		
		if ( 'create' === event.type ) {
			self.createRoom( roomConf );
			return;
		}
		
		if ( 'join' === event.type ) {
			self.joinRoom( roomConf );
			return;
		}
		
		console.log( 'handleServiceOnRoom - unknown event', event );
	}
	
	ns.Presence.prototype.handleServiceOnEvent = function( event ) {
		var self = this;
		console.log( 'handleServiceOnEvent', event );
	}
	
	ns.Presence.prototype.handleServiceOnClose = function( event ) {
		var self = this;
		console.log( 'handleServiceOnClose', event );
	}
	
	ns.Presence.prototype.handleServiceOnInvite = function( contact ) {
		const self = this;
		const contacts = [ contact ];
		if ( !hello.rtc.session )
			return;
		
		const roomId = hello.rtc.session.roomId;
		self.sendInvites( 'live', contacts, roomId );
	}
	
	
	// from server
	
	ns.Presence.prototype.loginChallenge = function( login ) {
		var self = this;
		if ( !login ) {
			self.setLogin();
			//self.askForAccount();
		}
		else
			self.loginInvalid( login );
	}
	
	ns.Presence.prototype.passChallenge = function( event ) {
		var self = this;
		console.log( 'passChallenge', event );
	}
	
	ns.Presence.prototype.handleAccount = function( account ) {
		var self = this;
		self.account = account;
		self.accountId = account.clientId;
		if ( account.name !== self.identity.name )
			updateName();
		
		if ( account.avatar !== self.identity.avatar )
			updateAvatar();
		
		function updateName() {
			
		}
		
		function updateAvatar() {
			
		}
		
		//self.identity.clientId = account.clientId || self.identity.clientId;
		//self.identity.name     = account.name     || self.identity.name;
		//self.identity.avatar   = account.avatar   || self.identity.avatar;
		const uptd = {
			type : 'identity',
			data : self.identity,
		};
		//self.updateView( uptd );
	}
	
	ns.Presence.prototype.handleIdentity = function( event ) {
		var self = this;
		console.log( 'presence.handleIdentity', event );
	}
	
	ns.Presence.prototype.handleInvite = function( event ) {
		var self = this;
		console.log( 'presence.handleInvite', event );
	}
	
	ns.Presence.prototype.setupRooms = function( rooms ) {
		const self = this;
		if ( !rooms )
			return;
		
		rooms.forEach( add );
		function add( room ) {
			self.addRoom( room );
		}
	}
	
	ns.Presence.prototype.handleJoin = function( conf ) {
		var self = this;
		//self.service.handle( conf );
		if ( null == conf ) {
			console.log( 'null room, end of room list', conf );
			return;
		}
		
		const room = self.addRoom( conf );
		
		// lets see if if this client sent the create/join request
		if ( conf.req && self.roomRequests[ conf.req ]) {
			self.handleRequest( conf.req, room.clientId );
		}
	}
	
	ns.Presence.prototype.handleRoomClosed = function( roomId ) {
		const self = this;
		self.removeContact( roomId );
	}
	
	ns.Presence.prototype.handleRequest = function( reqId, roomId ) {
		const self = this;
		const req = self.roomRequests[ reqId ];
		if ( !req )
			return;
		
		delete self.roomRequests[ reqId ];
		
		if ( 'create' == req.action ) {
			self.setupLiveSession( roomId, req.session );
			return;
		}
		
		// dont upgrade to live if theres no live invite ( it was jsut a room invite )
		if ( !req.session.invite || 'live' !== req.session.invite.type )
			return;
		
		self.joinLiveSession( roomId, req.session );
	}
	
	// from view
	
	ns.Presence.prototype.handleCreateRoom = function() {
		const self = this;
		self.createRoom();
	}
	
	// to server
	
	ns.Presence.prototype.toAccount = function( event ) {
		var self = this;
		if ( !self.accountId ) {
			console.log( 'Presence.toAccount - no account set', event );
			return;
		}
		
		const accEvent = {
			type : self.accountId,
			data : event,
		};
		self.send( accEvent );
	}
	
	ns.Presence.prototype.createRoom = function( conf ) {
		var self = this;
		const create = {
			type : 'create',
			data : conf,
		};
		self.toAccount( create );
	}
	
	ns.Presence.prototype.joinRoom = function( conf ) {
		var self = this;
		const roomId = conf.invite.roomId;
		if ( isInRoom( roomId )) {
			const req = self.roomRequests[ conf.req ];
			delete self.roomRequests[ conf.req ];
			rejoinLive( roomId, req.session );
			return;
		}
		
		const join = {
			type : 'join',
			data : conf,
		};
		self.toAccount( join );
		
		function isInRoom( roomId ) {
			if ( !roomId )
				return false;
			
			if ( self.contacts[ roomId ])
				return true;
			else
				return false;
		}
		
		function rejoinLive( roomId, conf ) {
			const room = self.contacts[ roomId ];
			room.joinLive( conf );
		}
	}
	
	// all the other things
	
	ns.Presence.prototype.addRoom = function( conf ) {
		const self = this;
		if ( !conf.clientId ) {
			console.log( 'addRoom - conf does not have clientId', conf );
			return;
		}
		
		let room = self.contacts[ conf.clientId ];
		if ( room ) {
			console.log( 'already initalized', conf );
			room.reconnect();
			return;
		}
		
		const host = library.tool.buildDestination(
			null,
			self.module.host,
			self.module.port
		);
		
		conf.name = conf.name || null;
		const roomConf = {
			moduleId   : self.clientId,
			room       : conf,
			parentView : self.parentView,
			host       : host,
			user       : self.identity,
			userId     : self.accountId,
		};
		room = new library.contact.PresenceRoom( roomConf );
		self.contacts[ room.clientId ] = room;
		conf.identity = room.identity;
		conf.userId = room.userId;
		
		const addRoom = {
			type : 'join',
			data : conf,
		};
		self.view.sendMessage( addRoom );
		return room;
	}
	
	ns.Presence.prototype.joinLiveSession = function( roomId, sessConf ) {
		const self = this;
		const room = self.getRoom( roomId );
		if ( !room )
			return;
		
		room.joinLive( sessConf );
	}
	
	ns.Presence.prototype.setupLiveSession = function( roomId, sessConf ) {
		const self = this;
		const room = self.contacts[ roomId ];
		if ( !room ) {
			console.log( 'Presence.setupLvieSession - no room for id', {
				rid  : roomId,
				sess : sessionConf, 
			});
			return;
		}
		
		room.joinLive( sessConf );
		if ( sessConf.contacts )
			self.sendInvites( 'live', sessConf.contacts, roomId );
	}
	
	ns.Presence.prototype.sendInvites = function( type, contacts, roomId ) {
		var self = this;
		if ( !contacts )
			return;
		
		contacts.forEach( invite );
		function invite( contact ) {
			const room = self.getRoom( roomId );
			if ( !room )
				return;
				
			room.getInviteToken( null, getBack );
			function getBack( inv ) {
				console.log( 'room.getInviteToken - back', inv );
				//const invite = self.buildInvite( type, roomId, inv.token );
				contact.invite( inv.data );
			}
		}
	}
	
	/*
	ns.Presence.prototype.buildInvite = function( type, roomId, inviteToken ) {
		var self = this;
		const host = self.module.host + ':' + self.module.port;
		var invConf = {
			type    : type || 'room',
			roomId  : roomId,
			invite  : inviteToken,
			host    : host,
			version : 2,
		};
		var bundle = {
			type    : 'live-invite',
			data    : invConf,
		};
		var invStr = hello.intercept.buildURL( bundle, true, 'live @ myplcae xoxoxo' );
		return invStr;
	}
	*/
	
	ns.Presence.prototype.setLogin = function() {
		var self = this;
		var login = {
			setting : 'login',
			value   : hello.identity.alias,
		};
		self.saveSetting( login );
	}
	
	ns.Presence.prototype.askForAccount = function() {
		var self = this;
		self.queryUser( 'account-ask', '', null, askBack );
		function askBack( res ) {
			if ( 'create' === res )
				self.createAccount();
			else
				self.getSettings();
		}
	}
	
	ns.Presence.prototype.createAccount = function() {
		var self = this;
		var login = '';
		if ( hello.identity.email )
			login = hello.identity.email;
		
		if ( !login && hello.identity.alias )
			login = hello.identity.alias;
		
		var conf = {
			host  : self.module.host,
			login : login,
		};
		
		self.queryUser( 'account-create', '', conf, loginBack );
		function loginBack( e ) {
			console.log( 'createAccount - res', e );
		}
	}
	
	ns.Presence.prototype.loginInvalid = function( login ) {
		var self = this;
	}
	
	ns.Presence.prototype.getRoom = function( roomId ) {
		var self = this;
		if ( !roomId )
			throw new Error( 'Presence.getRoom - no roomId' );
		
		const room = self.contacts[ roomId ];
		if ( !room ) {
			console.log( 'Presence.getRoom - no room for id', {
				rid   : roomId,
				rooms : self.contacts,
			});
			throw new Error( 'Presence.getRoom - no room for id' );
		}
		
		return room;
	}
	
})( library.module );


// TREEROOT
(function( ns, undefined) {
	ns.Treeroot = function( conf ) {
		if ( !( this instanceof ns.Treeroot ))
			return new ns.Treeroot( conf );
		
		var self = this;
		library.module.BaseModule.call( self, conf );
		
		self.type = 'treeroot';
		self.subscribeView = null;
		
		self.init();
	}
	
	ns.Treeroot.prototype = Object.create( library.module.BaseModule.prototype );
	
	// Public
	
	// BaseModule.reconnect
	ns.Treeroot.prototype.reconnect = function() {
		const self = this;
	}
	
	// Private
	
	
	ns.Treeroot.prototype.init = function() {
		var self = this;
		self.messageMap[ 'account' ] = updateAccount;
		self.messageMap[ 'contact' ] = contactEvent;
		self.messageMap[ 'subscription' ] = subscription;
		self.messageMap[ 'register' ] = registerResponse;
		self.messageMap[ 'userlist' ] = addUserList;
		self.messageMap[ 'keyexchange'] = keyExchangeHandler;
		self.messageMap[ 'pass-ask-auth' ] = passAskAuth;
		
		function updateAccount( e ) { self.updateAccount( e ); }
		function contactEvent( e ) { self.contactEvent( e ); }
		function subscription( e ) { self.subscription( e ); }
		function registerResponse( e ) { self.registerResponse( e ); }
		function addUserList( e ) { self.addUserList( e ); }
		function keyExchangeHandler( e ) { self.keyExchangeHandler( e ); }
		function passAskAuth( e ) { self.passAskAuth( e ); }
		
		self.connectionErrorMap = {
			'offline'      : moduleOffline,
			'host'         : hostError,
			'identity'     : invalidIdentity,
			'reconnecting' : moduleReconnecting,
			'info-missing' : moduleInfoMissing,
		};
		
		function moduleOffline( e ) { self.moduleOffline( e ); }
		function hostError( e ) { self.hostError( e ); }
		function invalidIdentity( e ) { self.invalidIdentity( e ); }
		function moduleReconnecting( e ) { self.moduleReconnecting( e ); }
		function moduleInfoMissing( e ) { self.moduleInfoMissing( e ); }
		
		self.contactEventMap = {
			'presence' : contactPresence,
			'add'      : addContact,
			'remove'   : removeContact,
		};
		
		function contactPresence( msg ) { self.contactPresence( msg ); }
		function addContact( data ) { self.addContact( data.contact ); }
		function removeContact( data ) { self.removeContact( data.clientId ); }
		
		self.updateMap = {
			'host'           : updateHost,
			'login'          : updateLogin,
			'onlyOneClient'  : updateOnlyOneClient,
			'logLimit'       : updateLogLimit,
			'msgCrypto'      : updateMessageCrypto,
			'cryptoAccepted' : updateCryptoAccepted,
		};
		
		function updateHost( e ) { self.updateHost( e ) };
		function updateLogin( e ) { self.updateLogin( e ); }
		function updateOnlyOneClient( e ) { self.updateOnlyOneClient( e ); }
		function updateLogLimit( e ) { self.updateLogLimit( e ); }
		function updateMessageCrypto( e ) { self.updateMessageCrypto( e ); }
		function updateCryptoAccepted( e ) { self.updateCryptoAccepted( e ); }
		
		self.keyExEventMap = {
			'uniqueid'     : handleUniqueId,
			'signtemppass' : signTempPass,
		};
		
		function handleUniqueId( msg ) { self.handleUniqueId( msg ); }
		function signTempPass( msg ) { self.signTempPass( msg ); }
		
		self.bindView();
		self.setupDormant();
		
		if ( self.module.login )
			self.initCrypto();
		else
			self.initialize();
	}
	
	ns.Treeroot.prototype.setIdentity = function() {
		var self = this;
		self.identity = {
			clientId : self.clientId,
			name : self.module.login,
			avatar : 'https://treeroot.org/admin/gfx/arenaicons/user_johndoe_32.png',
		};
	}
	
	ns.Treeroot.prototype.initialize = function() {
		var self = this;
		self.send({
			type : 'initialize',
		});
	}
	
	ns.Treeroot.prototype.initCrypto = function() {
		var self = this;
		self.crypt = null;
		var askUniqueId = {
			type : 'uniqueid',
		};
		self.sendKeyEx( askUniqueId );
	}
	
	ns.Treeroot.prototype.keyExchangeHandler = function( msg ) {
		var self = this;
		var handler = self.keyExEventMap[ msg.type ];
		if ( !handler ) {
			console.log( 'keyExchangeHandler - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Treeroot.prototype.handleUniqueId = function( data ) {
		var self = this;
		if ( !self.initialized )
			self.showModuleInitializing();
		
		var uniqueId = data.uniqueId;
		var storedPass = data.hashedPass || null;
		self.setupCrypto( uniqueId, storedPass, setupDone );
		function setupDone( publicKey, hashedPass ) {
			self.sendPublicKey( publicKey, hashedPass );
		}
	}
	
	ns.Treeroot.prototype.setupCrypto = function( uniqueId, hashedPass, doneBack ) {
		var self = this;
		self.crypt = null;
		if ( hashedPass )
			setupKeyPair( hashedPass );
		else
			self.askForPassphrase( passBack );
		
		function passBack( pass ) {
			var passHash = window.MD5( pass );
			setupKeyPair( passHash );
		}
		
		function setupKeyPair( pass ) {
			var seed = uniqueId + ':' + pass;
			var conf = {
				seed : seed,
			};
			self.crypt = new library.component.FCrypto( conf );
			var keys = self.crypt.getKeys();
			if ( !keys )
				throw new Error( 'huh? didnt get any crypto keys' );
			
			done( keys.pub, pass );
		}
		
		function done( pubKey, hashedPass ) {
			doneBack( pubKey, hashedPass );
		}
	}
	
	ns.Treeroot.prototype.sendPublicKey = function( publicKey, hashedPass, recoveryKey ) {
		var self = this;
		var pubKeyEvent = {
			type : 'publickey',
			data : {
				publicKey   : publicKey,
				hashedPass  : hashedPass,
				recoveryKey : recoveryKey,
			},
		};
		
		self.sendKeyEx( pubKeyEvent );
	}
	
	
	ns.Treeroot.prototype.signTempPass = function( tmpPass ) {
		var self = this;
		if ( !self.crypt )
			throw new Error( 'signTempPass - no crypto, bro' );
		
		var clearText = self.crypt.deRSA( tmpPass );
		if ( !clearText ) {
			console.log( 'failed to decrypt', tmpPass );
			self.keyExErr( 'signtemppass' );
			return;
		}
		
		var signed = self.crypt.sign( clearText );
		if ( !signed ) {
			console.log( 'could not sign temp pass?', signed );
			return;
		}
		
		var signedEvent = {
			type : 'signtemppass',
			data : signed,
		};
		
		self.sendKeyEx( signedEvent );
	}
	
	ns.Treeroot.prototype.sendKeyEx = function( msg ) {
		var self = this;
		//console.log( 'sendKeyEx', msg );
		var keyExEvent = {
			type : 'keyexchange',
			data : msg,
		};
		
		self.send( keyExEvent );
	}
	
	ns.Treeroot.prototype.keyExErr = function( step, data ) {
		var self = this;
		data = data || null;
		var err = {
			type : 'err',
			data : {
				type : step,
				data : data,
			},
		};
		self.sendKeyEx( err );
	}
	
	ns.Treeroot.prototype.askForPassphrase = function( callback ) {
		var self = this;
		if ( self.passphrase ) {
			callback( self.passphrase );
			self.passphrase = null;
			return;
		}
		
		var message = 'Passphrase is required for account '
			+ self.module.login
			+ ' on Treeroot node '
			+ self.module.host;
		var resetLink = 'https://'
			+ self.module.host
			+ '/?component=authentication&action=recover&recover='
			+ self.module.login;
		hello.log.notify( message );
		self.queryUser( 'password', message, resetLink, passBack );
		function passBack( data ) {
			callback( data );
		}
	}
	
	ns.Treeroot.prototype.moduleOffline = function( msg ) {
		var self = this;
		console.log( 'moduleOffline', msg );
	}
	
	ns.Treeroot.prototype.hostError = function( event ) {
		var self = this;
		self.queryUser( 'host',
			null,
			event,
			hostBack );
		
		function hostBack( res ) {
			if ( res.host )
				updateHost( res.host );
			else
				retryRequest();
		}
		
		function updateHost( host ) {
			var update = {
				setting : 'host',
				value : host,
			};
			self.saveSetting( update );
		}
		
		function retryRequest() {
			console.log( 'retryRequest' );
			self.reconnectNow();
		}
	}
	
	ns.Treeroot.prototype.invalidIdentity = function( msg ) {
		var self = this;
		self.queryUser( 'text', 'Identity was not found.', msg.identity, idBack );
		function idBack( identity ) {
			var update = {
				setting : 'login',
				value : identity,
			};
			self.saveSetting( update );
		}
	}
	
	ns.Treeroot.prototype.moduleReconnecting = function( msg ) {
		var self = this;
		self.viewInfo( 'reconnect' );
	}
	
	ns.Treeroot.prototype.moduleInfoMissing = function( msg ) {
		var self = this;
		self.viewInfo( 'info-missing' );
	}
	
	ns.Treeroot.prototype.bindView = function() {
		var self = this;
		self.view.on( 'status', status );
		self.view.on( 'subscribe', subscribe );
		self.view.on( 'scienceregister', scienceRegister );
		self.view.on( 'register', showRegister );
		self.view.on( 'pass-reset', passReset );
		
		function status( msg ) { console.log( 'app.treeroot.view.status', msg ); }
		function subscribe( msg ) { self.showCreateSubscription(); }
		function scienceRegister( msg ) { self.handleScienceRegister(); }
		function showRegister( msg ) { self.showRegisterForm(); }
		function passReset( e ) { self.startPassReset(); }
		
		// function saveSetting( msg ) { self.saveSetting( msg ); }
	}
	
	ns.Treeroot.prototype.initializeState = function( data ) {
		var self = this;
		if ( self.initialized ) {
			console.log( 'Treeroot.initializeState, already initialized', data );
			return;
		}
		
		self.initialized = true;
		
		self.updateModuleView();
		self.updateAccount( data );
		
		data.contacts.forEach( add );
		function add( contact ) {
			self.addContact( contact );
		}
		
		data.subscriptions.forEach( addSub );
		function addSub( sub ) {
			self.addSubscription( sub );
		}
		
		if ( self.module.settings.msgCrypto && !self.module.settings.cryptoAccepted )
			self.showCryptoWarnView();
		
	}
	
	ns.Treeroot.prototype.setupDormant = function() {
		const self = this;
		const treeroot = new api.DoorDir({
			title : 'treeroot - ' + self.module.host,
			path  : self.clientId + '/',
		}, '' );
		
		const contacts = new api.DoorDir({
			title : 'Contacts',
			path  : 'Contacts/',
		}, treeroot.fullPath );
		self.dormantParentPath = contacts.fullPath;
		
		const getIdentityFn = new api.DoorFun({
			title   : 'GetIdentity',
			execute : getIdentity,
		}, treeroot.fullPath );
		
		
		hello.dormant.addDir( treeroot );
		hello.dormant.addDir( contacts );
		hello.dormant.addFun( getIdentityFn );
		
		function getIdentity() {
			return self.identity;
		}
	}
	
	ns.Treeroot.prototype.contactEvent = function( msg ) {
		var self = this;
		var handler = self.contactEventMap[ msg.type ];
		if ( !handler ) {
			console.log( 'treeroot.contactEvent - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Treeroot.prototype.contactPresence = function( data ) {
		var self = this;
		self.view.sendMessage({
			type : 'contact',
			data : {
				type : 'presence',
				data : data,
			},
		});
		
		var contact = self.contacts[ data.clientId ];
		if ( !contact ) {
			console.log( 'treeroot.contactPresence - no contact for', data );
			return;
		}
		
		var presence = {
			level : null,
			message : contact.identity.name,
			time : data.time,
		};
		
		if ( data.value === 'online' )
			presence = setOnline( presence );
		else
			presence = setOffline( presence );
		
		contact.handleNotification( presence );
		
		function setOnline( presence ) {
			presence.level = 'positive';
			presence.message = presence.message + ' is now online';
			return presence;
		}
		
		function setOffline( presence ) {
			presence.level = 'warn';
			presence.message = presence.message + ' has gone offline';
			return presence;
		}
	}
	
	ns.Treeroot.prototype.updateHost = function( data ) {
		var self = this;
		self.module.host = data.value;
		self.setName();
		var viewUpdate = {
			type : 'module',
			data : {
				name : self.module.name,
			},
		};
		self.updateView( viewUpdate );
	}
	
	ns.Treeroot.prototype.updateLogin = function( data ) {
		var self = this;
		self.module.login = data.value;
	}
	
	ns.Treeroot.prototype.updateOnlyOneClient = function( data ) {
		var self = this;
		console.log( 'updateOnlyOneClient - NYI', data )
		return;
		self.module.settings.onlyOneClient = data.value;
	}
	
	ns.Treeroot.prototype.updateLogLimit = function( data ) {
		var self = this;
		console.log( 'module.updateLogLimit - NYI', data );
	}
	
	ns.Treeroot.prototype.updateMessageCrypto = function( data ) {
		var self = this;
		console.log( 'updateMessageCrypto', {
			s : self.module.settings.msgCrypto,
			d : data,
		});
		
		self.module.settings.msgCrypto = data.value;
		
		var contactIds = Object.keys( self.contacts );
		contactIds.forEach( update );
		function update( cId ) {
			var contact = self.contacts[ cId ];
			if ( contact.toggleEncrypt ) // subscription requests do not have this function
				contact.toggleEncrypt( data.value );
			
		}
		
		// show crypto warning?
		if ( !self.module.settings.cryptoAccepted && self.module.settings.msgCrypto )
			self.showCryptoWarnView();
	}
	
	ns.Treeroot.prototype.updateCryptoAccepted = function( update ) {
		var self = this;
		console.log( 'cryptoAccepted', update );
		self.module.settings.cryptoAccepted = update.value;
	}
	
	ns.Treeroot.prototype.showCryptoWarnView = function() {
		var self = this;
		if ( self.cryptWarnView )
			return;
		
		var conf = {
			onclose : onclose,
			onaccept : onaccept,
			initBundle : {
				host : self.module.host,
			},
		};
		self.cryptWarnView = new library.view.CryptoWarning( conf );
		
		function onclose() { self.cryptWarnView = null; }
		function onaccept( accepted ) {
			self.cryptWarnView.close();
			self.cryptWarnView = null;
			
			var updateAccepted = {
				setting : 'cryptoAccepted',
				value : accepted,
			}
			self.saveSetting( updateAccepted );
			
			if ( accepted )
				return; // msgCrypto is already enabled
			
			var updateCrypto = {
				setting : 'msgCrypto',
				value : false,
			}
			
			self.saveSetting( updateCrypto );
		}
	}
	
	ns.Treeroot.prototype.addContact = function( contact ) {
		const self = this;
		if ( !contact ) {
			var cIds = Object.keys( self.contacts );
			if ( !cIds.length && !self.nullContact ) {
				self.nullContact = true;
				self.viewInfo( 'message', Application.i18n('i18n_no_contacts') );
			}
			
			return;
		}
		
		checkAvatar( contact );
		self.nullContact = false;
		if ( self.contacts[ contact.clientId ])
			return;
		
		var conf = {
			moduleId : self.clientId,
			parentView : self.parentView,
			parentPath : self.dormantParentPath,
			contact : contact,
			msgCrypto : !!self.module.settings.msgCrypto,
			encrypt : encrypt,
			decrypt : decrypt,
		};
		
		function encrypt( e ) {
			console.log( 'module.encrypt - sender pub key', self.crypt.keys.pub );
			if ( self.crypt )
				return self.crypt.en( e );
			return e;
		}
		
		function decrypt( e ) {
			if ( self.crypt )
				return self.crypt.de( e );
			return e;
		}
		
		var contactObj = new library.contact.TreerootContact( conf );
		self.contacts[ contact.clientId ] = contactObj;
		contact.identity = contactObj.identity;
		
		self.view.sendMessage({
			type : 'contact',
			data : {
				type : 'add',
				data : contact,
			},
		});
		
		function checkAvatar( contact ) {
			if ( contact.imagePath )
				return;
				
			let host = self.module.host;
			let imgPath = 'https://' + host
			+ '/admin/gfx/arenaicons/user_johndoe_32.png';
			contact.imagePath = imgPath;
		}
	}
	
	ns.Treeroot.prototype.updateAccount = function( data ) {
		var self = this;
		if ( !data.account )
			return;
		
		var account = data.account;
		var name = account.name || self.identity.name;
		var avatar = getAvatarPath( account.imagePath );
		self.identity = {
			clientId : self.clientId,
			name : name,
			avatar : avatar,
		};
		
		self.view.sendMessage({
			type : 'account',
			data : self.identity,
		});
		
		function getAvatarPath( avatarObj ) {
			var protocol = hello.config.protocol;
			var baseUrl = protocol + self.module.host;
			var avatarPath = baseUrl + '/admin/gfx/arenaicons/user_johndoe_128.png';
			if ( avatarObj )
				avatarPath = baseUrl + '/' + avatarObj.DiskPath + avatarObj.Filename;
			avatarPath = window.decodeURI( avatarPath );
			return avatarPath;
		}
	}
	
	ns.Treeroot.prototype.updateModuleView = function( data ) {
		var self = this;
		self.view.sendMessage({
			type : 'module',
			data : self.module,
		});
	}
	
	ns.Treeroot.prototype.subscription = function( data ) {
		var self = this;
		if ( data.type == 'add' ) {
			self.addSubscription( data.data );
			return;
		}
		
		if( data.type == 'remove' ) {
			self.removeSubscription( data.data.clientId );
			return;
		}
		
		console.log( 'unknown subscription msg', msg );
	}
	
	ns.Treeroot.prototype.addSubscription = function( subscription ) {
		var self = this;
		self.nullContact = false;
		if ( self.subscribeView ) {
			var sub = { id : subscription.ID };
			self.subscribeView.remove( sub );
		}
		
		if ( self.contacts[ subscription.clientId ]) {
			console.log( 'Treeroot.addSubscription - aready exists', subscription );
			return;
		}
		
		var conf = {
			moduleId : self.clientId,
			parentView : self.parentView,
			subscriber : subscription,
		};
		
		var subObj = new library.contact.Subscriber( conf );
		self.contacts[ subscription.clientId ] = subObj;
		subscription.identity = subObj.identity;
		self.view.sendMessage({
			type : 'subscriber',
			data : subscription
		});
		
		hello.log.positive( 'Contact request: ' + ( subscription.displayName || subscription.clientId ));
	}
	
	ns.Treeroot.prototype.removeSubscription = ns.Treeroot.prototype.removeContact;
	
	ns.Treeroot.prototype.showCreateSubscription = function() {
		var self = this;
		var getUsers = {
			type : 'userlist',
		};
		self.send( getUsers );
		
		if ( self.subscribeView )
			return;
		
		self.subscribeView = new library.view.TreerootUsers({
			onsubscribe : subscribe,
			onclose : onclose,
		});
		
		function subscribe( msg ) { self.createSubscription( msg ); }
		function onclose( msg ) {
			self.subscribeView.close();
			self.subscribeView = null;
		}
	}
	
	ns.Treeroot.prototype.addUserList = function( userList ) {
		var self = this;
		if ( self.subscribeView )
			self.subscribeView.setUserList( userList );
	}
	
	ns.Treeroot.prototype.createSubscription = function( data ) {
		var self = this;
		self.send({
			type : 'subscription',
			data : {
				type : 'subscribe',
				idType : data.type,
				id : data.id,
			},
		});
		
		self.subscribeView.response({
			type : 'success',
			data : {
				message : 'request sent',
			},
		});
	}
	
	ns.Treeroot.prototype.handleScienceRegister = function() {
		var self = this;
		var user = null;
		var data = {
			Email : null,
			Username : null,
			Passphrase : null,
			Firstname : '',
			Middlename : '',
			Lastname : '',
			Gender : '',
			Image : '',
		};
		
		hello.getUserInfo( userBack );
		function userBack( fcUser ) {
			if ( !fcUser ) {
				hello.log.alert( 'Could not load userinfo, aborting' );
				hello.log.show();
				return;
			}
			
			user = new library.component.Identity( fcUser );
			setUsername();
		}
		
		function setUsername() {
			console.log( 'sci-reg, user', user );
			data.Username = user.name || user.alias;
			setEmail( emailDone );
		}
		
		function emailDone() {
			askPassphrase( passDone );
		}
		function passDone() {
			setNames();
			setGender();
			avatarDone();
			//setAvatar( avatarDone );
		}
		
		function avatarDone() {
			console.log( 'avatarDone', data );
			//return;
			
			self.register( data );
		}
		
		// very optional
		var gender = null;
		
		function setEmail( callback ) {
			if ( user.email ) {
				data.Email = user.email;
				callback();
			}
			else
				askEmail( emailBack );
			
			function askEmail( callback ) {
				self.queryUser( 'text', Application.i18n('i18n_please_provide_email'), null, callback );
			}
			function emailBack( email ) {
				data.Email = email;
				callback();
			}
		}
		
		function setNames() {
			if ( !user.name )
				return;
			
			var parts = user.name.split( ' ' );
			if ( parts.length == 1 ) {
				data.Firstname = parts.pop();
				return;
			}
			
			if ( parts.length == 2 ) {
				data.Firstname = parts[ 0 ];
				data.Lastname = parts[ 1 ];
				return;
			}
			
			data.Firstname = parts.shift();
			data.Lastname = parts.pop();
			data.Middlename = parts.join( ' ' );
		}
		
		function askPassphrase( callback ) {
			self.queryUser( 'secure', Application.i18n('i18n_please_set_passphrase'), null, passBack );
			function passBack( pass ) {
				data.Passphrase = pass;
				callback();
			}
		}
		
		function setGender() {
			data.Gender = '';
		}
		
		function setAvatar( callback ) {
			console.log( 'setAvatar' );
			var conf = {
				onimage : onimage,
				onclose : onclose,
			};
			var camView = new library.view.AddImage( conf );
			
			function onimage( data ) {
				console.log( 'onimage', data );
			}
			function onclose() {
				callback( false );
			}
			
		}
	}
	
	ns.Treeroot.prototype.showRegisterForm = function() {
		var self = this;
		if ( self.registerFormView )
			return;
		
		self.registerFormView = new library.view.ComponentForm({
			file : 'treerootRegister.html',
			windowConf : {
				title : Application.i18n('i18n_create_account'),
				width : 400,
				height : 600,
			},
			onsubmit : onSubmit,
			onclose : onClose,
		});
		
		function onSubmit( data ) {
			self.register( data );
		}
		function onClose() {
			self.registerFormView = null;
		}
	}
	
	ns.Treeroot.prototype.register = function( data ) {
		var self = this;
		self.passphrase = data.Passphrase; // hueueueuue
		var registerEvent = {
			type : 'register',
			data : data,
		};
		self.send( registerEvent );
	}
	
	ns.Treeroot.prototype.registerResponse = function( data ) {
		var self = this;
		if ( !self.registerFormView && data.success )
			return;
		
		if ( !self.registerFormView )
			self.showRegisterForm();
			
		self.registerFormView.response( data );
	}
	
	ns.Treeroot.prototype.startPassReset = function() {
		var self = this;
		var passReset = {
			type : 'pass-reset',
		};
		self.send( passReset );
	}
	
	ns.Treeroot.prototype.passAskAuth = function( data ) {
		var self = this;
		var message = Application.i18n('i18n_a_recovery_key') + ' ' + self.module.login;
		self.queryUser( 'treeroot-pass-reset', message, null, passBack );
		function passBack( qRes ) {
			var passHash = window.MD5( qRes.newPass );
			self.setupCrypto( data.uniqueId, passHash, cryptBack );
			function cryptBack( pubKey, hashedPass ) {
				self.sendPublicKey( pubKey, hashedPass, qRes.recoveryKey );
			}
		}
	}
	
	ns.Treeroot.prototype.handleGlobalState = function( status ) {
		var self = this;
		console.log( 'handle global state - NYI' );
		console.log( status );
	}
	
	ns.Treeroot.prototype.setName = function( name ) {
		var self = this;
		var host = self.module.host.split( '.' )[ 0 ];
		host = friendUP.tool.ucfirst( host );
		self.module.name = name
			|| self.module.displayName
			|| host
			|| self.type
			|| self.clientId;
	}
	
	ns.Treeroot.prototype.close = function() {
		var self = this;
		if ( self.registerFormView )
			self.registerFormView.close();
		
		self.baseClose();
	}
	
})( library.module );


// IRC
(function( ns, undefined ) {
	ns.IRC = function( conf ) {
		if ( !( this instanceof ns.IRC ))
			return new ns.IRC( conf );
		
		library.module.BaseModule.call( this, conf );
		
		var self = this;
		self.type = 'irc';
		self.consoleView = null;
		
		self.init();
	}
	
	ns.IRC.prototype = Object.create( library.module.BaseModule.prototype );
	
	// Public
	
	// BaseModule.reconnect
	ns.IRC.prototype.reconnect = function() {
		const self = this;
		console.log( 'IRC.reconnect' );
	}
	
	// Private
	
	ns.IRC.prototype.init = function() {
		var self = this;
		self.messageMap[ 'message' ] = consoleMsg;
		self.messageMap[ 'identity' ] = identityChange;
		self.messageMap[ 'join' ] = join;
		self.messageMap[ 'leave' ] = leave;
		self.messageMap[ 'private' ] = privateChat;
		self.messageMap[ 'nick' ] = nickChange;
		self.messageMap[ 'quit' ] = quit;
		self.messageMap[ 'clear' ] = clearTargets;
		self.messageMap[ 'disconnect' ] = clientDisconnect;
		
		function consoleMsg( e ) { self.consoleMessage( e ); }
		function identityChange( e ) { self.identityChange( e ); }
		function join( e ) { self.joinChannel( e ); }
		function leave( e ) { self.leftChannel( e ); }
		function privateChat( e ) { self.handlePrivateChat( e ); }
		function nickChange( e ) { self.nickChange( e ); }
		function quit( e ) { self.userQuit( e ); }
		function clearTargets( e ) {
			console.log( 'clearTargets', e );
			self.cleanContacts();
		}
		function clientDisconnect( e ) { self.clientDisconnect( e ); }
		
		self.connectionErrorMap = {
			'connerror'  : connError,
			'hostnotset' : hostNotSet,
			'nicknotset' : nickNotSet,
		};
		
		function connError( e ) { self.connError( e ); }
		function hostNotSet( e ) { self.hostNotSet( e ); }
		function nickNotSet( e ) { self.nickNotSet( e ); }
		
		self.updateMap = {
			nick        : updateNick,
			awayNick    : updateAwayNick,
			displayName : updateDisplayName,
			ircTheme    : updateIrcTheme,
			connect     : updateConnect,
		};
		
		function updateNick( e ) { self.updateNick( e ); }
		function updateAwayNick( e ) { self.updateAwayNick( e ); }
		function updateDisplayName( e ) { self.updateDisplayName( e ); }
		function updateIrcTheme( e ) { self.updateIrcTheme( e ); }
		function updateConnect( e ) { self.updateConnect( e ); }
		
		self.bindView();
		self.initialize();
	}
	
	ns.IRC.prototype.handleConnecting = function() {
		var self = this;
		if ( !self.initialized )
			self.showModuleInitializing();
	}
	
	ns.IRC.prototype.handleOnline = function() {
		var self = this;
		self.clearViewInfo();
	}
	
	ns.IRC.prototype.setIdentity = function() {
		var self = this;
		self.identity = {
			name : self.module.settings.nick,
			avatar : library.component.Identity.prototype.avatar,
		};
	}
	
	ns.IRC.prototype.initializeState = function( data ) {
		var self = this;
		if ( self.initialized )
			return;
		
		self.initialized = true;
		if ( data.identity ) {
			self.identity.name = data.identity.name;
		}
		
		// update view with user name
		var viewUpdate = {
			type : 'identity',
			data : self.identity,
		};
		self.updateView( viewUpdate );
		
		// set up joined channels and active privmsg
		self.cleanContacts();
		data.targets.forEach( createTarget );
		function createTarget( target ) {
			if ( target.type == 'channel' )
				self.joinChannel( target );
			else
				self.createPrivateChat( target );
		}
	}
	
	ns.IRC.prototype.bindView = function() {
		var self = this;
		self.view.on( 'console', toggleConsole );
		self.view.on( 'reconnect', reconnectClick );
		self.view.on( 'disconnect', disconnectClick );
		self.view.on( 'leave', leaveClick );
		
		function toggleConsole( msg ) { self.toggleConsole( msg ); }
		function reconnectClick( msg ) { self.optionReconnect( msg ); }
		function disconnectClick( msg ) { self.optionDisconnect( msg ); }
		function leaveClick( msg ) { self.leaveChannel( msg ); }
	}
	
	ns.IRC.prototype.toggleConsole =function( data ) {
		var self = this;
		if ( self.consoleView )
			self.consoleView.close();
		else
			openConsole();
		
		function openConsole() {
			var conf = {
				message : sendMessage,
				onclose : cleanup,
			};
			self.consoleView = new library.view.Console( conf );
		}
		
		function sendMessage( msg ) {
			self.send( msg );
		}
		
		function cleanup() {
			self.consoleView = null;
		}
	}
	
	ns.IRC.prototype.consoleMessage = function( msg ) {
		var self = this;
		if ( msg.type === 'error' ) {
			self.setConsoleError( msg );
			return;
		}
		
		if ( msg.type === 'notification' ) {
			self.setConsoleNotification( msg );
			return;
		}
		
		self.toConsole( msg );
	}
	
	ns.IRC.prototype.toConsole = function( msg ) {
		var self = this;
		if ( !self.consoleView )
			return;
		
		self.consoleView.sendMessage( msg );
	}
	
	ns.IRC.prototype.setConsoleError = function( msg ) {
		var self = this;
		self.toConsole( msg )
	}
	
	ns.IRC.prototype.setConsoleNotification = function( msg ) {
		var self = this;
		self.toConsole( msg );
	}
	
	ns.IRC.prototype.connError = function( data ) {
		var self = this;
		self.clearState();
	}
	
	ns.IRC.prototype.hostNotSet = function( msg ) {
		var self = this;
		self.queryUser( 'text', Application.i18n('i18n_please_set_a_host'), null, queryBack );
		function queryBack( host ) {
			var update = {
				setting : 'host',
				value : host,
			};
			self.saveSetting( update );
		}
	}
	
	ns.IRC.prototype.nickNotSet = function( msg ) {
		var self = this;
		self.queryUser( 'text', Application.i18n('i18n_please_set_a_nick'), null, queryBack );
		function queryBack( nick ) {
			var update = {
				setting : 'nick',
				value : nick,
			};
			self.saveSetting( update );
		}
	}
	
	ns.IRC.prototype.updateNick = function( data ) {
		var self = this;
		self.module.settings.nick = data.value;
	}
	
	ns.IRC.prototype.updateAwayNick = function( data ) {
		var self = this;
		self.module.settings.awayNick = data.value;
	}
	
	ns.IRC.prototype.updateDisplayName = function( update ) {
		var self = this;
		self.module.name = update.value;
		var viewUpdate = {
			type : 'module',
			data : self.module,
		};
		
		self.updateView( viewUpdate );
	}
	
	ns.IRC.prototype.updateIrcTheme = function( update ) {
		var self = this;
		self.module.settings.ircTheme = update.value;
		var msg = {
			type : 'viewtheme',
			data : update.value,
		};
		self.toAll( msg );
	}
	
	ns.IRC.prototype.updateConnect = function( msg ) {
		var self = this;
		self.module.settings.connect = msg.value;
	}
	
	ns.IRC.prototype.joinChannel = function( channel ) {
		var self = this;
		var chanObj = self.contacts[ channel.clientId ];
		if ( chanObj ) {
			console.log( 'joinChannel - arealy in channel', channel );
			return;
			//self.removeContact( channel.clientId );
			//chanObj = null;
		}
		
		var conf = {
			moduleId : self.clientId,
			parentView : self.parentView,
			user : self.identity,
			channel : channel,
			viewTheme : self.module.settings.ircTheme,
		};
		
		var chanObj = new library.contact.IrcChannel( conf );
		self.contacts[ channel.clientId ] = chanObj;
		channel.identity = chanObj.room;
		self.view.sendMessage({
			type : 'join',
			data : channel,
		});
		
		// check autoshow channel
		var settings = self.module.settings;
		if ( settings.connect && settings.connect.autoshow )
			chanObj.showChannel();
		
		return chanObj;
	}
	
	ns.IRC.prototype.leftChannel = function( data ) {
		var self = this;
		console.log( 'IRC.leftChannel', data );
		var channel = self.contacts[ data.clientId ];
		if ( !channel )
			return;
		
		self.toView({
			type : 'leave',
			data : channel.clientId,
		});
		channel.close();
		delete self.contacts[ channel.clientId ];
	}
	
	ns.IRC.prototype.nickChange = function( data ) {
		var self = this;
		self.toAll({
			type : 'nick',
			data : data,
		});
	}
	
	ns.IRC.prototype.identityChange = function( data ) {
		var self = this;
		self.identity.name = data.name;
		var idUpdate = {
			type : 'identity',
			data : self.identity,
		};
		
		self.updateView( idUpdate );
		idUpdate.type = 'user';
		self.toAll( idUpdate );
	}
	
	ns.IRC.prototype.userQuit = function( data ) {
		var self = this;
		self.toAllChannels({
			type : 'quit',
			data : data,
		});
	}
	
	ns.IRC.prototype.openPrivate = function( nick ) {
		var self = this;
		var contact = getPrivate( nick );
		if ( contact ) {
			contact.startChat();
			return;
		}
		
		var open = {
			type : 'open',
			data : nick,
		};
		self.sendPrivate( open );
		
		function getPrivate( nick ) {
			for ( var key in self.contacts ) {
				var contact = checkContact( key );
				if ( contact )
					return contact;
			}
			
			return false;
			
			function checkContact( key ) {
				var contact = self.contacts[ key ];
				if ( !( contact instanceof library.contact.IrcPrivMsg ))
					return false;
				
				if ( contact.identity.name === nick )
					return contact;
				return false;
			}
		}
	}
	
	ns.IRC.prototype.removePrivate = function( nick ) {
		var self = this;
		var remove = {
			type : 'remove',
			data : nick,
		};
		self.sendPrivate( remove );
	}
	
	ns.IRC.prototype.sendPrivate = function( action ) {
		var self = this;
		var priv = {
			type : 'private',
			data : action,
		};
		self.send( priv );
	}
	
	ns.IRC.prototype.handlePrivateChat = function( msg ) {
		var self = this;
		if ( msg.type === 'open' ) {
			self.createPrivateChat( msg.data.target, msg.data.forceOpen );
			return;
		}
		
		if ( msg.type === 'remove' ) {
			self.removeContact( msg.data );
			return;
		}
		
		console.log( 'handlePrivateChat - unknown event', msg );
	}
	
	ns.IRC.prototype.createPrivateChat = function( contact, forceOpen ) {
		var self = this;
		var conf = {
			moduleId : self.clientId,
			parentView : self.parentView,
			contact : contact,
			user : self.identity,
			viewTheme : self.module.settings.ircTheme,
		};
		
		var privObj = new library.contact.IrcPrivMsg( conf );
		self.contacts[ contact.clientId ] = privObj;
		contact.identity = privObj.identity;
		self.view.sendMessage({
			type : 'private',
			data : contact,
		});
		
		if ( forceOpen ) {
			privObj.startChat();
		}
	}
	
	ns.IRC.prototype.toAllChannels = function( msg ) {
		var self = this;
		var allChan = self.getContactsByType( 'IrcChannel' );
		self.sendToContacts( allChan, msg );
		
	}
	
	ns.IRC.prototype.toAllPrivMsg = function( msg ) {
		var self = this;
		var allPriv = self.getContactsByType( 'IrcPrivMsg' );
		self.sendToContacts( allPriv, msg );
	}
	
	ns.IRC.prototype.toAll = function( msg ) {
		var self = this;
		var ids = Object.keys( self.contacts );
		self.sendToContacts( ids, msg );
	}
	
	ns.IRC.prototype.getContactsByType = function( type ) {
		var self = this;
		var allIds = Object.keys( self.contacts );
		var ofType = allIds.filter( checkType );
		return ofType;
		
		function checkType( id ) {
			var contact = self.contacts[ id ];
			return !!( contact instanceof library.contact[ type ]);
		}
	}
	
	ns.IRC.prototype.sendToContacts = function( ids, msg ) {
		var self = this;
		ids.forEach( sendTo );
		function sendTo( id ) {
			var contact = self.contacts[ id ];
			if ( !contact )
				return;
			
			contact.receiveMsg( msg );
		}
	}
	
	ns.IRC.prototype.clientDisconnect = function( msg ) {
		var self = this;
		console.log( 'clientDisconnect', msg );
		self.cleanContacts();
	}
	
	ns.IRC.prototype.optionReconnect = function() {
		var self = this;
		const msg = {
			type : 'reconnect',
			data : {
				quitMessage : 'brb',
			},
		};
		self.send( msg );
	}
	
	ns.IRC.prototype.optionDisconnect = function() {
		var self = this;
		const msg = {
			type : 'disconnect',
			data : {
				quitMessage : 'bye',
			},
		};
		self.send( msg );
	}
	
	ns.IRC.prototype.leaveChannel = function( msg ) {
		var self = this;
		console.log( 'IRC.leaveChannel', msg );
	}
	
	ns.IRC.prototype.sendCommand = function( msg, source ) {
		var self = this;
		source = source || '';
		var cmd = {
			type : 'command',
			data : msg,
		};
		
		self.send( cmd );
	}
	
	ns.IRC.prototype.sendMessage = function( msg ) {
		var self = this;
		var wrap = {
			type : 'message',
			data : msg,
		};
		self.send( wrap );
	}
	
	ns.IRC.prototype.clearState = function( msg ) {
		var self = this;
		console.log( 'clearState', msg );
		self.cleanContacts();
	}
	
	ns.IRC.prototype.closeViews = function() {
		var self = this;
		if ( self.consoleView )
			self.consoleView.close();
		if ( self.settingsView )
			self.settingsView.close();
	}
	
	ns.IRC.prototype.close = function() {
		var self = this;
		self.closeViews();
		self.baseClose();
	}
	
})( library.module );

// FACEHUG
(function( ns, undefined ) {
	ns.Facebook = function( conf ) {
		if ( !( this instanceof ns.Facebook ))
			return new ns.Facebook( conf );
		
		var self = this;
		
		library.module.BaseModule.call( self, conf );
		
		self.init();
	}
	
	ns.Facebook.prototype = Object.create( library.module.BaseModule.prototype );
	
	ns.Facebook.prototype.init = function() {
		var self = this;
		console.log( 'app.module.Facebook.init' );
	}
	
})( library.module );

// PHMODULE
(function( ns, undefined ) {
	ns.PHModule = function( conf ) {
		if ( !( this instanceof ns.PHModule ))
			return new ns.PHModule( conf );
		
		var self = this;
		library.module.BaseModule.call( self, conf );
		
		self.init();
	}
	
	ns.PHModule.prototype = Object.create( library.module.BaseModule.prototype );
	
	ns.PHModule.prototype.init = function() {
		var self = this;
		console.log( 'app.module.PHModule.init' );
	};
	
})( library.module );

