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
	ns.BaseModule = function( conf, activity, onremove ) {
		if ( !( this instanceof ns.BaseModule ))
			return new ns.BaseModule( conf );
		
		const self = this;
		self.module = conf.module;
		self.parentView = conf.parentView;
		self.clientId = self.module.clientId;
		self.activity = activity;
		self.onremove = onremove;
		
		self.isOnline = false;
		
		self.identity = null;
		self.rooms = {};
		self.roomIds = [];
		self.contacts = {};
		self.contactIds = [];
		self.eventQueue = [];
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
	
	// called by module control when the app comes out of background
	ns.BaseModule.prototype.appResume = function() {
		console.log( 'BaseModule.appResume - implement in module' );
		throw new Error( '^^^ BaseModule.appResume() - implement in module' );
	}
	
	ns.BaseModule.prototype.setOnline = function( isOnline ) {
		const self = this;
		if ( isOnline === self.isOnline )
			return;
		
		self.isOnline = isOnline;
	}
	
	ns.BaseModule.prototype.getOnlineStatus = function() {
		const self = this;
		return self.isOnline;
	}
	
	// Tells the module there has been a disconnect/reconenct and that it should 
	// reconnect / sync to its server side component
	ns.BaseModule.prototype.reconnect = function() {
		console.log( 'BaseModule.reconnect() - implement in module', self );
		throw new Error( '^^^ BaseModule.reconnect() - implement in module' );
	}
	
	/* search()
	must return a object:
	{
		source : <string> - name of source,
		pools  : <array> - list of promises that resolve into search pools
	}
	
	a search pool is a list of objects
	each item in the resolved search pool is an object:
	{
		id         : <id-string>
		type       : 'contact' | 'room'
		isRelation : <bool> - is in friend / room list
		name       : <string>
		email      : <string> - optional
		alias      : <string> - nick / login name, optional
		avatar     : <image resource> - optional
		isOnline   : <bool> - optional
	}
	
	*/
	ns.BaseModule.prototype.search = function( searchStr ) {
		console.log( 'BaseModule.search() - implement in module' , self );
		throw new Error( '^^^ BaseModule.search() - implement in module' );
	}
	
	ns.BaseModule.prototype.updateAvatar = function( avatar ) {
		const self = this;
		//console.log( 'BaseModule.updateAvatar() - implement in module to handle', avatar );
	}
	
	/*
		takes a id<uuid string> and returns a promise
		that resolves to a identity object
	*/
	ns.BaseModule.prototype.getIdentity = async function( clientId ) {
		throw new Error( 'BaseModule.getIdentity - implement in module' );
	}
	
	/*
		this function is called by the Activity subsystem during startup
		clientIdList is all current items registered in Activity by this module
		The module should check the list for stale entries and call Activity.remove( <cId> )
		for each one.
	*/
	ns.BaseModule.prototype.verifyActivities = function( clientIdList ) {
		throw new Error( 'BaseModule.verifyActivities - implement in module' );
	}
	
	// Private
	
	ns.BaseModule.prototype.initBaseModule = function() {
		const self = this;
		// server stuff
		self.conn = new library.component.RequestNode(
			self.clientId,
			hello.conn,
			eventSink,
			null,
		);
		
		function eventSink( type, data ) {
			/*
			console.log( 'BaseModule - conn eventSink', {
				type : type,
				data : data,
			});
			*/
		}
		
		/*
		self.requests = new library.component.RequestNode(
			self.conn,
			reqSink
		);
		*/
		
		function reqSink() { console.log( 'reqSink', arguments ); }
		
		self.conn.on( 'initstate', initState );
		self.conn.on( 'connection', connection );
		self.conn.on( 'settings', showSettings );
		self.conn.on( 'setting', updateSetting );
		
		function initState( msg ) { self.initializeState( msg ); }
		function connection( msg ) { self.connection( msg ); }
		function showSettings( msg ) { self.showSettings( msg ); }
		function updateSetting( msg ) { self.updateSetting( msg ); }
		
		self.connectionMap = {
			'connecting' : e => self.handleConnecting( e ),
			'open'       : e => self.handleConnOpen( e ),
			'online'     : e => self.handleOnline( e ),
			'error'      : e => self.handleConnectionError( e ),
			'offline'    : e => self.handleOffline( e ),
		};
		self.connectionErrorMap = {};
		
		// view stuff
		/*
		self.view = new library.component.SubView({
			parent : self.parentView,
			type   : self.clientId,
		});
		*/
		self.view = new library.component.EventNode(
			self.clientId,
			self.parentView,
			viewSink,
		);
		
		function viewSink( ...args ) {
			self.viewSink( ...args );
		}
		
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
	
	ns.BaseModule.prototype.viewSink = function( type, data ) {
		const self = this;
		/*
		console.log( 'BaseModule.viewSink', {
			type : type,
			data : data,
		});
		*/
	}
	
	ns.BaseModule.prototype.initialize = function() {
		const self = this;
		var clientInit = {
			type : 'initclient',
			data : {
				clientId : self.clientId,
			},
		};
		
		self.send( clientInit );
	}
	
	ns.BaseModule.prototype.initializeState = function( data ) {
		const self = this;
		throw new Error( 'initializeState - baseModule, implement in module' );
	}
	
	ns.BaseModule.prototype.queueEvent = function( handlerName, argumentList ) {
		const self = this;
		const queueItem = {
			type : handlerName,
			data : argumentList,
		};
		self.eventQueue.push( queueItem );
	}
	
	ns.BaseModule.prototype.flushQueue = function() {
		const self = this;
		self.eventQueue.forEach( dispatch );
		self.eventQueue = [];
		
		function dispatch( item ) {
			const fnName = item.type;
			const args = item.data;
			const handler = self[ fnName ];
			if ( !handler ) {
				console.log( 'BaseModule.flushQueue - no handler found for', item );
				return;
			}
			
			handler.apply( self, args );
		}
	}
	
	ns.BaseModule.prototype.connection = function( state ) {
		const self = this;
		self.state = state;
		self.view.send({
			type : 'connection',
			data : state,
		});
		
		const handler = self.connectionMap[ state.type ];
		if ( !handler ) {
			//console.log( 'no handler for connection event', state );
			self.clearViewInfo();
			return;
		}
		
		handler( state.data );
	}
	
	ns.BaseModule.prototype.handleConnecting = function( data ) {
		const self = this;
		//console.log( 'connecting', data );
	}
	
	ns.BaseModule.prototype.handleConnOpen = function( data ) {
		const self = this;
		//console.log( 'handleConnOpen', data );
	}
	
	ns.BaseModule.prototype.handleOnline = function( data ) {
		const self = this;
		//console.log( 'online', data );
	}
	
	ns.BaseModule.prototype.handleConnectionError = function( error ) {
		const self = this;
		self.isOnline = false;
		var handler = self.connectionErrorMap[ error.type ];
		if ( !handler ) {
			//console.log( 'no handler for connection error', error );
			return;
		}
		
		handler( error.data );
	}
	
	ns.BaseModule.prototype.handleOffline =  function( e ) {
		const self = this;
		self.isOnline = false;
		self.viewInfo( 'offline', e );
	}
	
	ns.BaseModule.prototype.queryUser = function( type, message, value, callback ) {
		const self = this;
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
		const self = this;
		var callback = self.queryCallbacks[ data.callbackId ];
		if ( !callback ) {
			//console.log( 'no callbak found for', data );
			return;
		}
		
		callback( data.value );
	}
	
	ns.BaseModule.prototype.clearViewInfo = function() {
		const self = this;
		self.viewInfo( 'clear' );
	}
	
	ns.BaseModule.prototype.viewInfo = function( type, data ) {
		const self = this;
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
		const self = this;
		self.viewInfo( 'initializing' );
	}
	
	ns.BaseModule.prototype.remove = function() {
		const self = this;
		self.onremove();
	}
	
	ns.BaseModule.prototype.reconnectNow = function() {
		const self = this;
		self.initialized = false;
		var msg = {
			type : 'reconnect',
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.disconnectNow = function() {
		const self = this;
		self.initialized = false;
		var msg = {
			type : 'disconnect',
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.getSettings = function() {
		const self = this;
		if ( self.settingsView )
			return;
		
		var msg = {
			type : 'settings',
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.showSettings = function( settings ) {
		const self = this;
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
		const self = this;
		data.clientId = self.clientId; // treeroot legacy
		var msg = {
			type : 'setting',
			data : data,
		};
		self.send( msg );
	}
	
	ns.BaseModule.prototype.updateSetting = function( msg ) {
		const self = this;
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
		const self = this;
		var wrap = {
			type : 'update',
			data : update,
		};
		self.view.send( wrap );
	}
	
	ns.BaseModule.prototype.settingSaved = function( data ) {
		const self = this;
		self.settingsView.saved( data );
	}
	
	ns.BaseModule.prototype.getAvatar = function() {
		const self = this;
		return self.identity.avatar
			|| 'https://treeroot.org/admin/gfx/arenaicons/user_johndoe_32.png';
	}
	
	ns.BaseModule.prototype.setName = function( name ) {
		const self = this;
		self.module.name = name
			|| self.module.name
			|| self.module.displayName
			|| 'no-display-name';
	}
	
	ns.BaseModule.prototype.setIdentity = function( id ) {
		const self = this;
		self.identity = id || {};
		self.identity.avatar = '';
		if ( !self.identity.name )
			self.identity.name = self.identity.alias;
	}
	
	ns.BaseModule.prototype.toView = function( msg ) {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.send( msg );
	}
	
	ns.BaseModule.prototype.cleanContacts = function() {
		const self = this;
		const ids = Object.keys( self.contacts );
		ids.forEach( id => self.removeContact( id ));
	}
	
	ns.BaseModule.prototype.cleanRooms = function() {
		const self = this;
		const ids = Object.keys( self.rooms );
		ids.forEach( id => self.removeRoom( id ));
	}
	
	ns.BaseModule.prototype.removeContact = function( clientId ) {
		const self = this;
		const contact = self.contacts[ clientId ];
		if ( !contact )
			return;
		
		self.view.send({
			type : 'remove',
			data : clientId,
		});
		
		delete self.contacts[ clientId ];
		self.contactIds = Object.keys( self.contacts );
		if ( contact.close )
			contact.close();
	}
	
	ns.BaseModule.prototype.removeRoom = function( clientId ) {
		const self = this;
		const room = self.rooms[ clientId ];
		if ( !room )
			return;
		
		self.view.send({
			type : 'room-remove',
			data : clientId,
		});
		delete self.rooms[ clientId ];
		self.roomIds = Object.keys( self.rooms );
		if ( room.close )
			room.close();
		
		if ( self.activity )
			self.activity.remove( clientId );
		
		if ( self.service && hello.dormant ) {
			self.service.emitEvent( 'roomRemove', { roomId : clientId });
		}
	}
	
	ns.BaseModule.prototype.setLocalData = function( data, callback ) {
		const self = this;
		api.ApplicationStorage.setItem( self.clientId, data )
			.then( setBack )
			.catch( e => {
				console.log( 'BaseModule.setLocalData - applicationStorage uncaught error', e );
			});
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
		const self = this;
		api.ApplicationStorage.getItem( self.clientId )
			.then( getBack )
			.catch( e => {
				console.log( 'BaseModule.getLocalData - applicationStorage uncaught error', e );
			});
		
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
		const self = this;
		api.ApplicationStorage.removeItem( self.clientId )
			.then( removeBack )
			.catch( e => {
				console.log( 'BaseModule.clearLocalData - applicationStorage uncaught error', e );
			});
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
		const self = this;
		self.conn.send( msg );
	}
	
	ns.BaseModule.prototype.baseClose = function() {
		const self = this;
		delete self.activity;
		self.cleanContacts();
		self.cleanRooms();
		self.conn.close();
		self.view.close();
	}
	
	ns.BaseModule.prototype.close = ns.BaseModule.prototype.baseClose;
	
})( library.module );


// Presence
(function( ns, undefined ) {
	ns.Presence = function( ...args ) {
		const self = this;
		library.module.BaseModule.call( self, ...args );
		
		self.type = 'presence';
		self.roomRequests = {};
		self.hiddenContacts = {};
		self.getIdentityBacklog = {};
		self.contactLoading = {};
		self.roomLoading = {};
		self.contactsOnline = [];
		self.currentFilter = 'relations';
		self.invites = {};
		
		self.init();
	}
	
	ns.Presence.prototype = Object.create( library.module.BaseModule.prototype );
	
	// Public
	
	ns.Presence.prototype.reconnect = function() {
		const self = this;
		self.isOnline = false;
		self.initialized = false;
		self.sendModuleInit();
	}
	
	ns.Presence.prototype.appResume = function() {
		const self = this;
		self.reconnect();
	}
	
	ns.Presence.prototype.setIsLive = function( isLive ) {
		const self = this
		self.roomIds.forEach( rId => {
			const room = self.rooms[ rId ]
			room.setLiveAllowed( !isLive )
		})
		self.contactIds.forEach( cId => {
			const contact = self.contacts[ cId ]
			contact.setLiveAllowed( !isLive );
		})
	}
	
	ns.Presence.prototype.listRoomsDormant = function() {
		const self = this;
		const rIds = Object.keys( self.rooms );
		return rIds.map( rId => {
			return self.rooms[ rId ].getInfo();
		});
	}
	
	ns.Presence.prototype.showInviterFor = async function( roomId, conf ) {
		const self = this;
		const room = await self.getRoom( roomId )
		if ( null == room )
			throw 'ERR_NO_ROOM'
		
		room.showInviter()
		return true
	}
	
	ns.Presence.prototype.openRoomSettings = async function( roomId ) {
		const self = this
		const room = await self.getRoom( roomId )
		if ( null == room )
			throw 'ERR_NO_ROOM'
		
		room.loadSettings()
		return true
	}
	
	ns.Presence.prototype.getIdentity = async function( clientId ) {
		const self = this
		let id = await self.lookupIdentity( clientId )
		if ( null != id )
			return id
		
		id = await waitFor( clientId );
		if ( null == id ) {
			throw 'ERR_NO_ID'
		}
		
		return id
		
		function waitFor( cId ) {
			return new Promise(( resolve, reject ) => {
				let waiters = self.getIdentityBacklog[ cId ];
				if ( null == waiters ) {
					waiters = {
						timeout : null,
						list    : [],
					};
					waiters.timeout = window.setTimeout( noIdFound, 1000 * 20 );
					self.getIdentityBacklog[ cId ] = waiters;
				}
				
				waiters.list.push( resolveIdentity );
				function resolveIdentity( id ) {
					if ( !id )
						resolve( null );
					else
						resolve( id );
				}
				
				function noIdFound() {
					const waiters = self.getIdentityBacklog[ cId ];
					if ( !waiters )
						return;
					
					waiters.list.forEach( fun => {
						fun( null );
					});
				}
			});
		}
	}
	
	ns.Presence.prototype.getRoomMeta = async function( roomId ) {
		const self = this;
		const room = self.getLocalChat( roomId );
		if ( null == room )
			throw 'ERR_NO_ROOM';
		
		const meta = await room.getMeta();
		return meta;
	}
	
	ns.Presence.prototype.verifyActivities = async function( cIdList ) {
		const self = this;
		if ( !self.isOnline )
			return;
		
		const removers = cIdList.map( cId => {
			const item = self.getLocalChat( cId );
			if ( null != item )
				return null;
			
			const invite = self.invites[ cId ];
			if ( null != invite )
				return null;
			
			// returns a promise
			return self.activity.remove( cId );
		}).filter( r => null != r );
		
		if ( !removers.length )
			return;
		
		await Promise.all( removers );
	}
	
	ns.Presence.prototype.updateAvatar = function( avatar ) {
		const self = this;
		if ( !self.initialized )
			return;
		
		const ava = {
			type : 'avatar',
			data : {
				avatar : avatar,
			},
		};
		self.toAccount( ava );
	}
	
	ns.Presence.prototype.setAccountSetting = async function( key, value ) {
		const self = this;
		const req = {
			type : 'account-settings-set',
			data : {
				key   : key,
				value : value,
			},
		};
		const res = await self.acc.request( req );
		return res;
	}
	
	ns.Presence.prototype.search = function( searchStr ) {
		const self = this;
		const filter = new library.component.Filter();
		const results = [
			getRooms( searchStr ),
			getFromServer( searchStr ),
			getContacts( searchStr ),
		];
		
		return {
			source  : 'Presence',
			results : results,
		};
		
		async function getRooms( searchStr ) {
			let items = Object.keys( self.rooms )
				.map( build );
				
			items = filter.filter( searchStr, items );
			const res = {
				type    : 'rooms',
				actions : [
					'open-chat',
					'live-audio',
					'live-video',
				],
				pool    : items,
			};
			
			return res;
			
			function build( rId ) {
				let room = self.rooms[ rId ];
				let item = {
					id         : room.clientId,
					type       : 'room',
					isRelation : true,
					name       : room.identity.name,
					avatar     : room.identity.avatar,
				};
				return item;
			}
		}
		
		async function getContacts( searchStr ) {
			let items = Object.keys( self.contacts )
				.map( build );
			
			items = filter.filter( searchStr, items );
			const res = {
				type    : 'personal',
				actions : [
					'open-chat',
					'live-audio',
					'live-video',
				],
				pool    : items,
			};
			
			return res;
			
			function build( cId ) {
				let con = self.getLocalChat( cId );
				let item = {
					id         : con.clientId,
					type       : 'contact',
					isRelation : true,
					name       : con.identity.name,
					avatar     : con.identity.avatar,
					isOnline   : con.identity.isOnline,
				};
				return item;
			}
		}
		
		async function getFromServer( searchStr ) {
			const req = {
				type : 'search-user',
				data : {
					needle : searchStr,
				},
			};
			let ids = null;
			try {
				ids = await self.acc.request( req );
			} catch( ex ) {
				console.log( 'Presence.search getContacts, request error', ex );
				return null;
			}
			
			ids = ids.filter( removeContacts );
			const items = ids.map( build );
			
			const res = {
				type    : 'contact / global',
				actions : [
					'open-chat',
				],
				pool    : items,
			};
			
			return res;
			
			function removeContacts( id ) {
				const cId = id.clientId;
				const contact = self.contacts[ cId ];
				return !contact;
			}
			
			function build( id ) {
				let item = {
					id         : id.clientId,
					type       : 'contact',
					isRelation : true,
					name       : id.name,
					avatar     : id.avatar,
					isOnline   : id.isOnline,
				};
				return item;
			}
		}
	}
	
	ns.Presence.prototype.getFriendContact = function( friendId ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const getFC = {
				friendId : friendId,
			};
			const req = {
				type : 'friend-get',
				data : getFC,
			};
			self.acc.request( req )
				.then( resolve )
				.catch( reject );
		});
	}
	
	ns.Presence.prototype.addContact = async function( clientId ) {
		const self = this;
		if ( self.contacts[ clientId ]) {
			return clientId;
		}
		
		const loader = self.contactLoading[ clientId ];
		if ( null != loader ) {
			await self.waitForChat( 'contact', clientId );
			return clientId;
		}
		
		const req = {
			type : 'relation-add',
			data : {
				clientId : clientId,
			},
		};
		
		let cId = null;
		try {
			cId = await self.acc.request( req )
		} catch( ex ) {
			console.log( 'Presence.addContact - add ex', ex );
			return null;
		}
		
		if ( null == cId )
			return null;
		
		await self.waitForChat( 'contact', cId );
		return cId;
	}
	
	ns.Presence.prototype.getRoomSync = function( roomId ) {
		const self = this;
		if ( !roomId )
			throw new Error( 'Presence.getRoomSync - no roomId' );
		
		const room = self.rooms[ roomId ];
		if ( null == room )
			return null;
		
		return room;
	}
	
	ns.Presence.prototype.getContact = async function( clientId ) {
		const self = this;
		const loader = self.contactLoading[ clientId ];
		if ( null != loader )
			return await self.waitForChat( 'contact', clientId );
		
		let contact = self.getLocalChat( clientId );
		if ( null == contact )
			contact = await addContact( clientId );
		
		return contact;
		
		async function addContact( cId ) {
			let addedId = null;
			try {
				addedId = await self.addContact( clientId );
			} catch( ex ) {
				console.log( 'Presence.getContact, addContact ex', ex );
				return null;
			}
			
			return self.getLocalChat( clientId );
		}
	}
	
	ns.Presence.prototype.getRoom = async function( clientId ) {
		const self = this;
		const loader = self.roomLoading[ clientId ];
		if ( null != loader )
			return await self.waitForChat( 'room', clientId );
		
		let room = self.getRoomSync( clientId );
		if ( null == room )
			room = await self.waitForChat( 'room', clientId );
		
		return room;
	}
	
	ns.Presence.prototype.sendMessage = async function( clientId, message, openChat ) {
		const self = this;
		const chat = await self.loadChat( clientId );
		if ( null == chat )
			throw new Error( 'ERR_NOT_AVAILABLE' );
		
		chat.sendMessage( message, openChat );
	}
	
	ns.Presence.prototype.openChat = async function( conf, notification, view, queued ) {
		const self = this;
		if ( !self.initialized ) {
			if ( null == queued )
				queued = 1;
			else
				queued++;
			
			self.queueEvent( 'openChat', [ conf, notification, view, queued ]);
			return;
		}
		
		// sync local check
		const cId = conf.id;
		let item = null;
		item = self.getLocalChat( cId );
		if ( item ) {
			item.openChat( notification, view );
			if ( null != view )
				hello.clearPreView( cId, view );
			
			return;
		}
		
		// async check
		item = await self.loadChat( cId );
		
		if ( item )
			item.openChat( notification, view );
		else
			console.log( 'Presence.openChat - could not find a chat for', conf );
		
		if ( null != view )
			hello.clearPreView( cId, view );
		
	}
	
	ns.Presence.prototype.loadChat = async function( clientId ) {
		const self = this;
		// wait for things to load check
		const loadRoom = self.getRoom( clientId );
		const loadContact = self.getContact( clientId );
		let item = null;
		try {
			item = await window.Promise.any([ loadRoom, loadContact ]);
		} catch( ex ) {
			console.log( 'Presence.loadChat - failed to load the thing', {
				cId : clientId,
				err : ex,
			});
			return null;
		}
		
		return item;
	}
	
	ns.Presence.prototype.goLiveAudio = function( conf ) {
		const self = this;
		const item = self.getLocalChat( conf.id );
		if ( !item )
			return;
		
		item.startAudio();
	}
	
	ns.Presence.prototype.goLiveVideo = function( conf ) {
		const self = this;
		const item = self.getLocalChat( conf.id );
		if ( !item )
			return;
		
		item.startVideo();
	}
	
	ns.Presence.prototype.create = function( identity ) {
		const self = this;
		console.log( 'Presence.create - NYI', identity );
	}
	
	ns.Presence.prototype.join = function( invite, identity ) {
		const self = this;
		console.log( 'Presence.join - NYI', {
			in : invite,
			id : identity,
		});
	}
	
	ns.Presence.prototype.openLive = async function( roomId ) {
		const self = this;
		const room = self.getLocalChat( roomId );
		if ( !room )
			return false;
		
		room.joinLive();
	}
	
	ns.Presence.prototype.closeLive = async function( roomId ) {
		const self = this;
		const room = self.getLocalChat( roomId );
		if ( null == room )
			return false
		
		room.closeLive()
	}
	
	ns.Presence.prototype.leaveRoom = async function( roomId ) {
		const self = this;
		const room = self.getLocalChat( roomId )
		if ( null == room )
			return false
		
		room.leaveRoom()
		return true
	}
	
	ns.Presence.prototype.viewSink = function( type, ...args ) {
		const self = this;
		if ( checkIsContact( type, self.contactsOnline )) {
			handleAction( type, args[ 0 ]);
			return;
		}
		
		if ( checkIsContact( type, self.contactsAll )) {
			handleAction( type, args[ 0 ]);
			return;
		}
		
		function checkIsContact( cId, list ) {
			if ( !list || !list.length )
				return;
			
			const cIdx = list.indexOf( cId );
			if ( -1 == cIdx )
				return false;
			
			return true;
		}
		
		function handleAction( cId, action ) {
			action.data = cId;
			self.handleContactAction( action );
		}
	}
	
	ns.Presence.prototype.close = function() {
		const self = this;
		if ( self.acc )
			self.acc.close();
		
		if ( self.contactEvents )
			self.contactEvents.close();
		
		self.baseClose();
		delete self.acc;
		delete self.contactEvents;
	}
	
	// Private
	
	ns.Presence.prototype.init = function() {
		const self = this;
		// activity
		self.activity.on( 'open'    , ( cId, event ) => self.handleActivityOpen( cId, event ));
		self.activity.on( 'live'    , ( cId, event ) => self.handleActivityLive( cId, event ));
		self.activity.on( 'menu'    , ( cId, event ) => self.handleActivityMenu( cId, event ));
		self.activity.on( 'response', ( cId, event ) => self.handleActivityResponse( cId, event ));
		
		// server
		self.conn.on( 'initialize', e => self.initialize( e ));
		self.conn.on( 'account', handleAccount );
		self.conn.on( 'clear', clear );
		
		function handleAccount( e ) { self.handleAccount( e ); }
		function clear( e ) { self.clear( e ); }
		
		// view
		self.view.on( 'create-room', createRoom );
		self.view.on( 'contact', contact );
		self.view.on( 'invite-response', invResponse );
		self.view.on( 'load-hidden', e => self.handleLoadHidden( e ));
		self.view.on( 'open-hidden', e => self.handleOpenHidden( e ));
		self.view.on( 'filter', e => self.handleFilter( e ));
		
		function createRoom( e ) { self.handleCreateRoom( e ); }
		function contact( e ) { self.sendContactAction( e ); }
		function invResponse( e ) { self.handleInviteResponse( e ); }
		
		self.setup();
	}
	
	ns.Presence.prototype.handleActivityOpen = function( clientId, data ) {
		const self = this;
		const room = self.getLocalChat( clientId );
		if ( !room ) {
			console.log( 'app.Presence.handleActivityOpen - no room for', [ clientId, data ]);
			return null;
		}
		
		room.openChat();
	}
	
	ns.Presence.prototype.handleActivityLive = function( clientId, permissions ) {
		const self = this;
		const room = self.getLocalChat( clientId );
		if ( !room ) {
			console.log( 'app.Presence.handleActivityLive - no room for', [ clientId, data ]);
			return;
		}
		
		if ( 'video' === permissions ) {
			room.startVideo();
			return;
		}
		
		if ( 'audio' === permissions ) {
			room.startAudio();
			return;
		}
		
		if ( 'show' === permissions ) {
			room.joinLive();
			return;
		}
		
		if ( null == permissions )
			room.startVideo();
		else
			room.setupLive( permissions );
	}
	
	ns.Presence.prototype.handleActivityMenu = function( clientId, data ) {
		const self = this;
		console.log( 'handleActivityMenu - NYI', [ clientId, data ]);
	}
	
	ns.Presence.prototype.handleActivityResponse = function( responseId, response ) {
		const self = this;
		const invite = self.invites[ responseId ];
		if ( !invite ) {
			self.activity.remove( responseId );
			return;
		}
		
		const accept = 'join' === response ? true : false;
		const res = {
			accepted : accept,
			roomId   : invite.roomId,
			token    : responseId,
		};
		
		self.handleInviteResponse( res );
		self.activity.remove( responseId );
	}
	
	ns.Presence.prototype.getLocalChat = function( cId, type ) {
		const self = this;
		const room = self.rooms[ cId ];
		const contact = self.contacts[ cId ];
		
		return room || contact || null;
	}
	
	ns.Presence.prototype.initialize = function() {
		const self = this;
		self.sendModuleInit();
	}
	
	ns.Presence.prototype.setup = function() {
		const self = this;
		// register as service provider with the rtc bridge
		self.service = new library.component.PresenceService( self );
		hello.setServiceProvider( self.service );
		
		self.sendModuleInit();
	}
	
	ns.Presence.prototype.getHost = function() {
		const self = this;
		return self.account.host;
	}
	
	ns.Presence.prototype.sendModuleInit = function() {
		const self = this;
		const authBundle = hello.getAuthBundle();
		const id = hello.getIdConf();
		const init = {
			type : 'initialize',
			data : {
				authBundle : authBundle,
				identity   : id,
			},
		};
		self.send( init );
	}
	
	ns.Presence.prototype.clear = function() {
		const self = this;
		self.cleanRooms();
		self.cleanContacts();
		self.accountId = null;
		
	}
	
	// from service
	
	ns.Presence.prototype.serviceGetRoomInfo = function( clientId ) {
		const self = this;
		const item = self.getLocalChat( clientId );
		if ( !item )
			return null;
		
		return {
			id        : clientId,
			name      : item.identity.name,
			isPrivate : item.identity.isPrivate,
			peers     : item.peers,
		};
	}
	
	ns.Presence.prototype.serviceGetRoom = function( action, conf ) {
		const self = this;
		const reqId = friendUP.tool.uid( 'req' );
		const session = conf;
		self.roomRequests[ reqId ] = {
			action  : action,
			session : session,
		};
		
		const roomConf = {
			req    : reqId,
			invite : session.invite || null,
			name   : null,
		}
		
		if ( 'create' === action ) {
			self.createRoom( roomConf );
			return;
		}
		
		if ( 'join' === action ) {
			self.joinRoom( roomConf );
			return;
		}
		
		console.log( 'handleServiceOnCreate - unknown event', event );
	}
	
	ns.Presence.prototype.handleServiceEvent = function( event ) {
		const self = this;
		console.log( 'handleServiceEvent - NYI', event );
	}
	
	ns.Presence.prototype.handleServiceOnClose = function( event ) {
		const self = this;
		console.log( 'handleServiceOnClose - NYI', event );
	}
	
	ns.Presence.prototype.serviceLiveInvite = function( conf, roomId ) {
		const self = this;
		const contacts = conf.contacts;
		const permissions = conf.permissions;
		if ( !hello.rtc.sessions[ roomId ])
			return;
		
		self.sendInvites( 'live', contacts, roomId );
	}
	
	// from server
	
	ns.Presence.prototype.handleAccountInit = async function( state ) {
		const self = this;
		if ( self.idc ) {
			await self.idc.refresh();
		}
		else {
			self.setupIDC( state.identities );
		}
		
		self.handleIdBacklog();
		self.updateInvites( state.invites );
		
		if ( self.initialized ) {
			self.updateRooms( state.rooms );
			self.updateContacts( state.relations );
			self.contactsOnline = state.contacts;
			self.updateFilterOnline();
			return;
		}
		
		self.isOnline = true;
		self.initialized = true;
		updateAccount( state.account );
		const uid = {
			type : 'user-id',
			data : self.accountId,
		};
		self.toView( uid );
		self.setupRooms( state.rooms );
		self.handleRelationsInit( state.relations );
		self.contactsOnline = state.contacts;
		self.updateFilterOnline();
		//self.setupDormant();
		self.flushQueue();
		
		if ( self.activity )
			window.setTimeout( refreshActivity, 3000 );
		
		function refreshActivity() {
			self.activity.refresh();
		}
		
		function updateAccount( account ) {
			self.account = account;
			const id = account.identity;
			if ( id.name !== self.identity.name )
				updateName();
			
			if ( id.avatar !== self.identity.avatar )
				updateAvatar();
			
			const cId = id.clientId;
			self.identity = id;
			
			function updateName() {
				
			}
			
			function updateAvatar() {
				
			}
		}
	}
	
	ns.Presence.prototype.setupIDC = function( ids ) {
		const self = this;
		self.idc = new library.component.IdCache( self.acc, ids );
		self.idc.on( 'update', ( id, key ) => self.handleIdUpdated( id, key ));
	}
	
	ns.Presence.prototype.handleIdBacklog = function() {
		const self = this;
		const waitingList = Object.keys( self.getIdentityBacklog );
		if ( !waitingList || !waitingList.length )
			return;
		
		waitingList.forEach( cId => self.checkIdBacklog( cId ));
	}
	
	ns.Presence.prototype.checkIdBacklog = async function( cId ) {
		const self = this;
		const waiters = self.getIdentityBacklog[ cId ];
		if ( !waiters )
			return;
		
		const id = await self.lookupIdentity( cId );
		if ( !id )
			return;
		
		delete self.getIdentityBacklog[ cId ];
		window.clearTimeout( waiters.timeout );
		waiters.list.forEach( fun => {
			fun( id );
		});
	}
	
	ns.Presence.prototype.lookupIdentity = async function( cId ) {
		const self = this;
		let item = self.rooms[ cId ];
		if ( item )
			return item.getIdentity();
		
		item = self.contacts[ cId ];
		if ( item && item.getIdentity )
			return item.getIdentity();
		
		item = self.invites[ cId ];
		if ( item )
			return item.room;
		
		if ( self.idc )
			return await self.idc.get( cId );
		else
			return null;
	}
	
	ns.Presence.prototype.handleAccount = function( accountId ) {
		const self = this;
		if ( self.accountId ) {
			self.initializeAccount();
			return;
		}
		
		self.accountId = accountId;
		self.acc = new library.component.RequestNode(
			accountId,
			self.conn,
			accEventSink,
			null
		);
		
		self.bindAcc();
		self.initializeAccount();
		
		function accEventSink( ...args ) { console.log( 'Presence.accEventSink', args ); }
	}
	
	ns.Presence.prototype.initializeAccount = function() {
		const self = this;
		const init = {
			type : 'initialize',
			data : null,
		};
		self.acc.send( init );
	}
	
	ns.Presence.prototype.bindAcc = function() {
		const self = this;
		self.acc.on( 'initialize', initialize );
		self.acc.on( 'relation-init', relationsInit );
		self.acc.on( 'relation-add', e => self.handleRelationAdd( e ));
		self.acc.on( 'relation-remove', e => self.handleRelationRemove( e ));
		self.acc.on( 'contact-list', e => self.handleOnlineList( e ));
		self.acc.on( 'contact-add', e => self.handleOnlineAdd( e ));
		self.acc.on( 'contact-remove', e => self.handleOnlineRemove( e ));
		//self.acc.on( 'online-event', contactEvent );
		self.acc.on( 'invite', handleInvite );
		self.acc.on( 'rooms', setupRooms );
		self.acc.on( 'join', joinedRoom );
		self.acc.on( 'close', roomClosed );
		self.acc.on( 'identity-update', e => self.handleIdUpdate( e ));
		
		function initialize( e ) { self.handleAccountInit( e ); }
		function relationsInit( e ) { self.handleRelationsInit( e ); }
		//function contactEvent( e ) { self.handleContactEvent( e ); }
		function handleInvite( e ) { self.handleInvite( e ); }
		function setupRooms( e ) { self.setupRooms( e ); }
		function joinedRoom( e ) { self.handleJoin( e ); }
		function roomClosed( e ) { self.handleRoomClosed( e ); }
		
		self.contactEvents = new library.component.EventNode(
			'contact-event',
			self.acc,
			cEventSink
		);
		//self.contactEvents.on( 'online', e => self.handleUserOnline( e ));
		
		function cEventSink() {
			console.log( 'Presence.contactEventSink', arguments );
		}
	}
	
	ns.Presence.prototype.handleRelationsInit = function( relations ) {
		const self = this;
		const ids = Object.keys( relations );
		ids.forEach( cId => {
			const rel = relations[ cId ];
			self.handleRelationAdd( rel );
		});
	}
	
	ns.Presence.prototype.handleOnlineList = function( list ) {
		const self = this;
		list.forEach( add );
		/*
		const cList = {
			type : 'contact-list',
			data : list,
		};
		self.toView( cList );
		*/
		function add( con ) {
			self.handleRelationAdd( con );
		}
	}
	
	ns.Presence.prototype.handleOnlineAdd = async function( user ) {
		const self = this;
		const cId = user.clientId;
		self.contactsOnline.push( cId );
		self.updateFilterOnline();
		const id = await self.idc.get( cId );
		self.updateFilter( 'add', id );
	}
	
	ns.Presence.prototype.handleOnlineRemove = function( clientId ) {
		const self = this;
		const idx = self.contactsOnline.indexOf( clientId );
		if ( -1 == idx )
			return;
		
		self.contactsOnline.splice( idx, 1 );
		self.updateFilter( 'remove', clientId );
		self.updateFilterOnline();
	}
	
	ns.Presence.prototype.updateFilter = function( action, data ) {
		const self = this;
		if ( 'relations' == self.currentFilter )
			return;
		
		const uptd = {
			type : 'update-list',
			data : {
				type : action,
				data : {
					select : self.currentFilter,
					data   : data,
				},
			},
		};
		self.filterToView( uptd );
	}
	
	ns.Presence.prototype.updateFilterOnline = function() {
		const self = this;
		const uptd = {
			type : 'update-online',
			data : self.contactsOnline.length,
		};
		self.filterToView( uptd );
		
		if ( 'online' == self.currentFilter )
			self.handleFilterSelect({ id : 'online' });
	}
	
	ns.Presence.prototype.updateContact = function( contact ) {
		const self = this;
		const cId = contact.clientId;
		const room = self.getLocalChat( cId );
		if ( !room )
			return false;
		
		const isReconnecting = room.reconnect();
		
		if ( !isReconnecting ) {
			room.updateRelation( contact.relation );
			room.updateState( contact.state );
		}
		
		return true;
	}
	
	ns.Presence.prototype.handleRelationAdd = async function( contact ) {
		const self = this;
		if ( !self.idc )
			return;
		
		const cId = contact.clientId;
		self.removeHidden( cId );
		
		let room = self.updateContact( contact );
		if ( room )
			return;
		
		self.setChatLoading( 'contact', cId );
		const host = library.tool.buildDestination(
			null,
			self.module.host,
			self.module.port,
		);
		
		const identity = await self.idc.get( contact.clientId );
		if ( !identity ) {
			self.resolveChatLoaded( 'contact', cId, 'ERR_NO_IDENTITY' );
			return;
		}
		
		contact.identity = identity;
		const conf = {
			moduleId   : self.clientId,
			contact    : contact,
			parentConn : self.acc,
			parentView : self.parentView,
			idCache    : self.idc,
			activity   : self.activity,
			service    : self.service,
			host       : host,
			user       : self.identity,
			userId     : self.accountId,
		};
		
		room = new library.contact.PresenceContact( conf );
		self.contacts[ cId ] = room;
		self.contactIds.push( cId );
		const viewConf = room.getViewConf();
		const cAdd = {
			type : 'contact-add',
			data : viewConf,
		};
		self.toView( cAdd );
		
		self.checkIdBacklog( cId );
		self.resolveChatLoaded( 'contact', cId );
		if ( self.service && hello.dormant ) {
			const info = room.getInfo();
			info.isPrivate = true;
			self.service.emitEvent( 'roomAdd', info );
		}
	}
	
	ns.Presence.prototype.setChatLoading = function( type, clientId ) {
		const self = this;
		let loader = null;
		if ( 'contact' == type )
			loader = self.contactLoading[ clientId ];
		if ( 'room' == type )
			loader = self.roomLoading[ clientId ];
		
		if ( null != loader )
			return loader;
		
		let resolver = null;
		loader = new Promise( waiter ); // resolver is assinged in here
		loader.resolver = resolver;
		loader.timeouter = window.setTimeout( failed, 10000 );
		if ( 'contact' == type )
			self.contactLoading[ clientId ] = loader;
		if ( 'room' == type )
			self.roomLoading[ clientId ] = loader;
		
		return loader;
		
		function waiter( resolve, reject ) {
			resolver = ( err, res ) => {
				if ( null == err )
					resolve( res );
				else
					reject( err );
			}
		}
		
		function failed() {
			self.resolveChatLoaded( type, clientId, 'ERR_TIMEOUT' );
		}
	}
	
	ns.Presence.prototype.waitForChat = function( type, cId ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const rel = self.getLocalChat( cId );
			if ( null != rel ) {
				resolve( rel );
				return;
			}
			
			let loader = null;
			if ( 'contact' == type )
				loader = self.contactLoading[ cId ];
			if ( 'room' == type )
				loader = self.roomLoading[ cId ];
			
			if ( null == loader ) {
				loader = self.setChatLoading( type, cId );
			}
			
			loader
				.then( resolve )
				.catch( reject );
		});
	}
	
	ns.Presence.prototype.resolveChatLoaded = function( type, cId, error ) {
		const self = this;
		let loader = null;
		if ( 'contact' == type ) {
			loader = self.contactLoading[ cId ];
			delete self.contactLoading[ cId ];
		}
		if ( 'room' == type ) {
			loader = self.roomLoading[ cId ];
			delete self.roomLoading[ cId ];
		}
		
		if ( null == loader )
			return;
		
		const rel = self.getLocalChat( cId );
		if ( null != loader.timeouter )
			window.clearTimeout( loader.timeouter );
		
		if ( null == error )
			loader.resolver( null, rel );
		else
			loader.resolver( error, null );
	}
	
	ns.Presence.prototype.removeHidden = function( cId ) {
		const self = this;
		const hidden = self.hiddenContacts[ cId ];
		if ( null == hidden )
			return;
		
		if ( null != hidden.close )
			hidden.close();
		
		delete self.hiddenContacts[ cId ];
	}
	
	ns.Presence.prototype.handleUserOnline = function( contactId, isOnline ) {
		const self = this;
		if ( contactId === self.accountId )
			return;
		
		const contact = self.contacts[ contactId ];
		if ( contact )
			contact.setOnline( isOnline );
		
		self.roomIds.forEach( rId => {
			const room = self.rooms[ rId ];
			if ( !room )
				return;
			
			room.setUserOnline( contactId, isOnline );
		});
		
	}
	
	ns.Presence.prototype.handleRelationRemove = function( clientId ) {
		const self = this;
		const contact = self.contacts[ clientId ];
		if ( !contact )
			return;
		
		delete self.contacts[ clientId ];
		self.contactIds = Object.keys( self.contacts );
		contact.close();
		const cRem = {
			type : 'contact-remove',
			data : clientId,
		};
		self.toView( cRem );
		if ( self.activity )
			self.activity.remove( clientId );
		
		if ( self.service && hello.dormant ) {
			self.service.emitEvent( 'roomRemove', { roomId : clientId });
		}
	}
	
	ns.Presence.prototype.handleContactEvent = function( wrap ) {
		const self = this;
		const cId = wrap.contactId;
		const event = wrap.event;
		const contact = self.contacts[ cId ];
		if ( !contact )
			return;
		
		contact.handleEvent( event );
	}
	
	ns.Presence.prototype.updateInvites = function( fresh ) {
		const self = this;
		if ( null == fresh )
			fresh = [];
		
		const currIds = Object.keys( self.invites );
		const stale = currIds.filter( currId => {
			const notInFresh = !fresh.some( fInv => fInv.token == currId );
			return notInFresh;
		});
		
		if ( stale && stale.length )
			stale.forEach( sId => self.removeRoomInvite( sId ));
		
		fresh.forEach( fInv => {
			self.showRoomInvite( fInv );
		});
	}
	
	ns.Presence.prototype.handleInvite = function( event ) {
		const self = this;
		if ( 'add' === event.type ) {
			self.showRoomInvite( event.data );
			return;
		}
		
		if ( 'remove' === event.type ) {
			self.removeRoomInvite( event.data );
			return;
		}
		
		console.log( 'Presence.handleInvite - unknown event', event );
	}
	
	ns.Presence.prototype.showRoomInvite = async function( invite ) {
		const self = this;
		const token = invite.token;
		if ( null != self.invites[ token ]) {
			// already have invite
			return;
		}
		
		const roomId = invite.roomId;
		if ( null != self.rooms[ roomId ]) {
			// alreay have room
			return;
		}
		
		let from = null;
		try {
			from = await self.idc.get( invite.createdBy );
		} catch( ex ) {
			console.log( 'app.Presence.showRoomInvite - idc.get failed', ex );
			return;
		}
		
		invite.from = from;
		self.invites[ token ] = invite;
		self.checkIdBacklog( token );
		
		const inv = {
			type : 'invite-add',
			data : invite,
		};
		self.view.send( inv );
		
		if ( !self.activity ) {
			console.log( 'no activity, skip sending invite' );
			return;
		}
		
		const req = [
			token,
			from.name + ' has invited you to #' + invite.room.name,
			[ 'join', 'decline' ],
			Date.now(),
		];
		
		try {
			await self.activity.request( ...req );
		} catch( ex ) {
			console.log( 'app.Presence.showRoomInvite - activity.request ex', ex );
			return;
		}
	}
	
	ns.Presence.prototype.removeRoomInvite = function( invId ) {
		const self = this;
		const invite = self.invites[ invId ];
		delete self.invites[ invId ];
		const rem = {
			type : 'invite-remove',
			data : invId,
		};
		self.view.send( rem )
		
		if ( !self.activity )
			return;
		
		self.activity.remove( invId );
	}
	
	ns.Presence.prototype.handleInviteResponse = async function( res ) {
		const self = this;
		const invite = self.invites[ res.token ];
		const inv = {
			type : 'invite-response',
			data : res,
		};
		let retValue = null;
		try {
			retValue = await self.acc.request( inv );
		} catch( ex ) {
			console.log( 'handleInviteResponse - req ex', ex );
			return false;
		}
		
		if ( retValue ) {
			console.log( 'handleInviteResponse - sus return value', retValue );
			return false;
		}
		
		const room = invite.room;
		const show = [
			'room',
			room.clientId,
			1,
			'',
			'i18n_joined_room',
			Date.now(),
		];
		
		self.activity.message( ...show );
		
		return true;
	}
	
	ns.Presence.prototype.updateRooms = function( rooms ) {
		const self = this;
		//console.log( 'Presence.updateRooms - NYI', rooms );
		if ( null == rooms )
			return;
		
		
	}
	
	ns.Presence.prototype.updateContacts = function( contacts ) {
		const self = this;
		//console.log( 'Presence.updateContacts - NYI', contacts );
		if ( null == contacts )
			return;
		
		
	}
	
	ns.Presence.prototype.handleLoadHidden = function() {
		const self = this;
		const hiddenLoading = {
			type : 'hidden-loading',
			data : Date.now(),
		};
		self.toView( hiddenLoading );
		
		const loadHidden = {
			type : 'hidden-list',
		};
		self.acc.request( loadHidden )
			.then( hiddenBack )
			.catch( loadErr );
		
		function loadErr( ex ) {
			console.log( 'handleLoadHidden - loadErr', ex );
			showList( null );
		}
		
		function hiddenBack( list ) {
			showList( list );
		}
		
		function showList( list ) {
			const hidden = {
				type : 'hidden-list',
				data : {
					hidden : list,
				},
			};
			self.toView( hidden );
		}
	}
	
	ns.Presence.prototype.handleOpenHidden = function( contactId ) {
		const self = this;
		const contact = self.hiddenContacts[ contactId ];
		if ( true === contact )
			return;
		
		if ( contact ) {
			contact.show();
			return;
		}
		
		self.hiddenContacts[ contactId ] = true;
		
		const hopen = {
			type : 'hidden-open',
			data : contactId,
		};
		self.acc.request( hopen )
			.then( onRes )
			.catch( onErr );
		
		function onErr( err ) {
			console.log( 'Presence.handleOpenHidden - request err', err );
			delete self.hiddenContacts[ contactId ];
			
		}
		
		function onRes( res ) {
			if ( !res ) {
				delete self.hiddenContacts[ contactId ];
				return;
			}
			
			showHiddenChat( res );
		}
		
		function showHiddenChat( contact ) {
			const cId = contact.clientId;
			const conf = {
				moduleId   : self.clientId,
				contact    : contact,
				parentConn : self.acc,
				parentView : self.parentView,
				idCache    : self.idc,
				user       : self.identity,
				userId     : self.accountId,
			};
			
			const room = new library.contact.PresenceHidden( conf );
			self.hiddenContacts[ cId ] = room;
			room.once( 'close', onClose );
			
			function onClose() {
				delete self.hiddenContacts[ cId ];
				const hClose = {
					type : 'hidden-close',
					data : cId,
				};
				self.acc.send( hClose );
				room.close();
			}
		}
	}
	
	ns.Presence.prototype.handleFilter = function( event ) {
		const self = this;
		if ( 'select' == event.type )
			self.handleFilterSelect( event.data );
		
		if ( 'load-identities' == event.type )
			self.handleFilterLoadIds( event.data );
	}
	
	ns.Presence.prototype.handleFilterSelect = async function( select ) {
		const self = this;
		const id = select.id;
		
		self.currentFilter = id;
		if ( 'relations' == id ) {
			prepare( id, self.contactIds );
			return true;
		}
		
		if ( 'online' == id ) {
			//prepare( id, self.contactsOnline );
			let ids = await self.idc.getList( self.contactsOnline );
			ids.sort(( a, b ) => {
				const an = a.name.toLowerCase();
				const bn = b.name.toLowerCase();
				if ( an > bn )
					return 1;
				else
					return -1;
			});
			
			const idList = ids.map( id => id.clientId );
			prepare( id, idList );
			populate( id, ids );
			return true;
		}
		
		if ( 'all' == id ) {
			const getAll = {
				type : 'contact-list',
				data : null,
			};
			let allList = null;
			try {
				allList = await self.acc.request( getAll );
			} catch( ex ) {
				console.log( 'handleFilterSelect - contact-list ex', ex );
			}
			self.contactsAll = allList;
			prepare( 'all', allList );
			return true;
		}
		
		function prepare( select, list ) {
			const prep = {
				type : 'prepare-list',
				data : {
					select : select,
					ids    : list,
				},
			};
			self.filterToView( prep );
		}
		
		function populate( select, identies ) {
			const pop = {
				type : 'populate-items',
				data : {
					select : select,
					ids    : identies,
				}
			};
			self.filterToView( pop );
		}
	}
	
	ns.Presence.prototype.handleFilterLoadIds = async function( event ) {
		const self = this;
		const ids = await self.idc.getList( event.list );
		const res = {
			type : 'populate-items',
			data : {
				select : event.select,
				ids    : ids,
			},
		};
		self.filterToView( res );
	}
	
	ns.Presence.prototype.filterToView = function( event ) {
		const self = this;
		const filter = {
			type : 'filter',
			data : event,
		};
		self.toView( filter );
	}
	
	ns.Presence.prototype.setupRooms = function( rooms ) {
		const self = this;
		if ( !rooms || !rooms.length )
			return;
		
		rooms.forEach( room => self.addRoom( room ));
		const list = rooms.map( r => r.clientId );
		self.checkCurrentRooms( list );
	}
	
	ns.Presence.prototype.handleJoin = function( rooms ) {
		const self = this;
		const conf = rooms.joined;
		const list = rooms.current;
		self.checkCurrentRooms( list );
		if ( null == conf ) {
			console.log( 'null room, end of room list', conf );
			return;
		}
		
		if ( conf.isPrivate )
			return;
		
		const room = self.addRoom( conf );
		
		// lets see if if this client sent the create/join request
		if ( conf.req && self.roomRequests[ conf.req ]) {
			self.handleRequest( conf.req, room.clientId );
		}
	}
	
	ns.Presence.prototype.handleRoomClosed = function( roomId ) {
		const self = this;
		self.removeRoom( roomId );
	}
	
	ns.Presence.prototype.handleIdUpdate = function( update ) {
		const self = this;
		self.idc.update( update );
	}
	
	ns.Presence.prototype.handleIdUpdated = function( id, key ) {
		const self = this;
		const userId = id.clientId;
		if ( key && ( 'isOnline' === key )) {
			self.handleUserOnline( userId, id.isOnline );
		}
		
		const uptd = {
			type : key,
			data : id,
		};
		
		if ( userId == self.accountId ) {
			self.contactIds.forEach( cId => {
				const contact = self.contacts[ cId ];
				contact.updateIdentity( uptd );
			});
		} else {
			const contact = self.contacts[ userId ];
			if ( contact && contact.updateIdentity )
				contact.updateIdentity( uptd );
		}
		
		self.roomIds.forEach( rId => {
			const room = self.rooms[ rId ];
			room.updateIdentity( uptd );
		});
		
		if ( hello.dormant && self.service )
			self.service.emitEvent( 'identityUpdate', id );
	}
	
	ns.Presence.prototype.checkCurrentRooms = function( list ) {
		const self = this;
		if ( null == list )
			return;
		
		if ( !self.initialized )
			return;
		
		if ( null != self.checkRoomsTimeout )
			window.clearTimeout( self.checkRoomsTimeout );
		
		self.checkRoomsTimeout = window.setTimeout( check, 500 );
		
		function check() {
			const missing = list.filter( rId => !self.rooms[ rId ]);
			const stale = self.roomIds.filter( rId => {
				return !list.some( lId => rId == lId );
			});
			
			if ( missing.length )
				missing.forEach( join );
			
			if ( stale.length )
				stale.forEach( rId => self.removeRoom( rId ));
			
		}
		
		function join( roomId ) {
			const event = {
				type : 'room-get',
				data : roomId,
			};
			self.toAccount( event );
		}
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
	
	ns.Presence.prototype.sendContactAction = function( action ) {
		const self = this;
		const event = {
			type : 'contact',
			data : action,
		};
		self.toAccount( event );
	}
	
	// to server
	
	ns.Presence.prototype.toAccount = function( event ) {
		const self = this;
		if ( !self.accountId ) {
			console.log( 'Presence.toAccount - no account set', event );
			return;
		}
		
		self.acc.send( event );
	}
	
	ns.Presence.prototype.createRoom = async function( conf ) {
		const self = this;
		const create = {
			type : 'room-create',
			data : conf,
		};
		
		const res = await self.acc.request( create );
		return res;
	}
	
	ns.Presence.prototype.joinRoom = function( conf ) {
		const self = this;
		const roomId = conf.invite.roomId;
		if ( isInRoom( roomId )) {
			const req = self.roomRequests[ conf.req ];
			delete self.roomRequests[ conf.req ];
			rejoinLive( roomId, req.session );
			return;
		}
		
		const join = {
			type : 'room-join',
			data : conf,
		};
		self.toAccount( join );
		
		function isInRoom( roomId ) {
			if ( !roomId )
				return false;
			
			if ( self.rooms[ roomId ])
				return true;
			else
				return false;
		}
		
		function rejoinLive( roomId, conf ) {
			const room = self.rooms[ roomId ];
			room.joinLive( conf );
		}
	}
	
	// all the other things
	
	ns.Presence.prototype.addRoom = function( conf ) {
		const self = this;
		if ( !self.idc )
			return;
		
		if ( !conf.clientId ) {
			console.log( 'addRoom - conf does not have clientId', conf );
			return;
		}
		
		const cId = conf.clientId;
		let room = self.rooms[ cId ];
		if ( room ) {
			room.reconnect();
			return;
		}
		
		const host = library.tool.buildDestination(
			null,
			self.module.host,
			self.module.port,
		);
		
		conf.name = conf.name || null;
		const roomConf = {
			moduleId   : self.clientId,
			room       : conf,
			parentConn : self.acc,
			parentView : self.parentView,
			idCache    : self.idc,
			activity   : self.activity,
			service    : self.service,
			host       : host,
			user       : self.identity,
			userId     : self.accountId,
		};
		
		room = new library.contact.PresenceRoom( roomConf );
		self.rooms[ cId ] = room;
		self.roomIds.push( cId );
		conf.identity = room.identity;
		
		const addRoom = {
			type : 'room-join',
			data : conf,
		};
		self.toView( addRoom );
		
		room.on( 'contact', contactEvent );
		room.once( 'open', onOpen );
		
		function onOpen( yep ) {
			self.checkIdBacklog( cId );
			self.resolveChatLoaded( 'room', cId );
			if ( self.service && hello.dormant ) {
				const info = room.getInfo();
				info.isPrivate = false;
				self.service.emitEvent( 'roomAdd', info );
			}
		}
		
		return room;
		
		function contactEvent( e ) { self.handleContactAction( e ); }
	}
	
	ns.Presence.prototype.handleContactAction = function( event ) {
		const self = this;
		if ( 'open' === event.type )
			self.openContactChat( event.data );
		if ( 'open-chat' === event.type )
			self.openContactChat( event.data );
		if ( 'live-video' === event.type )
			self.openContactVideo( event.data );
		if ( 'live-audio' === event.type )
			self.openContactAudio( event.data );
	}
	
	ns.Presence.prototype.openContactChat = async function( contactId ) {
		const self = this;
		let contact = null;
		try {
			contact = await self.getContact( contactId );
		} catch( ex ) {
			console.log( 'openContactChat ex', ex );
		}
		
		if ( null == contact )
			return;
		
		contact.openChat();
	}
	
	ns.Presence.prototype.openContactVideo = async function( contactId ) {
		const self = this;
		const contact = await self.getContact( contactId );
		if ( null == contact )
			return;
		
		contact.startVideo();
	}
	
	ns.Presence.prototype.openContactAudio = async function( contactId ) {
		const self = this;
		const contact = await self.getContact( contactId );
		if ( null == contact )
			return;
		
		contact.startAudio();
	}
	
	ns.Presence.prototype.joinLiveSession = function( roomId, sessConf ) {
		const self = this;
		const room = self.getLocalChat( roomId );
		if ( !room )
			return;
		
		room.joinLive( sessConf );
	}
	
	ns.Presence.prototype.setupLiveSession = function( roomId, sessConf ) {
		const self = this;
		const room = self.getLocalChat( roomId );
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
		const self = this;
		if ( !contacts )
			return;
		
		contacts.forEach( invite );
		function invite( contact ) {
			const room = self.getRoomSync( roomId );
			if ( !room )
				return;
			
			room.getInviteToken( null, getBack );
			function getBack( inv ) {
				if ( !inv )
					return;
				
				//const invite = self.buildInvite( type, roomId, inv.token );
				contact.invite( inv.data );
			}
		}
	}
	
	ns.Presence.prototype.setLogin = function() {
		const self = this;
		var login = {
			setting : 'login',
			value   : hello.identity.alias,
		};
		self.saveSetting( login );
	}
	
	ns.Presence.prototype.askForAccount = function() {
		const self = this;
		self.queryUser( 'account-ask', '', null, askBack );
		function askBack( res ) {
			if ( 'create' === res )
				self.createAccount();
			else
				self.getSettings();
		}
	}
	
	ns.Presence.prototype.createAccount = function() {
		const self = this;
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
		const self = this;
	}
	
	ns.Presence.prototype.setupDormant = function() {
		const self = this;
		if ( !hello.dormant )
			return;
		
		if ( !hello.dormant.allowWrite )
			return;
		
		if ( self.dormantParentPath )
			return;
		
		const path = 'Presence';
		const presence = new api.DoorDir({
			title : path,
			path  : path + '/',
		}, 'Modules/' );
		
		/*
		const contacts = new api.DoorDir({
			title : 'Contacts',
			path  : 'Contacts/',
		}, presence.fullPath );
		self.dormantParentPath = contacts.fullPath;
		
		const getIdentityFn = new api.DoorFun({
			title   : 'GetIdentity',
			execute : getIdentity,
		}, presence.fullPath );
		
		hello.dormant.addDir( presence );
		hello.dormant.addDir( contacts );
		hello.dormant.addFun( getIdentityFn );
		
		function getIdentity() {
			return self.identity;
		}
		
		*/
		
		hello.dormant.addDir( presence );
	}
	
})( library.module );


// TREEROOT
(function( ns, undefined) {
	ns.Treeroot = function( ...args ) {
		const self = this;
		library.module.BaseModule.call( self, ...args );
		
		self.type = 'treeroot';
		self.subscribeView = null;
		
		self.requests = {};
		
		self.init();
	}
	
	ns.Treeroot.prototype = Object.create( library.module.BaseModule.prototype );
	
	// Public
	
	// BaseModule.reconnect
	ns.Treeroot.prototype.reconnect = function() {
		const self = this;
		self.initialize();
	}
	
	ns.Treeroot.prototype.search = function( searchStr ) {
		const self = this;
		const filter = new library.component.Filter();
		let results = [
			new Promise( getContacts ),
			new Promise( getAvailable ),
		];
		
		return {
			source   : 'Treeroot',
			results  : results,
		};
		
		function getContacts( resolve, reject ) {
			if ( !self.isLoggedIn ) {
				reject( 'ERR_LOGIN' );
				return;
			}
			
			let items = Object.keys( self.contacts )
				.map( cId => {
					let contact = self.contacts[ cId ];
					return build( contact, true );
				});
			
			items = filter.filter( searchStr, items );
			resolve({
				type    : 'current',
				pool    : items,
				actions : [
					'open-chat',
					'invite-video',
					'invite-audio',
				],
			});
		};
		
		function getAvailable( resolve, reject ) {
			if ( !self.isLoggedIn ) {
				reject( 'ERR_LOGIN' );
				return;
			}
			
			self.searchAvailable( searchStr )
				.then( usersBack )
				.catch( usersError );
			
			function usersError( err ) {
				console.log( 'usersError', err );
				reject( [] );
			}
			
			function usersBack( userList ) {
				let items = userList.map( user => {
					return build( user, false );
				});
				
				resolve({
					type    : 'available',
					actions : [
						'add-relation',
					],
					pool    : items,
				});
			}
		}
		
		function build( user, isRelation ) {
			const id = user.identity || user;
			let item = {
				id         : id.clientId || id.id,
				type       : 'contact',
				isRelation : isRelation,
				name       : id.name,
				email      : '', // id.email,
				avatar     : id.avatar || '',
				alias      : null,
				isOnline   : id.isOnline || false,
			};
			return item;
		}
	}
	
	ns.Treeroot.prototype.addRelation = function( sub, idType ) {
		const self = this;
		const id = sub.id;
		idType = idType || 'ContactID';
		return self.createSubscription({
			id   : id,
			type : idType,
		});
	}
	
	ns.Treeroot.prototype.removeRelation = function( sub ) {
		const self = this;
		const contact = self.contacts[ sub.id ];
		if ( !contact )
			return;
		
		contact.removeRelation();
	}
	
	ns.Treeroot.prototype.openChat = function( user ) {
		const self = this;
		const contact = self.contacts[ user.id ];
		if ( !contact )
			return;
		
		contact.startChat();
	}
	
	ns.Treeroot.prototype.inviteToLive = function( user, mode ) {
		const self = this;
		const contact = self.contacts[ user.id ];
		if ( !contact )
			return;
		
		if ( 'video' === mode )
			contact.startVideo();
		else
			contact.startAudio();
	}
	
	// Private
	
	ns.Treeroot.prototype.init = function() {
		const self = this;
		self.conn.on( 'account', updateAccount );
		self.conn.on( 'contact', contactEvent );
		self.conn.on( 'subscription', subscription );
		self.conn.on( 'register', registerResponse );
		self.conn.on( 'keyexchange', keyExchangeHandler );
		self.conn.on( 'pass-ask-auth', passAskAuth );

		function updateAccount( e ) { self.updateAccount( e ); }
		function contactEvent( e ) { self.contactEvent( e ); }
		function subscription( e ) { self.subscription( e ); }
		function registerResponse( e ) { self.registerResponse( e ); }
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
		function addContact( data ) { self.addContact( data ); }
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
			'uniqueid'            : handleUniqueId,
			'signtemppass'        : signTempPass,
			'password-old-failed' : oldPassFail,
		};
		
		function handleUniqueId( msg ) { self.handleUniqueId( msg ); }
		function signTempPass( msg ) { self.signTempPass( msg ); }
		function oldPassFail( e ) { self.oldPasswordFailed( e ); }
		
		self.bindView();
		//self.setupDormant();
		
		if ( self.module.login )
			self.initCrypto();
		else
			self.initialize();
	}
	
	ns.Treeroot.prototype.setIdentity = function() {
		const self = this;
		self.identity = {
			clientId : self.clientId,
			name : self.module.login,
			avatar : 'https://treeroot.org/admin/gfx/arenaicons/user_johndoe_32.png',
		};
	}
	
	ns.Treeroot.prototype.initialize = function() {
		const self = this;
		if ( null != self.initializing )
			return;
		
		self.send({
			type : 'initialize',
		});
		self.initializing = window.setTimeout( initTimedOutMaybe, 1000 * 15 );
		function initTimedOutMaybe() {
			self.initializing = null;
			if ( !self.initialized )
				self.initialize();
		}
	}
	
	ns.Treeroot.prototype.initCrypto = function() {
		const self = this;
		self.crypt = null;
		var askUniqueId = {
			type : 'uniqueid',
		};
		self.sendKeyEx( askUniqueId );
	}
	
	ns.Treeroot.prototype.keyExchangeHandler = function( msg ) {
		const self = this;
		var handler = self.keyExEventMap[ msg.type ];
		if ( !handler ) {
			console.log( 'keyExchangeHandler - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Treeroot.prototype.handleUniqueId = function( data ) {
		const self = this;
		if ( !self.initialized )
			self.showModuleInitializing();
		
		var uniqueId = data.uniqueId;
		var storedPass = data.hashedPass || null;
		self.setupCrypto( uniqueId, storedPass, setupDone );
		function setupDone( publicKey, hashedPass, keys ) {
			self.sendPublicKey( publicKey, hashedPass, null, keys );
		}
	}
	
	ns.Treeroot.prototype.setupCrypto = function( uniqueId, hashedPass, doneBack ) {
		const self = this;
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
			
			done( keys.pub, pass, keys );
		}
		
		function done( pubKey, hashedPass, keys ) {
			doneBack( pubKey, hashedPass, keys );
		}
	}
	
	ns.Treeroot.prototype.sendPublicKey = function( publicKey, hashedPass, recoveryKey, keys ) {
		const self = this;
		var pubKeyEvent = {
			type : 'publickey',
			data : {
				publicKey   : publicKey,
				hashedPass  : hashedPass,
				recoveryKey : recoveryKey,
				keys        : keys,
			},
		};
		
		self.sendKeyEx( pubKeyEvent );
	}
	
	ns.Treeroot.prototype.signTempPass = function( tmpPass ) {
		const self = this;
		if ( !self.crypt )
			throw new Error( 'signTempPass - no crypto, bro' );
		
		var clearText = self.crypt.deRSA( tmpPass );
		if ( !clearText ) {
			console.log( 'failed to decrypt tmpPass', tmpPass );
			self.keyExErr( 'decrypt-temppass' );
			return;
		}
		
		var signed = self.crypt.sign( clearText );
		if ( !signed ) {
			console.log( 'could not sign temp pass?', {
				signed  : signed,
				tmpPass : tmpPass,
			});
			self.keyExErr( 'sign-temppass' );
			return;
		}
		
		var signedEvent = {
			type : 'signtemppass',
			data : {
				signed    : signed,
				clearText : clearText,
			},
		};
		
		self.sendKeyEx( signedEvent );
	}
	
	ns.Treeroot.prototype.sendKeyEx = function( msg ) {
		const self = this;
		var keyExEvent = {
			type : 'keyexchange',
			data : msg,
		};
		
		self.send( keyExEvent );
	}
	
	ns.Treeroot.prototype.keyExErr = function( step, data ) {
		const self = this;
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
		const self = this;
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
		const self = this;
		console.log( 'moduleOffline - NYI', msg );
	}
	
	ns.Treeroot.prototype.hostError = function( event ) {
		const self = this;
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
			self.reconnectNow();
		}
	}
	
	ns.Treeroot.prototype.invalidIdentity = function( msg ) {
		const self = this;
		self.queryUser( 'text', 'Identity was not found.', msg.identity, idBack );
		function idBack( identity ) {
			var update = {
				setting : 'login',
				value   : identity,
			};
			self.saveSetting( update );
		}
	}
	
	ns.Treeroot.prototype.moduleReconnecting = function( msg ) {
		const self = this;
		self.viewInfo( 'reconnect' );
	}
	
	ns.Treeroot.prototype.moduleInfoMissing = function( msg ) {
		const self = this;
		if ( self.initializing )
			clearTimeout( self.initializing );
		
		self.viewInfo( 'info-missing' );
	}
	
	ns.Treeroot.prototype.oldPasswordFailed = function( e ) {
		const self = this;
		let time = library.tool.getChatTime( e.time || Date.now());
		self.queryUser(
			'retry', 
			'Could not log in, secure key exchange failed -'
				+ 'please provide timestamp to sokken: ' + time,
			{
				retry  : 'Retry procedure',
				cancel : 'Provide a new password',
			},
			retryBack,
		);
		
		function retryBack( retry ) {
			const event = {
				type : 'password-retry',
				data : {
					retry : retry,
				},
			};
			self.sendKeyEx( event );
		}
	}
	
	ns.Treeroot.prototype.bindView = function() {
		const self = this;
		self.view.on( 'status', status );
		self.view.on( 'add-contact', subscribe );
		self.view.on( 'scienceregister', scienceRegister );
		self.view.on( 'register', showRegister );
		self.view.on( 'pass-reset', passReset );
		
		function status( msg ) { console.log( 'app.treeroot.view.status - NYI', msg ); }
		function subscribe( msg ) { self.showCreateSubscription(); }
		function scienceRegister( msg ) { self.handleScienceRegister(); }
		function showRegister( msg ) { self.showRegisterForm(); }
		function passReset( e ) { self.startPassReset(); }
		
		// function saveSetting( msg ) { self.saveSetting( msg ); }
	}
	
	ns.Treeroot.prototype.initializeState = function( data ) {
		const self = this;
		if ( self.initialized ) {
			self.updateState( data );
			return;
		}
		
		self.initialized = true;
		
		self.updateModuleView();
		self.updateAccount( data );
		
		data.contacts.forEach( add );
		function add( data ) {
			self.addContact( data );
		}
		
		data.subscriptions.forEach( addSub );
		function addSub( sub ) {
			self.addSubscription( sub );
		}
		
		if ( self.module.settings.msgCrypto && !self.module.settings.cryptoAccepted )
			self.showCryptoWarnView();
		
	}
	
	ns.Treeroot.prototype.updateState = function( state ) {
		const self = this;
		const contacts = state.contacts;
		if ( !contacts )
			return;
		
		contacts.forEach( update );
		
		function update( conState ) {
			let con = conState.contact;
			let state = conState.cState;
			let cId = con.clientId;
			updateOnline( cId, con.online );
			updateLastMessage( cId, state.lastMessage );
		}
		
		function updateOnline( cId, isOnline ) {
			self.contactPresence({
				clientId : cId,
				value    : isOnline ? 'online' : 'offline',
			});
		}
		
		function updateLastMessage( cId, lastMessage ) {
			if ( !lastMessage )
				return;
			
			let contact = self.contacts[ cId ];
			if ( !contact )
				return;
			
			contact.updateLastMessage( lastMessage );
		}
	}
	
	ns.Treeroot.prototype.setupDormant = function() {
		const self = this;
		if ( !hello.dormantEnabled )
			return;
			
		if ( self.dormantParentPath )
			return;
		
		let uid = self.clientId.split( '-' )[1];
		let path = [
			'treeroot',
			self.module.host,
			self.identity.serviceId,
			uid
		];
		path = path.join( '_' );
		const treeroot = new api.DoorDir({
			title : path,
			path  : path + '/',
		}, 'Modules/' );
		/*
		const treeroot = new api.DoorDir({
			title : 'treeroot - ' + self.module.host,
			path  : self.clientId + '/',
		}, '' );
		*/
		
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
		const self = this;
		var handler = self.contactEventMap[ msg.type ];
		if ( !handler ) {
			console.log( 'treeroot.contactEvent - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Treeroot.prototype.contactPresence = function( data ) {
		const self = this;
		self.view.send({
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
		const self = this;
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
		const self = this;
		self.module.login = data.value;
	}
	
	ns.Treeroot.prototype.updateOnlyOneClient = function( data ) {
		const self = this;
		console.log( 'updateOnlyOneClient - NYI', data )
		//self.module.settings.onlyOneClient = data.value;
	}
	
	ns.Treeroot.prototype.updateLogLimit = function( data ) {
		const self = this;
		console.log( 'module.updateLogLimit - NYI', data );
	}
	
	ns.Treeroot.prototype.updateMessageCrypto = function( data ) {
		const self = this;
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
		const self = this;
		self.module.settings.cryptoAccepted = update.value;
	}
	
	ns.Treeroot.prototype.showCryptoWarnView = function() {
		const self = this;
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
	
	ns.Treeroot.prototype.addContact = function( data ) {
		const self = this;
		console.log( 'addContact', data );
		const contact = data.contact;
		const cState = data.cState;
		if ( !contact ) {
			var cIds = Object.keys( self.contacts );
			if ( !cIds.length && !self.nullContact ) {
				self.nullContact = true;
				self.viewInfo( 'message', Application.i18n('i18n_no_contacts') );
			}
			
			return;
		}
		
		if ( cState )
			contact.lastMessage = cState.lastMessage;
		
		checkAvatar( contact );
		self.nullContact = false;
		if ( self.contacts[ contact.clientId ])
			return;
		
		var conf = {
			moduleId          : self.clientId,
			parentConn        : self.conn,
			parentView        : self.parentView,
			//dormantParentPath : self.dormantParentPath,
			contact           : contact,
			msgCrypto         : !!self.module.settings.msgCrypto,
			encrypt           : encrypt,
			decrypt           : decrypt,
		};
		
		function encrypt( e ) {
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
		contact.lastMessage = contactObj.getLastMessage();
		
		self.view.send({
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
		const self = this;
		self.isLoggedIn = false;
		if ( !data || !data.account )
			return;
		
		self.isLoggedIn = true;
		const account = data.account;
		const name = account.name || self.identity.name;
		const username = account.username;
		const avatar = getAvatarPath( account.imagePath );
		self.identity = {
			clientId  : self.clientId,
			name      : name,
			avatar    : avatar,
			username  : username,
			serviceId : account.id,
		};
		
		//self.setupDormant();
		self.view.send({
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
		const self = this;
		self.view.send({
			type : 'module',
			data : self.module,
		});
	}
	
	ns.Treeroot.prototype.subscription = function( data ) {
		const self = this;
		if ( 'add' === data.type ) {
			self.addSubscription( data.data );
			return;
		}
		
		if( 'remove' === data.type ) {
			self.removeSubscription( data.data.clientId );
			return;
		}
		
		if ( 'confirm' === data.type ) {
			self.confirmSubscription( data.data );
			return;
		}
		
		console.log( 'unknown subscription msg', msg );
	}
	
	ns.Treeroot.prototype.addSubscription = function( subscription ) {
		const self = this;
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
			moduleId   : self.clientId,
			parentView : self.parentView,
			subscriber : subscription,
			subscribe  : subscribe,
		};
		
		var subObj = new library.contact.Subscriber( conf );
		self.contacts[ subscription.clientId ] = subObj;
		subscription.identity = subObj.identity;
		self.view.send({
			type : 'subscriber',
			data : subscription
		});
		
		hello.log.positive( 'Contact request: ' + ( subscription.displayName || subscription.clientId ));
		function subscribe( event ) {
			const sub = {
				type : 'subscription',
				data : event,
			};
			self.conn.send( sub );
		}
	}
	
	ns.Treeroot.prototype.removeSubscription = ns.Treeroot.prototype.removeContact;
	
	ns.Treeroot.prototype.showCreateSubscription = function() {
		const self = this;
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
		
		self.getUserList()
			.then( listBack )
			.catch( err => {} );
		
		function listBack( userList ) {
			if ( !self.subscribeView )
				return;
			
			self.subscribeView.setUserList( userList );
		}
	}
	
	ns.Treeroot.prototype.handleUserList = function( event ) {
		const self = this;
		let callback = self.requests[ event.reqId ];
		if ( !callback )
			return;
		
		callback( event.list );
		delete self.requests[ event.reqId ];
	}
	
	ns.Treeroot.prototype.getUserList = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			if ( self.userList ) {
				resolve( self.userList );
				return;
			}
			
			const req = {
				type : 'user-list',
				data : null,
			};
			self.conn.request( req )
				.then( reqBack )
				.catch( reqFail );
			
			function reqBack( userList ) {
				self.userList = userList;
				self.userListCacheTimeout = window.setTimeout( clearUserListCache, 1000 * 10 );
				resolve( userList );
			}
			
			function reqFail( error ) {
				console.log( 'reqFail', error );
				reject( error );
			}
			
			function clearUserListCache() {
				self.userListCacheTimeout = null;
				delete self.userList;
			}
		});
	}
	
	ns.Treeroot.prototype.searchAvailable = function( searchStr ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const req = {
				type : 'search-available',
				data : searchStr,
			};
			self.conn.request( req )
				.then( resolve )
				.catch( reject );
		});
	}
	
	ns.Treeroot.prototype.createSubscription = function( data ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const reqId = friendUP.tool.uid( 'sub' );
			self.send({
				type : 'subscription',
				data : {
					type   : 'subscribe',
					data : {
						idType : data.type,
						id     : data.id,
						reqId  : reqId,
					},
				},
			});
			self.requests[ reqId ] = subConfirm;
			function subConfirm( success ) {
				if ( success )
					resolve();
				else
					reject();
			}
		});
	}
	
	ns.Treeroot.prototype.confirmSubscription = function( event ) {
		const self = this;
		const reqId = event.reqId;
		if ( !reqId )
			return;
		
		const callback = self.requests[ reqId ];
		if ( !callback )
			return;
		
		delete self.requests[ reqId ];
		callback( event.response );
	}
	
	ns.Treeroot.prototype.handleScienceRegister = function() {
		const self = this;
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
		const self = this;
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
		const self = this;
		self.passphrase = data.Passphrase; // hueueueuue
		var registerEvent = {
			type : 'register',
			data : data,
		};
		self.send( registerEvent );
	}
	
	ns.Treeroot.prototype.registerResponse = function( data ) {
		const self = this;
		if ( !self.registerFormView && data.success )
			return;
		
		if ( !self.registerFormView )
			self.showRegisterForm();
			
		self.registerFormView.response( data );
	}
	
	ns.Treeroot.prototype.startPassReset = function() {
		const self = this;
		var passReset = {
			type : 'pass-reset',
		};
		self.send( passReset );
	}
	
	ns.Treeroot.prototype.passAskAuth = function( data ) {
		const self = this;
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
		const self = this;
		console.log( 'handle global state - NYI', status );
	}
	
	ns.Treeroot.prototype.setName = function( name ) {
		const self = this;
		var host = self.module.host.split( '.' )[ 0 ];
		host = friendUP.tool.ucfirst( host );
		self.module.name = name
			|| self.module.displayName
			|| host
			|| self.type
			|| self.clientId;
	}
	
	ns.Treeroot.prototype.close = function() {
		const self = this;
		if ( self.registerFormView )
			self.registerFormView.close();
		
		if ( self.userListCacheTimeout )
			window.clearTimeout( self.userListCacheTimeout );
		
		self.baseClose();
	}
	
})( library.module );


// IRC
(function( ns, undefined ) {
	ns.IRC = function( ...args ) {
		library.module.BaseModule.call( this, ...args );
		
		const self = this;
		self.type = 'irc';
		self.consoleView = null;
		
		self.init();
	}
	
	ns.IRC.prototype = Object.create( library.module.BaseModule.prototype );
	
	// Public
	
	// BaseModule.reconnect
	ns.IRC.prototype.reconnect = function() {
		const self = this;
		console.log( 'IRC.reconnect - NYI' );
	}
	
	ns.IRC.prototype.search = function( searchStr ) {
		const self = this;
		let results = [
			new Promise( getThingies ),
		];
		
		return {
			source  : 'IRC',
			results : results,
		};
		
		function getThingies( resolve, reject ) {
			resolve({
				type : 'current',
				pool : [],
			});
		}
	}
	
	// Private
	
	ns.IRC.prototype.init = function() {
		const self = this;
		self.conn.on( 'message', consoleMsg );
		self.conn.on( 'identity', identityChange );
		self.conn.on( 'join', join );
		self.conn.on( 'leave', leave );
		self.conn.on( 'private', privateChat );
		self.conn.on( 'nick', nickChange );
		self.conn.on( 'quit', quit );
		self.conn.on( 'clear', clearTargets );
		self.conn.on( 'disconnect', clientDisconnect );
		
		function consoleMsg( e ) { self.consoleMessage( e ); }
		function identityChange( e ) { self.identityChange( e ); }
		function join( e ) { self.joinChannel( e ); }
		function leave( e ) { self.leftChannel( e ); }
		function privateChat( e ) { self.handlePrivateChat( e ); }
		function nickChange( e ) { self.nickChange( e ); }
		function quit( e ) { self.userQuit( e ); }
		function clearTargets( e ) { self.cleanContacts(); }
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
		//self.setupDormant();
	}
	
	ns.IRC.prototype.handleConnecting = function() {
		const self = this;
		if ( !self.initialized )
			self.showModuleInitializing();
	}
	
	ns.IRC.prototype.handleOnline = function() {
		const self = this;
		self.clearViewInfo();
	}
	
	ns.IRC.prototype.setIdentity = function() {
		const self = this;
		self.identity = {
			name : self.module.settings.nick,
			avatar : library.component.Identity.prototype.avatar,
		};
	}
	
	ns.IRC.prototype.initializeState = function( data ) {
		const self = this;
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
		const self = this;
		self.view.on( 'console', toggleConsole );
		self.view.on( 'reconnect', reconnectClick );
		self.view.on( 'disconnect', disconnectClick );
		self.view.on( 'leave', leaveClick );
		
		function toggleConsole( msg ) { self.toggleConsole( msg ); }
		function reconnectClick( msg ) { self.optionReconnect( msg ); }
		function disconnectClick( msg ) { self.optionDisconnect( msg ); }
		function leaveClick( msg ) { self.leaveChannel( msg ); }
	}
	
	ns.IRC.prototype.setupDormant = function() {
		const self = this;
		if ( !hello.dormantEnabled )
			return;
		
		if ( self.dormantParentPath )
			return;
		
		let mid = self.clientId.split( '-' )[1];
		let path = [
			'irc',
			self.module.host,
			self.identity.name,
			mid
		];
		
		path = path.join( '_' );
		const irc = new api.DoorDir({
			title : path,
			path  : path + '/',
		}, 'Modules/' );
		
		const channels = new api.DoorDir({
			title : 'Channels',
			path  : 'Channels/',
		}, irc.fullPath );
		
		const privMsg = new api.DoorDir({
			title : 'PrivMsg',
			path  : 'PrivMsg/',
		}, irc.fullPath );
		
		self.dormantChannelPath = channels.fullPath;
		self.dormantPrivMsgPath = privMsg.fullPath;
		
		const joinChannelFn = new api.DoorFun({
			title   : 'JoinChannel',
			execute : joinChannel,
		}, irc.fullPath );
		
		const leaveChannelFn = new api.DoorFun({
			title   : 'LeaveChannel',
			execute : leaveChannel,
		}, irc.fullPath );
		
		hello.dormant.addDir( irc );
		hello.dormant.addDir( channels );
		hello.dormant.addDir( privMsg );
		hello.dormant.addFun( joinChannelFn );
		hello.dormant.addFun( leaveChannelFn );
		
		function joinChannel( args, callback ) {
			if ( !args || !args.length ) {
				callback( 'ERR_INVALID_ARGS', null );
				return;
			}
			
			self.joinChannel( args[ 0 ]);
			return true;
		}
		
		function leaveChannel( args, callback ) {
			if ( !args || !args.length ) {
				callback( 'ERR_INVALID_ARGS', null );
				return;
			}
			
			self.leaveChannel( args[0] );
			return true;
		}
	}
	
	ns.IRC.prototype.toggleConsole =function( data ) {
		const self = this;
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
		const self = this;
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
		const self = this;
		if ( !self.consoleView )
			return;
		
		self.consoleView.send( msg );
	}
	
	ns.IRC.prototype.setConsoleError = function( msg ) {
		const self = this;
		self.toConsole( msg )
	}
	
	ns.IRC.prototype.setConsoleNotification = function( msg ) {
		const self = this;
		self.toConsole( msg );
	}
	
	ns.IRC.prototype.connError = function( data ) {
		const self = this;
		self.clearState();
	}
	
	ns.IRC.prototype.hostNotSet = function( msg ) {
		const self = this;
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
		const self = this;
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
		const self = this;
		self.module.settings.nick = data.value;
	}
	
	ns.IRC.prototype.updateAwayNick = function( data ) {
		const self = this;
		self.module.settings.awayNick = data.value;
	}
	
	ns.IRC.prototype.updateDisplayName = function( update ) {
		const self = this;
		self.module.name = update.value;
		var viewUpdate = {
			type : 'module',
			data : self.module,
		};
		
		self.updateView( viewUpdate );
	}
	
	ns.IRC.prototype.updateIrcTheme = function( update ) {
		const self = this;
		self.module.settings.ircTheme = update.value;
		var msg = {
			type : 'viewtheme',
			data : update.value,
		};
		self.toAll( msg );
	}
	
	ns.IRC.prototype.updateConnect = function( msg ) {
		const self = this;
		self.module.settings.connect = msg.value;
	}
	
	ns.IRC.prototype.joinChannel = function( channel ) {
		const self = this;
		var chanObj = self.contacts[ channel.clientId ];
		if ( chanObj ) {
			console.log( 'joinChannel - arealy in channel', channel );
			return;
			//self.removeContact( channel.clientId );
			//chanObj = null;
		}
		
		var conf = {
			moduleId          : self.clientId,
			parentConn        : self.conn,
			parentView        : self.parentView,
			dormantParentPath : self.dormantChannelPath,
			user              : self.identity,
			channel           : channel,
			viewTheme         : self.module.settings.ircTheme,
		};
		
		var chanObj = new library.contact.IrcChannel( conf );
		self.contacts[ channel.clientId ] = chanObj;
		channel.identity = chanObj.room;
		self.view.send({
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
		const self = this;
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
		const self = this;
		self.toAll({
			type : 'nick',
			data : data,
		});
	}
	
	ns.IRC.prototype.identityChange = function( data ) {
		const self = this;
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
		const self = this;
		self.toAllChannels({
			type : 'quit',
			data : data,
		});
	}
	
	ns.IRC.prototype.openPrivate = function( nick ) {
		const self = this;
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
		const self = this;
		var remove = {
			type : 'remove',
			data : nick,
		};
		self.sendPrivate( remove );
	}
	
	ns.IRC.prototype.sendPrivate = function( action ) {
		const self = this;
		var priv = {
			type : 'private',
			data : action,
		};
		self.send( priv );
	}
	
	ns.IRC.prototype.handlePrivateChat = function( msg ) {
		const self = this;
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
		const self = this;
		var conf = {
			moduleId          : self.clientId,
			parentConn        : self.conn,
			parentView        : self.parentView,
			dormantParentPath : self.dormantPrivMsgPath,
			contact           : contact,
			user              : self.identity,
			viewTheme         : self.module.settings.ircTheme,
		};
		
		var privObj = new library.contact.IrcPrivMsg( conf );
		self.contacts[ contact.clientId ] = privObj;
		contact.identity = privObj.identity;
		self.view.send({
			type : 'private',
			data : contact,
		});
		
		if ( forceOpen ) {
			privObj.startChat();
		}
	}
	
	ns.IRC.prototype.toAllChannels = function( msg ) {
		const self = this;
		var allChan = self.getContactsByType( 'IrcChannel' );
		self.sendToContacts( allChan, msg );
		
	}
	
	ns.IRC.prototype.toAllPrivMsg = function( msg ) {
		const self = this;
		var allPriv = self.getContactsByType( 'IrcPrivMsg' );
		self.sendToContacts( allPriv, msg );
	}
	
	ns.IRC.prototype.toAll = function( msg ) {
		const self = this;
		var ids = Object.keys( self.contacts );
		self.sendToContacts( ids, msg );
	}
	
	ns.IRC.prototype.getContactsByType = function( type ) {
		const self = this;
		var allIds = Object.keys( self.contacts );
		var ofType = allIds.filter( checkType );
		return ofType;
		
		function checkType( id ) {
			var contact = self.contacts[ id ];
			return !!( contact instanceof library.contact[ type ]);
		}
	}
	
	ns.IRC.prototype.sendToContacts = function( ids, msg ) {
		const self = this;
		ids.forEach( sendTo );
		function sendTo( id ) {
			var contact = self.contacts[ id ];
			if ( !contact )
				return;
			
			contact.handleEvent( msg );
		}
	}
	
	ns.IRC.prototype.clientDisconnect = function( msg ) {
		const self = this;
		self.cleanContacts();
	}
	
	ns.IRC.prototype.optionReconnect = function() {
		const self = this;
		const msg = {
			type : 'reconnect',
			data : {
				quitMessage : 'brb',
			},
		};
		self.send( msg );
	}
	
	ns.IRC.prototype.optionDisconnect = function() {
		const self = this;
		const msg = {
			type : 'disconnect',
			data : {
				quitMessage : 'bye',
			},
		};
		self.send( msg );
	}
	
	ns.IRC.prototype.leaveChannel = function( msg ) {
		const self = this;
		console.log( 'IRC.leaveChannel - NYI', msg );
	}
	
	ns.IRC.prototype.sendCommand = function( msg, source ) {
		const self = this;
		source = source || '';
		var cmd = {
			type : 'command',
			data : msg,
		};
		
		self.send( cmd );
	}
	
	ns.IRC.prototype.sendMessage = function( msg ) {
		const self = this;
		var wrap = {
			type : 'message',
			data : msg,
		};
		self.send( wrap );
	}
	
	ns.IRC.prototype.clearState = function( msg ) {
		const self = this;
		self.cleanContacts();
	}
	
	ns.IRC.prototype.closeViews = function() {
		const self = this;
		if ( self.consoleView )
			self.consoleView.close();
		if ( self.settingsView )
			self.settingsView.close();
	}
	
	ns.IRC.prototype.close = function() {
		const self = this;
		self.closeViews();
		self.baseClose();
	}
	
})( library.module );

// Telegram
(function( ns, undefined ) {
	ns.Telegram = function( ...args ) {
		const self = this;
		
		library.module.BaseModule.call( self, ...args );
		
		self.init();
	}
	
	ns.Telegram.prototype = Object.create( library.module.BaseModule.prototype );
	
	ns.Telegram.prototype.init = function() {
		const self = this;
		console.log( 'app.module.Telegram.init' );
	}
	
})( library.module );
