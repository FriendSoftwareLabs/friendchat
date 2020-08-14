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

// UI for live session
(function( ns, undefined ) {
	ns.UI = function( conn, liveConf, localSettings, live ) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.conn = conn;
		self.userId = liveConf.userId;
		self.isPrivate = liveConf.isPrivate;
		self.isTempRoom = liveConf.isTempRoom;
		self.localSettings = localSettings;
		self.guestAvatar = liveConf.guestAvatar;
		self.speaking = liveConf.rtcConf.speaking;
		self.rtc = null;
		self.peerGridId = 'peer-grid';
		self.peerListId = 'peer-list';
		self.peers = {};
		self.peerIds = [];
		self.peerGridOrder = [];
		
		self.resizeWait = null;
		self.reorder = {
			sourceIndex : null,
			targetIndex : null,
		};
		self.isReordering = false;
		self.peerAddQueue = [];
		
		self.uiVisible = true;
		self.ui = null;
		self.uiPanes = {};
		self.panesVisible = 0;
		self.audioSinkId = null;
		
		self.isVoiceOnly = false;
		self.isVoiceListLarge = false;
		
		self.init();
	}
	
	ns.UI.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.UI.prototype.setBrowser = function( browser ) {
		const self = this;
		self.browser = browser;
		
		if ( 'DESKTOP' !== window.View.deviceType )
			return;
		
		const b = self.browser;
		if ( 'chrome' === b
			|| 'firefox' === b
			|| 'safari' === b
		) {
			self.screenShareBtn.classList.toggle( 'hidden', false );
		}
	}
	
	ns.UI.prototype.setAudioSink = function( deviceId ) {
		const self = this;
		self.audioSinkId = deviceId;
		const pids = Object.keys( self.peers );
		pids.forEach( setSinkId );
		function setSinkId( peerId ) {
			let peer = self.peers[ peerId ];
			peer.setAudioSink( self.audioSinkId );
		}
	}
	
	ns.UI.prototype.restartAudioSinks = function() {
		const self = this;
		self.peerIds.forEach( pId => {
			const peer = self.peers[ pId ];
			peer.updateAudioSink();
		});
	}
	
	ns.UI.prototype.showDeviceSelect = function( currentDevices ) {
		const self = this;
		self.settingsUI.showDevices( currentDevices )
		self.settingsUI.show();
	}
	
	ns.UI.prototype.addShareLink = function( conn ) {
		const self = this;
		if ( !self.shareLinkBtn ) {
			console.log( 'Live UI.addShareLink, no button found' );
			return;
		}
		
		if ( self.shareLink )
			return;
		
		self.shareLinkBtn.classList.toggle( 'hidden', false );
		self.shareLink = new library.view.ShareLink( self.shareLinkBtn, conn );
		self.shareLink.on( 'visible', onVisible );
		
		self.shareLinkBtn.addEventListener( 'click', click, false );
		return self.shareLink;
		
		function onVisible( isVisible ) {
			self.shareLinkBtn.classList.toggle( 'available', isVisible );
		}
		
		function click( e ) {
			self.shareLink.toggle();
		}
	}
	
	ns.UI.prototype.setRecording = function( isRecording ) {
		const self = this;
		if ( isRecording === self.isRecording )
			return;
		
		self.isRecording = isRecording;
		if ( !self.recording )
			return;
		
		self.recording.classList.toggle( 'hidden', !self.isRecording );
	}
	
	ns.UI.prototype.setModePresentation = function( presenterId, isPresenter ) {
		const self = this;
		console.log( 'setModePresentation', presenterId );
		if ( isPresenter )
			presenterId = 'selfie';
		
		self.presenterId = presenterId;
		
		self.menu.disable( 'dragger' );
		self.menu.disable( 'mode-speaker' );
		self.menu.disable( 'send-receive' );
		if ( !isPresenter )
			self.menu.disable( 'mode-presentation' );
		
		self.menu.setState( 'mode-presentation', true );
		self.updateMenuItems();
		self.updateDisplayMode();
	}
	
	ns.UI.prototype.clearModePresentation = function() {
		const self = this;
		self.menu.enable( 'dragger' );
		self.menu.enable( 'mode-speaker' );
		self.menu.enable( 'send-receive' );
		self.menu.enable( 'mode-presentation', true );
		
		self.menu.setState( 'mode-presentation', false );
		
		self.presenterId = null;
		self.updateDisplayMode();
		self.updateMenuItems();
	}
	
	ns.UI.prototype.setModeFollowSpeaker = function( isActive ) {
		const self = this;
		if ( self.showThumbs === isActive )
			return;
		
		self.showThumbs = isActive;
		self.updateMenuItems();
		self.updateDisplayMode();
	}
	
	ns.UI.prototype.setUseRoundBois = function( useRoundBois ) {
		const self = this;
		self.saveLocalSetting( 'use_round_bois', !!useRoundBois );
		if ( self.thumbGrid )
			self.thumbGrid.useRoundBois( useRoundBois );
	}
	
	// Private
	
	ns.UI.prototype.init = function( conf ) {
		const self = this;
		self.uiPaneMap = {
			'init-checks'        : library.view.InitChecksPane      ,
			'source-select'      : library.view.SourceSelectPane    ,
			'change-username'    : library.view.ChangeUsernamePane  ,
			'live-stream-switch' : library.view.LiveStreamSwitchPane,
			'ext-connect'        : library.view.ExtConnectPane      ,
			'settings'           : library.view.SettingsPane        ,
			'share'              : library.view.SharePane           ,
			'menu'               : library.view.MenuPane            ,
			'chat'               : library.view.ChatPane            ,
		};
		
		if ( self.speaking )
			self.setSpeaker( self.speaking );
		
		self.bindEvents();
		//const peersEl = document.getElementById( self.ui );
		self.thumbGrid = new library.view.ThumbGrid( self.gridContainer, self.localSettings );
		
		/*
		let queueConf = {
			containerId : 'lists-container',
			label       : View.i18n( 'i18n_list_queue' ),
			faIcon      : 'fa-users',
			ontoggle    : null,
		};
		self.queue = new library.component.UIList( queueConf );
		*/
		
		let audioConf = {
			containerId : self.peerListId,
			id          : 'audio-list',
			label       : View.i18n( 'i18n_list_voice' ),
			faIcon      : 'fa-microphone',
			ontoggle    : audioListToggled,
			state       : self.localSettings.voiceListState,
		};
		self.audioList = new library.component.UIList( audioConf );
		self.audioListEl = document.getElementById( 'audio-list' );
		function audioListToggled( state ) {
			if ( self.peerGridOrder.length )
				self.reflowPeers();
			
			self.conn.send({
				type : 'local-setting',
				data : {
					setting : 'voiceListState',
					value   : state,
				},
			});
		}
		
		self.addSettings();
		let share = null;
		if ( !self.isPrivate )
			share = self.addShareLink( self.conn );
		if ( share && self.isTempRoom )
			share.show();
		
		if (( 'DESKTOP' !== window.View.deviceType ) && !self.isPrivate )
			self.sessionTimer.classList.toggle( 'hidden', true );
		
		self.uiVisible = true;
		self.toggleUI();
	}
	
	ns.UI.prototype.saveLocalSetting = function( setting, value ) {
		const self = this;
		const sett = {
			type : 'local-setting',
			data : {
				setting : setting,
				value   : value,
			},
		};
		self.conn.send( sett );
	}
	
	ns.UI.prototype.addUIPane = function( id, conf ) {
		const self = this;
		const Pane = self.uiPaneMap[ id ];
		if ( !Pane ) {
			console.log( 'no ui pane for id', { id : id, map : self.uiPaneMap });
			throw new Error( 'no ui pane found for id: ' + id );
		}
		
		const paneConf = {
			id           : id,
			parentId     : 'live-ui-panes',
			conf         : conf,
		};
		const pane = new Pane( paneConf );
		const pId = pane.id;
		self.uiPanes[ pId ] = pane;
		pane.on( 'visible', onVisible );
		pane.on( 'close', onClose );
		
		return pane;
		
		function onVisible( isVisible ) {
			self.toggleUIPanes( isVisible );
		}
		
		function onClose() {
			self.removeUIPane( pId );
		}
	}
	
	ns.UI.prototype.bindEvents = function() {
		const self = this;
		self.gridContainer = document.getElementById( self.peerGridId );
		self.listContainer = document.getElementById( self.peerListId );
		
		// ui
		self.cover = document.getElementById( 'init-cover' );
		self.live = document.getElementById( 'live' );
		/*
		self.waiting = document.getElementById( 'waiting-for-container' );
		self.waitingFritz = document.getElementById( 'waiting-for-peers-fritz' );
		self.waitingDots = document.getElementById( 'waiting-for-peers-dots' );
		*/
		self.ui = document.getElementById( 'live-ui' );
		self.menuBtn = document.getElementById( 'show-menu-btn' );
		self.screenShareBtn = document.getElementById( 'share-screen-btn');
		self.audioBtn = document.getElementById( 'audio-toggle-btn' );
		self.hangupBtn = document.getElementById( 'hangup-btn' );
		self.videoBtn = document.getElementById( 'video-toggle-btn' );
		self.sessionTimer = document.getElementById( 'session-timer' );
		self.shareLinkBtn = document.getElementById( 'share-link-btn' );
		self.settingsBtn = document.getElementById( 'settings-btn' );
		self.teaseChat = document.getElementById( 'tease-chat-container' );
		self.recording = document.getElementById( 'recording' );
		
		self.uiPaneContainer = document.getElementById( 'live-ui-panes' );
		self.liveContent = document.getElementById( 'live-content' );
		self.lists = document.getElementById( 'lists-container' );
		
		self.menuBtn.addEventListener( 'click', menuClick, false );
		self.screenShareBtn.addEventListener( 'click', screenShareClick, false );
		self.hangupBtn.addEventListener( 'click', hangupClick, false );
		
		function menuClick( e ) { self.showMenu(); }
		function screenShareClick( e ) { self.emit( 'share-screen' ); }
		function hangupClick( e ) { self.emit( 'close' ); }
		
		// other things
		
		document.addEventListener( 'mousemove', mouseMoved, false );
		document.addEventListener( 'mouseleave', catchLeave, false );
		document.addEventListener( 'mouseenter', catchEnter, false );
		
		self.ui.addEventListener( 'transitionend', uiTransitionEnd, false );
		
		function uiTransitionEnd( e ) {
			self.uiTransitionEnd( e );
		}
		
		function catchEnter( e ) { self.handleViewOver( true ); }
		function catchLeave( e ) { self.handleViewOver( false ); }
		
		function mouseMoved( e ) {
			// one time check to see if pointer is over view on startup
			//self.toggleUI( true );
			document.removeEventListener( 'mousemove', mouseMoved, false );
		}
		
		// resize
		window.addEventListener( 'resize', handleResize, false );
		function handleResize( e ) {
			self.handleResize( e );
		}
	}
	
	ns.UI.prototype.uiTransitionEnd = function( e ) {
		const self = this;
		if ( !( 'live-ui' === e.target.id ) || !( 'opacity' === e.propertyName ))
			return;
		
		if ( !self.uiVisible )
			self.ui.classList.toggle( 'hidden', true );
	}
	
	ns.UI.prototype.handleViewOver = function( isOver ) {
		const self = this;
		isOver = self.uiVisible || isOver;
		self.toggleUI( isOver );
	}
	
	ns.UI.prototype.clearCurrentMode = function() {
		const self = this;
		console.log( 'clearCurrentMode' );
	}
	
	ns.UI.prototype.updateDisplayMode = async function() {
		const self = this;
		self.peerIds.forEach( pId => {
			self.updatePeerMode( pId );
		});
		
		self.updateGridClass();
		await self.updateVoiceListMode();
		await self.updateThumbsGrid();
		await self.toggleThumbGrid();
	}
	
	ns.UI.prototype.showMenu = function() {
		const self = this;
		self.menuUI.toggle();
	}
	
	ns.UI.prototype.toggleUI = function( show, skipAnim ) {
		const self = this;
		if ( !!self.panesVisible )
			show = true;
		
		let setVisible = false;
		if ( null != show )
			setVisible = show;
		else
			setVisible = self.uiVisible;
		
		if ( setVisible || skipAnim )
			self.ui.classList.toggle( 'hidden', !setVisible );
		
		self.live.classList.toggle( 'show-ui', setVisible );
	}
	
	ns.UI.prototype.toggleUIPanes = function( setVisible ) {
		const self = this;
		if ( setVisible )
			self.panesVisible++;
		else
			self.panesVisible--;
		
		// theres is only change in container visibility
		// at 0 and 1 panes visible
		if ( self.panesVisible > 1 )
			return;
		
		self.toggleUI();
		
		const showPanes = !!self.panesVisible;
		self.ui.classList.toggle( 'show-panes', showPanes );
		self.uiPaneContainer.classList.toggle( 'hidden', !showPanes );
	}
	
	ns.UI.prototype.getUIPane = function( id ) {
		const self = this;
		const pane = self.uiPanes[ id ];
		if ( !pane ) {
			console.log( 'getUIPane - no pane found for id', id );
			return null;
		}
		
		return pane;
	}
	
	ns.UI.prototype.hideUIPane = function( id ) {
		const self = this;
		const pane = self.getPane( id );
		if( !pane )
			return;
		
		pane.hide();
	}
	
	ns.UI.prototype.removeUIPane = function( id ) {
		const self = this;
		const pane = self.getUIPane( id )
		if ( !pane )
			return;
		
		//pane.hide();
		delete self.uiPanes[ id ];
		self.toggleUIPanes( false );
	}
	
	ns.UI.prototype.handleResize = function( e ) {
		const self = this;
		if ( null != self.resizeWait ) {
			self.doOneMoreResize = true;
			return;
		}
		
		self.doOneMoreResize = false;
		self.peerGridOrder.forEach( callResize );
		self.resizeWait = setTimeout( resizeThrottle, 50 );
		
		function callResize( peerId ) {
			var peer = self.peers[ peerId ];
			peer.doResize();
		}
		
		function resizeThrottle() {
			self.resizeWait = null;
			if ( self.doOneMoreResize )
				self.handleResize();
		}
	}
	
	ns.UI.prototype.addNestedApp = function( appData ) {
		const self = this;
		if ( self.nestedApp )
			self.nestedApp.close();
		
		const appId = friendUP.tool.uid( 'nested-app' );
		const conf = {
			id          : appId,
			containerId : self.peerGridId,
			app         : appData,
			onclose     : onclose,
		};
		self.nestedApp = new library.component.NestedApp( conf );
		self.updateGridClass();
		
		function onclose() {
			self.nestedApp = null;
			self.updateGridClass();
		}
		
		function send( e ) {
			console.log( 'nestedApp.send', e );
		}
	}
	
	ns.UI.prototype.addPeer = function( peer ) {
		const self = this;
		if ( self.isReordering ) {
			self.peerAddQueue.push( peer );
			return;
		}
		
		let pid = peer.id;
		let conf = {
			peer           : peer,
			menu           : self.menu,
			connecting     : document.getElementById( 'connecting-peers' ),
			currentQuality : self.currentQuality,
			audioSinkId    : self.audioSinkId,
			isHost         : peer.isHost,
			ondrag         : onDrag,
			onclick        : onClick,
		};
		
		let viewPeer =  null;
		if ( pid === 'selfie' ) {
			viewPeer = new library.view.Selfie(
				conf,
				self.audioBtn,
				self.videoBtn,
				self.screenShareBtn
			);
			peer.on( 'room-quality', handleRoomQuality );
			peer.on( 'popped', togglePopped );
			peer.on( 'voice-only', voiceOnly );
		}
		else {
			conf.onmenu = onMenuClick;
			viewPeer = new library.view.Peer( conf );
		}
		
		self.peers[ pid ] = viewPeer;
		self.peerIds.push( pid );
		if ( self.thumbGrid )
			self.thumbGrid.add( viewPeer );
		
		if (( 'selfie' === pid )
			&& self.localSettings
			&& ( null != self.localSettings.popped_user )
		) {
			self.togglePopped( self.localSettings.popped_user );
		}
		
		self.updatePeerMode( pid );
		
		self.updateVoiceListMode();
		self.updateThumbsGrid();
		self.updateMenu();
		
		viewPeer.on( 'status', showStatus );
		viewPeer.on( 'video', updateHasVideo );
		
		// start session duration on selfie when the first peer is added
		if ( self.peerIds.length === 2 )
			self.startDurationTimer();
		
		// show/hide waiting splash
		self.updateWaiting();
		
		function onDrag( type ) {
			self.onDrag( type, pid );
		}
		
		function onClick( show ) {
			self.onPeerClickCatch( show, pid);
		}
		
		function handleRoomQuality( e ) {
			self.updateQualityLevel( e );
		}
		
		function togglePopped( e ) {
			self.togglePopped( e );
		}
		
		function voiceOnly( e ) {
			self.handleVoiceOnly( e );
		}
		
		function updateHasVideo( hasVideo ) {
			self.updateHasVideo( pid, hasVideo );
		}
		
		function onMenuClick( e ) {
			self.showPeerMenu( pid );
		}
		
		function showStatus( e ) {
			self.showPeerStatus( pid, e );
		}
	}
	
	ns.UI.prototype.showPeerMenu = function( peerId ) {
		const self = this;
		if ( self.peerThumbMenu ) {
			if ( peerId == self.peerThumbMenu.peerId )
				return;
			else
				self.peerThumbMenu.close();
		}
		
		const peer = self.peers[ peerId ];
		if ( peer.isInThumbs )
			showThumbMenu( peer )
		else
			showMainMenu( peer );
		
		function showThumbMenu( peer ) {
			const pId = peer.id;
			const id = peer.getIdentity();
			const opts = {
				peerName : id.name,
				items : [
					{
						id      : 'reload',
						faKlass : 'fa-refresh',
						label   : View.i18n( 'i18n_reload' ),
					},
				],
			};
			self.peerThumbMenu = new library.view.PeerThumbMenu(
				peer.el,
				pId,
				opts,
				( e ) => self.handleThumbMenuSelect( e, pId ),
				( e ) => onClose( e ),
			);
			
			function onClose() {
				if ( !self.peerThumbMenu )
					return;
				
				self.peerThumbMenu.close();
				delete self.peerThumbMenu;
			}
			
		}
		
		function showMainMenu( peer ) {
			self.menu.show( peer.menuId );
			self.menuUI.show();
		}
	}
	
	ns.UI.prototype.handleThumbMenuSelect = function( menuItem, peerId ) {
		const self = this;
		self.maybeCloseThumbMenu( peerId );
		const peer = self.peers[ peerId ];
		if ( !peer )
			return;
		
		if ( 'reload' == menuItem )
			peer.reload();
	}
	
	ns.UI.prototype.updatePeerMode = function( peerId ) {
		const self = this;
		const peer = self.peers[ peerId ];
		if ( self.isVoiceOnly ) {
			setInList( peer );
			return;
		}
		
		if ( self.presenterId ) {
			if ( peerId == self.presenterId )
				setInGrid( peer );
			else
				setInList( peer );
			
			return;
		}
		
		if ( self.showThumbs ) {
			//self.updateThumbsGrid();
			self.updatePopped();
			return;
		}
		
		setInGrid( peer );
		
		function setInList( peer ) {
			if ( peer.isInList )
				return;
			
			if ( peer.isInGrid )
				removeFromGrid( peer.id );
			
			peer.setInList();
			self.audioList.add( peer.el );
			self.updatePopped();
		}
		
		function setInGrid( peer ) {
			if ( peer.isInGrid )
				return;
			
			if ( peer.isInList )
				removeFromList( peer.id );
			
			peer.setInGrid();
			self.gridContainer.appendChild( peer.el );
			self.peerGridOrder.push( peer.id );
			self.updatePopped();
		}
		
		function setInThumbs( peer ) {
			if ( peer.isInThumbs )
				return;
			
			if ( peer.isInGrid )
				removeFromGrid( peer.id );
			
			if ( peer.isInList )
				removeFromList( peer.id );
			
			peer.setInThumbs();
			self.thumbGrid.add( peer );
			self.updatePopped();
		}
		
		function removeFromGrid( pId ) {
			const pdx = self.peerGridOrder.indexOf( pId );
			if ( -1 == pdx )
				return;
			
			self.peerGridOrder.splice( pdx, 1 );
		}
		
		function removeFromList( pId ) {
			self.audioList.remove( pId );
		}
	}
	
	ns.UI.prototype.removePeer = function( peerId ) {
		const self = this;
		const peer = self.peers[ peerId ];
		if ( !peer ) {
			console.log( 'live - no peer found for ', peerId );
			return;
		}
		
		let model = peer.peer;
		//model.release( 'video' );
		if ( 'selfie' === peerId ) {
			model.release( 'room-quality' );
			model.release( 'popped' );
		}
		
		self.maybeCloseThumbMenu( peerId );
		
		self.thumbGrid.remove( peerId );
		self.audioList.remove( peerId );
		
		const pidx = self.peerGridOrder.indexOf( peerId );
		if ( -1 != pidx )
			self.peerGridOrder.splice( pidx, 1 );
		
		peer.close();
		delete self.peers[ peerId ];
		self.peerIds = Object.keys( self.peers );
		
		if ( self.modeSpeaker && self.currentSpeaker === peerId )
			self.setSpeaker();
		
		if ( self.peerIds.length === 1 ) {
			self.stopDurationTimer();
		}
		
		self.updateVoiceListMode();
		self.updateWaiting();
		self.updatePopped();
		self.updateMenu();
		self.updateGridClass();
		self.updateThumbsGrid();
	}
	
	ns.UI.prototype.maybeCloseThumbMenu = function( peerId ) {
		const self = this;
		if ( !self.peerThumbMenu )
			return;
		
		if ( peerId != self.peerThumbMenu.peerId )
			return;
		
		self.peerThumbMenu.close();
		delete self.peerThumbMenu;
	}
	
	ns.UI.prototype.executePeerAddQueue = function() {
		const self = this;
		if ( !self.peerAddQueue.length || self.isReordering )
			return;
		
		self.peerAddQueue.forEach( add );
		function add( peer ) {
			self.addPeer( peer );
		}
	}
	
	ns.UI.prototype.updateWaiting = function() {
		const self = this;
		console.log( 'live.UI.updateWaiting - no u' );
		/*
		const pids = Object.keys( self.peers );
		const hideWaiting = pids.length > 1;
		const onlyVoice = self.isVoiceOnly;
		self.waiting.classList.toggle( 'hidden', hideWaiting );
		self.waiting.classList.toggle( 'expand', !onlyVoice );
		self.waiting.classList.toggle( 'fortify', onlyVoice );
		self.waitingFritz.classList.toggle( 'hidden', onlyVoice );
		self.waitingDots.classList.toggle( 'hidden', !onlyVoice );
		*/
	}
	
	ns.UI.prototype.updateMenu = function() {
		const self = this;
		let gridNum = self.peerGridOrder.length;
		let listNum = self.audioList.length;
		if ( 2 > gridNum )
			self.menu.disable( 'dragger' );
		else
			self.menu.enable( 'dragger' );
	}
	
	ns.UI.prototype.updateGridClass = function() {
		const self = this;
		const container = document.getElementById( self.peerGridId );
		const selfie = self.peers[ 'selfie' ];
		if ( !selfie )
			return;
		
		if ( self.presenterId || self.showThumbs ) {
			if ( self.currentGridKlass ) {
				if ( 'grid1' === self.currentGridKlass )
					return;
				
				container.classList.toggle( self.currentGridKlass, false );
			}
			
			self.currentGridKlass = 'grid1';
			container.classList.toggle( self.currentGridKlass, true );
			return;
		}
		
		self.currentGridKlass = self.currentGridKlass || 'grid1';
		container.classList.remove( self.currentGridKlass );
		const peerNum = getPeerNum();
		const newGridKlass = getGridKlass( peerNum );
		
		self.currentGridKlass = newGridKlass;
		container.classList.add( self.currentGridKlass );
		self.reflowPeers();
		
		function removeOld() {
			var classes = container.className;
			container.classList.remove( classes );
		}
		
		function getGridKlass( peerNum ) {
			let newKlass = 'grid' + peerNum;
			return newKlass;
		}
		
		function getPeerNum() {
			let peerNum = self.peerGridOrder.length;
			
			if ( self.nestedApp )
				peerNum += 1;
			
			if ( self.selfiePopped )
				peerNum -= 1;
			
			return peerNum;
		}
	}
	
	ns.UI.prototype.toggleThumbGrid = function() {
		const self = this;
		if ( self.presenterId ) {
			return disable();
		}
		
		if ( self.isVoiceOnly ) {
			return disable();
		}
		
		if ( self.showThumbs )
			return enable();
		else
			return disable();
		
		function enable() {
			return new Promise(( ook, eek ) => {
				self.thumbGrid.show();
				ook();
			});
		}
		
		function disable() {
			return new Promise(( ook, eek ) => {
				self.thumbGrid.hide();
				if ( self.gridSwap )
					self.clearGridSwap()
						.then( ook )
						.catch( ook );
				else
					ook();
			});
		}
	}
	
	ns.UI.prototype.reflowPeers = function() {
		const self = this;
		self.peerIds.forEach( callReflow );
		function callReflow( peerId ) {
			var peer = self.peers[ peerId ];
			if ( !peer )
				return;
			
			peer.reflow();
		}
	}
	
	
	ns.UI.prototype.startDurationTimer = function() {
		const self = this;
		self.startTime = Date.now();
		self.isDurationTimer = true;
		self.toggleDurationUpdate();
	}
	
	ns.UI.prototype.toggleDurationUpdate = function() {
		const self = this;
		if ( !self.isDurationTimer ) {
			stop();
			return;
		}
		
		if ( self.durationLoopId )
			return;
		
		self.durationLoopId = 1;
		timeLoop();
		function timeLoop() {
			if ( !self.durationLoopId )
				return;
			
			self.durationLoopId = window.requestAnimationFrame( timeLoop );
			updateTime();
		}
		
		function updateTime() {
			const now = Date.now();
			const duration = now - self.startTime;
			self.setDurationTime( duration );
		}
		
		function stop() {
			if ( self.durationLoopId ) {
				window.cancelAnimationFrame( self.durationLoopId );
				self.durationLoopId = null;
			}
		}
	}
	
	ns.UI.prototype.setDurationTime = function( msSinceStart ) {
		const self = this;
		if ( !msSinceStart ) {
			clear();
			return;
		}
		
		let seconds = window.Math.floor( msSinceStart / 1000 );
		const hours = window.Math.floor( seconds / 60 / 60 );
		if ( hours ) {
			const hourSeconds = hours * 60 * 60;
			seconds = seconds - hourSeconds;
		}
		
		const minutes = window.Math.floor( seconds / 60 );
		if ( minutes ) {
			const minuteSeconds = minutes * 60;
			seconds = seconds - minuteSeconds
		}
		
		const time = [];
		if ( hours )
			time.push( pad( hours ));
		
		time.push( pad( minutes ));
		time.push( pad( seconds ));
		self.sessionTimer.innerText = time.join( ':' );
		
		function clear() {
			self.sessionTimer.innerText = '--:--:--';
		}
		
		function pad( num ) {
			if ( 10 > num )
				return '0' + num;
			
			return num;
		}
	}
	
	ns.UI.prototype.stopDurationTimer = function() {
		const self = this;
		self.isDurationTimer = false;
		self.startTime = null;
		self.toggleDurationUpdate();
		self.setDurationTime( null );
	}
	
	ns.UI.prototype.handleQueue = function( msg ) {
		const self = this;
		if ( !self.queue )
			return;
		
		self.queue.handle( msg );
	}
	
	ns.UI.prototype.handleVoiceOnly = async function( isVoiceOnly ) {
		const self = this;
		if ( isVoiceOnly === self.isVoiceOnly )
			return;
		
		self.isVoiceOnly = isVoiceOnly;
		
		self.videoBtn.classList.toggle( 'inverted', isVoiceOnly );
		self.gridContainer.classList.toggle( 'hidden', isVoiceOnly );
		self.listContainer.classList.toggle( 'expand', isVoiceOnly );
		self.listContainer.classList.toggle( 'fortify', !isVoiceOnly );
		self.audioList.show( isVoiceOnly );
		
		self.updateWaiting();
		await self.updateDisplayMode();
	}
	
	ns.UI.prototype.updateVoiceListMode = function() {
		const self = this;
		const ids = Object.keys( self.peers );
		if ( !self.peerIds.length )
			return;
		
		if ( self.isVoiceOnly && hasMaxTwoPeers() && hasNoVideoPeers() )
			setToItems();
		else
			setToRows();
		
		self.audioListEl.classList.toggle( 'large-items', self.isVoiceListLarge );
		updatePeers( ids );
		
		function setToItems() { self.isVoiceListLarge = true; }
		function setToRows() { self.isVoiceListLarge = false; }
		
		function updatePeers( ids ) {
			ids.forEach( toggleLarge );
			function toggleLarge( pid ) {
				let peer = self.peers[ pid ];
				peer.setVoiceListMode( self.isVoiceListLarge );
			}
		}
		
		function hasMaxTwoPeers( ids ) {
			if ( 2 >= self.peerIds.length )
				return true;
			else
				return false;
		}
		
		function hasNoVideoPeers() {
			return !self.peerGridOrder.length;
		}
	}
	
	ns.UI.prototype.updateHasVideo = function( peerId, hasVideo ) {
		const self = this;
		if ( 'selfie' !== peerId )
			return;
		
		self.updateMenuItems();
	}
	
	ns.UI.prototype.updateMenuItems = function() {
		const self = this;
		const selfie = self.peers[ 'selfie' ];
		if ( !selfie )
			return;
		
		const hasVideo = selfie.hasVideo;
		let enable = hasVideo;
		const isMode = ( !!self.presenterId || !!self.showThumbs );
		if ( isMode )
			enable = false;
		
		if ( enable )
			self.menu.enable( 'popped' );
		else
			self.menu.disable( 'popped' );
		
	}
	
	ns.UI.prototype.onDrag = function( type, peerId ) {
		const self = this;
		if ( type === 'enable' )
			dragEnable();
		if ( type === 'start' )
			dragStart();
		if ( type === 'end' )
			dragEnd();
		if ( type === 'drop' )
			dropOn( peerId );
		if ( type === 'disable' )
			dragDisable();
		
		function dragEnable() {
			toggleDropzone( true );
		}
		
		function dragStart() {
			self.reorderStart( peerId );
			toggleIsDragging( true );
		}
		
		function dragEnd() {
			toggleIsDragging( false );
			self.reorderEnd();
		}
		
		function dragDisable() {
			toggleDropzone( false );
		}
		
		function dropOn( peerId ) {
			self.reorderDrop( peerId );
		}
		
		function toggleDropzone( isDragging ) {
			self.peerGridOrder.forEach( toggle );
			function toggle( peerId ) {
				var peer = self.peers[ peerId ];
				peer.toggleDropzone( isDragging );
			}
		}
		
		function toggleIsDragging( ayOrNay ) {
			self.peerGridOrder.forEach( set );
			function set( peerId ) {
				var peer = self.peers[ peerId ];
				peer.setIsDragging( ayOrNay );
			}
		}
	}
	
	ns.UI.prototype.clearDragger = function() {
		const self = this;
		self.onDrag( 'end' );
		self.onDrag( 'disable' );
	}
	
	ns.UI.prototype.reorderStart = function( sourceId ) {
		const self = this;
		var sourceIndex = self.peerGridOrder.indexOf( sourceId );
		self.isReordering = true;
		self.reorder.sourceIndex = sourceIndex;
		
	}
	
	ns.UI.prototype.reorderDrop = function( targetId ) {
		const self = this;
		var targetIndex = self.peerGridOrder.indexOf( targetId );
		self.reorder.targetIndex = targetIndex;
		self.doReorder();
	}
	
	ns.UI.prototype.doReorder = function() {
		const self = this;
		var sIndex = self.reorder.sourceIndex;
		var sId = self.peerGridOrder[ sIndex ];
		var tIndex = self.reorder.targetIndex;
		var tId = self.peerGridOrder[ tIndex ];
		self.peerGridOrder[ sIndex ] = tId;
		self.peerGridOrder[ tIndex ] = sId;
		self.applyPeerOrder();
	}
	
	ns.UI.prototype.applyPeerOrder = function( peerOrder ) {
		const self = this;
		self.isReordering = true;
		if ( peerOrder )
			self.peerGridOrder = peerOrder;
		
		self.peerGridOrder.forEach( applyPosition );
		if ( peerOrder )
			self.isReordering = false;
		
		self.executePeerAddQueue();
		
		function applyPosition( peerId ) {
			var peer = self.peers[ peerId ];
			var peerElement = document.getElementById( peerId );
			self.gridContainer.appendChild( peerElement );
			peer.restart();
		}
	}
	
	ns.UI.prototype.reorderEnd = function() {
		const self = this;
		self.reorder = {
			sourceIndex : null,
			targetIndex : null,
		};
		self.isReordering = false;
		self.executePeerAddQueue();
	}
	
	ns.UI.prototype.onPeerClickCatch = function( peerId ) {
		const self = this;
		//self.toggleUIMode();
	}
	
	ns.UI.prototype.showPeerStatus = function( peerId, state ) {
		const self = this;
		self.statusMsg.showStatus( state, peerId );
		self.statusMsg.on( peerId, uiClick );
		function uiClick( event ) {
			self.statusMsg.removeStatus( peerId );
		}
	}
	
	ns.UI.prototype.toggleUIMode = function() {
		const self = this;
		self.uiVisible = !self.uiVisible;
		self.toggleUI();
		
		self.peerIds.forEach( updateUI );
		function updateUI( pId ) {
			var peer = self.peers[ pId ];
			if ( !peer ) {
				console.log( 'live.updatePeerUI - no peer for id', pId );
				return;
			}
			
			peer.toggleUIMode( self.uiVisible );
		}
	}
	
	ns.UI.prototype.addMenu = function() {
		const self = this;
		const peers = {
			type : 'folder',
			id : 'peers',
			name : View.i18n('i18n_participants'),
			faIcon : 'fa-users',
		};
		const quality = {
			type   : 'folder',
			id     : 'quality',
			name   : View.i18n('i18n_stream_quality'),
			faIcon : 'fa-tachometer',
			items  : [
				{
					type   : 'item',
					id     : 'q-high',
					name   : View.i18n( 'i18n_high' ),
					faIcon : 'fa-diamond',
				},
				{
					type   : 'item',
					id     : 'q-normal',
					name   : View.i18n( 'i18n_normal' ),
					faIcon : 'fa-eye',
				},
				{
					type   : 'item',
					id     : 'q-medium',
					name   : View.i18n('i18n_medium'),
					faIcon : 'fa-cubes',
				},
				{
					type   : 'item',
					id     : 'q-low',
					name   : View.i18n('i18n_low'),
					faIcon : 'fa-cube',
				},
			],
		};
		const restart = {
			type   : 'item',
			id     : 'restart',
			name   : View.i18n( 'i18n_restart_stream' ),
			faIcon : 'fa-recycle',
		};
		const screenMode = {
			type   : 'item',
			id     : 'screen-mode',
			name   : View.i18n( 'i18n_toggle_cover_contain' ),
			faIcon : 'fa-arrows-alt',
			toggle : false,
			close  : false,
		};
		const fullscreen = {
			type   : 'item',
			id     : 'fullscreen',
			name   : View.i18n( 'i18n_toggle_fullscreen' ),
			faIcon : 'fa-tv',
			toggle : false,
		};
		const popped = {
			type   : 'item',
			id     : 'popped',
			name   : View.i18n( 'i18n_toggle_popped_selfie' ),
			faIcon : 'fa-external-link',
			toggle : false,
			close  : false,
		};
		const speaker = {
			type   : 'item',
			id     : 'mode-speaker',
			name   : View.i18n( 'i18n_toggle_mode_speaker_only' ),
			faIcon : 'fa-user-circle-o',
			toggle : false,
			close  : true,
		};
		const presentation = {
			type   : 'item',
			id     : 'mode-presentation',
			name   : View.i18n( 'i18n_presentation_mode' ),
			faIcon : 'fa-eye',
			toggle : false,
		};
		const sendReceive = {
			type : 'folder',
			id : 'send-receive',
			name : View.i18n( 'Send / Receive media' ),
			faIcon : 'fa-exchange',
			items : [
				{
					type : 'item',
					id : 'send-audio',
					name : View.i18n( 'i18n_menu_send_audio' ),
					faIcon : 'fa-microphone',
					toggle : true,
					close : false,
				},
				{
					type : 'item',
					id : 'send-video',
					name : View.i18n( 'i18n_menu_send_video' ),
					faIcon : 'fa-video-camera',
					toggle : true,
					close : false,
				},
				{
					type   : 'item',
					id     : 'receive-audio',
					name   : View.i18n( 'i18n_menu_receive_audio' ),
					faIcon : 'fa-volume-up',
					toggle : true,
					close  : false,
				},
				{
					type   : 'item',
					id     : 'receive-video',
					name   : View.i18n( 'i18n_menu_receive_video' ),
					faIcon : 'fa-film',
					toggle : true,
					close  : false,
				},
			],
		};
		const dragger = {
			type   : 'item',
			id     : 'dragger',
			name   : View.i18n( 'i18n_change_participant_order' ),
			faIcon : 'fa-hand-stop-o',
		};
		const username = {
			type : 'item',
			id : 'change-username',
			name : View.i18n( 'i18n_change_username' ),
			faIcon : 'fa-id-card-o',
		};
		const cleanUI = {
			type   : 'item',
			id     : 'clean-ui',
			name   : View.i18n( 'i18n_clean_ui' ),
			faIcon : 'fa-square-o',
		};
		const leave = {
			type   : 'item',
			id     : 'leave',
			name   : View.i18n( 'i18n_leave' ),
			faIcon : 'fa-sign-out',
		};
		
		const content = [
			quality,
			restart,
			fullscreen,
			presentation,
			popped,
			speaker,
			sendReceive,
			screenMode,
			//settings,
			dragger,
			username,
			cleanUI,
			peers,
			leave,
		];
		
		const conf = {
			menuConf : {
				content      : content,
				onnolistener : noListenerFor,
			},
		};
		self.menuUI = self.addUIPane( 'menu', conf );
		self.menu = self.menuUI.getMenu();
		self.menu.on( 'share', shareHandler );
		self.menu.on( 'clean-ui', cleanUIHandler );
		self.menu.on( 'dragger', reorderHandler );
		self.menu.on( 'popped', togglePopped );
		//self.menu.on( 'mode-speaker', modeSpeaker );
		self.menu.on( 'fullscreen', toggleFullscreen );
		return self.menu;
		
		function noListenerFor( e ) {
			console.log( 'menu - noListenerFor', e );
		}
		
		function shareHandler( state ) {
			if ( !self.shareUI )
				return;
			
			self.shareUI.toggle();
		}
		
		function cleanUIHandler( state ) {
			self.toggleUIMode();
		}
		
		function reorderHandler( state ) {
			self.onDrag( 'enable' );
		}
		
		function togglePopped( state ) {
			self.togglePopped();
		}
		
		function modeSpeaker( state ) {
			const isModeSpeaker = self.toggleModeSpeaker();
			self.menu.setState( 'mode-speaker', isModeSpeaker );
		}
		
		function toggleFullscreen() {
			View.toggleFullscreen();
		}
	}
	
	ns.UI.prototype.togglePopped = function( userPop ) {
		const self = this;
		const selfie = self.peers[ 'selfie' ];
		if ( !selfie ) {
			console.log( 'popped no seflie' );
			return;
		}
		
		self.selfiePopped = selfie.togglePopped( userPop );
		self.updateGridClass();
	}
	
	ns.UI.prototype.updatePopped = function() {
		const self = this;
		const selfie = self.peers[ 'selfie' ];
		if ( !selfie )
			return;
		
		let popped = null;
		if ( self.peerIds.length === 1 )
			popped = false;
		
		if ( self.showThumbs )
			popped = false;
		
		if ( null != self.presenterId ) {
			if ( 'selfie' === self.presenterId )
				popped = false;
			else
				popped = true;
		}
		
		self.selfiePopped = selfie.setPopped( popped );
		self.updateGridClass();
	}
	
	ns.UI.prototype.toggleModeSpeaker = function() {
		const self = this;
		self.showThumbs = !self.showThumbs;
		if ( self.showThumbs )
			enable();
		else
			disable();
		
		self.updateThumbsGrid();
		return self.showThumbs;
		
		function enable() {
			self.clearDragger();
			self.menu.disable( 'dragger' );
		}
		
		function disable() {
			self.menu.enable( 'dragger' );
		}
	}
	
	ns.UI.prototype.checkIsThumbsActive = function() {
		const self = this;
		let isActive = !!self.showThumbs;
		if ( self.isVoiceOnly )
			isActive = false;
		if ( self.presenterId )
			isActive = false;
		
		return isActive;
	}
	
	ns.UI.prototype.updateThumbsGrid = async function( force ) {
		const self = this;
		const isActive = self.checkIsThumbsActive();
		if ( !isActive ) {
			
			return;
		}
		
		self.peerIds.forEach( moveToThumbs );
		
		//
		let currSpeaker = null;
		let lastSpeaker = null;
		if ( null != self.currentSpeaker )
			currSpeaker = self.peers[ self.currentSpeaker ];
		
		if ( null != self.lastSpeaker )
			lastSpeaker = self.peers[ self.lastSpeaker ];
		
		if ( !currSpeaker && lastSpeaker ) {
			if ( self.gridSwap ) {
				if ( self.gridSwap.in == self.lastSpeaker ) {
					console.log( 'updateThumbsGrid - already swapping to lastSpeaker' );
					return;
				} else
					await self.clearGridSwap();
			}
			
			self.showInMain( lastSpeaker );
			//self.thumbGrid.updatePosition();
			return;
		}
		
		if ( !currSpeaker || !lastSpeaker ) {
			console.log( 'updateThumbsGrid - missing one', {
				curr : currSpeaker,
				last : lastSpeaker,
				pIds : self.peerIds,
			});
			return;
		}
		
		/*
		if ( currSpeaker ) {
			if ( lastSpeaker ) {
				lastSpeaker.showIsSpeaking( false );
				self.showInThumbs( lastSpeaker );
			}
			
			currSpeaker.showIsSpeaking( true );
			self.showInMain( currSpeaker );
		}
		*/
		if ( self.currentSpeaker === self.lastSpeaker ) {
			self.showInMain( currSpeaker );
			return;
		}
		
		const pOutId = lastSpeaker.id;
		const pInId = currSpeaker.id;
		if ( self.gridSwap ) {
			if ( checkSwap( pOutId, pInId )) {
				return;
			}
			else
				await self.clearGridSwap();
		}
		
		try {
			await self.swapGridPeers( pOutId, pInId );
		} catch( ex ) {
			if ( 'ERR_ABORT' === ex )
				return;
			
			await self.clearGridSwap();
		}
		
		function moveToThumbs( pId ) {
			if ( self.currentSpeaker && ( pId === self.currentSpeaker ))
				return;
			
			if ( self.lastSpeaker && ( pId === self.lastSpeaker ))
				return;
			
			const peer = self.peers[ pId ];
			self.showInThumbs( peer );
		}
		
		function checkSwap( pOut, pIn ) {
			const swap = self.gridSwap;
			if ( swap.out != pOut )
				return false;
			
			if ( swap.in != pIn )
				return false;
			
			return true;
		}
	}
	
	ns.UI.prototype.showInMain = function( peer ) {
		const self = this;
		if ( !self.checkIsThumbsActive())
			return;
		
		const pId = peer.id;
		const pIdx = self.peerGridOrder.indexOf( pId );
		if ( -1 == pIdx )
			self.peerGridOrder.push( pId );
		
		peer.setFaded( false );
		self.audioList.remove( pId );
		self.thumbGrid.swapOut( pId );
		self.gridContainer.appendChild( peer.el );
		peer.setInGrid();
		peer.showIsSpeaking( true );
	}
	
	ns.UI.prototype.showInThumbs = function( peer ) {
		const self = this;
		if ( !self.checkIsThumbsActive())
			return;
		
		const pId = peer.id;
		const oIdx = self.peerGridOrder.indexOf( pId );
		if ( -1 != oIdx )
			self.peerGridOrder.splice( oIdx, 1 );
		
		peer.setFaded( false );
		self.audioList.remove( pId );
		self.thumbGrid.swapIn( pId );
		peer.setInThumbs();
		peer.showIsSpeaking( false );
	}
	
	ns.UI.prototype.swapGridPeers = async function( peerOut, peerIn ) {
		const self = this;
		// derp
		self.audioList.remove( peerOut );
		self.audioList.remove( peerIn );
		
		//
		let rejected = false;
		const swapId = friendUP.tool.uid( 'swap' );
		self.gridSwap = {
			id     : swapId,
			out    : peerOut,
			in     : peerIn,
			resId  : null,
			timeId : null,
		};
		
		let swapRes = null;
		try {
			swapRes = await doSwap();
		} catch( ex ) {
			console.log( 'swapErr', ex );
			throw ex;
		}
		
		return swapRes;
		
		function doSwap() {
			return new Promise(( resolve, reject ) => {
				const pOut = self.peers[ peerOut ];
				const pIn = self.peers[ peerIn ];
				if ( !pOut || !pIn ) {
					reject( 'ERR_PEER_MISSING' );
					return;
				}
				
				let waitForPINVideo = false;
				if (( 'selfie' !== peerIn )	&& pIn.hasVideo )
					waitForPINVideo = true;
				
				if ( waitForPINVideo ) {
					pIn.setFastStats( true );
					const rId = pIn.once( 'video-resolution', e => videoWait());
					self.gridSwap.resId = rId;
					const tId = window.setTimeout( videoWait, 1000 * 5 );
					self.gridSwap.timeId = tId;
				} else {
					const tId = window.setTimeout( fadeIn, 500 );
					self.gridSwap.timeId = tId;
					pOut.fadeOut()
						.then( faded )
						.catch( reject );
				}
				
				function videoWait() {
					if ( !checkContinue( swapId )) {
						if ( !rejected ) {
							rejected = true;
							resolve( 'WARN_ABORT' );
						}
						
						return;
					}
					
					if ( null != self.gridSwap.timeId ) {
						window.clearTimeout( self.gridSwap.timeId )
						self.gridSwap.timeId = null;
					}
					
					const pIn = self.peers[ peerIn ];
					if ( null != self.gridSwap.resId ) {
						pIn.off( self.gridSwap.resId );
						self.gridSwap.resId = null;
					}
					
					const pOut = self.peers[ peerOut ];
					if ( !pIn || !pOut ) {
						if ( !rejected ) {
							rejected = true;
							reject( 'ERR_PEER_MISSING' );
						}
						
						return;
					}
					
					pIn.setFastStats( false );
					const tId = window.setTimeout( fadeIn, 500 );
					self.gridSwap.timeId = tId;
					pOut.fadeOut()
						.then( faded )
						.catch( faded );
				}
				
				function fadeIn() {
					if ( !checkContinue( swapId )) {
						if ( !rejected ) {
							rejected = true;
							resolve( 'WARN_ABORT' );
						}
						
						return;
					}
					
					if ( null != self.gridSwap.timeId ) {
						window.clearTimeout( self.gridSwap.timeId )
						self.gridSwap.timeId = null;
					}
					
					const pOut = self.peers[ peerOut ];
					pOut.setFaded( false );
					self.thumbGrid.swapIn( pOut.id );
					pOut.setInThumbs();
					pOut.showIsSpeaking( false );
					
					pIn.setFaded( true );
					self.thumbGrid.swapOut( pIn.id );
					self.gridContainer.appendChild( pIn.el );
					const pIdx = self.peerGridOrder.indexOf( pIn.id );
					if ( -1 === pIdx )
						self.peerGridOrder.push( pIn.id );
					
					pIn.setInGrid();
					pIn.showIsSpeaking( true );
					pIn.fadeIn()
						.then( visible )
						.catch( visible );
					
				}
				
				function faded( err ) {
					if ( !checkContinue( swapId )) {
						if ( !rejected ) {
							rejected = true;
							resolve( 'WARN_ABORT' );
						}
						
						return;
					}
					
					const oIdx = self.peerGridOrder.indexOf( peerOut );
					if ( -1 !== oIdx )
						self.peerGridOrder.splice( oIdx, 1 );
					
					self.gridSwap.inGrid = true;
					done( swapId );
				}
				
				function visible( err ) {
					if ( !checkContinue( swapId )) {
						if ( !rejected ) {
							rejected = true;
							resolve( 'WARN_ABORT' );
						}
						
						return;
					}
					
					self.gridSwap.inMain = true;
					done( swapId );
					resolve( peerIn );
				}
			});
		}
		
		function checkContinue( swapId ) {
			if ( !self.gridSwap )
				return false;
			
			if ( swapId !== self.gridSwap.id )
				return false;
			
			return true;
		}
		
		function done( swapId ) {
			const swap = self.gridSwap;
			if ( !swap || ( swapId != swap.id ))
				return;
			
			if ( !swap.inGrid || !swap.inMain )
				return;
			
			self.gridSwap = null;
		}
	}
	
	ns.UI.prototype.clearGridSwap = async function() {
		const self = this;
		const swap = self.gridSwap;
		if ( null == swap )
			return;
		
		delete self.gridSwap;
		
		const peerOut = swap.out;
		const peerIn = swap.in;
		const pOut = self.peers[ peerOut ];
		const pIn = self.peers[ peerIn ];
		
		if ( swap.timeId )
			window.clearTimeout( swap.timeId );
		
		if ( swap.resId )
			pIn.off( swap.resId );
		
		pIn.setFastStats( false );
		
		pOut.setFaded( false );
		pIn.setFaded( false );
		
		const isActive = self.checkIsThumbsActive();
		if ( !isActive )
			return;
		
		self.showInThumbs( pOut );
		self.showInMain( pIn );
		
		return;
	}
	
	ns.UI.prototype.setSpeaker = function( speaker ) {
		const self = this;
		let curr = speaker.current;
		let last = speaker.last;
		if ( curr === self.userId )
			curr = 'selfie';
		if ( last === self.userId )
			last = 'selfie';
		
		if ( curr != self.currentSpeaker )
			unset();
		
		self.currentSpeaker = curr;
		self.lastSpeaker = last;
		set();
		
		self.updateThumbsGrid();
		
		function unset() {
			if ( null == self.currentSpeaker )
				return;
			
			const peer = self.peers[ self.currentSpeaker ];
			if ( !peer )
				return;
			
			peer.setIsSpeaking( false );
		}
		
		function set() {
			const peer = self.peers[ self.currentSpeaker ];
			if ( !peer )
				return;
			
			peer.setIsSpeaking( true );
		}
	}
	
	ns.UI.prototype.initStatusMessage = function() {
		const self = this;
		const id = 'init-checks';
		
		self.statusMsg = new library.view.StatusMsg();
		self.statusMsg.on( 'close', onClose );
		
		return self.statusMsg;
		
		function onClose() {
			delete self.statusMsg;
		}
	}
	
	ns.UI.prototype.removeCover = function() {
		const self = this;
		if ( !self.cover )
			return;
		
		self.cover.parentNode.removeChild( self.cover );
		delete self.cover;
	}
	
	ns.UI.prototype.addChat = function( userId, identities, conn ) {
		const self = this;
		self.chatTease = new library.component.ChatTease(
			'tease-chat-container',
			hello.template
		);
		self.chatTease.on( 'show-chat', showChat );
		function showChat( e ) {
			if ( !self.chatUI )
				return;
			
			const chatOpen = self.chatUI.toggle();
			self.chatTease.setActive( chatOpen );
			self.shareLink.updatePosition();
		}
		
		const conf = {
			conn        : conn,
			userId      : userId,
			identities  : identities,
			chatTease   : self.chatTease,
			guestAvatar : self.guestAvatar,
		};
		self.chatUI = self.addUIPane( 'chat', conf );
		self.chatUI.on( 'visible', onVisible );
		return self.chatUI;
		
		function onVisible( isVisible ) {
			self.chatTease.setActive( isVisible );
		}
	}
	
	ns.UI.prototype.addSettings = function() {
		const self = this;
		if ( !self.settingsBtn ) {
			console.log( 'UI.addSettings - settingsBtn missing, abort' );
			return;
		}
		
		self.settingsBtn.addEventListener( 'click', settingsClick, false );
		self.settingsUI = new library.view.DeviceSelect( self.settingsBtn, onSelect );
		self.settingsUI.on( 'visible', onVisible );
		return self.settingsUI;
		
		function settingsClick( e ) {
			if ( self.settingsShow )
				self.settingsUI.hide();
			else
				self.emit( 'device-select' );
			
		}
		
		function onVisible( isVisible ) {
			self.settingsShow = isVisible;
			self.settingsBtn.classList.toggle( 'available', isVisible );
		}
		
		function onSelect( devices ) {
			self.settingsUI.hide();
			self.emit( 'use-devices', devices );
		}
	}
	
	ns.UI.prototype.addExtConnPane = function( onshare ) {
		const self = this;
		const conf = {
			onshare : onshare,
		};
		self.extConnUI = self.addUIPane( 'ext-connect', conf );
		return self.extConnUI;
	}
	
	ns.UI.prototype.updateQualityLevel = function( level ) {
		const self = this;
		self.currentQuality = level;
		self.peerIds.forEach( setLevel );
		function setLevel( peerId ) {
			var peer = self.peers[ peerId ];
			peer.updateQualityLevel( level );
		}
	}
	
	ns.UI.prototype.close = function() {
		const self = this;
		delete self.conn;
		if( self.menu && self.menu.close )
			self.menu.close();
		delete self.menu;
	}
	
})( library.view );


// PEER
(function( ns, undefined ) {
	ns.Peer = function( conf ) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.id = conf.peer.id;
		self.peer = conf.peer;
		self.menu = conf.menu;
		self.connecting = conf.connecting;
		self.currentQuality = conf.currentQuality;
		self.audioSinkId = conf.audioSinkId;
		self.isHost = conf.isHost;
		self.ondrag = conf.ondrag;
		self.onclick = conf.onclick;
		self.onmenu = conf.onmenu;
		
		self.stream = null;
		
		self.localBlind = false;
		self.remoteBlind = false;
		
		self.isDragee = false;
		self.isDropzone = false;
		self.isDropTarget = false;
		
		self.sayMessages = false;
		
		self.isLowQMode = false;
		self.fastRefresh = false;
		self.showAsSpeaker = false;
		
		self.uiVisible = true;
		self.showStack = [];
		self.elementMap = {};
		
		self.init();
	}
	
	ns.Peer.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Peer.prototype.fadeOut = function() {
		const self = this;
		return self.fade( true );
	}
	
	ns.Peer.prototype.fadeIn = function() {
		const self = this;
		return self.fade( false );
	}
	
	ns.Peer.prototype.setFaded = function( showFaded ) {
		const self = this;
		self.el.classList.toggle( 'faded', showFaded );
	}
	
	ns.Peer.prototype.setInList = function() {
		const self = this;
		self.clearPosition();
		self.isInList = true;
		self.positionClass = 'in-list';
		self.updatePosition();
	}
	
	ns.Peer.prototype.setInGrid = function() {
		const self = this;
		self.clearPosition();
		self.isInGrid = true;
		self.positionClass = 'in-grid';
		self.updatePosition();
	}
	
	ns.Peer.prototype.setInThumbs = function() {
		const self = this;
		self.clearPosition();
		self.isInThumbs = true;
		self.positionClass = 'in-thumbs';
		self.updatePosition();
	}
	
	ns.Peer.prototype.setVoiceListMode = function( isLarge ) {
		const self = this;
		self.isVoiceListLarge = isLarge;
		self.el.classList.toggle( 'list-large', self.isVoiceListLarge );
	}
	
	ns.Peer.prototype.setIsSpeaking = function( isSpeaker ) {
		const self = this;
		self.isSpeaker = isSpeaker;
		self.el.classList.toggle( 'is-speaking', isSpeaker );
		//self.setFastStats( true );
		self.updateStatsRate();
	}
	
	ns.Peer.prototype.showIsSpeaking = function( isSpeaker ) {
		const self = this;
		if ( isSpeaker === self.showAsSpeaker )
			return;
		
		self.showAsSpeaker = isSpeaker;
		//self.el.classList.toggle( 'show-speaker', isSpeaker );
		//self.reflow();
		self.updateStatsRate();
	}
	
	ns.Peer.prototype.setAudioSink = function( deviceId ) {
		const self = this;
		self.audioSinkId = deviceId || '';
		self.updateAudioSink();
	}
	
	ns.Peer.prototype.getAvatarStr = function() {
		const self = this;
		if ( !self.identity )
			return null;
		
		return self.identity.avatar || null;
	}
	
	ns.Peer.prototype.getIdentity = function() {
		const self = this;
		return self.identity || {};
	}
	
	ns.Peer.prototype.setFastStats = function( fastRefresh ) {
		const self = this;
		if ( fastRefresh === self.fastRefresh )
			return;
		
		self.fastRefresh = fastRefresh;
		self.updateStatsRate();
	}
	
	// Private
	
	ns.Peer.prototype.init = function() {
		const self = this;
		self.buildView();
		self.bindUICommon();
		self.bindUI();
		self.bindPeerCommon();
		self.bindPeer();
		self.updateQualityLevel();
		self.setupMenu();
		self.initSelf();
		if ( self.peer.identity )
			self.updateIdentity( self.peer.identity );
	}
	
	ns.Peer.prototype.fade = function( fadeOut ) {
		const self = this;
		self.clearTransitionWait( 'ERR_ABORT' );
		return new Promise(( resolve, reject ) => {
			self.el.classList.toggle( 'faded', fadeOut );
			const trans = {
				ended   : transEnd,
				timeout : window.setTimeout( transOut, 3000 ),
			};
			self.waitForTransition( trans );
			
			function transOut() {
				self.clearTransitionWait( 'ERR_TIMEOUT' );
			}
			
			function transEnd( err, type ) {
				if ( err )
					reject( err );
				else
					resolve( type );
			}
		});
	}
	
	ns.Peer.prototype.updateStatsRate = function() {
		const self = this;
		let rate = null;
		if ( self.showAsSpeaker || self.isSpeaker )
			rate = 50;
		if ( self.fastRefresh )
			rate = 20;
		
		self.peer.setStatsRate( rate );
	}
	
	ns.Peer.prototype.setupMenu = function() {
		const self = this;
		self.menuId = friendUP.tool.uid( self.peerId );
		self.menuMuteId = self.menuId + '-mute';
		self.menuBlindId = self.menuId + '-blind';
		self.menuFocusId = self.menuId + '-focus';
		self.menuRemoveId = self.menuId + '-remove';
		const mute = {
			type   : 'item',
			id     : self.menuMuteId,
			name   : View.i18n( 'i18n_mute' ),
			faIcon : 'fa-microphone-slash',
			toggle : false,
			close  : false,
		};
		const blind = {
			type   : 'item',
			id     : self.menuBlindId,
			name   : View.i18n( 'i18n_pause' ),
			faIcon : 'fa-eye-slash',
			toggle : false,
			close  : false,
		};
		const focus = {
			type   : 'item',
			id     : self.menuFocusId,
			name   : View.i18n( 'i18n_focus_participant' ),
			faIcon : 'fa-bullseye',
			toggle : false,
			close  : true,
		};
		const remove = {
			type   : 'item',
			id     : self.menuRemoveId,
			name   : View.i18n( 'i18n_remove' ),
			faIcon : 'fa-close',
		};
		
		const mConf = {
			type   : 'folder',
			id     : self.menuId,
			name   : View.i18n( 'i18n_updating' ),
			faIcon : 'fa-user',
			items : [
				mute,
				blind,
				//focus,
			],
		};
		
		if ( self.isHost )
			mConf.items.push( remove );
		
		self.menu.add( mConf, 'peers' );
		// LId - listener id
		self.muteLId = self.menu.on( self.menuMuteId, toggleMute );
		self.blindLId = self.menu.on( self.menuBlindId, toggleBlind );
		self.focusLId = self.menu.on( self.menuFocusId, toggleFocus );
		
		if ( self.isHost ) {
			self.removeLId = self.menu.on( self.menuRemoveId, doRemove );
		}
		
		function toggleMute() {
			self.peer.toggleMute();
		}
		
		function toggleBlind() {
			self.peer.toggleBlind();
		}
		
		function toggleFocus() {
			self.peer.toggleFocus();
		}
		
		function doRemove() {
			self.peer.remove();
		}
	}
	
	ns.Peer.prototype.initSelf = function() {
		const self = this;
		const streamState = {
			type : 'stream',
			data : {
				type : 'waiting',
			},
		};
		self.updateRTC( streamState );
	}
	
	ns.Peer.prototype.clearPosition = function() {
		const self = this;
		self.isInList = false;
		self.isInGrid = false;
		self.isInThumbs = false;
		self.el.classList.toggle( self.positionClass, false );
	}
	
	ns.Peer.prototype.updatePosition = function() {
		const self = this;
		self.el.classList.toggle( self.positionClass, true );
		self.clickCatch.classList.toggle( 'hidden', self.isInList );
		self.updateUIVisibility();
		
		self.reflow();
	}
	
	ns.Peer.prototype.updateUIVisibility = function() {
		const self = this;
		if ( self.rtcState )
			self.rtcState.setEnabled( !self.isInThumbs );
		
		
	}
	
	ns.Peer.prototype.reload = function() {
		const self = this;
		self.peer.restart();
	}
	
	ns.Peer.prototype.restart = function() {
		const self = this;
		if ( !self.stream ) {
			console.log( 'video not set', self.id );
			return;
		}
		
		self.playStream();
		
	}
	
	ns.Peer.prototype.playStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.play()
			.then( playOk )
			.catch( playErr );
			
		function playOk( e ) {
		}
		
		function playErr( ex ) {
			console.log( 'Peer.playStream - ex', {
				id     : self.id,
				stream : self.stream,
				ex     : ex,
			});
		}
	}
	
	ns.Peer.prototype.buildView = function() {
		const self = this;
		const avatarUrl =  window.encodeURI( self.peer.getAvatar());
		const conf = {
			peerId : self.id,
			name   : self.peer.getName() || '',
			avatar : avatarUrl || '',
		};
		self.el = hello.template.getElement( 'peer-tmpl', conf );
		self.connecting.appendChild( self.el );
	}
	
	ns.Peer.prototype.bindUI = function() {
		const self = this;
		// states
		self.rtcState = new library.view.RTCState({ peerId : self.id });
		
		// ui
		self.menuBtn = self.ui.querySelector( '.peer-options' );
		self.sayStateBtn = self.ui.querySelector( '.say-state' );
		self.peerReload = self.ui.querySelector( '.peer-reload' );
		self.streamState = self.ui.querySelector( '.stream-state' );
		self.remoteMuteState = self.ui.querySelector( '.remote-mute' );
		self.remoteBlindState = self.ui.querySelector( 'remote-blind' );
		
		self.menuBtn.addEventListener( 'click', peerMenuClick, false );
		function peerMenuClick( e ) { self.showPeerActions(); }
		
		self.peerReload.addEventListener( 'click', peerReload, false );
		function peerReload( e ) { self.reload(); }
		
		// thumb ui
		self.thumbUI = self.el.querySelector( '.thumb-ui' );
		self.thumbMenuBtn = self.thumbUI.querySelector( '.peer-options' );
		
		self.thumbMenuBtn.addEventListener( 'click', thumbMenuClick, false );
		function thumbMenuClick( e ) { self.showPeerActions(); }
		
		// closing
		self.closing = self.ui.querySelector( '.closing' );
		
		self.elementMap[ 'stream-state' ] = self.streamState;
	}
	
	ns.Peer.prototype.bindUICommon = function() {
		const self = this;
		// stream
		self.avatar = self.el.querySelector( '.stream-container .avatar' );
		
		// list-ui
		self.listUI = self.el.querySelector( '.list-ui' );
		self.listUIState = self.listUI.querySelector( '.list-peer-state' );
		self.listAvatar = self.listUI.querySelector( '.list-avatar' );
		self.listIsSpeaking = self.listUI.querySelector( '.list-is-speaking' );
		self.listMuteRemote = self.listUI.querySelector( '.list-mute-remote' );
		self.listMuteLocal = self.listUI.querySelector( '.list-mute-local' );
		self.listName = self.listUI.querySelector( '.name' );
		
		// grid-ui
		self.ui = self.el.querySelector( '.grid-ui' );
		self.nameBar = self.el.querySelector( '.name-bar' );
		self.uiView = self.ui.querySelector( '.ui-view' );
		self.name = self.nameBar.querySelector( '.name' );
		self.infoName = self.el.querySelector( '.main-rtc .name' );
		self.clickCatch = self.el.querySelector( '.click-catch' );
		self.muteState = self.ui.querySelector( '.muted' );
		self.blindState = self.ui.querySelector( '.blinded' );
		
		// bind
		self.avatar.addEventListener( 'transitionend', avaTrans, false );
		self.avatar.addEventListener( 'transitioncancel', avaTrans, false );
		
		self.clickCatch.addEventListener( 'click', clickCatch, false );
		self.clickCatch.addEventListener( 'touchstart', clickCatch, false );
		self.uiView.addEventListener( 'click', uiViewClick, false );
		
		self.clickCatch.addEventListener( 'touchend', touchEnd, false );
		
		self.listUIState.addEventListener( 'click', listUIStateClick, false );
		
		self.listMuteLocal.addEventListener( 'click', muteStateClick, true );
		self.muteState.addEventListener( 'click', muteStateClick, false );
		self.blindState.addEventListener( 'click', blindStateClick, false );
		
		self.el.addEventListener( 'mouseenter', showUI, false );
		self.el.addEventListener( 'mouseleave', hideUI, false );
		
		self.el.addEventListener( 'transitionend', transEnd, false );
		self.el.addEventListener( 'transitioncancel', transEnd, false );
		
		function avaTrans( e ) {
			e.stopPropagation();
		}
		
		function transEnd( e ) {
			self.handleTransitionEnd( e.type );
		}
		
		function clickCatch( e ) {
			self.onclick( true );
		}
		
		function uiViewClick( e ) {
			if ( e.target !== self.uiView )
				return;
			
			e.stopPropagation();
			self.onclick( false );
		}
		
		function showUI( e ) {
			//self.showUI();
		}
		
		function hideUI( e ) {
			//self.hideUI();
		}
		
		function touchEnd( e ) { self.handleTouchEnd( e ); }
		
		function listUIStateClick( e ) {
			self.peer.toggleMute();
		}
		
		function muteStateClick( e ) {
			e.stopPropagation();
			self.peer.toggleMute();
		}
		function blindStateClick( e ) { self.peer.toggleBlind(); }
		
		// dragger
		self.dragger = self.el.querySelector( '.dragger' );
		self.dragCloseBtn = self.dragger.querySelector( '.drag-close' );
		self.dragHint = self.dragger.querySelector( '.drag-hint' );
		self.dragHintDraggable = self.dragger.querySelector( '.drag-hint .draggable' );
		self.dragHintDragee = self.dragger.querySelector( '.drag-hint .dragee' );
		self.dragHintDropzone = self.dragger.querySelector( '.drag-hint .dropzone' );
		self.dragHintDropTarget = self.dragger.querySelector( '.drag-hint .drop-target' );
		
		self.dragger.addEventListener( 'dragstart', dragStart, false );
		self.dragger.addEventListener( 'dragenter', dragEnter, false );
		self.dragger.addEventListener( 'dragover', dragEnter, false );
		self.dragger.addEventListener( 'dragleave', dragLeave, false );
		self.dragger.addEventListener( 'dragend', dragEnd, false );
		self.dragger.addEventListener( 'drop', drop, false );
		self.dragger.addEventListener( 'mouseenter', dragMouseEnter, false );
		self.dragger.addEventListener( 'mouseleave', dragMouseLeave, false );
		self.dragCloseBtn.addEventListener( 'click', dragClose, false );
		
		function wheelEvent( e ) { self.handleWheelEvent( e ); }
		
		function dragStart( e ) { self.handleDragStart( e ); }
		function dragEnter( e ) { self.handleDragEnter( e ); }
		function dragLeave( e ) { self.handleDragLeave( e ); }
		function dragEnd( e ) { self.handleDragEnd( e ); }
		function drop( e ) { self.handleDrop( e ); }
		function dragClose( e ) { self.dragClose(); }
		function dragMouseEnter( e ) { self.toggleDraggable( true ); }
		function dragMouseLeave( e ) { self.toggleDraggable( false ); }
		
		self.elementMap[ 'dragger' ] = self.dragger;
	}
	
	ns.Peer.prototype.handleTransitionEnd = function( type ) {
		const self = this;
		const trans = self.transition;
		if ( !trans )
			return;
		
		delete self.transition;
		if ( trans.timeout )
			window.clearTimeout( trans.timeout );
		
		trans.ended( null, type );
	}
	
	ns.Peer.prototype.waitForTransition = function( conf ) {
		const self = this;
		self.transition = conf;
	}
	
	ns.Peer.prototype.clearTransitionWait = function( errCode ) {
		const self = this;
		const trans = self.transition;
		if ( !trans )
			return;
		
		trans.ended( errCode, null )
	}
	
	ns.Peer.prototype.handleTouchEnd = function( e ) {
		const self = this;
		console.log( 'live.Peer.handleTouchEnd - also not' );
		/*
		var selector =  e.path[ 0 ].className;
		var match = selector.match( /btn/ );
		if ( !match ) {
			selector = e.path[ 1 ].className;
			match = selector.match( /btn/ );
		}
		
		if ( !match )
			self.hideUI();
		*/
	}
	
	ns.Peer.prototype.checkIsShown = function( type ) {
		const self = this;
		var index = self.showStack.indexOf( type );
		return -1 !== index;
	}
	
	ns.Peer.prototype.showPeerActions = function() {
		const self = this;
		self.onmenu();
	}
	
	//ns.Peer.prototype.showPeerThumbActions
	
	ns.Peer.prototype.toggleOptions = function() {
		const self = this;
		var isShown = self.checkIsShown( 'options' );
		if ( !isShown )
			self.showOptions();
		else
			self.hideOptions();
	}
	
	ns.Peer.prototype.showOptions = function() {
		const self = this;
		self.showTheThing( 'options' );
	}
	
	ns.Peer.prototype.hideOptions = function() {
		const self = this;
		self.hideTheThing( 'options' );
	}
	
	ns.Peer.prototype.showState = function() {
		const self = this;
		self.streamState.classList.toggle( 'hidden', false );
	}
	
	ns.Peer.prototype.hideState = function() {
		const self = this;
		self.streamState.classList.toggle( 'hidden', true );
	}
	
	ns.Peer.prototype.showTheThing = function( name ) {
		const self = this;
		var index = self.showStack.indexOf( name );
		if ( -1 === index )
			self.showStack.push( name );
		else
			moveToTop( index, name );
		
		self.showTheThings();
		
		function moveToTop( index, name ) {
			if (( self.showStack.length - 1 ) === index )
				return;
			
			self.showStack.splice( index, 1 );
			self.showStack.push( name );
		}
	}
	
	ns.Peer.prototype.hideTheThing = function( name ) {
		const self = this;
		var index = self.showStack.indexOf( name );
		if ( index === -1 )
			return false;
		
		var hideElement = self.elementMap[ name ];
		self.toggleElement( hideElement, false );
		self.showStack.splice( index, 1 );
		self.showTheThings();
	}
	
	ns.Peer.prototype.showTheThings = function() {
		const self = this;
		if ( self.showStack.length > 1 )
			hide();
		
		var showName = self.showStack[ self.showStack.length -1 ];
		var showElement = self.elementMap[ showName ];
			if ( !showElement ) {
				console.log( 'peer.showTheThings - element not found',
					{ s : self.showStack, e : self.elementMap });
				return;
			}
		
		self.toggleElement( showElement, true );
		
		function hide() {
			var hideName = self.showStack[( self.showStack.length - 2 )];
			var hideElement = self.elementMap[ hideName ];
			if ( !hideElement )
				return;
			
			self.toggleElement( hideElement, false );
		}
	}
	
	ns.Peer.prototype.hideTheThings = function() {
		const self = this;
		var top = self.showStack[ self.showStack.length -1 ];
		var topElement = self.elementMap[ top ];
		if ( !topElement )
			return;
		
		self.toggleElement( topElement, false );
	}
	
	ns.Peer.prototype.handleWheelEvent = function( e ) {
		const self = this;
		console.log( 'live.Peer.handleWheelEvent, nope' );
		/*
		var scrollDistance = self.chatessages.clientHeight / 10;
		var scrollPosition = self.chatessages.scrollTop;
		if ( e.deltaY < 0 )
			scrollUp();
		else
			scrollDown();
		
		function scrollUp() {
			//self.chatessages.scrollTop = scrollPosition - scrollDistance;
		}
		
		function scrollDown() {
			//self.chatessages.scrollTop = scrollPosition + scrollDistance;
		}
		*/
	}
	
	ns.Peer.prototype.muteClick = function() {
		const self = this;
		self.peer.toggleMute();
	}
	
	ns.Peer.prototype.blindClick = function() {
		const self = this;
		self.peer.toggleBlind();
	}
	
	ns.Peer.prototype.setSayState = function( say ) {
		const self = this;
		if ( typeof( say ) === 'undefined' )
			say = !self.sayMessages;
		
		self.sayMessages = say;
		self.sayStateBtn.classList.toggle( 'blink-green', say );
		
		if ( !self.chatShow && ( say === false ) )
			self.toggleSayState( false );
	}
	
	ns.Peer.prototype.enableDragMode = function() {
		const self = this;
		self.ondrag( 'enable' );
	}
	
	ns.Peer.prototype.showDragger = function() {
		const self = this;
		self.showUI();
		self.showTheThing( 'dragger' );
	}
	
	ns.Peer.prototype.hideDragger = function() {
		const self = this;
		self.hideTheThing( 'dragger' );
		self.toggleUI();
	}
	
	ns.Peer.prototype.dragClose = function() {
		const self = this;
		self.ondrag( 'disable' );
	}
	
	ns.Peer.prototype.removeClick = function( e ) {
		const self = this;
		e.preventDefault();
		self.peer.remove();
	}
	
	ns.Peer.prototype.toggleDraggable = function( showDraggable ) {
		const self = this;
		if ( self.isDragging )
			return;
		
		self.dragHintDraggable.classList.toggle( 'hidden', !showDraggable );
		self.dragHintDropzone.classList.toggle( 'hidden', showDraggable );
	}
	
	ns.Peer.prototype.handleDragStart = function( e ) {
		const self = this;
		self.toggleDragee( true );
		self.ondrag( 'start' );
	}
	
	ns.Peer.prototype.handleDragEnter = function( e ) {
		const self = this;
		if ( self.isDragee )
			return;
		
		e.preventDefault();
		self.toggleDropTarget( true );
	}
	
	ns.Peer.prototype.handleDragLeave = function( e ) {
		const self = this;
		if ( self.isDragee )
			return;
		
		self.toggleDropTarget( false );
	}
	
	ns.Peer.prototype.handleDragEnd = function( e ) {
		const self = this;
		
		self.ondrag( 'end' );
		self.toggleDragee( false );
	}
	
	ns.Peer.prototype.handleDrop = function( e ) {
		const self = this;
		
		self.toggleDropTarget( false );
		self.ondrag( 'drop' );
	}
	
	ns.Peer.prototype.setIsDragging = function( ayeOrNay ) {
		const self = this;
		self.isDragging = ayeOrNay;
	}
	
	ns.Peer.prototype.toggleDragee = function( isDragee ) {
		const self = this;
		if ( self.isDragee === isDragee )
			return;
		
		self.isDragee = isDragee;
		self.dragHintDraggable.classList.toggle( 'hidden', isDragee );
		self.dragHintDragee.classList.toggle( 'hidden', !isDragee );
	}
	
	ns.Peer.prototype.toggleDropTarget = function( isTarget ) {
		const self = this;
		if ( self.isDropTarget === isTarget )
			return;
		
		self.isDropTarget = isTarget;
		self.dragHintDropzone.classList.toggle( 'hidden', isTarget );
		self.dragHintDropTarget.classList.toggle( 'hidden', !isTarget );
	}
	
	ns.Peer.prototype.toggleDropzone = function( show ) {
		const self = this;
		if ( self.isDragee )
			return;
		
		if ( self.isDropzone === show )
			return;
		
		
		if ( show )
			self.showDragger();
		else
			self.hideDragger();
		
		
		self.isDropzone = show;
		self.dragHint.classList.toggle( 'dropzone', show );
		self.dragHintDraggable.classList.toggle( 'hidden', show );
		self.dragHintDropzone.classList.toggle( 'hidden', !show );
	}
	
	ns.Peer.prototype.toggleSpinner = function( show ) {
		const self = this;
		if ( self.stream )
			show = false;
		
		if ( !self.rtcState )
			return;
		
		self.rtcState.toggle( show );
	}
	
	ns.Peer.prototype.toggleUIMode = function( uiVisible ) {
		const self = this;
		if ( null == uiVisible )
			self.uiVisible = !self.uiVisible;
		else
			self.uiVisible = uiVisible;
		
		self.toggleUI();
	}
	
	ns.Peer.prototype.showUI = function() {
		const self = this;
		self.toggleUI( true );
	}
	
	ns.Peer.prototype.hideUI = function() {
		const self = this;
		self.toggleUI( false );
	}
	
	ns.Peer.prototype.toggleUI = function( temp ) {
		const self = this;
		var show = self.uiVisible || !!temp;
		//self.ui.classList.toggle( 'is-visible', show );
		self.el.classList.toggle( 'show-ui', show );
	}
	
	ns.Peer.prototype.bindPeerCommon = function() {
		const self = this;
		self.peer.on( 'media'           , handleMedia );
		self.peer.on( 'track'           , handleTrack );
		self.peer.on( 'legacy-stream'   , handleLegacyStream );
		self.peer.on( 'video'           , handleVideo );
		self.peer.on( 'audio'           , handleAudio );
		self.peer.on( 'tracks-available', tracksAvailable )
		self.peer.on( 'identity'        , updateIdentity );
		self.peer.on( 'nostream'        , handleNoStream );
		self.peer.on( 'stop'            , handleStop)
		self.peer.on( 'mute'            , isMuted );
		self.peer.on( 'blind'           , isBlinded );
		self.peer.on( 'is-focus'        , isFocus );
		self.peer.on( 'screen-mode'     , screenMode );
		self.peer.on( 'screen-share'    , screenShare );
		self.peer.on( 'local-quality'   , localQuality );
		self.peer.on( 'change-video-res', e => self.handleVideoRes( e ));
		self.peer.on( 'audio-level'     , e => self.handleAudioLevel( e ));
		
		function handleMedia( e ) { self.handleMedia( e ); }
		function handleTrack( e, f ) { self.handleTrack( e, f ); }
		function handleLegacyStream( e ) { self.handleLegacyStream( e ); }
		function handleVideo( e ) { self.handleVideo( e ); }
		function handleAudio( e ) { self.handleAudio( e ); }
		function tracksAvailable( e ) { self.handleTracksAvailable( e ); }
		function updateIdentity( e ) { self.updateIdentity( e ); }
		function handleNoStream( e ) { self.handleNoStream( e ); }
		function handleStop( e ) { self.handleStop( e ); }
		function isMuted( e ) { self.handleSelfMute( e ); }
		function isBlinded( e ) { self.handleSelfBlind( e ); }
		function isFocus( e ) { self.handleIsFocus( e ); }
		function screenMode( e ) { self.handleScreenMode( e ); }
		function screenShare( e ) { self.handleScreenShare( e ); }
		function localQuality( e ) { self.updateQualityLevel( e ); }
	}
	
	ns.Peer.prototype.bindPeer = function() {
		const self = this;
		self.peer.on( 'meta'   , handleMeta );
		self.peer.on( 'muted'  , remoteMute );
		self.peer.on( 'blinded', remoteBlind );
		self.peer.on( 'state'    , updateRTC );
		
		function handleMeta( e ) { self.handleMeta( e ); }
		function remoteMute( e ) { self.toggleRemoteMute( e ); }
		function remoteBlind( e ) { self.toggleRemoteBlind( e ); }
		function updateRTC( e ) { self.updateRTC( e ); }
	}
	
	ns.Peer.prototype.handleMeta = function( meta ) {
		const self = this;
		if ( meta.sending )
			updateMenuFocus( !!meta.sending.video );
		
		function updateMenuFocus( videoAvailable ) {
			if ( !self.menu )
				return;
			
			if ( videoAvailable )
				self.menu.enable( self.menuFocusId );
			else
				self.menu.disable( self.menuFocusId );
		}
	}
	
	ns.Peer.prototype.handleMedia = function( media ) {
		const self = this;
		if ( !media )
			return;
		
		const mId = media.id;
		if ( !self.stream )
			self.setStream( mId );
		
		self.stream.pause();
		let currMedia = self.stream.srcObject;
		if ( !currMedia ) {
			self.stream.srcObject = media;
			self.stream.load();
			return;
		}
		
		if ( currMedia.id == mId ) {
			self.stream.load();
			return;
		}
		
		const currTracks = currMedia.getTracks();
		currTracks.forEach( t => {
			currMedia.removeTrack( t );
		});
		self.stream.load();
		self.stream.srcObject = media;
		//self.bindStream();
		//self.updateAudioSink();
		self.stream.load();
	}
	
	ns.Peer.prototype.bindStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.addEventListener( 'error', err, false );
		self.stream.addEventListener( 'ended', end, false );
		self.stream.addEventListener( 'waiting', waiting, false );
		self.stream.addEventListener( 'suspended', susp, false );
		self.stream.addEventListener( 'pause', pause, false );
		
		function err( e ) {
			console.log( 'stream err event', e );
		}
		
		function end( e ) {
			console.log( 'stream end event', e );
		}
		
		function waiting( e ) {
			console.log( 'stream waiting event', e );
		}
		
		function susp( e ) {
			console.log( 'stream susp event', e );
		}
		
		function pause( e ) {
			console.log( 'stream pause event', e );
		}
		
		
	}
	
	ns.Peer.prototype.unbindStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
	}
	
	ns.Peer.prototype.handleTrack = function( type, track ) {
		const self = this;
		// set state
		if ( !self.isUpdatingStream ) {
			self.stream.pause();
			self.isUpdatingStream = true;
		}
		
		//
		self.removeTrack( type );
		if ( null == track ) {
			self.stream.load();
			return;
		}
		
		self.stream.srcObject.addTrack( track );
		self.stream.load();
	}
	
	ns.Peer.prototype.removeTrack = function( type ) {
		const self = this;
		if ( !self.stream )
			return;
		
		const srcObj = self.stream.srcObject;
		let removed = false;
		if ( !srcObj )
			return false;
		
		let tracks = srcObj.getTracks();
		tracks.forEach( removeType );
		return removed;
		
		function removeType( track ) {
			if ( type !== track.kind )
				return;
			
			srcObj.removeTrack( track );
			track.stop();
			removed = true;
		}
	}
	
	ns.Peer.prototype.handleLegacyStream = function( conf ) {
		const self = this;
		self.hasVideo = conf.isVideo;
		self.isAudio = conf.isAudio;
		const src = window.URL.createObjectURL( conf.stream );
		self.setStream( conf.stream.id, src );
		//self.stream.src = src;
		//self.updateStream();
		self.updateButtonVisibility();
		self.toggleStream();
	}
	
	ns.Peer.prototype.handleTracksAvailable = function( available ) {
		const self = this;
		let removedAThing = false;
		if ( !available.audio )
			removedAThing = self.removeTrack( 'audio' );
		
		if ( !available.video )
			removedAThing = self.removeTrack( 'video' );
		
		if ( removedAThing )
			self.stream.load();
	}
	
	ns.Peer.prototype.handleVideo = function( available ) {
		const self = this;
		if ( !self.stream )
			return;
		
		self.hasVideo = available;
		//self.updateStream();
		self.updateButtonVisibility();
		self.toggleStream();
		self.emit( 'video', self.hasVideo );
	}
	
	ns.Peer.prototype.handleAudio = function( available ) {
		const self = this;
		if ( !self.stream )
			return;
		
		self.isAudio = available;
		if ( self.isAudio )
			self.updateAudioSink();
		
		//self.updateStream();
		self.updateButtonVisibility();
		self.emit( 'audio', self.isAudio );
	}
	
	ns.Peer.prototype.updateStream = function() {
		const self = this;
		console.log( 'live.Peer.updateStream - dude, not doing streams' );
	}
	
	ns.Peer.prototype.bindStreamResize = function() {
		const self = this;
		self.videoResizeListener = videoResize;
		self.stream.addEventListener( 'resize', self.videoResizeListener, false );
		function videoResize( e ) {
			var width = e.target.clientWidth;
			var height = e.target.clientHeight;
			var aspectRatio = width / height;
			
			if ( !aspectRatio )
				return;
			
			self.videoAspect = aspectRatio;
			self.doResize();
			self.handleTransitionEnd( 'resize' );
			
			/*
			if ( aspectRatio > 1 )
				self.stream.classList.add( 'landscape' );
			else
				self.stream.classList.add( 'portrait' );
			*/
		}
	}
	
	ns.Peer.prototype.doResize = function() {
		const self = this;
		const container = document.getElementById( self.id )
			.querySelector( '.stream-container' );
		
		toggle( 'video-border', self.isLowQMode );
		if ( self.isLowQMode && !self.isPopped ) {
			toggle( 'width', false );
			toggle( 'height', false );
			return;
		}
		
		const width = container.scrollWidth;
		const height = container.scrollHeight;
		const containerAspect = width / height;
		if ( containerAspect < self.videoAspect )
			toggleUseWidth( true );
		else
			toggleUseWidth( false );
			
		function toggleUseWidth( useWidth ) {
			if ( 'contain' === self.screenMode
				|| self.screenShare
			) {
				useWidth = !useWidth;
				self.hideAvatar();
			} else
				self.showAvatar();
			
			toggle( 'width', useWidth );
			toggle( 'height', !useWidth );
		}
		
		function toggle( classStr, set ) {
			if ( !self.stream )
				return;
			
			self.stream.classList.toggle( classStr, set );
		}
	}
	
	ns.Peer.prototype.showAvatar = function() {
		const self = this;
		self.el.classList.toggle( 'no-avatar', false );
	}
	
	ns.Peer.prototype.hideAvatar = function() {
		const self = this;
		self.el.classList.toggle( 'no-avatar', true );
	}
	
	ns.Peer.prototype.reflow = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		let resize = new Event( 'resize' );
		self.stream.dispatchEvent( resize );
		/*
		if ( self.volume )
			self.volume.start();
		*/
	}
	
	ns.Peer.prototype.setStream = function( id, src ) {
		const self = this;
		if ( self.stream )
			self.removeStream();
		
		src = src || '';
		const conf = {
			id : id,
			src : src,
		};
		
		const peerEl = document.getElementById( self.id );
		const container = peerEl.querySelector( '.stream-container' );
		const RTCInfo = container.querySelector( '.main-rtc' );
		
		self.stream = hello.template.getElement( 'stream-video-tmpl', conf );
		self.stream.onloadedmetadata = play;
		//self.updateAudioSink();
		
		container.insertBefore( self.stream, RTCInfo );
		self.toggleSpinner( false );
		self.bindStreamResize();
		
		function play( e ) {
			self.updateAudioSink();
			self.playStream();
		}
	}
	
	ns.Peer.prototype.removeStream = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.unbindStream();
		if ( self.stream.pause )
			self.stream.pause();
		
		let srcObj = self.stream.srcObject;
		if ( srcObj )
			clear( srcObj );
		
		self.stream.srcObject = null;
		self.stream.src = '';
		self.stream.removeEventListener( 'resize', self.videoResizeListener );
		self.stream.onloadedmetadata = null;
		
		if ( self.stream.load )
			self.stream.load();
		
		self.videoResizeListener = null;
		
		if ( !self.stream.parentNode ) {
			console.log( 'removeStream - parent node not found', self.stream.parentNode );
			self.stream = null;
			return;
		}
		
		self.stream.parentNode.removeChild( self.stream );
		self.stream = null;
		
		function clear( src ) {
			if ( !src.getTracks )
				return;
			
			let tracks = src.getTracks();
			tracks.forEach( remove );
			function remove( track ) {
				track.stop();
				src.removeTrack( track );
			}
		}
	}
	
	ns.Peer.prototype.releaseStream = function() {
		const self = this;
		self.removeStream();
		self.hasVideo = false;
		self.isAudio = false;
		self.resetState();
		self.toggleStream();
		self.updateButtonVisibility();
	}
	
	ns.Peer.prototype.resetState = function() {
		const self = this;
		const isMuted = false;
		const isBlinded = false;
		self.toggleMuteState( isMuted );
		self.toggleRemoteMute( isMuted );
		self.toggleBlindState( isBlinded );
		self.toggleRemoteBlind( isBlinded );
	}
	
	ns.Peer.prototype.updateAudioSink = function() {
		const self = this;
		const deviceId = self.audioSinkId || '';
		if ( !self.stream ) {
			self.audioSinkId = deviceId;
			console.log( 'setAudioSink - no stream' );
			return;
		}
		
		if ( !self.stream.setSinkId ) {
			console.log( 'setAudioSink - setSinkId is not supported' );
			return;
		}
		
		if ( !self.isAudio )
			return;
		
		/*
		if ( self.stream.sinkId === deviceId ) {
			console.log( 'setAudioSink - this deviceId is already set', deviceId );
			return;
		}
		*/
		
		self.stream.setSinkId( deviceId )
			.then( ok )
			.catch( fail );
			
		function ok() {
			self.audioSinkId = deviceId;
		}
		
		function fail( err ) {
			console.log( 'failed to set audio sink', {
				err : err,
				did : deviceId,
			});
			self.audioSinkId = null;
			const status = {
				type    : 'warning',
				message : 'WARN_AUDIO_SINK_NOT_ALLOWED',
				events  : [ 'close' ],
			};
			self.emit( 'status', status );
		}
	}
	
	ns.Peer.prototype.updateButtonVisibility = function() {
		const self = this;
		if ( self.isAudio )
			self.menu.enable( self.menuMuteId );
		else
			self.menu.disable( self.menuMuteId );
		
		if ( self.hasVideo )
			self.menu.enable( self.menuBlindId );
		else
			self.menu.disable( self.menuBlindId );
	}
	
	ns.Peer.prototype.handleSelfMute = function( isMuted ) {
		const self = this;
		self.menu.setState( self.menuMuteId, isMuted );
		self.toggleMuteState( isMuted );
	}
	
	ns.Peer.prototype.toggleMuteState = function( isMuted ) {
		const self = this;
		self.toggleElement( self.muteState, isMuted );
		self.toggleElement( self.listMuteLocal, isMuted );
	}
	
	ns.Peer.prototype.toggleRemoteMute = function( isMuted ) {
		const self = this;
		self.toggleUIIndicator( '.remote-mute', isMuted );
		self.toggleElement( self.listMuteRemote, isMuted );
	}
	
	ns.Peer.prototype.handleSelfBlind = function( isBlinded ) {
		const self = this;
		self.localBlind = isBlinded
		self.menu.setState( self.menuBlindId, isBlinded );
		self.toggleBlindState( isBlinded );
		self.toggleStream();
	}
	
	ns.Peer.prototype.toggleBlindState = function( isBlinded ) {
		const self = this;
		self.toggleElement( self.blindState, isBlinded );
	}
	
	ns.Peer.prototype.toggleRemoteBlind = function( isBlinded ) {
		const self = this;
		self.remoteBlind = isBlinded;
		self.toggleStream();
		self.toggleUIIndicator( '.remote-blind', isBlinded );
	}
	
	ns.Peer.prototype.handleIsFocus = function( isFocus ) {
		const self = this;
		self.menu.setState( self.menuFocusId, isFocus );
	}
	
	ns.Peer.prototype.toggleStream = function( force ) {
		const self = this;
		if ( force !== undefined ) {
			toggle( force );
			return;
		}
		
		if ( self.localBlind || self.remoteBlind || !self.hasVideo )
			toggle( false );
		else
			toggle( true );
		
		function toggle( visible ) {
			if ( !self.stream ) {
				console.log( 'togglestream - no stream' );
				return;
			}
			
			self.stream.classList.toggle( 'hidden', !visible );
			self.avatar.classList.toggle( 'visible', !visible );
			
			if ( visible )
				self.reflow();
		}
	}
	
	ns.Peer.prototype.handleScreenMode = function( screenMode ) {
		const self = this;
		self.screenMode = screenMode;
		self.doResize();
	}
	
	ns.Peer.prototype.handleScreenShare = function( isActive ) {
		const self = this;
		self.screenShare = isActive;
		self.updateQualityLevel();
		self.doResize();
	}
	
	ns.Peer.prototype.updateRTC = function( event ) {
		const self = this;
		self.rtcState.update( event );
	}
	
	ns.Peer.prototype.updateIdentity = function( identity ) {
		const self = this;
		identity = identity || self.identity;
		self.identity = identity;
		const id = identity;
		if ( !id ) {
			console.log( 'updateIdentity - no identity' )
			return;
		}
		
		const name = id.liveName || id.name;
		if ( name && name.length ) {
			self.name.innerText = name;
			if ( self.infoName )
				self.infoName.innerText = name;
			
			self.listName.innerText = name;
			self.menu.update( self.menuId, name );
		}
		
		if ( id.avatar && id.avatar.length ) {
			let avatarUrl = window.encodeURI( id.avatar );
			let avatarStyle = 'url("' + avatarUrl + '")';
			self.avatar.style.backgroundImage = avatarStyle;
			self.listAvatar.style.backgroundImage = avatarStyle;
		}
	}
	
	ns.Peer.prototype.updateName = function( name ) {
		const self = this;
		self.name.innerText = name;
		self.listName.innerText = name;
	}
	
	ns.Peer.prototype.handleNoStream = function() {
		const self = this;
		self.toggleSpinner( false );
	}
	
	ns.Peer.prototype.handleStop = function() {
		const self = this;
		self.releaseStream();
	}
	
	ns.Peer.prototype.updateQualityLevel = function( level ) {
		const self = this;
		self.currentQuality = level || self.currentQuality;
		let isLow = false;
		if ( 'low' === self.currentQuality )
			isLow = true;
		if ( self.screenShare )
			isLow = false;
		
		if ( isLow === self.isLowQMode )
			return;
		
		self.isLowQMode = isLow;
		self.toggleElementClass( self.avatar, 'fade', isLow );
		self.el.classList.toggle( 'quality-low', isLow );
		
		self.reflow();
	}
	
	ns.Peer.prototype.handleVideoRes = function( res ) {
		const self = this;
		self.emit( 'video-resolution', res );
		if ( null == res )
			return;
		
		//self.playStream();
	}
	
	ns.Peer.prototype.handleAudioLevel = function( level ) {
		const self = this;
		//console.log( 'handleAudioLevel', [ self.identity.name, level ]);
		self.updateAvatarVolume( level );
	}
	
	ns.Peer.prototype.updateAvatarVolume = function( level ) {
		const self = this;
		if ( self.hasVideo || !self.isInGrid )
			return;
		
		if ( level < 0.01 )
			level = 0;
		
		const width = 20 * level;
		//console.log( 'updateAvatarVolume', width );
		self.avatar.style.boxShadow = "#0F85D1 0px 0px " + width + "vmin";
	}
	
	ns.Peer.prototype.setButtonIcon = function( btn, remove, add ) {
		const self = this;
		const i = btn.querySelector( 'i' );
		i.classList.toggle( remove, false );
		i.classList.toggle( add, true );
	}
	
	ns.Peer.prototype.toggleUIIndicator = function( indicatorClass, isOn ) {
		const self = this;
		const peerElement = document.getElementById( self.id );
		if ( !peerElement ) {
			console.log( 'wtf no peer element', self );
			window.setTimeout(
				e => self.toggleUIIndicator( indicatorClass, isOn ),
				100
			);
			return;
		}
		
		const uiElement = peerElement.querySelector( indicatorClass );
		uiElement.classList.toggle( 'hidden', !isOn );
	}
	
	ns.Peer.prototype.toggleElement = function( element, show ) {
		const self = this;
		if ( null == show )
			element.classList.toggle( 'hidden' );
		else
			element.classList.toggle( 'hidden', !show );
	}
	
	ns.Peer.prototype.toggleElementClass = function( element, className, set ) {
		const self = this;
		element.classList.toggle( className, set );
	}
	
	ns.Peer.prototype.is = function() {
		const self = this;
		return !!( self.id === 'selfie' );
	}
	
	ns.Peer.prototype.showClose = function( callback ) {
		const self = this;
		self.close();
		
		/*
		self.hideOptions();
		self.hideState();
		self.rtcState.hide();
		self.removeStream();
		self.toggleElement( self.closing, true );
		var containerEl = self.closing.querySelector( '.closing-countdown' );
		var conf = {
			timer : 1000 * 5,
			containerEl : containerEl,
			onfinished : onFinished,
		};
		self.showClosing = new library.component.Countdown( conf );
		
		function onFinished() {
			delete self.showClosing;
			callback();
		}
		*/
	}
	
	ns.Peer.prototype.close = function() {
		const self = this;
		self.removeStream();
		
		delete self.ondrag;
		delete self.onclick;
		delete self.onmenu;
		
		self.menu.off( self.muteLId );
		self.menu.off( self.blindLId );
		self.menu.off( self.focusLId );
		self.menu.off( self.removeLId );
		self.menu.remove( self.menuId );
		delete self.menu;
		
		delete self.connecting;
		var element = document.getElementById( self.id );
		if ( !element || !element.parentNode )
			return;
		
		element.parentNode.removeChild( element );
	}
	
})( library.view );

// Countdown
(function( ns, undefined ) {
	ns.Countdown = function( conf ) {
		if ( !( this instanceof ns.Countdown ))
			return new ns.Countdown( conf );
		
		const self = this;
		self.timer = conf.timer;
		self.containerEl = conf.containerEl;
		self.onfinished = conf.onfinished;
		
		self.stop = false;
		self.canvas = null;
		self.ctx = null;
		
		self.init();
	}
	
	ns.Countdown.prototype.init = function() {
		const self = this;
		// build
		const cw = self.containerEl.clientWidth;
		const ch = self.containerEl.clientHeight;
		const wh = Math.min( cw, ch );
		if ( !wh ) {
			console.log( 'canvas is hidden.. no, its FINE, forget it.' );
			self.finished();
			return;
		}
		
		self.id = friendUP.tool.uid( 'countdown' );
		const conf = {
			id : self.id,
			sq : wh,
		};
		const element = hello.template.getElement( 'countdown-tmpl', conf );
		self.containerEl.appendChild( element );
		
		//bind
		self.canvas = element.querySelector( 'canvas' );
		const closeBtn = element.querySelector( '.countdown-close-now' );
		closeBtn.addEventListener( 'click', closeNow, false );
		
		
		function closeNow( e ) {
			self.stop = true;
		}
		
		// anim setup
		self.startTime = Date.now();
		self.endTime = self.startTime + self.timer;
		self.ctx = self.canvas.getContext( '2d' );
		self.cSize = self.ctx.canvas.clientWidth;
		self.radius = Math.floor( self.cSize / 2 );
		self.ctx.lineWidth = 6;
		self.ctx.lineCap = 'round';
		self.ctx.strokeStyle = 'red';
		self.animate();
	}
	
	ns.Countdown.prototype.animate = function() {
		const self = this;
		getFrame();
		
		function getFrame() {
			self.animFrame = window.requestAnimationFrame( step );
		}
		
		function step() {
			self.update();
			if ( self.stop ) {
				self.finished();
				return;
			}
			
			self.draw();
			getFrame();
		}
	}
	
	ns.Countdown.prototype.update = function() {
		const self = this;
		var now = Date.now();
		if ( now > self.endTime ) {
			self.stop = true;
			return;
		}
		
		var progress = now - self.startTime;
		var progress = 1 - ( 1 / ( self.timer / progress ));
		self.progressRadians = ( Math.PI * 2 ) * progress;
	}
	
	ns.Countdown.prototype.draw = function() {
		const self = this;
		self.clear();
		
		self.ctx.save();
		self.ctx.translate( self.radius, self.radius );
		self.ctx.rotate( -Math.PI / 2 );
		self.ctx.beginPath();
		self.ctx.arc( 0, 0, ( self.radius - 3 ) , 0, self.progressRadians );
		self.ctx.stroke();
		self.ctx.restore();
	}
	
	ns.Countdown.prototype.clear = function() {
		const self = this;
		self.ctx.clearRect( 0, 0, self.cSize, self.cSize );
	}
	
	ns.Countdown.prototype.finished = function() {
		const self = this;
		//window.cancelAnimationFrame( self.animFrame );
		self.animFrame = null;
		var fin = self.onfinished;
		self.close();
		fin();
	}
	
	ns.Countdown.prototype.close = function() {
		const self = this;
		self.stop = true;
		var element = document.getElementById( self.id );
		if ( element )
			element.parentNode.removeChild( element );
		
		delete self.onfinished;
		delete self.ctx;
		delete self.canvas;
		delete self.containerEl;
		
	}
	
})( library.component );

// selfie
(function( ns, undefined ) {
	ns.Selfie = function(
		conf,
		audioBtn,
		videoBtn,
		screenshareBtn
	) {
		const self = this;
		self.onclean = conf.onclean;
		self.audioBtn = audioBtn;
		self.videoBtn = videoBtn;
		self.screenshareBtn = screenshareBtn;
		self.selectedStreamQuality = 'normal';
		
		self.poppedUser = true;
		self.showDuration = false;
		
		ns.Peer.call( this, conf );
	}
	
	ns.Selfie.prototype = Object.create( ns.Peer.prototype );
	
	// Public
	
	ns.Selfie.prototype.setFastStats = function() {
		const self = this;
	}
	
	ns.Selfie.prototype.togglePopped = function( userSet ) {
		const self = this;
		if ( null == userSet )
			self.poppedUser = !self.poppedUser;
		else
			self.poppedUser = userSet;
		
		self.peer.saveLocalSetting( 'popped_user', self.poppedUser );
		return self.updatePopped();
	}
	
	ns.Selfie.prototype.setPopped = function( appSet ) {
		const self = this;
		// is in list, ignore everything else
		if ( null == appSet )
			self.poppedOverride = null;
		else
			self.poppedOverride = appSet;
		
		return self.updatePopped();
	}
	
	// overrides
	
	ns.Selfie.prototype.updateStatsRate = function() {
		const self = this;
	}
	
	// pri<>t
	
	ns.Selfie.prototype.updatePopped = function() {
		const self = this;
		let popped = self.poppedUser;
		if ( null != self.poppedOverride )
			popped = self.poppedOverride;
		
		if ( self.isInList )
			popped = false;
		
		self.isPopped = popped;
		self.el.classList.toggle( 'popped', popped );
		self.menu.setState( 'popped', popped );
		return popped;
	}
	
	ns.Selfie.prototype.initSelf = function() {
		const self = this;
		self.audioBtn.addEventListener( 'click', audioClick, false );
		self.videoBtn.addEventListener( 'click', videoClick, false );
		
		function audioClick( e ) {
			self.handleAudioClick();
		}
		function videoClick( e ) {
			self.handleVideoClick();
		}
	}
	
	ns.Selfie.prototype.handleAudioClick = function() {
		const self = this;
		self.peer.toggleMute();
	}
	
	ns.Selfie.prototype.handleVideoClick = function() {
		const self = this;
		if ( self.hasVideo )
			self.peer.toggleBlind();
		else
			self.peer.toggleVideo();
	}
	
	ns.Selfie.prototype.setupMenu = function() {
		const self = this;
		//self.muteId = 'mute';
		//self.blindId = 'blind';
	}
	
	ns.Selfie.prototype.buildView = function() {
		const self = this;
		const avatarUrl = window.encodeURI( self.peer.avatar );
		const tmplConf = {
			name   : self.peer.name,
			avatar : avatarUrl || '',
		};
		self.el = hello.template.getElement( 'selfie-tmpl', tmplConf );
		self.connecting.appendChild( self.el );
	}
	
	ns.Selfie.prototype.bindUI = function() {
		const self = this;
		// poppedui
		self.poppedMuteBtn = document.getElementById( 'popped-mute-self' );
		self.unpopBtn = document.getElementById( 'popped-unpop' );
		
		self.poppedMuteBtn.addEventListener( 'click', audioBtnClick, false );
		self.unpopBtn.addEventListener( 'click', unpopClick, false );
		function unpopClick( e ) {
			self.peer.emit( 'popped', !self.poppedUser );
		}
		
		// ui
		//self.audioBtn = document.getElementById( 'mute-self' );
		self.nameBar = self.ui.querySelector( '.ui-buttons .name-bar' );
		
		//self.audioBtn.addEventListener( 'click', audioBtnClick, false );
		function audioBtnClick( e ) { self.peer.toggleMute(); }
		
		// options
		function dragClick( e ) { self.enableDragMode(); }
		function cleanUIClick( e ) {
			self.hideOptions();
			self.onclean();
		}
		
		//things
		self.queueContainer = document.getElementById( 'queue-container' );
		
		// 
		self.elementMap[ 'queue' ] = self.queueContainer;
	}
	
	ns.Selfie.prototype.bindPeer = function() {
		const self = this;
		self.peer.on( 'selfie', handleSelfie );
		self.peer.on( 'queue', handleQueue );
		self.peer.on( 'error', showError );
		self.peer.on( 'volume-source', volumeSrc );
		
		function handleSelfie( e ) { self.handleSelfie( e ); }
		function handleQueue( e ) { self.handleQueue( e ); }
		function showError( e ) { self.showError( e ); }
		function volumeSrc( e ) { self.handleVolumeSrc( e ); }
	}
	
	ns.Selfie.prototype.handleSelfie = function( media ) {
		const self = this;
		self.toggleAVGraph();
		self.handleMedia( media );
		if ( !self.stream )
			return;
		
		self.updateVideoMirror();
		self.stream.muted = true;
	}
	
	ns.Selfie.prototype.updateVideoMirror = function() {
		const self = this;
		if ( !self.stream )
			return;
		
		self.stream.classList.toggle( 'video-mirror', !self.screenShare );
	}
	
	ns.Selfie.prototype.toggleAVGraph = function() {
		const self = this;
		if ( self.isPopped || self.isInList )
			self.hideAVGraph();
		else
			self.showAVGraph();
	}
	
	ns.Selfie.prototype.showAVGraph = function() {
		const self = this;
		setTimeout( hepp, 100 );
		function hepp() {
			if ( self.AVGraph )
				self.AVGraph.start();
			else
				self.AVGraph = new library.view.AudioVisualizer(
					self.peer.volume,
					hello.template,
					'selfie-volume'
				);
		}
	}
	
	ns.Selfie.prototype.hideAVGraph = function() {
		const self = this;
		if ( !self.AVGraph )
			return;
		
		self.AVGraph.close();
		delete self.AVGraph;
	}
	
	ns.Selfie.prototype.resetState = function() {
		const self = this;
		var isMuted = false;
		var isBlinded = false;
		self.toggleMuteState( isMuted );
		self.toggleBlindState( isBlinded );
	}
	
	ns.Selfie.prototype.updateButtonVisibility = function() {
		const self = this;
		if ( self.isAudio )
			self.menu.enable( 'mute' );
		else
			self.menu.disable( 'mute' );
		
		if ( self.hasVideo ) {
			self.menu.enable( 'blind' );
			self.menu.enable( 'screen-mode' );
		}
		else {
			self.menu.disable( 'blind' );
			self.menu.disable( 'screen-mode' );
		}
	}
	
	ns.Selfie.prototype.handleQueue = function( position ) {
		const self = this;
		if ( !position ) {
			self.hideQueue();
			return;
		}
		
		if ( self.queue ) {
			self.queue.update( position );
			return;
		}
		
		self.queue = new library.view.Queue( 'queue-container', position );
		self.showQueue();
	}
	
	ns.Selfie.prototype.showQueue = function() {
		const self = this;
		self.showTheThing( 'queue' );
	}
	
	ns.Selfie.prototype.hideQueue = function() {
		const self = this;
		self.hideTheThing( 'queue' );
	}
	
	ns.Selfie.prototype.handleVolumeSrc = function( volumeSrc ) {
		const self = this;
		if ( !self.AVGraph )
			return;
		
		self.AVGraph.setSource( volumeSrc );
	}
	
	ns.Selfie.prototype.handleScreenShare = function( isActive ) {
		const self = this;
		self.screenShare = isActive;
		self.updateQualityLevel();
		self.updateVideoMirror();
		self.doResize();
		if ( !self.screenshareBtn )
			return;
		
		self.screenshareBtn.classList.toggle( 'available', isActive );
	}
	
	ns.Selfie.prototype.handleSelfMute = function( isMuted ) {
		const self = this;
		//self.menu.setState( 'mute', isMuted );
		self.audioBtn.classList.toggle( 'inverted', isMuted );
		self.audioBtn.classList.toggle( 'danger', isMuted );
		self.poppedMuteBtn.classList.toggle( 'danger', isMuted );
		self.toggleMuteState( isMuted );
	}
	
	ns.Selfie.prototype.handleSelfBlind = function( isBlinded ) {
		const self = this;
		//self.menu.setState( 'blind', isBlinded );
		self.videoBtn.classList.toggle( 'inverted', isBlinded );
		self.videoBtn.classList.toggle( 'danger', isBlinded );
		//const active = self.videoBtn.querySelector( '.camera-on' );
		//const blind = self.videoBtn.querySelector( '.camera-off' );
		//active.classList.toggle( 'hidden', isBlinded );
		//blind.classList.toggle( 'hidden', !isBlinded );
		self.localBlind = isBlinded;
		self.toggleBlindState( isBlinded );
		self.toggleStream();
	}
	
	ns.Selfie.prototype.peerClose = ns.Selfie.prototype.close;
	ns.Selfie.prototype.close = function() {
		const self = this;
		if ( self.audioBtn )
			self.audioBtn.cloneNode( true );
		
		if ( self.videoBtn )
			self.videoBtn.closeNode( true );
		
		delete self.audioBtn;
		delete self.videoBtn;
		delete self.screenshareBtn;
		delete self.onclean;
		
		self.peerClose();
	}
	
})( library.view );


// Queue
(function( ns, undefined ) {
	ns.Queue = function( containerId, position ) {
		if ( !( this instanceof ns.Queue ))
			return new ns.Queue( containerId, position );
		
		const self = this;
		self.containerId = containerId;
		self.position = position || null;
		
		self.stream = null;
		
		self.init();
	}
	
	ns.Queue.prototype.update = function( pos ) {
		const self = this;
		self.setPosition( pos );
	}
	
	ns.Queue.prototype.init = function() {
		const self = this;
		var element = document.getElementById( self.containerId );
		self.positionElement = element.querySelector( '.queue-position' );
		if ( self.position )
			self.setPosition( self.position );
	}
	
	ns.Queue.prototype.setPosition = function( pos ) {
		const self = this;
		self.position = pos;
		self.positionElement.innerText = pos;
	}
	
})( library.view );


// RTCState
(function( ns, undefined ) {
	ns.RTCState = function( conf ) {
		if ( !( this instanceof ns.RTCState ))
			return new ns.RTCState( conf );
		
		const self = this;
		self.parentId = conf.peerId;
		
		self.currentSpinner = 'waiting';
		self.spinMap = {};
		
		self.init();
	}
	
	// PUBLIC
	
	ns.RTCState.prototype.update = function( event ) {
		const self = this;
		const handler = self.typeMap[ event.type ];
		if ( !handler ) {
			console.log( 'unknown event type', event );
			return;
		}
		
		handler( event.data );
	}
	
	ns.RTCState.prototype.show = function() {
		const self = this;
		self.keepOpen = true;
		self.toggle( true );
	}
	
	ns.RTCState.prototype.hide = function() {
		const self = this;
		self.keepOpen = false;
		self.toggle( false );
	}
	
	ns.RTCState.prototype.setEnabled = function( isEnabled ) {
		const self = this;
		if ( self.enable === isEnabled )
			return;
		
		self.enable = !!isEnabled;
		self.toggle();
	}
	
	// PRIVATE
	
	ns.RTCState.prototype.toggle = function( show ) {
		const self = this;
		if ( self.keepOpen )
			show = true;
		
		if ( !self.enable )
			show = false;
		
		self.main.classList.toggle( 'hidden', !show );
	}
	
	ns.RTCState.prototype.init = function() {
		const self = this;
		self.typeMap = {
			rtc    : handleRTC,
			stream : handleStream,
			error  : handleError,
			stats  : handleStats,
		};
		
		function handleRTC( e ) { self.handleRTCState( e ); }
		function handleStream( e ) { self.handleStreamState( e ); }
		function handleError( e ) { self.handleError( e ); }
		function handleStats( e ) { self.handleStats( e ); }
		
		try {
			self.bind();
		} catch( ex ) {
			console.log( 'bind ex', ex );
		}
		
		const rtcPingBar = self.mainState
			.querySelector( '.main-rtc-state'
				+ ' .state-latency'
				+ ' .state-value' );
		
		self.rtcPing = new library.component.PingBar( rtcPingBar );
	}
	
	ns.RTCState.prototype.build = function() {
		const self = this;
	}
	
	ns.RTCState.prototype.bind = function() {
		const self = this;
		var peer = document.getElementById( self.parentId );
		self.main = peer.querySelector( '.stream-container .main-rtc' );
		self.mini = peer.querySelector( '.grid-ui .mini-rtc' );
		//self.thumb = peer.querySelector( '.thumb-ui .mini-rtc' );
		
		self.mainState = self.main.querySelector( '.main-rtc-status' );
		//self.miniState = self.mini.querySelector( '.mini-rtc-state' );
		const rtcState = self.mainState.querySelector( '.main-rtc-state' );
		self.rtcState = rtcState.querySelector( '.state-primary .state-value' );
		self.rtcRouting = rtcState.querySelector( '.state-routing .state-value' );
		self.rtcReceiving = rtcState.querySelector( '.state-receiving .state-value' );
		self.rtcReceived = rtcState.querySelector( '.state-received-total .state-value' );
		self.rtcBandwidth = rtcState.querySelector( '.state-max-bandwith .state-value' );
		
		const streamState = self.mainState.querySelector( '.main-stream-state' );
		self.streamState = streamState.querySelector( '.state-primary .state-value' );
		self.audio = streamState.querySelector( '.state-audio' );
		self.audioTrack = self.audio.querySelector( '.state-audio-track .state-value' );
		self.audioCodec = self.audio.querySelector( '.state-audio-codec .state-value' );
		self.audioInput = self.audio.querySelector( '.state-audio-input .state-value' );
		self.audioLost = self.audio.querySelector( '.state-audio-lost .state-value' );
		
		self.video = streamState.querySelector( '.state-video' );
		self.videoTrack = self.video.querySelector( '.state-video-track .state-value' );
		self.videoCodec = self.video.querySelector( '.state-video-codec .state-value' );
		self.videoSize = self.video.querySelector( '.state-video-size .state-value' );
		self.videoLost = self.video.querySelector( '.state-video-lost .state-value' );
		
		self.stateError = self.mainState
			.querySelector( '.main-state-error .state-value' );
		
		self.mini.addEventListener( 'mouseenter', showMain, false );
		self.mini.addEventListener( 'mouseleave', hideMain, false );
		self.mini.addEventListener( 'click', toggleMain, false );
		
		bindSpinners( self.main, '.main-rtc-spinner', 'mainTypeToSpinner' );
		bindSpinners( self.mini, '.mini-rtc-spinner', 'miniTypeToSpinner' );
		function bindSpinners( parent, sourceClass, mapName ) {
			var source = parent.querySelector( sourceClass );
			var green = source.querySelector( '.super-green' );
			var spin = source.querySelector( '.spinning' );
			var err = source.querySelector( '.error' );
			
			self[ mapName ] = {
				'nominal' : green,
				'waiting' : spin,
				'error'   : err,
			};
		}
		
		function showMain( e ) { self.toggle( true ); }
		function hideMain( e ) { self.toggle( false ); }
		function toggleMain( e ) { 
			self.keepOpen = !self.keepOpen
			if ( !self.keepOpen )
				self.main.classList.toggle( 'hidden', true );
		}
	}
	
	ns.RTCState.prototype.setSpinner = function( type, level ) {
		const self = this;
		const prev = self.currentSpinner;
		level = self.getLevel( level );
		self.spinMap[ type ] = level;
		level = getMaxLevel();
		
		if ( prev === level )
			return;
		
		hideOld( prev );
		showNew( level );
		
		self.currentSpinner = level;
		
		function hideOld( level ) { toggle( level, false ); }
		function showNew( level ) { toggle( level, true ); }
		function toggle( level, show ) {
			var main = self.mainTypeToSpinner[ level ];
			var mini = self.miniTypeToSpinner[ level ];
			if ( main )
				main.classList.toggle( 'hidden', !show );
			if ( mini )
				mini.classList.toggle( 'hidden', !show );
		}
		
		function getMaxLevel() {
			var types = Object.keys( self.spinMap );
			var error = types.some( isError );
			if ( error )
				return 'error';
			
			var waiting = types.some( isWaiting );
			if ( waiting )
				return 'waiting';
			
			return 'nominal';
			
			function isWaiting( type ) { return 'waiting' === getLevel( type ); }
			function isError( type ) { return 'error' === getLevel( type ); }
			function getLevel( type ) { return self.spinMap[ type ]; }
		}
	}
	
	ns.RTCState.prototype.handleRTCState = function( event ) {
		const self = this;
		/*
		if ( 'ping' === event.type ) {
			self.rtcPing.set( event.data );
			return;
		}
		*/
		
		if ( 'routing' === event.type ) {
			self.rtcRouting.textContent = event.data.data;
			return;
		}
		
		self.rtcState.textContent = event.data.state;
		self.setSpinner( 'rtc', event.type );
		
	}
	
	ns.RTCState.prototype.handleStats = function( data ) {
		const self = this;
		const trans = data.transport;
		if ( trans.receiveRate ) {
			const KBs = Math.round( trans.receiveRate / 1024 );
			self.rtcReceiving.textContent =  KBs + ' KB/s';
		}
		
		if ( trans.bytesReceived ) {
			const total = ( trans.bytesReceived / 1024 / 1024 ).toFixed( 1 );
			self.rtcReceived.textContent =  total + ' MB';
		}
		
		if ( null != trans.ping ) {
			if ( self.rtcPing )
				self.rtcPing.set( trans.ping );
		}
		
		if ( trans.pair ) {
			const bandWidth = trans.pair.availableOutgoingBitrate || 0;
			const maxKBit = ( bandWidth / 8 / 1024 ).toFixed( 1 );
			self.rtcBandwidth.textContent = maxKBit + ' KBytes';
		}
		
		const inn = data.inbound;
		if ( !inn )
			return;
		
		const audio = inn.audio;
		const video = inn.video;
		if ( audio )
			setAudio( audio );
		
		if ( video )
			setVideo( video );
		
		function setAudio( a ) {
			const codec = a.codec;
			if ( null != codec )
				self.audioCodec.textContent = codec.mimeType.split( '/' )[ 1 ];
			
			const t = a.track;
			if ( null != t ) {
				const volume = ( t.energyRate * 1.0 )
					.toFixed( 3 );
				
				self.audioInput.textContent = volume;
			}
			
			const pLoss = a.packetLoss || 0;
			self.audioLost.textContent = pLoss;
		}
		
		function setVideo( v ) {
			const codec = v.codec;
			if ( null != codec )
				self.videoCodec.textContent = codec.mimeType.split( '/' )[ 1 ];
			
			const t = v.track;
			if ( null != t ) {
				const h = t.frameHeight;
				const w = t.frameWidth;
				self.videoSize.textContent = w + 'x' + h;
			}
			
			const pLoss = v.packetLoss || 0;
			self.videoLost.textContent = pLoss;
		}
	}
	
	ns.RTCState.prototype.handleStreamState = function( data ) {
		const self = this;
		if ( data.tracks )
			setAudioVideo( data.tracks );
		
		if ( data.constraints )
			updateConstraints( data.constraints );
		
		self.streamState.textContent = data.type;
		const spinLevel = self.getLevel( data.type );
		self.setSpinner( 'stream', spinLevel );
		
		function setAudioVideo( tracks ) {
			if ( tracks.audio )
				self.audioTrack.textContent = tracks.audio.toString();
			if ( tracks.video )
				self.videoTrack.textContent = tracks.video.toString();
		}
		
		function updateConstraints( data ) {
			if ( !data.audio )
				self.audioTrack.textContent = View.i18n('i18n_not_available');
			
			if ( !data.video )
				self.videoTrack.textContent = View.i18n('i18n_not_available');
		}
	}
	
	ns.RTCState.prototype.setError = function( data ) {
		const self = this;
		self.mainState.textContent = View.i18n('i18n_connection') + ': ' + data.type;
	}
	
	ns.RTCState.prototype.getLevel = function( value ) {
		const self = this;
		if (( 'nominal' !== value ) && ( 'error' !== value ) && ( 'closed' !== value ))
			return 'waiting';
			
		return value;
	}
	
})( library.view );


// PingBar
(function( ns, undefined ) {
	ns.PingBar = function( containerElement ) {
		if ( !( this instanceof ns.PingBar ))
			return new ns.PingBar( containerElement );
		
		const self = this;
		self.container = containerElement;
		self.id = friendUP.tool.uid( 'ping-bar' );
		self.barStep = 50;
		self.showBars = false;
		
		self.init();
	}
	
	// PUBLIC
	
	ns.PingBar.prototype.set = function( pingTime ) {
		const self = this;
		if ( null == pingTime ) {
			if ( self.showBars )
				self.toggleBar( false );
			
			self.showTimeout();
		}
		else {
			if ( !self.showBars )
				self.toggleBar( true )
			
			self.setBars( pingTime );
		}
	}
	
	ns.PingBar.prototype.close = function() {
		const self = this;
		var el = document.getElementById( self.Id );
		el.parentNode.removeChild( el );
		delete self.id;
		delete self.container;
	}
	
	// PRIVATE
	
	ns.PingBar.prototype.init = function() {
		const self = this;
		if ( !hello.template )
			throw new Error( 'PingBar.init - template manager not found' );
		
		self.build();
		
		// bind
		var el = document.getElementById( self.id );
		self.bumpsParent = el.querySelector( '.ping-bumps' );
		self.bumps = self.bumpsParent.querySelectorAll( '.ping-bump' );
		
		self.infoParent = el.querySelector( '.ping-bar-info' );
		self.waiting = self.infoParent.querySelector( '.waiting' );
		self.timeout = self.infoParent.querySelector( '.timeout' );
	}
	
	ns.PingBar.prototype.build = function() {
		const self = this;
		var conf = {
			id : self.id,
		};
		var element = hello.template.getElement( 'ping-bar-tmpl', conf );
		self.container.appendChild( element );
	}
	
	ns.PingBar.prototype.setBars = function( pingTime ) {
		const self = this;
		const barNum = self.calcBarNum( pingTime );
		Array.prototype.forEach.call( self.bumps, show );
		function show( el, index ) {
			if ( index < ( barNum ))
				toggle( el, true );
			else
				toggle( el, false );
			
			function toggle( element, show ) {
				element.classList.toggle( 'hide-bump', !show );
			}
		}
	}
	
	ns.PingBar.prototype.calcBarNum = function( pingTime ) {
		const self = this;
		var step = self.barStep;
		var bars = 1;
		while ( pingTime > step ) {
			++bars;
			step = step * 2;
			if ( bars > 5)
				break;
		}
		
		return bars;
	}
	
	ns.PingBar.prototype.showTimeout = function() {
		const self = this;
		self.waiting.classList.toggle( 'hidden', true );
		self.timeout.classList.toggle( 'hidden', false );
	}
	
	ns.PingBar.prototype.toggleBar = function( show ) {
		const self = this;
		self.showBars = show;
		self.bumpsParent.classList.toggle( 'hidden', !show );
		self.infoParent.classList.toggle( 'hidden', show );
	}
	
})( library.component );


// NESTED APP
(function( ns, undefined ) {
	ns.NestedApp = function( conf ) {
		if ( !( this instanceof ns.NestedApp ))
			return new ns.NestedApp( conf );
		
		const self = this;
		self.id = conf.id;
		self.containerId = conf.containerId;
		self.app = conf.app;
		self.sendMessage = conf.sendMessage;
		self.onclose = conf.onclose;
		
		self.init();
	}
	
	ns.NestedApp.prototype.receiveMessage = function() {
		const self = this;
	}
	
	ns.NestedApp.prototype.init = function() {
		const self = this;
		self.build();
		self.bind();
		self.initApp();
	}
	
	ns.NestedApp.prototype.build = function() {
		const self = this;
		var tmplConf = {
			id : self.id,
		};
		const element = hello.template.getElement( 'nested-app-tmpl', tmplConf );
		element.classList.add( 'peer' );
		var container = document.getElementById( self.containerId );
		container.appendChild( element );
	}
	
	ns.NestedApp.prototype.bind = function() {
		const self = this;
		var element = document.getElementById( self.id );
		var closeBtn = element.querySelector( '.nested-close' );
		closeBtn.addEventListener( 'click', closeApp, false );
		function closeApp( e ) {
			self.close();
		}
	}
	
	ns.NestedApp.prototype.initApp = function() {
		const self = this;
		var element = document.getElementById( self.id );
		var iframe = element.querySelector( 'iframe' );
		var src = '/webclient/app.html?app=' 
			+ self.app.Filename 
			+ '&theme=borderless';
			
		iframe.src = src;
	}
	
	ns.NestedApp.prototype.close = function() {
		const self = this;
		var element = document.getElementById( self.id );
		element.parentNode.removeChild( element );
		
		var onclose = self.onclose;
		delete self.onclose;
		onclose();
	}
	
})( library.component );


// DRAGGER
(function( ns, undefined ) {
	ns.Dragger = function( conf ) {
		if ( !( this instanceof ns.Dragger ))
			return new ns.Dragger( conf );
		const self = this;
		
		self.draggable = {};
		self.dragOrder = [];
		
		self.init();
	}
	
	ns.Dragger.prototype.add = function( ) {
		const self = this;
	}
	
	ns.Dragger.prototype.init = function() {
		const self = this;
	}
	
})( library.component );

