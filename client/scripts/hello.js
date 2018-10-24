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
		
		const self = this;
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
		self.isOnline = false;
		
		self.init();
	}
	
	// 'Public'
	
	ns.Hello.prototype.timeNow = function( str ) {
		const self = this;
		let now = Date.now();
		let sinceBeginning = now - self.startTiming;
		let sinceLast = now - self.lastTiming;
		console.log( 'Timing: ' + str, {
			total : sinceBeginning,
			last  : sinceLast,
		});
		self.lastTiming = now;
	}
	
	// Priv
	
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
		self.startTiming = Date.now();
		self.lastTiming = self.startTiming;
		
		if ( fupConf )
			self.config.run = fupConf;
		
		self.loadCommonFragments( fragmentsLoaded );
		function fragmentsLoaded() {
			self.timeNow( 'fragmentsLoaded' );
			init();
		}
		
		function init() {
			self.config.emojii = window.emojii_conf;
			self.config.protocol = document.location.protocol + '//';
			
			self.timeNow( 'init start, set showloading timeout' );
			self.showLoadingTimeout = window.setTimeout( showLoading, 1000 );
			function showLoading() {
				self.timeNow( 'show loading' );
				self.showLoadingTimeout = null;
				self.showLoading();
			}
			
			if ( !self.config ) {
				self.showLoadingStatus({
					type : 'error',
					data : Application.i18n( 'i18n_local_config_not_found' ),
				});
				return;
			}
			
			//self.msgAlert = new api.SoundAlert( 'webclient/apps/FriendChat/res/served.ogg' );
			self.msgAlert = new api.SoundAlert( 
				'webclient/apps/FriendChat/res/glass_pop_v3-epic_sound.wav' );
			
			self.getUserInfo( userInfoBack );
		}
		
		function userInfoBack( data ) {
			self.timeNow( 'user info loaded' );
			if ( !data ) {
				self.showLoadingStatus({
					type : 'error',
					data : Application.i18n( 'i18n_no_user_data_returned' ),
				});
				return;
			}
			
			hello.identity = new library.component.Identity( data );
			self.getUserAvatar()
				.then( avaBack )
				.catch( avaErr );
				
			function avaBack( avatar ) {
				hello.identity.avatar = avatar;
				self.loadHostConfig( confBack );
			}
			
			function avaErr( blah ) {
				self.loadHostConfig( confBack );
			}
		}
		
		function confBack( err, hostConf ) {
			self.hostConfigLoaded( err, hostConf );
		}
	}
	
	ns.Hello.prototype.hostConfigLoaded = function( err, hostConf ) {
		const self = this;
		if ( err ) {
			console.log( 'hostConfigLoaded - err', err );
			return;
		}
		
		self.timeNow( 'honst config loaded' );
		library.tool.mergeObjects( self.config, hostConf );
		self.preInit();
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
			console.log( 'getUserInfo - res', res );
			const data = friendUP.tool.objectify( res );
			callback( data );
		}
		
		function modErr( err ) {
			callback( false );
		}
	}
	
	ns.Hello.prototype.getUserAvatar = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const conf = {
				module : 'system',
				method : 'getsetting',
				args   : {
					setting : 'avatar',
				},
				success : avaBack,
				error   : avaErr,
			};
			
			new api.Module( conf );
			function avaBack( res ) {
				let data = null;
				try {
					data = JSON.parse( res );
				} catch ( e ) {
					console.log( 'failed to parse avatar res', res );
				}
				if ( !data )
					resolve( null );
				else
					resolve( data.avatar || null );
			}
			
			function avaErr( err ) {
				console.log( 'avaErr', err );
				resolve( null );
			}
		});
	}
	
	ns.Hello.prototype.loadCommonFragments = function( doneBack ) {
		var self = this;
		let commonLoaded = false;
		let mainLoaded = false;
		let liveLoaded = false;
		self.app.loadFile( 'Progdir:html/commonFragments.html', commonOmNoms );
		self.app.loadFile( 'Progdir:html/mainCommonFragments.html', moinmonOmNoms );
		self.app.loadFile( 'Progdir:html/liveCommonFragments.html', liveOmNomNoms );
		
		function commonOmNoms( fileContent ) {
			fileContent = Application.i18nReplaceInString( fileContent );
			hello.commonFragments = fileContent;
			if ( mainLoaded && liveLoaded )
				doneBack();
			else 
				commonLoaded = true;
		}
		
		function moinmonOmNoms( content ) {
			content = Application.i18nReplaceInString( content );
			hello.mainCommonFragments = content;
			if ( commonLoaded && liveLoaded )
				doneBack();
			else
				mainLoaded = true;
		}
		
		function liveOmNomNoms( content ) {
			content = Application.i18nReplaceInString( content );
			hello.liveCommonFragments = content;
			if ( commonLoaded && mainLoaded )
				doneBack();
			else
				liveLoaded = true;
		}
	}
	
	ns.Hello.prototype.loadHostConfig = function( doneBack ) {
		const self = this;
		const url = library.tool.buildDestination(
			self.config.protocol,
			self.config.host,
			self.config.port
		);
		
		if ( self.loadTimeout ) {
			window.clearTimeout( self.loadTimeout );
			self.loadTimeout = null;
		}
		
		if ( self.hostConfRequest ) {
			self.hostConfRequest.abort(); // XMLHTTPRequest
			self.hostConfRequest = null;
		}
		
		if ( self.loadRequestDelay ) {
			window.clearTimeout( self.loadRequestDelay );
			self.loadRequestDelay = null;
		}
		
		load( success, loadErr );
		self.loadTimeout = window.setTimeout( loadingTimeout, 1000 * 15 );
		
		function load( success, loadErr ) {
			if ( self.loading )
				self.showLoadingStatus({
					type : 'load',
					data : Date.now(),
				});
			
			const conf = {
				verb    : 'get',
				url     : url,
				data    : null,
				success : success,
				error   : loadErr,
			};
			self.hostConfRequest = library.tool.asyncRequest( conf );
		}
		
		function loadingTimeout() {
			console.log( 'loading host config timed out', self.hostConfRequest );
			try {
				self.hostConfRequest.abort();
			} catch( e ) {
				console.log( 'loadingTimeout - exp while aborting request', e );
			}
			
			self.hostConfRequest = null;
			
			self.showLoadingStatus({
				type : 'error',
				data : 'Loading host config timed out: ' + url,
			});
			
			let delay = 1000 * 15;
			let reconnectTime = Date.now() + delay;
			self.showLoadingStatus({
				type : 'wait-reconnect',
				data : {
					time : reconnectTime,
				},
			});
			
			self.loadRequestDelay = window.setTimeout( retryLoad, delay );
			function retryLoad() {
				self.loadHostConfig( doneBack );
			}
		}
		
		function success( response ) {
			hasLoadRes();
			if ( !response ) {
				self.showLoadingStatus({
					type : 'error',
					data : Application.i18n( 'i18n_host_config_failed' ) + ' ' + url,
				});
				return;
			}
			
			var hostConf = library.tool.objectify( response );
			if ( !hostConf ) {
				self.showLoadingStatus({
					type : 'error',
					data : Application.i18n( 'i18n_host_config_failed_invalid' ) + ' ' + url,
				});
				return;
			}
			
			doneBack( null, hostConf );
		}
		
		function loadErr( err ) {
			hasLoadRes();
			err = err || 'ERR_LOAD_HOST_CONF';
			console.log( 'loadErr', err );
			self.showLoadingStatus({
				type : 'error',
				data : Application.i18n( 'i18n_host_config_failed_error' ) + ' ' + url,
			});
			doneBack( err, null );
		}
		
		function hasLoadRes() {
			if ( !self.loadTimeout )
				return;
			
			window.clearTimeout( self.loadTimeout );
			self.loadTimeout = null;
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
		self.timeNow( 'initSystemModules' );
		self.conn = new library.system.Connection( null, onWSState );
		self.items = new library.system.Items();
		self.request = new library.system.Request({ conn : self.conn });
		self.intercept = new library.system.Interceptor();
		self.rtc = new library.system.RtcControl();
		self.dormant = new library.system.Dormant();
		
		self.conn.connect( connBack );
		function connBack( err ) {
			self.timeNow( 'ws connected' );
			if( err ) {
				console.log( 'connBack - conn err', err );
				self.showLoadingStatus( err );
				return;
			}
			
			self.connected = true;
			self.closeLoading( loadingClosed );
		}
		
		function loadingClosed() {
			callback();
		}
		
		function onWSState( e ) { self.updateConnState( e ); }
	}
	
	ns.Hello.prototype.showLoading = function() {
		const self = this;
		if ( self.showLoadingTimeout ) {
			window.clearTimeout( self.showLoadingTimeout );
			self.showLoadingTimeout = null;
		}
		
		self.closeLoadingTimeout = window.setTimeout( canCloseNow, 3000 );
		self.loading = new library.view.Loading( reconnect, loadingClosed );
		function canCloseNow() {
			self.closeLoadingTimeout = null;
			if ( self.closeLoadingPlease )
				self.closeLoading();
		}
		
		function reconnect( e ) {
			self.loadHostConfig( loadBack );
			function loadBack( err , res ) {
				self.hostConfigLoaded( err , res );
			}
		}
		
		function loadingClosed() {
			self.loadingClosed();
		}
	}
	
	ns.Hello.prototype.showLoadingStatus = function( status ) {
		const self = this;
		if ( 'session' === status.type )
			return;
		
		if ( self.showLoadingTimeout &&
			(      'error' === status.type
				|| 'timeout' === status.type )
		) {
			self.showLoading();
		}
		
		if ( !self.loading )
			return;
		
		if ( self.closeLoadingPlease && 'error' === status.type ) {
			self.closeLoadingPlease = false;
			self.closeLoadingCallback = null;
		}
		
		self.loading.setState( status );
	}
	
	ns.Hello.prototype.closeLoading = function( callback ) {
		const self = this;
		self.timeNow( 'closeLoading' );
		if ( self.showLoadingTimeout ) {
			window.clearTimeout( self.showLoadingTimeout );
			self.showLoadingTimeout = null;
			done();
			return;
		}
		
		if ( self.closeLoadingTimeout ) {
			self.closeLoadingPlease = true;
			self.closeLoadingCallback = callback;
			return;
		}
		
		if ( !self.loading ) {
			done();
			return;
		}
		
		self.loading.close();
		self.loading = null;
		done();
		
		function done() {
			callback = callback || self.closeLoadingCallback;
			delete self.closeLoadingCallback;
			
			if ( callback )
				callback( true );
		}
	}
	
	ns.Hello.prototype.loadingClosed = function() {
		var self = this;
		if ( self.loading )
			self.loading.close();
		
		if ( self.closeLoadingTimeout ) {
			window.clearTimeout( self.closeLoadingTimeout );
			self.closeLoadingTimeout = null;
		}
		
		self.loading = null;
		
		if ( self.closeLoadingCallback ) {
			let callback = self.closeLoadingCallback;
			delete self.closeLoadingCallback;
			callback( true );
		}
		
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
		
		self.closeLoading();
		const conf = self.config.run;
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
					//avatar : library.component.Identity.prototype.avatar,
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
			if ( !conf.data && !conf.data.host ) {
				console.log( 'missing host', conf );
				return;
			}
			
			var host = library.tool.buildDestination( 'wss://', conf.data.host );
			self.conn = new library.system.Connection( host, onWSState );
			self.items = new library.system.Items();
			self.intercept = new library.system.Interceptor();
			self.rtc = new library.system.RtcControl();
			self.conn.connect( connBack );
			
			function connBack( err, res ) {
				if ( err ) {
					self.showLoadingStatus( err );
					return;
				}
				
				self.connected = true;
				self.closeLoading( loadClosed );
			}
			
			function loadClosed() {
				callback();
			}
			
			function onWSState( e ) { self.updateConnState( e ); }
		}
	}
	
	ns.Hello.prototype.setupLiveRoom = function( permissions ) {
		const self = this;
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
		
		self.login = new library.system.Login( null, onlogin, onclose );
		function onlogin( account ) {
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
			
			self.timeNow( 'logged in, open main' );
			self.doMain( account );
		}
		
		function onclose() {
			self.login = null;
			self.checkQuit();
		}
	}
	
	ns.Hello.prototype.doRelogin = function() {
		const self = this;
		self.triedRelogin = true;
		self.conn.reconnect( connected );
		function connected( err, res ) {
			if ( err ) {
				console.log( 'doRelogin connect failed', err );
				
				return;
			}
			
			const acc = {
				clientId : self.account.clientId,
				name     : self.account.displayName,
			};
			self.login = new library.system.Login( acc, success, fail );
		}
		
		function success( account ) {
			self.triedRelogin = false;
			self.module.reconnect();
		}
		
		function fail( ) {
			console.log( 'relogin fail' );
			self.quit();
		}
	}
	
	ns.Hello.prototype.doMain = function( account ) {
		var self = this;
		self.main = new library.system.Main({
			parentView : window.View,
			account    : account,
			identity   : hello.identity,
		});
	}
	
	ns.Hello.prototype.reconnect = function() {
		var self = this;
		self.conn.reconnect();
	}
	
	ns.Hello.prototype.updateConnState = function( state ) {
		const self = this;
		console.log( 'updateConnState', state );
		const isOnline = checkIsOnline( state );
		self.updateIsOnline( isOnline );
		if (   'error' === state.type
			|| 'close' === state.type
			|| 'end' === state.type
			|| 'timeout' === state.type
		) {
			self.connected = false;
		}
		
		if ( self.loading ) {
			self.showLoadingStatus( state );
			return;
		}
		
		if ( 'end' === state.type && !self.triedRelogin ) {
			self.doRelogin();
			return;
		}
		
		if ( self.main )
			self.main.setConnState( state );
		
		function checkIsOnline( state ) {
			if ( 'session' !== state.type )
				return false;
			
			if ( !state.data )
				return false;
			
			return true;
		}
	}
	
	ns.Hello.prototype.updateIsOnline = function( isOnline ) {
		const self = this;
		if ( isOnline === self.isOnline )
			return;
		
		self.app.toAllViews({
			type : 'app-online',
			data : isOnline,
		});
		
		self.isOnline = isOnline;
		if ( self.main )
			self.main.setIsOnline( self.isOnline );
		
		if ( self.module )
			self.module.setIsOnline( self.isOnline );
	}
	
	// From main view
	ns.Hello.prototype.handleConnState = function( e ) {
		const self = this;
		if ( 'reconnect' === e.type )
			self.conn.reconnect();
		
		if ( 'quit' === e.type )
			self.quit();
	}
	
	ns.Hello.prototype.preLoginDisconnect = function() {
		var self = this;
		if ( hello.login || hello.loading ) {
			hello.log.show();
		}
		
		if ( hello.loading ) {
			hello.loading.close();
			hello.loading = null;
		}
		
		if ( hello.login ) {
			hello.login.close();
			hello.login = null;
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
	
	// Public
	
	ns.Main.prototype.setConnState = function( state ) {
		const self = this;
		self.view.sendMessage({
			type : 'conn-state',
			data : state,
		});
	}
	
	ns.Main.prototype.setIsOnline = function( isOnline ) {
		const self = this;
		/*
		self.view.sendMessage({
			type : 'app-online',
			data : isOnline,
		});
		*/
	}
	
	// Private
	
	ns.Main.prototype.init = function() {
		const self = this;
		const firstLogin = !self.account.lastLogin;
		if ( firstLogin ) {
			self.recentHistory = {};
			const firstLoginConf = {
				advancedUI : false,
			};
			doSetup( firstLoginConf );
		}
		else
			loadRecentHistory();
		
		function loadRecentHistory() {
			api.ApplicationStorage.get( 'recent-history', recentBack );
			function recentBack( res ) {
				self.recentHistory = res.data || {};
				doSetup( null );
			}
		}
		
		function doSetup( firstLoginConf ) {
			if ( firstLoginConf )
				self.advancedUI = firstLoginConf.advancedUI;
			else
				self.advancedUI = self.account.settings.advancedUI;
				
			if ( !!self.account.settings.onNewScreen )
				Application.screen = new api.Screen( 'Friend Chat' );
			
			const initConf = {
				fragments     : hello.commonFragments,
				mainFragments : hello.mainCommonFragments,
				account       : self.account,
				identity      : hello.identity,
				recentHistory : self.recentHistory,
			};
			
			if ( self.advancedUI )
				self.openAdvView( initConf, viewClose );
			else
				self.openSimpleView( initConf, viewClose );
			
			self.view.onready = ready;
			
			self.bindView();
			self.setMenuItems();
			
			function ready( msg ) {
				self.initSubViews();
				hello.account.sendReady( firstLoginConf || null );
				hello.timeNow( 'main open' );
			}
			
			function viewClose( msg ) {
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
			wiz.close();
			callback( res );
		}
	}
	
	ns.Main.prototype.openSimpleView = function( initConf, onClose ) {
		const self = this;
		const winConf = {
			title: hello.config.appName || 'Friend Chat',
			width : 440,
			height : 600,
		};
		
		self.view = hello.app.createView(
			'html/mainSimple.html',
			winConf,
			initConf,
			null,
			onClose
		);
	}
	
	ns.Main.prototype.openAdvView = function( initConf, onClose ) {
		const self = this;
		const winConf = {
			title: hello.config.appName || 'Friend Chat',
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
		const self = this;
		self.searchListenId = hello.items.startListen( self.view );
		
		self.view.receiveMessage = receiveMessage;
		self.view.on( 'about', showAbout );
		self.view.on( 'live', startLive );
		self.view.on( 'quit', doQuit );
		self.view.on( 'logout', logout );
		self.view.on( 'conn-state', connState );
		self.view.on( 'recent-save', recentSave );
		self.view.on( 'recent-remove', recentRemove );
		
		function receiveMessage( e ) { self.receiveMessage( e ); }
		function startLive( e ) { self.startLive(); }
		function showAbout( e ) { hello.about(); }
		function doQuit( e ) { hello.quit(); }
		function logout( e ) { hello.logout( e ); }
		function connState( e ) { hello.handleConnState( e ); }
		function recentSave( e ) { self.handleRecentSave( e ); }
		function recentRemove( e ) { self.handleRecentRemove( e );}
	}
	
	ns.Main.prototype.setMenuItems = function() {
		const self = this;
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
		/*
		var identity = {
			name : hello.identity.name || library.tool.getName(),
			avatar : library.component.Identity.prototype.avatar,
		};
		*/
		hello.rtc.createRoom( null, null );
	}
	
	ns.Main.prototype.handleRecentSave = function( item ) {
		const self = this;
		const mId = item.moduleId;
		const cId = item.clientId;
		const recent = self.recentHistory;
		recent[ mId ] = recent[ mId ] || {};
		recent[ mId ][ cId ] = item.lastEvent || null;
		api.ApplicationStorage.set( 'recent-history', recent, saveBack );
		
		function saveBack( res ) {
			self.recentHistory = res.data;
		}
	}
	
	ns.Main.prototype.handleRecentRemove = function( item ) {
		const self = this;
		const recent = self.recentHistory;
		const mId = item.moduleId;
		const cId = item.clientId;
		if ( !recent[ mId ] || !recent[ mId ][ cId ] )
			return;
		
		delete recent[ mId ][ cId ];
		api.ApplicationStorage.set( 'recent-history', recent, saveBack );
		function saveBack( res ) {
		}
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
		
		if ( self.searchListenId ) {
			hello.items.stopListen( self.searchListenId );
			self.searchListenId = null;
		}
		
		// this is just to clear out any rogue views
		// wtf ??????
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
