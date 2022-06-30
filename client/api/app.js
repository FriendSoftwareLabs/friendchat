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
		eventSink,
		onclose
	) {
		const self = this;
		self.viewType = 'app.View';
		self.path = htmlPath;
		self.windowConf = windowConf || {};
		self.initData = initData;
		self.onclose = onclose;
		self.id = self.windowConf.id || friendUP.tool.uid( 'view' );
		self.eventQueue = [];
		
		self.app = window.Application;
		
		self.viewName = self.id;
		self.hasFocus = false;
		
		self.initView( eventSink );
	}
	
	ns.View.prototype = Object.create( library.component.RequestNode.prototype );
	
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
		//console.log( 'app.View.setFlag', [ flag, value ]);
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
	
	ns.View.prototype.initView = function( eventSink ) {
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
		viewConf.friendApp = self.app.friendApp;
		
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
		
		self.fromView = new library.component.RequestNode( self.id, self.app );
		self.fromView.on( 'app', e => self.toApp( e ));
		self.fromView.on( 'log-sock', e => self.toLogSock( e ));
		self.fromView.on( 'conn-state', e => self.toConnState( e ));
		self.fromView.on( 'loaded', loaded );
		self.fromView.on( 'ready', ready );
		self.fromView.on( 'minimized', e => self.handleMinimized( e ));
		self.fromView.on( 'show-notify', e => self.handleNotification( e ));
		self.fromView.on( 'open-file', e => self.openFile( e ));
		self.fromView.on( 'call-friend', e => { self.doThingieCall( e.type, e.data ); });
		self.fromView.on( 'focus', e => self.handleFocus( e ));
		//self.fromView.on( 'call-library', e => self.doLibraryCall( e ));
		
		library.component.RequestNode.call( self,
			null,
			self.fromView,
			eventSink,
		);
		
		if ( true != windowConf.liveView )
			windowConf.sidebarManaged = true;
		
		windowConf.requireDoneLoading = true;
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
	}
	
	ns.View.prototype.toApp = function( event ) {
		const self = this;
		self.handle( event );
		//self.emit( event.type, event.data );
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
		if ( !self.isMinimized && !isMinimized )
			self.handleFocus( true );
			
		if ( isMinimized === self.isMinimized )
			return;
		
		self.isMinimized = isMinimized;
		self.emit( 'minimized', !!self.isMinimized );
	}
	
	ns.View.prototype.handleMaximized = function( isMaximized ) {
		const self = this;
		if ( isMaximized === self.isMaximized )
			return;
		
		self.isMaximized = isMaximized;
		self.emit( 'maximized', self.isMaximized );
	}
	
	ns.View.prototype.handleFocus = function( hasFocus ) {
		const self = this;
		console.log( 'handleFocus', [ self.hasFocus, hasFocus ]);
		if ( self.hasFocus === hasFocus )
			return;
		
		self.hasFocus = hasFocus;
		self.emit( 'focused', self.hasFocus );
	}
	
	ns.View.prototype.handleNotification = function( notie ) {
		const self = this;
		self.app.notify( notie );
	}
	
	ns.View.prototype.openFile = function( e ) {
		const self = this;
		const fP = e.filePath;
		const aN = e.appName;
		self.app.openFile( fP, aN );
	}
	
	ns.View.prototype.doModuleCall = function( req ) {
		const self = this;
		self.doThingieCall( 'module', req );
	}
	
	ns.View.prototype.doLibraryCall = function( req ) {
		const self = this;
		self.doThingieCall( 'library', req );
	}
	
	ns.View.prototype.doThingieCall = function( type, req ) {
		const self = this;
		const reqId = req.reqId;
		const conf = req.conf;
		conf.onSuccess = onSuccess;
		conf.onError = onError;
		let thingie = null;
		if ( 'module' == type )
			thingie = api.Module;
		if ( 'library' == type )
			thingie = api.Library;
		
		new thingie( conf );
		
		function onSuccess( data ) {
			sendResponse( null, data, reqId );
		}
		
		function onError( err ) {
			console.log( 'onThingieCall.onError', err );
			sendResponse( err, null, reqId );
		}
		
		function sendResponse( err, res, reqId ) {
			const reply = {
				type     : 'callback',
				callback : reqId,
				error    : err,
				response : res,
			};
			self.sendMessage( reply );
		}
	}
	
	ns.View.prototype.doClose = function() {
		const self = this;
		self.ready = false;
		const onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose( true );
		
		self.close();
	}
	
	ns.View.prototype.close = function() {
		const self = this;
		self.ready = false;
		if ( !self.app ) {
			return;
		}
		
		self.app.removeView( self.id );
		const msg = {
			method : 'close',
		};
		self._send( msg );
		
		self.closeRequestNode();
		delete self.onclose;
		delete self.app;
		delete self.eventQueue;
	}
	
	ns.View.prototype.queueEvent = function( event ) {
		const self = this;
		if ( !self.eventQueue )
			self.eventQueue = [];
		
		self.eventQueue.push( event );
	}
	
	ns.View.prototype.sendEventQueue = function() {
		const self = this;
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

// NATIVE VIEW
(function( ns, undefined ) {
	ns.NativeView = function(
		windowConf,
		initData,
		eventSink
	) {
		const self = this;
		self.ready = false;
		self.app = window.Application;
		self.sendQueue = [];
		
		EventEmitter.call( self, eventSink );
		
		self.initView( initData );
	}
	
	ns.NativeView.prototype = Object.create( EventEmitter.prototype );
	
	// Public
	
	ns.NativeView.prototype.send = function( event ) {
		const self = this;
		if ( !self.ready ) {
			self.sendQueue.push( event );
			return;
		}
		
		const msg = {
			data : event,
		};
		self._send( msg );
	}
	
	ns.NativeView.prototype.close = function() {
		const self = this;
		if ( self.fromView )
			self.fromView.close();
		
		delete self.fromView;
		
		if ( !self.app )
			return;
		
		self.app.removeView( self.id );
		const close = {
			data : {
				type : 'close',
			},
		};
		self._send( close );
		
		self.closeEventEmitter();
		
		delete self.ready;
		delete self.sendQueue;
		delete self.app;
	}
	
	// Private
	
	ns.NativeView.prototype.initView = function( initData ) {
		const self = this;
		self.id = friendUP.tool.uid( 'native' );
		self.app.addView( self );
		self.fromView = new library.component.EventNode( self.id, self.app, unhandled );
		self.fromView.on( 'ready', e => self.setReady( e ));
		const init = {
			data : {
				type : 'initialize',
				data : initData,
			},
		};
		self._send( init );
		
		function unhandled( type, data ) {
			self.emit( type, data );
		}
	}
	
	ns.NativeView.prototype.setReady = function() {
		const self = this;
		self.ready = true;
		if ( self.sendQueue.length ) {
			self.sendQueue.forEach( e => self.send( e ));
			self.sendQueue = [];
		}
		
		self.emit( 'ready' );
	}
	
	ns.NativeView.prototype._send = function( msg ) {
		const self = this;
		msg.type = 'native-view';
		msg.viewId = self.id;
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
	ns.Module = function( conf, forceHTTP )
	{
		const self = this;
		if ( null == conf.onSuccess || null == conf.onError )
			throw new Error( 'missing the things' );
		
		self.onSuccess = conf.onSuccess;
		self.onError = conf.onError;
		
		self.id = friendUP.tool.uid;
		self.app = window.Application;
		
		self.init( conf, forceHTTP );
	}
	
	ns.Module.prototype.init = function( conf, forceHTTP ) {
		const self = this;
		const callbackId = self.app.setCallback( result );
		const msg = {
			module    : conf.module || 'system',
			method    : conf.method,
			args      : conf.args,
			vars      : conf.vars,
			fileId    : callbackId,
			forceHTTP : forceHTTP,
		};
		self.send( msg );
		
		function result( data ) {
			if ( !data )
				self.onError();
			else
				self.onSuccess( data );
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
		self.onSuccess = conf.onSuccess;
		self.onError = conf.onError;
		
		self.app = window.Application;
		self.init();
	}
	
	ns.Library.prototype.init = function() {
		const self = this;
		if ( !self.app )
			throw new Error( 'window.Application not found' );
		
		const cid = self.app.setCallback( result );
		const msg = {
			library    : self.name,
			func       : self.func,
			args       : self.args,
			callbackId : cid,
		};
		self.send( msg );
		
		function result( res ) {
			self.handleResponse( res );
		}
	}
	
	ns.Library.prototype.handleResponse = function( res ) {
		const self = this;
		const success = res.ok;
		if ( success )
			self.onSuccess( res.data );
		else
			self.onError( res.error );
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
			const e = {
				type : type,
				data : data,
			};
			//console.log( 'AppEvent - unhandled event', e );
			self.receiveMessage( e );
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
			//'shell'              : shell,
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
		//function shell( e ) { self.handleShell( e ); }
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
		
		//console.log( 'app.receiveEvent', msg );
		
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
		
		if ( msg.callback || msg.clickcallback || msg.shellId || msg.callbackId ) {
			const yep = self.handleCallback( msg );
			if ( yep )
				return;
		}
		
		if ( msg.viewId ) {
			self.handleFromView( msg );
			return;
		}
		
		//console.log( 'app.receiveEvent - system didnt handle this one', msg );
		
		self.appMessage( msg );
	}
	
	ns.AppEvent.prototype.handleCallback = function( msg ) {
		const self = this;
		const cid = msg.callback || msg.clickcallback || msg.shellId || msg.callbackId;
		const callback = self.getCallback( cid );
		
		if ( !callback )
			return false;
		
		callback( msg );
		return true;
	}
	
	ns.AppEvent.prototype.handleShell = function( msg ) {
		const self = this;
		//console.log( 'handleShell', msg );
		const cb = self.getCallback( msg.shellId );
		if ( null == cb )
			return;
		
		cb( msg );
	}
	
	ns.AppEvent.prototype.handleFromView = function( msg ) {
		const self = this;
		const type = msg.viewId;
		if ( !type || !msg.data ) {
			//console.log( 'weird event', msg );
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
		const fId = msg.fileId;
		const handler = self.getCallback( fId );
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
		self.viewIds.forEach( sendTheme );
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
	
	ns.AppEvent.prototype.register = async function( msg ) {
		const self = this;
		window.origin  = msg.origin;
		self.domain    = msg.domain;
		self.locale    = msg.locale;
		self.filePath  = msg.filePath;
		self.id        = msg.applicationId;
		self.userId    = msg.userId;
		self.authId    = msg.authId;
		self.friendApp = msg.friendApp;
		
		await self.setLocale( null );
		
		self.registered( msg );
		self.initialize( msg );
		
	}
	
	ns.AppEvent.prototype.registered = function( data ) {
		const self = this;
		const msg = {
			type             : 'notify',
			data             : 'registered',
			registerCallback : data.registerCallback,
		};
		self.sendMessage( msg );
	}
	
	ns.AppEvent.prototype.handleNotify = function( msg ) {
		const self = this;
		const handler = self.notifyMap[ msg.method ];
		if ( !handler ) {
			//console.log( 'app.AppEvent.notify - no handler for ', msg );
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
		if ( null == flag )
			return;
		
		if ( 'minimized' === flag )
			view.handleMinimized( value );
		
		if ( 'maximized' === flag )
			view.handleMaximized( value );
		
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
		self.viewIds = [];
		
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
	
	ns.Application.prototype.openFile = async function( filePath, appName ) {
		const self = this;
		const cmdLine = appName + ' ' + filePath;
		const sh = new api.Shell( self );
		const res = await sh.execute( cmdLine );
	}
	
	// Private
	
	ns.Application.prototype.toAllViews = function( event ) {
		const self = this;
		self.viewIds.forEach( sendTo );
		function sendTo( vId ) {
			let view = self.views[ vId ];
			view.sendMessage( event );
		}
	}
	
	/* loadFile
	
	returns a promise that resolves to the file data or throws an exception
	
	path - <string> path to file
	vars - <map> optional, additional options
	retriesAllowed - <number> optional, how many, if any, attempts will be made
		to get a useful result. Defaults to 0
	
	*/
	ns.Application.prototype.loadFile = async function( path, vars, retriesAllowed ) {
		const self = this;
		if ( null == path )
			throw new Error( 'ERR_NO_PATH' );
		
		let file = null;
		try {
			file = await doLoad( path, vars, retriesAllowed );
		} catch( ex ) {
			throw ex;
		}
		
		return file;
		
		function doLoad( path, vars, rAllowed, reee ) {
			return new Promise(( resolve, reject ) => {
				const cbId = self.setCallback( loadCallback );
				if ( rAllowed && rAllowed < reee ) {
					reject( 'ERR_TOO_MANY_RETRIES' );
					return;
				}
				
				send( path, vars, cbId );
				const loadTO = window.setTimeout( loadTimeout, 1000 * 3 );
				
				function loadCallback( file ) {
					window.clearTimeout( loadTO );
					
					if ( 0 == file.indexOf( 'ERR_' ))
						error( file );
					else
						resolve( file );
				}
				
				function loadTimeout() {
					self.cancelCallback( cbId, 'ERR_TIMEOUT' );
				}
				
				async function error( err ) {
					if ( null == rAllowed ) {
						reject( 'ERR_TOO_MANY_RETRIES' );
						return;
					}
					
					console.log( 'error', {
						err      : err,
						path     : path,
						cbId     : cbId,
						rAllowed : rAllowed,
						reee     : reee,
					});
					if ( null == reee )
						reee = 0;
					else
						reee++;
					
					let file = null;
					try {
						file = await doLoad( path, vars, rAllowed, reee );
					} catch( ex ) {
						reject( ex );
					}
					
					resolve( file );
				}
				
			});
			
		}
		
		function send( path, vars, cbId ) {
			const load = {
				type     : 'file',
				method   : 'load',
				data     : { path : path },
				filePath : self.filePath,
				vars     : vars || [],
				fileId   : cbId,
			};
			self.sendMessage( load );
		}
		
		
		if ( !path ) {
			console.log( 'Application.loadFile: invalid arguments',
				{ path : path, callback : loadCallback });
			return;
		}
		
		
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
		
		const msgString = friendUP.tool.stringify( msg );
		window.parent.postMessage( msgString, window.origin || '*' );
	}
	
	ns.Application.prototype.sendWorkspace = 
		ns.Application.prototype.sendMessage;
	
	// close all views, does not quit the application
	ns.Application.prototype.close = function()	{
		const self = this;
		self.viewIds.forEach( callClose );
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
		const vId = view.id;
		self.views[ vId ] = view;
		self.viewIds.push( vId );
	}
	
	ns.Application.prototype.getView = function( viewId ) {
		const self = this;
		return self.views[ viewId ] || false;
	}
	
	ns.Application.prototype.removeView = function( viewId ) {
		const self = this;
		const view = self.views[ viewId ];
		if ( !view )
			return;
		
		self.release( viewId );
		delete self.views[ viewId ];
		self.viewIds = Object.keys( self.views );
	}
	
	ns.Application.prototype.setFragments = function( fragStr ) {
		const self = this;
		self.fragments = fragStr;
	}
	
	ns.Application.prototype.setLocale = async function( locale ) {
		const self = this;
		locale = locale || self.locale;
		const localeFile = locale + '.lang';
		const path = 'Progdir:locale/' + localeFile;
		let file = null;
		try {
			file = await self.loadFile( path );
		} catch( ex ) {
			console.log( 'App.setLocale, failed to load file', ex );
			return false;
		}
		
		if ( !file ) {
			return false;
		}
			
		if ( 0 === file.indexOf( '<!DOC')) {
			console.log( 'no file for locale', {
				locale : localeFile,
				file    : file,
			});
			self.locale = 'en';
			self.setLocale( null, callback );
			return false;
		}
		
		parseTranslations( file );
		
		return true;
		
		function parseTranslations( file ) {
			const lines = file.split( '\n' );
			const onlyValid = lines.filter( cleanLines );
			const translations = {};
			onlyValid.forEach( setKeyValue );
			self.translations = translations;
			
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
		if ( !callback )
			return null;
		
		delete self.callbacks[ id ];
		return callback;
	}
	
	ns.Application.prototype.cancelCallback = function( cbId, error ) {
		const self = this;
		const cb = self.callbacks[ cbId ];
		delete self.callbacks[ cbId ];
		if ( null == cb )
			return;
		
		if ( null == error )
			return;
		
		cb( error, null );
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
	
	ns.Application.prototype.testAllowPlaySounds = async function() {
		const self = this;
		const test = new api.PlaySound();
		await test.initialize( 'webclient/apps/FriendChat/res/honkies.wav' );
		const success = await doTest( test );
		test.close();
		
		return success;
		
		async function doTest( test ) {
			return new Promise(( resolve, reject ) => {
				window.setTimeout( doTest, 5000 );
				async function doTest() {
					let success = false;
					try {
						success = await test.play();
					} catch( ex ) {
						console.log( 'testAllowPlaySounds play ex', ex );
						resolve( false );
					}
					
					resolve( true );
				}
			});
		}
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
	
	ns.File.prototype.expose = function( roomId ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const libConf = {
				functionName : 'file/expose',
				args : {
					path         : self.path,
					externalid   : roomId ? roomId : undefined,
					visibility   : roomId ? 'Presence' : undefined,
				},
				onSuccess : success,
				onError   : err,
			};
			console.log( 'libconf', libConf );
			const lib = new api.Library( libConf );
			function success( res ) {
				self.exposeHash = res.hash;
				self.name = res.name;
				const link = self.getPublicLink();
				resolve( link );
			}
			function err( res ) {
				console.log( 'File.expose.err', res );
				reject( false );
			}
		});
	}
	
	ns.File.prototype.unshare = function( callback ) {
		const self = this;
		console.log( 'File.unshare - NYI', self.path );
	}
	
	ns.File.prototype.getPublicLink = function() {
		const self = this;
		if ( !self.exposeHash || !self.name )
			return null;
		
		let link = window.Application.domain 
			+ '/sharedfile/' 
			+ self.exposeHash 
			+ '/' + self.name;
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
	};
	
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
		var callbackId = self.app.setCallback( callBackWrap );
		self.send({
			method     : 'getDoors',
			callbackId : callbackId,
		});
		
		function callBackWrap( msg ) {
			for ( var infoKey in msg )
				self.setupProxyDoor( msg[ infoKey ] );
			if ( callback )
				callback( msg );
		}
	}
	
	ns.Dormant.prototype.handleMessage = function( msg ) {
		const self = this;
		var handler = self.methodMap[ msg.method ];
		if ( !handler ) {
			console.log( 'Dormant.handleMessage - no handler for', msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.Dormant.prototype.handleGetDirectory = function( msg ) {
		const self = this;
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
	
	ns.Dormant.prototype.sendEvent = function( eventObj ) {
		const self = this;
		eventObj.method = 'emit';
		self.send( eventObj );
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
		self.title = conf.title; // aka base of dir. <this>:foo/bar/
		self.basePath = null;
		self.baseRX = null;
		self.dirs = {};
		
		self.doorId = null; // set by dormant
		
		self.init();
	};
	
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
				d    : dir,
				dirs : self.dirs,
				pP   : dir.parentPath,
				p    : dir.fullPath,
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
				lookup : item.parentPath,
				dirs   : self.dirs,
			});
			return;
		}
		
		//console.log( 'addFun', item );
		dir.funs[ item.title ] = item;
		dir.items.push( item );
	}
	
	ns.Door.prototype.addEvent = function( item ) {
		const self = this;
		item.parentPath = self.normalizePath( item.parentPath );
		item.fullPath = self.normalizePath( item.fullPath );
		item.send = sendFn;
		const dir = self.dirs[ item.parentPath ];
		if ( !dir ) {
			console.log( 'Dormant / Door.addEvent - no dir',{
				item   : item,
				lookup : item.parentPath,
				dirs   : self.dirs,
			});
			return;
		}
		
		dir.events[ item.title ] = item;
		dir.items.push( item );
		
		function sendFn( event ) {
			event.doorId = self.doorId;
			friend.Dormant.sendEvent( event );
		}
	}
	
	ns.Door.prototype.remove = function( dir ) {
		const self = this;
		let path = dir.fullPath;
		let target = self.dirs[ path ];
		let parent = self.dirs[ dir.parentPath ];
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
		
		//let path = self.normalizePath( 'Functions/' );
		const path = self.normalizePath( fnPath );
		const parent = self.dirs[ path ];
		const fun = parent.funs[ event.dormantCommand ];
		if ( !fun ) {
			console.log( 'no fun for', event );
			callback( 'ERR_DORMANT_NO_FUN_DOOR', null );
			return;
		}
		
		if ( !fun.execute || !fun.execute.apply ) {
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
	self.iconClass = conf.icon || 'Directory';
	self.type = 'Directory';
	self.fileName = conf.path;
	self.metaType = 'Directory';
	self.fileSize = 4096;
	api.DoorItem.call( self, conf, parentPath );
	
	self.items = [];
	self.funs = {};
	self.events = {};
	
	self.init();
};

api.DoorDir.prototype = Object.create( api.DoorItem.prototype );

// Public

api.DoorDir.prototype.close = function() {
	const self = this;
	self.funs = null;
	self.events = null;
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
	
}

//
// event in dormant
//
api.DoorEvent = function( conf, parentPath ) {
	const self = this;
	self.type = 'DormantEvent';
	self.metaType = 'Meta';
	self.iconClass = conf.icon || 'File';
	self.fileSize = 1337;
	
	api.DoorItem.call( self, conf, parentPath );
};

api.DoorEvent.prototype = Object.create( api.DoorItem.prototype );

api.DoorEvent.prototype.emit = function( data ) {
	const self = this;
	const event = {
		path : self.fullPath + self.title,
		data : data,
	};
	self.send( event );
}

api.DoorEvent.prototype.close = function() {
	// TODO send event to workspace that the event has been removed, i guess
}

api.DoorEvent.prototype.init = function() {
	const self = this;
};

//
// file in Dormant dir
//
// NYI

// PlaySound
(function( ns, undefined ) {
	ns.PlaySound = function( filePath ) {
		if ( !( this instanceof ns.PlaySound ))
			return new ns.PlaySound( filePath );
		
		const self = this;
		self.path = filePath;
		self.actx = null;
		self.fileBuffer = null;
		self.source = null;
		
		self.init();
	};
	
	ns.PlaySound.prototype.initialize = async function( path ) {
		const self = this;
		self.path = path;
		return await self.setup();
	}
	
	ns.PlaySound.prototype.play = async function() {
		const self = this;
		if ( !self.fileBuffer ) {
			return;
		}
		if ( self.source )
			return;
		
		try {
			await play();
		} catch( ex ) {
			console.log( 'PlaySound.play ex', ex );
			return false;
		}
		
		return true;
		
		function play() {
			return new Promise(( resolve, reject ) => {
				const source = self.actx.createBufferSource();
				self.source = source;
				source.buffer = self.fileBuffer;
				source.connect( self.actx.destination );
				source.start();
				source.addEventListener( 'ended', onEnd );
				function onEnd( e ) {
					//console.log( 'onEnd', e );
					self.source = null;
					resolve( true );
				}
			});
		}
	}
	
	ns.PlaySound.prototype.close = function() {
		const self = this;
		if ( self.source ) {
			try {
				self.source.stop();
			} catch( ex ) {
				console.log( 'PlaySound.close - source.stop ex', ex );
			}
			
			self.source = null;
		}
		
		if ( self.actx ) {
			try {
				self.actx.close();
			} catch( ex ) {
				console.log( 'PlaySound.close  - actx.close ex', ex );
			}
			
			self.actx = null;
		}
	}
	
	ns.PlaySound.prototype.init = function() {
		const self = this;
		if ( null == self.path )
			return;
		else
			self.setup();
	}
	
	ns.PlaySound.prototype.setup = async function() {
		const self = this;
		const file = await self.loadFile();
		if ( !file )
			return;
		
		if ( !window.AudioContext )
			return;
		
		self.actx = new window.AudioContext();
		let buff = null;
		try {
			buff = await self.actx.decodeAudioData( file );
		} catch ( ex ) {
			console.log( 'api.PlaySound.init - decodaeAudioData derped', ex );
			return false;
		}
		
		//console.log( 'buff', buff );
		self.fileBuffer = buff;
		return true;
		
		function decoded( buff ) {
			self.fileBuffer = buff;
		}
		
		function wellShit( err ) {
			console.log( 'wellShit', err );
		}
	}
	
	ns.PlaySound.prototype.loadFile = async function() {
		const self = this;
		return await load();
		
		function load() {
			return new Promise(( resolve, reject ) => {
				var req = new XMLHttpRequest();
				//console.log( 'load', self.path );
				req.open( 'GET', self.path, true );
				req.responseType = 'arraybuffer';
				req.onload = loaded;
				req.send();
				
				function loaded( res ) {
					if ( 200 !== req.status ) {
						resolve( null );
						return;
					}
					
					resolve( req.response );
				}
			});
		}
	}
	
})( api );


// IncommingCall
(function( ns, undefined ) {
	ns.IncommingCall = function( ringTones ) {
		const self = this;
		if ( null == ringTones )
			console.log( 'IncommingCall - no ringtones?' );
		
		self.ringTones = ringTones;
		
		self.defaultRing = 'default';
		self.calls = {};
		
		self.init();
	}
	
	/*
	ns.IncommingCall.prototype.ringTones = {
		'default' : {
			r       : 'webclient/apps/FriendChat/res/Ring.ogg',
			pattern : 'rrr__',
			loops   : 0,
		},
		'levans_pop' : {
			d       : 'webclient/apps/FriendChat/res/levans_pop.webm',
			pattern : 'd',
			loops   : 0,
		},
		'popcat' : {
			p       : 'webclient/apps/FriendChat/res/pop_cat.mp3',
			pattern : 'pp____',
			loops   : 2,
		},
	}
	*/
	
	// Public
	
	ns.IncommingCall.prototype.showCall = function( id, identity, ringTone ) {
		const self = this;
		if ( null != self.calls[ id ]) {
			console.log( ' IncommingCall.showCall - already active', {
				id    : id,
				calls : self.calls,
			});
			return;
		}
		
		if ( null == self.ringTones[ ringTone ])
			ringTone = self.defaultRing;
		
		const call = {
			id       : id,
			identity : identity,
			ringTone : ringTone,
		};
		self.calls[ id ] = call;
		self.start( id );
	}
	
	ns.IncommingCall.prototype.hideCall = function( id ) {
		const self = this;
		self.stop( id );
	}
	
	ns.IncommingCall.prototype.setDefault = function( ringTone ) {
		const self = this;
		console.log( 'setDefault', ringTone );
		const ring = self.ringTones[ ringTone ];
		if ( !ring ) {
			console.log( 'IncommingCall.setDefault - could not find', {
				ringTone  : ringTone,
				available : self.ringTones,
			});
			return;
		}
		
		self.defaultRing = ringTone;
	}
	
	// Pri>ate
	
	ns.IncommingCall.prototype.init = async function() {
		const self = this;
		//let canPlay = await window.application.testAllowPlaySounds();
		
	}
	
	ns.IncommingCall.prototype.start = async function( id ) {
		const self = this;
		const call = self.calls[ id ];
		const ringConf = self.ringTones[ call.ringTone ];
		const pattern = ringConf.pattern;
		const sounds = await soundsFromPattern( ringConf );
		
		call.pIndex = 0;
		call.loops = 0;
		call.playing = getNext( pattern, call.pIndex, sounds );
		call.playing.play()
			.then( played )
			.catch( end );
		
		function played( success ) {
			if ( !success ) {
				end();
				return;
			}
			
			// call has been removed
			if ( null == self.calls[ id ]) {
				//console.log( '1' );
				end();
				return;
			}
			
			if (( null == ringConf.loops ) || ( false === ringConf.loops )) {
				//console.log( '2' );
				end();
				return;
			}
			
			call.pIndex++;
			if ( call.pIndex == pattern.length ) {
				call.pIndex = 0;
				call.loops++;
			}
			
			if (( 0 !== ringConf.loops ) && ( call.loops >= ringConf.loops )) {
				//console.log( 'bummer' );
				end();
				return;
			}
			
			call.playing = getNext( pattern, call.pIndex, sounds );
			if ( null == call.playing ) {
				//console.log( 'wait' );
				doWait()
					.then( played );
			}
			else {
				//console.log( 'play', call.playing );
				call.playing.play()
					.then( played )
					.catch( end );
			}
		}
		
		async function soundsFromPattern( conf ) {
			const p = conf.pattern.split( '' );
			const pile = {};
			const loadings = p.map( id => {
				//console.log( 'loadings', id );
				if ( '_' == id )
					return null;
				
				if ( null != pile[ id ])
					return null;
				
				//console.log( 'build for', id );
				const path = conf[ id ];
				const s = new api.PlaySound();
				pile[ id ] = s;
				return s.initialize( path );
			}).filter( item => !!item );
			
			await Promise.all( loadings );
			//console.log( 'soundsFromPattern', pile );
			return pile;
		}
		
		function getNext( pattern, index, sounds ) {
			//console.log( 'getNext', index );
			const id = pattern[ index ];
			return sounds[ id ] || null;
		}
		
		function doWait() {
			//console.log( 'doWait' );
			return new Promise(( resolve, reject ) => {
				call.waiting = window.setTimeout( waitDone, 250 );
				function waitDone() {
					//console.log( 'waitDone' );
					resolve( true );
				}
			});
		}
		
		function end( asd ) {
			//console.trace( 'end', [ asd, id, call ]);
			self.stopPlaying( id );
		}
	}
	
	ns.IncommingCall.prototype.stop = function( id ) {
		const self = this;
		const call = self.calls[ id ];
		//console.log( 'IncommingCall.stop', call );
		if ( null == call )
			return;
		
		self.stopPlaying( id );
		delete self.calls[ id ];
	}
	
	ns.IncommingCall.prototype.stopPlaying = function( id ) {
		const self = this;
		const call = self.calls[ id ];
		if ( call.playing ) {
			call.playing.close();
			call.playing = null;
		}
		
		if ( call.waiting ) {
			window.clearTimeout( call.waiting );
			call.waiting = null;
		}
		
		call.played = null;
	}
	
})( api );

(function( ns, undefined ) {
	ns.Calendar = function() {
		const self = this;
		self.init();
	}
	
	ns.Calendar.prototype.addEvent = function( conf, messageToUser, callback ) {
		const self = this;
		const event = {
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
				onSuccess : onSuccess,
				onError   : onError,
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
