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

var library = window.library || {};
var friendUP = window.friendUP || {};
var api = window.api || {};
var hello = window.hello || {};

library.system = library.system || {};
library.rtc = library.rtc || {};


// LOGIN
(function( ns, undefined ) {
	ns.Login = function( defaultAccount, onlogin, onclose ) {
		if ( !( this instanceof ns.Login ))
			return new ns.Login( onlogin, onclose );
		
		var self = this;
		self.defaultAccount = defaultAccount;
		self.onlogin = onlogin;
		self.onclose = onclose;
		self.accounts = {};
		self.autoLogin = false;
		self.lastLoginResponse = null;
		self.view = null;
		
		self.init();
	}
	
	ns.Login.prototype.init = function() {
		var self = this;
		self.get();
	}
	
	ns.Login.prototype.show = function() {
		var self = this;
		hello.closeLoading();
		
		if ( self.view )
			return;
		
		const filePath = 'html/login.html';
		const winConf = {
			title : hello.config.appName + ' : Login',
			width : 300,
			height: 400,
		};
		
		const initData = {
			fragments : hello.commonFragments,
		};
		
		self.view = new api.View(
			filePath,
			winConf,
			initData,
			unhandled,
			viewClosed
		);
		
		self.view.onready = ready;
		self.bindView();
		
		function ready( msg ) {
			var accountKeys = Object.keys( self.accounts );
			if ( !accountKeys.length ) {
				self.toView({
					type : 'showguide',
				});
				return;
			}
			
			accountKeys.forEach( addToView )
			function addToView( accKey ) {
				var account = self.accounts[ accKey ];
				self.addToView( account );
			}
			
			if ( self.lastLoginResponse )
				self.toView({
					type : 'response',
					data : self.lastLoginResponse,
				});
		};
		
		function unhandled( e ) { console.log( 'unhandled login view event', e ); }
		function viewClosed( msg ) {
			hello.conn.state.unsubscribe( 'login' );
			self.view = null;
			if ( !self.onclose )
				return;
			
			var onclose = self.onclose;
			delete self.onclose;
			onclose();
		}
	}
	
	ns.Login.prototype.bindView = function() {
		var self = this;
		self.view.on( 'create', create );
		self.view.on( 'login', login );
		self.view.on( 'delete', deleteAccount );
		
		function create( msg ) { self.showCreate( msg ); }
		function login( msg ) { self.login( msg ); }
		function deleteAccount( msg ) { self.deleteAccount( msg ); }
	}
	
	ns.Login.prototype.get = function() {
		var self = this;
		hello.request.send(
			{
				verb : 'GET',
				url : '/read',
				data : {
					userId : hello.app.userId,
				},
			},
			getBack
		);
		
		function getBack( msg ) {
			if ( msg.status !== 200 ) {
				console.log( 'hello.login.get -failed', msg );
				return;
			}
			
			handle( msg.data );
		}
		
		function handle( accounts ) {
			if ( !accounts.length ) {
				console.log( 'no accounts' );
				self.autoCreate( doneBack );
				return;
				
				function doneBack( success ) {
					if ( success )
						return;
					
					console.log( 'failed to autocreate, showing logins' );
					self.show();
					self.showCreate();
				}
			}
			
			accounts.forEach( add )
			function add( account ) { self.add( account ); }
			
			if ( doAutoLogin( accounts ))
				return;
			
			self.show();
			
			function doAutoLogin( accounts ) {
				if ( self.defaultAccount ) {
					self.login( self.defaultAccount );
					return true;
				}
				
				if ( hello.forceShowLogin )
					return false;
				
				if ( accounts.length != 1 )
					return false;
				
				var account = accounts[ 0 ];
				if ( !account.skipPass )
					return false;
				
				self.login( account );
				return true;
			}
		}
	}
	
	ns.Login.prototype.add = function( account ) {
		var self = this;
		self.accounts[ account.clientId ] = account;
		if ( self.view )
			self.addToView( account );
	}
	
	ns.Login.prototype.addToView = function( account ) {
		var self = this;
		self.toView({
			type : 'add',
			data : account,
		});
	}
	
	ns.Login.prototype.showCreate = function() {
		var self = this;
		self.createView = new library.view.ComponentForm({
			file : 'createAccount.html',
			windowConf : {
				title : Application.i18n('i18n_create_new_account'),
				width : 400,
				height : 300,
			},
			onsubmit : createSubmit,
			onclose : createClose,
		});
		
		function createSubmit( data ) { self.createAccount( data ); }
		function createClose() {
			self.createView = null;
		}
	}
	
	ns.Login.prototype.autoCreate = function( successBack ) {
		var self = this;
		var data = {
			name : hello.identity.alias,
			skipPass : true,
		};
		
		self.createAccount( data );
		successBack( true );
	}
	
	ns.Login.prototype.createAccount = function( data ) {
		var self = this;
		data.userId = hello.identity.fupId;
		var req = {
			url : '/create',
			verb : 'post',
			data : data,
		};
		
		hello.request.send( req, createBack );
		function createBack( response ) {
			if ( self.createView )
				self.createView.response( response );
			
			if ( !response.success )
				return;
			
			var account = response.data;
			self.add( account );
			account.password = data.password;
			self.login( account );
		}
	}
	
	ns.Login.prototype.login = function( msg ) {
		var self = this;
		var account = self.accounts[ msg.clientId ];
		if ( !account ) {
			console.log( 'login.login - invalid client id', msg );
			console.log( 'accounts', self.accounts );
			return;
		}
		
		var request = {
			url : '/login',
			verb : 'post',
			data : {
				userId : hello.app.userId,
				name : account.name,
				password : msg.password
			},
		};
		hello.request.send( request, logBack );
		function logBack( response ) {
			self.loginResponse( response );
		}
	}
	
	ns.Login.prototype.loginResponse = function( response ) {
		var self = this;
		self.lastLoginResult = response;
		if ( !response || response.status != 200 ) {
			console.log( 'login failed', response );
			hello.log.notify( 'Login failed, wrong password' );
			hello.log.show();
			self.show();
			return;
		}
		
		self.done( response.data );
	}
	
	ns.Login.prototype.deleteAccount = function( data ) {
		var self = this;
		var account = self.accounts[ data.account ];
		
		if ( !account ) {
			console.log( 'app.login.deleteAccount - invalid account id ' );
			return;
		}
		
		var req = {
			url : '/remove',
			verb : 'post',
			data : {
				userId : hello.app.userId,
				name : account.name,
				password : data.password,
			},
		};
		hello.request.send( req, removeBack );
		function removeBack( response ) {
			if ( !response.success )
				return;
			
			self.remove( data.account );
		}
	}
	
	ns.Login.prototype.remove = function( id ) {
		var self = this;
		delete self.accounts[ id ];
		self.removeFromView( id );
	}
	
	ns.Login.prototype.removeFromView = function( id ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.toView({
			type : 'remove',
			data : id
		});
	}
	
	ns.Login.prototype.logout = function( doneBack ) {
		var self = this;
		var req = {
			verb : 'POST',
			url : '/account/logout',
		};
		
		hello.request.send(
			req,
			logBack
		);
		
		function logBack() {
			if ( doneBack )
				doneBack();
		}
	}
	
	ns.Login.prototype.done = function( msg ) {
		var self = this;
		var loginCallback = self.onlogin;
		self.onlogin = null;
		
		if ( loginCallback )
			loginCallback( msg );
	}
	
	ns.Login.prototype.close = function() {
		var self = this;
		if ( self.view ) {
			console.log( 'login.close - found view - closing' );
			self.view.close();
		}
		
		if ( self.createView )
			self.createView.close();
	}
	
	ns.Login.prototype.viewEvent = function( msg ) {
		var self = this;
		console.log( 'unhandled login event', msg );
		return;
	}
	
	ns.Login.prototype.toView = function( msg ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
})( library.system );


// MODULE CONTROL
(function( ns, undefined ) {
	ns.ModuleControl = function( conf ) {
		if ( !( this instanceof ns.ModuleControl ))
			return new ns.ModuleControl( conf );
		
		var self = this;
		self.parentView = conf.parentView;
		//self.firstLogin = conf.firstLogin;
		self.active = {};
		self.moduleMap = null;
		self.conn = null;
		self.view = null;
		
		self.init();
	}
	
	// Public
	
	ns.ModuleControl.prototype.reconnect = function() {
		const self = this;
		mids = Object.keys( self.active );
		mids.forEach( callReconnect );
		function callReconnect( mId ) {
			let mod = self.active[ mId ];
			mod.reconnect();
		}
	}
	
	ns.ModuleControl.prototype.setIsOnline = function( isOnline ) {
		const self = this;
		console.log( 'moduleCtrl.setIsOnline', isOnline );
	}
	
	// Private
	
	ns.ModuleControl.prototype.init = function() {
		var self = this;
		self.availableModules = setAvailable( hello.config.modules );
		self.moduleMap =  {
			treeroot : library.module.Treeroot,
			irc : library.module.IRC,
			presence : library.module.Presence,
		};
		
		self.conn = new library.system.Message({
			id : 'module',
			handler : receiveMessage,
		});
		
		self.connMap = {
			'add' : add,
			'remove' : remove,
			'create' : create,
		};
		
		function receiveMessage( msg ) { self.receiveMessage( msg ); }
		function add( msg ) { self.add( msg ); }
		function remove( msg ) { self.handleRemove( msg ); }
		function create( e ) { self.createResult( e ); }
		
		self.view = new library.component.SubView({
			parent : self.parentView,
			type : 'module'
		});
		self.bindView();
		
		function setAvailable( modules ) {
			var available = {};
			var modKeys = Object.keys( modules );
			modKeys.forEach( set );
			function set( key ) {
				var mod = modules[ key ];
				available[ mod.type ] = mod.name;
			}
			return available;
		}
	}
	
	ns.ModuleControl.prototype.receiveMessage = function( msg ) {
		var self = this;
		var handler = self.connMap[ msg.type ];
		
		if ( !handler ) {
			console.log( 'ModuleControl - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.ModuleControl.prototype.bindView = function() {
		var self = this;
		self.view.on( 'create', create );
		
		function create( msg ) { self.create( msg ); }
	}
	
	ns.ModuleControl.prototype.create = function( module ) {
		var self = this;
		if ( module )
			self.doCreate( module );
		else
			self.showCreateForm();
	}
	
	ns.ModuleControl.prototype.add = function( modConf ) {
		var self = this;
		if ( modConf === null ) {
			self.handleNoModule();
			return;
		}
		
		var Module = self.moduleMap[ modConf.type ];
		if ( !Module ) {
			console.log( 'app.ModuleControl.add - not a real module ', modConf );
			return;
		}
		
		if ( self.active[ modConf.clientId ]) {
			console.log( 'module already added', modConf );
			return;
		}
		
		var conf = {
			module     : modConf,
			parentView : self.parentView,
			onremove   : onRemove,
		};
		
		var mod = new Module( conf );
		self.active[ mod.clientId ] = mod;
		var viewConf = {
			identity : mod.identity,
			module : mod.module,
		};
		self.addToView( viewConf );
		
		function onRemove() {
			self.remove( modConf.clientId );
		}
	}
	
	ns.ModuleControl.prototype.remove = function( mId ) {
		var self = this;
		var rem = {
			type : 'remove',
			data : mId,
		};
		self.send( rem );
	}
	
	ns.ModuleControl.prototype.handleNoModule = function() {
		var self = this;
		console.log( 'handleNoModule' );
		
		return;
		
		/*
		if ( self.firstLogin ) {
			self.handleFirstLogin();
		}
		*/
		
		var description = {
			type : 'treeroot',
			name : 'Treeroot',
		};
		self.view.sendMessage({
			type : 'askaddmodule',
			data : description,
		});
	}
	
	ns.ModuleControl.prototype.handleFirstLogin = function() {
		var self = this;
		// get user info
		hello.getUserInfo( userBack );
		function userBack( fupUser ) {
			addLive( fupUser );
			addIrc( fupUser );
		}
		
		function addLive( fupUser ) {
			var id = {
				name   : fupUser.Name,
				avatar : '',
			};
			var live = {
				type     : 'live',
				settings : {
					identity : id,
				},
			};
			self.create( live );
		}
		
		function addIrc( fupUser ) {
			var irc = {
				type : 'irc',
				settings : {
					nick : fupUser.Name,
				},
			};
			
			self.create( irc );
		}
	}
	
	ns.ModuleControl.prototype.showCreateForm = function() {
		var self = this;
		self.createView = new library.view.FormView({
			file : 'addModule.html',
			windowConf : {
				title  : Application.i18n('i18n_add_chat_account'),
				width  : 300,
				height : 180,
			},
			inputMap : {
				type : self.availableModules,
			},
			submitHandler : submitHandler,
			readyCallback : viewReady,
		});
		
		function viewReady() {
			
		}
		
		function submitHandler( msg ) { self.doCreate( msg ); }
	}
	
	ns.ModuleControl.prototype.doCreate = function( data ) {
		var self = this;
		var req = {
			type : 'create',
			data : data,
		};
		
		self.send( req );
	}
	
	ns.ModuleControl.prototype.createResult = function( res ) {
		var self = this;
		if ( self.createView )
			self.createView.close();
		
		/*
		function createBack( res ) {
			if ( res.success )
				onSuccess();
			else
				onErr( res );
			
			function onSuccess() {
				if ( self.createView ) {
					self.createView.close();
					self.createView = null;
				}
			}
			
			function onErr( res ) {
				if ( self.createView )
					self.createView.sendMessage({
						type : 'error',
						data : res.message,
					});
				else
					showErrorInMainView( res );
			}
			
			function showErrorInMainView( res ) {
				console.log( 'showErrorImMainView - NYI', res  );
			}
		}
		*/
	}
	
	ns.ModuleControl.prototype.addToView = function( module ) {
		var self = this;
		self.view.sendMessage({
			type : 'add',
			data : module
		});
	}
	
	ns.ModuleControl.prototype.updateInView = function(  module ) {
		var self = this;
		self.view.sendMessage({
			type : 'update',
			data : module
		});
	}
	
	ns.ModuleControl.prototype.handleRemove = function( moduleId ) {
		var self = this;
		var module = self.active[ moduleId ];
		
		if ( !module ) {
			console.log( 'invalid module id ');
			return;
		}
		
		module.close();
		delete self.active[ moduleId ];
		self.removeFromView( moduleId );
	}
	
	ns.ModuleControl.prototype.removeFromView = function( id ) {
		var self = this;
		self.view.sendMessage({
			type : 'remove',
			data : id
		});
	}
	
	ns.ModuleControl.prototype.get = function( id ) {
		var self = this;
		return self.active[ id ];
	}
	
	ns.ModuleControl.prototype.send = function( msg ) {
		var self = this;
		self.conn.send( msg );
	}
	
	ns.ModuleControl.prototype.close = function() {
		var self = this;
		var ids = Object.keys( self.active );
		ids.forEach( callEnd );
		function callEnd( moduleKey ) {
			self.active[ moduleKey ].close();
			delete self.active[ moduleKey ];
		}
		
		self.conn.close();
		self.view.close();
	}
})( library.system );


// RTCCONTROL
(function( ns, undefined ) {
	ns.RtcControl = function() {
		if ( !( this instanceof ns.RtcControl ))
			return new ns.RtcControl();
		
		var self = this;
		self.session = null;
		self.roomRequests = {};
		
		self.init();
	}
	
	// Public
	
	ns.RtcControl.prototype.joinLive = function( conf, eventSink, onclose ) {
		const self = this;
		const sessionConf = {
			invite      : null,
			user        : conf.identity,
			permissions : conf.permissions,
			constraints : conf.constraints,
		};
		
		self.createSession( sessionConf, eventSink, onclose );
	}
	
	ns.RtcControl.prototype.invite = function( contact ) {
		const self = this;
		self.service.invite( contact );
	}
	
	ns.RtcControl.prototype.createRoom = function( contacts, selfie, permissions ) {
		var self = this;
		var sessionConf = {
			invite      : null,
			isHost      : true,
			user        : selfie,
			contacts    : contacts,
			permissions : permissions,
		};
		self.getRoom( 'create', sessionConf );
	}
	
	ns.RtcControl.prototype.askClient = function( invite, inviteFrom, selfie ) {
		const self = this;
		if ( self.session && isInRoomSession( invite.roomId ))
			return;
		
		const inviteHost = invite.host.split( '/' )[ 0 ];
		const localHost = self.service.getHost();
		api.Say( 'Live invite received', { i : invite, 'if' : inviteFrom, s : selfie });
		const message = inviteFrom.name
				+ ' ' + Application.i18n('i18n_has_invited_you_to_live');
		const conf = {
			message       : message,
			activeSession : !!self.session,
		};
		
		// if the inviters host is different, we can only join as a guest
		// and the rtcAsk dialog must offer to open in a tab
		if ( isOtherDomain( inviteHost, localHost )) {
			conf.remote = inviteHost;
			conf.guestLink = buildGuestLink( invite, selfie );
		}
		
		const askView = new library.view.RtcAsk( conf, permissionBack );
		function permissionBack( result ) {
			if ( !result || !result.accept ) {
				return;
			}
			
			self.joinRoom( invite, inviteFrom, selfie, result.permissions );
		}
		
		function isInRoomSession( roomId ) {
			if ( !roomId )
				return false;
			
			return self.session.roomId === roomId;
		}
		
		function isOtherDomain( a, b ) {
			let ac = clean( a );
			let bc = clean( b );
			return ac !== bc;
			
			function clean( d ) {
				let m = d.match( /^([a-zA-Z0-9\.-]+)(:|\/)/ );
				if ( m )
					return m[ 1 ];
				else
					return d;
			}
		}
		
		function buildGuestLink( invite, user ) {
			invite.identity = {
				name   : user.name,
				avatar : user.avatar,
			};
			invite.type = 'live';
			const bundle = {
				type : 'live-invite',
				data : invite,
			};
			let link = hello.intercept.buildURL( bundle, false, null );
			link = link.url;
			link += '&theme=borderless';
			return link;
		}
	}
	
	ns.RtcControl.prototype.joinRoom = function( invite, inviteFrom, selfie, permissions ) {
		var self = this;
		if ( self.session )
			self.closeSession();
		
		if ( !selfie ) {
			selfie = {
				name   : library.tool.getName(),
				avatar : library.component.Identity.prototype.avatar,
			};
		}
		
		var sessionConf = {
			invite      : invite,
			inviteFrom  : inviteFrom,
			user        : selfie,
			isHost      : false,
			contacts    : null,
			permissions : permissions,
		};
		self.getRoom( 'join', sessionConf );
	}
	
	// Presence module calls this and provides an interface
	ns.RtcControl.prototype.setServiceProvider = function( provider ) {
		var self = this;
		self.service = provider;
	}
	
	// private
	
	ns.RtcControl.prototype.init = function() {
		var self = this;
		
	}
	
	ns.RtcControl.prototype.askHost = function( contacts, selfie ) {
		var self = this;
		var conf = {
			message : 'permissions for live chat',
			constraints : self.constraints,
		};
		var askView = new library.view.RtcAsk( conf, permissionBack );
	}
	
	ns.RtcControl.prototype.getRoom = function( action, sessionConf ) {
		var self = this;
		var roomReq = {
			type : action,
			data : sessionConf,
		};
		self.service.getRoom( roomReq );
	}
	
	ns.RtcControl.prototype.createSession = function( conf, eventSink, onclose ) {
		var self = this;
		if ( self.session ) {
			const session = self.session;
			self.session = null;
			session.close();
		}
		
		conf.user = conf.user || self.service.getIdentity();
		conf.permissions = conf.permissions || {
			send : {
				audio : true,
				video : true,
			},
			receive : {
				audio : true,
				video : true,
			},
		};
		
		self.session = new library.rtc.RtcSession( conf, eventSink, onclose, sessionClosed );
		return self.session;
		
		function sessionClosed() {
			self.session = null;
		}
	}
	
	ns.RtcControl.prototype.getSession = function() {
		var self = this;
		return self.session;
	}
	
	ns.RtcControl.prototype.closeSession = function() {
		var self = this;
		if ( !self.session )
			return;
		
		var sess = self.session;
		self.session = null;
		sess.close();
	}
	
})( library.system );


// ACCOUNT
(function( ns, undefined ) {
	ns.Account = function( conf ) {
		if ( !( this instanceof ns.Account ))
			return new ns.Account( conf );
		
		var self = this;
		self.availability = null;
		self.clientId = conf.account.clientId;
		self.displayName = conf.account.name;
		self.skipPass = conf.account.skipPass;
		self.settings = conf.account.settings || {};
		self.conn = null;
		
		self.init( conf.parentView );
	}
	
	// Public
	
	ns.Account.prototype.sendReady = function( msg ) {
		var self = this;
		var ready = {
			type : 'ready',
			data : msg,
		};
		self.send( ready );
	}
	
	// Private
	
	ns.Account.prototype.init = function( parentView ) {
		var self = this;
		self.conn = new library.system.Message({
			id : 'account',
			handler : receiveMsg,
		});
		function receiveMsg( e ) { self.receiveMsg( e ); }
		
		self.msgMap = {
			'settings' : showSettings,
			'setting' : updateSetting,
		};
		function showSettings( e ) { self.showSettings( e ); }
		function updateSetting( e ) { self.updateSetting( e ); }
		
		self.updateMap = {
			'popupChat' : updatePopupChat,
			'msgAlert'  : updateMsgAlert,
		};
		
		function updatePopupChat( e ) { self.updatePopupChat( e ); }
		function updateMsgAlert( e ) { self.updateMsgAlert( e ); }
		
		self.view = new library.component.SubView({
			parent : parentView,
			type : 'account',
			ready : viewIsReady,
		});
		function viewIsReady() { console.log( 'app.Account.viewIsReady' ); }
		self.bindView();
	}
	
	ns.Account.prototype.receiveMsg = function( msg ) {
		var self = this;
		var handler = self.msgMap[ msg.type ];
		if ( !handler ) {
			console.log( 'Account.receiveMsg - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Account.prototype.bindView = function() {
		var self = this;
		self.view.on( 'settings', loadSettings );
		self.view.on( 'setting', persistSetting );
		
		function loadSettings( msg ) { self.getSettings(); }
		function persistSetting( msg ) { self.persistSetting( msg ); }
	}
	
	ns.Account.prototype.getSettings = function() {
		var self = this;
		var msg = {
			type : 'settings',
		};
		self.send( msg );
	}
	
	ns.Account.prototype.persistSetting = function( data ) {
		var self = this;
		console.log( 'account.persistSetting - NYI???', data );
	}
	
	ns.Account.prototype.showSettings = function( data ) {
		var self = this;
		if ( self.settingsView )
			return;
		
		var conf = {
			type : 'account',
			windowConf : {
				title : Application.i18n('i18n_account_settings'),
				width : 350,
				height : 400,
			},
			onsave : saveHandler,
			onclose : closeHandler,
			settings : data,
		};
		self.settingsView = new library.view.Settings( conf );
		
		function closeHandler() { self.settingsView = null; }
		function saveHandler( data, callback ) { self.saveSetting( data, callback ); }
	}
	
	ns.Account.prototype.saveSetting = function( data, callback ) {
		var self = this;
		var msg = {
			type : 'setting',
			data : data,
		};
		self.send( msg );
	}
	
	ns.Account.prototype.updateSetting = function( update ) {
		var self = this;
		if ( self.settingsView )
			self.settingsView.saved( update );
		
		var handler = self.updateMap[ update.setting ];
		if ( !handler ) {
			console.log( 'no handler for ', update );
			return;
		}
		
		handler( update.value );
	}
	
	ns.Account.prototype.updatePopupChat = function( value ) {
		var self = this;
		self.settings.popupChat = value;
	}
	
	ns.Account.prototype.updateMsgAlert = function( value ) {
		var self = this;
		self.settings.msgAlert = value;
	}
	
	ns.Account.prototype.load = function( account ) {
		var self = this;
		self.clientId = account.clientId;
		self.name = account.name;
		hello.modules.load();
	}
	
	ns.Account.prototype.getName = function() {
		var self = this;
		return self.displayName || self.clientId || 'nope, no name';
	}
	
	ns.Account.prototype.send = function( msg ) {
		var self = this;
		self.conn.send( msg );
	}
	
	ns.Account.prototype.close = function() {
		var self = this;
		if ( self.conn )
			self.conn.close();
		
		if ( self.view )
			self.view.close();
	}
	
})( library.system );


// NOTIFICATION ( pretty much a subview of log )
(function( ns, undefined ) {
	ns.Notification = function( conf ) {
		if ( !( this instanceof ns.Notification ))
			return new ns.Notification( conf );
		
		var self = this;
		self.type = 'notification';
		self.handlerId = null;
		
		self.init( conf.parentView );
	}
	
	ns.Notification.prototype.init = function( parentView ) {
		var self = this;
		self.view = new library.component.SubView({
			parent : parentView,
			type : self.type,
		});
		
		self.bindView();
		self.handlerId = hello.log.listen( newLogItem );
		var latest = hello.log.getLatestEntry();
		self.set( latest );
		
		function newLogItem( msg ) { self.newLogItem( msg ); }
	}
	
	ns.Notification.prototype.newLogItem = function( msg ) {
		var self = this;
		self.set( msg );
	}
	
	ns.Notification.prototype.bindView = function() {
		var self = this;
		self.view.on( 'toggle', logToggleView );
		
		function logToggleView( msg ) { self.toggleLogView( msg ); }
	}
	
	ns.Notification.prototype.toggleLogView = function( bool ) {
		var self = this;
		var isNowOpen = hello.log.toggle();
		self.view.sendMessage({
			type : 'toggle',
			data : isNowOpen.toString(),
		});
	}
	
	ns.Notification.prototype.set = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
	ns.Notification.prototype.close = function() {
		var self = this;
		if ( self.handlerId && hello.log )
			hello.log.weDidntListen( self.handlerId );
		else
			console.log( 'app.Notification.close - missing the things, oops?', { id : self.handlerId, log : hello.log });
		
		self.view.close();
	}
	
})( library.system );


// LOG
(function( ns, undefined ) {
	ns.Log = function( onclose ) {
		if ( !( this instanceof ns.Log ))
			return new ns.Log( onclose );
		
		var self = this;
		self.onclose = onclose;
		self.log = [];
		self.view = null;
		self.listener = {};
		
		self.init();
	}
	
	// PUBLIC
	ns.Log.prototype.positive = function( message, timestamp ) {
		var self = this;
		self.normalize( message, 'positive', timestamp );
	}
	
	ns.Log.prototype.notify = function( message, timestamp ) {
		var self = this;
		self.normalize( message, 'notify', timestamp );
	}
	
	ns.Log.prototype.alert = function( message, timestamp ) {
		var self = this;
		self.normalize( message, 'alert', timestamp );
	}
	
	ns.Log.prototype.waiting = function( message, startTime, endTime ) {
		var self = this;
		var data = {
			type : 'waiting',
			data : {
				message : message,
				startTime : startTime,
				endTime : endTime,
			},
		};
		
		self.set( data );
	}
	
	// plain ( same as info )
	ns.Log.prototype.add = function( message ) {
		var self = this;
		self.normalize( message );
	}
	
	// show ( you_dont_say.jpg )
	ns.Log.prototype.show = function() {
		var self = this;
		self.showView();
	}
	
	// privates
	
	ns.Log.prototype.init = function() {
		var self = this;
	}
	
	ns.Log.prototype.showView = function() {
		var self = this;
		if ( self.view )
			return;
		
		const winConf = {
			title : Application.i18n('i18n_friend_chat_log'),
			width : 350,
			height : 400,
		};
		
		const initData = {
			fragments : hello.commonFragments,
		};
		
		self.view = hello.app.createView(
			'html/log.html',
			winConf,
			initData,
			null,
			viewClosed
		);
		
		self.view.onready = ready;
		
		function ready() {
			self.bindView();
			self.pushLogToView();
		}
		
		function viewClosed( msg ) {
			self.view = null;
			const onclose = self.onclose;
			delete self.onclose;
			if ( onclose )
				onclose();
		}
	}
	
	ns.Log.prototype.bindView = function() {
		var self = this;
		self.view.on( 'clear', clear );
		
		function clear( msg ) { self.clear(); }
	}
	
	ns.Log.prototype.pushLogToView = function() {
		var self = this;
		self.log.forEach( add );
		function add( item ) {
			self.addToView( item );
		}
	}
	
	ns.Log.prototype.hide = function() {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.close();
		self.view = null;
	}
	
	ns.Log.prototype.toggle = function() {
		var self = this;
		if ( self.view ) {
			self.hide();
			return false;
		}
		
		if ( !self.view ) {
			self.show();
			return true;
		}
	}
	
	ns.Log.prototype.normalize = function( msg, alertLevel, timestamp ) {
		var self = this;
		if ( typeof( msg ) == 'string' ) {
			msg = friendUP.tool.ucfirst( msg );
			msg = self.buildNotification( msg, alertLevel, timestamp );
		}
		
		self.set( msg );
	}
	
	ns.Log.prototype.set = function( data ) {
		var self = this;
		self.log.push( data );
		self.addToView( data );
		self.emit( data );
	}
	
	ns.Log.prototype.addToView = function( msg ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
	ns.Log.prototype.buildNotification = function( msg, alertLevel, timestamp ) {
		var self = this;
		var alertLevel = alertLevel || 'info';
		var time = timestamp || Date.now();
		var msg = {
			type : alertLevel,
			data : {
				message : msg,
				time : time,
			},
		};
		
		return msg;
	}
	
	ns.Log.prototype.clear = function() {
		var self = this;
		self.log = [];
		var msg = {
			type : 'clear',
		};
		self.addToView( msg );
		self.emit( msg );
	}
	
	ns.Log.prototype.getLatestEntry = function() {
		var self = this;
		var lastIndex = self.log.length -1;
		return self.log[ lastIndex ];
	}
	
	ns.Log.prototype.emit = function( msg ) {
		var self = this;
		var listenerIds = Object.keys( self.listener );
		listenerIds.forEach( emit );
		function emit( id ) {
			var handler = self.listener[ id ];
			handler( msg );
		}
	}
	
	ns.Log.prototype.listen = function( handler ) {
		var self = this;
		var id = friendUP.tool.uid( 'listener' );
		self.listener[ id ] = handler;
		return id;
	}
	
	ns.Log.prototype.weDidntListen = function( handlerId ) {
		var self = this;
		if ( self.listener[ handlerId ])
			delete self.listener[ handlerId ];
	}
	
})( library.system );


// CONNECTION
(function( ns, undefined ) {
	ns.Connection = function( altHost, onState ) {
		if ( !( this instanceof ns.Connection ))
			return new ns.Connection( altHost, onState );
		
		const self = this;
		self.altHost = altHost;
		self.onstate = onState;
		self.readyCallback = null;
		
		self.host = null;
		self.state = null;
		self.socket = null;
		self.subscriber = {};
		
		self.init();
	}
	
	// Public
	
	ns.Connection.prototype.send = function( msg ) {
		var self = this;
		if ( !msg || !self.socket )
			return false;
		
		self.socket.send( msg );
		return true;
	}
	
	ns.Connection.prototype.connect = function( callback ) {
		var self = this;
		if( !hello.config || !hello.config.host ) {
			throw new Error( 'missing websocket config stuff' );
			return;
		}
		
		if ( self.socket )
			self.clear();
		
		if ( callback )
			self.readyCallback = callback;
		
		var url = null;
		if ( self.altHost )
			url = self.altHost;
		else {
			var host = hello.config.host;
			var port = hello.config.chat.port;
			var protocol = hello.config.tls ? 'wss' : 'ws';
			url = library.tool.buildDestination( protocol, host, port );
		}
		
		self.host = url;
		self.socket = new library.component.Socket({
			url : url,
			protocol   : 'text',
			authBundle : hello.getAuthBundle(),
			onmessage  : onMessage,
			onstate    : onState,
			onend      : onEnd,
		});
		
		function onMessage( msg ) { self.message( msg ); }
		function onState( state ) { self.handleState( state ); }
		function onEnd( msg ) { self.handleEnd( msg ); }
	}
	
	ns.Connection.prototype.reconnect = function( callback ) {
		const self = this;
		if ( callback )
			self.readyCallback = callback;
		
		if ( !self.socket ) {
			self.connect();
			return;
		}
		
		self.socket.reconnect();
	}
	
	ns.Connection.prototype.close = function() {
		const self = this;
		if ( !self.socket )
			return;
		
		self.clear();
	}
	
	// Private
	
	ns.Connection.prototype.init = function() {
		var self = this;
		self.socketEventMap = {
			'connect'    : socketConnecting,
			'open'       : socketOpen,
			'session'    : socketSession,
			'close'      : socketClosed,
			'timeout'    : socketTimeout,
			'error'      : socketError,
			'ping'       : socketPing,
			'reconnect'  : socketReconnect,
		};
		function socketConnecting( e ) { self.socketConnecting( e ); }
		function socketOpen( e ) { self.socketOpen( e ); }
		function socketSession( e ) { self.socketSession( e ); }
		function socketClosed ( e ) { self.socketClosed( e ); }
		function socketTimeout( e ) { self.socketTimeout( e ); }
		function socketError ( e ) { self.socketError( e ); }
		function socketPing ( e ) { self.socketPing( e ); }
		function socketReconnect( e ) { self.socketReconnecting( e ); }
	}
	
	ns.Connection.prototype.handleState = function( event ) {
		const self = this;
		var handler = self.socketEventMap[ event.type ];
		if ( !handler ) {
			console.log( 'unknown socket state', event );
			return;
		}
		
		handler( event.data );
	}
	
	ns.Connection.prototype.socketConnecting = function( host ) {
		const self = this;
		self.onstate({
			type : 'connect',
			data : {
				host     : self.host,
			},
		});
	}
	
	ns.Connection.prototype.socketOpen = function( data ) {
		const self = this;
		hello.log.add( 'Connection open' );
		self.onstate({
			type : 'open',
		});
	}
	
	ns.Connection.prototype.socketSession = function( sid ) {
		const self = this;
		if ( self.readyCallback ) {
			let callback = self.readyCallback;
			delete self.readyCallback;
			callback( null, sid );
		}
		
		self.onstate({
			type : 'session',
			data : sid,
		});
	}
	
	ns.Connection.prototype.socketClosed = function( e ) {
		const self = this;
		hello.log.notify( 'Socket closed' );
		self.onstate({
			type : 'error',
			data : 'Connection to ' + self.host + ' closed',
		});
	}
	
	ns.Connection.prototype.socketTimeout = function( e ) {
		const self = this;
		console.log( 'socketTimeout', e );
		self.onstate({
			type : 'error',
			data : 'Connect attempt timed out: ' + self.host,
		});
	}
	
	ns.Connection.prototype.socketError = function( err ) {
		const self = this;
		hello.log.notify( 'Socket error' );
		self.onstate({
			type : 'error',
			data : 'Connection error to: ' + self.host,
		});
	}
	
	ns.Connection.prototype.socketPing = function( data ) {
		const self = this;
		// console.log( 'socketPing', data );
	}
	
	ns.Connection.prototype.socketReconnecting = function( reTime ) {
		const self = this;
		self.onstate({
			type : 'wait-reconnect',
			data : {
				time : reTime,
				host : self.host,
			},
		});
	}
	
	ns.Connection.prototype.handleEnd = function( data ) {
		const self = this;
		self.clear();
		let err = {
			type : 'end',
			data : 'Connection to ' + self.host + ' cannot be re-established',
		};
		
		if ( self.readyCallback ) {
			let callback = self.readyCallback;
			delete self.readyCallback;
			callback( err, null );
			return;
		}
		
		self.onstate( err );
	}
	
	ns.Connection.prototype.clear = function() {
		const self = this;
		if ( !self.socket )
			return;
		
		self.socket.close();
		self.socket = null;
	}
	
	ns.Connection.prototype.message = function( event ) {
		const self = this;
		var handler = self.subscriber[ event.type ];
		if ( !handler ) {
			console.log( 'hello.conn - no handler for event', event );
			return;
		}
		
		handler( event.data );
	}
	
	ns.Connection.prototype.on = function( type, callback ) {
		var self = this;
		if ( !type || !callback ) {
			console.log( 'connection.on: missing arguments',
				{ type : type, callback : callback });
			return false;
		}
		
		if ( self.subscriber[ type ] ) {
			console.log( 'subscriber type already exists - call .off( type ) to remove the previous one ', {
				type : type,
				subs : self.subscriber });
			throw new Error( 'error, see log ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^' );
		}
		
		self.subscriber[ type ] = callback;
	}
	
	ns.Connection.prototype.off = function( type ) {
		var self = this;
		if ( !type || !self.subscriber[ type ] ) {
			console.log( 'connection.off - invalid subscriber', type );
			return;
		}
		
		delete self.subscriber[ type ];
	}
	
})( library.system );


// MESSAGE

(function( ns, undefined ) {
	ns.Message = function( conf ) {
		if ( !( this instanceof ns.Message ))
			return new ns.Message( conf );
		
		var self = this;
		self.id = conf.id;
		self.handler = conf.handler;
		self.parentId = conf.parent;
		
		self.init();
	}
	
	ns.Message.prototype.init = function() {
		var self = this;
		hello.conn.on( self.id , message );
		function message( msg ) { self.message( msg ); }
	}
	
	ns.Message.prototype.send = function( msg ) {
		var self = this;
		var wrap = {
			type : self.parentId || self.id,
			data : msg
		};
		
		hello.conn.send( wrap );
	}
	
	ns.Message.prototype.message = function( data ) {
		var self = this;
		if ( !data ) {
			console.log( 'Message - empty message', msg );
			return;
		}
		
		this.handler( data );
	}
	
	ns.Message.prototype.close = function() {
		var self = this;
		hello.conn.off( self.id );
	}
	
})( library.system );


// REQUEST

(function(ns, undefined) {
	ns.Request = function( conf ) {
		if( !(this instanceof ns.Request))
			return new ns.Request( conf );
		
		var self = this;
		self.conn = conf.conn;
		self.request = {};
		
		self.init();
	}
	
	ns.Request.prototype.init = function()
	{
		var self = this;
		self.conn.on( 'request', receiveMessage );
		function receiveMessage( msg ) { self.message( msg ); }
	}
	
	ns.Request.prototype.message = function( data ) {
		var self = this;
		if( !data.callbackId ) {
			console.log( 'response with no callback: ', data );
			return;
		}
		
		var id = data.callbackId;
		var callback = self.request[ id ];
		if ( callback ) {
			callback( data.response );
			delete self.request[ id ];
			return;
		}
		
		console.log( 'unknown response: ', data );
	}
	
	ns.Request.prototype.send = function( msg, callback ) {
		var self = this;
		var wrap = {
			type : 'request',
			data : msg,
		};
		
		if ( !callback ) {
			console.log( 'request - no callback' );
			self.conn.send( wrap );
			return;
		}
		
		var id = null;
		do {
			id = friendUP.tool.uid( 'request' );
		} while ( self.request[ id ] )
		
		wrap.data.callbackId = id;
		self.request[ id ] = callback;
		
		self.conn.send( wrap );
	}
	
})( library.system );


// INTERCEPTOR
(function( ns, undefined ) {
	ns.Interceptor = function() {
		if ( !( this instanceof ns.Interceptor ))
			return new ns.Interceptor();
		
		var self = this;
		self.interceptToken = '&zwnj;&zwnj;&zwnj;';
		self.appUrl = '/webclient/app.html?app=FriendChat&data=';
		self.RX = null;
		
		self.init();
	}
	
	// public
	
	ns.Interceptor.prototype.check = function( message ) {
		var self = this;
		if ( !message || !message.toString ) {
			return null;
		}
		
		var str = message.toString();
		if ( !str || !str.length )
			return null;
		
		var match = str.match( self.typeRX );
		if ( !match )
			return null;
		
		// oh, look, we actually have stuff
		// index 2 is type
		var type = match[ 2 ];
		// index 3 is the data
		var data = match[ 3 ];
		
		var handler = self.typeMap[ type ];
		if ( handler )
			return handler( data );
		
		console.log( 'Interceptor.check - no handler for match', match );
		return null;
	}
	
	ns.Interceptor.prototype.buildURL = function( data, enableIntercept, message ) {
		const self = this;
		const res = {
			prefix : null,
			url    : null,
		};
		const dataString = friendUP.tool.stringify( data );
		if ( !dataString ) {
			console.log( 'Interceptor.buildURL - could not stringify', data );
			return null;
		}
		
		let urlData = window.encodeURIComponent( dataString );
		let intercept = '';
		let msgStr = '';
		if ( enableIntercept )
			intercept = self.interceptToken;
		
		if ( message && ( 'string' === typeof( message )) )
			msgStr = message + ' :: ';
		
		let prefix = ':: ' + intercept + msgStr;
		let url = hello.app.domain + self.appUrl + urlData;
		res.prefix = prefix;
		res.url = url;
		
		return res;
	}
	
	ns.Interceptor.prototype.buildJSON = function( data ) {
		const self = this;
		let res = {
			prefix : null,
			url    : null,
		};
		var dataString = friendUP.tool.stringify( data );
		if ( !dataString ) {
			console.log( 'Interceptor.buildJSON - could not stringify', data );
			return;
		}
		res.prefix = '::' + self.interceptToken;
		res.url = 'json://' + dataString;
		res.intercept = self.interceptToken + res.url;
		return res;
	}
	
	// private
	
	ns.Interceptor.prototype.init = function() {
		var self = this;
		var typeRX = '(' + self.interceptToken + ').*(https|json):\\/\\/(.*)';
		self.typeRX = new RegExp( typeRX, 'i' );
		self.typeMap = {
			'https' : handleURL,
			'json'  : handleJSON,
		};
		
		function handleURL( e ) { return self.handleURL( e ); }
		function handleJSON( e ) { return self.handleJSON( e ); }
	}
	
	ns.Interceptor.prototype.handleURL = function( dataStr ) {
		var self = this;
		var splitter = '&data=';
		var dataParts = dataStr.split( splitter );
		// remove the first part, leaving only data..
		dataParts.shift();
		// ..but there could be a '&data=' piece we accidentally split
		// on in the json, so re-join.
		var dataStr = dataParts.join( splitter );
		var unHTMLd = '';
		try {
			unHTMLd = window.decodeURIComponent( dataStr );
		} catch( ex ) {
			console.log( 'interveptor - ex', ex );
			console.log( 'interceptor - str', dataStr );
			return null;
		}
		var data = friendUP.tool.objectify( unHTMLd );
		var wrap = {
			type : 'url',
			data : data,
		};
		return wrap;
	}
	
	ns.Interceptor.prototype.handleJSON = function( jsonStr ) {
		var self = this;
		var json = friendUP.tool.parse( jsonStr );
		if ( !json ) {
			console.log( 'Interceptor.handleJSON - could not parse', jsonStr );
			return null;
		}
		
		var wrap = {
			type : 'json',
			data : json,
		}
		return wrap;
	}
	
})( library.system );


// CONFIRM
(function( ns, undefined ) {
	ns.Confirm = function( conf, callback ) {
		if ( !( this instanceof ns.Confirm ))
			return new ns.Confirm( viewConf, callback );
		
		var self = this;
		self.view =  null;
		self.filepath = conf.filepath;
		self.windowConf = conf.windowConf;
		self.config = conf.view;
		self.callback = callback;
		
		self.init();
	}
	
	ns.Confirm.prototype.init = function() {
		var self = this;
		self.view = new api.View({
			filepath : self.filepath,
			windowConf : self.windowConf,
		});
		
		self.bindView();
	}
	
	ns.Confirm.prototype.bindView = function() {
		var self = this;
		self.view.on( 'loaded', loaded );
		self.view.on( 'ready', ready );
		self.view.on( 'response', response );
		
		function loaded( msg ) { self.loaded( msg ); }
		function ready( msg ) { console.log( 'app.Confirm - view is ready' ); }
		function response( msg ) { self.response( msg ); }
	}
	
	ns.Confirm.prototype.loaded = function( msg ) {
		var self = this;
		self.view.sendMessage({
			type : 'initialize',
			data : self.config,
		});
	}
	
	ns.Confirm.prototype.response = function( msg ) {
		var self = this;
		self.callback( msg );
		self.view.close();
	}
	
})( library.system );


// RTCSESSION
// app side of the session
// interface for whats going on in the session view

(function( ns, undefined ) {
	ns.RtcSession = function( conf, eventSink, onclose, sessionClose ) {
		if ( !( this instanceof ns.RtcSession ))
			return new ns.RtcSession( conf, eventSink, onclose );
		
		var self = this;
		library.component.EventEmitter.call( self, eventSink );
		
		self.id = null; // set by initialize / open event
		self.roomId = conf.roomId;
		self.conf = conf;
		self.onclose = onclose;
		self.sessionclose = sessionClose;
		
		self.contacts = {};
		self.server = null;
		self.view = null;
		self.peers = null;
		self.queue = [];
		
		self.init();
	}
	
	ns.RtcSession.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	// from EventEmitter: on(), once(), off() and release();
	
	//
	ns.RtcSession.prototype.send = function( event ) {
		var self = this;
		if ( !self.view )  {
			console.log( '!rtc.session.view - dropping', event );
			return;
		}
		
		self.view.sendMessage( event );
	}
	
	ns.RtcSession.prototype.close = function() {
		const self = this;
		let sessionclose = self.sessionclose;
		let onclose = self.onclose;
		delete self.sessionclose;
		delete self.onclose;
		self.closeEventEmitter();
		
		if ( self.view ) {
			self.view.close();
			self.view = null;
		}
		
		if ( self.shareView ) {
			self.shareView.close();
			self.shareView = null;
		}
		
		if ( sessionclose )
			sessionclose();
		
		if ( onclose )
			onclose();
		
	}
	
	// private
	
	ns.RtcSession.prototype.init = function() {
		const self = this;
	}
	
	ns.RtcSession.prototype.initialize = function( init ) {
		const self = this;
		self.id = init.liveId;
		const liveConf = init.liveConf;
		console.log( 'liveConf', liveConf );
		const conf = self.conf;
		const viewConf = {
			userId     : liveConf.userId,
			peerList   : liveConf.peerList,
			isGuest    : conf.isGuest || false,
			identities : init.identities,
			rtcConf    : {
				ICE         : liveConf.ICE,
				permissions : conf.permissions,
				quality     : liveConf.quality,
				mode        : liveConf.mode,
			},
		};
		self.view = new library.view.Live(
			viewConf,
			eventSink,
			onClose
		);
		
		delete self.identities;
		
		function eventSink( type, data ) {
			self.emit( type, data );
		}
		
		function onClose( e ) {
			let onclose = self.onclose;
			delete self.onclose;
			self.close();
			if ( onclose )
				onclose();
		}
	}
	
})( library.rtc );

(function( ns, undefined ) {
	ns.Dormant = function() {
		if ( !( this instanceof ns.Dormant ))
			return new ns.Dormant();
		
		if ( !friend.Dormant ) {
			console.log( 'Dormant not defined' );
			return false;
		}
		
		var self = this;
		self.init();
	}
	
	// Public
	
	ns.Dormant.prototype.addDir = function( item ) {
		const self = this;
		self.door.addDir( item );
	}
	
	ns.Dormant.prototype.addFun = function( item ) {
		const self = this;
		self.door.addFun( item );
	}
	
	// Private
	
	ns.Dormant.prototype.init = function() {
		var self = this;
		self.dormant = friend.Dormant;
		var conf = {
			title : 'FriendChat',
		};
		self.door = new api.Door( conf );
		self.dormant.add( self.door );
		self.setBase();
		
	}
	
	ns.Dormant.prototype.setBase = function() {
		var self = this;
		const funDir = new api.DoorDir({
			title : 'Functions',
			path  : 'Functions/',
		}, '' );
		
		const getIdentityDoor = new api.DoorFun({
			title   : 'GetIdentity',
			execute : getIdentity,
		}, funDir.fullPath );
		
		self.addDir( funDir );
		self.addFun( getIdentityDoor );
		
		function getIdentity() {
			console.log( 'dormant fun getIdentity' );
			return hello.identity;
		}
		
		/*
		self.door.addDir({
			MetaType: 'Directory',
			Title: 'functions',
			Icon: 'Directory',
			Path: 'functions/',
			Position: 'left',
			Module: 'files',
			Command: 'dormant',
			Filesize: 4096,
			Flags: '',
			Type: 'Dormant',
			Dormant: '',
		});
		*/
	}
	
})( library.system );


