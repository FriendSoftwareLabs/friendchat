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
		
		const self = this;
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
		const self = this;
		self.get();
	}
	
	ns.Login.prototype.show = function() {
		const self = this;
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
		const self = this;
		self.view.on( 'create', create );
		self.view.on( 'login', login );
		self.view.on( 'delete', deleteAccount );
		
		function create( msg ) { self.showCreate( msg ); }
		function login( msg ) { self.login( msg ); }
		function deleteAccount( msg ) { self.deleteAccount( msg ); }
	}
	
	ns.Login.prototype.get = function() {
		const self = this;
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
				self.autoCreate()
					.then( created )
					.catch( e => console.log( 'Login, failed to autocreate', e ));
				return;
				
				
				function created( success ) {
					if ( success )
						return;
					
					console.log( 'failed to autocreate, showing logins' );
					self.show();
					self.showCreate();
				}
			}
			
			accounts.forEach( acc => self.add( acc ));
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
				self.login( account );
				return true;
			}
		}
	}
	
	ns.Login.prototype.add = function( account ) {
		const self = this;
		self.accounts[ account.clientId ] = account;
		if ( self.view )
			self.addToView( account );
	}
	
	ns.Login.prototype.addToView = function( account ) {
		const self = this;
		self.toView({
			type : 'add',
			data : account,
		});
	}
	
	ns.Login.prototype.showCreate = function() {
		const self = this;
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
	
	ns.Login.prototype.autoCreate = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const data = {
				name : hello.identity.alias,
			};
			
			self.createAccount( data );
			
			return true;
		});
	}
	
	ns.Login.prototype.createAccount = function( data ) {
		const self = this;
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
		const self = this;
		var account = self.accounts[ msg.clientId ];
		if ( !account ) {
			console.log( 'login.login - invalid client id', msg );
			console.log( 'accounts', self.accounts );
			return;
		}
		
		var request = {
			url  : '/login',
			verb : 'post',
			data : {
				userId   : hello.app.userId,
				name     : account.name,
				password : msg.password
			},
		};
		hello.request.send( request, logBack );
		function logBack( response ) {
			self.loginResponse( response );
		}
	}
	
	ns.Login.prototype.loginResponse = function( response ) {
		const self = this;
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
		const self = this;
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
		const self = this;
		delete self.accounts[ id ];
		self.removeFromView( id );
	}
	
	ns.Login.prototype.removeFromView = function( id ) {
		const self = this;
		if ( !self.view )
			return;
		
		self.toView({
			type : 'remove',
			data : id
		});
	}
	
	ns.Login.prototype.logout = function( doneBack ) {
		const self = this;
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
		const self = this;
		const loginCallback = self.onlogin;
		self.onlogin = null;
		
		if ( loginCallback )
			loginCallback( msg );
	}
	
	ns.Login.prototype.close = function() {
		const self = this;
		if ( self.view )
			self.view.close();
		
		if ( self.createView )
			self.createView.close();
	}
	
	ns.Login.prototype.viewEvent = function( msg ) {
		const self = this;
		console.log( 'unhandled login event', msg );
		return;
	}
	
	ns.Login.prototype.toView = function( msg ) {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.send( msg );
	}
	
})( library.system );


// MODULE CONTROL
(function( ns, undefined ) {
	ns.ModuleControl = function( conf ) {
		if ( !( this instanceof ns.ModuleControl ))
			return new ns.ModuleControl( conf );
		
		const self = this;
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
		mids.forEach( mId => {
			let mod = self.active[ mId ];
			mod.reconnect();
		});
	}
	
	ns.ModuleControl.prototype.setIsOnline = function( isOnline ) {
		const self = this;
		if ( isOnline )
			self.reconnect();
	}
	
	ns.ModuleControl.prototype.updateAvatar = function( avatar ) {
		const self = this;
		mids = Object.keys( self.active );
		mids.forEach( mId => {
			let mod = self.active[ mId ];
			mod.updateAvatar( avatar );
		});
	}
	
	ns.ModuleControl.prototype.getPresence = function() {
		const self = this;
		let ids = Object.keys( self.active );
		let pres = null;
		ids.some( id => {
			let mod = self.active[ id ];
			if ( 'presence' === mod.type ) {
				pres = mod;
				return true;
			}
			
			return false;
		});
		return pres;
	}
	
	// Private
	
	ns.ModuleControl.prototype.init = function() {
		const self = this;
		self.moduleMap =  {
			treeroot : library.module.Treeroot,
			irc      : library.module.IRC,
			presence : library.module.Presence,
			//telegram : library.module.Telegram,
		};
		self.availableModules = setAvailable( hello.config.modules );
		
		self.conn = new library.component.EventNode(
			'module',
			hello.conn,
			eventSink
		);
		
		self.conn.on( 'add', add );
		self.conn.on( 'remove', remove );
		self.conn.on( 'create', create );
		
		function eventSink( type, data ) {
			console.log( 'ModuleControl - eventSink', {
				type : type,
				data : data,
			});
		}
		
		/*
		self.connMap = {
			'add' : add,
			'remove' : remove,
			'create' : create,
		};
		*/
		
		function add( e ) { self.add( e ); }
		function remove( e ) { self.handleRemove( e ); }
		function create( e ) { self.createResult( e ); }
		
		self.view = new library.component.SubView({
			parent : self.parentView,
			type   : 'module',
		});
		self.bindView();
		
		function setAvailable( modules ) {
			var available = {};
			var modKeys = Object.keys( modules );
			modKeys.forEach( set );
			return available;
			
			function set( key ) {
				if ( !self.moduleMap[ key ])
					return;
				
				var mod = modules[ key ];
				available[ mod.type ] = mod.name;
			}
		}
	}
	
	ns.ModuleControl.prototype.bindView = function() {
		const self = this;
		self.view.on( 'create', create );
		
		function create( msg ) { self.create( msg ); }
	}
	
	ns.ModuleControl.prototype.create = function( module ) {
		const self = this;
		if ( module )
			self.doCreate( module );
		else
			self.showCreateForm();
	}
	
	ns.ModuleControl.prototype.add = function( modConf ) {
		const self = this;
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
		hello.items.addSource( mod.clientId, mod );
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
		const self = this;
		var rem = {
			type : 'remove',
			data : mId,
		};
		self.send( rem );
	}
	
	ns.ModuleControl.prototype.handleNoModule = function() {
		const self = this;
		console.log( 'handleNoModule - NYI' );
		
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
		self.view.send({
			type : 'askaddmodule',
			data : description,
		});
	}
	
	ns.ModuleControl.prototype.handleFirstLogin = function() {
		const self = this;
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
		const self = this;
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
		const self = this;
		var req = {
			type : 'create',
			data : data,
		};
		
		self.send( req );
	}
	
	ns.ModuleControl.prototype.createResult = function( res ) {
		const self = this;
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
		const self = this;
		self.view.send({
			type : 'add',
			data : module
		});
	}
	
	ns.ModuleControl.prototype.updateInView = function(  module ) {
		const self = this;
		self.view.send({
			type : 'update',
			data : module
		});
	}
	
	ns.ModuleControl.prototype.handleRemove = function( moduleId ) {
		const self = this;
		var module = self.active[ moduleId ];
		if ( !module ) {
			console.log( 'invalid module id ');
			return;
		}
		
		hello.items.removeSource( moduleId );
		module.close();
		delete self.active[ moduleId ];
		self.removeFromView( moduleId );
	}
	
	ns.ModuleControl.prototype.removeFromView = function( id ) {
		const self = this;
		self.view.send({
			type : 'remove',
			data : id
		});
	}
	
	ns.ModuleControl.prototype.get = function( id ) {
		const self = this;
		return self.active[ id ];
	}
	
	ns.ModuleControl.prototype.send = function( msg ) {
		const self = this;
		self.conn.send( msg );
	}
	
	ns.ModuleControl.prototype.close = function() {
		const self = this;
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
	ns.RtcControl = function( viewConn ) {
		const self = this;
		self.sessions = {};
		self.sessionIds = [];
		self.roomRequests = {};
		
		self.init( viewConn );
	}
	
	// Public
	
	ns.RtcControl.prototype.hasSession = function() {
		const self = this;
		return !!self.sessionIds.length;
	}
	
	ns.RtcControl.prototype.joinLive = function( conf, eventSink, onclose ) {
		const self = this;
		const sessionConf = {
			roomId      : conf.roomId     ,
			invite      : null            ,
			user        : conf.identity   ,
			permissions : conf.permissions,
			constraints : conf.constraints,
		};
		
		self.createSession( sessionConf, eventSink, onclose );
	}
	
	ns.RtcControl.prototype.invite = function( contacts, permissions ) {
		const self = this;
		const userConf = {
			contacts    : contacts,
			permissions : permissions,
		};
		
		let roomId = null;
		let groups = self.getGroupLive();
		if ( !groups.length ) {
			self.createRoom( contacts, permissions );
			return;
		}
		
		if ( 1 === groups.length ) {
			roomId = groups[ 0 ];
			doInvite( roomId );
		} else {
			askSpecifyRoom( groups );
		}
		
		function askSpecifyRoom() {
			let roomMetas = groups.map( buildMeta );
			let conf = {
				sessions : roomMetas,
				onselect : onSelect,
			};
			let select = new library.view.SpecifySession( conf );
			function onSelect( roomId ) {
				select.close();
				
				if ( !roomId )
					self.createRoom( contacts, permissions );
				else
					doInvite( roomId );
			}
		}
		
		function doInvite( roomId ) {
			hello.service.invite( userConf, roomId );
		}
		
		function buildMeta( sId ) {
			let session = self.sessions[ sId ];
			let meta = hello.service.getRoomInfo( sId );
			meta.created = session.created;
			return meta;
		}
	}
	
	ns.RtcControl.prototype.createRoom = function( contacts, permissions ) {
		const self = this;
		const sessionConf = {
			roomId      : null,
			invite      : null,
			isHost      : true,
			contacts    : contacts,
			permissions : permissions,
		};
		self.getRoom( 'create', sessionConf );
	}
	
	ns.RtcControl.prototype.askClient = function( invite, inviteFrom, selfie ) {
		const self = this;
		const inviteHost = invite.host.split( '/' )[ 0 ];
		const localHost = hello.service.getHost();
		api.Say( 'Live invite received', { i : invite, 'if' : inviteFrom, s : selfie });
		const message = inviteFrom.name
				+ ' ' + Application.i18n( 'i18n_has_invited_you_to_live' );
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
		const self = this;
		if ( !selfie ) {
			selfie = {
				name   : library.tool.getName(),
				avatar : library.component.Identity.prototype.avatar,
			};
		}
		
		const sessionConf = {
			invite      : invite,
			inviteFrom  : inviteFrom,
			user        : selfie,
			isHost      : false,
			contacts    : null,
			permissions : permissions,
		};
		self.getRoom( 'join', sessionConf );
	}
	
	ns.RtcControl.prototype.leave = function() {
		const self = this;
		self.closeSession();
	}
	
	ns.RtcControl.prototype.close = function() {
		const self = this;
		if ( self.view )
			self.view.close();
		
		delete self.view;
	}
	
	// private
	
	ns.RtcControl.prototype.init = function( viewConn ) {
		const self = this;
		self.bindView( viewConn );
	}
	
	ns.RtcControl.prototype.getGroupLive = function() {
		const self = this;
		let groupSessions = self.sessionIds.filter( sId => {
			let sess = self.sessions[ sId ];
			if ( !sess || sess.isPrivate )
				return false;
			
			return true;
		});
		
		return groupSessions;
	}
	
	ns.RtcControl.prototype.askHost = function( contacts, selfie ) {
		const self = this;
		const conf = {
			message     : 'permissions for live chat',
			constraints : self.constraints,
		};
		const askView = new library.view.RtcAsk( conf, permissionBack );
	}
	
	ns.RtcControl.prototype.getRoom = function( action, sessionConf ) {
		const self = this;
		hello.service.getRoom( action, sessionConf );
	}
	
	ns.RtcControl.prototype.createSession = function( conf, eventSink, onclose ) {
		const self = this;
		const sId = conf.roomId;
		if ( self.sessions[ sId ] )
			self.closeSession( sId );
		
		conf.user = conf.user || hello.service.getIdentity();
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
		
		let session = new library.rtc.RtcSession( conf, eventSink, onclose, sessionClosed );
		self.sessions[ sId ] = session;
		self.sessionIds.push( sId );
		const sess = {
			type : 'add',
			data : {
				id   : session.roomId,
				conf : session.conf,
			},
		};
		self.toView( sess );
		return session;
		
		function sessionClosed() {
			self.closeSession( sId );
		}
	}
	
	ns.RtcControl.prototype.getSession = function( sId ) {
		const self = this;
		return self.sessions[ sId ] || null;
	}
	
	ns.RtcControl.prototype.closeSession = function( sId ) {
		const self = this;
		let session = self.sessions[ sId ];
		if ( !session ) {
			console.log( 'RtcControl.closeSession - no session found for', {
				sId      : sId,
				sessions : self.sessions,
			});
			return;
		}
		
		delete self.sessions[ sId ];
		self.sessionIds = Object.keys( self.sessions );
		
		const remove = {
			type : 'remove',
			data : sId,
		};
		self.toView( remove );
		
		session.close();
		self.restartSessions();
	}
	
	ns.RtcControl.prototype.restartSessions = function() {
		const self = this;
		const reset = {
			type : 'reset-output',
		};
		self.sessionIds.forEach( sId => {
			const sess = self.sessions[ sId ];
			sess.send( reset );
		});
	}
	
	ns.RtcControl.prototype.bindView = function( viewConn ) {
		const self = this;
		self.view = new library.component.EventNode( 'rtc', viewConn, viewSink );
		self.view.on( 'show', e => self.showSession( e ));
		
		function viewSink( ...args ) {
			console.log( 'RtcControl.viewSink', args );
		}
	}
	
	ns.RtcControl.prototype.toView = function( event ) {
		const self = this;
		if ( self.view )
			self.view.send( event );
	}
	
	ns.RtcControl.prototype.showSession = function( sId ) {
		const self = this;
		const session = self.sessions[ sId ];
		if ( !session ) {
			console.log( 'RtcControl.showSession - no session for', {
				sId      : sId,
				sessions : self.sessions,
			});
			return;
		}
		
		session.show();
	}
	
	ns.RtcControl.prototype.setupDormant = function() {
		const self = this;
		return;
		
		if ( !hello.dormant )
			return;
		
		const path = 'Live';
		self.door = new api.DoorDir({
			title : 'Live',
			path  : 'Live/',
		}, '' );
		
		const closeFn = new api.DoorFun({
			title   : 'Close',
			execute : close,
		}, self.door.fullPath );
		
		hello.dormant.addDir( self.door );
		hello.dormant.addFun( closeFn );
		
		function close() {
			self.leave();
		}
	}
	
	ns.RtcControl.prototype.closeDormant = function() {
		const self = this;
		if ( !self.session )
			return;
		
		if ( !self.door )
			return;
		
		hello.dormant.remove( self.door );
		self.door = null;
	}
	
})( library.system );


// ACCOUNT
(function( ns, undefined ) {
	ns.Account = function( conf ) {
		if ( !( this instanceof ns.Account ))
			return new ns.Account( conf );
		
		const self = this;
		self.availability = null;
		self.clientId = conf.account.clientId;
		self.displayName = conf.account.name;
		self.settings = conf.account.settings || {};
		self.conn = null;
		
		self.init( conf.parentView );
	}
	
	// Public
	
	ns.Account.prototype.sendReady = function( msg ) {
		const self = this;
		const ready = {
			type : 'ready',
			data : msg,
		};
		self.send( ready );
	}
	
	// Private
	
	ns.Account.prototype.init = function( parentView ) {
		const self = this;
		if ( null == self.settings.roomAlert )
			self.settings.roomAlert = self.settings.msgAlert;
		
		hello.setSettings( self.settings );
		self.conn = new library.system.Message({
			id : 'account',
			handler : receiveMsg,
		});
		function receiveMsg( e ) { self.receiveMsg( e ); }
		
		self.msgMap = {
			'settings' : showSettings,
			'setting'  : updateSetting,
		};
		
		function showSettings( e ) { self.showSettings( e ); }
		function updateSetting( e ) { self.updateSetting( e ); }
		
		self.updateMap = {
			'popupChat'    : e => self.updatePopupChat( e ),
			'msgAlert'     : e => self.updateMsgAlert( e ),
			'roomAlert'    : e => self.updateRoomAlert( e ),
			'privateAlert' : e => self.updatePrivateAlert( e ),
			'inAppMenu'    : e => self.updateInAppMenu( e ),
			'compactChat'  : e => self.updateCompactChat( e ),
		};
		
		self.view = new library.component.SubView({
			parent : parentView,
			type : 'account',
			ready : viewIsReady,
		});
		function viewIsReady() { console.log( 'app.Account.viewIsReady' ); }
		self.bindView();
	}
	
	ns.Account.prototype.receiveMsg = function( msg ) {
		const self = this;
		const handler = self.msgMap[ msg.type ];
		if ( !handler ) {
			console.log( 'Account.receiveMsg - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Account.prototype.bindView = function() {
		const self = this;
		self.view.on( 'settings', loadSettings );
		self.view.on( 'setting', persistSetting );
		
		function loadSettings( msg ) { self.getSettings(); }
		function persistSetting( msg ) { self.persistSetting( msg ); }
	}
	
	ns.Account.prototype.getSettings = function() {
		const self = this;
		const msg = {
			type : 'settings',
		};
		self.send( msg );
	}
	
	ns.Account.prototype.persistSetting = function( data ) {
		const self = this;
		console.log( 'account.persistSetting - NYI???', data );
	}
	
	ns.Account.prototype.showSettings = function( data ) {
		const self = this;
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
		const self = this;
		var msg = {
			type : 'setting',
			data : data,
		};
		self.send( msg );
	}
	
	ns.Account.prototype.updateSetting = function( update ) {
		const self = this;
		if ( self.settingsView )
			self.settingsView.saved( update );
		
		var handler = self.updateMap[ update.setting ];
		if ( !handler ) {
			console.log( 'no handler for ', update );
			return;
		}
		
		handler( update.value );
		hello.setSettings( self.settings );
	}
	
	ns.Account.prototype.updatePopupChat = function( value ) {
		const self = this;
		self.settings.popupChat = value;
	}
	
	ns.Account.prototype.updateMsgAlert = function( value ) {
		const self = this;
		self.settings.msgAlert = value;
	}
	
	ns.Account.prototype.updateRoomAlert = function( value ) {
		const self = this;
		self.settings.roomAlert = value;
	}
	
	ns.Account.prototype.updatePrivateAlert = function( value ) {
		const self = this;
		self.settings.privateAlert = value;
	}
	
	ns.Account.prototype.updateCompactChat = function( value ) {
		const self = this;
		self.settings.compactChat = value;
	}
	
	ns.Account.prototype.updateInAppMenu = function( value ) {
		const self = this;
		self.settings.inAppMenu = value;
	}
	
	ns.Account.prototype.load = function( account ) {
		const self = this;
		self.clientId = account.clientId;
		self.name = account.name;
		hello.modules.load();
	}
	
	ns.Account.prototype.getName = function() {
		const self = this;
		return self.displayName || self.clientId || 'nope, no name';
	}
	
	ns.Account.prototype.send = function( msg ) {
		const self = this;
		self.conn.send( msg );
	}
	
	ns.Account.prototype.close = function() {
		const self = this;
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
		
		const self = this;
		self.type = 'notification';
		self.handlerId = null;
		
		self.init( conf.parentView );
	}
	
	ns.Notification.prototype.init = function( parentView ) {
		const self = this;
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
		const self = this;
		self.set( msg );
	}
	
	ns.Notification.prototype.bindView = function() {
		const self = this;
		self.view.on( 'toggle', logToggleView );
		
		function logToggleView( msg ) { self.toggleLogView( msg ); }
	}
	
	ns.Notification.prototype.toggleLogView = function( bool ) {
		const self = this;
		var isNowOpen = hello.log.toggle();
		self.view.send({
			type : 'toggle',
			data : isNowOpen.toString(),
		});
	}
	
	ns.Notification.prototype.set = function( msg ) {
		const self = this;
		self.view.send( msg );
	}
	
	ns.Notification.prototype.close = function() {
		const self = this;
		if ( self.handlerId && hello.log )
			hello.log.weDidntListen( self.handlerId );
		else
			console.log(
				'app.Notification.close - missing the things, oops?',
				{
					id : self.handlerId,
					log : hello.log
				}
			);
		
		self.view.close();
	}
	
})( library.system );


// LOG
(function( ns, undefined ) {
	ns.Log = function( onclose ) {
		if ( !( this instanceof ns.Log ))
			return new ns.Log( onclose );
		
		const self = this;
		self.onclose = onclose;
		self.log = [];
		self.view = null;
		self.listener = {};
		
		self.init();
	}
	
	// PUBLIC
	ns.Log.prototype.positive = function( message, timestamp ) {
		const self = this;
		self.normalize( message, 'positive', timestamp );
	}
	
	ns.Log.prototype.notify = function( message, timestamp ) {
		const self = this;
		self.normalize( message, 'notify', timestamp );
	}
	
	ns.Log.prototype.alert = function( message, timestamp ) {
		const self = this;
		self.normalize( message, 'alert', timestamp );
	}
	
	ns.Log.prototype.waiting = function( message, startTime, endTime ) {
		const self = this;
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
		const self = this;
		self.normalize( message );
	}
	
	// show ( you_dont_say.jpg )
	ns.Log.prototype.show = function() {
		const self = this;
		self.showView();
	}
	
	// privates
	
	ns.Log.prototype.init = function() {
		const self = this;
	}
	
	ns.Log.prototype.showView = function() {
		const self = this;
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
		const self = this;
		self.view.on( 'clear', clear );
		
		function clear( msg ) { self.clear(); }
	}
	
	ns.Log.prototype.pushLogToView = function() {
		const self = this;
		self.log.forEach( add );
		function add( item ) {
			self.addToView( item );
		}
	}
	
	ns.Log.prototype.hide = function() {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.close();
		self.view = null;
	}
	
	ns.Log.prototype.toggle = function() {
		const self = this;
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
		const self = this;
		if ( typeof( msg ) == 'string' ) {
			msg = friendUP.tool.ucfirst( msg );
			msg = self.buildNotification( msg, alertLevel, timestamp );
		}
		
		self.set( msg );
	}
	
	ns.Log.prototype.set = function( data ) {
		const self = this;
		self.log.push( data );
		self.addToView( data );
		self.emit( data );
	}
	
	ns.Log.prototype.addToView = function( msg ) {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.send( msg );
	}
	
	ns.Log.prototype.buildNotification = function( msg, alertLevel, timestamp ) {
		const self = this;
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
		const self = this;
		self.log = [];
		var msg = {
			type : 'clear',
		};
		self.addToView( msg );
		self.emit( msg );
	}
	
	ns.Log.prototype.getLatestEntry = function() {
		const self = this;
		var lastIndex = self.log.length -1;
		return self.log[ lastIndex ];
	}
	
	ns.Log.prototype.emit = function( msg ) {
		const self = this;
		var listenerIds = Object.keys( self.listener );
		listenerIds.forEach( emit );
		function emit( id ) {
			var handler = self.listener[ id ];
			handler( msg );
		}
	}
	
	ns.Log.prototype.listen = function( handler ) {
		const self = this;
		var id = friendUP.tool.uid( 'listener' );
		self.listener[ id ] = handler;
		return id;
	}
	
	ns.Log.prototype.weDidntListen = function( handlerId ) {
		const self = this;
		if ( self.listener[ handlerId ])
			delete self.listener[ handlerId ];
	}
	
})( library.system );


// CONNECTION
(function( ns, undefined ) {
	ns.Connection = function( altHost, onState ) {
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
	
	ns.Connection.prototype.on = function( type, callback ) {
		const self = this;
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
		const self = this;
		if ( !type || !self.subscriber[ type ] ) {
			console.log( 'connection.off - invalid subscriber', type );
			return;
		}
		
		delete self.subscriber[ type ];
	}
	ns.Connection.prototype.release = ns.Connection.prototype.off;
	
	ns.Connection.prototype.send = function( msg ) {
		const self = this;
		if ( !msg || !self.socket )
			return false;
		
		self.socket.send( msg );
		return true;
	}
	
	ns.Connection.prototype.connect = function( callback ) {
		const self = this;
		if( !hello.config || !hello.config.host ) {
			throw new Error( 'missing websocket config stuff' );
			return;
		}
		
		if ( self.socket )
			self.clear();
		
		if ( callback )
			self.readyCallback = callback;
		
		let url = null;
		if ( self.altHost )
			url = self.altHost;
		else {
			const host = hello.config.host;
			const port = hello.config.chat.port;
			const protocol = hello.config.tls ? 'wss' : 'ws';
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
		const self = this;
		self.socketEventMap = {
			'connect'    : socketConnecting,
			'open'       : socketOpen,
			'auth'       : socketAuth,
			'session'    : socketSession,
			'close'      : socketClosed,
			'timeout'    : socketTimeout,
			'error'      : socketError,
			'ping'       : socketPing,
			'reconnect'  : socketReconnect,
		};
		function socketConnecting( e ) { self.socketConnecting( e ); }
		function socketOpen( e ) { self.socketOpen( e ); }
		function socketAuth( e ) { self.socketAuth( e ); }
		function socketSession( e ) { self.socketSession( e ); }
		function socketClosed ( e ) { self.socketClosed( e ); }
		function socketTimeout( e ) { self.socketTimeout( e ); }
		function socketError ( e ) { self.socketError( e ); }
		function socketPing ( e ) { self.socketPing( e ); }
		function socketReconnect( e ) { self.socketReconnecting( e ); }
	}
	
	ns.Connection.prototype.handleState = function( event ) {
		const self = this;
		const handler = self.socketEventMap[ event.type ];
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
				host : self.host,
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
	
	ns.Connection.prototype.socketAuth = function( success ) {
		const self = this;
		if ( !success )
			return;
		
		const callback = self.readyCallback;
		delete self.readyCallback;
		if ( callback )
			callback( null, success );
	}
	
	ns.Connection.prototype.socketSession = function( sid ) {
		const self = this;
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
	
})( library.system );


// MESSAGE

(function( ns, undefined ) {
	ns.Message = function( conf ) {
		if ( !( this instanceof ns.Message ))
			return new ns.Message( conf );
		
		const self = this;
		self.id = conf.id;
		self.handler = conf.handler;
		self.parentId = conf.parent;
		
		self.init();
	}
	
	ns.Message.prototype.init = function() {
		const self = this;
		hello.conn.on( self.id , message );
		function message( msg ) { self.message( msg ); }
	}
	
	ns.Message.prototype.send = function( msg ) {
		const self = this;
		var wrap = {
			type : self.parentId || self.id,
			data : msg,
		};
		
		hello.conn.send( wrap );
	}
	
	ns.Message.prototype.message = function( data ) {
		const self = this;
		if ( !data ) {
			console.log( 'Message - empty message', data );
			return;
		}
		
		self.handler( data );
	}
	
	ns.Message.prototype.close = function() {
		const self = this;
		hello.conn.off( self.id );
	}
	
})( library.system );


// REQUEST

(function(ns, undefined) {
	ns.Request = function( conf ) {
		if( !(this instanceof ns.Request))
			return new ns.Request( conf );
		
		const self = this;
		self.conn = conf.conn;
		self.request = {};
		
		self.init();
	}
	
	ns.Request.prototype.init = function()
	{
		const self = this;
		self.conn.on( 'request', receiveMessage );
		function receiveMessage( msg ) { self.message( msg ); }
	}
	
	ns.Request.prototype.message = function( data ) {
		const self = this;
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
		const self = this;
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
		
		const self = this;
		self.interceptToken = '&zwnj;&zwnj;&zwnj;';
		self.appUrl = '/webclient/app.html?app=FriendChat&data=';
		self.RX = null;
		
		self.init();
	}
	
	// public
	
	ns.Interceptor.prototype.check = function( message ) {
		const self = this;
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
		const self = this;
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
		const self = this;
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
		const self = this;
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
		
		const self = this;
		self.view =  null;
		self.filepath = conf.filepath;
		self.windowConf = conf.windowConf;
		self.config = conf.view;
		self.callback = callback;
		
		self.init();
	}
	
	ns.Confirm.prototype.init = function() {
		const self = this;
		self.view = new api.View({
			filepath : self.filepath,
			windowConf : self.windowConf,
		});
		
		self.bindView();
	}
	
	ns.Confirm.prototype.bindView = function() {
		const self = this;
		self.view.on( 'loaded', loaded );
		self.view.on( 'ready', ready );
		self.view.on( 'response', response );
		
		function loaded( msg ) { self.loaded( msg ); }
		function ready( msg ) { console.log( 'app.Confirm - view is ready' ); }
		function response( msg ) { self.response( msg ); }
	}
	
	ns.Confirm.prototype.loaded = function( msg ) {
		const self = this;
		self.view.send({
			type : 'initialize',
			data : self.config,
		});
	}
	
	ns.Confirm.prototype.response = function( msg ) {
		const self = this;
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
		
		const self = this;
		library.component.EventEmitter.call( self, eventSink );
		
		self.id = null; // set by initialize / open event
		self.roomId = conf.roomId;
		self.isPrivate = conf.isPrivate;
		self.conf = conf;
		self.onclose = onclose;
		self.sessionclose = sessionClose;
		
		self.created = Date.now();
		self.contacts = {};
		self.server = null;
		self.view = null;
		self.peers = null;
		self.sendQueue = [];
		
		self.init();
	}
	
	ns.RtcSession.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	// from EventEmitter: on(), once(), off() and release();
	
	ns.RtcSession.prototype.show = function() {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.show();
	}
	
	//
	ns.RtcSession.prototype.send = function( event ) {
		const self = this;
		if ( !self.view )  {
			console.log( '!rtc.session.view - queueueueueuing', event );
			self.sendQueue.push( event );
			return;
		}
		
		self.view.send( event );
	}
	
	ns.RtcSession.prototype.setTitle = function( name ) {
		const self = this;
		self.view.setTitle( name );
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
		
		delete self.conf;
		delete self.isPrivate;
		delete self.roomId;
		
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
		if ( self.view ) {
			self.restore( init );
			return;
		}
		
		self.id = init.liveId;
		const roomConf = init.liveConf;
		console.log( 'RtcSession - roomConf', roomConf );
		const viewConf = self.conf;
		const liveConf = {
			userId      : roomConf.userId,
			peerList    : roomConf.peerList,
			isGuest     : viewConf.isGuest || false,
			guestAvatar : viewConf.guestAvatar,
			identities  : init.identities,
			roomName    : viewConf.roomName,
			isPrivate   : viewConf.isPrivate,
			isTempRoom  : viewConf.isTempRoom,
			isStream    : viewConf.isStream,
			logTail     : roomConf.logTail,
			rtcConf     : {
				ICE         : roomConf.ICE,
				permissions : viewConf.permissions,
				quality     : roomConf.quality,
				mode        : roomConf.mode,
				sourceId    : roomConf.sourceId,
				topology    : roomConf.topology,
				isRecording : roomConf.isRecording,
			},
		};
		self.view = new library.view.Live(
			liveConf,
			viewConf,
			eventSink,
			onClose
		);
		
		delete self.identities;
		if ( self.sendQueue.length ) {
			self.sendQueue.forEach( e => self.send( e ));
			self.sendQueue = [];
		}
		
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
	
	ns.RtcSession.prototype.restore = function( init ) {
		const self = this;
		const res = {
			type : 'restore',
			data : init,
		};
		self.send( res );
	}
	
})( library.rtc );


//
(function( ns, undefined ) {
	ns.Dormant = function( allowRead, allowWrite ) {
		if ( !friend.Dormant ) {
			console.log( 'Dormant not defined' );
			return false;
		}
		
		const self = this;
		self.allowRead = allowRead;
		self.allowWrite = allowWrite;
		
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
	
	ns.Dormant.prototype.remove = function( item ) {
		const self = this;
		self.door.remove( item );
	}
	
	ns.Dormant.prototype.close = function() {
		const self = this;
		delete self.allowRead;
		delete self.allowWrite;
		self.door.close();
	}
	
	// Private
	
	ns.Dormant.prototype.init = function() {
		const self = this;
		self.dormant = friend.Dormant;
		var conf = {
			title : 'FriendChat',
		};
		self.door = new api.Door( conf );
		self.dormant.add( self.door );
		self.setBase();
	}
	
	ns.Dormant.prototype.setBase = function() {
		const self = this;
		
		const fDir = new api.DoorDir({
			title : 'Functions',
			path  : 'Functions/',
		}, '' );
		
		/*
		const modDir = new api.DoorDir({
			title : 'Modules',
			path  : 'Modules/',
		}, '' );
		
		const getIdentityFun = new api.DoorFun({
			title   : 'GetIdentity',
			execute : getIdentity,
		}, fDir.fullPath );
		
		const startLiveFun = new api.DoorFun({
			title   : 'StartLive',
			execute : startLive,
		}, fDir.fullPath );
		
		const openLiveFun = new api.DoorFun({
			title   : 'OpenLive',
			execute : openLive,
		}, fDir.fullPath );
		
		const closeLiveFun = new api.DoorFun({
			title   : 'CloseLive',
			execute : closeLive,
		}, fDir.fullPath );
		
		*/
		
		const quitFun = new api.DoorFun({
			title   : 'Quit',
			execute : quit,
		}, fDir.fullPath );
		
		/*
		self.addFun( getIdentityFun );
		self.addFun( startLiveFun );
		self.addFun( openLiveFun );
		self.addFun( closeLiveFun );
		*/
		
		self.addDir( fDir );
		//self.addDir( modDir );
		self.addFun( quitFun );
		
		/*
		function getIdentity() {
			return hello.identity;
		}
		
		function startLive() {
			if ( !hello.main ) {
				return 'ERR_NOT_LOGGED_IN';
			}
			
			hello.main.joinLive();
		}
		
		function openLive( args ) {
			console.log( 'openLive', args );
			if ( !hello.main )
				return;
			
			let pres = hello.module.getPresence();
			if ( !pres )
				return;
			
			console.log( 'hasPresecne', pres );
			pres.openLive( args[ 0 ] || 'fnetRoom' );
		}
		
		function closeLive() {
			if ( !hello.rtc ) {
				return true;
			}
			
			hello.rtc.leave();
		}
		
		*/
		
		function quit() {
			hello.quit();
		}
	}
	
})( library.system );

/*
Searchable collection(s) of users, rooms and other odds and ends
*/
(function( ns, undefined ) {
	ns.Items = function() {
		const self = this;
		self.sources = {};
		self.sourceIds = [];
		
		self.searches = {};
		self.listeners = {};
		
		self.init();
	}
	
	// Public
	
	ns.Items.prototype.close = function() {
		const self = this;
	}
	
	// TODO : constraints - list of source ids and/or scopes
	ns.Items.prototype.search = function(
		listenId,
		searchEvent,
	) {
		const self = this;
		const searchId = searchEvent.id;
		const needle = searchEvent.str;
		const constraints = searchEvent.constraints;
		
		self.searches[ searchId ] = {
			id       : searchId,
			results  : [],
			listenId : listenId,
		};
		const search = self.searches[ searchId ];
		self.sourceIds.forEach( sId => {
			let source = self.sources[ sId ];
			let res = source.search( needle );
			res.results.forEach( future => {
				let poolMeta = {
					sourceId : sId,
					source   : res.source,
					done     : false,
					future   : future,
				};
				search.results.push( poolMeta );
				future
					.then( poolBack )
					.catch( poolErr );
				
				function poolBack( res ) {
					let pool = res.pool;
					poolMeta.type = res.type;
					poolMeta.actions = res.actions || [];
					poolMeta.done = true;
					delete poolMeta.future;
					self.sendResult( searchId, poolMeta, pool );
				}
				
				function poolErr( err ) {
					console.log( 'Items.search - pool error', err );
					poolMeta.type = '';
					poolMeta.actions = [];
					poolMeta.done = true;
					delete poolMeta.future;
					self.sendResult( searchId, poolMeta, [] );
				}
			});
		});
	}
	
	ns.Items.prototype.startListen = function( parentConn ) {
		const self = this;
		const listenId = friendUP.tool.uid();
		const conn = new library.component.EventNode( 'search', parentConn, eventSink );
		
		self.listeners[ listenId ] = conn;
		conn.on( 'search', e => self.search( listenId, e ));
		conn.on( 'action', e => self.handleAction( listenId, e ));
		
		return listenId;
		
		function eventSink( type, event ) {
			console.log( 'Items.listen - unhandled event', {
				type  : type,
				event : event,
			});
		}
	}
	
	ns.Items.prototype.stopListen = function( listenId ) {
		const self = this;
		const conn = self.listeners[ listenId ];
		if ( !conn )
			return;
		
		delete self.listeners[ listenId ];
		conn.release( 'search' );
	}
	
	ns.Items.prototype.addSource = function( id, source ) {
		const self = this;
		self.sources[ id ] = source;
		self.sourceIds = Object.keys( self.sources );
	}
	
	ns.Items.prototype.removeSource = function( id ) {
		const self = this;
		delete self.sources[ id ];
		self.sourceIds = Object.keys( self.sources );
	}
	
	// Private
	
	ns.Items.prototype.init = function() {
		const self = this;
		self.actionMap = {
			'add-relation'    : addRelation,
			'remove-relation' : removeRelation,
			'open-chat'       : openChat,
			'live-audio'      : liveAudio,
			'live-video'      : liveVideo,
			'invite-video'    : inviteVideo,
			'invite-audio'    : inviteAudio,
		};
		
		function addRelation( s, e, l ) { self.handleAddRelation( s, e, l ); }
		function removeRelation( s, e, l ) { self.handleRemoveRelation( s, e, l ); }
		function openChat( s, e, l ) { self.handleOpenChat( s, e, l ); }
		function liveAudio( s, e, l ) { self.handleLiveAudio( s, e, l ); }
		function liveVideo( s, e, l ) { self.handleLiveVideo( s, e, l ); }
		function inviteVideo( s, e, l ) { self.handleInviteVideo( s, e, l ); }
		function inviteAudio( s, e, l ) { self.handleInviteAudio( s, e, l ); }
	}
	
	ns.Items.prototype.handleAction = function( listenId, action ) {
		const self = this;
		const handler = self.actionMap[ action.type ];
		const sub = action.data;
		const source = self.sources[ sub.sourceId ];
		if ( !handler || !source )
			return;
		
		handler( source, sub, listenId );
	}
	
	ns.Items.prototype.handleAddRelation = function( source, sub, listenId ) {
		const self = this;
		source.addRelation( sub )
			.then( ok )
			.catch( failed );
			
		function ok() {
			updateView( true );
		}
		
		function failed() {
			updateView( false );
		}
		
		function updateView( success ) {
			const update = {
				type : 'add_relation',
				data : {
					uuid    : sub.uuid,
					success : success,
				},
			};
			
			const conn = self.listeners[ listenId ];
			if ( !conn )
				return;
			
			conn.send( update );
		}
	}
	
	ns.Items.prototype.handleRemoveRelation = function( source, sub ) {
		const self = this;
		source.removeRelation( sub );
	}
	
	ns.Items.prototype.handleOpenChat = function( source, sub ) {
		const self = this;
		source.openChat( sub );
	}
	
	ns.Items.prototype.handleLiveAudio = function( source, sub ) {
		const self = this;
		source.goLiveAudio( sub );
	}
	
	ns.Items.prototype.handleLiveVideo = function( source, sub ) {
		const self = this;
		source.goLiveVideo( sub );
	}
	
	ns.Items.prototype.handleInviteVideo = function( source, sub ) {
		const self = this;
		source.inviteToLive( sub, 'video' );
	}
	
	ns.Items.prototype.handleInviteAudio = function( source, sub ) {
		const self = this;
		source.inviteToLive( sub, 'audio' );
	}
	
	ns.Items.prototype.sendResult = function( searchId, meta, resultSet ) {
		const self = this;
		const search = self.searches[ searchId ];
		const conn = self.listeners[ search.listenId ];
		if ( !conn )
			return;
		
		const total = search.results.length;
		let resultNum = search.results
			.filter( pool => pool.done )
			.length;
		
		let result = {
			type : 'result',
			data : {
				id      : searchId,
				current : resultNum,
				total   : total,
				data    : {
					sourceId : meta.sourceId,
					source   : meta.source,
					type     : meta.type,
					actions  : meta.actions,
					result   : resultSet,
				},
			},
		};
		conn.send( result );
	}
	
})( library.system );
