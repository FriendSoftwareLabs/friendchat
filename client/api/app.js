'use strict';

/*©agpl*************************************************************************
*                                                                              *
* Friend Unifying Platform                                                     *
* ------------------------                                                     *
*                                                                              *
* Copyright 2014-2016 Friend Software Labs AS, all rights reserved.            *
* Hillevaagsveien 14, 4016 Stavanger, Norway                                   *
* Tel.: (+47) 40 72 96 56                                                      *
* Mail: info@friendos.com                                                      *
*                                                                              *
*****************************************************************************©*/

var friendUP = window.friendUP || {};
var api = window.api || {}; // use stuff on this object
var fupLocal = {}; // internals
var friend = window.friend || {}; // already instanced stuff

// add friendUP api
(function() {
	var scripts = [
		//'utils/engine.js',
		//'utils/events.js',
		'utils/tool.js',
		'io/request.js',
	];
	
	var path = '/webclient/js/';
	var pathArr = scripts.map( setPath );
	var scriptPath = pathArr.join( ';' );
	var script = document.createElement( 'script' );
	script.type = 'text/javascript';
	script.src = scriptPath;
	script.onload = function( event ) { console.log( 'script loaded', event ); }
	document.head.appendChild( script );
	
	function setPath( script ) { return path + script; }
})();

// View
// an interface for views, new it
(function( ns, undefined )
{
	ns.View = function(
		htmlPath,
		windowConf,
		initData,
		eventsink,
		onclose
	) {
		if ( !( this instanceof ns.View ))
			return new ns.View(
				htmlPath,
				windowConf,
				initData,
				eventsink,
				onclose
			);
		
		const self = this;
		EventEmitter.call( self, eventsink );
		
		self.path = htmlPath;
		self.windowConf = windowConf || {};
		self.initData = initData;
		self.onclose = onclose;
		self.id = self.windowConf.id || friendUP.tool.uid( 'view' );
		self.eventQueue = [];
		self.app = window.Application;
		
		self.initView();
	}
	
	ns.View.prototype = Object.create( EventEmitter.prototype );
	
	ns.View.prototype.initView = function() {
		var self = this;
		var windowConf = self.windowConf;
		var callbackId = self.app.setCallback( viewCreate )
		if ( self.app.screen )
			windowConf.screen = self.app.screen.id;
		
		if ( self.app.translations ) {
			windowConf.viewConf = windowConf.viewConf || {};
			windowConf.viewConf.translations = self.app.translations;
		}
		
		self.app.on( self.id, viewMessage );
		self.app.sendMessage({
			type : 'view',
			viewId : self.id,
			id : callbackId,
			data : windowConf,
		});
		
		self.on( 'loaded', loaded );
		self.on( 'ready', ready );
		
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
		
		function viewMessage( msg ) {
			self.emit( msg.type, msg.data );
		}
		function loaded( e ) { self.handleLoaded( e ); }
		function ready( e ) { self.handleReady( e ); }
	}
	
	ns.View.prototype.setContentUrl = function( htmlPath ) {
		var self = this;
		var msg = {
			method : 'setRichContentUrl',
			url : self.app.filePath + htmlPath,
			base : self.app.filePath,
			filePath : self.app.filePath,
			opts : {},
			
		};
		
		if ( self.windowConf.viewTheme )
			msg.opts.viewTheme = self.windowConf.viewTheme;
		
		self.send( msg );
	}
	
	ns.View.prototype.setMenuItems = function( data ) {
		var self = this;
		var msg = {
			method : 'setMenuItems',
			data : data,
		};
		self.send( msg );
	}
	
	ns.View.prototype.setTitle = function( title ) {
		var self = this;
		self.setFlag( 'title', title );
	}
	
	ns.View.prototype.setFlag = function( flag, value ) {
		var self = this;
		var msg = {
			method : 'setFlag',
			data   : {
				flag  : flag,
				value : value,
			},
		};
		self.send( msg );
	}
	
	ns.View.prototype.getFlag = function( flag, callback ) {
		var self = this;
		var cid = self.app.setCallback( callback );
		var msg = {
			method   : 'getFlag',
			callback : cid,
			data     : {
				flag : flag,
			},
		};
		self.send( msg );
	}
	
	ns.View.prototype.setViewTheme = function( filepath ) {
		var self = this;
		var msg = {
			type : 'set',
			data : filepath,
		};
		self.sendViewTheme( msg );
	}
	
	ns.View.prototype.removeViewTheme = function() {
		var self = this;
		var msg = {
			type : 'remove',
		};
		self.sendViewTheme( msg );
	}
	
	ns.View.prototype.sendViewTheme = function( msg ) {
		var self = this;
		var wrap = {
			command : 'viewtheme',
			data : msg,
		};
		self.sendMessage( wrap, true );
	}
	
	ns.View.prototype.activate = function() {
		var self = this;
		var activate = {
			method : 'activate',
		};
		self.send( activate );
	}
	
	ns.View.prototype.showFiledialog = function( conf, callback )
	{
		/* conf:
		dialogType, ( 'open' default )
		path,
		filename,
		title,
		*/
		var self = this;
		if ( !conf || !callback ) {
			console.log( 'showFileDialog - missing conf and / or callback' );
			return;
		}
		
		var cid = self.app.setCallback( callback );
		
		var filedialog = {
			type : 'system',
			command : 'filedialog',
			method : 'open',
			dialogType : conf.dialogType || 'open',
			path : conf.path,
			filename : conf.filename,
			title : conf.title,
			viewId : self.id,
			callbackId : cid,
		};
		
		self.app.sendMessage( filedialog );
	}
	
	ns.View.prototype.handleLoaded = function( e ) {
		const self = this;
		console.log( 'handleLoaded', e );
		self.sendMessage({
			type : 'initialize',
			data : self.initData,
		}, true );
		
		if ( self.onload ) {
			self.onload( e || true );
			return;
		}
	}
	
	ns.View.prototype.handleReady = function( e ) {
		const self = this;
		console.log( 'handleReady', e );
		self.ready = true;
		self.sendEventQueue();
		if ( self.onready ) {
			self.onready( e || true );
			return;
		}
	}
	
	ns.View.prototype.doClose = function() {
		const self = this;
		console.log( 'View.doClose', self );
		self.ready = false;
		var onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose( true );
		
		self.close();
	}
	
	ns.View.prototype.close = function() {
		var self = this;
		console.log( 'View.close', self );
		if ( !self.app )
			return;
		
		self.app.removeView( self.id );
		var msg = {
			method : 'close',
		};
		self.send( msg );
		
		self.closeEventEmitter();
		delete self.onclose;
		delete self.app;
		delete self.eventQueue;
	}
	
	ns.View.prototype.queueEvent = function( event ) {
		const self = this;
		if ( !self.eventQueue )
			return;
		
		self.eventQueue.push( event );
	}
	
	ns.View.prototype.sendEventQueue = function() {
		const self = this;
		self.eventQueue.forEach( send );
		self.eventQueue = [];
		function send( event ) {
			console.log( 'sendEventQueue', event );
			self.sendMessage( event );
		}
	}
	
	ns.View.prototype.sendMessage = function( event, force ) {
		const self = this;
		if ( !self.ready && !force ) {
			self.queueEvent( event );
			return;
		}
		
		var wrap = {
			method : 'sendMessage',
			data : event
		};
		
		self.send( wrap );
	}
	
	ns.View.prototype.send = function( msg ) {
		var self = this;
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
		
		var self = this;
		self.title = title;
		
		self.app = window.Application;
		
		self.init();
	}
	
	// Public
	
	// Private
	
	ns.Screen.prototype.init = function() {
		var self = this;
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
		var self = this;
		msg.type = 'screen';
		msg.screenId = self.id;
		self.app.sendMessage( msg );
	}
})( api );


// MODULE
(function( ns, undefined ) {
	ns.Module = function( conf )
	{
		var self = this;
		self.success = conf.success;
		self.error = conf.error;
		
		self.id = friendUP.tool.uid;
		self.app = window.Application;
		
		self.init( conf );
	}
	
	ns.Module.prototype.init = function( conf )
	{
		var self = this;
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
		var self = this;
		msg.type = 'module';
		self.app.sendMessage( msg );
	}
})( api );


// LIBRARY
(function( ns, undefined ) {
	ns.Library = function( conf ) {
		if ( !( this instanceof ns.Library ))
			return new ns.Library( conf );
		
		var self = this;
		self.name = conf.name || 'system.library';
		self.func = conf.functionName;
		self.args = conf.args || {};
		self.onsuccess= conf.onsuccess;
		self.onerror = conf.onerror;
		
		self.app = window.Application;
		self.init();
	}
	
	ns.Library.prototype.init = function() {
		var self = this;
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
		var self = this;
		var success = res.ok;
		if ( success )
			self.onsuccess( res.data );
		else
			self.onerror( res.error );
	}
	
	ns.Library.prototype.send = function( msg ) {
		var self = this;
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
		
		var self = this;
		EventEmitter.call( self, unhandledEvent );
		self.subscriber = {};
		self.commandMap = null;
		
		self.initAppEvent();
		
		function unhandledEvent( type, data ) {
			console.log( 'unhandledEvent', {
				type : type,
				data : data,
			});
			self.receiveMessage( data );
		}
	}
	
	ns.AppEvent.prototype = Object.create( EventEmitter.prototype );
	
	ns.AppEvent.prototype.initAppEvent = function() {
		var self = this;
		self.commandMap = {
			'door' : door,
			'filedialog' : filedialog,
			'fileload' : fileload,
			'initappframe' : initialize,
			'notify' : notify,
			'register' : register,
			'viewresponse' : viewResponse,
			'dormantmaster' : dormantMaster,
			'applicationstorage' : storage,
			'libraryresponse' : libResponse,
			'refreshtheme' : refreshTheme,
			'quit' : quit,
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
		function quit( e ) { self.quit(); }
		
		self.notifyMap = {
			'closeview'   : closeView,
			'setviewflag' : setViewFlag,
		}
		
		function closeView( msg ) { self.closeView( msg ); }
		function setViewFlag( e ) { self.setViewFlag( e ); }
		
		window.addEventListener( 'message', receiveEvent, false );
		function receiveEvent( e ) { self.receiveEvent( e ); }
	}
	
	ns.AppEvent.prototype.receiveEvent = function( e ) {
		var self = this;
		var msg = friendUP.tool.parse( e.data );
		if ( !msg ) {
			console.log( 'app.receiveEvent - no msg for event', e );
			return;
		}
		
		msg.origin = e.origin;
		
		var handler = self.commandMap[ msg.command ];
		if ( handler ) {
			handler( msg );
			return;
		}
		
		if ( msg.callback || msg.clickcallback ) {
			var yep = self.handleCallback( msg );
			if ( yep )
				return;
		}
		
		self.appMessage( msg );
	}
	
	ns.AppEvent.prototype.handleCallback = function( msg ) {
		var self = this;
		console.log( 'app.handleCallback', msg );
		var cid = msg.callback || msg.clickcallback;
		var callback = self.getCallback( cid );
		if ( !callback )
			return false;
		
		callback( msg );
		return true;
	}
	
	ns.AppEvent.prototype.appMessage = function( msg ) {
		var self = this;
		const type = msg.command || msg.callback || msg.viewId;
		self.emit( type, msg.data );
	}
	
	ns.AppEvent.prototype.handleFiledialog = function( msg ) {
		var self = this;
		var callback = self.getCallback( msg.callbackId );
		if ( !callback ) {
			console.log( 'handleFileDialog - no callback found for', msg );
			return;
		}
		
		callback( msg.data );
	}
	
	ns.AppEvent.prototype.fileLoad = function( msg ) {
		var self = this;
		var handler = self.getCallback( msg.fileId );
		
		if ( !handler ) {
			console.log( 'appEvent.fileLoad - no handler for event, passing to receiveMessage ', msg );
			self.receiveMessage( msg );
			return;
		}
		
		//console.log( 'fileload res', msg );
		
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
		var self = this;
		var handler = self.getCallback( msg.viewId );
		
		if ( !handler ) {
			console.log( 'appEvent.viewResponse - no handler for event, passing to receiveMessage', msg );
			self.receiveMessage( msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.AppEvent.prototype.dormantMaster = function( msg ) {
		var self = this;
		//console.log( 'app.js - dormantmaster event', msg );
		if ( !friend.Dormant ) {
			console.log( 'app.dormantmaster - window.Dormant not defined' );
			return;
		}
		
		friend.Dormant.handleMessage( msg );
	}
	
	ns.AppEvent.prototype.storage = function( msg ) {
		var self = this;
		console.log( 'app.storage event', msg );
		var callback = self.getCallback( msg.callbackId );
		if ( !callback ) {
			console.log( 'storage - no callback found for', msg );
			return;
		}
		
		callback( msg.data );
	}
	
	ns.AppEvent.prototype.handleLibResponse = function( msg ) {
		var self = this;
		console.log( 'handleLibResponse', msg );
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
		var self = this;
		var vIds = Object.keys( self.views );
		vIds.forEach( sendTheme );
		function sendTheme( vId ) {
			var view = self.views[ vId ];
			var cmd = {
				command : 'refreshtheme',
				theme : msg.theme,
			};
			view.sendMessage( cmd );
		}
		
	}
	
	ns.AppEvent.prototype.register = function( msg ) {
		var self = this;
		console.log( 'register', msg );
		window.origin = msg.origin;
		self.domain = msg.domain;
		self.locale = msg.locale;
		self.filePath = msg.filePath;
		self.id = msg.applicationId;
		self.userId = msg.userId;
		self.authId = msg.authId;
		
		self.setLocale( null, setBack );
		
		function setBack() {
			console.log( 'setLocaleBack' );
			self.registered( msg );
			self.initialize( msg );
		}
	}
	
	ns.AppEvent.prototype.registered = function( data ) {
		var self = this;
		var msg = {
			type : 'notify',
			data : 'registered',
			registerCallback : data.registerCallback,
		};
		self.sendMessage( msg );
	}
	
	ns.AppEvent.prototype.handleNotify = function( msg ) {
		var self = this;
		var handler = self.notifyMap[ msg.method ];
		
		if ( !handler ) {
			console.log( 'app.AppEvent.notify - no handler for ', msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.AppEvent.prototype.closeView = function( msg ) {
		var self = this;
		console.log( 'closeView', msg );
		const viewId = msg.viewId;
		var view = self.getView( viewId );
		if ( !view )
			return;
		
		view.doClose();
	}
	
	ns.AppEvent.prototype.setViewFlag = function( msg ) {
		var self = this;
		console.log( 'setViewFlag', msg );
		
		if ( 'minimized' !== msg.flag )
			return;
		
		var view = self.views[ msg.viewId ];
		view.isMinimized = msg.value;
	}
	
	ns.AppEvent.prototype.initialize = function( msg ) {
		var self = this;
		setBase( msg.base || msg.domain );
		self.run( msg.args );
		
		function setBase( basePath )
		{
			var base = document.createElement( 'base' );
			base.href = basePath;
			document.head.appendChild( base );
		}
	}
	
})( fupLocal );


// Application
(function( ns, undefined )
{
	ns.Application = function()
	{
		if ( !( this instanceof ns.Application ))
			return new ns.Application();
		
		fupLocal.AppEvent.call( this );
		
		var self = this;
		self.id = null; // set by register event
		self.userId = null; // ^^^
		self.authId = null; // ^^^
		self.callbacks = {};
		self.views = {};
	}
	
	ns.Application.prototype = Object.create( fupLocal.AppEvent.prototype );
	
	ns.Application.prototype.createView = function(
		path,
		conf,
		initData,
		eventsink,
		onclose
	) {
		var self = this;
		var view = new api.View(
			path,
			conf,
			initData,
			eventsink,
			onclose
		);
		return view;
	}
	
	ns.Application.prototype.loadFile = function( path, loadCallback, vars ) {
		var self = this;
		if ( !path || !loadCallback ) {
			console.log( 'Application.loadFile: invalid arguments',
				{ path : path, callback : loadCallback });
			return;
		}
		
		var fid = self.setCallback( loadCallback );
		self.sendMessage({
			type : 'file',
			method : 'load',
			data : { path: path },
			filePath: self.filePath,
			vars : vars || [],
			fileId : fid,
		});
	}
	
	ns.Application.prototype.executeModule = function()
	{
		var self = this;
		console.log( 'Application.executeModule - NYI' );
	}
	
	ns.Application.prototype.postOut = function( msg ) {
		var self = this;
		var msg = {
			type : 'postout',
			data : msg,
		};
		self.sendMessage( msg );
	}
	
	ns.Application.prototype.notify = function( conf ) {
		var self = this;
		var cid = self.setCallback( conf.callback );
		var ccid = self.setCallback( conf.clickCallback );
		var msg = {
			type          : 'system',
			command       : 'notification',
			title         : conf.title,
			text          : conf.text,
			callback      : cid,
			clickcallback : ccid,
		}
		self.sendMessage( msg );
	}
	
	ns.Application.prototype.sendMessage = function( msg, callback )
	{
		var self = this;
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
	ns.Application.prototype.close = function()
	{
		var self = this;
		var viewIds = Object.keys( self.views );
		viewIds.forEach( callClose );
		function callClose( viewId ) {
			var view = self.views[ viewId ];
			if ( !view || !view.close )
				return;
				
			view.close();
		}
	}
	
	ns.Application.prototype.quit = function()
	{
		var self = this;
		self.close();
		self.sendMessage({
			type : 'system',
			command : 'quit',
			force : 'true',
		});
	}
	
	ns.Application.prototype.addView = function( view )
	{
		var self = this;
		self.views[ view.id ] = view;
	}
	
	ns.Application.prototype.getView = function( viewId )
	{
		var self = this;
		return self.views[ viewId ] || false;
	}
	
	ns.Application.prototype.removeView = function( viewId )
	{
		var self = this;
		var view = self.views[ viewId ];
		console.log( 'App.removeView', viewId );
		if ( !view )
			return;
		
		self.release( viewId );
		delete self.views[ viewId ];
	}
	
	ns.Application.prototype.setLocale = function( locale, callback ) {
		const self = this;
		locale = locale || self.locale;
		const localeFile = locale + '.lang';
		const path = 'Progdir:locale/' + localeFile;
		console.log( 'setLocale', {
			l : self.locale,
			f : localeFile,
			p : path,
		});
		
		self.loadFile( path, fileBack );
		
		function fileBack( res ) {
			console.log( 'locale load back', res );
			if ( !res ) {
				callback( false );
				return;
			}
			
			const lines = res.split( '\n' );
			//console.log( 'lines', lines );
			onlyValid = lines.filter( cleanLines );
			//console.log( 'onlyValid', onlyValid );
			const translations = {};
			onlyValid.forEach( setKeyValue );
			self.translations = translations;
			console.log( 'translations', self.translations );
			callback( true );
			
			function setKeyValue( line ) {
				let parts = line.split( ':' );
				//console.log( 'parts', parts );
				translations[ parts[ 0 ].trim() ] = parts[ 1 ].trim();
			}
			
			function cleanLines( line ) {
				console.log( 'cleanLines', line );
				if ( !line || !line.trim )
					return false;
				
				line = line.trim();
				if ( !line || !line.length )
					return false;
				
				return '#' !== line[0];
			}
		}
	}
	
	ns.Application.prototype.receiveMessage = function( e )
	{
		var self = this;
		console.log( 'Application.receiveMessage - reimplement this one to receive messages in your application', e );
	}
	
	ns.Application.prototype.setCallback = function( callback )
	{
		var self = this;
		var id = friendUP.tool.uid( 'callback' );
		self.callbacks[ id ] = callback;
		
		return id;
	}
	
	ns.Application.prototype.getCallback = function( id )
	{
		var self = this;
		var callback = self.callbacks[ id ];
		
		if ( !callback )
			return null;
		
		delete self.callbacks[ id ];
		return callback;
	}
	
	// Get a translated string
	ns.Application.prototype.i18n = function( string )
	{
		if( this.translations && this.translations[string] )
			return this.translations[string];
		return string;
	}
	
	// Search and execute replacements in string
	ns.Application.prototype.i18nReplaceInString = function( str )
	{
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
	
})( fupLocal );

window.Application = new fupLocal.Application();


// Storage
(function( ns, undefined )
{
	ns.ApplicationStorage = {
		app : window.Application,
	};
	var self = ns.ApplicationStorage;
	
	ns.ApplicationStorage.set = function( id, data, callback )
	{
		var bundle = {
			id : id,
			data : data,
		};
		var msg = {
			method : 'set',
			data : bundle,
		};
		self.s( msg, callback );
	};
	
	ns.ApplicationStorage.get = function( id, callback )
	{
		var msg = {
			method : 'get',
			data : {
				id : id,
			},
			
		};
		self.s( msg, callback );
	};
	
	ns.ApplicationStorage.remove = function( id, callback )
	{
		var msg = {
			method : 'remove',
			data : {
				id : id,
			},
		};
		self.s( msg, callback );
	}
	
	ns.ApplicationStorage.s = function( msg, callback )
	{
		if ( callback ) {
			var callbackId = self.app.setCallback( callback );
			msg.callbackId = callbackId;
		};
		
		msg.type = 'applicationstorage';
		self.app.sendMessage( msg );
	};
	
})( api );


// Dormant
(function( ns, undefined ) {
	ns.Dormant = function() {
		var self = this;
		self.doors = {},
		self.doorIds = [],
		self.app = window.Application,
		
		self.init();
	}
	
	ns.Dormant.prototype.init = function() {
		var self = this;
		self.methodMap = {
			'getdirectory' : getDirectory,
			'updatetitle' : updateTitle,
			'execute' : execute,
			'callback' : callback,
		};
		
		function getDirectory( e ) { self.handleGetDirectory( e ); }
		function updateTitle( e ) { self.handleUpdateTitle( e ); }
		function execute( e ) { self.handleExecute( e ); }
		function callback( e ) { self.handleCallback( e ); }
	}
	
	ns.Dormant.prototype.add = function( door ) {
		var self = this;
		var doorId = self.set( door );
		var msg = {
			method : 'addAppDoor',
			title  : door.title,
			doorId : doorId,
		};
		self.send( msg );
	}
	
	ns.Dormant.prototype.setupProxy = function( info ) {
		var self = this;
		console.log( 'setupProxyDoor - NYI', info );
	}
	
	ns.Dormant.prototype.getDoors = function( callback ) {
		var self = this;
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
		var self = this;
		//console.log( 'Dormant.handleMessage', msg );
		var handler = self.methodMap[ msg.method ];
		if ( !handler ) {
			console.log( 'Dormant.handleMessage - no handler for', msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.Dormant.prototype.handleGetDirectory = function( msg ) {
		var self = this;
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
		self.sendBack( dir, msg );
	}
	
	ns.Dormant.prototype.handleUpdateTitle = function( msg ) {
		var self = this;
		//console.log( 'handleUpdateTitle', msg );
		var door = self.doors[ msg.doorId ];
		if ( !door ) {
			console.log( 'Doormant - no door for', { m : msg, d : self.doors });
			return;
		}
		
		door.title = msg.realtitle;
	}
	
	ns.Dormant.prototype.handleExecute = function( event ) {
		var self = this;
		const door = self.doors[ event.doorId ];
		if ( !door ) {
			console.log( 'handleExecute - no door', { e : event, self : self });
			return;
		}
		
		const data = door.execute( event );
		/*
		console.log( 'handleExecute, data', {
			event : event,
			door : door,
			data : data,
		});
		*/
		self.sendBack( data, event );
	}
	
	ns.Dormant.prototype.handleCallback = function( msg ) {
		var self = this;
		console.log( 'handleCallback', msg );
	}
	
	ns.Dormant.prototype.set = function( doorObj ) {
		var self = this;
		//console.log( 'setDoor', doorObj );
		var doorId = friendUP.tool.uid( 'door' );
		doorObj.doorId = doorId;
		self.doors[ doorId ] = doorObj;
		return doorId;
	}
	
	ns.Dormant.prototype.get = function( doorId ) {
		var self = this;
		//console.log( 'getDoor', doorId );
		return self.doors[ doorId ];
	}
	
	ns.Dormant.prototype.remove = function( doorId ) {
		var self = this;
		if ( self.doors[ doorId ])
			delete self.doors[ doorId ];
	}
	
	ns.Dormant.prototype.sendBack = function( data, event ) {
		var self = this;
		var msg = {
			method : 'callback',
			callbackId : event.callbackId,
			doorId : event.doorId,
			data : data,
		};
		//console.log( 'Dormant.sendBack', msg );
		self.send( msg );
	}
	
	ns.Dormant.prototype.send = function( msg ) {
		var self = this;
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
		
		var self = this;
		self.title = conf.title, // aka base of dir. <this>:foo/bar/
		self.basePath = null;
		self.baseRX = null;
		self.dirs = {};
		
		self.doorId = null; // set by dormant
		
		self.init();
	}
	
	ns.Door.prototype.getDirectory = function( msg ) {
		var self = this;
		//const path = self.normalizePath( msg.path );
		//console.log( 'getDirectory', msg );
		const dir = self.dirs[ msg.path ];
		if ( !dir ) {
			console.log( 'Dormant / Door.getDirectory - no dir found', {
				msg  : msg,
				dirs : self.dirs,
			});
			return;
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
	
	ns.Door.prototype.execute = function( event ) {
		const self = this;
		const fnName = event.dormantCommand;
		const fnArgs = event.dormantArgs;
		/*
		console.log( 'Dormant / Door.execute', {
			e : event,
			name : fnName,
			args : fnArgs,
			dirs : self.dirs
		});
		*/
		
		let path = self.normalizePath( 'Functions/' );
		//path = self.normalizePath( path );
		const parent = self.dirs[ path ];
		const fun = parent.funs[ event.dormantCommand ];
		if ( !fun ) {
			console.log( 'no fun for', event );
			return null;
		}
		
		//console.log( 'found fun item', fun );
		if ( !fun.execute ) {
			console.log( '..but no funtion to execute', fun );
			return null;
		}
		
		return fun.execute( fnArgs );
	}
	
	ns.Door.prototype.addDir = function( dir ) {
		const self = this;
		//const base = self.setParentDir( dir.Path );
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
	
	ns.Door.prototype.normalizePath = function( path ) {
		const self = this;
		if ( null == path.match( self.baseRX ))
			path = self.basePath + path;
		
		return path;
	}
	
	ns.Door.prototype.init = function() {
		var self = this;
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
	
	self.baseInit();
};

// Public

api.DoorItem.prototype.itemize = function() {
	const self = this;
	const items = [];
	self.items.forEach( serialize );
	//console.log( 'itemize', items );
	return items;
	
	function serialize( item ) {
		const conf = item.serialize();
		items.push( conf );
	}
}

api.DoorItem.prototype.serialize = function() {
	const self = this;
	const conf = {
		MetaType  : self.meta || 'Meta',
		Title     : self.title,
		FileName  : self.title,
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
	self.metaType = 'Directory';
	self.fileSize = 4096;
	api.DoorItem.call( self, conf, parentPath );
	
	self.items = [];
	self.funs = {};
	
	self.init();
};

api.DoorDir.prototype = Object.create( api.DoorItem.prototype );

// Public

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
	self.execute = conf.execute;
	self.iconClass = conf.icon || 'File';
	self.fileSize = 16;
	api.DoorItem.call( self, conf, parentPath );
	
	self.init();
};

api.DoorFun.prototype = Object.create( api.DoorItem.prototype );

// Public

// Private

api.DoorFun.prototype.init = function() {
	const self = this;
	
};

//
// file in Dormant dir


//
// File
(function( ns, undefined ) {
	ns.File = function( path ) {
		if ( !( this instanceof ns.File ))
			return new ns.File( path );
		
		var self = this;
		self.path = path;
		self.name = null;
		self.type = null;
		self.exposeHash = null;
		
		self.init();
	}
	
	ns.File.prototype.init = function() {
		var self = this;
		console.log( 'File.init' );
	}
	
	ns.File.prototype.expose = function( callback ) {
		var self = this;
		console.log( 'File.expose', self.path );
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
			console.log( 'File.expose.success', res );
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
		var self = this;
		console.log( 'File.unshare - NYI', self.path );
	}
	
	ns.File.prototype.getPublicLink = function() {
		var self = this;
		if ( !self.exposeHash || !self.name )
			return null;
		
		var link = window.Application.domain + '/sharedfile/' + self.exposeHash + '/' + self.name;
		link = window.encodeURI( link );
		return link;
	}
})( api );

// SoundAlert
(function( ns, undefined ) {
	ns.SoundAlert = function( filePath ) {
		if ( !( this instanceof ns.SoundAlert ))
			return new ns.SoundAlert( filePath );
		
		var self = this;
		self.path = filePath;
		self.actx = null;
		self.fileBuffer = null;
		self.playTimeout = 1000 * 3;
		self.playTimeoutId = null;
		
		self.init();
	}
	
	ns.SoundAlert.prototype.play = function() {
		var self = this;
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
		var self = this;
		if ( self.actx )
			self.actx.close();
		
		if ( self.playTimeoutId  ) {
			window.clearTimeout( self.playTimeoutId );
			self.playTimeoutId = null;
		}
	}
	
	ns.SoundAlert.prototype.init = function() {
		var self = this;
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
		var self = this;
		var req = new XMLHttpRequest();
		req.open( 'GET', self.path, true );
		req.responseType = 'arraybuffer';
		req.onload = loaded;
		req.send();
		
		function loaded( res ) {
			var self = this;
			if ( 200 !== req.status )
				callback( null );
			
			callback( req.response );
		}
	}
	
})( api );

(function( ns, undefined ) {
	ns.Calendar = function() {
		var self = this;
		self.init();
	}
	
	ns.Calendar.prototype.addEvent = function( conf, messageToUser, callback ) {
		var self = this;
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
		var self = this;
		self.app = window.Application;
	}
	
	ns.Calendar.prototype.send = function( msg ) {
		var self = this;
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
		console.log( 'compress', url );
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
			
		}
		
		function onSuccess( res ) {
			console.log( 'tiny.onSuccess', res );
		}
		
		function onError( err ) {
			console.log( 'tiny.onError', err );
		}
	}
	
	// get the original url from a tiny url, returns a promise
	ns.TinyURL.prototype.expand = function( tinyUrl ) {
		const self = this;
		console.log( 'expand', tinyURL );
	}
	
	// Private
	
	ns.TinyURL.prototype.init = function() {
		const self = this;
		console.log( 'tinyURL init' );
	}
	
})( fupLocal );

friend.tinyURL = new fupLocal.TinyURL();