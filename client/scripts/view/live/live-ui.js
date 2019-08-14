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
		self.localSettings = localSettings;
		self.guestAvatar = liveConf.guestAvatar;
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
		
		self.currentSpeaker = null;
		self.uiVisible = false;
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
	
	// Private
	
	ns.UI.prototype.init = function() {
		var self = this;
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
		
		self.bindEvents();
		self.uiVisible = true;
		self.toggleUI();
	}
	
	ns.UI.prototype.addUIPane = function( id, conf ) {
		const self = this;
		const Pane = self.uiPaneMap[ id ];
		if ( !Pane ) {
			console.log( 'no ui pane for id', { id : id, map : self.uiPaneMap });
			throw new Error( 'no ui pane found for id: ' + id );
			return;
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
		self.waiting = document.getElementById( 'waiting-for-container' );
		self.waitingFritz = document.getElementById( 'waiting-for-peers-fritz' );
		self.waitingDots = document.getElementById( 'waiting-for-peers-dots' );
		self.ui = document.getElementById( 'live-ui' );
		self.menuBtn = document.getElementById( 'show-menu-btn' );
		self.screenShareBtn = document.getElementById( 'share-screen-btn');
		self.audioBtn = document.getElementById( 'audio-toggle-btn' );
		self.hangupBtn = document.getElementById( 'hangup-btn' );
		self.videoBtn = document.getElementById( 'video-toggle-btn' );
		self.settingsBtn = document.getElementById( 'settings-btn' );
		self.teaseChat = document.getElementById( 'tease-chat-container' );
		
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
		var self = this;
		var pane = self.uiPanes[ id ];
		if ( !pane ) {
			console.log( 'getUIPane - no pane found for id', id );
			return null;
		}
		
		return pane;
	}
	
	ns.UI.prototype.hideUIPane = function( id ) {
		var self = this;
		var pane = self.getPane( id );
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
		var self = this;
		if ( self.resizeWait ) {
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
		var self = this;
		if ( self.nestedApp )
			self.nestedApp.close();
		
		var appId = friendUP.tool.uid( 'nested-app' );
		var conf = {
			id : appId,
			containerId : self.peerGridId,
			app : appData,
			onclose : onclose,
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
		var self = this;
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
		
		peer.on( 'video', updateHasVideo );
		
		// add to ui
		self.peers[ pid ] = viewPeer;
		self.peerIds.push( pid );
		if ( self.isVoiceOnly )
			addToVoiceList( viewPeer );
		else
			addToGrid( viewPeer );
		
		self.updateMenu();
		self.updateVoiceListMode();
		
		// start session duration on selfie when the first peer is added
		if ( self.peerGridOrder.length === 2 )
			self.peers[ 'selfie' ].startDurationTimer();
		
		function addToVoiceList( peer ) {
			peer.setIsInList( true );
			self.audioList.add( peer.el );
		}
		
		function addToGrid( peer ) {
			self.gridContainer.appendChild( viewPeer.el );
			viewPeer.el.classList.toggle( 'in-grid', true );
			self.peerGridOrder.push( viewPeer.id );
			self.updateGridClass();
		}
		
		// show/hide waiting splash
		self.updateWaiting();
		
		function onDrag( type ) {
			self.onDrag( type, peer.id );
		}
		
		function onClick( show ) {
			self.onPeerClickCatch( show, peer.id );
		}
		
		function handleRoomQuality( e ) {
			self.updateQualityLevel( e );
		}
		
		function togglePopped( e ) {
			self.togglePopped();
		}
		
		function voiceOnly( e ) {
			self.handleVoiceOnly( e );
		}
		
		function updateHasVideo( hasVideo ) {
			self.updateHasVideo( peer.id, hasVideo );
		}
		
		function onMenuClick( e ) {
			self.menu.show( viewPeer.menuId );
			self.menuUI.show();
		}
	}
	
	ns.UI.prototype.removePeer = function( peerId ) {
		var self = this;
		var peer = self.peers[ peerId ];
		if ( !peer ) {
			console.log( 'live - no peer found for ', peerId );
			return;
		}
		
		let model = peer.peer;
		model.release( 'video' );
		if ( 'selfie' === peerId ) {
			model.release( 'room-quality' );
			model.release( 'popped' );
		}
		
		peer.close();
		delete self.peers[ peerId ];
		self.peerIds = Object.keys( self.peers );
		let pidx = self.peerGridOrder.indexOf( peerId );
		if ( -1 === pidx )
			self.audioList.remove( peerId );
		else
			self.peerGridOrder.splice( pidx, 1 );
		
		if ( self.modeSpeaker && self.currentSpeaker === peerId )
			self.setSpeaker();
		
		if ( self.peerGridOrder.length === 1 ) {
			self.peers[ 'selfie' ].stopDurationTimer();
		}
		
		self.updateVoiceListMode();
		self.updateGridClass();
		self.updateWaiting();
		self.updateMenu();
	}
	
	ns.UI.prototype.executePeerAddQueue = function() {
		var self = this;
		if ( !self.peerAddQueue.length || self.isReordering )
			return;
		
		self.peerAddQueue.forEach( add );
		function add( peer ) {
			self.addPeer( peer );
		}
	}
	
	ns.UI.prototype.updateWaiting = function() {
		const self = this;
		const pids = Object.keys( self.peers );
		const hideWaiting = pids.length > 1;
		const onlyVoice = self.isVoiceOnly;
		self.waiting.classList.toggle( 'hidden', hideWaiting );
		self.waiting.classList.toggle( 'expand', !onlyVoice );
		self.waiting.classList.toggle( 'fortify', onlyVoice );
		self.waitingFritz.classList.toggle( 'hidden', onlyVoice );
		self.waitingDots.classList.toggle( 'hidden', !onlyVoice );
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
		
		self.currentGridKlass = self.currentGridKlass || 'grid1';
		container.classList.remove( self.currentGridKlass );
		const peerNum = getPeerNum();
		let newGridKlass = 'grid1';
		if ( self.modeSpeaker && self.currentSpeaker )
			newGridKlass = 'grid1';
		else {
			newGridKlass = getGridKlass( peerNum );
		}
		
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
			var numberOfPeers = self.peerGridOrder.length;
			var peerNum = numberOfPeers;
			
			if ( self.nestedApp )
				peerNum += 1;
			
			
			if ( !selfie.isInList && selfie.isPopped )
				peerNum -= 1;
			
			return peerNum;
		}
	}
	
	ns.UI.prototype.reflowPeers = function() {
		var self = this;
		self.peerGridOrder.forEach( callReflow );
		function callReflow( peerId ) {
			var peer = self.peers[ peerId ];
			if ( !peer )
				return;
			
			peer.reflow();
		}
	}
	
	ns.UI.prototype.handleQueue = function( msg ) {
		const self = this;
		if ( !self.queue )
			return;
		
		self.queue.handle( msg );
	}
	
	ns.UI.prototype.handleVoiceOnly = function( isVoiceOnly ) {
		const self = this;
		self.isVoiceOnly = isVoiceOnly;
		self.updateWaiting();
		self.videoBtn.classList.toggle( 'inverted', isVoiceOnly );
		self.gridContainer.classList.toggle( 'hidden', isVoiceOnly );
		self.listContainer.classList.toggle( 'expand', isVoiceOnly );
		self.listContainer.classList.toggle( 'fortify', !isVoiceOnly );
		self.audioList.show( isVoiceOnly );
		
		self.updateVoiceListMode();
	}
	
	ns.UI.prototype.updateVoiceListMode = function() {
		const self = this;
		const ids = Object.keys( self.peers );
		if ( !ids.length )
			return;
		
		if ( self.isVoiceOnly && hasMaxTwoPeers( ids ) && hasNoVideoPeers() )
			setToItems( ids );
		else
			setToRows( ids );
		
		self.audioListEl.classList.toggle( 'large-items', self.isVoiceListLarge );
		updatePeers( ids );
		
		function setToItems( ids ) { self.isVoiceListLarge = true; }
		function setToRows( ids ) { self.isVoiceListLarge = false; }
		
		function updatePeers( ids ) {
			ids.forEach( toggleLarge );
			function toggleLarge( pid ) {
				let peer = self.peers[ pid ];
				peer.setVoiceListMode( self.isVoiceListLarge );
			}
		}
		
		function hasMaxTwoPeers( ids ) {
			if ( 2 >= ids.length )
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
		const peer = self.peers[ peerId ];
		if ( !peer ) {
			console.log( 'updateHasVideo - no peer for', peerId );
			return;
		}
		
		if ( hasVideo )
			moveToPeers( peer );
		else
			moveToAudioList( peer );
		
		function moveToPeers( peer ) {
			let pid = peer.id;
			if ( isInVideo( pid ))
				return;
			
			self.audioList.remove( pid );
			self.peerGridOrder.push( pid );
			peer.setIsInList( false );
			self.gridContainer.appendChild( peer.el );
			if ( 'selfie' === peer.id )
				self.updateSelfieState();
			
			self.updateGridClass();
		}
		
		function moveToAudioList( peer ) {
			let pid = peer.id;
			if ( isInAudio( pid ))
				return;
			
			peer.setIsInList( true );
			if ( 'selfie' === peer.id )
				self.updateSelfieState();
			
			let pidx = self.peerGridOrder.indexOf( peer.id );
			self.peerGridOrder.splice( pidx, 1 );
			self.audioList.add( peer.el );
			self.updateGridClass();
			
			function isInAudio( pid ) {
				return !isInVideo( pid );
			}
		}
		
		function isInVideo( pid ) {
			return self.peerGridOrder.some( poId => poId === pid );
		}
	}
	
	ns.UI.prototype.onDrag = function( type, peerId ) {
		var self = this;
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
		var self = this;
		var sourceIndex = self.peerGridOrder.indexOf( sourceId );
		self.isReordering = true;
		self.reorder.sourceIndex = sourceIndex;
		
	}
	
	ns.UI.prototype.reorderDrop = function( targetId ) {
		var self = this;
		var targetIndex = self.peerGridOrder.indexOf( targetId );
		self.reorder.targetIndex = targetIndex;
		self.doReorder();
	}
	
	ns.UI.prototype.doReorder = function() {
		var self = this;
		var sIndex = self.reorder.sourceIndex;
		var sId = self.peerGridOrder[ sIndex ];
		var tIndex = self.reorder.targetIndex;
		var tId = self.peerGridOrder[ tIndex ];
		self.peerGridOrder[ sIndex ] = tId;
		self.peerGridOrder[ tIndex ] = sId;
		self.applyPeerOrder();
	}
	
	ns.UI.prototype.applyPeerOrder = function( peerOrder ) {
		var self = this;
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
		var self = this;
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
	
	ns.UI.prototype.toggleUIMode = function() {
		var self = this;
		self.uiVisible = !self.uiVisible;
		self.toggleUI();
		
		self.peerGridOrder.forEach( updateUI );
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
					id     : 'q-default',
					name   : View.i18n( 'i18n_unconstrained' ),
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
		const mute = {
			type   : 'item',
			id     : 'mute',
			name   : View.i18n('i18n_mute_your_audio'),
			faIcon : 'fa-microphone-slash',
			toggle : false,
			close  : false,
		};
		const blind = {
			type   : 'item',
			id     : 'blind',
			name   : View.i18n('i18n_pause_your_video'),
			faIcon : 'fa-eye-slash',
			toggle : false,
			close  : false,
		};
		const screenShare = {
			type   : 'item',
			id     : 'toggle-screen-share',
			name   : View.i18n( 'i18n_toggle_share_screen' ),
			faIcon : 'fa-laptop',
			toggle : false,
			close  : true,
		};
		const source = {
			type   : 'item',
			id     : 'source-select',
			name   : View.i18n( 'i18n_select_media_sources' ),
			faIcon : 'fa-random',
		};
		const chat = {
			type   : 'item',
			id     : 'chat',
			name   : View.i18n( 'i18n_text_chat' ),
			faIcon : 'fa-keyboard-o',
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
			toggle : true,
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
		const settings = {
			type    : 'item',
			id      : 'settings',
			name    : View.i18n( 'i18n_room_settings' ),
			faIcon  : 'fa-ellipsis-v',
			disable : true,
		};
		const share = {
			type   : 'item',
			id     : 'share',
			name   : View.i18n( 'i18n_share' ),
			faIcon : 'fa-share-alt',
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
			share,
			chat,
			blind,
			mute,
			quality,
			restart,
			fullscreen,
			//screenShare,
			presentation,
			source,
			popped,
			speaker,
			sendReceive,
			screenMode,
			settings,
			dragger,
			username,
			cleanUI,
			peers,
			leave,
		];
		
		var conf = {
			menuConf : {
				content      : content,
				onnolistener : noListenerFor,
			},
		};
		self.menuUI = self.addUIPane( 'menu', conf );
		self.menu = self.menuUI.getMenu();
		self.menu.on( 'share', shareHandler );
		self.menu.on( 'chat', chatHandler );
		self.menu.on( 'clean-ui', cleanUIHandler );
		self.menu.on( 'dragger', reorderHandler );
		self.menu.on( 'popped', togglePopped );
		self.menu.on( 'mode-speaker', modeSpeaker );
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
		
		function chatHandler( state ) {
			if ( !self.chatUI )
				return;
			
			self.chatUI.toggle();
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
	
	ns.UI.prototype.togglePopped = function( force ) {
		const self = this;
		const selfie = self.peers[ 'selfie' ];
		if ( !selfie )
			return;
		
		selfie.togglePopped( force );
		self.updateSelfieState();
	}
	
	ns.UI.prototype.updateSelfieState = function() {
		const self = this;
		const selfie = self.peers[ 'selfie' ];
		if ( !selfie )
			return;
		
		if ( self.modeSpeaker && 'selfie' === self.currentSpeaker )
			selfie.updateDisplayState( true );
		else
			selfie.updateDisplayState();
		
		self.updateGridClass();
	}
	
	ns.UI.prototype.toggleModeSpeaker = function() {
		const self = this;
		self.modeSpeaker = !self.modeSpeaker;
		if ( self.modeSpeaker )
			enable();
		else
			disable();
		
		self.updateModeSpeaker();
		return self.modeSpeaker;
		
		function enable() {
			self.clearDragger();
			self.menu.disable( 'dragger' );
		}
		
		function disable() {
			self.menu.enable( 'dragger' );
		}
	}
	
	ns.UI.prototype.updateModeSpeaker = function() {
		const self = this;
		const container = document.getElementById( self.peerGridId );
		const modeSpeaker = ( !!self.modeSpeaker && !!self.currentSpeaker );
		const speaker = self.peers[ self.currentSpeaker ];
		if ( speaker && speaker.isInList )
			container.classList.toggle( 'mode-speaker', false );
		else
			container.classList.toggle( 'mode-speaker', modeSpeaker );
		
		self.updateSelfieState();
		if ( modeSpeaker )
			enable();
		else
			disable();
		
		function enable() {
			const peer = self.peers[ self.currentSpeaker ];
			if ( !peer )
				return;
			
			peer.reflow();
		}
		
		function disable() {
			self.reflowPeers();
		}
	}
	
	ns.UI.prototype.setSpeaker = function( speaker ) {
		const self = this;
		if ( !speaker || !speaker.isSpeaking )
			unset();
		else
			set( speaker );
		
		self.updateModeSpeaker();
		
		function unset() {
			if ( !self.currentSpeaker )
				return;
			
			const peer = self.peers[ self.currentSpeaker ];
			if ( !peer )
				return;
			
			self.currentSpeaker = false;
			peer.setIsSpeaking( false );
		}
		
		function set( speaker ) {
			unset();
			const peer = self.peers[ speaker.peerId ];
			if ( !peer )
				return;
			
			self.currentSpeaker = speaker.peerId;
			peer.setIsSpeaking( true );
		}
	}
	
	ns.UI.prototype.togglePresentation = function( presenterId ) {
		const self = this;
		if ( !presenterId )
			disable();
		else
			enable( presenterId );
		
		function disable() {
			self.togglePopped( true );
		}
		
		function enable( presenterId ) {
			let peer = self.peers[ presenterId ];
			if ( !peer )
				return;
			
			if ( 'selfie' === presenterId )
				self.togglePopped( false );
			
		}
	}
	
	ns.UI.prototype.addInitChecks = function( conf ) {
		const self = this;
		const id = 'init-checks';
		const Pane = self.uiPaneMap[ id ];
		const paneConf = {
			id       : id,
			parentId : 'init-cover',
			conf     : conf,
		};
		const pane = new Pane( paneConf );
		const pId = pane.id;
		pane.on( 'close', onClose );
		
		return pane;
		
		function onClose() {
			if ( self.cover ) {
				self.cover.parentNode.removeChild( self.cover );
				delete self.cover;
			}
		}
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
		}
		
		const conf = {
			conn        : conn,
			userId      : userId,
			identities  : identities,
			guestAvatar : self.guestAvatar,
			chatTease   : self.chatTease,
		};
		self.chatUI = self.addUIPane( 'chat', conf );
		self.chatUI.on( 'visible', onVisible );
		return self.chatUI;
		
		function onVisible( isVisible ) {
			self.chatTease.setActive( isVisible );
		}
	}
	
	ns.UI.prototype.addShare = function( conn ) {
		const self = this;
		const conf = {
			conn : conn,
		};
		self.shareUI = self.addUIPane( 'share', conf );
		return self.shareUI;
	}
	
	ns.UI.prototype.addSettings = function( conf ) {
		const self = this;
		if ( !self.settingsBtn ) {
			console.log( 'UI.addSettings - settingsBtn missing, abort' );
			return;
		}
		
		self.settingsBtn.addEventListener( 'click', settingsClick, false );
		self.settingsUI = self.addUIPane( 'source-select', conf );
		self.settingsUI.on( 'visible', onVisible );
		return self.settingsUI;
		
		function settingsClick( e ) {
			const isOpen = self.settingsUI.getOpen();
			if ( isOpen )
				self.settingsUI.hide();
			else
				self.emit( 'settings' ); 
		}
		
		function onVisible( isVisible ) {
			self.settingsBtn.classList.toggle( 'available', isVisible );
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
		var self = this;
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
		
		self.uiVisible = true;
		self.showStack = [];
		self.elementMap = {};
		
		self.init();
	}
	
	// Public
	
	ns.Peer.prototype.setIsInList = function( isInList ) {
		const self = this;
		self.isInList = isInList;
		self.el.classList.toggle( 'in-grid', !isInList );
		self.el.classList.toggle( 'in-list', isInList );
		self.clickCatch.classList.toggle( 'hidden', isInList );
	}
	
	ns.Peer.prototype.setVoiceListMode = function( isLarge ) {
		const self = this;
		self.isVoiceListLarge = isLarge;
		self.el.classList.toggle( 'list-large', self.isVoiceListLarge );
	}
	
	ns.Peer.prototype.setIsSpeaking = function( isSpeaker ) {
		const self = this;
		self.isSpeaker = isSpeaker;
		self.el.classList.toggle( 'speaker', isSpeaker );
		self.reflow();
	}
	
	ns.Peer.prototype.setAudioSink = function( deviceId ) {
		const self = this;
		self.audioSinkId = deviceId || '';
		self.updateAudioSink();
	}
	
	// Private
	
	ns.Peer.prototype.init = function() {
		var self = this;
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
				focus,
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
	
	ns.Peer.prototype.restart = function() {
		var self = this;
		if ( !self.stream ) {
			console.log( 'video not set', self.id );
			return;
		}
		
		self.stream.play();
	}
	
	ns.Peer.prototype.buildView = function() {
		const self = this;
		const avatarUrl =  window.encodeURI( self.peer.getAvatar());
		const conf = {
			peerId : self.id,
			name : self.peer.getName() || '',
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
		self.streamState = self.ui.querySelector( '.stream-state' );
		self.remoteMuteState = self.ui.querySelector( '.remote-mute' );
		self.remoteBlindState = self.ui.querySelector( 'remote-blind' );
		
		self.menuBtn.addEventListener( 'click', peerMenuClick, false );
		function peerMenuClick( e ) { self.showPeerActions(); }
		
		// closing
		self.closing = self.ui.querySelector( '.closing' );
		
		self.elementMap[ 'stream-state' ] = self.streamState;
	}
	
	ns.Peer.prototype.bindUICommon = function() {
		var self = this;
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
	
	ns.Peer.prototype.handleTouchEnd = function( e ) {
		var self = this;
		return;
		var selector =  e.path[ 0 ].className;
		var match = selector.match( /btn/ );
		if ( !match ) {
			selector = e.path[ 1 ].className;
			match = selector.match( /btn/ );
		}
		
		if ( !match )
			self.hideUI();
	}
	
	ns.Peer.prototype.checkIsShown = function( type ) {
		var self = this;
		var index = self.showStack.indexOf( type );
		return -1 !== index;
	}
	
	ns.Peer.prototype.showPeerActions = function() {
		const self = this;
		self.onmenu();
	}
	
	ns.Peer.prototype.toggleOptions = function() {
		var self = this;
		var isShown = self.checkIsShown( 'options' );
		if ( !isShown )
			self.showOptions();
		else
			self.hideOptions();
	}
	
	ns.Peer.prototype.showOptions = function() {
		var self = this;
		self.showTheThing( 'options' );
	}
	
	ns.Peer.prototype.hideOptions = function() {
		var self = this;
		self.hideTheThing( 'options' );
	}
	
	ns.Peer.prototype.showState = function() {
		var self = this;
		self.streamState.classList.toggle( 'hidden', false );
	}
	
	ns.Peer.prototype.hideState = function() {
		var self = this;
		self.streamState.classList.toggle( 'hidden', true );
	}
	
	ns.Peer.prototype.showTheThing = function( name ) {
		var self = this;
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
		var self = this;
		var index = self.showStack.indexOf( name );
		if ( index === -1 )
			return false;
		
		var hideElement = self.elementMap[ name ];
		self.toggleElement( hideElement, false );
		self.showStack.splice( index, 1 );
		self.showTheThings();
	}
	
	ns.Peer.prototype.showTheThings = function() {
		var self = this;
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
		var self = this;
		var top = self.showStack[ self.showStack.length -1 ];
		var topElement = self.elementMap[ top ];
		if ( !topElement )
			return;
		
		self.toggleElement( topElement, false );
	}
	
	
	ns.Peer.prototype.handleWheelEvent = function( e ) {
		var self = this;
		return;
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
	}
	
	ns.Peer.prototype.muteClick = function() {
		var self = this;
		self.peer.toggleMute();
	}
	
	ns.Peer.prototype.blindClick = function() {
		var self = this;
		self.peer.toggleBlind();
	}
	
	ns.Peer.prototype.setSayState = function( say ) {
		var self = this;
		if ( typeof( say ) === 'undefined' )
			say = !self.sayMessages;
		
		self.sayMessages = say;
		self.sayStateBtn.classList.toggle( 'blink-green', say );
		
		if ( !self.chatShow && ( say === false ) )
			self.toggleSayState( false );
	}
	
	ns.Peer.prototype.enableDragMode = function() {
		var self = this;
		self.ondrag( 'enable' );
	}
	
	ns.Peer.prototype.showDragger = function() {
		var self = this;
		self.showUI();
		self.showTheThing( 'dragger' );
	}
	
	ns.Peer.prototype.hideDragger = function() {
		var self = this;
		self.hideTheThing( 'dragger' );
		self.toggleUI();
	}
	
	ns.Peer.prototype.dragClose = function() {
		var self = this;
		self.ondrag( 'disable' );
	}
	
	ns.Peer.prototype.removeClick = function( e ) {
		var self = this;
		e.preventDefault();
		self.peer.remove();
	}
	
	ns.Peer.prototype.toggleDraggable = function( showDraggable ) {
		var self = this;
		if ( self.isDragging )
			return;
		
		self.dragHintDraggable.classList.toggle( 'hidden', !showDraggable );
		self.dragHintDropzone.classList.toggle( 'hidden', showDraggable );
	}
	
	ns.Peer.prototype.handleDragStart = function( e ) {
		var self = this;
		self.toggleDragee( true );
		self.ondrag( 'start' );
	}
	
	ns.Peer.prototype.handleDragEnter = function( e ) {
		var self = this;
		if ( self.isDragee )
			return;
		
		e.preventDefault();
		self.toggleDropTarget( true );
	}
	
	ns.Peer.prototype.handleDragLeave = function( e ) {
		var self = this;
		if ( self.isDragee )
			return;
		
		self.toggleDropTarget( false );
	}
	
	ns.Peer.prototype.handleDragEnd = function( e ) {
		var self = this;
		
		self.ondrag( 'end' );
		self.toggleDragee( false );
	}
	
	ns.Peer.prototype.handleDrop = function( e ) {
		var self = this;
		
		self.toggleDropTarget( false );
		self.ondrag( 'drop' );
	}
	
	ns.Peer.prototype.setIsDragging = function( ayeOrNay ) {
		var self = this;
		self.isDragging = ayeOrNay;
	}
	
	ns.Peer.prototype.toggleDragee = function( isDragee ) {
		var self = this;
		if ( self.isDragee === isDragee )
			return;
		
		self.isDragee = isDragee;
		self.dragHintDraggable.classList.toggle( 'hidden', isDragee );
		self.dragHintDragee.classList.toggle( 'hidden', !isDragee );
	}
	
	ns.Peer.prototype.toggleDropTarget = function( isTarget ) {
		var self = this;
		if ( self.isDropTarget === isTarget )
			return;
		
		self.isDropTarget = isTarget;
		self.dragHintDropzone.classList.toggle( 'hidden', isTarget );
		self.dragHintDropTarget.classList.toggle( 'hidden', !isTarget );
	}
	
	ns.Peer.prototype.toggleDropzone = function( show ) {
		var self = this;
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
		var self = this;
		if ( self.stream )
			show = false;
		
		if ( !self.rtcState )
			return;
		
		self.rtcState.toggle( show );
	}
	
	ns.Peer.prototype.toggleUIMode = function( uiVisible ) {
		var self = this;
		if ( null == uiVisible )
			self.uiVisible = !self.uiVisible;
		else
			self.uiVisible = uiVisible;
		
		self.toggleUI();
	}
	
	ns.Peer.prototype.showUI = function() {
		var self = this;
		self.toggleUI( true );
	}
	
	ns.Peer.prototype.hideUI = function() {
		var self = this;
		self.toggleUI( false );
	}
	
	ns.Peer.prototype.toggleUI = function( temp ) {
		var self = this;
		var show = self.uiVisible || !!temp;
		//self.ui.classList.toggle( 'is-visible', show );
		self.el.classList.toggle( 'show-ui', show );
	}
	
	ns.Peer.prototype.bindPeerCommon = function() {
		var self = this;
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
		var self = this;
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
		self.isVideo = conf.isVideo;
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
		
		self.isVideo = available;
		//self.updateStream();
		self.updateButtonVisibility();
		self.toggleStream();
	}
	
	ns.Peer.prototype.handleAudio = function( available ) {
		const self = this;
		if ( !self.stream )
			return;
		
		self.isAudio = available;
		//self.updateStream();
		self.updateButtonVisibility();
	}
	
	ns.Peer.prototype.updateStream = function() {
		var self = this;
		return;
		
		if ( !self.stream || !self.media )
			return;
		
		self.stream.srcObject = null;
		self.stream.srcObject = self.media;
		self.stream.load();
	}
	
	ns.Peer.prototype.bindStreamResize = function() {
		var self = this;
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
		var conf = {
			id : id,
			src : src,
		};
		
		var element = document.getElementById( self.id );
		var container = element.querySelector( '.stream-container' );
		var RTCInfo = container.querySelector( '.main-rtc' );
		
		self.stream = hello.template.getElement( 'stream-video-tmpl', conf );
		self.stream.onloadedmetadata = play;
		//self.updateAudioSink();
		
		container.insertBefore( self.stream, RTCInfo );
		self.toggleSpinner( false );
		self.bindStreamResize();
		
		function play( e ) {
			self.updateAudioSink();
			self.stream.play();
		}
	}
	
	ns.Peer.prototype.removeStream = function() {
		var self = this;
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
		var self = this;
		self.removeStream();
		self.isVideo = false;
		self.isAudio = false;
		self.resetState();
		self.toggleStream();
		self.updateButtonVisibility();
	}
	
	ns.Peer.prototype.resetState = function() {
		var self = this;
		var isMuted = false;
		var isBlinded = false;
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
		}
	}
	
	ns.Peer.prototype.updateButtonVisibility = function() {
		var self = this;
		if ( self.isAudio )
			self.menu.enable( self.menuMuteId );
		else
			self.menu.disable( self.menuMuteId );
		
		if ( self.isVideo )
			self.menu.enable( self.menuBlindId );
		else
			self.menu.disable( self.menuBlindId );
	}
	
	ns.Peer.prototype.handleSelfMute = function( isMuted ) {
		var self = this;
		self.menu.setState( self.menuMuteId, isMuted );
		self.toggleMuteState( isMuted );
	}
	
	ns.Peer.prototype.toggleMuteState = function( isMuted ) {
		var self = this;
		self.toggleElement( self.muteState, isMuted );
		self.toggleElement( self.listMuteLocal, isMuted );
	}
	
	ns.Peer.prototype.toggleRemoteMute = function( isMuted ) {
		var self = this;
		self.toggleUIIndicator( '.remote-mute', isMuted );
		self.toggleElement( self.listMuteRemote, isMuted );
	}
	
	ns.Peer.prototype.handleSelfBlind = function( isBlinded ) {
		var self = this;
		self.localBlind = isBlinded
		self.menu.setState( self.menuBlindId, isBlinded );
		self.toggleBlindState( isBlinded );
		self.toggleStream();
	}
	
	ns.Peer.prototype.toggleBlindState = function( isBlinded ) {
		var self = this;
		self.toggleElement( self.blindState, isBlinded );
	}
	
	ns.Peer.prototype.toggleRemoteBlind = function( isBlinded ) {
		var self = this;
		self.remoteBlind = isBlinded;
		self.toggleStream();
		self.toggleUIIndicator( '.remote-blind', isBlinded );
	}
	
	ns.Peer.prototype.handleIsFocus = function( isFocus ) {
		const self = this;
		self.menu.setState( self.menuFocusId, isFocus );
	}
	
	ns.Peer.prototype.toggleStream = function( force ) {
		var self = this;
		if ( force !== undefined ) {
			toggle( force );
			return;
		}
		
		if ( self.localBlind || self.remoteBlind || !self.isVideo )
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
		var id = identity;
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
		var self = this;
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
	
	ns.Peer.prototype.setButtonIcon = function( btn, remove, add ) {
		const self = this;
		const i = btn.querySelector( 'i' );
		i.classList.toggle( remove, false );
		i.classList.toggle( add, true );
	}
	
	ns.Peer.prototype.toggleUIIndicator = function( indicatorClass, isOn ) {
		const self = this;
		const peerElement = document.getElementById( self.id );
		const uiElement = peerElement.querySelector( indicatorClass );
		uiElement.classList.toggle( 'hidden', !isOn );
	}
	
	ns.Peer.prototype.toggleElement = function( element, show ) {
		var self = this;
		if ( null == show )
			element.classList.toggle( 'hidden' );
		else
			element.classList.toggle( 'hidden', !show );
	}
	
	ns.Peer.prototype.toggleElementClass = function( element, className, set ) {
		var self = this;
		element.classList.toggle( className, set );
	}
	
	ns.Peer.prototype.is = function() {
		var self = this;
		return !!( self.id === 'selfie' );
	}
	
	ns.Peer.prototype.showClose = function( callback ) {
		var self = this;
		self.close();
		return;
		
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
	}
	
	ns.Peer.prototype.close = function() {
		var self = this;
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
		
		var self = this;
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
		var self = this;
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
		var self = this;
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
		var self = this;
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
		var self = this;
		self.ctx.clearRect( 0, 0, self.cSize, self.cSize );
	}
	
	ns.Countdown.prototype.finished = function() {
		var self = this;
		//window.cancelAnimationFrame( self.animFrame );
		self.animFrame = null;
		var fin = self.onfinished;
		self.close();
		fin();
	}
	
	ns.Countdown.prototype.close = function() {
		var self = this;
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
		
		self.isPopped = true;
		self.showDuration = false;
		
		ns.Peer.call( this, conf );
	}
	
	ns.Selfie.prototype = Object.create( ns.Peer.prototype );
	
	ns.Selfie.prototype.togglePopped = function( force ) {
		const self = this;
		if ( null == force ) {
			self.isPopped = !self.isPopped;
			self.wasPopped = self.isPopped;
		}
		else {
			self.wasPopped = self.isPopped;
			self.isPopped = force;
		}
		
		self.menu.setState( 'popped', self.wasPopped );
		self.updateDisplayState();
		self.toggleDurationUpdate();
		self.toggleAVGraph();
		
		return self.isPopped;
	}
	
	ns.Selfie.prototype.updateDisplayState = function( isSpeaker ) {
		const self = this;
		// is in list, ignore everything else
		if ( self.isInList ) {
			setPopped( false );
			return;
		}
		
		if ( isSpeaker )
			setPopped( false );
		else
			setPopped( self.isPopped );
		
		function setPopped( popped ) {
			self.el.classList.toggle( 'popped', popped );
		}
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
		if ( self.isVideo )
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
			self.peer.emit( 'popped', self.isPopped );
		}
		
		// ui
		//self.audioBtn = document.getElementById( 'mute-self' );
		self.nameBar = self.ui.querySelector( '.ui-buttons .name-bar' );
		self.durationBar = document.getElementById( 'session-duration' );
		self.durationTime = self.durationBar.querySelector( '.time' );
		
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
	
	ns.Selfie.prototype.startDurationTimer = function() {
		const self = this;
		self.startTime = Date.now();
		self.isDurationTimer = true;
		self.toggleDurationUpdate();
	}
	
	ns.Selfie.prototype.toggleDurationUpdate = function() {
		const self = this;
		if ( !self.isDurationTimer || self.isPopped || self.isInList ) {
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
			var now = Date.now();
			var duration = now - self.startTime;
			self.setDurationTime( duration );
		}
		
		function stop() {
			if ( self.durationLoopId ) {
				window.cancelAnimationFrame( self.durationLoopId );
				self.durationLoopId = null;
			}
		}
	}
	
	ns.Selfie.prototype.setDurationTime = function( msSinceStart ) {
		var self = this;
		if ( !msSinceStart ) {
			clear();
			return;
		}
		
		var seconds = window.Math.floor( msSinceStart / 1000 );
		var hours = window.Math.floor( seconds / 60 / 60 );
		if ( hours ) {
			var hourSeconds = hours * 60 * 60;
			seconds = seconds - hourSeconds;
		}
		
		var minutes = window.Math.floor( seconds / 60 );
		if ( minutes ) {
			var minuteSeconds = minutes * 60;
			seconds = seconds - minuteSeconds
		}
		
		var time = [];
		if ( hours )
			time.push( pad( hours ));
		
		time.push( pad( minutes ));
		time.push( pad( seconds ));
		self.durationTime.innerText = time.join( ':' );
		
		function clear() {
			self.durationTime.innerText = '--:--:--';
		}
		
		function pad( num ) {
			if ( 10 > num )
				return '0' + num;
			
			return num;
		}
	}
	
	ns.Selfie.prototype.stopDurationTimer = function() {
		var self = this;
		self.isDurationTimer = false;
		self.startTime = null;
		self.toggleDurationUpdate();
		self.setDurationTime( null );
	}
	
	ns.Selfie.prototype.bindPeer = function() {
		var self = this;
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
		var self = this;
		self.toggleAVGraph();
		self.handleMedia( media );
		if ( !self.stream )
			return;
		
		self.stream.muted = true;
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
		var self = this;
		var isMuted = false;
		var isBlinded = false;
		self.toggleMuteState( isMuted );
		self.toggleBlindState( isBlinded );
	}
	
	ns.Selfie.prototype.updateButtonVisibility = function() {
		var self = this;
		if ( self.isAudio )
			self.menu.enable( 'mute' );
		else
			self.menu.disable( 'mute' );
		
		if ( self.isVideo ) {
			self.menu.enable( 'blind' );
			self.menu.enable( 'screen-mode' );
			self.menu.enable( 'popped' );
		}
		else {
			self.menu.disable( 'blind' );
			self.menu.disable( 'screen-mode' );
			self.menu.disable( 'popped' );
		}
	}
	
	ns.Selfie.prototype.handleQueue = function( position ) {
		var self = this;
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
		var self = this;
		self.showTheThing( 'queue' );
	}
	
	ns.Selfie.prototype.hideQueue = function() {
		var self = this;
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
		if ( !self.screenshareBtn )
			return;
		
		self.screenshareBtn.classList.toggle( 'available', isActive );
	}
	
	ns.Selfie.prototype.handleSelfMute = function( isMuted ) {
		const self = this;
		self.menu.setState( 'mute', isMuted );
		self.audioBtn.classList.toggle( 'inverted', isMuted );
		self.audioBtn.classList.toggle( 'danger', isMuted );
		self.poppedMuteBtn.classList.toggle( 'danger', isMuted );
		self.toggleMuteState( isMuted );
	}
	
	ns.Selfie.prototype.handleSelfBlind = function( isBlinded ) {
		const self = this;
		self.menu.setState( 'blind', isBlinded );
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
		if ( self.menu )
			self.menu.off( self.screenModeId );
		
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
		
		var self = this;
		self.containerId = containerId;
		self.position = position || null;
		
		self.stream = null;
		
		self.init();
	}
	
	ns.Queue.prototype.update = function( pos ) {
		var self = this;
		self.setPosition( pos );
	}
	
	ns.Queue.prototype.init = function() {
		var self = this;
		var element = document.getElementById( self.containerId );
		self.positionElement = element.querySelector( '.queue-position' );
		if ( self.position )
			self.setPosition( self.position );
	}
	
	ns.Queue.prototype.setPosition = function( pos ) {
		var self = this;
		self.position = pos;
		self.positionElement.innerText = pos;
	}
	
})( library.view );


// RTCState
(function( ns, undefined ) {
	ns.RTCState = function( conf ) {
		if ( !( this instanceof ns.RTCState ))
			return new ns.RTCState( conf );
		
		var self = this;
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
		var self = this;
		self.keepOpen = true;
		self.toggle( true );
	}
	
	ns.RTCState.prototype.hide = function() {
		var self = this;
		self.keepOpen = false;
		self.toggle( false );
	}
	
	// PRIVATE
	
	ns.RTCState.prototype.toggle = function( show ) {
		var self = this;
		if ( self.keepOpen )
			show = true;
		
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
			.querySelector( '\
				.main-rtc-state \
				.state-latency \
				.state-value' );
		
		self.rtcPing = new library.component.PingBar( rtcPingBar );
	}
	
	ns.RTCState.prototype.build = function() {
		var self = this;
	}
	
	ns.RTCState.prototype.bind = function() {
		var self = this;
		var peer = document.getElementById( self.parentId );
		self.main = peer.querySelector( '.stream-container .main-rtc' );
		self.mini = peer.querySelector( '.grid-ui .mini-rtc' );
		
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
		var self = this;
		self.mainState.textContent = View.i18n('i18n_connection') + ': ' + data.type;
	}
	
	ns.RTCState.prototype.getLevel = function( value ) {
		var self = this;
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
		
		var self = this;
		self.container = containerElement;
		self.id = friendUP.tool.uid( 'ping-bar' );
		self.barStep = 50;
		self.showBars = false;
		
		self.init();
	}
	
	// PUBLIC
	
	ns.PingBar.prototype.set = function( pingTime ) {
		var self = this;
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
		var self = this;
		var el = document.getElementById( self.Id );
		el.parentNode.removeChild( el );
		delete self.id;
		delete self.container;
	}
	
	// PRIVATE
	
	ns.PingBar.prototype.init = function() {
		var self = this;
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
		var self = this;
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
		var self = this;
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
		var self = this;
		self.waiting.classList.toggle( 'hidden', true );
		self.timeout.classList.toggle( 'hidden', false );
	}
	
	ns.PingBar.prototype.toggleBar = function( show ) {
		var self = this;
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
		
		var self = this;
		self.id = conf.id;
		self.containerId = conf.containerId;
		self.app = conf.app;
		self.sendMessage = conf.sendMessage;
		self.onclose = conf.onclose;
		
		self.init();
	}
	
	ns.NestedApp.prototype.receiveMessage = function() {
		var self = this;
	}
	
	ns.NestedApp.prototype.init = function() {
		var self = this;
		self.build();
		self.bind();
		self.initApp();
	}
	
	ns.NestedApp.prototype.build = function() {
		var self = this;
		var tmplConf = {
			id : self.id,
		};
		const element = hello.template.getElement( 'nested-app-tmpl', tmplConf );
		element.classList.add( 'peer' );
		var container = document.getElementById( self.containerId );
		container.appendChild( element );
	}
	
	ns.NestedApp.prototype.bind = function() {
		var self = this;
		var element = document.getElementById( self.id );
		var closeBtn = element.querySelector( '.nested-close' );
		closeBtn.addEventListener( 'click', closeApp, false );
		function closeApp( e ) {
			self.close();
		}
	}
	
	ns.NestedApp.prototype.initApp = function() {
		var self = this;
		var element = document.getElementById( self.id );
		var iframe = element.querySelector( 'iframe' );
		var src = '/webclient/app.html?app=' 
			+ self.app.Filename 
			+ '&theme=borderless';
			
		iframe.src = src;
	}
	
	ns.NestedApp.prototype.close = function() {
		var self = this;
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
		var self = this;
		
		self.draggable = {};
		self.dragOrder = [];
		
		self.init();
	}
	
	ns.Dragger.prototype.add = function( ) {
		var self = this;
	}
	
	ns.Dragger.prototype.init = function() {
		var self = this;
	}
	
})( library.component );

