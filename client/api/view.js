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

var api = api || {};
var friendUP = window.friendUP || {};
var Doors = window.Doors || {};
var friend = window.friend || {};

// ViewEvent
(function( ns, undefined ) {
	ns.ViewEvent = function() {
		if ( !( this instanceof ns.ViewEvent ))
			return new ns.ViewEvent();
		
		const self = this;
		library.component.EventEmitter.call( self, eventSink );
		
		self.listener = {};
		
		self.eventInit();
		
		function eventSink( type, data ) {
			/*
			console.log( 'View.eventSink', {
				type : type,
				data : data,
			});
			*/
		}
	}
	
	ns.ViewEvent.prototype = Object.create( library.component.EventEmitter.prototype );
	
	ns.ViewEvent.prototype.eventInit = function() {
		var self = this;
		self.eventMap = {
			'focus'        : focus,
			'blur'         : blur,
			'initappframe' : initialize,
			'initialize'   : initialize,
			'notify'       : notify,
			'register'     : register,
			'viewtheme'    : viewtheme,
			'refreshtheme' : systemTheme,
			'callback'     : callback
		};
		
		function close( e ) { self.close( e ); }
		function focus( e ) { self.focus( e ); }
		function blur( e ) { self.blur( e ); }
		function initialize( e ) { self.initialize( e ); }
		function notify( e ) { self.notify( e ); }
		function register( e ) { self.register( e ); }
		function viewtheme( e ) { self.handleViewTheme( e ); }
		function systemTheme( e ) { self.handleSystemTheme( e ); }
		function callback( e ) {
			if( e.data && self.callbacks[ e.callback ] ) {
				self.executeCallback( e.callback, e.data );
			}
		};
		
		self.notifyMap = {
			'activateview' : activated,
			'deactivateview' : deactivated,
			'setviewflag' : setViewFlag,
		};
		
		function activated( e ) { self.activated( e ); }
		function deactivated( e ) { self.deactivated( e ); }
		function setViewFlag( e ) { self.handleViewFlag( e ); }
		
		window.addEventListener( 'message', receiveEvent, false );
		function receiveEvent( e ) { self.receiveEvent( e ); }
	}
	
	ns.ViewEvent.prototype.receiveEvent = function( e ) {
		const self = this;
		if ( !e.data ) {
			console.log( 'View.receiveEvent - no data', e );
			return;
		}
		
		var msg = null;
		if ( e.data.toUpperCase ) {
			try {
				msg = JSON.parse( e.data );
			} catch ( e ) {
				console.log( 'View.receiveEvent - invalid JSON string', e.data );
				return;
			}
		} else
			msg = e.data;
		
		//console.log( 'View.receiveEvent', msg );
		//var msg = friendUP.tool.objectify( e.data );
		if ( !msg ) {
			console.log( 'view.receiveEvent - no msg for event', e );
			return;
		}
		
		msg.origin = e.origin;
		
		var handler = self.eventMap[ msg.command ];
		if ( !handler ) {
			self.viewEvent( msg );
			return;
		}
		
		handler( msg );
	}
	
	ns.ViewEvent.prototype.viewEvent = function( msg ) {
		const self = this;
		self.emit( msg.type, msg.data );
	}
	
	ns.ViewEvent.prototype.notify = function( msg ) {
		var self = this;
		var handler = self.notifyMap[ msg.method ];
		if ( !handler ) {
			console.log( 'unkown notify event', msg );
			return;
		}
		
		handler( msg );
	}
	
	/*
	ns.ViewEvent.prototype.on = function( event, handler ) {
		var self = this;
		self.listener[ event ] = handler;
	}
	
	ns.ViewEvent.prototype.off = function( event ) {
		var self = this;
		if ( self.listener[ event ])
			delete self.listener[ event ];
	}
	
	ns.ViewEvent.prototype.allOff = function() {
		var self = this;
		self.listener = {};
	}
	
	*/
	
})( api );

// View
(function( ns, undefined ) {
	ns.View = function() {
		const self = this;
		api.ViewEvent.call( self );
		
		self.id = null;
		self.applicationId = null;
		self.authId = null;
		self.parentOrigin = null;
		self.domain = null;
		self.locale = null;
		self.themePath  = null;
		self.viewTheme = null;
		self.run = null;
		self.isActive = null;
		self.deviceType = '';
		
		self.scriptsLoaded = false;
		self.cssLoaded = false;
		
		self.callbacks = {}; // Some callbacks
		
		self.init();
	}
	
	ns.View.prototype = Object.create( api.ViewEvent.prototype );
	
	// public
	
	ns.View.prototype.showNotification = function( title, message, notifyId ) {
		const self = this;
		const notie = {
			title    : title,
			text     : message,
			notifyId : notifyId,
		};
		self.sendTypeEvent( 'show-notify', notie );
	}
	
	ns.View.prototype.getConfig = function() {
		const self = this;
		return self.appConf;
	}
	
	ns.View.prototype.getSettings = function() {
		const self = this;
		return self.appSettings;
	}
	
	ns.View.prototype.addCallback = function( callback )
	{
		const self = this;
		
		var id = friendUP.tool.uid();
		self.callbacks[ id ] = callback;
		return id;
	}
	
	ns.View.prototype.executeCallback = function( cid, data )
	{
		const self = this;
		
		if( self.callbacks[ cid ] )
		{
			self.callbacks[ cid ]( data );
		}
		// Clean up
		var out = {};
		for( var a in self.callbacks )
		{
			if( a != cid )
				out[ a ] = self.callbacks[ a ];
		}
		self.callbacks = out;
	}
	
	ns.View.prototype.toggleFullscreen = function( targetElement ) {
		const self = this;
		if ( !canHasFullscreen()) {
			return;
		}
		
		if ( getFullscreenElement() ) {
			exitFullscreen();
			return;
		}
		
		let el = targetElement ? targetElement : document.body;
		setFullscreen( el );
		
		function canHasFullscreen() {
			return !document.fullscreenEnabled
				|| !document.mozFullscreenEnabled
				|| !document.webkitFullscreenEnabled
				|| !document.msFullscreenEnabled;
		}
		
		function getFullscreenElement() {
			let el = document.fullscreenElement
				|| document.webkitFullscreenElement
				|| document.webkitFullscreenElement
				|| document.mozFullScreenElement
				|| document.msFullscreenElement
				|| null;
				
			return el;
		}
		
		function exitFullscreen() {
			if ( document.exitFullscreen )
				document.exitFullscreen();
			
			if ( document.webkitCancelFullscreen )
				document.webkitCancelFullscreen();
			
			if ( document.webkitCancelFullScreen )
				document.webkitCancelFullScreen();
			
			if ( document.mozCancelFullscreen )
				document.mozCancelFullscreen();
		}
		
		function setFullscreen( el ) {
			if ( el.requestFullscreen ) {
				el.requestFullscreen();
				return;
			}
			
			if ( el.webkitRequestFullscreen ) {
				el.webkitRequestFullscreen();
				return;
			}
			
			if ( el.webkitRequestFullScreen ) {
				el.webkitRequestFullScreen();
				return;
			}
			
			if ( el.mozRequestFullScreen ) {
				el.mozRequestFullScreen();
				return;
			}
			
		}
	}
	
	ns.View.prototype.setBody = function( conf ) {
		const self = this;
		conf = conf || {};
		const el = friend.template.getElement( 'body-tmpl', conf );
		document.body.appendChild( el );
		return true;
	}
	
	ns.View.prototype.showLoading = function( show ) {
		const self = this;
		if ( !self.connState ) {
			console.log( 'view.showLoading - no conn state' );
			return;
		}
		
		self.connState.showLoading( !!show );
	}
	
	ns.View.prototype.loaded = function( keepLoading ) {
		const self = this;
		if ( self.connState && !keepLoading )
			self.connState.setReady();
		
		self.sendTypeEvent( 'loaded', 'yep, its true' );
	}
	
	ns.View.prototype.ready = function() {
		const self = this;
		self.sendTypeEvent( 'ready' );
	}
	
	ns.View.prototype.close = function( msg ) {
		var self = this;
		self.sendMessage({
			type : 'close',
		});
	}
	
	ns.View.prototype.focus = function( msg ) {
		var self = this;
		//console.log( 'view.focus', msg );
	}
	
	ns.View.prototype.blur = function( msg ) {
		var self = this;
		//console.log( 'view.blur', msg );
	}
	
	// private
	
	ns.View.prototype.init = function() {
		const self = this;
		self.addAPIScripts();
		document.addEventListener( 'readystatechange', checkState, false );
		function checkState( e ) {
			//e.stopPropagation();
			if ( 'interactive' === document.readyState ) {
				self.setIsLoading( true );
			}
			
			if ( 'complete' === document.readyState ) {
			}
		}
	}
	
	ns.View.prototype.triggerReflow = function( el ) {
		var self = this;
		if ( !el ) {
			console.log( 'View.triggerReflow - no element' );
			return;
		}
		
		//console.log( 'triggerReflow', el.offsetHeight );
	}
	
	ns.View.prototype.setIsLoading = function( isLoading ) {
		const self = this;
		return;
		
		document.body.classList.toggle( 'Loading', isLoading );
	}
	
	ns.View.prototype.buildFileUrl = function( path ) {
		var self = this;
		var pre = '/system.library/file/read/?path=';
		var post = '&authid=' + self.authId + '&mode=rb';
		var url =  pre + path + post;
		return url;
	}
	
	// undefined will fall back on what is set before ( likey window config ).
	// empty filepath, filepath.length === 0, will unset, same as removeViewTheme.
	// filepath will be set
	ns.View.prototype.setViewTheme = function( filepath ) {
		var self = this;
		// remove current
		self.removeViewTheme();
		// set new filepath if defined,
		// abort if viewTheme is not set at all
		if ( typeof( filepath ) !== 'undefined' )
			self.viewTheme = filepath;
		
		if ( !self.viewTheme || !self.viewTheme.length )
			return;
		
		var url = self.buildFileUrl( self.viewTheme );
		var css = document.createElement( 'link' );
		css.type = 'text/css';
		css.rel = 'stylesheet';
		css.id = 'css-app-theme';
		document.head.appendChild( css );
		css.href = url;
	}
	
	ns.View.prototype.removeViewTheme = function() {
		var self = this;
		var element = document.getElementById( 'css-app-theme' );
		if ( !element )
			return;
		
		element.parentNode.removeChild( element );
	}
	
	ns.View.prototype.checkAllLoaded = function() {
		var self = this;
		if ( !self.scriptsLoaded || !self.cssLoaded )
			return;
		
		if ( self.run ) {
			self.run( self.config.runConf );
			self.run = null;
		}
		
		self.setIsLoading( false );
		//self.activate();
		self.sendBase({
			type: 'notify',
		});
	}
	
	ns.View.prototype.loadFragments = function() {
		const self = this;
		const frags = document.getElementById( 'fragments' );
		if ( !frags )
			return false;
		
		let fragStr = frags.innerHTML;
		fragStr = View.i18nReplaceInString( fragStr );
		friend.template.addFragments( fragStr );
	}
	
	ns.View.prototype.initialize = function( conf ) {
		const self = this;
		self.id = conf.viewId;
		self.applicationId = conf.applicationId;
		self.authId = conf.authId;
		self.parentOrigin = conf.origin;
		self.domain = conf.domain;
		self.locale = conf.locale;
		self.theme  = conf.theme;
		self.themeData = conf.themeData;
		self.config = conf.viewConf || {};
		self.appConf = self.config.appConf || {};
		self.appSettings = self.config.appSettings || {};
		self.deviceType = self.config.deviceType || 'ERR_CONF_OH_SHIT';
		
		if ( !!self.config.isDev )
			self.initLogSock();
		
		if ( self.config.translations )
			self.translations = self.config.translations;
		
		if ( !friend.template )
			friend.template = new friendUP.gui.TemplateManager( self.config.fragments );
		
		self.loadFragments();
		
		if ( self.config.viewTheme )
			self.setViewTheme( self.config.viewTheme );
		
		self.setBaseCss( baseCssLoaded );
		self.connState = new api.ConnState( 'hello' );
		
		self.on( 'app-config', e => self.appConfUpdate( e ));
		
		// mousedown listeing
		document.body.addEventListener( 'mousedown', mouseDownThings, false );
		document.body.addEventListener( 'mouseup', mouseUpThings, false );
		
		function mouseDownThings( e ) {
			self.activate( e );
			self.queueInputFocusCheck();
		}
		
		function mouseUpThings( e ) {
			self.queueInputFocusCheck();
		}
		
		// key down listening
		self.keyDownQualifiers = [
			'shiftKey',
			'ctrlKey',
			'metaKey',
			'altKey',
		];
		
		document.body.addEventListener( 'keydown', onKeyDown, false );
		document.body.addEventListener( 'keyup', onKeyUp, false );
		
		function onKeyDown( e ) {
			if ( !self.isActive )
				return;
			
			self.handleKeyDown( e );
		}
		
		function onKeyUp( e ) {
			self.queueInputFocusCheck();
		}
		
		// resize listening
		window.addEventListener( 'resize', onResize, false );
		function onResize( e ) {
			self.lastResizeEvent = e;
			if ( null != self.resizeTimeout )
				return;
			
			self.resizeTimeout = window.setTimeout( resizeThrottle, 100 );
			function resizeThrottle() {
				self.resizeTimeout = null;
				self.emit( 'resize', self.lastResizeEvent );
			}
		}
		
		window.addEventListener( 'dragover', onDragover, false );
		window.addEventListener( 'drop', onDrop, false );
		function onDragover( e ) {
			//console.log( 'dragover', e );
			e.preventDefault();
			e.stopPropagation();
		}
		
		function onDrop( e ) {
			console.log( 'onDrop', e );
			e.preventDefault();
			e.stopPropagation();
			self.emit( 'drop', e );
		}
		
		//
		function baseCssLoaded() {
			self.cssLoaded = true;
			document.body.classList.toggle( 'hi', true );
			if ( self.themeData )
				self.applyThemeConfig( self.themeData );
			
			self.checkAllLoaded();
		}
	}
	
	ns.View.prototype.appConfUpdate = function( update ) {
		const self = this;
		console.log( 'appConfUpdate', update );
		self.appConf = update;
		//self.emit( 'app-config', update );
	}
	
	ns.View.prototype.initLogSock = function() {
		const self = this;
		if ( !api.LogSockView )
			return;
		
		self.logSock = new api.LogSockView();
	}
	
	ns.View.prototype.handleKeyDown = function( e ) {
		const self = this;
		const keyCode = e.keyCode || e.which;
		if ( hasNoModifier( e ) || isModifier( keyCode ))
			return;
		
		const keyEvent = {};
		self.keyDownQualifiers.forEach( prop => {
			if ( !e[ prop ])
				return;
			
			keyEvent[ prop ] = e[ prop ];
		});
		
		keyEvent.keyCode = keyCode;
		const event = {
			type    : 'system',
			command : 'keydown',
			data    : keyEvent,
		};
		
		self.sendBase( event );
		
		function hasNoModifier( keyDown ) {
			return !self.keyDownQualifiers.some( modKey => {
				return !!keyDown[ modKey ];
			});
		}
		
		function isModifier( keyCode ) {
			if (   16 === keyCode // shift
				|| 17 === keyCode // ctrl
				|| 18 === keyCode // alt
				|| 91 === keyCode // meta
			) {
				return true;
			} else
				return false;
		}
	}
	
	ns.View.prototype.addAPIScripts = function() {
		var self = this;
		// scripts
		var scripts = [
			'io/cajax.js', // dependency for cssparser.js
			'utils/engine.js',
			'utils/tool.js',
			'utils/cssparser.js',
			'gui/template.js',
		];
		var path = '/webclient/js/';
		var pathArr = scripts.map( setPath );
		var scriptPath = pathArr.join( ';' );
		var script = document.createElement( 'script' );
		script.onload = systemScriptsLoaded;
		script.type = 'text/javascript';
		script.src = scriptPath;
		document.head.appendChild( script );
		
		function setPath( script ) { return path + script; }
		function systemScriptsLoaded() {
			self.scriptsLoaded = true;
			self.checkAllLoaded();
		}
	}
	
	ns.View.prototype.setBaseCss = function( callback ) {
		var self = this;
		if ( self.theme )
			self.themePath = '/themes/' + self.theme;
		else
			self.themePath = '/webclient/theme';
		
		var themedScrollbars = self.themePath + '/scrollbars.css';
		var compiledTheme = self.themePath + '/theme_compiled.css';
		var css = {
			'css-font-awesome' : '/webclient/css/font-awesome.min.css',
			'css-system-scrollbars' : themedScrollbars,
			'css-system-theme' : compiledTheme,
		};
		
		if ( self.viewTheme )
			css[ 'css-app-theme' ] = self.viewTheme;
		
		self.loadCss( css, callback );
	}
	
	ns.View.prototype.loadCss = function( idFileMap, callback ) {
		var self = this;
		var filesLeft = 0;
		load( idFileMap );
		
		function load( cssMap ) {
			var ids = Object.keys( cssMap );
			ids.forEach( setCss );
			function setCss( id ) {
				removeIfExists( id );
				filesLeft++;
				let path = cssMap[ id ];
				let css = document.createElement( 'link' );
				css.type = 'text/css';
				css.rel = 'stylesheet';
				css.id = id;
				document.head.appendChild( css );
				css.href = path;
				css.onload = loaded;
				
				function loaded() {
					filesLeft--;
					if ( !filesLeft && callback )
						callback();
				}
			}
		}
		
		function removeIfExists( id ) {
			var el = document.getElementById( id );
			if ( !el )
				return;
			
			el.parentNode.removeChild( el );
		}
	}
	
	ns.View.prototype.register = function() {
		const self = this;
	}
	
	ns.View.prototype.queueInputFocusCheck = function( e ) {
		const self = this;
		if ( self.inputFocusCheckTimeout )
			return;
		
		self.inputFocusCheckTimeout = window.setTimeout( runCheck, 250 );
		function runCheck() {
			delete self.inputFocusCheckTimeout;
			self.checkInputHasFocus();
		}
	}
	
	ns.View.prototype.checkInputHasFocus = function() {
		const self = this;
		const focus = document.activeElement;
		if ( !focus || !isInput( focus )) {
			if ( self.inputHasUserFocus )
				setFocusChange( false );
		} else {
			if ( !self.inputHasUserFocus )
				setFocusChange( true );
		}
		
		function isInput( el ) {
			const tag = el.tagName;
			const editable = !!el.getAttribute( 'contenteditable' );
			return !!(
				editable
				|| 'TEXTAREA' === tag
				|| 'INPUT' === tag
			);
		}
		
		function setFocusChange( hasFocus ) {
			self.inputHasUserFocus = hasFocus;
			self.sendWindowState( 'input-focus', hasFocus );
		}
	}
	
	ns.View.prototype.sendWindowState = function( type, value ) {
		const self = this;
		const state = {
			method : 'windowstate',
			state  : type,
			value  : value,
		};
		self.sendViewEvent( state );
	}
	
	// Show the camera
	ns.View.prototype.openCamera = function( flags, callback )
	{
		const self = this;
		
		// The message
		var o = {
			type         : 'system',
			command      : 'opencamera',
			viewId       : self.id,
			targetViewId : self.id, // TODO: This may be needed!
			flags        : flags,
		};
		
		// Add a callback
		if( callback )
		{
			o.callback = self.addCallback( callback );
		}
		
		self.sendBase( o );
	}
	
	ns.View.prototype.prepareCamera = function( targetElement, callback ) {
		const self = this;
		console.log( 'prepareCamera' );
		if( self.cameraChecked === true )
			return;
		
		self.cameraChecked = true;
		
		const imagetools = document.createElement( 'script' );
		imagetools.src = '/webclient/3rdparty/load-image.all.min.js'
		document.head.appendChild( imagetools );
		
		
		if ( 'DESKTOP' === self.deviceType )
			setupDesktop();
		else
			setupMobile();
		
		function setupDesktop() {
			targetElement.addEventListener( 'click', btnClick, false );
			function btnClick( e ) {
				self.openCamera({
					title:View.i18n('i18n_take_a_picture')
				}, imgBack );
			}
		}
		
		function setupMobile() {
			// mobile device image capture is best done using a file input. we put that in place.
			const tp = targetElement.parentNode;
			const ne = document.createElement( 'div' );
			ne.className = 'FileUploadWrapper';
			ne.innerHTML = '<input id="cameraimageFI" type="file" accept="image/*" />';
			
			tp.insertBefore( ne, targetElement );
			ne.insertBefore( targetElement, ne.firstChild );
			
			document.getElementById( 'cameraimageFI' )
				.addEventListener( 'change', handleIncomingFile );
			
			function handleIncomingFile( evt )
			{
				if( evt && evt.target && evt.target.files )
				{
					window.loadImage(
						evt.target.files[0],
						function(returnedcanvas,meta) {
							var imagedata = returnedcanvas.toDataURL('image/jpeg', 0.9);
							imgBack({
								data : imagedata
							});
						},
						{ maxWidth: 1920, maxHeight: 1920, canvas:true, orientation: true }
					);
					
				}
				else
				{
					imgBack( false );
				}
			}
		}
		
		function imgBack( msg ) {
			if( !( msg && msg.data ))
			{
				callback({
					result : false
				});
				return;
			}
			
			const raw = window.atob( msg.data.split( ';base64,' )[1] );
			const uInt8Array = new Uint8Array( raw.length );
			for ( let i = 0; i < raw.length; ++i ) {
				uInt8Array[ i ] = raw.charCodeAt( i );
			}
			
			const bl = new Blob(
				[ uInt8Array ],
				{ type: 'image/jpeg', encoding: 'utf-8' }
			);
			
			// Paste the blob!
			const p = new api.PasteHandler( 'camera', 'jpg' );
			const blob = {
				type: 'blob',
				blob: bl
			};
			p.handle( blob )
				.then( pasteBack )
				.catch( pasteErr );
			
			callback({
				result : true
			});
			
			function pasteBack( list ) {
				console.log( 'camera pasteBack', list );
				self.send({
					type: 'drag-n-drop',
					data: list,
				});
			}
			
			function pasteErr( err ) {
				console.log( 'camera pasteErr', err );
			}
		};
		
	}
	
	ns.View.prototype.activate = function() {
		var self = this;
		var msg = {
			method : 'activate',
		};
		self.sendViewEvent( msg );
	}
	
	ns.View.prototype.activated = function() {
		var self = this;
		if ( self.isActive )
			return;
		
		self.viewEvent({
			type : 'focus',
			data : true,
		});
		
		self.isActive = true;
		document.body.focus();
		document.body.classList.toggle( 'activated', true );
	}
	
	ns.View.prototype.deactivated = function() {
		var self = this;
		if ( !self.isActive )
			return;
		
		self.viewEvent({
			type : 'focus',
			data : false,
		});
		
		self.isActive = false;
		document.body.classList.toggle( 'activated', false );
	}
	
	ns.View.prototype.handleViewFlag = function( e ) {
		const self = this;
	}
	
	ns.View.prototype.handleViewTheme = function( msg ) {
		var self = this;
		var data = msg.data;
		if ( data.type === 'set' )
			self.setViewTheme( data.data );
		else
			self.removeViewTheme();
	}
	
	ns.View.prototype.handleSystemTheme = function( data ) {
		var self = this;
		self.setIsLoading( true );
		self.theme = data.theme;
		self.setBaseCss( setBack );
		function setBack() {
			if ( data.themeData )
				self.applyThemeConfig( data.themeData );
			
			self.setIsLoading( false );
		}
	}
	
	ns.View.prototype.applyThemeConfig = function( themeData ) {
		const self = this;
		if( !themeData )
			return;
		
		if ( 'string' === typeof themeData ) {
			try {
				themeData = JSON.parse( themeData );
			} catch ( ex ) {
				console.log( 'failed to parse themeData', {
					ex : ex,
					td : themeData,
				});
				return;
			}
		}
		
		if( friend.themeStyleElement )
			friend.themeStyleElement.innerHTML = '';
		else
		{
			friend.themeStyleElement = document.createElement( 'style' );
			document.getElementsByTagName( 'head' )[0].appendChild( friend.themeStyleElement );
		}
		
		var shades = [ 'dark', 'charcoal', 'synthwave' ];
		for( var c in shades )
		{
			var uf = shades[c].charAt( 0 ).toUpperCase() + shades[c].substr( 1, shades[c].length - 1 );
			if( themeData[ 'colorSchemeText' ] == shades[c] )
				document.body.classList.add( uf );
			else document.body.classList.remove( uf );
		}
		
		if( themeData[ 'buttonSchemeText' ] == 'windows' )
			document.body.classList.add( 'MSW' );
		else document.body.classList.remove( 'MSW' );
		
		var str = '';
		for( var a in themeData )
		{
			if( !themeData[a] ) continue;
			var v = themeData[a];
			switch( a )
			{
			case 'colorWindowActive':
				str += `
html > body .View.Active > .Title,
html > body .View.Active > .LeftBar,
html > body .View.Active > .RightBar,
html > body .View.Active > .BottomBar
{
	background-color: ${v};
}
`;
					break;
				case 'colorButtonBackground':
					str += `
html > body .Button, html > body button
{
	background-color: ${v};
}
`;
					break;
				case 'colorWindowBackground':
					str += `
html > body, html body .View > .Content
{
	background-color: ${v};
}
`;
					break;
				case 'colorWindowText':
					str += `
html > body, html body .View > .Content, html > body .Tab
{
	color: ${v};
}
`;
					break;
				case 'colorFileToolbarBackground':
					str += `
html > body .View > .DirectoryToolbar
{
	background-color: ${v};
}
`;
					break;
				case 'colorFileToolbarText':
					str += `
html > body .View > .DirectoryToolbar button:before, 
html > body .View > .DirectoryToolbar button:after
{
	color: ${v};
}
`;
					break;
				case 'colorFileIconText':
					str += `
html > body .File a
{
	color: ${v};
}
`;
					break;
				case 'colorScrollBackground':
					str += `
body .View.Active ::-webkit-scrollbar,
body .View.Active.IconWindow ::-webkit-scrollbar-track
{
	background-color: ${v};
}
`;
					break;
				case 'colorScrollButton':
					str += `
html body .View.Active.Scrolling > .Resize,
body .View.Active ::-webkit-scrollbar-thumb,
body .View.Active.IconWindow ::-webkit-scrollbar-thumb
{
	background-color: ${v} !important;
}
`;
				break;
			}
		}
		friend.themeStyleElement.innerHTML = str;
	}
	
	ns.View.prototype.sendMessage = function( data, callback ) {
		const self = this;
		if ( !self.id )
			throw new Error( 'View not yet initialized' );
		
		const msg = {
			data : {
				type : 'app',
				data : data,
			},
		};
		if ( callback ) {
			console.trace( '------ XxX OMG CALLBACK XOXO ------', data );
			const callbackId = friendUP.tool.uid();
			msg.data.callback = callbackId;
			self.on( callbackId, callback );
		}
		
		self.sendBase( msg );
	}
	
	ns.View.prototype.send = ns.View.prototype.sendMessage;
	
	ns.View.prototype.sendViewEvent = function( event ) {
		const self = this;
		event.type = 'view';
		self.sendBase( event );
	}
	
	ns.View.prototype.sendTypeEvent = function( type, data ) {
		const self = this;
		const event = {
			data : {
				type : type,
				data : data,
			},
		};
		
		self.sendBase( event );
	}
	
	ns.View.prototype.sendBase = function( event ) {
		const self = this;
		event.viewId = self.id;
		event.applicationId = self.applicationId;
		
		const msgString = friendUP.tool.stringify( event );
		window.parent.postMessage( msgString, self.parentOrigin );
	}
	
	// Get a translated string
	ns.View.prototype.i18n = function( string ) {
		const self = this;
		if ( !self.translations )
			return string;
		
		const translation = self.translations[string];
		return translation || string;
	}
	
	// Search and execute replacements in string
	ns.View.prototype.i18nReplaceInString = function( str ) {
		const self = this;
		var pos = 0;
		while (( pos = str.indexOf( "{i18n_", pos )) >= 0 ) {
			var pos2 = str.indexOf( "}", pos );
			if ( -1 === pos2 )
				break;
			
			var key = str.substring( pos + 1, pos2 );
			str = str.substring( 0, pos ) 
				+ View.i18n( key ) 
				+ str.substring( pos2 + 1 );
			pos = pos2 + 1;
			
		}
		return str;
	}
	
})( api );

window.View = new api.View();


// ConnState
(function( ns, undefined ) {
	ns.ConnState = function( parentId ) {
		const self = this;
		self.pId = parentId;
		
		self.el = null;
		
		self.isOnline = null;
		self.keepLoading = false;
		
		self.init();
	}
	
	// Public
	
	ns.ConnState.prototype.showLoading = function( show ) {
		const self = this;
		self.keepLoading = show;
		if ( show ) {
			self.setLoading();
			return;
		}
		
		if ( !show && ( self.isOnline || ( null == self.isOnline )))
			self.setOnline();
	}
	
	ns.ConnState.prototype.setReady = function() {
		const self = this;
		self.keepLoading = false;
		self.setOnline();
	}
	
	ns.ConnState.prototype.set = function( state ) {
		const self = this;
		self.conn.handle( state );
	}
	
	ns.ConnState.prototype.close = function() {
		const self = this;
		delete self.pId
		delete self.el;
		delete self.loading;
		delete self.connecting;
		delete self.reconnect;
		delete self.denied;
		
		if ( !self.conn )
			return;
		
		self.conn.close();
		delete self.conn;
	}
	
	// Priv
	
	ns.ConnState.prototype.init = function() {
		const self = this;
		self.build();
		self.conn = new library.component.EventNode( 'conn-state', window.View, eventSink );
		self.conn.on( 'load', load );
		self.conn.on( 'connect', connect );
		self.conn.on( 'session', session );
		self.conn.on( 'close', close );
		self.conn.on( 'timeout', timeout );
		self.conn.on( 'error', error );
		self.conn.on( 'resume', resume );
		self.conn.on( 'wait-reconnect', reconnect );
		self.conn.on( 'access-denied', denied );
		
		function load( e ) { self.handleLoad( e ); }
		function connect( e ) { self.handleConnect( e ); }
		function session( e ) { self.handleOnline( e ); }
		function close( e ) { self.handleClose( e ); }
		function timeout( e ) { console.log( 'ConnState.timeout', e ); }
		function error( e ) { self.handleError( e ); }
		function resume( e ) { self.handleResume( e ); }
		function reconnect( e ) { self.handleReconnect( e ); }
		function denied( e ) { self.handleDenied( e ); }
		
		function eventSink( ) {
			console.log( 'ConnState - unknown event', arguments );
		}
	}
	
	ns.ConnState.prototype.handleLoad = function( data ) {
		const self = this;
		self.isOnline = false;
		self.setLoading();
	}
	
	ns.ConnState.prototype.handleOnline = function( sid ) {
		const self = this;
		self.isOnline = true;
		if ( self.keepLoading )
			self.setLoading();
		else
			self.setOnline();
	}
	
	ns.ConnState.prototype.setLoading = function() {
		const self = this;
		self.showUI( true );
		self.hideProgressStates();
	}
	
	ns.ConnState.prototype.setOnline = function() {
		const self = this;
		self.showError( false );
		self.isOnline = true;
		self.showUI( false );
	}
	
	ns.ConnState.prototype.handleConnect = function( e ) {
		const self = this;
		self.isOnline = false;
		self.showUI( true );
		self.hideProgressStates();
	}
	
	
	ns.ConnState.prototype.handleClose = function( e ) {
		const self = this;
		self.isOnline = false;
		self.showUI( true );
	}
	
	ns.ConnState.prototype.handleError = function( err ) {
		const self = this;
		self.isOnline = false;
		self.showUI( true );
		self.hideErrorStates();
		self.hideProgressStates();
		self.showError( true );
		self.errorMessage.textContent = err;
		self.error.classList.toggle( 'hidden', false );
		self.reconnect.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.handleResume = function( event ) {
		const self = this;
		self.showUI( true );
		self.hideProgressStates();
		//self.loading.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.handleReconnect = function( event ) {
		const self = this;
		self.showError( false );
		self.showUI( true );
		self.hideErrorStates();
		self.hideProgressStates();
		//self.connecting.classList.toggle( 'hidden', false );
		self.reconnect.classList.toggle( 'hidden', false );
		/*
		const cont = document.getElementById( 'conn-state-rc-bar-container' );
		const bar = document.getElementById( 'conn-state-rc-bar' );
		if ( !event.time ) {
			hideBar();
			return;
		}
		
		if ( self.reconnectFrame ) {
			window.cancelAnimationFrame( self.reconnectFrame );
			self.reconnectFrame = null;
		}
		
		bar.style.width = '100%';
		let start = Date.now();
		let end = event.time;
		let total = end - start;
		
		step();
		showBar();
		
		function step() {
			self.reconnectFrame = window.requestAnimationFrame( update );
		}
		
		function update() {
			let now = Date.now();
			if ( now > end ) {
				hideBar();
				return;
			}
			
			let left = end - now;
			let p = ( left / total );
			let percent = Math.floor( p * 100 );
			bar.style.width = percent + '%';
			
			step();
		}
		
		function showBar() {
			bar.classList.toggle( 'hidden', false );
		}
		
		function hideBar() {
			bar.classList.toggle( 'hidden', true );
		}
		*/
	}
	
	ns.ConnState.prototype.handleDenied = function( host ) {
		const self = this;
		self.showUI( true );
		self.hideErrorStates();
		self.showError( true );
		self.denied.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.showUI = function( show ) {
		const self = this;
		self.el.classList.toggle( 'hidden', !show );
	}
	
	ns.ConnState.prototype.hideProgressStates = function() {
		const self = this;
		self.loading.classList.toggle( 'hidden', true );
		self.connecting.classList.toggle( 'hidden', true );
		self.reconnect.classList.toggle( 'hidden', true );
	}
	
	ns.ConnState.prototype.hideErrorStates = function() {
		const self = this;
		self.denied.classList.toggle( 'hidden', true );
		self.error.classList.toggle( 'hidden', true );
	}
	
	ns.ConnState.prototype.showProgress = function( show ) {
		const self = this;
		self.progress.classList.toggle( 'hidden', !show );
	}
	
	ns.ConnState.prototype.showError = function( show ) {
		const self = this;
		self.errorHead.classList.toggle( 'hidden', !show );
		self.progressHead.classList.toggle( 'hidden', show );
		self.oops.classList.toggle( 'hidden', !show );
	}
	
	ns.ConnState.prototype.build = function() {
		const self = this;
		const ui = friend.template.getElement( 'conn-state-tmpl', {} );
		const pEl = document.body;
		pEl.appendChild( ui );
		self.el = document.getElementById( 'conn-state-container' );
		
		// bind ui
		let rcBtn = document.getElementById( 'conn-state-reconnect-btn' );
		let qBtn = document.getElementById( 'conn-state-quit-btn' );
		self.errorHead = document.getElementById( 'conn-state-error-head' );
		self.progressHead = document.getElementById( 'conn-state-progress-head' );
		self.oops = document.getElementById( 'conn-state-oops' );
		self.yay = document.getElementById( 'conn-state-yay' );
		self.loading = document.getElementById( 'conn-state-loading' );
		self.connecting = document.getElementById( 'conn-state-connecting' );
		self.reconnect = document.getElementById( 'conn-state-reconnect' );
		self.denied = document.getElementById( 'conn-state-denied' );
		self.error = document.getElementById( 'conn-state-error' );
		self.errorMessage = document.getElementById( 'conn-state-error-msg' );
		
		rcBtn.addEventListener( 'click', reconnect, false );
		qBtn.addEventListener( 'click', quit, false );
		
		function reconnect( e ) {
			self.send({
				type : 'reconnect',
			});
		}
		
		function quit( e ) {
			self.send({
				type : 'quit',
			});
		}
	}
	
	ns.ConnState.prototype.send = function( event ) {
		const self = this;
		if ( !window.View )
			return;
		
		window.View.sendTypeEvent( 'conn-state', event );
	}
	
})( api );


// Paste handler handles pasting of files and media ----------------------------
( function( ns, undefined ) {
	
	ns.PasteHandler = function( sourceName ) {
		const self = this;
		self.name = sourceName || 'file';
		self.saveDir = 'Home:FriendChat/';
		self.dup = 1;
	}
	
	ns.PasteHandler.prototype.handle = function( DOMEvent ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const items = self.normalize( DOMEvent );
			if ( !items.length ) {
				resolve([]);
				return;
			}
			
			self.checkPath()
				.then( pathOk )
				.catch( reject );
			
			function pathOk( dirFileList ) {
				const dirFiles = {};
				dirFileList.forEach( item  => {
					const name = item.Filename;
					dirFiles[ name ] = item;
				});
				self.dirFiles = dirFiles;
				upload( items );
			}
			
			function upload( items ) {
				const uploaded = Promise.all( items.map( doUpload ));
				resolve( uploaded );
				
				function doUpload( item ) {
					return self.uploadFile( item );
				}
			}
		});
	}
	
	// Private
	
	ns.PasteHandler.prototype.checkOrigName = function( orig ) {
		const self = this;
		const dir = self.dirFiles;
		const parts = orig.split( '.' );
		const ext = parts.splice( -1, 1 );
		const pre = parts.join( '.' );
		let dup = 1;
		let name = orig;
		while( dir[ name ]) {
			name = pre + '(' + dup + ')' + '.' + ext;
			dup++;
		}
		
		return name;
	}
	
	ns.PasteHandler.prototype.genName = function( file ) {
		const self = this;
		const dir = self.dirFiles;
		const time = getDateStr();
		const ext = getExt( file.type );
		let fileName = '';
		do {
			fileName = time 
				+ '_' + self.name
				+ '_' + self.dup
				+ '.' + ext
			self.dup++;
		} while ( dir[ fileName ]);
		
		return fileName;
		
		function getDateStr() {
			const time = new Date();
			const y = time.getFullYear();
			const mo = ( time.getMonth() + 1 );
			const d = time.getDate();
			const h = pad( time.getHours());
			const mi = pad( time.getMinutes());
			const date = [ y, mo, d ];
			const clock = [ h, mi ];
			return date.join( '-' ) + ' ' + clock.join( '-' );
			
			function pad( time ) {
				const str = time.toString();
				if ( 1 == str.length )
					return '0' + str;
				else
					return str;
			}
		}
		
		function getExt( type ) {
			if ( !type )
				return 'application/octet-stream';
			
			const parts = type.split( '/' );
			const ext = parts[ 1 ];
			if ( !ext )
				return 'application/octet-stream';
			
			return ext;
		}
	}
	
	ns.PasteHandler.prototype.uploadFile = function( file ) {
		const self = this;
		//const type = ( file.type == '' ? 'application/octet-stream' : file.type );
		let fileName = file.name;
		if ( fileName )
			fileName = self.checkOrigName( fileName );
		else
			fileName = self.genName( file );
		
		self.dirFiles[ fileName ] = true;
		return uploadWorker( file, fileName );
		
		function uploadWorker( file, fileName  ) {
			return new Promise(( resolve, reject ) => {
				window.View.showNotification(
					fileName,
					View.i18n( 'i18n_saving_file_to' ) + ': ' + self.saveDir,
				);
				const path = self.saveDir + fileName;
				const url = document.location.protocol + '//' + document.location.host + '/webclient/';
				const uworker = new Worker( url + 'js/io/filetransfer.js' );
				
				uworker.onerror = function( err ) {
					console.log( 'PasteHandler uploadWorker - err', err );
				}
				
				uworker.onmessage = function( e ) {
					if ( 1 != e.data.progressinfo )
						return;
					
					if ( 1 != e.data.uploadscomplete )
						return;
					
					resolve({
						response : true,
						type     : 'File',
						path     : path,
					});
				}
				
				const volume = self.saveDir.split( ':' )[ 0 ];
				const fileMessage = {
					'authid'       : View.authId,
					'targetPath'   : self.saveDir,
					'targetVolume' : volume,
					'files'        : [ file ],
					'filenames'    : [ fileName ]
				};
				
				uworker.postMessage( fileMessage );
			});
		}
	}
	
	ns.PasteHandler.prototype.normalize = function( e ) {
		const self = this;
		const dTrans = e.dataTransfer;
		let items = [];
		// from camera
		if( e.type && e.type == 'blob' ) {
			console.log( 'blobl', e.blob );
			items.push( e.blob );
		}
		
		// data transfer
		const trans = e.dataTransfer;
		if ( trans ) {
			// files
			if ( trans.files )
				items = getTransFiles( trans );
			else if ( trans.items )
				items = getTransItems( trans );
		}
		
		const clip = e.clipboardData;
		if ( clip ) {
			items = getTransItems( clip );
			//items = ( e.clipboardData || e.originalEvent.clipboardData ).items;
		}
		
		console.log( 'normalize - done', items );
		return items;
		
		function getTransItems( trans ) {
			const items = lööp( trans.items );
			let files = items.map( item => {
				if ( 'file' !== item.kind )
					return null;
				
				const file = item.getAsFile();
				console.log( 'this is a file, promise', file );
				return file;
			});
			files = files.filter( f => !!f );
			return files;
		}
		
		function getTransFiles( trans ) {
			const files = lööp( trans.files );
			//console.log( 'getTransFiles', files )
			return files;
		}
		
		function lööp( weird ) {
			let list = [];
			let i = weird.length;
			while( i ) {
				--i;
				const item = weird[ i ];
				//console.log( 'lööp item', item );
				list.push( item );
			}
			
			return list.reverse();
		}
	}
	
	ns.PasteHandler.prototype.checkPath = function() {
		const self = this;
		return new Promise(( resolve, reject ) => {
			// check full path
			self.callFC( 'dir', self.saveDir )
				.then( resolve )
				.catch( notFound );
			
			// not foud, try create, maybe fail v0v
			function notFound() {
				window.View.showNotification(
					View.i18n( 'i18n_file_upload' ),
					View.i18n( 'i18n_creating_folder' ) + ': ' + self.saveDir,
				);
				self.callFC( 'makedir', self.saveDir )
					.then( reCheck )
					.catch( reject );
			}
			
			function reCheck() {
				self.checkPath()
					.then( resolve )
					.then( reject );
			}
		});
	}
	
	ns.PasteHandler.prototype.callFC = function( action, path ) {
		const self = this;
		return new Promise(( resolve, reject ) => {
			const base = '/system.library/file/' + action + '/?path=';
			path = encodeURIComponent( path );
			const url = base
				+ path
				+ '&authid='
				+ window.View.authId
				+ '&cachekiller=' + ( new Date() ).getTime();
			
			const call = new cAjax();
			call.open(
				'post',
				 url ,
				true
			);
			call.send();
			call.onload = function() {
				const res = call.responseText();
				if ( !res || !res.length ) {
					reject( 'ERR_NO_RESULT' );
					return;
				}
				
				const parts = res.split( '<!--separate-->' );
				const success = parts[ 0 ];
				const str = parts[ 1 ];
				if ( 'ok' != success ) {
					reject( 'ERR_ERR_ERR', str );
					return;
				}
				
				let reply = null;
				try {
					reply = window.JSON.parse( str );
				} catch( ex ) {
					console.log( 'could not parse', {
						ex  : ex,
						str : str,
					});
				}
				
				resolve( reply );
			}
		});
	}
	
	// Initiate paste handler
	ns.PasteHandler.prototype.paste = function( evt, callback ) {
		const self = this;
		
		function DirectoryContainsFile( filename, directoryContents )
		{
			if( !filename ) return false;
			if( !directoryContents || directoryContents.length == 0 ) return false;
	
			for(var i = 0; i < directoryContents.length; i++ )
			{
				if( directoryContents[i].Filename == filename ) return true;
			}
			return false;
		}
		
		function uploadPastedFile( file )
		{
			//get directory listing for Home:Downloads - create folder if it does not exist...
			var j = new cAjax ();
		
			var updateurl = '/system.library/file/dir?wr=1'
			updateurl += '&path=' + encodeURIComponent( 'Home:Downloads' );
			updateurl += '&authid=' + encodeURIComponent( View.authId );
			updateurl += '&cachekiller=' + ( new Date() ).getTime();
			
			var wholePath = 'Home:Downloads/';
			
			j.open( 'get', updateurl, true, true );
			j.onload = function ()
			{
				var content;
				// New mode
				if ( this.returnCode == 'ok' )
				{
					try
					{
						content = JSON.parse(this.returnData||"null");
					}
					catch ( e ){};
				}
				// Legacy mode..
				// TODO: REMOVE FROM ALL PLUGINS AND MODS!
				else
				{
					try
					{
						content = JSON.parse(this.responseText() || "null");
					}
					catch ( e ){}
				}
		
				if( content )
				{
					var newfilename = file.name;
					var i = 0;
					while( DirectoryContainsFile( newfilename, content ) )
					{
						i++;
						//find a new name
						var tmp = file.name.split('.');
						var newfilename = file.name;
						if( tmp.length > 1 )
						{
							var suffix = tmp.pop();				
							newfilename = tmp.join('.');
							newfilename += '_' + i + '.' + suffix;
						}
						else
						{
							newfilename += '_' + i;
						}
						if( i > 100 )
						{
							window.View.showNotification(
								View.i18n( 'i18n_paste_error' ),
								View.i18n( 'i18n_really_unexpected_error_contact_your_friendly_admin' ),
							);
							if( callback ) 
								callback({
									response : false,
									message  : 'Too many files pasted.',
								});
							
							break; // no endless loop please
						}
					}
					uploadFileToDownloadsFolder( file, newfilename, wholePath + newfilename );
				}
				else
				{
					window.View.showNotification(
						View.i18n( 'i18n_paste_error' ),
						View.i18n( 'i18n_really_unexpected_error_contact_your_friendly_admin' ),
					);
					if( callback ) 
						callback({
							response :  false,
							message  : 'Unexpected error occured.',
						});
				}
			}
			j.send();
		}
		
		// end of uploadPastedFile
		function uploadFileToDownloadsFolder( file, filename, path )
		{
			console.log( 'Upload to downloads folder' );
			// Setup a file copying worker
			var url = document.location.protocol + '//' + document.location.host + '/webclient/';
			var uworker = new Worker( url + 'js/io/filetransfer.js' );
			
			// Error happened!
			uworker.onerror = function( err )
			{
				console.log( 'Upload worker error #######' );
				console.log( err );
				console.log( '###########################' );
			}
			
			uworker.onmessage = function( e )
			{
				if( e.data['progressinfo'] == 1 )
				{	
					if( e.data[ 'uploadscomplete' ] == 1 )
					{
						if( !this.calledBack )
							callback( { response: true, path: path } );
						this.calledBack = true;
						return true;
					}
				}
			}
			
			//hardcoded pathes here!! TODO!
			var fileMessage = {
				'authid'       : View.authId,
				'targetPath'   : 'Home:Downloads/',
				'targetVolume' : 'Home',
				'files'        : [ file ],
				'filenames'    : [ filename ]
			};
			
			uworker.postMessage( fileMessage );
		}
		
		
		
		
		
		
		
		for( var i in pastedItems )
		{
			var item = pastedItems[i];
			if( item.kind === 'file' )
			{
				var blob = item.getAsFile();
				var filetype = ( blob.type == '' ? 'application/octet-stream' : blob.type );
				
				self.uploadBlob = blob;
				
				//no downloads dir - try to make one
				var m = new cAjax();
				m.onload = function()
				{
					//we have a downloads dir in home
					var r = this.responseText().split( '<!--separate-->' );
					if( r[0] == 'ok' )
					{
						uploadPastedFile( self.uploadBlob );
					}
					else
					{
						//no downloads dir - try to make one
						var x = new cAjax();
						x.onload = function()
						{
							var r1 = this.responseText().split( '<!--separate-->' );
							//home drive found. create directory
							if( r1[0] == 'ok' )
							{
								var c = new cAjax();
								c.onLoad = function()
								{
									var rt = this.responseText().split( '<!--separate-->' );
									if( rt[0] == 'ok' )
									{
										uploadPastedFile( self.uploadBlob );
									}
								}
								c.open( 'post', '/system.library/file/makedir/?path=' + encodeURIComponent( 'Home:Downloads/' ) + '&authid=' + View.authId, true );
								c.send();
							}
						}
						x.open( 'post', '/system.library/file/dir/?path=' + encodeURIComponent( 'Home:' ) + '&authid=' + View.authId, true );
						x.send();
					}
				}
				m.open( 'post', '/system.library/file/dir/?path=' + encodeURIComponent( 'Home:Downloads/' ) + '&authid=' + View.authId, true );
				m.send();
			} // if file item
		} // each pasted iteam
	}
	
} )( api );

// End paste handler -----------------------------------------------------------


