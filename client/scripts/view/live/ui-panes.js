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
window.library = window.library || {};
window.friendUP = window.friendUP || {};
window.hello = window.hello || {};

library.view = library.view || {};
library.component = library.component || {};

// UI PANE BASE
// Extend this and implement ( minimum ):
// .build() --  called from UIPane init
(function( ns, undefined ) {
	ns.UIPane = function( conf ) {
		if ( !( this instanceof ns.UIPane ))
			return new ns.UIPane( conf );
		
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.id = conf.id;
		self.parentId = conf.parentId;
		
		self.paneId = friendUP.tool.uid( self.id + '-pane' );
		self.isVisible = false;
		
		self.init();
	}
	
	ns.UIPane.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.UIPane.prototype.show = function() {
		const self = this;
		if ( self.isVisible ) {
			self.toFront();
			return;
		}
		
		self.isVisible = true;
		self.toggleVisibility();
	}
	
	ns.UIPane.prototype.hide = function() {
		const self = this;
		if ( !self.isVisible )
			return;
		
		self.isVisible = false;
		self.toggleVisibility();
	}
	
	ns.UIPane.prototype.toggle = function() {
		const self = this;
		if ( self.isVisible )
			self.hide();
		else
			self.show();
		
		return self.isVisible;
	}
	
	ns.UIPane.prototype.getOpen = function( ) {
		const self = this;
		return self.isVisible;
	}
	
	// call from your close
	ns.UIPane.prototype.paneClose = function() {
		const self = this;
		var element = document.getElementById( self.paneId );
		if ( !element ) {
			console.log( 'no pane element found when closing', {
				id : self.id,
				paneId : self.paneId,
			});
		} else
			element.parentNode.removeChild( element );
			
		self.emit( 'close', true );
		self.release();
	}
	
	// Private
	ns.UIPane.prototype.init = function() {
		const self = this;
		self.build();
	}
	
	ns.UIPane.prototype.insertPane = function( contentHTML ) {
		const self = this;
		const conf = {
			id      : self.paneId,
			content : contentHTML,
		};
		const element = hello.template.getElement( 'base-ui-pane-tmpl', conf );
		const container = document.getElementById( self.parentId );
		container.appendChild( element );
		return element.id;
	}
	
	ns.UIPane.prototype.getElement = function() {
		const self = this;
		const element = document.getElementById( self.paneId );
		if ( !element ) {
			console.log( 'UIPane.getElement - no element found for paneId', self.paneId );
			return null;
		}
		
		return element;
	}
	
	ns.UIPane.prototype.toggleVisibility = function() {
		const self = this;
		const element = self.getElement();
		if ( !element )
			return;
		
		element.classList.toggle( 'hidden', !self.isVisible );
		self.emit( 'visible', self.isVisible );
	}
	
	ns.UIPane.prototype.toFront = function() {
		const self = this;
	}
	
})( library.component );


(function( ns, undefined ) {
	ns.LiveStreamSwitchPane = function( paneConf ) {
		const self = this;
		let conf = paneConf.conf;
		self.isStream = conf.isStream;
		self.onChoice = conf.onChoice;
		
		library.component.UIPane.call( self, paneConf );
	}
	
	ns.LiveStreamSwitchPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.LiveStreamSwitchPane.prototype.close = function() {
		const self = this;
		delete self.isStream;
		delete self.onChoice;
		
		self.paneClose();
	}
	
	// Private
	
	ns.LiveStreamSwitchPane.prototype.build = function() {
		const self = this;
		let stream = 'stream';
		let live = 'live';
		const conf = {
			fromType : self.isStream ? live : stream,
			toType   : self.isStream ? stream : live,
		};
		const html = hello.template.get( 'viewpane-live-stream-switch-tmpl', conf );
		self.insertPane( html );
		
		let streamBtn = document.getElementById( 'live-switch-join-stream' );
		let videoBtn = document.getElementById( 'live-switch-join-video' );
		let audioBtn =document.getElementById( 'live-switch-join-audio' );
		let closeBtn = document.getElementById( 'live-switch-close' );
		
		if ( self.isStream )
			enable( streamBtn, 'stream' );
		else {
			enable( videoBtn, 'video' );
			enable( audioBtn, 'audio' );
		}
		
		enable( closeBtn, 'close' );
		
		function enable( el, type ) {
			el.classList.toggle( 'hidden', false );
			el.addEventListener( 'click', btnClick, false );
			function btnClick() {
				self.clicked( type );
			}
		}
	}
	
	ns.LiveStreamSwitchPane.prototype.clicked = function( type ) {
		const self = this;
		let onChoice = self.onChoice;
		delete self.onChoice;
		if ( onChoice )
			onChoice( type );
		
		self.close();
	}
	
})( library.view );

// ChangeUsernamePane
( function( ns, undefined ) {
	ns.ChangeUsernamePane = function( paneConf ) {
		const self = this;
		let conf = paneConf.conf;
		self.current = conf.current;
		self.onname = conf.onname;
		library.component.UIPane.call( self, paneConf );
		
	}
	
	ns.ChangeUsernamePane.prototype = Object.create( library.component.UIPane.prototype );
	
	ns.ChangeUsernamePane.prototype.close = function() {
		const self = this;
		delete self.ui;
		delete self.current;
		delete self.onname;
		self.paneClose();
	}
	
	// Private
	
	ns.ChangeUsernamePane.prototype.build = function() {
		const self = this;
		const conf = {
			current : self.current,
		};
		const html = hello.template.get( 'viewpane-change-username-tmpl', conf );
		self.insertPane( html );
		
		self.ui = document.getElementById( 'change-username' );
		const form = document.getElementById( 'change-username-form' );
		const input = document.getElementById( 'change-username-input' );
		const acceptBtn = document.getElementById( 'change-username-accept' );
		const cancelBtn = document.getElementById( 'change-username-cancel' );
		
		form.addEventListener( 'submit', acceptName, false );
		acceptBtn.addEventListener( 'click', acceptName, false );
		cancelBtn.addEventListener( 'click', cancelName, false );
		
		function acceptName( e ) {
			e.preventDefault();
			e.stopPropagation();
			if ( self.onname )
				self.onname( input.value );
		}
		
		function cancelName( e ) {
			if ( self.onname )
				self.onname( false );
		}
	}
	
})( library.view );

// ExtConnectPane
(function( ns, undefined ) {
	ns.ExtConnectPane = function( paneConf ) {
		const self = this;
		let conf = paneConf.conf;
		self.onshare = conf.onshare;
		library.component.UIPane.call( self, paneConf );
		
	}
	
	ns.ExtConnectPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.ExtConnectPane.prototype.setConnected = function() {
		const self = this;
		self.waiting.classList.toggle( 'hidden', true );
		self.connected.classList.toggle( 'hidden', false );
	}
	
	ns.ExtConnectPane.prototype.close = function() {
		const self = this;
		if ( self.ui )
			self.ui.parentNode.removeChild( self.ui );
		
		delete self.ui;
		delete self.onshare;
		self.paneClose();
	}
	
	// Private
	
	ns.ExtConnectPane.prototype.build = function() {
		const self = this;
		const conf = {};
		const extLoadHTML = hello.template.get( 'viewpane-ext-connect-tmpl', conf );
		const pid = self.insertPane( extLoadHTML );
		
		self.bind();
	}
	
	ns.ExtConnectPane.prototype.bind = function() {
		const self = this;
		self.ui = document.getElementById( 'ext-conn-ui' );
		self.waiting = document.getElementById( 'ext-conn-waiting' );
		self.connected = document.getElementById( 'ext-conn-connected' );
		self.shareBtn = document.getElementById( 'ext-conn-share' );
		self.closeBtn = document.getElementById( 'ext-conn-close' );
		
		self.shareBtn.addEventListener( 'click', shareClick, false );
		self.closeBtn.addEventListener( 'click', closeClick, false );
		
		function shareClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			if ( self.onshare )
				self.onshare();
		}
		
		function closeClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.close();
		}
		
	}
})( library.view );


// Share pane

(function( ns, undefined ) {
	ns.SharePane = function( paneConf ) {
		const self = this;
		self.conf = paneConf.conf;
		
		library.component.UIPane.call( self, paneConf );
	}
	
	ns.SharePane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Private
	
	ns.SharePane.prototype.build = function() {
		const self = this;
		const conf = {};
		const shareHTML = hello.template.get( 'viewpane-share-tmpl', conf );
		const pid = self.insertPane( shareHTML );
		
		self.bind();
	}
	
	ns.SharePane.prototype.bind = function() {
		const self = this;
		const conf = {
			parentId : self.id,
			conn     : self.conf.conn,
		};
		self.share = new library.component.ShareView( conf );
		const share = document.getElementById( self.id );
		const closeBtn = document.getElementById( 'share-close' );
		
		closeBtn.addEventListener( 'click', closeClick, false );
		
		function closeClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.hide();
		}
	}
	
})( library.view );

// Menu pane
(function( ns, undefined ) {
	ns.MenuPane = function( paneConf ) {
		if ( !( this instanceof ns.MenuPane ))
			return new ns.MenuPane( paneConf );
		
		const self = this;
		self.menuConf = paneConf.conf.menuConf;
		
		library.component.UIPane.call( this, paneConf );
	}
	
	ns.MenuPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	// we need some extra .show functionality
	ns.MenuPane.prototype.uiShow = ns.MenuPane.prototype.show;
	ns.MenuPane.prototype.show = function() {
		const self = this;
		self.uiShow();
		self.menu.scrollToTop();
	}
	
	ns.MenuPane.prototype.getMenu = function() {
		const self = this;
		return self.menu;
	}
	
	ns.MenuPane.prototype.close = function() {
		const self = this;
		self.menu.close();
		delete self.menu;
		self.paneClose();
	}
	
	// Private
	
	ns.MenuPane.prototype.build = function() {
		const self = this;
		var pId = self.insertPane( '' );
		var conf = {
			id               : friendUP.tool.uid( 'menu' ),
			parentId         : pId,
			templateManager  : hello.template,
			baseTmplId       : 'live-menu-container-tmpl',
			folderTmplId     : 'live-menu-folder-tmpl',
			itemFolderTmplId : 'live-menu-item-folder-tmpl',
			itemTmplId       : 'live-menu-item-tmpl',
			content          : self.menuConf.content,
			onnolistener     : self.menuConf.onnolistener,
			onhide           : onHide,
			onClose          : onClose,
		};
		
		self.menu = new library.component.Menu( conf );
		delete self.menuConf;
		self.bind();
		
		function onHide( e ) {
			self.hide();
		}
		
		function onClose( e ) {
			console.log( 'Menu.onClose', e );
		}
	}
	
	ns.MenuPane.prototype.bind = function() {
		const self = this;
		var menuBg = document.getElementById( self.paneId );
		menuBg.addEventListener( 'click', bgClick, false );
		function bgClick( e ) {
			if ( e.target.id !== self.paneId )
				return;
			
			e.stopPropagation();
			self.menu.hide();
		}
	}
})( library.view );


// Init checks pane
(function( ns, undefined ) {
	ns.InitChecksPane = function( paneConf ) {
		if ( !( this instanceof ns.InitChecksPane ))
			return new ns.InitChecksPane( conf );
		
		const self = this;
		var conf = paneConf.conf;
		self.onclose = conf.onclose;
		self.oncontinue = conf.oncontinue;
		self.onsourceselect = conf.onsourceselect;
		
		library.component.UIPane.call( this, paneConf );
	}
	
	ns.InitChecksPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.InitChecksPane.prototype.updateBrowserCheck = function( state ) {
		const self = this;
		var contentId = 'check-browser';
		var browserId = 'init-check-browser';
		var browserState = {
			type    : state.support.type,
			desc    : state.browser,
			message : state.support.message,
		};
		
		self.update( browserId, browserState );
		updateCaps( state.capabilities );
		updateSecure( state.secure );
		self.showCheck( contentId, state.support );
		self.showCheck( contentId, state.secure );
		
		function updateCaps( caps ) {
			var capsContainer = document.getElementById( 'init-browser-caps' );
			for ( var cap in caps ) {
				add( cap );
				update( cap );
			}
			
			function add( key ) {
				var id = getCapId( key );
				var conf = {
					id : id,
					desc : key,
				};
				var el = hello.template.getElement( 'initchecks-row-tmpl', conf );
				capsContainer.appendChild( el );
			}
			
			function update( key ) {
				var id = getCapId( key );
				var err = caps[ key ] ? 'success' : 'error';
				var cState = {
					type : err,
					desc : key,
				};
				self.update( id, cState );
				self.showCheck( contentId, cState );
			}
			
			function getCapId( key ) { return 'browser-cap-' + key; }
		}
		
		function updateSecure( conf ) {
			const container = document.getElementById( 'init-browser-secure' );
			conf.message = self.errorCodes[ conf.message ] || conf.message;
			self.update( 'init-check-secure', conf );
		}
	}
	
	ns.InitChecksPane.prototype.updateHostSignal = function( state ) {
		const self = this;
		var id = 'host-signal';
		self.update( id, state )
		self.showCheck( id, state );
	}
	
	ns.InitChecksPane.prototype.updateRoomSignal = function( state ) {
		const self = this;
		var id = 'room-signal';
		self.update( id, state )
		self.showCheck( id, state );
	}
	
	ns.InitChecksPane.prototype.updateICEServer = function( state ) {
		const self = this;
		var cid = 'ice-servers';
		if ( 'add' === state.type )
			addServer( state.server );
		else
			updateServer( state );
		
		function addServer( info ) {
			var url = info.urls[0];
			var id = serverToId( url );
			var conf = {
				id     : id,
				desc : url,
			};
			var el = hello.template.getElement( 'initchecks-row-tmpl', conf );
			var container = document.getElementById( cid )
				.querySelector( '.init-info' );
			container.appendChild( el );
		}
		
		function updateServer( state ) {
			var host = state.server.urls[ 0 ];
			var elId = serverToId( host );
			self.update( elId, state );
			self.showCheck( cid, state );
		}
		
		function serverToId( host ) {
			return host.replace( /\W/g, '-' );
		}
	}
	
	ns.InitChecksPane.prototype.updateAudioInput = function( state ) {
		const self = this;
		const id = 'audio-input';
		const isErr = 'success' !== state.type;
		state.message = self.errorCodes[ state.err ] || state.err;
		self.chooseAudio.classList.toggle( 'hidden', !isErr );
		self.update( id, state )
		self.showCheck( id, state );
	}
	
	ns.InitChecksPane.prototype.updateVideoInput = function( state ) {
		const self = this;
		console.log( 'VideoInputState - NYI', state );
	}
	
	ns.InitChecksPane.prototype.updateDevicesCheck = function( state ) {
		const self = this;
		const id = 'check-devices';
		if ( !state || !state.err )
			return;
		
		let errMsg = self.errorCodes[ state.err ] || state.err;
		self.update( id, {
			type    : 'error',
			message : errMsg,
		});
		
		self.showCheck( id, {
			type : 'error',
		});
	}
	
	ns.InitChecksPane.prototype.updateSelfieCheck = function( state ) {
		const self = this;
		const id = 'selfie-check';
		self.update( id, state );
		self.showCheck( id, state );
		if ( state.err ) {
			let errEl = document.getElementById( 'init-selfie-error' );
			errEl.classList.toggle( 'hidden', false );
			let errMsg = errEl.querySelector( '.error-desc' );
			errMsg.textContent = state.err;
		}
		
		if ( state.constraints ) {
			let consEl = document.getElementById( 'init-selfie-cons' );
			consEl.classList.toggle( 'hidden', false );
			let consMsg = consEl.querySelector( '.cons-desc' );
			consMsg.textContent = state.constraints;
		}
		
	}
	
	ns.InitChecksPane.prototype.showHostSignal = function() {
		const self = this;
		var el = document.getElementById( 'host-signal' );
		el.classList.toggle( 'hidden', false );
	}
	
	ns.InitChecksPane.prototype.showVideoInput = function() {
		const self = this;
		var el = document.getElementById( 'video-input');
		el.classList.toggle( 'hidden', false );
	}
	
	ns.InitChecksPane.prototype.close = function() {
		const self = this;
		self.paneClose();
	}
	
	// Private
	
	ns.InitChecksPane.prototype.stateMap = {
		'error' : {
			faIcon     : 'fa-exclamation-triangle',
			iconClass  : 'init-error',
			stateClass : 'init-error',
		},
		'warning' : {
			faIcon     : 'fa-cubes',
			iconClass  : 'init-warning',
			stateClass : 'init-warning',
		},
		'success' : {
			faIcon     : 'fa-check',
			iconClass  : 'init-nominal',
			stateClass : 'init-nominal',
		},
	};
	
	ns.InitChecksPane.prototype.build = function() {
		const self = this;
		self.errorCodes = {
			'ERR_ENUMERATE_DEVICES_FAILED' : View.i18n( 'i18n_err_enumerate_devices_failed' ),
			'ERR_NO_DEVICES_BLOCKED'       : View.i18n( 'i18n_err_devices_blocked' ),
			'ERR_NO_DEVICES_FOUND'         : View.i18n( 'i18n_err_no_devices_found' ),
			'ERR_GUM_NOT_ALLOWED'          : View.i18n( 'i18n_err_gum_not_allowed' ),
			'ERR_HTTPS_REQUIRED'           : View.i18n( 'i18n_err_https_required' ),
			'ERR_GUM_NO_MEDIA'             : View.i18n( 'i18n_err_gum_no_media' ),
		};
		
		self.checks = [
			{
				id     : 'check-browser',
				type   : View.i18n('i18n_browser_check'),
				tmpl   : 'initchecks-browser',
			},
			{
				id      : 'check-devices',
				type    : View.i18n( 'i18n_device_check' ),
				state   : View.i18n( 'i18n_checking' ),
				//btnIcon : 'fa-cube',
				tmpl    : 'initchecks-devices-tmpl',
			},
			{
				id      : 'selfie-check',
				type    : View.i18n('i18n_self_check'),
				state   : View.i18n('i18n_checking'),
				btnIcon : 'fa-user',
				tmpl    : 'initchecks-selfie-tmpl',
			},
			{
				id     : 'ice-servers',
				type   : View.i18n('i18n_ice_servers'),
				state  : View.i18n('i18n_connecting'),
				tmpl   : 'initchecks-ice-tmpl',
			},
			{
				id      : 'audio-input',
				type    : View.i18n('i18n_audio_input'),
				state   : View.i18n('i18n_checking'),
				btnIcon : 'fa-microphone',
				tmpl    : 'initchecks-media-tmpl',
			},
			{
				id      : 'video-input',
				hidden  : 'hidden',
				type    : View.i18n('i18n_video_input'),
				btnIcon : 'fa-eye',
				state   : View.i18n('i18n_checking'),
			},
		];
		
		var checksHTML = self.buildChecks();
		var conf = {
			checks : checksHTML,
		};
		var contentHTML = hello.template.get( 'initchecks-ui-pane-tmpl', conf );
		var id = self.insertPane( contentHTML );
		self.bind( id );
		self.bindToggle();
	}
	
	ns.InitChecksPane.prototype.buildChecks = function() {
		const self = this;
		var checksHtml = self.checks.map( build );
		return checksHtml.join( '' );
		
		function build( conf ) {
			conf.desc = conf.desc || '';
			var tmpl = conf.tmpl || 'initchecks-item-tmpl';
			var content = hello.template.get( tmpl, conf );
			var wrapConf = {
				id : conf.id,
				hidden : conf.hidden || '',
				content : content,
			};
			return hello.template.get( 'initchecks-wrap-tmpl', wrapConf );
		}
	}
	
	ns.InitChecksPane.prototype.bind = function() {
		const self = this;
		var el = document.getElementById( 'init-checks' );
		self.continueBtn = document.getElementById( 'init-checks-continue' );
		self.closeBtn = document.getElementById( 'init-checks-close' );
		self.chooseAudio = document.getElementById( 'audio-input' )
			.querySelector( '.init-media-err' );
		var audioBtn = self.chooseAudio.querySelector( '.btn' );
		
		self.continueBtn.addEventListener( 'click', continueClick, false );
		self.closeBtn.addEventListener( 'click', closeClick, false );
		audioBtn.addEventListener( 'click', audioClick, false );
		
		function continueClick( e ) {
			self.oncontinue();
		}
		
		function closeClick( e ) {
			self.onclose();
		}
		
		function audioClick( e ) {
			self.onsourceselect();
		}
	}
	
	ns.InitChecksPane.prototype.bindToggle = function() {
		const self = this;
		var parent = document.getElementById( 'init-checks-tests' );
		if ( !parent.children.length )
			return;
		
		Array.prototype.forEach.call( parent.children, bind );
		function bind( el ) {
			var btnEl = el.querySelector( '.initchecks-toggle-item' );
			var contentEl = el.querySelector( '.init-info' );
			if ( !btnEl || !contentEl ) {
				console.log( 'InitChecksPane.bindToggle',
					{ el : el, btn : btnEl, cnt : contentEl });
				throw new Error( 'InitChecksPane.bindToggle - no btn or content found' );
			}
			
			btnEl.addEventListener( 'click', toggleClick, false );
			function toggleClick( e ) {
				e.stopPropagation();
				e.preventDefault();
				if ( !contentEl || !contentEl.classList )
					return;
				
				contentEl.classList.toggle( 'hidden' );
			}
		}
	}
	
	ns.InitChecksPane.prototype.update = function( id, state ) {
		const self = this;
		var conf = self.stateMap[ state.type ];
		var element = document.getElementById( id );
		if ( !element ) {
			console.log( 'no element for id', { id : id, state : state });
			return;
		}
		
		var iconParent = element.querySelector( '.init-icon' );
		var iconEl = iconParent.querySelector( '.fa' );
		var descEl = element.querySelector( '.init-desc' );
		var msgEl = element.querySelector( '.init-state' );
		
		if ( conf )
			updateClasses( conf );
		
		if ( state.desc && state.desc.length )
			descEl.textContent = state.desc;
		
		msgEl.innerHTML = state.message || '';
		
		function updateClasses( conf ) {
			if ( conf.iconClass.length )
				iconParent.classList.toggle( conf.iconClass, true );
			
			if ( conf.faIcon.length )
				iconEl.className = 'fa fa-fw ' + conf.faIcon;
			
			if ( conf.stateClass.length )
				msgEl.classList.toggle( conf.stateClass, true );
		}
	}
	
	ns.InitChecksPane.prototype.showCheck = function( id, state ) {
		const self = this;
		if ( !state || !state.type )
			return;
		
		if (( 'warning' !== state.type ) && ( 'error' !== state.type ))
			return;
		
		var el = document.getElementById( id );
		var info = el.querySelector( '.init-info' );
		info.classList.toggle( 'hidden', false );
	}
	
	ns.InitChecksPane.prototype.showErrorHandling = function( canContinue ) {
		const self = this;
		var errEl = document.getElementById( 'init-check-errors' );
		self.continueBtn.classList.toggle( 'hidden', !canContinue );
		var mustCloseEl = document.getElementById( 'error-must-close' );
		var canContEl = document.getElementById( 'error-can-continue' );
		mustCloseEl.classList.toggle( 'hidden', canContinue );
		canContEl.classList.toggle( 'hidden', !canContinue );
		
		// show errors
		errEl.classList.toggle( 'hidden', false );
		
		// hide overlay
		var overlay = document.getElementById( 'init-checks-overlay' );
		overlay.classList.toggle( 'hidden', true );
	}
	
})( library.view );

// SourceSelectPane
(function( ns, undefined ) {
	ns.SourceSelectPane = function( paneConf ) {
		if ( !( this instanceof ns.SourceSelectPane ))
			return new ns.SourceSelectPane( paneConf );
		
		const self = this;
		var conf = paneConf.conf;
		self.permissions = conf.permissions;
		self.onselect = conf.onselect;
		
		self.previewId = 'source-preview';
		
		self.audioId = 'audioinput';
		self.videoId = 'videoinput';
		self.outputId = 'audiooutput';
		
		self.sources = null;
		self.currentDevices = null;
		self.selectedDevices = null;
		self.allDevices = null;
		
		self.audioinput = null;
		self.videoinput = null;
		self.audiooutput = null;
		
		self.supportsSinkId = false;
		
		library.component.UIPane.call( self, paneConf );
	}
	
	ns.SourceSelectPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.SourceSelectPane.prototype.showDevices = function( currentDevices ) {
		const self = this;
		self.refreshDevices( currentDevices );
	}
	
	ns.SourceSelectPane.prototype.showGetUserMediaError = function( data ) {
		const self = this;
		self.clear();
		const error = 'Failed to attach media: ' + data.err.name;
		const errorElement = document.getElementById( 'source-error' );
		const errorMsg = errorElement.querySelector( '.error-message' );
		errorMsg.innerText = error;
		self.toggleExplain( false );
		self.toggleSelects( false );
	}
	
	ns.SourceSelectPane.prototype.getSelected = function() {
		const self = this;
		const audioDevice = getSelectDevice(
			self[ self.audioId ],
			'audioinput'
		);
		const videoDevice = getSelectDevice(
			self[ self.videoId ],
			'videoinput'
		);
		
		let outputDevice = null;
		if ( self.supportsSinkId )
			outputDevice = getSelectDevice(
				self[ self.outputId ],
				'audiooutput'
			);
		
		const selected = {
			audioinput  : audioDevice,
			videoinput  : videoDevice,
			audiooutput : outputDevice || undefined,
		};
		
		if ( outputDevice )
			selected.audiooutput = outputDevice;
		
		return selected;
		
		function getSelectDevice( select, type ) {
			if ( !select )
				return null;
			
			const deviceId = select.value;
			if ( !deviceId.length )
				return null;
			
			if ( 'none' === deviceId )
				return false;
			
			if ( !self.allDevices )
				return null;
			
			const devs = self.allDevices[ type ];
			if ( !devs )
				return null;
			
			const device = devs[ deviceId ];
			return device || null;
		}
	}
	
	ns.SourceSelectPane.prototype.close = function() {
		const self = this;
		delete self.permissions;
		delete self.onselect;
		self.paneClose();
	}
	
	// Private
	
	ns.SourceSelectPane.prototype.build = function() {
		const self = this;
		self.sources = new library.rtc.MediaDevices();
		
		var tmplConf = {};
		var html = hello.template.get( 'select-source-tmpl', tmplConf );
		self.insertPane( html );
		
		self.bind();
		self.checkOutputSelectSupport();
	}
	
	ns.SourceSelectPane.prototype.bind = function() {
		const self = this;
		const bg = document.getElementById( self.paneId );
		self.previewEl = document.getElementById( 'source-preview-video' );
		self.previewHint = document.getElementById( 'source-preview-hint' );
		self.previewEl.muted = true;
		self.previewEl.preload = 'metadata';
		
		const element = document.getElementById( 'source-select' );
		const closeBtn = document.getElementById( 'source-back' );
		
		const applyBtn = document.getElementById( 'apply-select' );
		const discardBtn = document.getElementById( 'discard-select' );
		const refreshBtn = document.getElementById( 'refresh-select' );
		
		const errElement = document.getElementById( 'source-error' );
		const errAvailableBtn = errElement.querySelector( '.error-buttons .available' );
		const errIgnoreBtn = errElement.querySelector( '.error-buttons .ignore' );
		
		self.audioOutput = document.getElementById( 'audiooutput-container' );
		self.outputTestEl = document.getElementById( 'audiooutput-test' );
		self.avEl = document.getElementById( 'source-select-av-container' );
		
		closeBtn.addEventListener( 'click', closeClick, false );
		applyBtn.addEventListener( 'click', applyClick, false );
		refreshBtn.addEventListener( 'click', refreshClick, false );
		discardBtn.addEventListener( 'click', discardClick, false );
		
		errAvailableBtn.addEventListener( 'click', errShowAvailable, false );
		errIgnoreBtn.addEventListener( 'click', errIgnore, false );
		
		self.previewEl.onloadedmetadata = letsPlay;
		function letsPlay( e ) {
			self.previewEl.play();
		}
		
		function closeClick( e ) {
			self.done();
		}
		
		function applyClick( e ) {
			var selected = self.getSelected();
			self.done( selected );
		}
		
		function refreshClick( e ) {
			self.refreshDevices();
		}
		
		function discardClick( e ) {
			self.done();
		}
		
		function errShowAvailable( e ) {
			self.refreshDevices();
		}
		
		function errIgnore( e ) {
			self.done();
		}
	}
	
	ns.SourceSelectPane.prototype.checkOutputSelectSupport = function() {
		const self = this;
		if ( !self.outputTestEl )
			return;
		
		if ( !self.outputTestEl.setSinkId )
			return;
		
		self.audioOutput.classList.toggle( 'hidden', false );
		self.supportsSinkId = true;
	}
	
	ns.SourceSelectPane.prototype.refreshDevices = function( current ) {
		const self = this;
		self.clear();
		self.clearErrors();
		self.toggleExplain( true );
		self.toggleSelects( true );
		
		if ( current )
			self.currentDevices = current;
		
		self.sources.getByType()
			.then( show )
			.catch( showErr );
		
		function show( devices ) {
			self.allDevices = devices;
			self.populate();
		}
		
		function showErr( err ) {
			self.showMediaDevicesErr ( err );
		}
	}
	
	ns.SourceSelectPane.prototype.showMediaDevicesErr = function( err ) {
		const self = this;
		console.log( 'SourceSelectPane.showMediaDevicesErr', err.stack || err );
	}
	
	ns.SourceSelectPane.prototype.clearErrors = function() {
		const self = this;
		self.toggleExplain( true );
		self.toggleSelectError( self.audioId );
		self.toggleSelectError( self.videoId );
		self.toggleSelectError( self.outputId );
	}
	
	ns.SourceSelectPane.prototype.populate = function() {
		const self = this;
		setupAudio();
		setupVideo();
		
		if ( self.supportsSinkId )
			setupOutput();
		
		const selected = self.getSelected();
		self.setPreview( selected );
		
		function setupAudio() {
			var conf = {
				type    : self.audioId,
				errType : 'audio',
			};
			setupSelect( conf );
		}
		
		function setupVideo() {
			var conf = {
				type    : self.videoId,
				errType : 'video',
			};
			setupSelect( conf );
		}
		
		function setupOutput() {
			const conf = {
				type    : self.outputId,
				errType : 'output',
			};
			setupSelect( conf );
		}
		
		function setupSelect( conf ) {
			const devices = self.allDevices[ conf.type ];
			const deviceIds = Object.keys( devices );
			// no devices available
			if ( !deviceIds.length ) {
				self.toggleSelectError( conf.type, View.i18n('i18n_no_devices_detected'), true );
				return;
			}
			
			// Ignores blocked devices...
			if ( deviceIds.length === 1 ) {
				if ( deviceIds[ 0 ] === '' ) {
					self.toggleSelectError( conf.type,
							View.i18n('i18n_devices_detected_unavailable'),
						true );
					return;
				}
			}
			
			// add no select option to the list
			if ( conf.type !== self.outputId )
				devices[ 'none' ] = {
					label        : 'none',
					displayLabel : View.i18n( 'i18n_no_selection' ),
					kind         : conf.type,
					deviceId     : 'none',
				}
			
			const select = self.buildSelect( conf.type, devices );
			const containerId = conf.type + '-select';
			const container = document.getElementById( containerId );
			container.appendChild( select );
			self.bindSelect( select );
			self[ conf.type ] = select;
		}
	}
	
	// Set the preview video rect
	ns.SourceSelectPane.prototype.setPreview = function( selected ) {
		const self = this;
		self.clearPreview();
		let audioDevice = false;
		let videoDevice = false;
		let audioDeviceId = null;
		let videoDeviceId = null;
		
		// The selected has audio
		if ( selected.audioinput ) {
			const saD = selected.audioinput;
			const aiDev = self.allDevices.audioinput[ saD.deviceId ];
			if( aiDev && aiDev.deviceId )
			{
				audioDeviceId = aiDev.deviceId;
			}
		}
		
		// The selected has video
		if ( selected.videoinput ) {
			const svD = selected.videoinput;
			const viDev = self.allDevices.videoinput[ svD.deviceId ];
			if( viDev && viDev.deviceId )
			{
				videoDeviceId = viDev.deviceId;
			}
		}
		
		// If video device
		if ( audioDeviceId )
			audioDevice = { "deviceId" : audioDeviceId };
		
		// If audio device
		if ( videoDeviceId )
			videoDevice = { "deviceId" : videoDeviceId };
		
		const mediaConf = {
			audio : audioDevice,
			video : videoDevice
		};
		
		// No audio and video - just return
		if ( !mediaConf.audio && !mediaConf.video ) {
			togglePreviewHint( true );
			return;
		}
	   
		// Get user media depending on query 
		navigator.mediaDevices.getUserMedia( mediaConf )
			.then( setMedia )
			.catch( mediaErr );
		
		// Upon getting a media stream, set audio and or video
		function setMedia( stream ) {
			if ( mediaConf.audio ) {
				self.showAV( stream );
				self.checkAudioInput( stream );
			}
			
			// Get stream tracks
			const tracks = stream.getTracks();
			const hasVideo = tracks.some( isVideo );
			togglePreviewHint( !hasVideo );
			
			if( stream )
				self.previewEl.srcObject = stream;
			else
				self.previewEl.srcObject = null;
		}
		
		function mediaErr( err ) {
			console.log( 'preview media failed', err );
		}
		
		function togglePreviewHint( show ) {
			self.previewHint.classList.toggle( 'hidden', !show );
		}
		
		function isVideo( track ) {
			return 'video' === track.kind;
		}
	}
	
	ns.SourceSelectPane.prototype.clearPreview = function() {
		const self = this;
		self.closeAV();
		self.previewEl.pause();
		let srcObj = self.previewEl.srcObject;
		
		if ( !srcObj )
			return;
		
		var tracks = srcObj.getTracks();
		tracks.forEach( stop );
		self.previewEl.load();
		
		function stop( track ) {
			track.stop();
			if ( srcObj.removeTrack )
				srcObj.removeTrack( track );
		}
	}
	
	ns.SourceSelectPane.prototype.showAV = function( stream ) {
		const self = this;
		self.volume = new library.rtc.Volume(
			stream,
			null,
			null
		);
		
		self.AV = new library.view.AudioVisualizer(
			self.volume,
			hello.template,
			'source-select-av-container'
		);
	}
	
	ns.SourceSelectPane.prototype.closeAV = function() {
		const self = this;
		if ( self.AV )
			self.AV.close();
		
		if ( self.volume )
			self.volume.close();
		
		delete self.AV;
		delete self.volume;
	}
	
	// Check audio device
	ns.SourceSelectPane.prototype.checkAudioInput = function( stream ) {
		const self = this;
		const audioIcon = document.getElementById( 'audioinput-icon' );
		const checkIcon = document.getElementById( 'audioinput-checking' );
		showChecking( true );
		new library.rtc.AudioInputDetect( stream )
			.then( checkBack )
			.catch( checkErr );
		
		function checkBack( hasInput ) {
			showChecking( false );
			if ( !hasInput )
				self.toggleSelectError( 'audioinput', 'No inputs' );
		}
		
		function checkErr( err ) {
			console.log( 'checkAudiooInput - checkErr', err );
			self.toggleSelectError( 'audioinput', err );
		}
		
		function showChecking( show ) {
			audioIcon.classList.toggle( 'hidden', show );
			checkIcon.classList.toggle( 'hidden', !show );
		}
	}
	
	// Set the audio device
	ns.SourceSelectPane.prototype.setAudioSink = function( selected ) {
		const self = this;
		if ( !self.previewEl )
			return;
		
		const sD = selected[ 'audiooutput' ];
		const dev = self.allDevices.audiooutput[ sD.deviceId ];
		
		if ( !dev )
			return;
		
		self.previewEl.setSinkId( dev.deviceId )
			.then( ok )
			.catch( fail );
			
		function ok() {
			//console.log( 'source select - sink id set', self.previewEl.sinkId );
		}
		
		function fail( err ) {
			console.log( 'source select - failed to set sink id', err.stack || err );
		}
	}
	
	// Bind select element
	ns.SourceSelectPane.prototype.bindSelect = function( element ) {
		const self = this;
		element.addEventListener( 'change', selectChange, false );
		function selectChange( e ) {
			const selected = self.getSelected();
			if ( 'source-select-audiooutput' === e.target.id ) {
				self.setAudioSink( selected );
			}
			else {
				self.setPreview( selected );
			}
		}
	}
	
	// Build select options
	ns.SourceSelectPane.prototype.buildSelect = function( type, devices ) {
		const self = this;
		const dIds = Object.keys( devices );
		const options = dIds.map( dId => {
			const dev = devices[ dId ];
			const optStr = buildOption( dev );
			return optStr;
		});
		
		const selectConf = {
			type : type,
			name : type,
			optionsHtml : options.join(),
		};
		const selectElement = hello.template.getElement( 'source-select-tmpl', selectConf );
		
		return selectElement;
		
		function buildOption( item ) {
			let selected = '';
			const label = ( item.label && item.label.length ) ? item.label : item.labelExtra;
			
			// if there is a device dfined..
			if ( self.currentDevices && self.currentDevices[ item.kind ] ) {
				var currDev = self.currentDevices[ item.kind ];
				// ..check if its this one
				if ( currDev.deviceId === item.deviceId )
					selected = 'selected';
			} else {
				// ..no device defined, so check if this is the 'no select' or default entry
				if ( ( label === 'none' ) || ( 'default' === item.deviceId ) )
					selected = 'selected';
				
			}
			
			const optionConf = {
				value    : item.deviceId,
				selected : selected,
				label    : item.displayLabel || label
			};
			const html = hello.template.get( 'source-select-option-tmpl', optionConf );
			return html;
		}
	}
	
	ns.SourceSelectPane.prototype.toggleExplain = function( show ) {
		const self = this;
		//var explainElement = document.getElementById( 'source-explain' );
		const errorElement = document.getElementById( 'source-error' );
		//explainElement.classList.toggle( 'hidden', !show );
		errorElement.classList.toggle( 'hidden', show );
	}
	
	ns.SourceSelectPane.prototype.toggleSelects = function( show ) {
		const self = this;
		var selects = document.getElementById( 'source-input' );
		selects.classList.toggle( 'hidden', !show );
	}
	
	ns.SourceSelectPane.prototype.toggleSelectError = function( type, errorMessage, hideSelect ) {
		const self = this;
		var hideSelect = !!hideSelect;
		var hasErr = !!errorMessage;
		var selectId = type + '-select';
		var errorId = type + '-error';
		var selectElement = document.getElementById( selectId );
		var errorElement = document.getElementById( errorId );
		
		selectElement.classList.toggle( 'hidden', hideSelect );
		errorElement.innerText = errorMessage;
		errorElement.classList.toggle( 'hidden', !hasErr );
	}
	
	ns.SourceSelectPane.prototype.clear = function() {
		const self = this;
		var clear = [
			self.audioId,
			self.videoId,
			self.outputId,
		];
		
		clear.forEach( remove );
		function remove( type ) {
			var id = 'source-select-' + type;
			var element = document.getElementById( id );
			if ( !element )
				return;
			
			element.parentNode.removeChild( element );
		}
	}
	
	ns.SourceSelectPane.prototype.done = function( selected ) {
		const self = this;
		self.clearPreview();
		self.hide();
		if ( selected )
			selected = getChanged( selected );
		
		self.onselect( selected );
		
		function getChanged( sel ) {
			const curr = self.currentDevices;
			if ( sel.audioinput === curr.audioinput )
				sel.audioinput = null;
			if ( self.videoinput === curr.videoinput )
				sel.videoinput = null;
			if ( sel.audiooutput === curr.audiooutput )
				sel.audiooutput = null;
			
			return sel;
		}
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.ChatPane = function( paneConf ) {
		if ( !( this instanceof ns.ChatPane ))
			return new ns.ChatPane( paneConf );
		
		const self = this;
		self.chat = null;
		
		library.component.UIPane.call( self, paneConf );
		
		const conf = paneConf.conf;
		conf.containerId = 'chat-pane';
		self.chat = new library.component.LiveChat(
			conf,
			hello.template
		);
		
		// .build() replaces .init() and is called from UIPane
	}
	
	ns.ChatPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.ChatPane.prototype.msg = function( data ) {
		const self = this;
		self.chat.handleEvent( data );
		//self.handleEvent( data );
	}
	
	ns.ChatPane.prototype.baseShow = ns.ChatPane.prototype.show;
	ns.ChatPane.prototype.show = function() {
		const self = this;
		self.baseShow();
		self.chat.show();
	}
	
	ns.ChatPane.prototype.baseHide = ns.ChatPane.prototype.hide;
	ns.ChatPane.prototype.hide = function() {
		const self = this;
		self.baseHide();
		self.chat.hide();
	}
	
	ns.ChatPane.prototype.toggleSay = function( force ) {
		const self = this;
		console.log( 'toggleSay', force );
	}
	
	// Pirvate
	
	ns.ChatPane.prototype.build = function() {
		const self = this;
		const html = hello.template.get( 'chat-pane-tmpl', {});
		self.insertPane( html );
		
		// bind close when clicking 'outside' chat
		var chatBg = document.getElementById( self.paneId );
		chatBg.addEventListener( 'click', bgClick, false );
		function bgClick( e ) {
			if ( e.target.id !== self.paneId )
				return;
			
			e.stopPropagation();
			self.hide();
		}
		
		//
		self.closeBtn = document.getElementById( 'chat-pane-close' );
		self.closeBtn.addEventListener( 'click', closeChat, false );
		function closeChat( e ) { self.hide(); }
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.SettingsPane = function( paneConf ) {
		if ( !( this instanceof ns.SettingsPane ))
			return new ns.SettingsPane( paneConf );
		
		const self = this;
		var conf = paneConf.conf;
		self.onsave = conf.onsave;
		
		self.settingUpdateMap = {};
		
		library.component.UIPane.call( self, paneConf );
	}
	
	ns.SettingsPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// public
	
	ns.SettingsPane.prototype.update = function( update ) {
		const self = this;
		var handler = self.settingUpdateMap[ update.setting ];
		if ( !handler ) {
			console.log( 'no handler for setting', update );
			return;
		}
		
		handler( update );
	}
	
	ns.SettingsPane.prototype.build = function() {
		const self = this;
		var html = hello.template.get( 'room-settings-pane-tmpl', {});
		self.insertPane( html );
		self.bind();
	}
	
	ns.SettingsPane.prototype.bind = function() {
		const self = this;
		var closeBtn = document.getElementById( 'room-settings-close' );
		closeBtn.addEventListener( 'click', closeClick, false );
		function closeClick( e ) {
			self.hide();
		}
		
		self.bindPeerLimit();
		self.bindIsPublic();
	}
	
	ns.SettingsPane.prototype.bindPeerLimit = function() {
		const self = this;
		var element = document.getElementById( 'setting-peer-limit' );
		var unlimited = '∞';
		var range = element.querySelector( '.range input' );
		var value = element.querySelector( '.value input' );
		range.addEventListener( 'input', rangeInput, false );
		range.addEventListener( 'change', rangeChange, false );
		value.addEventListener( 'change', valueChange, false );
		
		self.settingUpdateMap[ 'peerlimit' ] = onUpdate;
		set( 0 );
		
		function rangeInput( e ) {
			e.stopPropagation();
			var num = parse( range.value );
			value.value = num || unlimited;
		}
		
		function rangeChange( e ) {
			e.stopPropagation();
			save( range.value );
		}
		
		function valueChange( e ) {
			e.stopPropagation( e );
			save( value.value );
		}
		
		function save( num ) {
			num = parse( num );
			self.onsave( 'peerlimit', num );
			set( num );
		}
		
		function onUpdate( update ) {
			set( update.value );
		}
		
		function set( num ) {
			range.value = num || 13;
			value.value = num || unlimited;
		}
		
		function parse( num ) {
			num = parseInt( num, 10 );
			if ( !num )
				num = 0;
			
			if ( num < 1 )
				num = 1;
			
			if ( num > 12 )
				num = 0;
			
			return num;
		}
	}
	
	ns.SettingsPane.prototype.bindIsPublic = function() {
		const self = this;
		var element = document.getElementById( 'setting-is-public' );
		var input = element.querySelector( '.check input' );
		input.addEventListener( 'change', onChange, false );
		self.settingUpdateMap[ 'ispublic' ] = onUpdate;
		
		function onChange( e ) {
			e.stopPropagation();
			self.onsave( 'ispublic', input.checked );
		}
		
		function onUpdate( update ) {
			input.checked = update.value;
		}
	}
	
})( library.view );
