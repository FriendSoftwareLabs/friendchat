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
var api = window.api;
var hello = null;

// HELLO
(function( ns, undefined ) {
	ns.Hello = function( app, conf ) {
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
		self.rtc = null;
		self.template = null;
		self.msgAlert = null;
		
		self.avatarStatus = null;
		self.forceShowLogin = false;
		self.isOnline = false;
		self.pushies = [];
		self.loaded = false;
		self.loadedCallbacks = [];
		self.resumeCallbacks = [];
		
		self.init();
	}
	
	// """"Public""""
	
	ns.Hello.prototype.focusMain = function() {
		const self = this;
		if ( !self.main )
			return;
		
		self.main.focus();
	}
	
	// Presence calls this
	ns.Hello.prototype.setServiceProvider = function( service ) {
		const self = this;
		self.service = service;
		if ( self.pushies && self.pushies.length )
			self.pushies.forEach( e => {
				self.service.handleNotification( e.extra, e.view );
			});
	}
	
	ns.Hello.prototype.getIdConf = function() {
		const self = this;
		const id = hello.identity;
		const conf = {
			fUserId : id.fUserId,
			name    : id.name,
			alias   : id.alias,
			avatar  : self.avatarStatus,
			email   : id.email,
			level   : id.level,
		};
		
		return conf;
	}
	
	ns.Hello.prototype.getAuthBundle = function() {
		const self = this;
		if ( self.authBundle )
			return self.authBundle;
		
		// default
		const bundle = {
			type :  'authid',
			data : {
				tokens  : {
					authId : self.app.authId,
					userId : self.identity.fupId,
				},
				login   : hello.identity.alias,
				fUserId : hello.identity.fUserId,
			},
		};
		return bundle;
	}
	
	ns.Hello.prototype.updateAvatar = function( avatar ) {
		const self = this;
		self.avatarStatus = avatar;
		hello.identity.updateAvatar( avatar );
		api.ApplicationStorage.set( 'avatar', avatar )
			.then( setBack )
			.catch( err => {
				console.log( 'hello.updateAvatar - storage err', err );
			});
		
		function setBack( res ) {
			//console.log( 'updateAvatar.setBack', res );
		}
	}
	
	ns.Hello.prototype.timeNow = function( str ) {
		const self = this;
		const now = Date.now();
		if ( null == self.startTiming ) {
			self.startTiming = now;
			self.lastTiming = now;
			console.log( 'Timing: ' + str, 0 );
			return;
		}
		
		const sinceBeginning = now - self.startTiming;
		const sinceLast = now - self.lastTiming;
		console.log( 'Timing: ' + str, {
			'total'     : sinceBeginning,
			'last step' : sinceLast,
		});
		self.lastTiming = now;
	}
	
	// Private
	
	ns.Hello.prototype.init = function() {
		const self = this;
		self.timeNow( 'init' );
		if ( self.config.dev )
			self.app.setDev( self.config.host );
		
		self.app.run = fun;
		self.app.receiveMessage = receiveMessage;
		
		self.log = new library.system.Log( logClose );
		
		function fun( msg ) { self.run( msg ); }
		function receiveMessage( msg ) { self.receiveMessage( msg ); }
		function logClose() { self.checkQuit(); }
	}
	
	ns.Hello.prototype.run = function( fupConf ) {
		const self = this;
		self.timeNow( 'run' );
		self.app.setSingleInstance( true );
		self.main = new library.system.Main();
		self.listenSystemEvents();
		if ( !self.config ) {
			self.showConnStatus({
				type : 'error',
				data : Application.i18n( 'i18n_local_config_not_found' ),
			});
			return;
		}
		
		self.config.run = fupConf || null;
		
		self.config.emojii = window.emojii_conf;
		self.config.protocol = document.location.protocol + '//';
		
		try {
			self.msgAlert = new api.SoundAlert(
				'webclient/apps/FriendChat/res/Friend_Hello.wav' );
		} catch( ex ) {
			self.msgAlert = null;
			console.log( 'failed to initialize SoundAlert', ex );
		}
		
		self.timeNow( 'loadCommonFragments' );
		self.loadCommonFragments()
			.then( fragsLoaded )
			.catch( err => { 
				console.log( 'loadCommonFragments - err', err );
				error( 'ERR_LOAD_FRAGMENTS' );
		});
		
		function fragsLoaded() {
			self.timeNow( 'fragmentsLoaded' );
			let doRun = false;
			let openMinimized = false;
			if ( self.config.run )
				openMinimized = self.handleRunConf();
			
			self.openMain( openMinimized );
			self.doLoaded();
			
			getUser();
		}
		
		function getUser() {
			self.timeNow( 'getUser start' );
			self.getUserInfo()
				.then( userInfoBack )
				.catch( e => {
					console.log( 'e', e );
					error( 'ERR_LOAD_USERINFO' );
				});
		}
		
		function userInfoBack( userInfo ) {
			self.timeNow( 'user info loaded' );
			if ( !userInfo ) {
				self.showConnStatus({
					type : 'error',
					data : Application.i18n( 'i18n_no_user_data_returned' ),
				});
				return;
			}
			
			hello.identity = new library.component.Identity( userInfo );
			if ( self.config.dev )
				self.app.setDev( null, hello.identity.alias );
			
			if ( 'API' === self.identity.level ) {
				self.runGuest();
				return;
			}
			
			self.timeNow( 'getUserAvatar' );
			self.getUserAvatar()
				.then( avaDone )
				.catch( avaErr );
			
			function avaDone() {
				self.runUser();
			}
			
			function avaErr( err ) {
				console.log( 'getUserAvatar failed??', err );
				self.runUser();
			}
		}
		
		function error( err ) {
			self.showError( err );
		}
	}
	
	ns.Hello.prototype.runUser = function( userImage ) {
		const self = this;
		self.timeNow( 'runUser - load host config' );
		self.loadHostConfig()
			.then( confBack )
			.catch( confErr );
		
		function confBack( hostConf ) {
			self.finalizeConfig( hostConf );
			self.main.setTitle( self.config.appName );
			self.initDormant();
			self.initSystemModules( connBack );
		}
		
		function confErr( err ) {
			console.log( 'confErr', err );
		}
		
		function connBack() {
			self.doLogin();
		}
	}
	
	ns.Hello.prototype.runGuest = function() {
		const self = this;
		self.timeNow( 'runGuest' );
		self.doGuestThings();
	}
	
	ns.Hello.prototype.initDormant = function() {
		const self = this;
		if ( self.config.dormantIsASecurityHoleSoLetsEnableItYOLO ) {
			console.log( '--- ENABLING DORMANT APPARENTLY ---' );
			self.dormantEnabled = true;
			
			if ( self.config.iWouldLikeOtherAppsToReadMyLogsBecausePrivacyIsOverrated )
				self.dormantAllowRead = true;
			if ( self.config.letOtherAppsSpamMyContactsWithGenuineOffersThatAreNotScams )
				self.dormantAllowWrite = true;
		}
	}
	
	ns.Hello.prototype.listenSystemEvents = function() {
		const self = this;
		self.app.on( 'pushnotification', e => self.handlePushNotie( e ));
		self.app.on( 'notification', e => self.handleNotie( e ));
		self.app.on( 'app-resume', e => self.handleAppResume( e ));
		self.app.on( 'userupdate', e => self.handleUserUpdate( e ));
		
		self.app.on( 'conn-state', e => self.handleConnState( e ));
	}
	
	ns.Hello.prototype.finalizeConfig = function( hostConf ) {
		const self = this;
		self.timeNow( 'honst config loaded' );
		library.tool.mergeObjects( self.config, hostConf );
		self.config.appName = self.config.appName || 'Friend Chat';
		console.log( 'setConfig', hello.config );
		self.app.setConfig( hello.config );
	}
	
	ns.Hello.prototype.getUserInfo = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
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
				resolve( data );
			}
			
			function modErr( err ) {
				reject( false );
			}
		});
	}
	
	ns.Hello.prototype.getUserAvatar = function( userImage ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			let current = null;
			let check = null;
			if ( userImage && userImage.length )
				current = userImage;
			
			loadCheck()
				.then( checkBack )
				.catch( reject );
			
			function checkBack( avaPart ) {
				check = avaPart || null;
				if ( current )
					checkFreshness();
				else
					loadCurrent()
						.then( currentBack )
						.catch( reject );
			}
			
			function currentBack( avatar ) {
				current = avatar || null;
				checkFreshness();
			}
			
			function checkFreshness() {
				if ( !current ) {
					self.setAvatar( false );
					api.ApplicationStorage.remove( 'avatar-check' );
					resolve();
					return;
				}
				
				const currentPart = getPart( current );
				if ( !check ) {
					api.ApplicationStorage.set( 'avatar-check', currentPart );
					self.setAvatar( current );
					resolve();
					return;
				}
				
				if ( currentPart === check ) {
					self.setAvatar( null, current );
					resolve();
				} else {
					api.ApplicationStorage.set( 'avatar-check', currentPart );
					self.setAvatar( current );
					resolve();
				}
			}
		});
		
		function loadCurrent() {
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
					
					if ( !data ) {
						resolve( null );
						return;
					}
					
					if ( !data.avatar || !data.avatar.length ) {
						resolve( null );
						return;
					}
					
					resolve( data.avatar );
				}
				
				function avaErr( err ) {
					console.log( 'avaErr', err );
					resolve( null );
				}
			});
		}
		
		function loadCheck() {
			return new Promise(( resolve, reject ) => {
				api.ApplicationStorage.get( 'avatar-check' )
					.then( checkBack )
					.catch( err => {
						console.log( 'getUserAvatar - loadCheck storage err', err );
					});
				
				function checkBack( checkObj ) {
					resolve( checkObj.data );
				}
			});
		}
		
		function getPart( avatar ) {
			if ( !avatar || !avatar.length )
				return null;
			
			const part = avatar.slice( -50 );
			return part;
		}
	}
	
	ns.Hello.prototype.loadCommonFragments = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			let commonLoaded = false;
			let mainLoaded = false;
			let liveLoaded = false;
			self.app.loadFile( 'Progdir:html/commonFragments.html', commonOmNoms );
			self.app.loadFile( 'Progdir:html/mainCommonFragments.html', moinmonOmNoms );
			self.app.loadFile( 'Progdir:html/liveCommonFragments.html', liveOmNomNoms );
			
			function commonOmNoms( fileContent ) {
				fileContent = Application.i18nReplaceInString( fileContent );
				self.app.setFragments( fileContent );
				//hello.commonFragments = fileContent;
				if ( mainLoaded && liveLoaded )
					resolve();
				else 
					commonLoaded = true;
			}
			
			function moinmonOmNoms( content ) {
				content = Application.i18nReplaceInString( content );
				hello.mainCommonFragments = content;
				if ( commonLoaded && liveLoaded )
					resolve();
				else
					mainLoaded = true;
			}
			
			function liveOmNomNoms( content ) {
				content = Application.i18nReplaceInString( content );
				hello.liveCommonFragments = content;
				if ( commonLoaded && mainLoaded )
					resolve();
				else
					liveLoaded = true;
			}
		});
	}
	
	ns.Hello.prototype.loadHostConfig = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			load( resolve, reject );
		});
		
		function load( resolve, reject ) {
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
				self.showConnStatus({
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
				let delay = 1000 * 5;
				let reconnectTime = Date.now() + delay;
				self.showConnStatus({
					type : 'wait-reconnect',
					data : {
						time : reconnectTime,
					},
				});
				
				self.loadRequestDelay = window.setTimeout( retryLoad, delay );
				function retryLoad() {
					load( resolve, reject );
				}
			}
			
			function success( response ) {
				hasLoadRes();
				if ( !response ) {
					const errMsg = Application.i18n( 'i18n_host_config_failed' ) + ' ' + url;
					self.showError( errMsg );
					reject( 'ERR_HOST_CONFIG_NO_RESPONSE' );
					return;
				}
				
				const hostConf = library.tool.objectify( response );
				if ( !hostConf ) {
					const errMsg = Application.i18n( 'i18n_host_config_failed_invalid' )
						+ ' ' + url;
					
					self.showError( errMsg );
					reject( 'ERR_HOST_CONFIG_INVALID' );
					return;
				}
				
				resolve( hostConf );
			}
			
			function loadErr( err ) {
				hasLoadRes();
				err = err || 'ERR_LOAD_HOST_CONF';
				console.log( 'loadErr', err );
				const errMsg = Application.i18n( 'i18n_host_config_failed_error' ) + ' ' + url;
				self.showError( errMsg );
				reject( err );
			}
			
			function hasLoadRes() {
				if ( !self.loadTimeout )
					return;
				
				window.clearTimeout( self.loadTimeout );
				self.loadTimeout = null;
			}
		}
	}
	
	ns.Hello.prototype.initSystemModules = function( callback ) {
		const self = this;
		self.timeNow( 'initSystemModules' );
		self.conn = new library.system.Connection( null, onWSState );
		self.items = new library.system.Items();
		self.request = new library.system.Request({ conn : self.conn });
		self.intercept = new library.system.Interceptor();
		
		if ( self.dormantEnabled )
			self.dormant = new library.system.Dormant(
				self.dormantAllowRead,
				self.dormantAllowWrite,
			);
		
		self.conn.connect( connBack );
		function connBack( err ) {
			self.timeNow( 'ws connected' );
			if( err ) {
				console.log( 'connBack - conn err', err );
				self.showConnStatus( err );
				return;
			}
			
			self.connected = true;
			callback();
		}
		
		function onWSState( e ) { self.updateConnState( e ); }
	}
	
	ns.Hello.prototype.showError = function( err ) {
		const self = this;
		const error = {
			type : 'error',
			data : err,
		};
		self.showConnStatus( error );
	}
	
	ns.Hello.prototype.showConnStatus = function( state ) {
		const self = this;
		const event = {
			type : 'conn-state',
			data : state,
		};
		self.app.toAllViews( event );
	}
	
	ns.Hello.prototype.doGuestThings = function() {
		const self = this;
		if (
			!self.config.run ||
			!self.config.run.type ||
			!self.config.run.data
		) {
			console.log( 'Hello - Guest login - invalid config', self.config.run );
			throw new Error( 'see log ^^^' );
		}
		
		const conf = self.config.run;
		if ( 'live-invite' === conf.type ) {
			console.log( 'live-invite', conf );
			const data = conf.data;
			if ( data.name && data.permissions ) {
				const opts = {
					name        : data.name,
					permissions : data.permissions,
				};
				setupUser( opts );
				return;
			}
			
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
			self.conn.connect( connBack );
			
			function connBack( err, res ) {
				if ( err ) {
					self.showConnStatus( err );
					return;
				}
				
				self.connected = true;
				callback()
			}
			
			function onWSState( e ) { self.updateConnState( e ); }
		}
	}
	
	ns.Hello.prototype.setupLiveRoom = function( permissions ) {
		const self = this;
		new library.component.GuestAccount( self.conn, permissions, onclose );
		function onclose() { self.quit(); }
		
		//self.rtc.createClient( self.config.run.data );
	}
	
	ns.Hello.prototype.doLogin = function() {
		const self = this;
		if ( self.login ) {
			self.login.close();
			self.login = null;
		}
		
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
			
			self.timeNow( 'logged in, update main' );
			self.main.setAccountLoaded( account );
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
	
	ns.Hello.prototype.openMain = function( openMinimized ) {
		const self = this;
		self.timeNow( 'openMain' );
		self.main.open( openMinimized );
	}
	
	ns.Hello.prototype.handleRunConf = function() {
		const self = this;
		const data = self.config.run;
		if ( 'live-invite' === data.type )
			return true;
		
		if ( data.events )
			return self.handleRunEvents( data.events );
		
		return false;
	}
	
	ns.Hello.prototype.handleRunEvents = function( events ) {
		const self = this;
		if ( !events || !events.length )
			return false;
		
		events.forEach( e => hello.app.handleSystem( e ));
		
		return true;
	}
	
	ns.Hello.prototype.reconnect = function() {
		const self = this;
		self.conn.reconnect();
	}
	
	ns.Hello.prototype.updateConnState = function( state ) {
		const self = this;
		const isOnline = checkIsOnline( state );
		self.updateIsOnline( isOnline );
		if (   'error' === state.type
			|| 'close' === state.type
			|| 'end' === state.type
			|| 'timeout' === state.type
		) {
			self.connected = false;
		}
		
		self.showConnStatus( state );
		
		if ( 'end' === state.type && !self.triedRelogin ) {
			if ( !self.triedRelogin )
				self.doRelogin();
			else
				self.showLoginFail();
			
			return;
		}
		
		function checkIsOnline( state ) {
			if ( 'session' !== state.type )
				return false;
			
			if ( !state.data )
				return false;
			
			return true;
		}
	}
	
	ns.Hello.prototype.showLoginFail = function() {
		const self = this;
		console.log( 'hello.showLoginFail - NYI' );
	}
	
	ns.Hello.prototype.updateIsOnline = function( isOnline ) {
		const self = this;
		if ( isOnline === self.isOnline )
			return;
		
		self.isOnline = isOnline;
		self.app.toAllViews({
			type : 'app-online',
			data : isOnline,
		});
		
		if ( self.main )
			self.main.setIsOnline( self.isOnline );
		
		if ( self.module )
			self.module.setIsOnline( self.isOnline );
		
		if ( self.isOnline ) {
			try {
				self.doResume();
			} catch( ex ) {
				console.log( 'doResume ex', ex );
			}
		}
	}
	
	// From main view
	ns.Hello.prototype.handleConnState = function( e ) {
		const self = this;
		if ( 'reconnect' === e.type )
			self.reconnect();
		
		if ( 'quit' === e.type )
			self.quit();
	}
	
	ns.Hello.prototype.preLoginDisconnect = function() {
		const self = this;
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
	
	// current is a fallback for when/if cache is inconsitent
	ns.Hello.prototype.setAvatar = function( avatar, current ) {
		const self = this;
		self.avatarStatus = avatar;
		return new Promise(( resolve, reject ) => {
			if ( false === avatar ) {
				clearCache()
					.then( done )
					.catch( reject );
				return;
			}
			
			if ( null == avatar ) {
				loadFromCache()
					.then( done )
					.catch( reject );
				return;
			}
			
			hello.identity.updateAvatar( avatar );
			api.ApplicationStorage.set( 'avatar', avatar )
				.then( setBack )
				.catch( err => {
					console.log( 'Hello.setAvatar - set err', err );
				} );
			
			function setBack( res ) {
				done();
				resolve();
			}
			
		});
		
		function done() {
			if ( null == self.avatarStatus )
				return;
			
			if ( self.module )
				self.module.updateAvatar( self.avatarStatus );
			
			if ( self.main )
				self.main.updateAvatar();
		}
		
		function clearCache() {
			return new Promise(( resolve, reject ) => {
				hello.identity.updateAvatar( null );
				api.ApplicationStorage.set( 'avatar', null )
					.then( clearBack )
					.catch( err => {
						console.log( 'Hello.setAvatar - clearCache err', err );
					});
				
				function clearBack( res ) {
					resolve();
				}
			});
		}
		
		function loadFromCache() {
			return new Promise(( resolve, reject ) => {
				api.ApplicationStorage.get( 'avatar' )
					.then( loadBack )
					.catch( err => {
						console.log( 'Hello.setAvatar - loadFromCache err', err );
					});
				
				function loadBack( res ) {
					if ( !res.data ) {
						api.ApplicationStorage.set( 'avatar', current );
						self.avatarStatus = current;
						res.data = current;
					}
					
					hello.identity.updateAvatar( res.data );
					resolve();
				}
			});
		}
	}
	
	ns.Hello.prototype.setSettings = function( settings ) {
		const self = this;
		self.app.setSettings( settings );
		api.ApplicationStorage.set( 'account-settings', settings );
	}
	
	// TODO : reopen views
	ns.Hello.prototype.show = function() {
		const self = this;
		console.log( 'Hello.show() - NYI' );
	}
	
	// TODO : close views while staying logged in
	ns.Hello.prototype.hide = function() {
		const self = this;
		console.log( 'Hello.hide() - NYI' );
	}
	
	ns.Hello.prototype.setAuthBundle = function( bundle ) {
		const self = this;
		self.authBundle = bundle;
	}
	
	ns.Hello.prototype.logout = function() {
		const self = this;
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
		const self = this;
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
		const self = this;
		if ( !self.main && !self.login && !self.log.view && !self.loggedIn )
			self.quit();
	}
	
	ns.Hello.prototype.quit = function() {
		const self = this;
		if ( self.conn )
			self.conn.close();
		
		self.app.quit();
	}
	
	ns.Hello.prototype.about = function() {
		const self = this;
		if ( self.aboutView )
			return;
		
		self.aboutView = new library.view.About( self.config.about, onclose );
		function onclose() { delete self.aboutView; }
	}
	
	ns.Hello.prototype.playMsgAlert = function() {
		const self = this;
		if ( !self.msgAlert )
			return;
		
		self.msgAlert.play();
	}
	
	ns.Hello.prototype.receiveMessage = function( msg ) {
		const self = this;
		console.log( 'Hello.receiveMessage - NOOP', msg );
	}
	
	ns.Hello.prototype.handlePushNotie = function( event, view ) {
		const self = this;
		if ( !self.loaded ) {
			self.registerOnLoaded( onLoaded );
			return;
			
			function onLoaded() {
				self.handlePushNotie( event );
			}
		}
		
		if ( !event || !event.extra ) {
			console.log( 'hello.handlePushNotie - not valid event', event );
			return false;
		}
		
		const extra = friendUP.tool.parse( event.extra );
		if ( !extra ) {
			console.log( 'hello.handlePushNotie - invalid data', {
				event : event,
				extra : extra,
			});
			return;
		}
		
		if ( !event.clicked ) {
			console.log( 'hello.handlePushNotie - not clicked, discarding', event );
			return false;
		}
		
		if ( !self.service && !view ) {
			self.fakeView = true;
			const roomName = event.title;
			extra.isPrivate = true;
			view = new library.view.PresenceChat( null, roomName, !!extra.isPrivate );
		}
		
		if ( null != self.resumeTimeout || !self.isOnline ) {
			self.registerOnResume( onResume );
			return;
			
			function onResume() {
				self.handlePushNotie( event, view );
			}
		}
		
		if ( self.service )
			self.service.handleNotification( extra, view );
		else
			self.pushies.push({
				extra : extra,
				view  : view,
			});
	}
	
	ns.Hello.prototype.handleNotie = function( event ) {
		const self = this;
		console.trace( 'handleNotie', event );
		if ( !event || !event.extra ) {
			console.log( 'hello.handleNotie - invalid event', event );
			return false;
		}
		
		if ( !event.clicked )
			return false;
		
		if ( null != self.resumeTimeout || !self.isOnline ) {
			self.registerOnResume( onResume );
			return;
			
			function onResume() {
				self.handleNotie( event );
			}
		}
		
		let extra = friendUP.tool.parse( event.extra );
		if ( !extra ) {
			console.log( 'hello.handleNotie - invalid extra', event );
			return;
		}
		
		if ( self.service )
			self.service.handleNotification( extra );
		else
			self.pushies.push({
				extra : extra,
			});
	}
	
	ns.Hello.prototype.handleAppResume = function( event ) {
		const self = this;
		if ( !self.isOnline ) {
			console.log( 'hello.handleAppResume - already reconnecting' );
			return;
		}
		
		if ( null != self.resumeTimeout )
			window.clearTimeout( self.resumeTimeout );
		
		self.resumeTimeout = window.setTimeout( resume, 1000 );
		self.reconnect();
		
		self.showConnStatus({
			type : 'resume',
			data : Date.now(),
		});
		
		function resume() {
			self.resumeTimeout = null;
			self.doResume();
		}
	}
	
	ns.Hello.prototype.registerOnLoaded = function( fn ) {
		const self = this;
		self.loadedCallbacks.push( fn );
	}
	
	ns.Hello.prototype.doLoaded = function() {
		const self = this;
		self.loaded = true;
		self.loadedCallbacks.forEach( fn => fn());
		self.loadedCallbacks = null;
	}
	
	ns.Hello.prototype.registerOnResume = function( fn ) {
		const self = this;
		self.resumeCallbacks.push( fn );
	}
	
	ns.Hello.prototype.doResume = function() {
		const self = this;
		if ( !self.isOnline || ( null != self.resumeTimeout ))
			return;
		
		self.resumeCallbacks.forEach( fn => fn());
		self.resumeCallbacks = [];
	}
	
	ns.Hello.prototype.handleUserUpdate = function( event ) {
		const self = this;
		self.getUserInfo()
			.then( infoBack )
			.catch( fail );
			
		function infoBack( userInfo ) {
			self.getUserAvatar();
		}
			
		function fail( err ) {
			console.log( 'handleUserUpdate - something went bonk', err );
		}
	}
	
})( window );


// MAIN
(function( ns, undefined ) {
	ns.Main = function() {
		const self = this;
		self.parentView = window.View;
		self.viewReady = false;
		self.advancedUI = false;
		self.isLogout = false;
		self.title = null;
		
		self.init();
	}
	
	// Public
	
	ns.Main.prototype.focus = function() {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.activate();
	}
	
	ns.Main.prototype.open = function( openMinimized ) {
		const self = this;
		if ( null == self.openMinimized )
			self.openMinimized = openMinimized || false;
		
		if ( 'init-done' != self.state )
			return;
		
		const initConf = {
			mainFragments : hello.mainCommonFragments,
			identity      : hello.identity,
			recentHistory : self.recentHistory,
		};
		
		/*if ( self.advancedUI )
			self.openAdvView( initConf, viewClose );
		else
			self.openSimpleView( initConf, viewClose );
		*/
		self.openSimpleView( initConf, viewClose );
		self.view.on( 'ready', ready );
		
		self.bindView();
		self.setMenuItems();
		
		function ready( msg ) {
			hello.timeNow( 'main open' );
			if ( self.title )
				self.setTitle();
			
			if ( !self.account )
				return;
			
			self.initView();
		}
		
		function viewClose( msg ) {
			self.view = null;
			if ( self.isLogout )
				return;
			
			self.quit();
		}
	}
	
	ns.Main.prototype.setAccountLoaded = function( acc ) {
		const self = this;
		self.account = acc;
		if ( !self.view )
			return;
		
		self.initView();
	}
	
	ns.Main.prototype.setIsOnline = function( isOnline ) {
		const self = this;
		/*
		self.view.send({
			type : 'app-online',
			data : isOnline,
		});
		*/
	}
	
	ns.Main.prototype.setTitle = function( title ) {
		const self = this;
		if ( null != title )
			self.title = title;
		
		if ( !self.view || !self.title )
			return;
		
		self.view.setTitle( self.title );
	}
	
	ns.Main.prototype.updateIdentity = function() {
		const self = this;
		const id = hello.identity;
		const update = {
			type : 'identity',
			data : id,
		};
		self.view.send( update );
	}
	
	ns.Main.prototype.updateAvatar = function() {
		const self = this;
		const avatar = hello.identity.avatar;
		const update = {
			type : 'avatar',
			data : {
				avatar : avatar,
			},
		};
		self.view.send( update );
	}
	
	// Private
	
	ns.Main.prototype.init = function() {
		const self = this;
		api.ApplicationStorage.get( 'account-settings' )
			.then( settingsCacheBack )
			.catch( err => {
				console.log( 'app.Main.init - account setting load err', err );
			});
		
		function settingsCacheBack( cache ) {
			const accSettings = cache.data;
			if ( !accSettings ) {
				self.recentHistory = {};
				self.accSettings = {
					advancedUI : false,
				};
				doSetup();
			} else {
				self.accSettings = accSettings;
				loadRecentHistory();
			}
		}
		
		function loadRecentHistory() {
			api.ApplicationStorage.get( 'recent-history' )
				.then( recentBack )
				.catch( e => {
					console.log( 'app.Main.init - loadRecentHistory get err', e );
				});
			
			function recentBack( res ) {
				 self.recentHistory = res.data || {};
				//self.recentHistory = {};
				doSetup();
			}
		}
		
		function doSetup() {
			self.advancedUI = self.accSettings.advancedUI;
			self.state = 'init-done';
			if ( null != self.openMinimized )
				self.open();
			
			/*
			if ( !!self.accSettings.onNewScreen )
				Application.screen = new api.Screen( 'Friend Chat' );
			*/
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
			title     : hello.config.appName || 'Friend Chat',
			width     : 440,
			height    : 600,
			//mainView  : true,
			minimized : self.openMinimized || undefined,
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
			title     : hello.config.appName,
			width     : 440,
			height    : 600,
			minimized : self.openMinimized || undefined,
		};
		
		self.view = hello.app.createView(
			'html/main.html',
			winConf,
			initConf,
			null,
			onClose
		);
	}
	
	ns.Main.prototype.initView = function() {
		const self = this;
		self.updateViewSettings();
		self.updateIdentity();
		self.initSubViews();
		hello.account.sendReady( null );
	}
	
	ns.Main.prototype.bindView = function() {
		const self = this;
		self.view.receiveMessage = receiveMessage;
		self.view.on( 'about', showAbout );
		self.view.on( 'live', startLive );
		self.view.on( 'quit', doQuit );
		self.view.on( 'logout', logout );
		//self.view.on( 'conn-state', connState );
		self.view.on( 'recent-save', recentSave );
		self.view.on( 'recent-remove', recentRemove );
		
		function receiveMessage( e ) { self.receiveMessage( e ); }
		function startLive( e ) { self.startLive(); }
		function showAbout( e ) { hello.about(); }
		function doQuit( e ) { hello.quit(); }
		function logout( e ) { hello.logout( e ); }
		//function connState( e ) { hello.handleConnState( e ); }
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
		const settings = {
			name    : Application.i18n('i18n_account_settings'),
			command : 'account_account',
		};
		const about = {
			name    : Application.i18n('i18n_about'),
			command : 'file_about',
		};
		const quit = {
			name    : Application.i18n('i18n_quit'),
			command : 'file_quit',
		};
		
		let fileItems = [];
		if ( !hello.config.hideLive )
			fileItems.push( startLive );
		
		if ( self.advancedUI )
			fileItems.push( addChat );
		
		fileItems.push( settings );
		fileItems.push( about );
		
		//checkMobileBrowser();
		// mobile menu has quit by default
		if( 'DESKTOP' === window.Application.deviceType )
			fileItems.push( quit );
		
		const file = {
			name : Application.i18n( 'i18n_file' ),
			items : fileItems,
		};
		
		// ACCOUNTs
		/* not enough stuff here to use it currently
		const accItems = [
			settings,
		];
		const account = {
			name : Application.i18n('i18n_account_menu'),
			items : accItems,
		};
		*/
		
		/*
		// TOOL - advandced things, keep for ~~~~later
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
		const menuItems = [];
		menuItems.push( file );
		self.view.setMenuItems( menuItems );
		
		hello.app.on( 'file_about' , fileAbout );
		hello.app.on( 'file_quit'  , fileQuit );
		
		hello.app.on( 'account_account' , accountSettings );
		
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
		const self = this;
		hello.rtc.createRoom( null, null );
	}
	
	ns.Main.prototype.handleRecentSave = function( item ) {
		const self = this;
		const mId = item.moduleId;
		const cId = item.clientId;
		const recent = self.recentHistory;
		recent[ mId ] = recent[ mId ] || {};
		recent[ mId ][ cId ] = item.lastEvent || null;
		api.ApplicationStorage.set( 'recent-history', recent )
			.then( saveBack )
			.catch( saveBack );
		
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
		api.ApplicationStorage.set( 'recent-history', recent )
			.then( saveBack )
			.catch( saveBack );
			
		function saveBack( res ) {
		}
	}
	
	ns.Main.prototype.updateViewSettings = function() {
		const self = this;
		const setts = self.account.settings;
		const update = {
			type : 'settings',
			data : setts,
		}
		self.view.send( update );
	}
	
	ns.Main.prototype.initSubViews = function() {
		const self = this;
		if ( self.notification ) {
			console.log( 'initSubViews - already initialized' );
			return;
		}
		
		const account = self.account;
		self.searchListenId = hello.items.startListen( self.view );
		self.notification = new library.system.Notification({
			parentView : self.view,
		});
		
		hello.account = new library.system.Account({
			parentView : self.view,
			account    : account,
		});
		
		hello.module = new library.system.ModuleControl({
			parentView : self.view,
		});
		
		hello.rtc = new library.system.RtcControl( self.view );
	}
	
	ns.Main.prototype.closeThings = function() {
		const self = this;
		
		if ( hello.module ) {
			hello.module.close();
			hello.module = null;
		}
		if ( hello.account ) {
			hello.account.close();
			hello.account = null;
		}
		
		if ( hello.rtc ) {
			hello.rtc.close();
			hello.rtc = null;
		}
		
		if ( self.view ) {
			self.view.close();
			self.view = null;
		}
		
		if ( self.searchListenId ) {
			hello.items.stopListen( self.searchListenId );
			self.searchListenId = null;
		}
		
		hello.app.close();
	}
	
	ns.Main.prototype.close = function() {
		const self = this;
		self.logout();
	}
	
	ns.Main.prototype.logout = function() {
		const self = this;
		self.isLogout = true;
		self.closeThings();
	}
	
	ns.Main.prototype.quit = function() {
		const self = this;
		self.closeThings();
		hello.quit();
	}
	
	ns.Main.prototype.receiveMessage = function( msg ) {
		const self = this;
		console.log( 'main.receiveMessage - unhandled view message', msg );
	}
	
})( library.system );

hello = new window.Hello( window.Application, window.localconfig );

// Mobile check from the Friend API --------------------------------------------

/*
function checkMobile()
{
	var check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
}

function checkTablet() 
{
	var check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
}

// Are we on a mobile browser?
function checkMobileBrowser()
{
	if( !document.body ) return setTimeout( checkMobileBrowser, 50 );
	window.isMobile = checkMobile();
	window.isTablet = checkTablet();
	if( window.isMobile ) window.isTablet = false;
	if( !window.isMobile && !window.isTablet )
	{
		if( window.isTouch || !document.getElementsByTagName( 'head' )[0].getAttribute( 'touchdesktop' ) )
		{
			window.isMobile = ( window.Workspace && window.innerWidth <= 760 ) && (
				navigator.userAgent.toLowerCase().indexOf( 'android' ) > 0 ||
				navigator.userAgent.toLowerCase().indexOf( 'phone' ) > 0 ||
				navigator.userAgent.toLowerCase().indexOf( 'pad' ) > 0 ||
				navigator.userAgent.toLowerCase().indexOf( 'bowser' ) > 0 );
			
			if( ( window.isMobile || navigator.userAgent.indexOf( 'Mobile' ) > 0 ) && window.innerWidth >= 1024 )
			{
				window.isTablet = true;
				window.isMobile = false;
			}
		}
	}
	// Ipads are always mobiles
	if( navigator.userAgent.toLowerCase().indexOf( 'ipad' ) > 0 )
	{
		//console.log( 'IPAD! ' + navigator.userAgent );
		window.isMobile = true;
	}
	
	window.isTouch = !!('ontouchstart' in window);
	if( window.isMobile )
	{
		document.body.setAttribute( 'mobile', 'mobile' );
	}
	else if( window.isTablet )
	{
		document.body.setAttribute( 'tablet', 'tablet' );
	}
	else
	{
		document.body.removeAttribute( 'tablet' );
	}
	if( navigator.userAgent.toLowerCase().indexOf( 'playstation' ) > 0 )
	{
		document.body.setAttribute( 'settopbox', 'playstation' );
		window.isSettopBox = 'playstation';
		if (typeof console  != "undefined") 
			if (typeof console.log != 'undefined')
				console.olog = console.log;
			else
				console.olog = function() {};
		console.log = function(message) {
			console.olog(message);
			Notify( { title: 'Playstation error', text: message } );
		};
		console.error = console.debug = console.info =  console.log
	}
	return window.isMobile;
}

*/
