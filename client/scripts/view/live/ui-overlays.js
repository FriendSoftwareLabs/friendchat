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

/*
	Overlay is defined in components/viewComponents.js
*/

// Share link
(function( ns, undefined ) {
	ns.ShareLink = function( anchor, conn ) {
		const self = this;
		self.conn = conn;
		const conf = {
			css      : 'std-overlay grad-bg-down',
			show     : false,
			position : {
				outside : {
					parent  : 'top-right',
					self    : 'bottom-right',
					offsetX : -5,
					offsetY : -10,
				},
			},
		};
		library.component.Overlay.call( self, anchor, conf );
		
	}
	
	ns.ShareLink.prototype = 
		Object.create( library.component.Overlay.prototype );
	
	ns.ShareLink.prototype.close = function() {
		const self = this;
		if ( self.share )
			self.share.close();
		
		delete self.share;
		
		self.closeOverlay();
	}
	
	ns.ShareLink.prototype.build = function() {
		const self = this;
		const el = hello.template.getElement( 'live-overlay-share-tmpl', {});
		return el;
	}
	
	ns.ShareLink.prototype.bind = function() {
		const self = this;
		const conf = {
			conn : self.conn,
		};
		self.share = new library.component.ShareLink( conf );
		const closeBtn = document.getElementById( 'share-close-inline' );
		closeBtn.addEventListener( 'click', close, false );
		
		function close( e ) {
			self.hide();
		}
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.DeviceSelect = function( anchor, onSelect ) {
		const self = this;
		self.onSelect = onSelect;
		const conf = {
			css      : 'std-overlay grad-bg-down',
			show     : false,
			position : {
				outside : {
					parent  : 'top-right',
					self    : 'bottom-right',
					offsetX : -5,
					offsetY : -10,
					height  : 5,
					width   : null,
				},
			},
		};
		library.component.Overlay.call( self, anchor, conf );
	}
	
	ns.DeviceSelect.prototype = 
		Object.create( library.component.Overlay.prototype );
		
	// Public
		
	ns.DeviceSelect.prototype.showDevices = function( devices ) {
		const self = this;
		console.log( 'showDevices', devices );
		self.ui.showDevices( devices );
	}
	
	ns.DeviceSelect.prototype.close = function() {
		const self = this;
		if ( self.ui )
			self.ui.close();
		
		delete self.ui;
		
		self.closeOverlay();
	}
	
	// called by Overlay
	
	ns.DeviceSelect.prototype.build = function() {
		const self = this;
		const tmplConf = {};
		const el = hello.template.getElement( 'select-source-tmpl', tmplConf );
		return el;
	}
	
	ns.DeviceSelect.prototype.bind = function() {
		const self = this;
		self.ui = new library.view.SourceSelect( self.onSelect );
		delete self.onSelect;
	}
	
})( library.view );

// init checks
(function( ns, undefined ) {
	ns.StatusMsg = function() {
		const self = this;
		const anchor = document.body;
		const conf = {
			show     : true,
			position : {
				inside  : {
					cover   : false,
					parent  : 'bottom-center',
					self    : 'bottom-center',
					offsetX : 0,
					offsetY : 52,
					maxX    : '20em',
				},
			},
		};
		library.component.Overlay.call( self, anchor, conf );
		self.status = {};
		
		self.init();
	}
	
	ns.StatusMsg.prototype =
		Object.create( library.component.Overlay.prototype );
	
	// Public
	
	/*
	STATE : 
		type    : 'error' | 'warning' | 'success | 'info'
		message : <msg code>, it will be translaterd from .statusStrings{},
		events  : an [] of events that will be shown as buttons
		
	ID : <string> optional if a specific status id is required
	
	RETURNS <string>statusId
	
	StatusMsg will emit events for the statusId when buttons are clicked
	*/
	
	ns.StatusMsg.prototype.showStatus = function( state, id ) {
		const self = this;
		id = id || friendUP.tool.uid( 'status' );
		const conf = {
			title   : self.getTitle( state.title ? state.title : state.type ),
			content : self.getStatusMessage( state.message ),
		};
		self.buildStatus( id, conf, state.events );
		self.setState( id, state );
		
		return id;
	}
	
	ns.StatusMsg.prototype.updateStatus = function( statusId, state ) {
		const self = this;
		console.log( 'StatusMsg.updateStatus - NYI', state );
	}
	
	ns.StatusMsg.prototype.removeStatus = function( statusId ) {
		const self = this;
		const status = self.status[ statusId ];
		if ( !status )
			return;
		
		delete self.status[ statusId ];
		status.el.parentNode.removeChild( status.el );
		delete status.el;
		self.release( statusId );
		self.updatePosition();
	}
	
	ns.StatusMsg.prototype.updateBrowserCheck = function( state ) {
		const self = this;
		const id = 'browser-check';
		if ( !self.status[ id ])
			buildStatus( state.type, state.data );
		
		self.setState( id, state );
		
		function buildStatus( type, checks ) {
			const supId = 'browser-support-check';
			const secId = 'browser-secure-check';
			const capsId = 'browser-capabilities-check';
			const sup = checks[ supId ];
			const sec = checks[ secId ];
			const caps = checks[ capsId ];
			const capsHTML = buildCaps( caps );
			const conf = {
				supportIcon : self.getStatusIcon( sup.type ),
				supportMsg  : self.getStatusMessage( sup.message ),
				secureIcon  : self.getStatusIcon( sec.type ),
				secureMsg   : self.getStatusMessage( sec.message ),
				capsHTML    : capsHTML,
			};
			const content = self.buildContent( id, conf );
			const statusConf = {
				type    : type,
				title   : self.getTitle( id ),
				content : content,
			};
			self.buildStatus( id, statusConf );
			const el = document.getElementById( id );
			const continueBtn = document.getElementById( 'browser-check-continue' );
			const closeBtn = document.getElementById( 'browser-check-close-live' );
			if ( 'warning' === type )
				continueBtn.classList.toggle( 'hidden', false );
			
			continueBtn.addEventListener( 'click', e => self.emitContinue( id ), false );
			closeBtn.addEventListener( 'click', e => self.emitCloseLive( id ), false );
			
			toggle( sup );
			toggle( sec );
			toggle( caps );
			
			function buildCaps( conf ) {
				const caps = conf.data;
				const keys = Object.keys( caps );
				const htmls = keys.map( getHTMLfor );
				return htmls.join( '' );
				
				function getHTMLfor( cap ) {
					const ok = caps[ cap ];
					const conf = {
						faIcon    : ok ? 'fa-check' : 'fa-close',
						typeKlass : ok ? 'icon-nominal' : 'icon-error',
						name      : cap,
					};
					const html = hello.template.get( 'status-browser-capa-tmpl', conf );
					return html;
				}
			}
			
			function toggle( check ) {
				if ( 'success' == check.type )
					return;
				
				const el = document.getElementById( check.id );
				el.classList.toggle( 'hidden', false );
			}
		}
	}
	
	ns.StatusMsg.prototype.updateHostSignal = function( state ) {
		const self = this;
		const id = 'host-signal-check';
		self.setState( id, state );
	}
	
	ns.StatusMsg.prototype.updateRoomSignal = function( state ) {
		const self = this;
		const id = 'room-signal-check';
		self.setState( id, state );
	}
	
	ns.StatusMsg.prototype.updateICEServers = function( state ) {
		const self = this;
		const id = 'ice-servers-check';
		if ( !self.status[ id ])
			buildStatus( state.errors );
		
		self.setState( id, state );
		
		function buildStatus( errors ) {
			const message = self.getStatusMessage( state.message );
			const servers = build( errors );
			const conf = {
				message : message,
				servers : servers,
			}
			const content = hello.template.get( 'status-ice-tmpl', conf );
			const title = self.getTitle( id );
			const sConf = {
				type    : state.type,
				title   : title,
				content : content,
			};
			const events = [
				'continue',
			];
			
			self.buildStatus( id, sConf, events );
			
			function build( errors ) {
				const htmls = errors.map( err => {
					const errMsg = self.getStatusMessage( err.err );
					const host = err.server.urls[ 0 ];
					const conf = {
						errMsg : errMsg,
						host   : host,
					};
					const html = hello.template.get( 'status-ice-host-tmpl', conf );
					return html;
				});
				
				return htmls.join( '' );
			}
		}
	}
	
	ns.StatusMsg.prototype.updateAudioInput = function( state ) {
		const self = this;
		const id = 'audio-input-check';
		if ( !self.status[ id ])
			buildStatus( state.type );
		
		self.setState( id, state );
		const message = self.getStatusMessage( state.message );
		const el = document.getElementById( id );
		const msgEl = el.querySelector( '.status-explain' );
		msgEl.textContent = message;
		self.updatePosition();
		const status = self.status[ id ];
		if ( 'success' === state.type ) {
			const butts = [
				'ok',
				'ignore',
			];
			self.showButtons( id, butts );
		}
		
		if ( 'error' === state.type || 'warning' === state.type ) {
			const butts = [
				//'ignore',
				'source-select',
				'ignore',
				//'close-live',
			];
			console.log( 'butts', butts );
			self.showButtons( id, butts );
		}
		
		return id;
		
		function buildStatus( type ) {
			const title = self.getTitle( id );
			const conf =  {
				message : '',
			};
			const content = self.buildContent( id, conf );
			const statusConf = {
				type    : type,
				title   : title,
				content : content,
			};
			const events = [
				//'ignore',
				'source-select',
				'ignore',
				//'close-live',
			];
			self.buildStatus( id, statusConf, events );
		}
	}
	
	ns.StatusMsg.prototype.updateVideoInput = function( state ) {
		const self = this;
		const id = 'video-input-check';
		self.setState( id, state );
	}
	
	ns.StatusMsg.prototype.updateDevicesCheck = function( state ) {
		const self = this;
		const id = 'devices-check';
		if ( !self.status[ id ])
			buildStatus();
		
		self.setState( id, state );
		
		function buildStatus() {
			const title = self.getTitle( id );
			const content = self.getStatusMessage( state.message );
			const conf = {
				type    : state.type,
				title   : title,
				content : content,
			};
			const events = [
				'continue',
				'close-live',
			];
			self.buildStatus( id, conf, events );
		}
	}
	
	ns.StatusMsg.prototype.updateSelfieCheck = function( state ) {
		const self = this;
		const id = 'source-check';
		if ( !self.status[ id ])
			buildStatus();
		
		self.setState( id, state );
		
		function buildStatus() {
			const content = self.getStatusMessage( state.message );
			const title = self.getTitle( id );
			const conf = {
				title   : title,
				content : content,
			};
			const events = [
				'close-live',
			];
			self.buildStatus( id, conf, events );
			const el = document.getElementById( id );
		}
	}
	
	ns.StatusMsg.prototype.close = function() {
		const self = this;
		self.emit( 'close' );
		self.closeOverlay();
	}
	
	// Private
	
	ns.StatusMsg.prototype.stateMap = {
		'error'   : {
			faIcon     : 'fa-exclamation-triangle',
			//iconClass  : 'init-error',
			stateClass : 'danger',
		},
		'warning' : {
			faIcon     : 'fa-exclamation-circle',
			//iconClass  : 'init-warning',
			stateClass : 'warning',
		},
		'success' : {
			faIcon     : 'fa-check',
			//iconClass  : 'init-nominal',
			stateClass : 'success',
		},
		'info'    : {
			faIcon     : 'fa-info-circle',
			stateClass : 'info',
		},
	};
	
	ns.StatusMsg.prototype.buttonMap = {
		'close'         : {
			event   : 'close',
			type    : '',
			faClass : 'fa-close',
			label   : 'i18n_close'
		},
		'close-live'    : {
			event   : 'close-live',
			type    : '',
			faClass : 'fa-close',
			label   : 'i18n_close_live'
		},
		'continue'      : {
			event   : 'continue',
			type    : '',
			faClass : 'fa-exclamation-circle',
			label   : 'i18n_continue'
		},
		'ignore'        : {
			event   : 'ignore',
			type    : '',
			faClass : 'fa-eye-slash',
			label   : 'i18n_dont_show_again',
		},
		'accept'        : {
			event   : 'accept',
			type    : '',
			faClass : 'fa-check',
			label   : 'i18n_great',
		},
		'ok'            : {
			event   : 'ok',
			type    : '',
			faClass : 'fa-check',
			label   : 'i18n_ok',
		},
		'source-select' : {
			event   : 'source-select',
			type    : '',
			faClass : 'fa-random',
			label   : 'i18n_select_media'
		},
	}
	
	ns.StatusMsg.prototype.templateMap = {
		'audio-input-check' : 'media-fail-tmpl',
		'browser-check'     : 'status-browser-check-tmpl',
	}
	
	ns.StatusMsg.prototype.titleMap = {
		'error'             : 'i18n_error',
		'warning'           : 'i18n_warning',
		'success'           : 'i18n_success',
		'info'              : 'i18n_info',
		'access-blocked'    : 'i18n_check_browser_settings',
		'audio-input-check' : 'i18n_audio_issue',
		'browser-check'     : 'i18n_browser_issue',
		'source-check'      : 'i18n_media_issue',
		'device-check'      : 'i18n_device_issue',
		'ice-servers-check' : 'i18n_ice_issue',
	}
	
	ns.StatusMsg.prototype.statusStrings = {
		'ERR_ENUMERATE_DEVICES_FAILED' :
			'i18n_err_enumerate_devices_failed',
			
		'ERR_NO_DEVICES_BLOCKED'       :
			'i18n_err_devices_blocked',
			
		'ERR_NO_DEVICES_FOUND'         :
			'i18n_err_no_devices_found',
			
		'ERR_GUM_NOT_ALLOWED'          :
			'i18n_access_to_microphone_and_camera_is_blocked',
			
		'ERR_HTTPS_REQUIRED'           :
			'i18n_err_https_required',
			
		'ERR_GUM_NO_MEDIA'             :
			'i18n_err_getusermedia_no_media',
			
		'ERR_GUM_ERROR'                :
			'i18n_err_getusermedia_error',
			
		'ERR_SYSTEM_MUTE'              :
			'i18n_microphone_muted_outside_friendchat',
			
		'ERR_NO_SUPPORT'               :
			'i18n_your_browser_is_not_supported',
		
		'ERR_SELF_NO_MEDIA'            :
			'i18n_getusermedia_did_not_return_media',
			
		'ERR_NO_TURN'                  :
			'i18n_no_turn_server_could_be_reached_limited_connectivity',
		
		'ERR_HOST_TIMEOUT'             :
			'i18n_host_could_not_be_reached',
			
		'WARN_AUDIO_SINK_NOT_ALLOWED'   :
			'i18n_setting_audio_output_was_rejected_by_browser_\
you_might_not_be_able_to_hear_anyone_please_check_your\
_browser_audio_permissions',

		'WARN_GUM_BLOCKED'             :
			'i18n_media_access_is_blocked_in_browser_\
if_this_is_not_inteninal_check_your_browser_settings_for_this_site',
			
		'WARN_STUN_ERRORS'             :
			'i18n_stun_servers_could_not_be_reached_limited_connectivity',
			
		'WARN_NO_AUDIO'                :
			'i18n_no_input_is_detected_from_mic',
		
		'WARN_NO_DEVICE_AUDIO'         :
			'i18n_could_not_find_any_microphone',
		
		'WARN_NO_DEVICE_VIDEO'         :
			'i18n_could_not_find_any_camera',
		
		'WARN_NO_DEVICES'              :
			'i18n_could_not_find_any_microphone_or_camera',
		
		'WARN_EXPERIMENTAL_SUPPORT'    : 
			'i18n_your_browser_is_not_fully_supported_things_may_not_behave_as_they_should',
		
		'SUCC_ITS_FINE'                :
			'i18n_nm_its_fine',
		
		'INFO_GUM_BLOCKED'             :
			'i18n_mic_and_camera_is_blocked_in_the_browser_check_your_settings_\
for_this_site_if_this_is_not_intended',
			
		'INFO_GUM_BLOCKED_AUDIO'       :
			'i18n_microhpone_is_blocked_in_the_browser_check_your_settings_for_\
this_site_if_this_is_not_intended',
			
		'INFO_GUM_BLOCKED_VIDEO'       :
			'i18n_camera_is_blocked_in_the_browser_check_your_settings_for_this_\
site_if_this_is_not_intended',
			
	};
	
	ns.StatusMsg.prototype.init = function() {
		const self = this;
		//console.log( 'StatusMsg.init' );
	}
	
	ns.StatusMsg.prototype.build = function() {
		const self = this;
		self.id = friendUP.tool.uid( 'status' );
		const conf = {
			id : self.id,
		};
		self.statusEl = hello.template.getElement( 'status-main-tmpl', conf );
		return self.statusEl;
	}
	
	ns.StatusMsg.prototype.bind = function() {
		const self = this;
	}
	
	ns.StatusMsg.prototype.buildStatus = function( statusId, conf, events ) {
		const self = this;
		if ( self.status[ statusId ])
			return null;
		
		events = events || [];
		const buttons = buildButtons( events );
		const tmplConf = {
			id      : statusId,
			title   : conf.title || '',
			content : conf.content || '',
			buttons : buttons,
		};
		const sEl = hello.template.getElement( 'status-msg-tmpl', tmplConf );
		self.statusEl.appendChild( sEl );
		
		const status = {
			id     : statusId,
			el     : sEl,
			events : events,
		};
		self.status[ statusId ] = status;
		bindButtons( sEl, events, statusId );
		self.updatePosition();
		
		return statusId;
		
		function buildButtons( events ) {
			const htmls = events.map( event => {
				const buttConf = self.buttonMap[ event ];
				const conf = {
					event   : buttConf.event,
					type    : buttConf.type,
					faClass : buttConf.faClass,
					label   : View.i18n( buttConf.label ),
				};
				const html = hello.template.get( 'status-button-tmpl', conf );
				return html;
			});
			
			return htmls.join( '' );
		}
		
		function bindButtons( sEl, events, id ) {
			events.forEach( event => {
				const statusKlass = '.status-' + event;
				const btn = sEl.querySelector( statusKlass );
				btn.addEventListener( 'click', e => self.emitStatusEvent( id, event ), false );
			});
		}
	}
	
	ns.StatusMsg.prototype.showButtons = function( sId, butts ) {
		const self = this;
		const status = self.status[ sId ];
		if ( !status )
			return;
		
		const curr = status.events;
		const hide = curr.filter( c => {
			return !butts.some( b => b === c );
		});
		const show = butts.filter( b => {
			return !curr.some( c => c === b );
		});
		
		const buttRow = status.el.querySelector( '.status-msg-actions' );
		hide.forEach( event => toggle( buttRow, event, false ));
		show.forEach( event => toggle( buttRow, event, true ));
		status.events = butts;
		
		function toggle( parent, event, show ) {
			const klass = '.status-' + event;
			const el = parent.querySelector( klass );
			if ( !el )
				return;
			
			el.classList.toggle( 'hidden', !show );
		}
	}
	
	ns.StatusMsg.prototype.setState = function( statusId, state ) {
		const self = this;
		const status = self.status[ statusId ];
		if ( !status )
			return;
		
		const type = state.type;
		const el = status.el;
		const s = el.querySelector( '.status-icon' );
		const i = s.querySelector( 'i' );
		
		if ( status.current ) {
			const curr = self.stateMap[ status.current ];
			toggle( curr, false );
		}
		
		const update = self.stateMap[ type ];
		toggle( update, true );
		status.current = type;
		
		function toggle( state, show ) {
			if ( state.stateClass )
				s.classList.toggle( state.stateClass, show );
			if ( state.faIcon )
				i.classList.toggle( state.faIcon, show );
		}
	}
	
	ns.StatusMsg.prototype.getTitle = function( titleId ) {
		const self = this;
		let titleStr = self.titleMap[ titleId ] || null;
		if ( !titleStr )
			return null;
		
		return View.i18n( titleStr );
	}
	
	ns.StatusMsg.prototype.buildContent = function( statusId, conf ) {
		const self = this;
		const tmpl = self.templateMap[ statusId ];
		const html = hello.template.get( tmpl, conf );
		return html;
	}
	
	ns.StatusMsg.prototype.getStatusMessage = function( statusCode ) {
		const self = this;
		const i18nString = self.statusStrings[ statusCode ] || ( 'i18n_' + statusCode );
		return View.i18n( i18nString );
	}
	
	ns.StatusMsg.prototype.getStatusIcon = function( type ) {
		const self = this;
		if ( 'error' === type )
			return 'fa-close';
		if ( 'warning' === type )
			return 'fa-exclamation-circle';
		if ( 'success' === type )
			return 'fa-check';
	}
	
	ns.StatusMsg.prototype.emitStatusEvent = function( statusId, event ) {
		const self = this;
		self.emit( statusId, event );
	}
	
	ns.StatusMsg.prototype.emitCloseLive = function( statusId ) {
		const self = this;
		self.emit( statusId, 'close-live' );
	}
	
	ns.StatusMsg.prototype.emitClose = function( statusId ) {
		const self = this;
		self.emit( statusId, 'close' );
		self.removeStatus( statusId );
	}
	
	ns.StatusMsg.prototype.emitSourceSelect = function( statusId ) {
		const self = this;
		self.emit( statusId, 'source-select' );
	}
	
	ns.StatusMsg.prototype.emitContinue = function( statusId ) {
		const self = this;
		self.emit( statusId, 'continue' );
	}
	
})( library.view );

