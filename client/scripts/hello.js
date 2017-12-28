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
var api = window.api;
var hello = null;

// HELLO
(function( ns, undefined ) {
	ns.Hello = function( app, conf ) {
		if ( !( this instanceof ns.Hello ))
			return new ns.Hello( app, conf );
		
		var self = this;
		self.app = app;
		self.config = conf;
		self.account = null;
		self.conn = null;
		self.contact = null;
		self.main = null;
		self.module = null;
		self.log = null;
		self.login = null;
		self.loading = null;
		self.rtc = null;
		self.template = null;
		self.msgAlert = null;
		
		self.forceShowLogin = false;
		
		self.init();
	}
	
	ns.Hello.prototype.init = function() {
		var self = this;
		self.app.run = fun;
		self.app.receiveMessage = receiveMessage;
		
		self.log = new library.system.Log( logClose );
		
		function fun( msg ) { self.run( msg ); }
		function receiveMessage( msg ) { self.receiveMessage( msg ); }
		function logClose() { self.checkQuit(); }
	}
	
	ns.Hello.prototype.run = function( fupConf ) {
		const self = this;
		if ( fupConf )
			self.config.run = fupConf;
		
		self.config.emojii = window.emojii_conf;
		self.config.protocol = document.location.protocol + '//';
		self.config.appName = 'Friend Chat';
		
		self.loading = new library.view.Loading( loadingClosed );
		function loadingClosed() { self.loadingClosed(); }
		
		if ( !self.config ) {
			self.showLoadingError( Application.i18n( 'i18n_local_config_not_found' ));
			return;
		}
		
		//self.msgAlert = new api.SoundAlert( 'webclient/apps/FriendChat/res/served.ogg' );
		self.msgAlert = new api.SoundAlert( 
			'webclient/apps/FriendChat/res/glass_pop_v3-epic_sound.wav' );
		
		self.getUserInfo( userInfoBack )
		function userInfoBack( data ) {
			if ( !data ) {
				self.showLoadingError( Application.i18n( 'i18n_no_user_data_returned' ));
				return;
			}
			
			hello.identity = new library.component.Identity( data );
			self.loadCommonFragments( fragmentsLoaded );
		}
		
		function fragmentsLoaded() {
			self.loadHostConfig( confLoaded );
		}
		
		function confLoaded() {
			self.preInit();
		}
	}
	
	ns.Hello.prototype.getUserInfo = function( callback ) {
		const self = this;
		const args = {
			id : undefined,
		};
		
		const conf = {
			module  : 'system',
			method  : 'userinfoget',
			args    : args,
			success : modBack,
			error   : modErr,
		};
		
		new api.Module( conf );
		function modBack( res ) {
			const data = friendUP.tool.objectify( res );
			callback( data );
		}
		
		function modErr( err ) {
			console.log( 'modErr', err );
			callback( false );
		}
	}
	
	ns.Hello.prototype.loadCommonFragments = function( doneBack ) {
		var self = this;
		self.app.loadFile( 'Progdir:html/commonFragments.html', fileOmNomNom );
		
		function fileOmNomNom( fileContent ) {
			fileContent = Application.i18nReplaceInString( fileContent );
			hello.commonFragments = fileContent;
			doneBack();
		}
	}
	
	ns.Hello.prototype.loadHostConfig = function( doneBack ) {
		var self = this;
		var url = library.tool.buildDestination(
			self.config.protocol,
			self.config.host,
			self.config.port );
		library.tool.asyncRequest({
			verb : 'get',
			url : url,
			data : null,
			success : success,
			error : whelpsHandleIt,
		});
		
		function success( response ) {
			if ( !response ) {
				self.showLoadingError(
					Application.i18n( 'i18n_host_config_failed' ) + ' ' + url );
				return;
			}
			
			var hostConf = library.tool.objectify( response );
			if ( !hostConf ) {
				self.showLoadingError(
					Application.i18n( 'i18n_host_config_failed_invalid' ) + ' ' + url );
				return;
			}
			library.tool.mergeObjects( self.config, hostConf );
			doneBack();
		}
		
		function whelpsHandleIt( err ) {
			self.showLoadingError( 
				Application.i18n( 'i18n_host_config_failed_error' ) + ' ' + url );
		}
	}
	
	ns.Hello.prototype.preInit = function() {
		const self = this;
		if ( 'API' === self.identity.level )
			self.doGuestThings();
		else
			self.initSystemModules( connBack );
		
		function connBack() {
			self.doLogin();
		}
	}
	
	ns.Hello.prototype.initSystemModules = function( callback ) {
		var self = this;
		self.conn = new library.system.Connection();
		self.request = new library.system.Request({ conn : self.conn });
		self.intercept = new library.system.Interceptor();
		self.rtc = new library.system.RtcControl();
		self.dormant = new library.system.Dormant();
		
		self.conn.connect( connBack );
		function connBack( err ) {
			if( err ) {
				console.log( 'connBack - conn err', err );
				self.showLoadingError( err );
				return;
			}
			
			self.connected = true;
			self.closeLoading();
			callback();
		}
	}
	
	ns.Hello.prototype.showLoadingError = function( errMsg ) {
		var self = this;
		if ( !self.loading ) {
			self.quit();
			return;
		}
		
		self.loading.setError( errMsg );
	}
	
	ns.Hello.prototype.closeLoading = function() {
		var self = this;
		if ( !self.loading )
			return;
		
		self.loading.close();
		self.loading = null;
	}
	
	ns.Hello.prototype.loadingClosed = function() {
		var self = this;
		self.loading = null;
		
		if ( !self.connected )
			self.checkQuit();
	}
	
	ns.Hello.prototype.doGuestThings = function() {
		var self = this;
		if (
			!self.config.run ||
			!self.config.run.type ||
			!self.config.run.data
		) {
			console.log( 'Hello - Guest login - invalid config', self.config.run );
			throw new Error( 'see log ^^^' );
		}
		
		const conf = self.config.run;
		console.log( 'doGuestThings - conf', conf );
		if ( 'live-invite' === conf.type ) {
			const randomName = library.tool.getName();
			const askConf = {
				name          : randomName,
				message       : 'You are joining a Live room as a guest.',
				activeSession : false,
				inviteHost    : 'leeloo',
			};
			new library.view.RtcAsk( askConf, askBack );
			return; // prevents unknown data thingie, down there *points*
			
			function askBack( res ) {
				console.log( 'doGuiestThings - askBack', res );
				if ( !res.accept ) {
					self.quit();
					return;
				}
				
				setupUser( res );
			}
			
			function setupUser( options ) {
				self.loggedIn = true;
				let identity = conf.data.identity || {
					name   : options.name,
					avatar : library.component.Identity.prototype.avatar,
				};
				
				const inviteBundle = {
					type : 'anon-invite',
					data : {
						tokens : {
							token  : conf.data.token,
							roomId : conf.data.roomId,
						},
						identity : identity,
					},
				};
				self.setAuthBundle( inviteBundle );
				initPresenceConnection( connBack );
				
				function connBack() {
					self.setupLiveRoom( options.permissions );
				}
			}
		}
		
		if ( 'live-host' === conf.type ) {
			console.log( 'live-host - NYI', conf )
			return;
			self.loggedIn = true;
			var identity = {
				name :  library.tool.getName(),
				avatar : library.component.Identity.prototype.avatar,
			};
			var contact = {
				clientId : friendUP.tool.uid( 'dummy' ),
			};
			contact.invite = returnInvite;
			self.rtc.createHost( [ contact ], identity );
			return;
			
			function returnInvite( invite ) {
				if ( !invite || !invite.length )
					return;
				
				var msg = {
					type : 'live-invite',
					data : invite,
				};
				hello.app.postOut( msg );
			}
		}
		
		console.log( 'unknown data for API user', self.config.run );
		hello.log.alert( Application.i18n('i18n_unknown_data_for_api_user') );
		hello.log.show();
		
		function initPresenceConnection( callback ) {
			const conf = self.config.run;
			console.log( 'doGuestTHings', conf );
			if ( !conf.data && !conf.data.host ) {
				console.log( 'missing host', conf );
				return;
			}
			
			var host = library.tool.buildDestination( 'wss://', conf.data.host );
			console.log( 'host', host );
			self.conn = new library.system.Connection( host );
			self.intercept = new library.system.Interceptor();
			self.rtc = new library.system.RtcControl();
			self.conn.connect( connBack );
			
			function connBack( err ) {
				if ( err ) {
					self.showLoadingError( err );
					return;
				}
				
				self.connected = true;
				self.closeLoading();
				callback();
			}
		}
	}
	
	ns.Hello.prototype.setupLiveRoom = function( permissions ) {
		const self = this;
		console.log( 'setupLiveRoom', permissions );
		new library.component.GuestRoom( self.conn, permissions, onclose );
		function onclose() { self.quit(); }
		
		//self.rtc.createClient( self.config.run.data );
	}
	
	ns.Hello.prototype.doLogin = function() {
		var self = this;
		if ( self.login ) {
			self.login.close();
			self.login = null;
		}
		
		if ( self.main )
			self.main.logout();
			self.main = null;
		
		self.login = new library.system.Login( onlogin, onclose );
		function onlogin( account ) {
			self.closeLoading();
			
			self.loggedIn = true;
			self.login.close();
			self.login = null;
			if ( !account ) {
				hello.log.alert( Application.i18n( 'i18n_no_account_to_login' ) );
				hello.log.show();
				return;
			}
			
			hello.log.positive( 
				Application.i18n( 'i18n_logged_in_as' ) + ': ' + account.name );
			self.doMain( account );
		}
		
		function onclose() {
			self.login = null;
			self.checkQuit();
		}
	}
	
	ns.Hello.prototype.doMain = function( account ) {
		var self = this;
		self.main = new library.system.Main({
			parentView : window.View,
			account : account,
		});
	}
	
	ns.Hello.prototype.reconnect = function() {
		var self = this;
		self.conn.reconnect();
	}
	
	ns.Hello.prototype.connectionLost = function() {
		var self = this;
		hello.log.show();
		if ( hello.login ) {
			hello.login.close();
			hello.login = null;
		}
		
		if ( hello.main ) {
			hello.logout();
			hello.main = null;
		}
	}
	
	// TODO : reopen views
	ns.Hello.prototype.show = function() {
		var self = this;
		console.log( 'Hello.show() - NYI' );
	}
	
	// TODO : close views while staying logged in
	ns.Hello.prototype.hide = function() {
		var self = this;
		console.log( 'Hello.hide() - NYI' );
	}
	
	ns.Hello.prototype.setAuthBundle = function( bundle ) {
		const self = this;
		self.authBundle = bundle;
	}
	
	ns.Hello.prototype.getAuthBundle = function() {
		const self = this;
		if ( self.authBundle )
			return self.authBundle;
		
		// default
		const bundle = {
			type :  'authid',
			data : {
				tokens : {
					authId : self.app.authId,
					userId : self.identity.fupId,
				},
				login : hello.identity.alias,
			},
		};
		return bundle;
	}
	
	ns.Hello.prototype.logout = function() {
		var self = this;
		self.loggedIn = false;
		self.forceShowLogin = true;
		self.main.logout();
		self.main = null;
		self.conn.close();
		self.conn.connect( connReady );
		function connReady() {
			self.log.notify( 'Logged out' );
			self.doLogin();
		}
	}
	
	ns.Hello.prototype.close = function() {
		var self = this;
		if ( self.main ) {
			self.main.close();
			self.main = null;
		}
		
		if ( self.login ) {
			self.login.close();
			self.login = null;
		}
		
		// clean up any remaining views
		self.app.close();
	}
	
	ns.Hello.prototype.checkQuit = function() {
		var self = this;
		if ( !self.main && !self.login && !self.log.view && !self.loggedIn )
			self.quit();
	}
	
	ns.Hello.prototype.quit = function() {
		var self = this;
		if ( self.conn )
			self.conn.close();
		
		self.app.quit();
	}
	
	ns.Hello.prototype.about = function() {
		var self = this;
		if ( self.aboutView )
			return;
		
		self.aboutView = new library.view.About( onclose );
		function onclose() { delete self.aboutView; }
	}
	
	ns.Hello.prototype.playMsgAlert = function() {
		var self = this;
		if ( !self.msgAlert )
			return;
		
		if ( hello.account.settings.msgAlert )
			self.msgAlert.play();
	}
	
	ns.Hello.prototype.receiveMessage = function( msg ) {
		var self = this;
		console.log( 'Hello.receiveMessage', msg );
	}
	
})( window );


// MAIN
(function( ns, undefined ) {
	ns.Main = function( conf ) {
		if ( !( this instanceof ns.Main ))
			return new ns.Main( conf );
		
		const self = this;
		self.account = conf.account;
		self.parentView = conf.parentView || window.View;
		self.viewReady = false;
		self.advancedUI = false;
		self.isLogout = false;
		
		self.init();
	}
	
	ns.Main.prototype.init = function() {
		const self = this;
		console.log( 'Main.init - account', self.account );
		const firstLogin = !self.account.lastLogin;
		if ( firstLogin )
			self.showWizard( doSetup );
		else
			doSetup();
		
		function doSetup( wizRes ) {
			if ( wizRes )
				self.advancedUI = wizRes.advancedUI;
			else
				self.advancedUI = self.account.settings.advancedUI;
				
			if ( !!self.account.settings.onNewScreen )
				Application.screen = new api.Screen( 'Friend Chat' );
			
			const initConf = {
				fragments : hello.commonFragments,
				account   : self.account,
			};
			
			if ( self.advancedUI )
				self.openAdvView( initConf, viewClose );
			else
				self.openSimpleView( initConf, viewClose );
			
			self.view.onready = ready;
			
			self.bindView();
			self.setMenuItems();
			
			function ready( msg ) {
				hello.conn.state.subscribe( 'main', connState );
				self.initSubViews();
				hello.account.sendReady( wizRes || null );
			}
			
			function connState( state ) {
				
			}
			
			function viewClose( msg ) {
				hello.conn.state.unsubscribe( 'main' );
				self.view = null;
				if ( self.isLogout )
					return;
				
				self.quit();
			}
		}
	}
	
	ns.Main.prototype.showWizard = function( callback ) {
		const self = this;
		let wiz = new library.view.FirstWizard( wizBack );
		function wizBack( res ) {
			console.log( 'wizBack', res );
			wiz.close();
			callback( res );
		}
	}
	
	ns.Main.prototype.openSimpleView = function( initConf, onClose ) {
		const self = this;
		console.log( 'openSimpleView' );
		const winConf = {
			title: hello.config.appName + ' - Main Window',
			width : 440,
			height : 600,
		};
		
		self.view = hello.app.createView(
			'html/main-simple.html',
			winConf,
			initConf,
			null,
			onClose
		);
	}
	
	ns.Main.prototype.openAdvView = function( initConf, onClose ) {
		const self = this;
		console.log( 'openAdvView' );
		const winConf = {
			title: hello.config.appName + ' - Main Window',
			width : 440,
			height : 600,
		};
		
		self.view = hello.app.createView(
			'html/main.html',
			winConf,
			initConf,
			null,
			onClose
		);
	}
	
	ns.Main.prototype.bindView = function() {
		var self = this;
		self.view.receiveMessage = receiveMessage;
		self.view.on( 'about', showAbout );
		self.view.on( 'live', startLive );
		self.view.on( 'quit', doQuit );
		self.view.on( 'logout', logout );
		
		function receiveMessage( msg ) { self.receiveMessage( msg ); }
		function startLive( msg ) { self.startLive(); }
		function showAbout( e ) { hello.about(); }
		function doQuit( e ) { hello.quit(); }
		function logout( msg ) { hello.logout( msg ); }
	}
	
	ns.Main.prototype.setMenuItems = function() {
		var self = this;
		// FILE
		const startLive = {
			name    : Application.i18n('i18n_start_live'),
			command : 'tools_start_live',
		};
		const addChat = {
			name    : Application.i18n('i18n_add_chat_account'),
			command : 'tools_add_module',
		};
		const about = {
			name    : Application.i18n('i18n_about'),
			command : 'file_about',
		};
		const quit = {
			name    : Application.i18n('i18n_quit'),
			command : 'file_quit',
		};
		
		let fileItems = null;
		if ( self.advancedUI )
			fileItems = [
				startLive,
				addChat,
				about,
				quit,
			];
		else
			fileItems = [
				startLive,
				about,
				quit,
			];
		
		const file = {
			name : Application.i18n('i18n_file'),
			items : fileItems,
		};
		
		// ACCOUNT
		const settings = {
			name    : Application.i18n('i18n_account_settings'),
			command : 'account_account',
		};
		const logout = {
			name    : Application.i18n('i18n_log_out'),
			command : 'account_logout',
		};
		const accItems = [
			settings,
			logout,
		];
		const account = {
			name : Application.i18n('i18n_account_menu'),
			items : accItems,
		};
		
		/*
		// TOOL
		const addChat = {
			name    : Application.i18n('i18n_add_chat_account'),
			command : 'tools_add_module',
		};
		const startLive = {
			name    : Application.i18n('i18n_start_live'),
			command : 'tools_start_live',
		};
		const toolItems = [
			addChat,
			startLive,
		];
		const tool = {
			name : Application.i18n('i18n_tools'),
			items : toolItems,
		};
		*/
		
		//
		const menuItems = [
			file,
			account,
		];
		
		self.view.setMenuItems( menuItems );
		
		hello.app.on( 'file_about' , fileAbout );
		hello.app.on( 'file_quit'  , fileQuit );
		
		hello.app.on( 'account_account' , accountSettings );
		hello.app.on( 'account_logout'  , menuLogout );
		
		hello.app.on( 'tools_add_module' , addModule );
		hello.app.on( 'tools_start_live' , toolStartLive );
		
		function fileAbout( e ) { hello.about(); }
		function fileQuit( e ) { hello.quit(); }
		
		function accountSettings( e ) { hello.account.getSettings(); }
		function menuLogout( e ) { hello.logout( e ); }
		
		function addModule( e ) { hello.module.showCreateForm(); }
		function toolStartLive( e ) { self.startLive(); }
	}
	
	ns.Main.prototype.startLive = function() {
		var self = this;
		var identity = {
			name : hello.identity.name || library.tool.getName(),
			avatar : library.component.Identity.prototype.avatar,
		};
		hello.rtc.createRoom( null, identity );
	}
	
	ns.Main.prototype.initSubViews = function() {
		var self = this;
		self.notification = new library.system.Notification({
			parentView : self.view,
		});
		
		hello.account = new library.system.Account({
			parentView : self.view,
			account : self.account,
		});
		
		hello.module = new library.system.ModuleControl({
			parentView : self.view,
			//firstLogin : self.account.firstLogin,
		});
	}
	
	ns.Main.prototype.closeThings = function() {
		var self = this;
		
		if ( hello.module ) {
			hello.module.close();
			hello.module = null;
		}
		if ( hello.account ) {
			hello.account.close();
			hello.account = null;
		}
		
		if ( self.view ) {
			self.view.close();
			self.view = null;
		}
		
		// this is just to clear out any rogue views
		hello.app.close();
	}
	
	ns.Main.prototype.close = function() {
		var self = this;
		self.logout();
	}
	
	ns.Main.prototype.logout = function() {
		var self = this;
		self.isLogout = true;
		self.closeThings();
	}
	
	ns.Main.prototype.quit = function() {
		var self = this;
		self.closeThings();
		hello.quit();
	}
	
	ns.Main.prototype.receiveMessage = function( msg ) {
		var self = this;
		console.log( 'main.receiveMessage - unhandled view message', msg );
	}
	
})( library.system );

hello = new window.Hello( window.Application, window.localconfig );