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

var friendUP = window.friendUP || {};
var api = window.api || {}; // use stuff on this object
var fupLocal = {}; // internals
var friend = window.friend || {}; // already instanced stuff

// add friendUP api
/*
(function() {
	const scripts = [
		'utils/tool.js',
		'io/request.js',
	];
	
	const path = '/webclient/js/';
	const pathArr = scripts.map( setPath );
	const scriptPath = pathArr.join( ';' );
	const script = document.createElement( 'script' );
	script.type = 'text/javascript';
	script.src = scriptPath;
	script.onload = function( event ) {
		if ( window.Application )
			window.Application.setExternalsLoaded();
	}
	document.head.appendChild( script );
	
	function setPath( script ) { return path + script; }
})();
*/

// View
// an interface for views, new it
(function( ns, undefined ) {
	ns.View = function(
		htmlPath,
		windowConf,
		initData,
		eventsink,
		onclose
	) {
		const self = this;
		EventEmitter.call( self, eventsink );
		
		self.path = htmlPath;
		self.windowConf = windowConf || {};
		self.initData = initData;
		self.onclose = onclose;
		self.id = self.windowConf.id || friendUP.tool.uid( 'view' );
		self.eventQueue = [];
		self.app = window.Application;
		
		self.viewName = self.id;
		
		self.initView();
	}
	
	ns.View.prototype = Object.create( EventEmitter.prototype );
	
	// Public
	
	ns.View.prototype.setMenuItems = function( data ) {
		const self = this;
		const msg = {
			method : 'setMenuItems',
			data : data,
		};
		self._send( msg );
	}
	
	ns.View.prototype.setTitle = function( title ) {
		const self = this;
		self.title = title;
		self.setFlag( 'title', title );
	}
	
	ns.View.prototype.setFlag = function( flag, value ) {
		const self = this;
		const msg = {
			method : 'setFlag',
			data   : {
				flag  : flag,
				value : value,
			},
		};
		self._send( msg );
	}
	
	ns.View.prototype.getFlag = function( flag, callback ) {
		const self = this;
		const cid = self.app.setCallback( callback );
		const msg = {
			method   : 'getFlag',
			callback : cid,
			data     : {
				flag : flag,
			},
		};
		self._send( msg );
	}
	
	ns.View.prototype.setViewTheme = function( filepath ) {
		const self = this;
		var msg = {
			type : 'set',
			data : filepath,
		};
		self.sendViewTheme( msg );
	}
	
	ns.View.prototype.removeViewTheme = function() {
		const self = this;
		var msg = {
			type : 'remove',
		};
		self.sendViewTheme( msg );
	}
	
	ns.View.prototype.sendViewTheme = function( msg ) {
		const self = this;
		var wrap = {
			command : 'viewtheme',
			data : msg,
		};
		self.sendMessage( wrap, true );
	}
	
	ns.View.prototype.activate = function() {
		const self = this;
		const activate = {
			method : 'activate',
		};
		self._send( activate );
	}
	
	ns.View.prototype.showFiledialog = function( conf, callback ) {
		/* conf:
		dialogType, ( 'open' default )
		path,
		filename,
		title,
		*/
		const self = this;
		if ( !conf || !callback ) {
			console.log( 'showFileDialog - missing conf and / or callback' );
			return;
		}
		
		const cid = self.app.setCallback( callback );
		const filedialog = {
			type       : 'system',
			command    : 'filedialog',
			method     : 'open',
			dialogType : conf.dialogType || 'open',
			path       : conf.path,
			filename   : conf.filename,
			title      : conf.title,
			viewId     : self.id,
			callbackId : cid,
		};
		
		self.app.sendMessage( filedialog );
	}
	
	// Private
	
	ns.View.prototype.initView = function() {
		const self = this;
		if ( self.path ) {
			const filename = self.path
				.split( '/' )
				.slice( -1 )[ 0 ];
			
			self.viewName = filename.split( '.' )[ 0 ];
		}
		
		const windowConf = self.windowConf;
		const callbackId = self.app.setCallback( viewCreate )
		if ( self.app.screen )
			windowConf.screen = self.app.screen.id;
		
		const viewConf = windowConf.viewConf || {};
		windowConf.viewConf = viewConf;
		viewConf.deviceType = self.app.deviceType;
		
		if ( self.app.fragments )
			viewConf.fragments = self.app.fragments;
		
		if ( self.app.translations )
			viewConf.translations = self.app.translations;
		
		if ( null != self.app.isDev )
			viewConf.isDev = self.app.isDev;
		
		if ( null != self.app.appConf )
			viewConf.appConf = self.app.appConf;
		
		if ( null != self.app.appSettings )
			viewConf.appSettings = self.app.appSettings;
		
		self.fromView = new library.component.EventNode( self.id, self.app );
		self.fromView.on( 'app', e => self.toApp( e ));
		self.fromView.on( 'log-sock', e => self.toLogSock( e ));
		self.fromView.on( 'conn-state', e => self.toConnState( e ));
		self.fromView.on( 'loaded', loaded );
		self.fromView.on( 'ready', ready );
		self.fromView.on( 'minimized', mini );
		self.fromView.on( 'show-notify', e => self.handleNotification( e ));
		//self.app.on( self.id, viewEvent );
		self.app.sendMessage({
			type   : 'view',
			viewId : self.id,
			id     : callbackId,
			data   : windowConf,
		});
		
		function viewCreate( msg ) {
			if ( msg.data.toUpperCase() !== 'OK' ) {
				console.log( 'app.View.viewCreate - window setup failed', msg );
				self.handleEvent({
					type : 'ERR_VIEW_SETUP',
					data : msg,
				});
				self.app.removeView( self.id );
				return;
			}
			
			self.app.addView( self );
			
			if ( self.path ) {
				self.setContentUrl( self.path );
				return;
			}
			
			// neidaså
			console.log( 'view.init.viewCreate - no filepath or content!?', conf );
		}
		
		function loaded( e ) { self.handleLoaded( e ); }
		function ready( e ) { self.handleReady( e ); }
		function mini( e ) { self.handleMinimized( e ); }
	}
	
	ns.View.prototype.toApp = function( event ) {
		const self = this;
		self.emit( event.type, event.data );
	}
	
	ns.View.prototype.toLogSock = function( args ) {
		const self = this;
		self.app.handleViewLog( args, self.viewName );
	}
	
	ns.View.prototype.toConnState = function( event ) {
		const self = this;
		self.app.handleConnState( event );
	}
	
	ns.View.prototype.setContentUrl = function( htmlPath ) {
		const self = this;
		const msg = {
			method   : 'setRichContentUrl',
			url      : self.app.filePath + htmlPath,
			base     : self.app.filePath,
			filePath : self.app.filePath,
			opts     : {},
		};
		
		if ( self.windowConf.viewTheme )
			msg.opts.viewTheme = self.windowConf.viewTheme;
		
		self._send( msg );
	}
	
	ns.View.prototype.handleLoaded = function( e ) {
		const self = this;
		//self.loaded = true;
		if ( self.initData )
			self.sendMessage({
				type : 'initialize',
				data : self.initData,
			}, true );
		
		if ( self.onload ) {
			self.onload( e || true );
		}
		
		self.emit( 'loaded', e );
	}
	
	ns.View.prototype.handleReady = function( e ) {
		const self = this;
		console.log( 'app.View.handleReady', e );
		self.ready = true;
		self.sendEventQueue();
		if ( self.onready ) {
			self.onready( e || true );
			return;
		}
		
		self.emit( 'ready', e );
	}
	
	ns.View.prototype.handleMinimized = function( isMinimized ) {
		const self = this;
		self.isMinimized = isMinimized;
	}
	
	ns.View.prototype.handleNotification = function( notie ) {
		const self = this;
		self.app.notify( notie );
	}
	
	ns.View.prototype.doClose = function() {
		const self = this;
		self.ready = false;
		var onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose( true );
		
		self.close();
	}
	
	ns.View.prototype.close = function() {
		const self = this;
		if ( !self.app )
			return;
		
		self.app.removeView( self.id );
		var msg = {
			method : 'close',
		};
		self._send( msg );
		
		self.closeEventEmitter();
		delete self.onclose;
		delete self.app;
		delete self.eventQueue;
	}
	
	ns.View.prototype.queueEvent = function( event ) {
		const self = this;
		console.log( 'app.View.queueEvent', event );
		if ( !self.eventQueue )
			self.eventQueue = [];
		
		self.eventQueue.push( event );
	}
	
	ns.View.prototype.sendEventQueue = function() {
		const self = this;
		console.log( 'app.View.sendEventQueue', self.eventQueue );
		self.eventQueue.forEach( send );
		self.eventQueue = [];
		function send( event ) {
			self.sendMessage( event );
		}
	}
	
	ns.View.prototype.sendMessage = function( event, force ) {
		const self = this;
		if ( !self.ready && !force ) {
			self.queueEvent( event );
			return;
		}
		
		const wrap = {
			method : 'sendMessage',
			data   : event
		};
		
		self._send( wrap );
	}
	
	ns.View.prototype.send = ns.View.prototype.sendMessage;
	
	ns.View.prototype._send = function( msg ) {
		const self = this;
		msg.type = 'view';
		msg.viewId = self.id;
		
		if ( !self.app )
			return;
		
		self.app.sendMessage( msg );
	}
	
})( api );

// SCREEN
(function( ns, undefined ) {
	ns.Screen = function( title ) {
		if ( !( this instanceof ns.Screen ))
			return new ns.Screen( title );
		
		const self = this;
		self.title = title;
		
		self.app = window.Application;
		
		self.init();
	}
	
	// Public
	
	// Private
	
	ns.Screen.prototype.init = function() {
		const self = this;
		if ( self.app.screenId )
			throw new Error( 'Application already has a screen' );
		
		self.id = friendUP.tool.uid( 'view' );
		var msg = {
			data : {
				title : self.title,
			},
		};
		self.send( msg );
	}
	
	ns.Screen.prototype.send = function( msg ) {
		const self = this;
		msg.type = 'screen';
		msg.screenId = self.id;
		self.app.sendMessage( msg );
	}
})( api );


// Filedialogs
(function( ns, undefined ) {
	ns.Filedialog = function( title ) {
		const self = this;
		self.title = title || 'File';
		self.app = window.Application;
		this.init();
	}
	
	// resolves to a list of files selected by user
	ns.Filedialog.prototype.open = function( path, title ) {
		const self = this;
		return self.send( 'load', path, null, title );
	}
	
	ns.Filedialog.prototype.load = function( path, filename ) {
		const self = this;
	}
	
	ns.Filedialog.prototype.init = function() {
		const self = this;
		return;
		
		
		var targetview = false;
		var triggerFunction = false;
		var type = false;
		var filename = '';
		
		// We have flags
		for( var a in object )
		{
			switch( a )
			{
				case 'triggerFunction':
					triggerFunction = object[a];
					break;
				case 'path':
					path = object[a];
					break;
				case 'type':
					type = object[a];
					break;
				case 'filename':
					filename = object[a];
					break;
				case 'title':
					title = object[a];
					break;
			}
		}
		
		if ( !triggerFunction )
			return;
		
		if ( !type )
			type = 'open';
		
		var callbackId = self.app.setCallback( triggerFunction );
	}
	
	ns.Filedialog.prototype.send = function( type, path, file ) {
		const self = this;
		const cb = self.app.setPromiseCallback();
		self.app.sendMessage({
			type:        'system',
			command:     'filedialog',
			method:      'open',
			callbackId:   cb.id,
			dialogType:   type,
			path:         path,
			filename:     file || '',
			title:        self.title,
		});
		
		return cb.promise;
	}
	
})( api );


// MODULE
(function( ns, undefined ) {
	ns.Module = function( conf )
	{
		const self = this;
		self.success = conf.success;
		self.error = conf.error;
		
		self.id = friendUP.tool.uid;
		self.app = window.Application;
		
		self.init( conf );
	}
	
	ns.Module.prototype.init = function( conf )
	{
		const self = this;
		var callbackId = self.app.setCallback( result );
		var msg = {
			module : conf.module || 'system',
			method : conf.method,
			args : conf.args,
			vars : conf.vars,
			fileId : callbackId,
		};
		self.send( msg );
		
		function result( data ) {
			if ( !data )
				self.error();
			else
				self.success( data );
		}
	}
	
	ns.Module.prototype.send = function( msg ) {
		const self = this;
		msg.type = 'module';
		self.app.sendMessage( msg );
	}
})( api );


// LIBRARY
(function( ns, undefined ) {
	ns.Library = function( conf ) {
		if ( !( this instanceof ns.Library ))
			return new ns.Library( conf );
		
		const self = this;
		self.name = conf.name || 'system.library';
		self.func = conf.functionName;
		self.args = conf.args || {};
		self.onsuccess= conf.onsuccess;
		self.onerror = conf.onerror;
		
		self.app = window.Application;
		self.init();
	}
	
	ns.Library.prototype.init = function() {
		const self = this;
		if ( !self.app ) {
			console.log( 'window.Application not found', self.app );
			throw new Error( 'window.Application not found' );
		}
		
		var cid = self.app.setCallback( result );
		var msg = {
			library : self.name,
			func : self.func,
			args : self.args,
			callbackId : cid,
		};
		self.send( msg );
		
		function result( res ) {
			self.handleResponse( res );
		}
	}
	
	ns.Library.prototype.handleResponse = function( res ) {
		const self = this;
		var success = res.ok;
		if ( success )
			self.onsuccess( res.data );
		else
			self.onerror( res.error );
	}
	
	ns.Library.prototype.send = function( msg ) {
		const self = this;
		msg.type = 'system';
		msg.command = 'librarycall';
		self.app.sendMessage( msg );
	}
})( api );


// AppEvent
// part of Application, handles messages from the desktop environment
(function( ns, undefined ) {
	ns.AppEvent = function() {
		if ( !( this instanceof ns.AppEvent ))
			return new ns.AppEvent( app );
		
		const self = this;
		EventEmitter.call( self, unhandledEvent );
		self.subscriber = {};
		self.commandMap = null;
		
		self.externalsLoaded = true;
		self.preloadEvents = [];
		
		self.initAppEvent();
		
		function unhandledEvent( type, data ) {
			self.receiveMessage( data );
		}
	}
	
	ns.AppEvent.prototype = Object.create( EventEmitter.prototype );
	
	// Public
	
	ns.AppEvent.prototype.setExternalsLoaded = function() {
		const self = this;
		self.externalsLoaded = true;
		if ( !self.preloadEvents.length )
			return;
		
		self.preloadEvents.forEach( e => {
			self.receiveEvent( e );
		});
		
		self.preloadEvents = [];
	}
	
	// Private
	
	ns.AppEvent.prototype.initAppEvent = function() {
		const self = this;
		self.commandMap = {
			'door'               : door,
			'filedialog'         : filedialog,
			'fileload'           : fileload,
			'initappframe'       : initialize,
			'notify'             : notify,
			'register'           : register,
			'viewresponse'       : viewResponse,
			'dormantmaster'      : dormantMaster,
			'applicationstorage' : storage,
			'libraryresponse'    : libResponse,
			'refreshtheme'       : refreshTheme,
			'notification'       : notification,
			'quit'               : quit,
		};
		
		function door( e ) { self.receiveMessage( e ); }
		function filedialog( e ) { self.handleFiledialog( e ); }
		function fileload( e ) { self.fileLoad( e ); }
		function initialize( e ) { self.initialize( e ); }
		function notify( e ) { self.handleNotify( e ); }
		function register( e ) { self.register( e ); }
		function viewResponse( e ) { self.viewResponse( e ); }
		function dormantMaster( e ) { self.dormantMaster( e ); }
		function storage( e ) { self.storage( e ); }
		function libResponse( e ) { self.handleLibResponse( e ); }
		function refreshTheme( e ) { self.handleRefreshTheme( e ); }
		function notification( e ) { self.handleCmdNotify( e ); }
		function quit( e ) { self.quit(); }
		
		self.notifyMap = {
			'closeview'   : closeView,
			'setviewflag' : setViewFlag,
			'wakeup'      : appWakeup,
		};
		
		function closeView( e ) { self.closeView( e ); }
		function setViewFlag( e ) { self.setViewFlag( e ); }
		function appWakeup( e ) { self.appWakeup( e ); }
		
		window.addEventListener( 'message', receiveEvent, false );
		function receiveEvent( e ) { self.receiveEvent( e ); }
	}
	
	ns.AppEvent.prototype.receiveEvent = function( e ) {
		const self = this;
		if ( !friendUP || !friendUP.tool || !friendUP.tool.parse ) {
			console.log( 'AppEvent.receiveEvent - parser not loaded yet', e );
			self.preloadEvents.push( e );
			throw new Error( 'AppEvent.receiveEvent - parser not loaded yet' );
		}
		
		const msg = friendUP.tool.parse( e.data );
		if ( !msg ) {
			console.log( 'app.receiveEvent - no msg for event', e );
			return;
		}
		
		msg.origin = e.origin;
		const handler = self.commandMap[ msg.command ];
		if ( handler ) {
			handler( msg );
			return;
		}
		
		if ( 'system' === msg.type ) {
			self.handleSystem( msg );
			return;
		}
		
		/*
		if ( 'notify' === msg.type ) {
			self.handleNotify( msg );
			return;
		}
		*/
		
		if ( msg.callback || msg.clickcallback ) {
			var yep = self.handleCallback( msg );
			if ( yep )
				return;
		}
		
		if ( msg.viewId ) {
			self.handleFromView( msg );
			return;
		}
		
		self.appMessage( msg );
	}
	
	ns.AppEvent.prototype.handleCallback = function( msg ) {
		const self = this;
		const cid = msg.callback || msg.clickcallback;
		const callback = self.getCallback( cid );
		if ( !callback )
			return false;
		
		callback( msg );
		return true;
	}
	
	ns.AppEvent.prototype.handleFromView = function( msg ) {
		const self = this;
		const type = msg.viewId;
		if ( !type || !msg.data ) {
			console.log( 'weird event', msg );
			return;
		}
		
		self.emit( type, msg.data );
	}
	
	ns.AppEvent.prototype.appMessage = function( msg ) {
		const self = this;
		const type = msg.command || msg.callback;
		self.emit( type, msg.data );
	}
	
	ns.AppEvent.prototype.handleSystem = function( msg ) {
		const self = this;
		const cbId = msg.callback;
		const future = self.emit( msg.method, msg.data );
		if ( !cbId )
			return;
		
		if ( !future ) {
			self.returnCallback( null, null, cbId );
			return;
		}
		
		future
			.then( resBack )
			.catch( errBack );
		
		function resBack( res ) {
			self.returnCallback( null, res, cbId );
		}
		
		function errBack( err ) {
			self.returnCallback( err, null, cbId );
		}
	}
	
	ns.AppEvent.prototype.handleFiledialog = function( msg ) {
		const self = this;
		var callback = self.getCallback( msg.callbackId );
		if ( !callback ) {
			console.log( 'handleFileDialog - no callback found for', msg );
			return;
		}
		
		callback( msg.data );
	}
	
	ns.AppEvent.prototype.fileLoad = function( msg ) {
		const self = this;
		var handler = self.getCallback( msg.fileId );
		
		if ( !handler ) {
			console.log( 'appEvent.fileLoad - no handler for event, passing to receiveMessage ', msg );
			self.receiveMessage( msg );
			return;
		}
		
		handler( msg.data );
		return;
		// file loads dont get returnCode...
		/*
		if ( !msg.returnCode || !msg.returnCode.toUpperCase ) {
			handler( null );
			return;
		}
		
		if ( 'OK' === msg.returnCode.toUpperCase())
			handler( msg.data );
		else
			handler( null );
		*/
	}
	
	ns.AppEvent.prototype.viewResponse = function( msg ) {
		const self = this;
		var handler = self.getCallback( msg.viewId );
		
		if ( !handler ) {
			console.log( 'appEvent.viewResponse - no handler for event, passing to receiveMessage', msg );
			self.receiveMessage( msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.AppEvent.prototype.dormantMaster = function( msg ) {
		const self = this;
		if ( !friend.Dormant ) {
			console.log( 'app.dormantmaster - window.Dormant not defined' );
			return;
		}
		
		friend.Dormant.handleMessage( msg );
	}
	
	ns.AppEvent.prototype.storage = function( msg ) {
		const self = this;
		var callback = self.getCallback( msg.callbackId );
		if ( !callback ) {
			console.log( 'storage - no callback found for', msg );
			return;
		}
		
		callback( msg.data );
	}
	
	ns.AppEvent.prototype.handleLibResponse = function( msg ) {
		const self = this;
		var callback = self.getCallback( msg.callbackId );
		if ( !callback ) {
			console.log( 'libraryresponse - no callback for', msg );
		}
		
		const ok = msg.returnCode.toLowerCase() == 'ok' ? true : false;
		const error = ok ? null : msg.returnCode;
		
		const res = {
			ok    : ok,
			error : error,
			data  : friendUP.tool.objectify( msg.returnData ),
		};
		
		callback( res );
	}
	
	ns.AppEvent.prototype.handleRefreshTheme = function( msg ) {
		const self = this;
		var vIds = Object.keys( self.views );
		vIds.forEach( sendTheme );
		function sendTheme( vId ) {
			var view = self.views[ vId ];
			var cmd = {
				command   : 'refreshtheme',
				theme     : msg.theme,
				themeData : msg.themeData,
			};
			view.sendMessage( cmd );
		}
		
	}
	
	ns.AppEvent.prototype.handleCmdNotify = function( msg ) {
		const self = this;
		if ( msg.callback || msg.clickcallback ) {
			var yep = self.handleCallback( msg );
			if ( yep )
				return;
		}
	}
	
	ns.AppEvent.prototype.register = function( msg ) {
		const self = this;
		window.origin = msg.origin;
		self.domain = msg.domain;
		self.locale = msg.locale;
		self.filePath = msg.filePath;
		self.id = msg.applicationId;
		self.userId = msg.userId;
		self.authId = msg.authId;
		
		self.setLocale( null, setBack );
		function setBack() {
			self.registered( msg );
			self.initialize( msg );
		}
	}
	
	ns.AppEvent.prototype.registered = function( data ) {
		const self = this;
		var msg = {
			type : 'notify',
			data : 'registered',
			registerCallback : data.registerCallback,
		};
		self.sendMessage( msg );
	}
	
	ns.AppEvent.prototype.handleNotify = function( msg ) {
		const self = this;
		const handler = self.notifyMap[ msg.method ];
		if ( !handler ) {
			console.log( 'app.AppEvent.notify - no handler for ', msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.AppEvent.prototype.closeView = function( msg ) {
		const self = this;
		const viewId = msg.viewId;
		var view = self.getView( viewId );
		if ( !view )
			return;
		
		view.doClose();
	}
	
	ns.AppEvent.prototype.setViewFlag = function( msg ) {
		const self = this;
		let view = self.views[ msg.viewId ];
		if ( !view )
			return;
		
		let flag = msg.flag;
		let value = msg.value;
		if ( !flag )
			return;
		
		if ( 'minimized' === flag )
			view.isMinimized = !!value;
		
		if ( 'maximized' === flag )
			view.isMaximized = !!value;
		
	}
	
	ns.AppEvent.prototype.appWakeup = function( event ) {
		const self = this;
		if ( self.logSock )
			self.logSock.reconnect();
		
		self.emit( 'app-resume', event );
	}
	
	ns.AppEvent.prototype.initialize = function( msg ) {
		const self = this;
		if ( msg )
			delete msg.dosDrivers;
		
		setBase( msg.base || msg.domain );
		
		/*
		if ( !msg.args ) {
			const notie = {
				method : 'pushnotification',
				data   : {
					title   : 'boop',
					clicked : true,
					extra   : "{\"roomId\":\"room-70e38687-1445-4ef9-ada8-3db99ccf968f\",\"msgId\":\"msg-70c09120-4721-4955-bb00-a5ad9b55b41a\"}",
				},
			};
			
			msg.args = {
				events : [
					notie,
				],
			};
		}
		*/
		
		self.run( msg.args );
		
		function setBase( basePath ) {
			const base = document.createElement( 'base' );
			base.href = basePath;
			document.head.appendChild( base );
		}
	}
	
})( fupLocal );


// Application
(function( ns, undefined ) {
	ns.Application = function()	{
		if ( !( this instanceof ns.Application ))
			return new ns.Application();
		
		fupLocal.AppEvent.call( this );
		
		const self = this;
		self.id = null; // set by register event
		self.userId = null; // ^^^
		self.authId = null; // ^^^
		self.callbacks = {};
		self.views = {};
		
		self.deviceType = null;
		
		self.init();
	}
	
	ns.Application.prototype = Object.create( fupLocal.AppEvent.prototype );
	
	// Public
	
	ns.Application.prototype.createView = function(
		path,
		conf,
		initData,
		eventsink,
		onclose
	) {
		const self = this;
		const view = new api.View(
			path,
			conf,
			initData,
			eventsink,
			onclose
		);
		return view;
	}
	
	ns.Application.prototype.setConfig = function( conf ) {
		const self = this;
		self.appConf = conf;
		const update = {
			type : 'app-config',
			data : conf,
		}
		self.toAllViews( update );
	}
	
	ns.Application.prototype.setSettings = function( settings ) {
		const self = this;
		self.appSettings = settings;
	}
	
	ns.Application.prototype.setSingleInstance = function( setSingle ) {
		const self = this;
		self.sendMessage({
			type    : 'system',
			command : 'setsingleinstance',
			value   : setSingle,
		});
	}
	
	ns.Application.prototype.setDev = function( dumpHost, name ) {
		const self = this;
		if ( !dumpHost && name  ) {
			if ( self.logSock )
				self.logSock.setName( name );
			
			return;
		}
		
		if ( dumpHost ) {
			self.isDev = dumpHost;
			self.initLogSock( name );
		}
	}
	
	ns.Application.prototype.handleViewLog = function( args, viewName ) {
		const self = this;
		if ( !self.logSock )
			return;
		
		self.logSock.handleViewLog( args, viewName );
	}
	
	ns.Application.prototype.handleConnState = function( event ) {
		const self = this;
		self.emit( 'conn-state', event );
	}
	
	// Private
	
	ns.Application.prototype.toAllViews = function( event ) {
		const self = this;
		vids = Object.keys( self.views );
		vids.forEach( sendTo );
		function sendTo( vId ) {
			let view = self.views[ vId ];
			view.sendMessage( event );
		}
	}
	
	ns.Application.prototype.loadFile = function( path, loadCallback, vars ) {
		const self = this;
		if ( !path || !loadCallback ) {
			console.log( 'Application.loadFile: invalid arguments',
				{ path : path, callback : loadCallback });
			return;
		}
		
		var fid = self.setCallback( loadCallback );
		self.sendMessage({
			type     : 'file',
			method   : 'load',
			data     : { path: path },
			filePath : self.filePath,
			vars     : vars || [],
			fileId   : fid,
		});
	}
	
	ns.Application.prototype.executeModule = function()	{
		const self = this;
		console.log( 'Application.executeModule - NYI' );
	}
	
	ns.Application.prototype.postOut = function( msg ) {
		const self = this;
		var msg = {
			type : 'postout',
			data : msg,
		};
		self.sendMessage( msg );
	}
	
	ns.Application.prototype.notify = function( conf ) {
		const self = this;
		const cid = self.setCallback( conf.callback );
		const ccid = self.setCallback( conf.clickCallback );
		const msg = {
			type          : 'system',
			command       : 'notification',
			title         : conf.title,
			text          : conf.text,
			callback      : cid,
			clickcallback : ccid,
		}
		self.sendMessage( msg );
	}
	
	ns.Application.prototype.returnCallback = function( error, result, callbackId ) {
		const self = this;
		const event = {
			type       : 'system',
			command    : 'callback',
			callbackId : callbackId,
			error      : error,
			data       : result,
		};
		self.sendMessage( event );
	}
	
	ns.Application.prototype.sendMessage = function( msg, callback ) {
		const self = this;
		msg.applicationId = self.id;
		msg.authId = self.authId;
		msg.userId = self.userId;
		
		if ( callback ) {
			var callbackId = self.setCallback( callback );
			msg.callback = callbackId;
		}
		
		var msgString = friendUP.tool.stringify( msg );
		window.parent.postMessage( msgString, window.origin || '*' );
	}
	
	// close all views, does not quit the application
	ns.Application.prototype.close = function()	{
		const self = this;
		var viewIds = Object.keys( self.views );
		viewIds.forEach( callClose );
		function callClose( viewId ) {
			var view = self.views[ viewId ];
			if ( !view || !view.close )
				return;
				
			view.close();
		}
	}
	
	ns.Application.prototype.quit = function() {
		const self = this;
		self.close();
		self.sendMessage({
			type : 'system',
			command : 'quit',
			force : 'true',
		});
	}
	
	ns.Application.prototype.addView = function( view ) {
		const self = this;
		self.views[ view.id ] = view;
	}
	
	ns.Application.prototype.getView = function( viewId ) {
		const self = this;
		return self.views[ viewId ] || false;
	}
	
	ns.Application.prototype.removeView = function( viewId ) {
		const self = this;
		var view = self.views[ viewId ];
		if ( !view )
			return;
		
		self.release( viewId );
		delete self.views[ viewId ];
	}
	
	ns.Application.prototype.setFragments = function( fragStr ) {
		const self = this;
		self.fragments = fragStr;
	}
	
	ns.Application.prototype.setLocale = function( locale, callback ) {
		const self = this;
		locale = locale || self.locale;
		const localeFile = locale + '.lang';
		const path = 'Progdir:locale/' + localeFile;
		self.loadFile( path, fileBack );
		
		function fileBack( res ) {
			if ( !res ) {
				callback( false );
				return;
			}
			
			if ( 0 === res.indexOf( '<!DOC')) {
				console.log( 'no file for locale', {
					locale : localeFile,
					res    : res,
				});
				self.locale = 'en';
				self.setLocale( null, callback );
				return;
			}
			
			parseTranslations( res );
		}
		
		function parseTranslations( file ) {
			const lines = file.split( '\n' );
			onlyValid = lines.filter( cleanLines );
			const translations = {};
			onlyValid.forEach( setKeyValue );
			self.translations = translations;
			callback( true );
			
			function setKeyValue( line ) {
				let parts = line.split( ':' );
				translations[ parts[ 0 ].trim() ] = parts[ 1 ].trim();
			}
			
			function cleanLines( line ) {
				if ( !line || !line.trim )
					return false;
				
				line = line.trim();
				if ( !line || !line.length )
					return false;
				
				return '#' !== line[0];
			}
		}
	}

	ns.Application.prototype.receiveMessage = function( e ) {
		const self = this;
	}
	
	ns.Application.prototype.setCallback = function( callback ) {
		const self = this;
		const id = friendUP.tool.uid( 'callback' );
		self.callbacks[ id ] = callback;
		
		return id;
	}
	
	ns.Application.prototype.getCallback = function( id ) {
		const self = this;
		const callback = self.callbacks[ id ];
		if ( !callback ) {
			console.log( 'app.getCallback - no callback for', {
				id  : id,
				cbs : self.callbacks,
			});
			return null;
		}
		
		delete self.callbacks[ id ];
		return callback;
	}
	
	ns.Application.prototype.setPromiseCallback = function() {
		const self = this;
		const id = friendUP.tool.uid( 'pback' );
		const cb = {
			id      : id,
			promise : null,
		};
		const p = new Promise(( resolve, reject ) => {
			self.callbacks[ id ] = pBack;
			function pBack( event ) {
				resolve( event );
			}
		});
		cb.promise = p;
		return cb;
	}
	
	// Get a translated string
	ns.Application.prototype.i18n = function( string ) {
		if( this.translations && this.translations[string] )
			return this.translations[string];
		return string;
	}
	
	// Search and execute replacements in string
	ns.Application.prototype.i18nReplaceInString = function( str ) {
		var pos = 0;
		while ( ( pos = str.indexOf( "{i18n_", pos ) ) >= 0 )
		{
			var pos2 = str.indexOf("}", pos);
			if (pos2 >= 0)
			{
				var key = str.substring(pos + 1, pos2);
				str = str.substring(0, pos) + Application.i18n(key) + str.substring(pos2 + 1);
				pos = pos2 + 1;
			}
			else
			{
				break;
			}
		}
		return str;
	}
	
	ns.Application.prototype.init = function() {
		const self = this;
		self.detectDeviceType();
	}
	
	// DESKTOP
	// MOBILE
	// VR
	ns.Application.prototype.setDeviceType = function( type ) {
		const self = this;
		self.deviceType = type;
		if ( !type || 'string' === typeof( type ))
			return;
		
		self.deviceType = type.toUpperCase();
	}
	
	// DESKTOP
	// MOBILE
	// VR
	ns.Application.prototype.detectDeviceType = function() {
		const self = this;
		let type = 'DESKTOP'; // default
		let found = null;
		const test = [
			'VR',
			'Mobile',
		]; // detect, by priority
		const rxBody = test.join( '|' );
		const rx = new RegExp( '(' + rxBody + ')', 'g' );
		const ua = window.navigator.userAgent;
		const match = ua.match( rx );
		if ( match )
			found = get( test, match );
		
		if ( null != found )
			type = found.toUpperCase();
		
		self.setDeviceType( type );
		
		function get( test, match ) {
			let type = null;
			test.some( is );
			return type;
			
			function is( value ) {
				if ( -1 === match.indexOf( value ))
					return false;
				
				type = value;
				return true;
			}
		}
	}
	
	ns.Application.prototype.initLogSock = function( name ) {
		const self = this;
		if ( 'DESKTOP' === self.deviceType ) {
			console.log( 'initLogSock - desktop, aborting', name );
			return;
		}
		
		if ( self.logSock ) {
			self.logSock.reconnect();
			return;
		}
		
		const host = self.isDev;
		self.logSock = new api.LogSock( host, name );
	}
	
})( fupLocal );

window.Application = new fupLocal.Application();


// Storage
(function( ns, undefined ) {
	ns.ApplicationStorage = {
		app : window.Application,
	};
	const self = ns.ApplicationStorage;
	
	ns.ApplicationStorage.set = function( id, data ) {
		const bundle = {
			id : id,
			data : data,
		};
		const msg = {
			method : 'set',
			data : bundle,
		};
		return self._send( msg );
	};
	
	ns.ApplicationStorage.get = function( id ) {
		const msg = {
			method : 'get',
			data : {
				id : id,
			},
			
		};
		return self._send( msg );
	};
	
	ns.ApplicationStorage.remove = function( id ) {
		const msg = {
			method : 'remove',
			data : {
				id : id,
			},
		};
		return self._send( msg );
	}
	
	ns.ApplicationStorage._send = function( msg ) {
		const cb = self.app.setPromiseCallback();
		msg.callbackId = cb.id;
		msg.type = 'applicationstorage';
		self.app.sendMessage( msg );
		return cb.promise;
	};
	
})( api );


//
// File
(function( ns, undefined ) {
	ns.File = function( path ) {
		if ( !( this instanceof ns.File ))
			return new ns.File( path );
		
		const self = this;
		self.path = path;
		self.name = null;
		self.type = null;
		self.exposeHash = null;
		
		self.init();
	}
	
	ns.File.prototype.init = function() {
		const self = this;
	}
	
	ns.File.prototype.expose = function( callback ) {
		const self = this;
		var libConf = {
			functionName : 'file/expose',
			args : {
				path : self.path,
			},
			onsuccess : success,
			onerror : err,
		};
		var lib = new api.Library( libConf );
		function success( res ) {
			self.exposeHash = res.hash;
			self.name = res.name;
			var link = self.getPublicLink();
			callback( link );
		}
		function err( res ) {
			console.log( 'File.expose.err', res );
			callback( false );
		}
	}
	
	ns.File.prototype.unshare = function( callback ) {
		const self = this;
		console.log( 'File.unshare - NYI', self.path );
	}
	
	ns.File.prototype.getPublicLink = function() {
		const self = this;
		if ( !self.exposeHash || !self.name )
			return null;
		
		var link = window.Application.domain + '/sharedfile/' + self.exposeHash + '/' + self.name;
		link = window.encodeURI( link );
		return link;
	}
})( api );


// Dormant
(function( ns, undefined ) {
	ns.Dormant = function() {
		const self = this;
		self.doors = {};
		self.doorIds = [];
		self.app = window.Application;
		
		self.init();
	}
	
	ns.Dormant.prototype.init = function() {
		const self = this;
		self.methodMap = {
			'getdirectory' : getDirectory,
			'updatetitle'  : updateTitle,
			'execute'      : execute,
			'callback'     : callback,
		};
		
		function getDirectory( e ) { self.handleGetDirectory( e ); }
		function updateTitle( e ) { self.handleUpdateTitle( e ); }
		function execute( e ) { self.handleExecute( e ); }
		function callback( e ) { self.handleCallback( e ); }
	}
	
	// Public
	
	ns.Dormant.prototype.add = function( door ) {
		const self = this;
		var doorId = self.set( door );
		var msg = {
			method : 'addAppDoor',
			title  : door.title,
			doorId : doorId,
		};
		self.send( msg );
	}
	
	ns.Dormant.prototype.remove = function( doorId ) {
		const self = this;
		let door = self.doors[ doorId ];
		if ( !door )
			return;
		
		delete self.doors[ doorId ];
		const remove = {
			method : 'delAppDoor',
			title  : door.title,
		}
	}
	
	ns.Dormant.prototype.close = function() {
		const self = this;
	}
	
	ns.Dormant.prototype.setupProxy = function( info ) {
		const self = this;
		console.log( 'setupProxyDoor - NYI', info );
	}
	
	ns.Dormant.prototype.getDoors = function( callback ) {
		const self = this;
		//console.log( 'getDoors' );
		var callbackId = self.app.setCallback( callBackWrap );
		self.send({
			method     : 'getDoors',
			callbackId : callbackId,
		});
		
		function callBackWrap( msg ) {
			//console.log( 'getDoors.callBackWrap', msg );
			for ( var infoKey in msg )
				self.setupProxyDoor( msg[ infoKey ] );
			if ( callback )
				callback( msg );
		}
	}
	
	ns.Dormant.prototype.handleMessage = function( msg ) {
		const self = this;
		//console.log( 'Dormant.handleMessage', msg );
		var handler = self.methodMap[ msg.method ];
		if ( !handler ) {
			console.log( 'Dormant.handleMessage - no handler for', msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.Dormant.prototype.handleGetDirectory = function( msg ) {
		const self = this;
		/*
		console.log( 'handleGetDirectory', {
			msg : msg,
			doors : self.doors,
		});
		*/
		var door = self.doors[ msg.doorId ];
		if ( !door ) {
			consolelog( 'Doormant.handleGetDirectory - no door for', { m : msg, d : self.doors });
		}
		
		var dir = door.getDirectory( msg );
		//console.log( 'handleGetDirectory - dir', dir );
		self.sendBack( null, dir, msg );
	}
	
	ns.Dormant.prototype.handleUpdateTitle = function( msg ) {
		const self = this;
		//console.log( 'handleUpdateTitle', msg );
		var door = self.doors[ msg.doorId ];
		if ( !door ) {
			console.log( 'Doormant - no door for', { m : msg, d : self.doors });
			return;
		}
		
		door.title = msg.realtitle;
	}
	
	ns.Dormant.prototype.handleExecute = function( event ) {
		const self = this;
		//console.log( 'handleExecute', event );
		const door = self.doors[ event.doorId ];
		if ( !door ) {
			console.log( 'handleExecute - no door', { e : event, self : self });
			return;
		}
		
		door.execute( event, execBack );
		function execBack( err , res ) {
			console.log( 'handleExecute, execBack', {
				event : event,
				door  : door,
				res   : res,
				err   : err,
			});
			self.sendBack( err, res, event );
		}
	}
	
	ns.Dormant.prototype.handleCallback = function( msg ) {
		const self = this;
		console.log( 'handleCallback - NYI', msg );
	}
	
	ns.Dormant.prototype.set = function( doorObj ) {
		const self = this;
		//console.log( 'setDoor', doorObj );
		var doorId = friendUP.tool.uid( 'door' );
		doorObj.doorId = doorId;
		self.doors[ doorId ] = doorObj;
		return doorId;
	}
	
	ns.Dormant.prototype.get = function( doorId ) {
		const self = this;
		//console.log( 'getDoor', doorId );
		return self.doors[ doorId ];
	}
	
	ns.Dormant.prototype.sendBack = function( err, data, event ) {
		const self = this;
		var msg = {
			method     : 'callback',
			callbackId : event.callbackId,
			doorId     : event.doorId,
			data       : data,
			error      : err,
		};
		self.send( msg );
	}
	
	ns.Dormant.prototype.send = function( msg ) {
		const self = this;
		msg.type = 'dormantmaster';
		self.app.sendMessage( msg );
	}
	
})( fupLocal );

friend.Dormant = new fupLocal.Dormant;


// Door
(function( ns, undefined ) {
	ns.Door = function( conf ) {
		if ( !( this instanceof ns.Door ))
			return new ns.Door( conf );
		
		const self = this;
		self.title = conf.title, // aka base of dir. <this>:foo/bar/
		self.basePath = null;
		self.baseRX = null;
		self.dirs = {};
		
		self.doorId = null; // set by dormant
		
		self.init();
	}
	
	// Public
	
	ns.Door.prototype.close = function() {
		const self = this;
		console.log( 'door.close - NYI' ) ;
	}
	
	ns.Door.prototype.addDir = function( dir ) {
		const self = this;
		if ( !dir.fullPath || !dir.fullPath.length ) {
			console.log( 'Dormant / Door.addItem - invalid path', dir );
			throw new Error( 'Dormant / Door.addItem - invalid path' );
		}
		
		dir.parentPath = self.normalizePath( dir.parentPath || '' );
		dir.fullPath = self.normalizePath( dir.fullPath );
		const parent = self.dirs[ dir.parentPath ];
		if ( !parent ) {
			console.log( 'Dormant / Door.addDir - no parent, aborting', {
				d : dir,
				dirs : self.dirs,
				pP : dir.parentPath,
				p : dir.fullPath,
			});
			return;
		}
		parent.items.push( dir );
		self.dirs[ dir.fullPath ] = dir;
	}
	
	ns.Door.prototype.addFun = function( item ) {
		const self = this;
		item.parentPath = self.normalizePath( item.parentPath );
		item.fullPath = self.normalizePath( item.fullPath );
		const dir = self.dirs[ item.parentPath ];
		if ( !dir ) {
			console.log( 'Dormant / Door.addFun - no dir', {
				item   : item,
				lookup : item.fullPath,
				dirs   : self.dirs,
			});
			return;
		}
		
		//console.log( 'addFun', item );
		dir.funs[ item.title ] = item;
		dir.items.push( item );
	}
	
	ns.Door.prototype.remove = function( dir ) {
		const self = this;
		let path = dir.fullPath;
		let target = self.dirs[ path ];
		let parent = self.dirs[ dir.parentPath ];
		console.log( 'remove', {
			dir  : dir,
			dirs : self.dirs,
			target : target,
			parent : parent,
		});
		if ( !target )
			return;
		
		parent.items = parent.items.filter( notTarget );
		delete self.dirs[ path ];
		target.close();
		
		function notTarget( item ) {
			return item.fullPath !== target.fullPath;
		}
	}
	
	ns.Door.prototype.getDirectory = function( msg ) {
		const self = this;
		const path = self.normalizePath( msg.path );
		//console.log( 'getDirectory', msg );
		const dir = self.dirs[ msg.path ];
		if ( !dir ) {
			console.log( 'Dormant / Door.getDirectory - no dir found', {
				msg  : msg,
				dirs : self.dirs,
			});
			return null;
		}
		
		let items = dir.itemize();
		items = items.map( addDoorInfo );
		//console.log( 'Door.getDirectory', { m : msg, dir : dir, dirs : self.dirs, self : self });
		return items;
		
		function addDoorInfo( item ) {
			item.Dormant = {
				title  : self.title,
				doorId : self.doorId,
			};
			return item;
		}
	}
	
	ns.Door.prototype.execute = function( event, callback ) {
		const self = this;
		const fnPath = event.dormantPath;
		const fnName = event.dormantCommand;
		let   fnArgs = event.dormantArgs;
		console.log( 'Door.execute', {
			e    : event    ,
			path : fnPath   ,
			name : fnName   ,
			args : fnArgs   ,
			dirs : self.dirs,
		});
		
		//let path = self.normalizePath( 'Functions/' );
		path = self.normalizePath( fnPath );
		const parent = self.dirs[ path ];
		const fun = parent.funs[ event.dormantCommand ];
		if ( !fun ) {
			console.log( 'no fun for', event );
			callback( 'ERR_DORMANT_NO_FUN_DOOR', null );
		}
		
		console.log( 'found fun item', fun );
		if ( !fun.execute|| !fun.execute.apply ) {
			console.log( '..but no funtion to execute', fun );
			callback( 'ERR_DORMANT_NO_FUN', null );
		}
		
		const future = fun.execute.apply( null, fnArgs )
		if ( !future ) {
			callback( null, true );
			return;
		}
		
		future
			.then( exeOk )
			.catch( exeFail );
		
		function exeOk( res ) {
			callback( null, res );
		}
		
		function exeFail( err ) {
			callback( err, null );
		}
	}
	
	// Private
	
	ns.Door.prototype.normalizePath = function( path ) {
		const self = this;
		//console.log( 'normalizePath', path );
		if ( !path ) {
			/*
			try {
				throw new Error( 'normalizePath' );
			} catch( e ) {
				console.log( 'normalizePath - no path - trace', e );
			}
			*/
			path = '';
		}
		
		if ( null == path.match( self.baseRX ))
			path = self.basePath + path;
		
		return path;
	}
	
	ns.Door.prototype.init = function() {
		const self = this;
		//console.log( 'Door.init', self );
		self.basePath = self.title + ':';
		self.baseRX = new RegExp( '^' + self.basePath, '' );
		
		const baseDir = new api.DoorDir({
			path : self.title,
			title : self.title,
		});
		self.dirs[ self.basePath ] = baseDir;
	}
	
})( api );


//
// basic dormant item, extend for your pleasure
//
api.DoorItem = function( conf, parentPath ) {
	const self = this;
	self.path = conf.path;
	self.title = conf.title;
	self.parentPath = parentPath;
	self.module = 'files';
	
	self.baseInit();
};

// Public

api.DoorItem.prototype.itemize = function() {
	const self = this;
	const items = [];
	self.items.forEach( serialize );
	console.log( 'itemize', items );
	return items;
	
	function serialize( item ) {
		const conf = item.serialize();
		items.push( conf );
	}
}

api.DoorItem.prototype.serialize = function() {
	const self = this;
	const conf = {
		MetaType  : self.metaType || 'Meta',
		Module    : self.module || undefined,
		Title     : self.title,
		FileName  : self.fileName || undefined,
		IconClass : self.iconClass || '',
		Path      : self.fullPath,
		Position  : 'left',
		Command   : 'dormant',
		Filesize  : self.fileSize,
		Flags     : '',
		Type      : self.type,
		Dormant   : null, // set by door
	};
	return conf;
}

// Private

api.DoorItem.prototype.baseInit = function() {
	const self = this;
	self.fullPath = ( self.parentPath || '' ) + ( self.path || '' );
}


//
// directory in Dormant dir
//
api.DoorDir = function( conf, parentPath ) {
	const self = this;
	console.log( 'DoorDir', conf );
	self.iconClass = conf.icon || 'Directory';
	self.type = 'Directory';
	self.fileName = conf.path;
	self.metaType = 'Directory';
	self.fileSize = 4096;
	api.DoorItem.call( self, conf, parentPath );
	
	self.items = [];
	self.funs = {};
	
	self.init();
};

api.DoorDir.prototype = Object.create( api.DoorItem.prototype );

// Public

api.DoorDir.prototype.close = function() {
	const self = this;
	self.funs = null;
	self.items.forEach( item => item.close());
	self.items = null;
}

// Private

api.DoorDir.prototype.init = function() {
	const self = this;
}


//
// function in Dormant dir
//
api.DoorFun = function( conf, parentPath ) {
	const self = this;
	//conf.path = conf.title;
	self.type = 'DormantFunction';
	self.metaType = 'Meta';
	self.execute = conf.execute;
	self.iconClass = conf.icon || 'File';
	self.fileSize = 1337;
	api.DoorItem.call( self, conf, parentPath );
	
	self.init();
};

api.DoorFun.prototype = Object.create( api.DoorItem.prototype );

// Public

api.DoorFun.prototype.close = function() {
	const self = this;
	delete self.execute;
}

// Private

api.DoorFun.prototype.init = function() {
	const self = this;
	
};

//
// file in Dormant dir
//
// NYI

// SoundAlert
(function( ns, undefined ) {
	ns.SoundAlert = function( filePath ) {
		if ( !( this instanceof ns.SoundAlert ))
			return new ns.SoundAlert( filePath );
		
		const self = this;
		self.path = filePath;
		self.actx = null;
		self.fileBuffer = null;
		self.playTimeout = 1000 * 2;
		self.playTimeoutId = null;
		
		self.init();
	}
	
	ns.SoundAlert.prototype.play = function() {
		const self = this;
		if ( !self.fileBuffer ) {
			return;
		}
		if ( self.playTimeoutId )
			return;
		
		var source = self.actx.createBufferSource();
		source.buffer = self.fileBuffer;
		source.connect( self.actx.destination );
		source.start();
		self.playTimeoutId = window.setTimeout( canPlayAgain, self.playTimeout );
		function canPlayAgain() {
			self.playTimeoutId = null;
		}
	}
	
	ns.SoundAlert.prototype.close = function() {
		const self = this;
		if ( self.actx )
			self.actx.close();
		
		if ( self.playTimeoutId  ) {
			window.clearTimeout( self.playTimeoutId );
			self.playTimeoutId = null;
		}
	}
	
	ns.SoundAlert.prototype.init = function() {
		const self = this;
		self.loadFile( loadBack );
		function loadBack( file ) {
			if ( !file )
				return;
			
			if ( !window.AudioContext )
				return;
			
			self.actx = new window.AudioContext();
			try {
				self.actx.decodeAudioData( file )
					.then( decoded )
					.catch( wellShit );
			} catch ( e ) {
				console.log( 'api.SoundAlert.init - decodaeAudioData derped', e );
				return;
			}
		}
		
		function decoded( buff ) {
			self.fileBuffer = buff;
		}
		
		function wellShit( err ) {
			console.log( 'wellShit', err );
		}
	}
	
	ns.SoundAlert.prototype.loadFile = function( callback ) {
		const self = this;
		var req = new XMLHttpRequest();
		req.open( 'GET', self.path, true );
		req.responseType = 'arraybuffer';
		req.onload = loaded;
		req.send();
		
		function loaded( res ) {
			const self = this;
			if ( 200 !== req.status )
				callback( null );
			
			callback( req.response );
		}
	}
	
})( api );

(function( ns, undefined ) {
	ns.Calendar = function() {
		const self = this;
		self.init();
	}
	
	ns.Calendar.prototype.addEvent = function( conf, messageToUser, callback ) {
		const self = this;
		var event = {
			Date        : conf.Date,
			Title       : conf.Title,
			Description : conf.Description,
			TimeFrom    : conf.TimeFrom,
			TimeTo      : conf.TimeTo,
		};
		
		var cid = undefined;
		if ( callback )
			cid = self.app.setCallback( callback );
		
		var wrap = {
			type : 'add',
			data : {
				cid   : cid,
				message : messageToUser,
				event : event,
			},
		};
		self.send( wrap );
	}
	
	// priv
	
	ns.Calendar.prototype.init = function() {
		const self = this;
		self.app = window.Application;
	}
	
	ns.Calendar.prototype.send = function( msg ) {
		const self = this;
		var wrap = {
			type : 'calendar',
			data : msg,
		}
		self.app.sendMessage( wrap );
	}
})( api );


// TinyURL
(function( ns, undefined ) {
	ns.TinyURL = function() {
		const self = this;
		
		self.init();
	}
	
	// Public
	
	// tinyfy a url, returns a promise
	ns.TinyURL.prototype.compress = function( url ) {
		const self = this;
		return new window.Promise( tinyfy );
		function tinyfy( resolve, reject ) {
			new api.Module({
				method : 'tinyurl',
				args   : {
					source : url,
				},
				success : onSuccess,
				error   : onError,
			});
			
			function onSuccess( res ) {
				let data = friendUP.tool.objectify( res );
				if ( !data ) {
					reject( 'ERR_INVALID_JSON' );
					return;
				}
				
				resolve( data );
			}
			
			function onError( err ) {
				console.log( 'tiny.onError', err );
				reject( 'ERR_SOME_ERR' );
			}
		}
	}
	
	// get the original url from a tiny url, returns a promise
	ns.TinyURL.prototype.expand = function( tinyUrl ) {
		const self = this;
		console.log( 'expand - NYI', tinyURL );
		
	}
	
	// Private
	
	ns.TinyURL.prototype.init = function() {
		const self = this;
		
	}
	
})( fupLocal );

friend.tinyURL = new fupLocal.TinyURL();
