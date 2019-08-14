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
		window.EventEmitter.call( self, eventSink );
		
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
	
	ns.ViewEvent.prototype = Object.create( window.EventEmitter.prototype );
	
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
		
		var self = this;
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
		var self = this;
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
		if ( !( this instanceof ns.View ))
			return new ns.View();
		
		api.ViewEvent.call( this );
		
		var self = this;
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
		if ( !friend.template )
			friend.template = new friendUP.gui.TemplateManager();
		
		const frags = document.getElementById( 'fragments' );
		if ( !frags )
			return false;
		
		var fragStr = frags.innerHTML;
		fragStr = View.i18nReplaceInString( fragStr );
		friend.template.addFragments( fragStr );
		conf = conf || {};
		const el = friend.template.getElement( 'body-tmpl', conf );
		document.body.appendChild( el );
		return true;
	}
	
	ns.View.prototype.loaded = function() {
		const self = this;
		self.sendMessage({
			type : 'loaded',
		});
	}
	
	ns.View.prototype.ready = function() {
		const self = this;
		self.sendMessage({
			type : 'ready',
		});
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
		self.activate();
		self.sendBase({
			type: 'notify',
		});
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
		
		self.setBaseCss( baseCssLoaded );
		
		if ( self.config )
			self.handleConf();
		
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
		
		//
		function baseCssLoaded() {
			self.cssLoaded = true;
			if ( self.themeData )
				self.applyThemeConfig( self.themeData );
			
			self.checkAllLoaded();
		}
	}
	
	ns.View.prototype.initLogSock = function() {
		const self = this;
		if ( !api.LogSockView )
			return;
		
		self.logSock = new api.LogSockView();
		console.log( 'View.initLogSock', window.View.deviceType );
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
	
	ns.View.prototype.handleConf = function() {
		var self = this;
		if ( self.config.viewTheme )
			self.setViewTheme( self.config.viewTheme );
		
		if ( self.config.translations )
			self.translations = self.config.translations;
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
		
		// Create the callback
		var cbk = function( msg ) {
			callback( msg.data );
		};

		// The message
		var o = {
			type: 'system',
			command: 'opencamera',
			viewId: self.id,
			targetViewId: self.id, // TODO: This may be needed!
			flags: flags
		};
		
		// Add a callback
		if( callback )
		{
			o.callback = self.addCallback( callback );
		}
		
		self.sendBase( o );
	}
	
	ns.View.prototype.prepareCamera = function( targetElement, callback )
	{
		const self = this;
		if( self.cameraChecked === true )
			return;
		
		self.cameraChecked = true;
		
		
		const imagetools = document.createElement('script');
		imagetools.src = '/webclient/3rdparty/load-image.all.min.js'
		document.getElementsByTagName('head')[0].appendChild( imagetools );
		
		
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
			const p = new api.PasteHandler();
			p.paste(
				{ type: 'blob', blob: bl },
				pasteBack
			);
			
			callback({
				result : true
			});
			
			function pasteBack( data ) {
				self.send({
					type: 'drag-n-drop',
					data: [ {
						Type: 'File',
						Path: data.path
					} ]
				} );
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

// Paste handler handles pasting of files and media ----------------------------
( function( ns, undefined )
{
	ns.PasteHandler = function()
	{
		
	}
	
	// Initiate paste handler
	ns.PasteHandler.prototype.paste = function( evt, callback )
	{
		var self = this;
		
		function DirectoryContainsFile( filename, directoryContents )
		{
			if( !filename ) return false;
			if( !directoryContents || directoryContents.length == 0 ) return false;
	
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
							Notify({'title':i18n('i18n_paste_error'),'text':'Really unexpected error. You have pasted too many files.'});
							if( callback ) callback( { response: false, message: 'Too many files pasted.' } );
							break; // no endless loop please	
						}
					}
					uploadFileToDownloadsFolder( file, newfilename, wholePath + newfilename );
				}
				else
				{
					Notify({'title':i18n('i18n_paste_error'),'text':'Really unexpected error. Contact your Friendly administrator.'});
					if( callback ) callback( { response: false, message: 'Unexpected error occured.' } );
				}
			}
			j.send ();
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
					if( e.data['uploadscomplete'] == 1 )
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
				'authid': View.authId,
				'targetPath': 'Home:Downloads/',
				'targetVolume': 'Home',
				'files': [ file ],
				'filenames': [ filename ]
			};
			
			uworker.postMessage( fileMessage );		
		}
		
		// Support blob format
		if( evt.type && evt.type == 'blob' )
		{
			evt.blob.name = 'cameraimage.jpg';
			evt.clipboardData = { items: [ { 
				kind: 'file', 
				getAsFile()
				{
					return evt.blob;
				} } ] 
			};
			evt.originalEvent = {};
		}
		
		var pastedItems = ( evt.clipboardData || evt.originalEvent.clipboardData ).items;
		
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

// End paste handler -----------------------------------------------------------


