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
var hello = window.hello || {};

library.view = library.view || {};
library.component = library.component || {};

// LiveInit

(function( ns, undefined ) {
	ns.LiveInit = function( viewConf ) {
		var self = this;
		
		self.view = window.View;
		self.rtc = null;
		self.ui = null;
		self.init();
	}
	
	// Public??
	
	// Private
	ns.LiveInit.prototype.init = function() {
		var self = this;
		self.conn = new library.component.EventNode(
			null,
			null,
			eventSink,
			onSend
		);
		self.view.receiveMessage = handleFromApp;
		
		function onSend( e ) { self.view.sendMessage( e ); }
		function handleFromApp( e ) {
			self.conn.handle( e );
		}
		function eventSink( t, d ) { console.log( 'live event sink', {
				t : t,
				d : d,
			});
		}
		//
		var fragments = document.getElementById( 'fragments' );
		var fragStr = fragments.innerHTML;
		fragStr = View.i18nReplaceInString( fragStr );
		hello.template = new friendUP.gui.TemplateManager( fragStr );
		
		//
		var dropConf = {
			targetId : 'hello',
			ondrop : onDrop,
		};
		self.drop = new library.component.Drop( dropConf );
		function onDrop( dropped ) {
			self.conn.send( dropped );
		}
		
		//
		self.conn.on( 'focus', focus );
		self.conn.on( 'initialize', initialize );
		self.conn.on( 'closeview', closeView );
		
		function focus( e ) {}
		function initialize( e ) { self.initialize( e ); }
		function closeView( e ) { self.closeAllTheThings( e ); }
		
		//
		var loaded = {
			type : 'loaded',
			data : 'pølse',
		};
		self.conn.send( loaded );
	}
	
	ns.LiveInit.prototype.initialize = function( data ) {
		const self = this;
		hello.template.addFragments( data.fragments );
		
		//
		hello.parser = new library.component.parse.Parser();
		hello.parser.use( 'LinkStd' );
		hello.parser.use( 'Emojii', data.emojii );
		
		// we dont need these any more
		delete data.fragments;
		delete data.emojii;
		
		// prepare ui state
		//if ( 'desktop' !== View.deviceType )
		
		// init ui
		self.ui = new library.view.Live();
		
		// init RTC
		self.rtc = new library.rtc.RTC(
			self.conn,
			self.ui,
			data.liveConf,
			onclose,
			onready
		);
		
		function onready( err ) {
			self.conn.send({ type : 'ready' });
		}
		
		function onclose() { self.closeAllTheThings(); }
	}
	
	ns.LiveInit.prototype.closeAllTheThings = function() {
		var self = this;
		self.rtc.close();
		self.ui.close();
		
		self.view.sendMessage({
			type : 'close',
		});
	}
	
})( library.view );

// LIVE
// ui logic for live session
(function( ns, undefined ) {
	ns.Live = function() {
		if ( !( this instanceof ns.Live ))
			return new ns.Live();
		
		var self = this;
		self.rtc = null;
		self.peerContainerId = 'peers';
		self.peers = [];
		self.peerOrder = [];
		
		self.resizeWait = null;
		self.reorder = {
			sourceIndex : null,
			targetIndex : null,
		};
		self.isReordering = false;
		self.peerAddQueue = [];
		
		self.selfiePopped = true;
		self.wasPopped = true;
		self.currentSpeaker = null;
		self.uiVisible = false;
		self.ui = null;
		self.uiPanes = {};
		self.panesVisible = 0;
		
		self.init();
	}
	
	ns.Live.prototype.init = function() {
		var self = this;
		self.uiPaneMap = {
			'init-checks'   : library.view.InitChecksPane,
			'source-select' : library.view.SourceSelectPane,
			'ext-connect'   : library.view.ExtConnectPane,
			'settings'      : library.view.SettingsPane,
			'share'         : library.view.SharePane,
			'menu'          : library.view.MenuPane,
			'chat'          : library.view.ChatPane,
		};
		
		/*
		let queueConf = {
			containerId : 'lists-container',
			label       : View.i18n( 'i18n_list_queue' ),
			faIcon      : 'fa-users',
			ontoggle    : null,
		};
		self.queue = new library.view.List( queueConf );
		*/
		
		let audioConf = {
			containerId : 'lists-container',
			id          : 'audio-list',
			label       : View.i18n( 'i18n_list_voice' ),
			faIcon      : 'fa-microphone',
			ontoggle    : audioListToggled,
		};
		self.audioList = new library.view.List( audioConf );
		function audioListToggled( state ) {
			if ( self.peerOrder.length )
				self.reflowPeers();
		}
		
		self.bindEvents();
		self.uiVisible = true;
		self.toggleUI();
	}
	
	ns.Live.prototype.addUIPane = function( id, conf ) {
		var self = this;
		var Pane = self.uiPaneMap[ id ];
		if ( !Pane ) {
			console.log( 'no ui pane for id', { id : id, map : self.uiPaneMap });
			throw new Error( 'no ui pane found for id: ' + id );
			return;
		}
		
		var paneConf = {
			id           : id,
			parentId     : 'live-ui-panes',
			onpanetoggle : onToggle,
			onpaneclose  : onClose,
			conf         : conf,
		};
		var pane = new Pane( paneConf );
		self.uiPanes[ pane.id ] = pane;
		return pane;
		
		function onToggle( setVisible ) {
			self.toggleUIPanes( setVisible );
		}
		
		function onClose() { self.removeUIPane( pane.id ); }
	}
	
	ns.Live.prototype.bindEvents = function() {
		const self = this;
		self.peerContainer = document.getElementById( self.peerContainerId );
		
		// ui
		self.live = document.getElementById( 'live' );
		self.waiting = document.getElementById( 'waiting-for-container' );
		self.ui = document.getElementById( 'live-ui' );
		self.uiMenuBtn = document.getElementById( 'show-menu-btn' );
		self.uiPeerGridBtn = document.getElementById( 'toggle-peer-grid-btn' );
		self.uiPaneContainer = document.getElementById( 'live-ui-panes' );
		
		document.addEventListener( 'mousemove', mouseMoved, false );
		document.addEventListener( 'mouseleave', catchLeave, false );
		document.addEventListener( 'mouseenter', catchEnter, false );
		
		self.ui.addEventListener( 'transitionend', uiTransitionEnd, false );
		self.uiMenuBtn.addEventListener( 'click', menuClick, false );
		self.uiPeerGridBtn.addEventListener( 'click', peerGridClick, false );
		
		function uiTransitionEnd( e ) {
			self.uiTransitionEnd( e );
		}
		
		function catchEnter( e ) { self.handleViewOver( true ); }
		function catchLeave( e ) { self.handleViewOver( false ); }
		
		function menuClick( e ) { self.showMenu(); }
		function peerGridClick( e ) { self.togglePeerGrid(); }
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
	
	ns.Live.prototype.uiTransitionEnd = function( e ) {
		var self = this;
		if ( !( 'live-ui' === e.target.id ) || !( 'opacity' === e.propertyName ))
			return;
		
		if ( !self.uiVisible )
			self.ui.classList.toggle( 'hidden', true );
	}
	
	ns.Live.prototype.handleViewOver = function( isOver ) {
		var self = this;
		isOver = self.uiVisible || isOver;
		self.toggleUI( isOver );
	}
	
	ns.Live.prototype.showMenu = function() {
		var self = this;
		self.menuUI.show();
	}
	
	ns.Live.prototype.togglePeerGrid = function() {
		var self = this;
		console.log( 'togglePeerGrid - NYI ~~justlayoutthings~~' );
	}
	
	ns.Live.prototype.toggleUI = function( show, skipAnim ) {
		var self = this;
		if ( self.panesVisible )
			show = false;
		
		var setVisible = null;
		if ( null != show )
			setVisible = show;
		else
			setVisible = self.uiVisible;
		
		if ( setVisible || skipAnim )
			self.ui.classList.toggle( 'hidden', !setVisible );
		
		//self.ui.classList.toggle( 'is-visible', setVisible );
		self.live.classList.toggle( 'show-ui', setVisible );
	}
	
	ns.Live.prototype.toggleUIPanes = function( setVisible ) {
		var self = this;
		if ( setVisible )
			self.panesVisible++;
		else
			self.panesVisible--;
		
		// theres is only change in container visibility
		// at 0 and 1 panes visible
		if ( self.panesVisible > 1 )
			return;
		
		self.toggleUI( !setVisible, true );
		self.uiPaneContainer.classList.toggle( 'hidden', !setVisible );
	}
	
	ns.Live.prototype.getUIPane = function( id ) {
		var self = this;
		var pane = self.uiPanes[ id ];
		if ( !pane ) {
			console.log( 'getUIPane - no pane found for id', id );
			return null;
		}
		
		return pane;
	}
	
	ns.Live.prototype.hideUIPane = function( id ) {
		var self = this;
		var pane = self.getPane( id );
		pane.hide();
	}
	
	ns.Live.prototype.removeUIPane = function( id ) {
		var self = this;
		var pane = self.getUIPane( id )
		if ( !pane )
			return;
		
		//pane.hide();
		delete self.uiPanes[ id ];
		self.toggleUIPanes( false );
	}
	
	ns.Live.prototype.handleResize = function( e ) {
		var self = this;
		if ( self.resizeWait ) {
			self.doOneMoreResize = true;
			return;
		}
		
		self.doOneMoreResize = false;
		self.peerOrder.forEach( callResize );
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
	
	ns.Live.prototype.addNestedApp = function( appData ) {
		var self = this;
		if ( self.nestedApp )
			self.nestedApp.close();
		
		console.log( 'nestedApp', appData );
		var appId = friendUP.tool.uid( 'nested-app' );
		var conf = {
			id : appId,
			containerId : self.peerContainerId,
			app : appData,
			onclose : onclose,
		};
		self.nestedApp = new library.component.NestedApp( conf );
		self.updateGridClass();
		console.log( 'nestedApp', self.nestedApp );
		
		function onclose() {
			self.nestedApp = null;
			self.updateGridClass();
		}
		
		function send( e ) {
			console.log( 'nestedApp.send', e );
		}
	}
	
	ns.Live.prototype.addPeer = function( peer ) {
		var self = this;
		if ( self.isReordering ) {
			self.peerAddQueue.push( peer );
			return;
		}
		
		var conf = {
			peer           : peer,
			menu           : self.menu,
			connecting     : document.getElementById( 'connecting-peers' ),
			currentQuality : self.currentQuality,
			isHost         : peer.isHost,
			ondrag         : onDrag,
			onclick        : onClick,
		};
		
		let viewPeer =  null;
		if ( peer.id === 'selfie' ) {
			viewPeer = new library.view.Selfie( conf );
			peer.on( 'room-quality', handleRoomQuality );
			peer.on( 'popped', togglePopped );
		}
		else {
			conf.onmenu = onMenuClick;
			viewPeer = new library.view.Peer( conf );
		}
		peer.on( 'video', updateHasVideo );
		
		// add to ui
		self.peers[ viewPeer.id ] = viewPeer;
		self.peerContainer.appendChild( viewPeer.el );
		viewPeer.el.classList.toggle( 'in-grid', true );
		self.peerOrder.push( viewPeer.id );
		self.updateGridClass();
		self.updateMenu();
		
		// start session duration on selfie when the first peer is added
		if ( self.peerOrder.length === 2 )
			self.peers[ 'selfie' ].startDurationTimer();
		
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
		
		function updateHasVideo( hasVideo ) {
			self.updateHasVideo( peer.id, hasVideo );
		}
		
		function onMenuClick( e ) {
			self.menu.show( viewPeer.menuId );
			self.menuUI.show();
		}
	}
	
	ns.Live.prototype.removePeer = function( peerId ) {
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
		let pidx = self.peerOrder.indexOf( peerId );
		if ( -1 === pidx )
			self.audioList.remove( peerId );
		else
			self.peerOrder.splice( pidx, 1 );
		
		if ( self.modeSpeaker && self.currentSpeaker === peerId )
			self.setSpeaker();
		
		if ( self.peerOrder.length === 1 ) {
			self.peers[ 'selfie' ].stopDurationTimer();
		}
		
		self.updateGridClass();
		self.updateWaiting();
		self.updateMenu();
	}
	
	ns.Live.prototype.executePeerAddQueue = function() {
		var self = this;
		if ( !self.peerAddQueue.length || self.isReordering )
			return;
		
		self.peerAddQueue.forEach( add );
		function add( peer ) {
			self.addPeer( peer );
		}
	}
	
	ns.Live.prototype.applyPeerOrder = function( peerOrder ) {
		var self = this;
		self.isReordering = true;
		if ( peerOrder )
			self.peerOrder = peerOrder;
		
		self.peerOrder.forEach( applyPosition );
		if ( peerOrder )
			self.isReordering = false;
		
		self.executePeerAddQueue();
		
		function applyPosition( peerId ) {
			var peer = self.peers[ peerId ];
			var peerElement = document.getElementById( peerId );
			self.peerContainer.appendChild( peerElement );
			peer.restart();
		}
	}
	
	ns.Live.prototype.updateWaiting = function() {
		const self = this;
		let pids = Object.keys( self.peers );
		let hideWaiting = pids.length > 1;
		self.waiting.classList.toggle( 'hidden', hideWaiting );
	}
	
	ns.Live.prototype.updateMenu = function() {
		const self = this;
		let gridNum = self.peerOrder.length;
		let listNum = self.audioList.length;
		if ( 2 > gridNum )
			self.menu.disable( 'dragger' );
		else
			self.menu.enable( 'dragger' );
	}
	
	ns.Live.prototype.updateGridClass = function() {
		var self = this;
		var container = document.getElementById( self.peerContainerId );
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
			var numberOfPeers = self.peerOrder.length;
			var peerNum = numberOfPeers;
			if ( self.nestedApp )
				peerNum += 1;
			
			if ( self.selfiePopped )
				peerNum -= 1;
			
			return peerNum;
		}
	}
	
	ns.Live.prototype.reflowPeers = function() {
		var self = this;
		self.peerOrder.forEach( callReflow );
		function callReflow( peerId ) {
			var peer = self.peers[ peerId ];
			if ( !peer )
				return;
			
			peer.reflow();
		}
	}
	
	ns.Live.prototype.handleQueue = function( msg ) {
		const self = this;
		console.log( 'handleQueue', msg );
		if ( !self.queue )
			return;
		
		self.queue.handle( msg );
	}
	
	ns.Live.prototype.updateHasVideo = function( peerId, hasVideo ) {
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
			self.peerOrder.push( pid );
			peer.toggleListMode( false );
			if ( 'selfie' === peer.id && self.wasPopped )
				self.togglePopped( true );
			
			self.peerContainer.appendChild( peer.el );
			self.updateGridClass();
		}
		
		function moveToAudioList( peer ) {
			let pid = peer.id;
			if ( isInAudio( pid ))
				return;
			
			if ( 'selfie' === peer.id )
				self.togglePopped( false );
			
			peer.toggleListMode( true );
			let pidx = self.peerOrder.indexOf( peer.id );
			self.peerOrder.splice( pidx, 1 );
			self.audioList.add( peer.el );
			self.updateGridClass();
			let pids = Object.keys( self.peers );
			/*
			if (( !self.peerOrder.length ) && ( 1 < pids.length )) {
				console.log( 'show audio lsst', {
					pod : self.peerOrder,
					pids : pids });
				self.audioList.show();
			} else
				console.log( 'dont audio lsst', {
					pod : self.peerOrder,
					pids : pids });
			*/
			
			function isInAudio( pid ) {
				return !isInVideo( pid );
			}
		}
		
		function isInVideo( pid ) {
			return self.peerOrder.some( poId => poId === pid );
		}
	}
	
	ns.Live.prototype.onDrag = function( type, peerId ) {
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
			self.peerOrder.forEach( toggle );
			function toggle( peerId ) {
				var peer = self.peers[ peerId ];
				peer.toggleDropzone( isDragging );
			}
		}
		
		function toggleIsDragging( ayOrNay ) {
			self.peerOrder.forEach( set );
			function set( peerId ) {
				var peer = self.peers[ peerId ];
				peer.setIsDragging( ayOrNay );
			}
		}
	}
	
	ns.Live.prototype.clearDragger = function() {
		const self = this;
		console.log( 'clearDragger' );
		self.onDrag( 'end' );
		self.onDrag( 'disable' );
	}
	
	ns.Live.prototype.reorderStart = function( sourceId ) {
		var self = this;
		var sourceIndex = self.peerOrder.indexOf( sourceId );
		self.isReordering = true;
		self.reorder.sourceIndex = sourceIndex;
		
	}
	
	ns.Live.prototype.reorderDrop = function( targetId ) {
		var self = this;
		var targetIndex = self.peerOrder.indexOf( targetId );
		self.reorder.targetIndex = targetIndex;
		self.doReorder();
	}
	
	ns.Live.prototype.doReorder = function() {
		var self = this;
		var sIndex = self.reorder.sourceIndex;
		var sId = self.peerOrder[ sIndex ];
		var tIndex = self.reorder.targetIndex;
		var tId = self.peerOrder[ tIndex ];
		self.peerOrder[ sIndex ] = tId;
		self.peerOrder[ tIndex ] = sId;
		self.applyPeerOrder();
	}
	
	ns.Live.prototype.reorderEnd = function() {
		var self = this;
		self.reorder = {
			sourceIndex : null,
			targetIndex : null,
		};
		self.isReordering = false;
		self.executePeerAddQueue();
	}
	
	ns.Live.prototype.onPeerClickCatch = function( peerId ) {
		var self = this;
		self.toggleUIMode();
	}
	
	ns.Live.prototype.toggleUIMode = function() {
		var self = this;
		self.uiVisible = !self.uiVisible;
		self.toggleUI();
		
		self.peerOrder.forEach( updateUI );
		function updateUI( pId ) {
			var peer = self.peers[ pId ];
			if ( !peer ) {
				console.log( 'live.updatePeerUI - no peer for id', pId );
				return;
			}
			
			peer.toggleUIMode( self.uiVisible );
		}
	}
	
	ns.Live.prototype.addMenu = function() {
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
		const screenShareExt = {
			type    : 'item',
			id      : 'screen-share-ext',
			name    : View.i18n( 'i18n_get_screenshare_ext' ),
			faIcon  : 'fa-download',
			disable : true,
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
		const sendAudio = {
			type : 'item',
			id : 'send-audio',
			name : View.i18n( 'i18n_menu_send_audio' ),
			faIcon : 'fa-microphone',
			toggle : true,
			close : false,
		};
		const sendVideo = {
			type : 'item',
			id : 'send-video',
			name : View.i18n( 'i18n_menu_send_video' ),
			faIcon : 'fa-video-camera',
			toggle : true,
			close : false,
		};
		const receiveAudio = {
			type   : 'item',
			id     : 'receive-audio',
			name   : View.i18n( 'i18n_menu_receive_audio' ),
			faIcon : 'fa-volume-up',
			toggle : true,
			close  : false,
		};
		const receiveVideo = {
			type   : 'item',
			id     : 'receive-video',
			name   : View.i18n( 'i18n_menu_receive_video' ),
			faIcon : 'fa-film',
			toggle : true,
			close  : false,
		};
		const sendReceive = {
			type : 'folder',
			id : 'send-receive',
			name : View.i18n( 'Send / Receive media' ),
			faIcon : 'fa-exchange',
			items : [
				sendAudio,
				sendVideo,
				receiveAudio,
				receiveVideo,
			],
		};
		const dragger = {
			type   : 'item',
			id     : 'dragger',
			name   : View.i18n( 'i18n_change_participant_order' ),
			faIcon : 'fa-hand-stop-o',
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
			screenShare,
			screenShareExt,
			source,
			popped,
			speaker,
			sendReceive,
			screenMode,
			settings,
			dragger,
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
			console.log( 'menu.togglefullscreen' );
			View.toggleFullscreen();
		}
	}
	
	ns.Live.prototype.togglePopped = function( force ) {
		const self = this;
		self.selfiePopped = force || !self.selfiePopped;
		if ( null == force ) {
			self.wasPopped = self.selfiePopped;
		} else {
			self.wasPopped = self.selfiePopped;
			self.selfiePopped = force;
		}
		
		self.updateSelfiePopped();
	}
	
	ns.Live.prototype.updateSelfiePopped = function() {
		const self = this;
		const selfie = self.peers[ 'selfie' ];
		let isSpeaker = 'selfie' === self.currentSpeaker;
		if ( selfie.isInList ) {
			if ( !self.selfiePopped )
				return;
			else {
				if ( !self.selfiePopped )
					return;
				
				self.selfiePopped = selfie.togglePopped( false );
				self.wasPopped = true;
			}
			
			return;
		}
		
		if ( self.modeSpeaker && !!self.currentSpeaker ) {
			self.wasPopped = self.selfiePopped;
			if ( self.selfiePopped )
				selfie.togglePopped( false );
			
		} else
			selfie.togglePopped( self.wasPopped );
			
		self.updateGridClass();
	}
	
	ns.Live.prototype.toggleModeSpeaker = function() {
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
	
	ns.Live.prototype.updateModeSpeaker = function() {
		const self = this;
		const container = document.getElementById( self.peerContainerId );
		const modeSpeaker = ( !!self.modeSpeaker && !!self.currentSpeaker );
		const speaker = self.peers[ self.currentSpeaker ];
		if ( speaker && speaker.isInList )
			container.classList.toggle( 'mode-speaker', false );
		else
			container.classList.toggle( 'mode-speaker', modeSpeaker );
		
		self.updateSelfiePopped();
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
	
	ns.Live.prototype.setSpeaker = function( speaker ) {
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
	
	ns.Live.prototype.addChat = function( userId, identities, conn ) {
		var self = this;
		var conf = {
			identities : identities,
			userId     : userId,
			conn       : conn,
		};
		self.chatUI = self.addUIPane( 'chat', conf );
		return self.chatUI;
	}
	
	ns.Live.prototype.addShare = function( conn ) {
		const self = this;
		const conf = {
			conn : conn,
		};
		self.shareUI = self.addUIPane( 'share', conf );
		return self.shareUI;
	}
	
	ns.Live.prototype.addSettings = function( onsave ) {
		const self = this;
		const conf = {
			onsave : onsave,
		};
		self.settingsUI = self.addUIPane( 'settings', conf );
		return self.settingsUI;
	}
	
	ns.Live.prototype.addExtConnPane = function( onshare ) {
		const self = this;
		const conf = {
			onshare : onshare,
		};
		self.extConnUI = self.addUIPane( 'ext-connect', conf );
		return self.extConnUI;
	}
	
	ns.Live.prototype.updateQualityLevel = function( level ) {
		var self = this;
		self.currentQuality = level;
		self.peerOrder.forEach( setLevel );
		function setLevel( peerId ) {
			var peer = self.peers[ peerId ];
			peer.applyQualityLevel( level );
		}
	}
	
	ns.Live.prototype.close = function() {
		var self = this;
		self.menu.close();
		delete self.menu;
	}
	
})( library.view );


// PEER
(function( ns, undefined ) {
	ns.Peer = function( conf ) {
		if ( !( this instanceof ns.Peer ))
			return new ns.Peer( conf );
		
		var self = this;
		self.id = conf.peer.id;
		self.peer = conf.peer;
		self.menu = conf.menu;
		self.connecting = conf.connecting;
		self.currentQuality = conf.currentQuality;
		self.isHost = conf.isHost;
		self.ondrag = conf.ondrag;
		self.onclick = conf.onclick;
		self.onmenu = conf.onmenu;
		
		self.stream = null;
		
		self.muteBtn = null;
		self.blindBtn = null;
		self.localBlind = false;
		self.remoteBlind = false;
		
		self.isDragee = false;
		self.isDropzone = false;
		self.isDropTarget = false;
		
		self.sayMessages = false;
		
		self.useCoverMode = true;
		
		self.uiVisible = true;
		self.showStack = [];
		self.elementMap = {};
		
		self.init();
	}
	
	// Public
	
	ns.Peer.prototype.toggleListMode = function( isInList ) {
		const self = this;
		self.isInList = isInList;
		self.el.classList.toggle( 'in-grid', !isInList );
		self.el.classList.toggle( 'in-list', isInList );
		self.clickCatch.classList.toggle( 'hidden', isInList );
	}
	
	ns.Peer.prototype.setIsSpeaking = function( isSpeaker ) {
		const self = this;
		self.isSpeaker = isSpeaker;
		self.el.classList.toggle( 'speaker', isSpeaker );
		self.reflow();
	}
	
	// Private
	
	ns.Peer.prototype.init = function() {
		var self = this;
		self.buildView();
		self.bindUICommon();
		self.bindUI();
		self.bindPeerCommon();
		self.bindPeer();
		self.applyQualityLevel();
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
		self.menuRemoveId = self.menuId + '-remove';
		const mute = {
			type   : 'item',
			id     : self.menuMuteId,
			name   : View.i18n('i18n_mute'),
			faIcon : 'fa-microphone-slash',
			toggle : false,
			close  : false,
		};
		const blind = {
			type   : 'item',
			id     : self.menuBlindId,
			name   : View.i18n('i18n_pause'),
			faIcon : 'fa-eye-slash',
			toggle : false,
			close  : false,
		};
		const remove = {
			type   : 'item',
			id     : self.menuRemoveId,
			name   : View.i18n('i18n_remove'),
			faIcon : 'fa-close',
		};
		
		const mConf = {
			type : 'folder',
			id : self.menuId,
			name : View.i18n('i18n_updating'),
			faIcon : 'fa-user',
			items : [
				mute,
				blind,
			],
		};
		
		if ( self.isHost )
			mConf.items.push( remove );
		
		self.menu.add( mConf, 'peers' );
		self.muteLId = self.menu.on( self.menuMuteId, toggleMute );
		self.blindLId = self.menu.on( self.menuBlindId, toggleBlind );
		
		if ( self.isHost ) {
			self.removeLId = self.menu.on( self.menuRemoveId, doRemove );
		}
		
		function toggleMute() {
			self.peer.toggleMute();
		}
		
		function toggleBlind() {
			self.peer.toggleBlind();
		}
		
		function doRemove() {
			self.peer.remove();
		}
	}
	
	ns.Peer.prototype.initSelf = function() {
		var self = this;
		var streamState = {
			type : 'stream',
			data : {
				type : 'waiting',
			},
		};
		self.updateState( streamState );
	}
	
	ns.Peer.prototype.restart = function() {
		var self = this;
		if ( !self.stream ) {
			console.log( 'video not set', self.id );
			return;
		}
		
		var src = self.stream.src;
		self.stream.src = "";
		self.stream.src = src;
	}
	
	ns.Peer.prototype.buildView = function() {
		var self = this;
		var avatarUrl =  window.encodeURI( self.peer.avatar );
		var conf = {
			peerId : self.id,
			name : self.peer.name || '',
			avatar : avatarUrl || '',
		};
		self.el = hello.template.getElement( 'peer-tmpl', conf );
		self.connecting.appendChild( self.el );
	}
	
	ns.Peer.prototype.bindUI = function() {
		var self = this;
		// states
		self.rtcState = new library.view.RTCState({ peerId : self.id });
		
		// ui
		self.menuBtn = self.ui.querySelector( '.show-peer-menu' );
		self.sayStateBtn = self.ui.querySelector( '.say-state' );
		self.streamState = self.ui.querySelector( '.stream-state' );
		self.remoteMuteState = self.ui.querySelector( '.remote-mute' );
		self.remoteBlindState = self.ui.querySelector( 'remote-blind' );
		
		self.menuBtn.addEventListener( 'click', peerMenuClick, false );
		function peerMenuClick( e ) { self.onmenu(); }
		
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
		self.peer.on( 'media'         , handleMedia );
		self.peer.on( 'track'         , handleTrack );
		self.peer.on( 'legacy-stream' , handleLegacyStream );
		self.peer.on( 'video'         , handleVideo );
		self.peer.on( 'audio'         , handleAudio );
		self.peer.on( 'identity'      , updateIdentity );
		self.peer.on( 'nostream'      , handleNoStream );
		self.peer.on( 'stop'          , handleStop)
		self.peer.on( 'mute'          , isMuted );
		self.peer.on( 'blind'         , isBlinded );
		self.peer.on( 'screenmode'    , screenMode );
		self.peer.on( 'local-quality' , handleLocalQuality );
		
		function handleMedia( e ) { self.handleMedia( e ); }
		function handleTrack( e, f ) { self.handleTrack( e, f ); }
		function handleLegacyStream( e ) { self.handleLegacyStream( e ); }
		function handleVideo( e ) { self.handleVideo( e ); }
		function handleAudio( e ) { self.handleAudio( e ); }
		function updateIdentity( e ) { self.updateIdentity( e ); }
		function handleNoStream( e ) { self.handleNoStream( e ); }
		function handleStop( e ) { self.handleStop( e ); }
		function isMuted( e ) { self.handleSelfMute( e ); }
		function isBlinded( e ) { self.handleSelfBlind( e ); }
		function screenMode( e ) { self.updateScreenMode( e ); }
		function handleLocalQuality( e ) {
			self.applyQualityLevel( e );
		}
	}
	
	ns.Peer.prototype.bindPeer = function() {
		var self = this;
		self.peer.on( 'muted'  , remoteMute );
		self.peer.on( 'blinded', remoteBlind );
		self.peer.on( 'state'  , updateState );
		
		function remoteMute( e ) { self.toggleRemoteMute( e ); }
		function remoteBlind( e ) { self.toggleRemoteBlind( e ); }
		function updateState( e ) { self.updateState( e ); }
	}
	
	ns.Peer.prototype.handleMedia = function( media ) {
		const self = this;
		if ( !self.stream ) {
			self.setStream( media.id );
		}
		
		self.stream.pause();
		let srcObj = self.stream.srcObject;
		if ( srcObj ) {
			self.stream.pause();
			clear( srcObj );
			self.stream.load();
			self.stream.srcObject = null;
		}
		
		self.stream.srcObject = media;
		self.stream.load();
		
		function clear( media ) {
			let tracks = media.getTracks();
			tracks.forEach( stop );
			
			function stop( track ) {
				track.stop();
				media.removeTrack( track );
			}
		}
	}
	
	ns.Peer.prototype.handleTrack = function( type, track ) {
		const self = this;
		// set state
		const alreadyUpdating = !!self.isUpdatingStream;
		if ( !self.isUpdatingStream ) {
			self.stream.pause();
			self.isUpdatingStream = true;
		}
		
		//
		remove( type );
		if ( null == track ) {
			self.stream.load();
			return;
		}
		
		self.stream.srcObject.addTrack( track );
		self.stream.load();
		
		function remove( type ) {
			let srcObj = self.stream.srcObject;
			if ( !srcObj )
				return;
			
			let tracks = srcObj.getTracks();
			tracks.forEach( removeType );
			function removeType( track ) {
				if ( type !== track.kind )
					return;
				
				srcObj.removeTrack( track );
				track.stop();
			}
		}
	}
	
	ns.Peer.prototype.handleLegacyStream = function( conf ) {
		var self = this;
		self.isVideo = conf.isVideo;
		self.isAudio = conf.isAudio;
		var src = window.URL.createObjectURL( conf.stream );
		self.setStream( conf.stream.id, src );
		//self.stream.src = src;
		//self.updateStream();
		self.updateButtonVisibility();
		self.toggleStream();
	}
	
	ns.Peer.prototype.handleVideo = function( available ) {
		var self = this;
		if ( !self.stream )
			return;
		
		self.isVideo = available;
		self.updateStream();
		self.updateButtonVisibility();
		self.toggleStream();
	}
	
	ns.Peer.prototype.handleAudio = function( available ) {
		var self = this;
		if ( !self.stream )
			return;
		
		self.isAudio = available;
		self.updateStream();
		self.updateButtonVisibility();
	}
	
	ns.Peer.prototype.updateStream = function() {
		var self = this;
		console.log( 'peer-ui.updateStream - returning, no-op', {
			s : self.stream,
			ms : self.media,
		});
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
		var self = this;
		var container = document.getElementById( self.id ).querySelector( '.stream-container' );
		var width = container.scrollWidth;
		var height = container.scrollHeight;
		var containerAspect = width / height;
		if ( containerAspect < self.videoAspect )
			toggleUseWidth( true );
		else
			toggleUseWidth( false );
			
		function toggleUseWidth( useWidth ) {
			if ( !self.stream )
				return;
			
			toggle( 'video-border', !self.useCoverMode );
			self.toggleElementClass( self.avatar, 'fade', !self.useCoverMode );
			
			if ( !self.useCoverMode && !self.isPopped ) {
				toggle( 'width', false );
				toggle( 'height', false );
				return;
			}
			
			if ( 'contain' === self.peer.screenMode )
				useWidth = !useWidth;
			
			toggle( 'width', useWidth );
			toggle( 'height', !useWidth );
			
			function toggle( classStr, set ) {
				self.stream.classList.toggle( classStr, set );
			}
		}
	}
	
	ns.Peer.prototype.reflow = function() {
		var self = this;
		if ( !self.stream )
			return;
		
		let resize = new Event( 'resize' );
		self.stream.dispatchEvent( resize );
		if ( self.volume )
			self.volume.start();
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
		
		container.insertBefore( self.stream, RTCInfo );
		self.toggleSpinner( false );
		self.bindStreamResize();
		
		function play( e ) {
			self.stream.play();
		}
	}
	
	ns.Peer.prototype.removeStream = function() {
		var self = this;
		if ( !self.stream )
			return;
		
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
	
	ns.Peer.prototype.updateScreenMode = function() {
		const self = this;
		self.doResize();
	}
	
	ns.Peer.prototype.updateState = function( state ) {
		var self = this;
		self.rtcState.set( state );
	}
	
	ns.Peer.prototype.updateIdentity = function( identity ) {
		var self = this;
		identity = identity || self.identity;
		var id = identity;
		if ( !id ) {
			console.log( 'updateIdentity - no identity' )
			return;
		}
		
		if ( id.name && id.name.length ) {
			self.name.innerText = id.name;
			self.listName.innerText = id.name;
		}
		
		if ( id.avatar && id.avatar.length ) {
			let avatarUrl = window.encodeURI( id.avatar );
			let avatarStyle = 'url("' + avatarUrl + '")';
			self.avatar.style.backgroundImage = avatarStyle;
			self.listAvatar.style.backgroundImage = avatarStyle;
		}
		
		self.menu.update( self.menuId, id.name );
	}
	
	ns.Peer.prototype.handleNoStream = function() {
		var self = this;
		self.toggleSpinner( false );
	}
	
	ns.Peer.prototype.handleStop = function() {
		const self = this;
		self.releaseStream();
	}
	
	ns.Peer.prototype.applyQualityLevel = function( level ) {
		var self = this;
		self.currentQuality = level || self.currentQuality;
		self.useCoverMode = 'low' === self.currentQuality ? false : true;
		const isLow = ( 'low' === self.currentQuality );
		self.el.classList.toggle( 'quality-low', isLow );
		
		self.reflow();
	}
	
	ns.Peer.prototype.setButtonIcon = function( btn, remove, add ) {
		var self = this;
		var i = btn.querySelector( 'i' );
		i.classList.toggle( remove, false );
		i.classList.toggle( add, true );
	}
	
	ns.Peer.prototype.toggleUIIndicator = function( indicatorClass, isOn ) {
		var self = this;
		var peerElement = document.getElementById( self.id );
		var uiElement = peerElement.querySelector( indicatorClass );
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
		var self = this;
		// build
		var cw = self.containerEl.clientWidth;
		var ch = self.containerEl.clientHeight;
		var wh = Math.min( cw, ch );
		if ( !wh ) {
			console.log( 'canvas is hidden.. no, its FINE, forget it.' );
			self.finished();
			return;
		}
		
		self.id = friendUP.tool.uid( 'countdown' );
		var conf = {
			id : self.id,
			sq : wh,
		};
		var element = hello.template.getElement( 'countdown-tmpl', conf );
		self.containerEl.appendChild( element );
		
		//bind
		self.canvas = element.querySelector( 'canvas' );
		var closeBtn = element.querySelector( '.countdown-close-now' );
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
	ns.Selfie = function( conf ) {
		if ( !( this instanceof ns.Selfie ))
			return new ns.Selfie( conf );
		
		var self = this;
		self.onclean = conf.onclean;
		self.selectedStreamQuality = 'normal';
		
		self.isPopped = true;
		self.showDuration = false;
		
		ns.Peer.call( this, conf );
	}
	
	ns.Selfie.prototype = Object.create( ns.Peer.prototype );
	
	ns.Selfie.prototype.togglePopped = function( force ) {
		const self = this;
		if ( null == force )
			self.isPopped = !self.isPopped;
		else
			self.isPopped = force;
		
		self.el.classList.toggle( 'popped', self.isPopped );
		self.menu.setState( 'popped', self.isPopped );
		if ( !self.isInList ) {
			self.toggleDurationUpdate();
			self.toggleAVGraph();
		}
		
		return self.isPopped;
	}
	
	ns.Selfie.prototype.initSelf = function() {
		var self = this;
	}
	
	ns.Selfie.prototype.setupMenu = function() {
		var self = this;
		//self.muteId = 'mute';
		//self.blindId = 'blind';
	}
	
	ns.Selfie.prototype.buildView = function() {
		var self = this;
		var avatarUrl = window.encodeURI( self.peer.avatar );
		var tmplConf = {
			name : self.peer.name,
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
		
		self.poppedMuteBtn.addEventListener( 'click', muteBtnClick, false );
		self.unpopBtn.addEventListener( 'click', unpopClick, false );
		function unpopClick( e ) {
			//self.togglePopped();
			self.peer.emit( 'popped', self.isPopped );
		}
		
		// ui
		self.muteBtn = document.getElementById( 'mute-self' );
		self.nameBar = self.ui.querySelector( '.ui-buttons .name-bar' );
		self.durationBar = document.getElementById( 'session-duration' );
		self.durationTime = self.durationBar.querySelector( '.time' );
		
		self.muteBtn.addEventListener( 'click', muteBtnClick, false );
		function muteBtnClick( e ) { self.peer.toggleMute(); }
		
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
		var self = this;
		self.startTime = Date.now();
		self.isDurationTimer = true;
		self.toggleDurationUpdate();
	}
	
	ns.Selfie.prototype.toggleDurationUpdate = function() {
		const self = this;
		if ( !self.isDurationTimer || self.isPopped ) {
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
		
		function handleSelfie( e ) { self.handleSelfie( e ); }
		function handleQueue( e ) { self.handleQueue( e ); }
		function showError( e ) { self.showError( e ); }
	}
	
	ns.Selfie.prototype.handleSelfie = function( media ) {
		var self = this;
		self.toggleAVGraph();
		self.handleMedia( media );
		self.stream.muted = true;
	}
	
	ns.Selfie.prototype.toggleAVGraph = function() {
		const self = this;
		if ( self.isPopped )
			self.hideAVGraph();
		else
			self.showAVGraph();
	}
	
	ns.Selfie.prototype.showAVGraph = function() {
		const self = this;
		setTimeout( hepp, 100 );
		function hepp() {
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
	
	ns.Selfie.prototype.handleSelfMute = function( isMuted ) {
		var self = this;
		self.menu.setState( 'mute', isMuted );
		self.muteBtn.classList.toggle( 'danger', isMuted );
		self.poppedMuteBtn.classList.toggle( 'danger', isMuted );
		self.toggleMuteState( isMuted );
	}
	
	ns.Selfie.prototype.handleSelfBlind = function( isBlinded ) {
		var self = this;
		self.menu.setState( 'blind', isBlinded );
		self.localBlind = isBlinded;
		self.toggleBlindState( isBlinded );
		self.toggleStream();
	}
	
	ns.Selfie.prototype.peerClose = ns.Selfie.prototype.close;
	ns.Selfie.prototype.close = function() {
		var self = this;
		self.menu.off( self.screenModeId );
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


// List
(function( ns, undefined ) {
	ns.List = function( conf ) {
		if ( !( this instanceof ns.List ))
			return new ns.List( conf );
		
		const self = this;
		self.id = conf.id;
		self.containerId = conf.containerId;
		self.label = conf.label;
		self.faIcon = conf.faIcon;
		self.ontoggle = conf.ontoggle;
		
		// private
		self.items = {};
		self.itemOrder = [];
		
		self.init();
	}
	
	// PUBLIC
	
	ns.List.prototype.add = function( element ) {
		const self = this;
		self.doAdd( element );
	}
	
	ns.List.prototype.remove = function( id ) {
		const self = this;
		return self.doRemove( id );
	}
	
	ns.List.prototype.move = function( id, index ) {
		const self = this;
		self.doMove( id, index );
	}
	
	// event types allowed is the public api ( the functions up there ^ )
	ns.List.prototype.handle = function( e ) {
		const self = this;
		if ( !self[ e.type ])
			return;
		
		self[ e.type ]( e.data );
	}
	
	ns.List.prototype.show = function() {
		const self = this;
		self.toggleShow( true );
	}
	
	ns.List.prototype.peek = function() {
		const self = this;
		self.toggleShow( false );
	}
	
	ns.List.prototype.length = function() {
		const self = this;
		return self.itemOrder.length;
	}
	
	ns.List.prototype.close = function() {
		const self = this;
		delete self.ontoggle;
		
		self.itemOrder.forEach( remove );
		self.itemOrder = [];
		
		function remove( iid ) {
			self.doRemove( iid );
		}
	}
	
	// PRIVATE
	
	ns.List.prototype.init = function() {
		const self = this;
		self.id = self.id || self.label + '-list-thingie';
		self.build();
		self.bind();
	}
	
	ns.List.prototype.build = function() {
		const self = this;
		const tmplConf = {
			id     : self.id,
			faIcon : self.faIcon,
			label  : self.label,
		};
		const element = hello.template.getElement( 'live-list-tmpl', tmplConf );
		const container = document.getElementById( self.containerId );
		container.appendChild( element );
	}
	
	ns.List.prototype.bind = function() {
		const self = this;
		self.element = document.getElementById( self.id );
		const head = self.element.querySelector( '.list-head' );
		self.itemsContainer = self.element.querySelector( '.list-items' );
		
		self.element.addEventListener( 'transitionend', transend, false );
		head.addEventListener( 'click', toggleShow, false );
		
		function transend( e ) {
			if ( !self.ontoggle )
				return;
			
			if ( 'width' !== e.propertyName )
				return;
			
			self.ontoggle( true );
		}
		
		function toggleShow( e ) {
			e.stopPropagation();
			self.toggleShow();
		}
	}
	
	ns.List.prototype.doAdd = function( el ) {
		var self = this;
		if ( self.items[ el.id ]) {
			console.log( 'List.add - el already added', { el : el, items : self.items });
			return;
		}
		
		self.items[ el.id ] = el;
		self.itemOrder.push( el.id );
		self.itemsContainer.appendChild( el );
		
		self.updateVisibility();
	}
	
	ns.List.prototype.doRemove = function( id ) {
		var self = this;
		var el = self.items[ id ];
		if ( !el ) {
			console.log( 'List.remove - el not found', { id : id, items : self.items });
			return;
		}
		
		const element = document.getElementById( el.id );
		if ( element )
			element.parentNode.removeChild( element );
		
		delete self.items[ id ];
		self.itemOrder = self.itemOrder.filter( notRemoved );
		self.updateVisibility();
		return el;
		
		function notRemoved( itemId ) {
			if ( itemId === id )
				return false;
			return true;
		}
	}
	
	ns.List.prototype.doMove = function( id, index ) {
		var self = this;
		console.log( 'List.move - NYI', { id : id, i : index });
	}
	
	ns.List.prototype.updateVisibility = function() {
		var self = this;
		var hide = !self.itemOrder.length;
		self.toggleHide( hide );
	}
	
	ns.List.prototype.toggleHide = function( hide ) {
		var self = this;
		if ( typeof( hide ) === 'undefined' )
			hide = !self.hide;
		
		self.hide = hide;
		self.element.classList.toggle( 'hide', self.hide );
	}
	
	ns.List.prototype.toggleShow = function( force ) {
		var self = this;
		if ( null == force )
			self.isShow = !self.isShow;
		else
			self.isShow = !!force;
		
		self.element.classList.toggle( 'show', self.isShow );
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
	
	ns.RTCState.prototype.set = function( state ) {
		var self = this;
		var handler = self.typeMap[ state.type ];
		if ( !handler ) {
			console.log( 'unknown state type', state );
			return;
		}
		
		handler( state.data );
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
		var self = this;
		self.typeMap = {
			rtc    : handleRTC,
			stream : handleStream,
			error  : handleError,
		};
		
		function handleRTC( e ) { self.handleRTCState( e ); }
		function handleStream( e ) { self.handleStreamState( e ); }
		function handleError( e ) { self.handleError( e ); }
		
		self.bind();
		
		var rtcIndicator = self.rtcState.parentNode.querySelector( '.state-indicator' );
		self.rtcPing = new library.component.PingBar( rtcIndicator );
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
		self.rtcState = self.mainState
			.querySelector( '.main-rtc-state .state-value' );
		self.streamState = self.mainState
			.querySelector( '.main-stream-state .state-value' );
		self.streamAudio = self.mainState
			.querySelector( '.main-stream-state .state-audio .state-value' );
		self.streamVideo = self.mainState
			.querySelector( '.main-stream-state .state-video .state-value' );
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
				'error' : err,
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
		var self = this;
		var prev = self.currentSpinner;
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
		var self = this;
		if ( 'ping' === event.type ) {
			self.rtcPing.set( event.data );
			return;
		}
		
		self.rtcState.textContent = event.data.state;
		self.setSpinner( 'rtc', event.type );
		
	}
	
	ns.RTCState.prototype.handleStreamState = function( data ) {
		var self = this;
		if ( data.tracks )
			setAudioVideo( data.tracks );
		
		if ( data.constraints )
			updateConstraints( data.constraints );
		
		self.streamState.textContent = data.type;
		var spinLevel = self.getLevel( data.type );
		self.setSpinner( 'stream', spinLevel );
		
		function setAudioVideo( tracks ) {
			if ( tracks.audio )
				self.streamAudio.textContent = tracks.audio.toString();
			if ( tracks.video )
				self.streamVideo.textContent = tracks.video.toString();
		}
		
		function updateConstraints( data ) {
			if ( !data.audio )
				self.streamAudio.textContent = View.i18n('i18n_not_available');
			
			if ( !data.video )
				self.streamVideo.textContent = View.i18n('i18n_not_available');
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
		if ( !pingTime ) {
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
		var self = this;
		var barNum = self.calcBarNum( pingTime );
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
		
		console.log( 'NestedApp', conf );
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

// UI PANE BASE
// Extend this and implement ( minimum ):
// .build() -- replaces .init
(function( ns, undefined ) {
	ns.UIPane = function( conf ) {
		if ( !( this instanceof ns.UIPane ))
			return new ns.UIPane( conf );
		
		var self = this;
		self.id = conf.id;
		self.parentId = conf.parentId;
		self.onpanetoggle = conf.onpanetoggle;
		self.onpaneclose = conf.onpaneclose;
		
		self.paneId = friendUP.tool.uid( self.id + '-pane' );
		self.isVisible = false;
		
		self.init();
	}
	
	// Public
	
	ns.UIPane.prototype.show = function() {
		var self = this;
		if ( self.isVisible ) {
			self.toFront();
			return;
		}
		
		self.isVisible = true;
		self.toggleVisibility();
	}
	
	ns.UIPane.prototype.hide = function() {
		var self = this;
		if ( !self.isVisible )
			return;
		
		self.isVisible = false;
		self.toggleVisibility();
	}
	
	ns.UIPane.prototype.toggle = function() {
		var self = this;
		if ( self.isVisible )
			self.hide();
		else
			self.show();
	}
	
	// call from your close
	ns.UIPane.prototype.paneClose = function() {
		var self = this;
		var element = document.getElementById( self.paneId );
		if ( !element ) {
			console.log( 'no pane element found when closing', {
				id : self.id,
				paneId : self.paneId,
			});
		} else
			element.parentNode.removeChild( element );
			
		var onpaneclose = self.onpaneclose;
		delete self.onpanetoggle;
		delete self.onpaneclose;
		if ( onpaneclose )
			onpaneclose();
	}
	
	// Private
	ns.UIPane.prototype.init = function() {
		var self = this;
		self.build();
	}
	
	ns.UIPane.prototype.insertPane = function( contentHTML ) {
		var self = this;
		var conf = {
			id      : self.paneId,
			content : contentHTML,
		};
		var element = hello.template.getElement( 'base-ui-pane-tmpl', conf );
		var container = document.getElementById( self.parentId );
		container.appendChild( element );
		return element.id;
	}
	
	ns.UIPane.prototype.getElement = function() {
		var self = this;
		var element = document.getElementById( self.paneId );
		if ( !element ) {
			console.log( 'UIPane.getElement - no element found for paneId', self.paneId );
			return null;
		}
		
		return element;
	}
	
	ns.UIPane.prototype.toggleVisibility = function() {
		var self = this;
		var element = self.getElement();
		if ( !element )
			return;
		
		element.classList.toggle( 'hidden', !self.isVisible );
		self.onpanetoggle( self.isVisible );
	}
	
	ns.UIPane.prototype.toFront = function() {
		var self = this;
	}
	
})( library.component );

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
		
		var self = this;
		self.menuConf = paneConf.conf.menuConf;
		
		library.component.UIPane.call( this, paneConf );
	}
	
	ns.MenuPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	// we need some extra .show functionality
	ns.MenuPane.prototype.uiShow = ns.MenuPane.prototype.show;
	ns.MenuPane.prototype.show = function() {
		var self = this;
		self.uiShow();
		self.menu.scrollToTop();
	}
	
	ns.MenuPane.prototype.getMenu = function() {
		var self = this;
		return self.menu;
	}
	
	ns.MenuPane.prototype.close = function() {
		var self = this;
		self.menu.close();
		delete self.menu;
		self.paneClose();
	}
	
	// Private
	
	ns.MenuPane.prototype.build = function() {
		var self = this;
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
		var self = this;
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
		
		var self = this;
		var conf = paneConf.conf;
		self.onclose = conf.onclose;
		self.oncontinue = conf.oncontinue;
		self.onsourceselect = conf.onsourceselect;
		
		library.component.UIPane.call( this, paneConf );
	}
	
	ns.InitChecksPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.InitChecksPane.prototype.updateBrowserCheck = function( state ) {
		var self = this;
		var contentId = 'check-browser';
		var browserId = 'init-check-browser';
		var browserState = {
			type : state.support.type,
			desc : state.browser,
			message : state.support.message,
		};
		
		self.update( browserId, browserState );
		self.showCheck( contentId, state.support );
		updateCaps( state.capabilities );
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
	}
	
	ns.InitChecksPane.prototype.updateHostSignal = function( state ) {
		var self = this;
		var id = 'host-signal';
		self.update( id, state )
		self.showCheck( id, state );
	}
	
	ns.InitChecksPane.prototype.updateRoomSignal = function( state ) {
		var self = this;
		var id = 'room-signal';
		self.update( id, state )
		self.showCheck( id, state );
	}
	
	ns.InitChecksPane.prototype.updateICEServer = function( state ) {
		var self = this;
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
		var self = this;
		var id = 'audio-input';
		var isErr = 'success' !== state.type;
		self.chooseAudio.classList.toggle( 'hidden', !isErr );
		self.update( id, state )
		self.showCheck( id, state );
	}
	
	ns.InitChecksPane.prototype.updateVideoInput = function( state ) {
		var self = this;
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
		var self = this;
		var el = document.getElementById( 'host-signal' );
		el.classList.toggle( 'hidden', false );
	}
	
	ns.InitChecksPane.prototype.showVideoInput = function() {
		var self = this;
		var el = document.getElementById( 'video-input');
		el.classList.toggle( 'hidden', false );
	}
	
	ns.InitChecksPane.prototype.close = function() {
		var self = this;
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
		var self = this;
		self.errorCodes = {
			'ERR_ENUMERATE_DEVICES_FAILED' : View.i18n( 'i18n_err_enumerate_devices_failed' ),
			'ERR_NO_DEVICES_BLOCKED'       : View.i18n( 'i18n_err_devices_blocked' ),
			'ERR_NO_DEVICES_FOUND'         : View.i18n( 'i18n_err_no_devices_found' ),
			'ERR_GUM_NOT_ALLOWED'          : View.i18n( 'i18n_err_gum_not_allowed' ),
			'ERR_GUM_NO_MEDIA'             : View.i18n( 'i18n_err_gum_no_media' ),
		};
		
		self.checks = [
			{
				id     : 'check-browser',
				type   : View.i18n('i18n_browser_compatibility'),
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
		var self = this;
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
		var self = this;
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
		var self = this;
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
		var self = this;
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
		var self = this;
		if ( !state || !state.type )
			return;
		
		if (( 'warning' !== state.type ) && ( 'error' !== state.type ))
			return;
		
		var el = document.getElementById( id );
		var info = el.querySelector( '.init-info' );
		info.classList.toggle( 'hidden', false );
	}
	
	ns.InitChecksPane.prototype.showErrorHandling = function( canContinue ) {
		var self = this;
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
		
		var self = this;
		var conf = paneConf.conf;
		self.permissions = conf.permissions;
		self.onselect = conf.onselect;
		
		self.previewId = 'source-select-preview';
		
		self.sources = null;
		self.currentDevices = null;
		self.selectedDevices = null;
		self.allDevices = null;
		
		self.audioinput = null;
		self.videoinput = null;
		
		library.component.UIPane.call( self, paneConf );
	}
	
	ns.SourceSelectPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.SourceSelectPane.prototype.showDevices = function( currentDevices ) {
		var self = this;
		self.refreshDevices( currentDevices );
	}
	
	ns.SourceSelectPane.prototype.showGetUserMediaError = function( data ) {
		var self = this;
		self.clear();
		var error = 'Failed to attach media: ' + data.err.name;
		var errorElement = document.getElementById( 'source-error' );
		var errorMsg = errorElement.querySelector( '.error-message' );
		errorMsg.innerText = error;
		self.toggleExplain( false );
		self.toggleSelects( false );
	}
	
	ns.SourceSelectPane.prototype.getSelected = function() {
		var self = this;
		var audioDevice = getSelectDevice( self[ self.audioId ]);
		var videoDevice = getSelectDevice( self[ self.videoId ]);
		
		var selected = {
			audioinput : audioDevice,
			videoinput : videoDevice,
		};
		
		return selected;
		
		function getSelectDevice( select ) {
			if ( !select )
				return null;
			
			var label = select.value;
			if ( !label.length )
				return null;
			
			if ( 'none' === label )
				return false;
			
			return label;
		}
	}
	
	ns.SourceSelectPane.prototype.close = function() {
		var self = this;
		delete self.permissions;
		delete self.onselect;
		self.paneClose();
	}
	
	// Private
	
	ns.SourceSelectPane.prototype.build = function() {
		var self = this;
		self.audioId = 'audioinput';
		self.videoId = 'videoinput';
		
		self.sources = new library.rtc.MediaDevices();
		
		var tmplConf = {};
		var html = hello.template.get( 'select-source-tmpl', tmplConf );
		self.insertPane( html );
		
		self.bind();
	}
	
	ns.SourceSelectPane.prototype.bind = function() {
		var self = this;
		self.previewEl = document.getElementById( 'source-select-preview' );
		self.previewEl.preload = 'metadata';
		
		var element = document.getElementById( 'source-select' );
		var closeBtn = document.getElementById( 'source-back' );
		var selectButtons = document.getElementById( 'source-select-buttons' );
		var applyBtn = selectButtons.querySelector( '.apply-select' );
		var refreshBtn = selectButtons.querySelector( '.refresh-select' );
		var discardBtn = selectButtons.querySelector( '.discard-select' );
		
		var errElement = document.getElementById( 'source-error' );
		var errAvailableBtn = errElement.querySelector( '.error-buttons .available' );
		var errIgnoreBtn = errElement.querySelector( '.error-buttons .ignore' );
		
		self.previewEl.onloadedmetadata = letsPlay;
		
		closeBtn.addEventListener( 'click', closeClick, false );
		applyBtn.addEventListener( 'click', applyClick, false );
		refreshBtn.addEventListener( 'click', refreshClick, false );
		discardBtn.addEventListener( 'click', discardClick, false );
		
		errAvailableBtn.addEventListener( 'click', errShowAvailable, false );
		errIgnoreBtn.addEventListener( 'click', errIgnore, false );
		
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
	
	ns.SourceSelectPane.prototype.refreshDevices = function( current ) {
		var self = this;
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
		var self = this;
		console.log( 'SourceSelectPane.showMediaDevicesErr', err );
	}
	
	ns.SourceSelectPane.prototype.clearErrors = function() {
		var self = this;
		self.toggleExplain( true );
		self.toggleSelectError( self.audioId );
		self.toggleSelectError( self.videoId );
	}
	
	ns.SourceSelectPane.prototype.populate = function() {
		var self = this;
		setupAudio();
		setupVideo();
		var selected = self.getSelected();
		self.setPreview( selected );
		
		function setupAudio() {
			var conf = {
				type : self.audioId,
				errType : 'audio',
			};
			setupSelect( conf );
		}
		
		function setupVideo() {
			var conf = {
				type : self.videoId,
				errType : 'video',
			}
			setupSelect( conf );
		}
		
		function setupSelect( conf ) {
			var devices = self.allDevices[ conf.type ];
			var labels = Object.keys( devices );
			
			// no devices available
			if ( !labels.length ) {
				self.toggleSelectError( conf.type, View.i18n('i18n_no_devices_detected'), true );
				return;
			}
			
			// if theres one device and it has an empty label,
			// the device type has been blocked in browser settigns
			if ( labels.length === 1 ) {
				if ( labels[ 0 ] === '' ) {
					self.toggleSelectError( conf.type,
							View.i18n('i18n_devices_detected_unavailable'),
						true );
					return;
				}
			}
			
			// add no select option to the list
			devices[ 'none' ] = {
				label : 'none',
				displayLabel : View.i18n('i18n_no_selection'),
				kind : conf.type,
			}
			
			const select = self.buildSelect( conf.type, devices );
			const containerId = conf.type + '-select';
			const container = document.getElementById( containerId );
			container.appendChild( select );
			self.bindSelect( select );
			self[ conf.type ] = select;
		}
	}
	
	ns.SourceSelectPane.prototype.setPreview = function( selected ) {
		var self = this;
		self.clearPreview();
		
		if ( selected.audioinput ) {
			var aiDev = self.allDevices.audioinput[ selected.audioinput ];
			var audioDeviceId = aiDev.deviceId;
		}
		
		if ( selected.videoinput ) {
			var viDev = self.allDevices.videoinput[ selected.videoinput ];
			var videoDeviceId = viDev.deviceId;
		}
		
		var audioDevice = false;
		var videoDevice = false;
		if ( audioDeviceId )
			audioDevice = { "deviceId" : audioDeviceId };
		
		if ( videoDeviceId )
			videoDevice = { "deviceId" : videoDeviceId };
		
		var mediaConf = {
			audio : audioDevice,
			video : videoDevice,
		};
		
		if ( !mediaConf.audio && !mediaConf.video )
			return;
		
		navigator.mediaDevices.getUserMedia( mediaConf )
			.then( setMedia )
			.catch( mediaErr );
			
		function setMedia( stream ) {
			
			/*
			if ( mediaConf.audio )
				self.checkAudioInput( stream );
			
			*/
			const tracks = stream.getTracks();
			const srcObject = self.previewEl.srcObject;
			if ( !srcObject )
				self.previewEl.srcObject = stream;
			else
				tracks.forEach( add );
			
			self.previewEl.load();
			
			function add( track ) {
				srcObject.addTrack( track );
			}
		}
		
		function mediaErr( err ) {
			console.log( 'preview media failed', err );
		}
	}
	
	ns.SourceSelectPane.prototype.clearPreview = function() {
		var self = this;
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
	
	ns.SourceSelectPane.prototype.checkAudioInput = function( stream ) {
		var self = this;
		var checkEl = document.getElementById( 'audioinput-checking' );
		checkEl.classList.toggle( 'hidden', false );
		new library.rtc.AudioInputDetect( stream, doneBack );
		function doneBack( err ) {
			checkEl.classList.toggle( 'hidden', true );
			if ( !err )
				err = null;
			
			self.toggleSelectError( 'audioinput', err );
		}
	}
	
	ns.SourceSelectPane.prototype.bindSelect = function( element ) {
		var self = this;
		element.addEventListener( 'change', selectChange, false );
		function selectChange( e ) {
			var selected = self.getSelected();
			self.setPreview( selected );
		}
	}
	
	ns.SourceSelectPane.prototype.buildSelect = function( type, obj ) {
		var self = this;
		var options = [];
		for ( var label in obj ) {
			const optStr = buildOption( obj[ label ]);
			options.push( optStr );
		}
		
		var selectConf = {
			type : type,
			name : type,
			optionsHtml : options.join(),
		};
		var selectElement = hello.template.getElement( 'source-select-tmpl', selectConf );
		return selectElement;
		
		function buildOption( item ) {
			var selected = '';
			
			// if there is a device dfined..
			if ( self.currentDevices && self.currentDevices[ item.kind ] ) {
				var currDev = self.currentDevices[ item.kind ];
				// ..check if its this one
				if ( currDev === item.label )
					selected = 'selected';
			} else {
				// ..no device defined, so check if this is the 'no select' entry
				if ( item.label === 'none' )
					selected = 'selected';
			}
			
			var optionConf = {
				value : item.label,
				selected : selected,
				label : item.displayLabel || item.label,
			};
			var html = hello.template.get( 'source-select-option-tmpl', optionConf );
			return html;
		}
	}
	
	ns.SourceSelectPane.prototype.toggleExplain = function( show ) {
		var self = this;
		var explainElement = document.getElementById( 'source-explain' );
		var errorElement = document.getElementById( 'source-error' );
		explainElement.classList.toggle( 'hidden', !show );
		errorElement.classList.toggle( 'hidden', show );
	}
	
	ns.SourceSelectPane.prototype.toggleSelects = function( show ) {
		var self = this;
		var selects = document.getElementById( 'source-input' );
		selects.classList.toggle( 'hidden', !show );
	}
	
	ns.SourceSelectPane.prototype.toggleSelectError = function( type, errorMessage, hideSelect ) {
		var self = this;
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
		var self = this;
		var clear = [
			self.audioId,
			self.videoId,
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
		var self = this;
		self.clearPreview();
		self.hide();
		self.onselect( selected );
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.ChatPane = function( paneConf ) {
		if ( !( this instanceof ns.ChatPane ))
			return new ns.ChatPane( paneConf );
		
		var self = this;
		var conf = paneConf.conf;
		self.userId = conf.userId;
		self.identities = conf.identities;
		self.conn = new library.component.EventNode(
			'chat',
			conf.conn,
			eventSink
		);
		self.teaseUnread = 0;
		
		library.component.UIPane.call( self, paneConf );
		
		function eventSink( e ) { console.log( 'unhandled chat event', e ); }
	}
	
	ns.ChatPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// Public
	
	ns.ChatPane.prototype.msg = function( data ) {
		var self = this;
		self.handleEvent( data );
	}
	
	ns.ChatPane.prototype.baseShow = ns.ChatPane.prototype.show;
	ns.ChatPane.prototype.show = function() {
		const self = this;
		self.baseShow();
		self.bottomScroll.update();
	}
	
	ns.ChatPane.prototype.toggleSay = function( force ) {
		var self = this;
		console.log( 'toggleSay', force );
	}
	
	// Pirvate
	
	ns.ChatPane.prototype.build = function() {
		var self = this;
		var html = hello.template.get( 'chat-pane-tmpl', {});
		self.insertPane( html );
		self.bind();
	}
	
	ns.ChatPane.prototype.bind = function() {
		var self = this;
		// bind close when clicking 'outside' chat
		var chatBg = document.getElementById( self.paneId );
		chatBg.addEventListener( 'click', bgClick, false );
		function bgClick( e ) {
			if ( e.target.id !== self.paneId )
				return;
			
			e.stopPropagation();
			self.hide();
		}
		
		var leConf = {
			templateManager : hello.template,
		};
		self.linkExpand = new library.component.LinkExpand( leConf );
		
		// multiline input
		var inputConf = {
			containerId     : 'input-container',
			templateManager : hello.template,
			singleOnly      : false,
			multiIsOn       : false,
			onsubmit        : onSubmit,
			onmode          : onMode,
		};
		self.input = new library.component.MultiInput( inputConf );
		function onSubmit( e ) { self.submit( e ); };
		function onMode( e ) {};
		
		// input history
		var historyConf = {
			inputId : 'chat-input',
		}
		self.inputHistory = new library.component.InputHistory( historyConf );
		
		// scrollingstuff
		self.bottomScroll = new library.component.BottomScroller( 'chat-messages' );
		
		//
		self.conn.on( 'msg', message );
		self.conn.on( 'state', state );
		self.stateMap = {
			'set-typing'   : setTyping,
			'clear-typing' : clearTyping,
		};
		
		function message( e ) { self.handleMessage( e ); }
		function state( e ) { self.handleState( e ); }
		function setTyping( e ) { self.handleSetTyping( e ); }
		function clearTyping( e ) { self.handleClearTyping( e ); }
		
		self.container = document.getElementById( 'chat-container' );
		self.messages = document.getElementById( 'chat-messages' );
		self.isTypeingHint = self.container.querySelector( '.chat-is-typing' );
		self.sayStateBtn = self.container.querySelector( '.say-state' );
		self.inputHint = self.container.querySelector( '.input-hint' );
		self.inputForm = document.getElementById( 'chat-form' );
		self.inputBtn = document.getElementById( 'chat-send-btn' );
		self.inputArea = document.getElementById( 'chat-input' );
		self.closeBtn = document.getElementById( 'chat-close' );
		
		self.teaseChat = document.getElementById( 'tease-chat' );
		self.teaseContainer = document.getElementById( 'tease-chat-content' );
		self.teaseNum = document.getElementById( 'tease-chat-num' );
		self.teaseGotoBtn = document.getElementById( 'tease-chat-goto-chat' );
		self.teaseClearBtn = document.getElementById( 'tease-chat-clear' );
		
		self.container.addEventListener( 'click', containerClick, false );
		self.sayStateBtn.addEventListener( 'click', toggleSay, false );
		self.inputForm.addEventListener( 'submit', submit, false );
		self.inputBtn.addEventListener( 'click', chatSendClick, false );
		self.closeBtn.addEventListener( 'click', closeChat, false );
		
		self.inputArea.addEventListener( 'focus', inputFocus, false );
		self.inputArea.addEventListener( 'blur', inputBlur, false );
		self.inputArea.addEventListener( 'keydown', inputKeyDown, false );
		self.inputArea.addEventListener( 'keyup', inputKeyUp, false );
		
		self.teaseGotoBtn.addEventListener( 'click', gotoChatClick, false );
		self.teaseClearBtn.addEventListener( 'click', teaseClearClick, false );
		
		function containerClick( e ) { console.log( 'containerClick' ); }
		function toggleSay( e ) { self.toggleSay(); }
		function submit( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.input.submit();
		}
		function chatSendClick( e ) {
			var submit = new Event( 'submit' );
			self.inputForm.dispatchEvent( submit );
		}
		
		function closeChat( e ) { self.hide(); }
		function inputFocus( e ) { self.handleInputFocus( true ); }
		function inputBlur( e ) { self.handleInputFocus( false ); }
		function inputKeyDown( e ) { self.handleInputKey( e ); }
		function inputKeyUp( e ) { self.handleInputKey( e ); }
		
		function gotoChatClick( e ) {
			self.clearTease();
			self.show();
		}
		function teaseClearClick( e ) { self.clearTease(); }
	}
	
	ns.ChatPane.prototype.handleEvent = function( msg ) {
		var self = this;
		var handler = self.chatMap[ msg.type ];
		if ( !handler ) {
			console.log( 'no handler for ', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.ChatPane.prototype.handleMessage = function( msg ) {
		var self = this;
		self.say( msg.message );
		self.addMessage( msg );
	}
	
	ns.ChatPane.prototype.handleState = function( event ) {
		const self = this;
		const handler = self.stateMap[ event.type ];
		if ( !handler ) {
			console.log( '', event );
			return;
		}
	}
	
	ns.ChatPane.prototype.handleSetTyping = function( msg ) {
		var self = this;
		var id = msg.from + '-is-typing';
		var tmplConf = {
			id : id,
			from : msg.from,
		};
		var element = hello.template.getElement( 'is-typing-tmpl', tmplConf );
		self.isTypeingHint.appendChild( element );
	}
	
	ns.ChatPane.prototype.handleClearTyping = function( msg ) {
		var self = this;
		var id = msg.from + '-is-typing';
		var element = document.getElementById( id );
		element.parentNode.removeChild( element );
	}
	
	ns.ChatPane.prototype.say = function( message ) {
		var self = this;
		if ( !self.sayMessages )
			return;
		
		api.Say( message );
	}
	
	ns.ChatPane.prototype.addMessage = function( data ) {
		var self = this;
		var parsedMessage = hello.parser.work( data.message );
		const identity = self.identities[ data.fromId ];
		let from = '';
		if ( identity )
			from = identity.name;
		else
			from = 'Guest > ' + data.name;
		
		if ( self.userId === data.fromId )
			from = '<< You >>';
		
		var time = library.tool.getChatTime( data.time );
		var conf = {
			id      : data.msgId, // TODO : add to template
			from    : from,
			message : parsedMessage,
			time    : time,
		};
		var element = hello.template.getElement( 'message-tmpl', conf );
		self.messages.appendChild( element );
		self.linkExpand.work( element );
		scrollBottom();
		if ( !self.isVisible && ( self.userId !== data.from ))
			self.showTease( conf );
		
		function scrollBottom() {
			self.messages.scrollTop = self.messages.scrollHeight;
		}
	}
	
	ns.ChatPane.prototype.showTease = function( data ) {
		var self = this;
		self.teaseMsg = hello.template.getElement( 'chat-tease-tmpl', data );
		self.teaseContainer.innerHTML = '';
		self.teaseContainer.appendChild( self.teaseMsg );
		self.teaseUnread++;
		self.teaseNum.textContent = '(' + self.teaseUnread + ')';
		self.teaseChat.classList.toggle( 'hidden', false );
	}
	
	ns.ChatPane.prototype.clearTease = function() {
		var self = this;
		self.teaseUnread = 0;
		self.teaseNum.textContent = '';
		self.teaseContainer.innerHTML = '';
		self.teaseChat.classList.toggle( 'hidden', true );
	}
	
	ns.ChatPane.prototype.showPane = ns.ChatPane.prototype.show;
	ns.ChatPane.prototype.show = function() {
		var self = this;
		self.showPane();
		if ( window.View.deviceType && ( 'VR' !== window.View.deviceType ))
			self.input.focus();
	}
	
	ns.ChatPane.prototype.handleInputFocus = function( hasFocus ) {
		var self = this;
		self.inputHasFocus = hasFocus;
		self.inputHint.classList.toggle( 'blink-i', hasFocus );
		
		if ( !hasFocus )
			self.clearIsTyping();
	}
	
	ns.ChatPane.prototype.handleInputKey = function( e ) {
		var self = this;
		if ( self.typingIsSet )
			return;
		
		var value = self.input.getValue();
		//value = self.makeString( value );
		if ( value.length && self.inputHasFocus )
			self.setIsTyping();
		
	}
	
	ns.ChatPane.prototype.makeString = function( str ) {
		var self = this;
		try {
			return str.toString();
		} catch( e ) {
			return null;
		}
	}
	
	ns.ChatPane.prototype.setIsTyping = function() {
		var self = this;
		if ( self.typingIsSet )
			return;
		
		self.typingIsSet = true;
		const setTyping = {
			type : 'set-typing',
			data : null,
		};
		self.sendState( setTyping );
	}
	
	ns.ChatPane.prototype.clearIsTyping = function() {
		var self = this;
		if ( !self.typingIsSet )
			return;
		
		self.typingIsSet = false;
		const clearTyping = {
			type : 'clear-typing',
			data : null,
		};
		self.sendState( clearTyping );
	}
	
	ns.ChatPane.prototype.submit = function( str ) {
		var self = this;
		if ( !str || !str.length )
			return;
		
		str = self.makeString( str );
		if ( !str.length )
			return;
		
		self.clearIsTyping();
		self.sendMessage( str );
		self.inputHistory.add( str );
	}
	
	ns.ChatPane.prototype.sendMessage = function( str ) {
		var self = this;
		var msg = {
			type : 'msg',
			data : {
				message : str,
			},
		};
		self.send( msg );
	}
	
	ns.ChatPane.prototype.sendState = function( event ) {
		var self = this;
		var evnt = {
			type : 'state',
			data : event,
		};
		self.send( evnt );
	}
	
	ns.ChatPane.prototype.send = function( msg ) {
		var self = this;
		self.conn.send( msg );
	}
	
	
})( library.view );

(function( ns, undefined ) {
	ns.SettingsPane = function( paneConf ) {
		if ( !( this instanceof ns.SettingsPane ))
			return new ns.SettingsPane( paneConf );
		
		var self = this;
		var conf = paneConf.conf;
		self.onsave = conf.onsave;
		
		self.settingUpdateMap = {};
		
		library.component.UIPane.call( self, paneConf );
	}
	
	ns.SettingsPane.prototype = Object.create( library.component.UIPane.prototype );
	
	// public
	
	ns.SettingsPane.prototype.update = function( update ) {
		var self = this;
		var handler = self.settingUpdateMap[ update.setting ];
		if ( !handler ) {
			console.log( 'no handler for setting', update );
			return;
		}
		
		handler( update );
	}
	
	ns.SettingsPane.prototype.build = function() {
		var self = this;
		var html = hello.template.get( 'room-settings-pane-tmpl', {});
		self.insertPane( html );
		self.bind();
	}
	
	ns.SettingsPane.prototype.bind = function() {
		var self = this;
		var closeBtn = document.getElementById( 'room-settings-close' );
		closeBtn.addEventListener( 'click', closeClick, false );
		function closeClick( e ) {
			self.hide();
		}
		
		self.bindPeerLimit();
		self.bindIsPublic();
	}
	
	ns.SettingsPane.prototype.bindPeerLimit = function() {
		var self = this;
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
		var self = this;
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

(function( ns, undefined ) {
	ns.AudioVisualizer = function(
		source,
		templateManager,
		containerId
	) {
		const self = this;
		self.source = source;
		self.template = templateManager;
		self.containerId = containerId;
		
		self.id = null;
		self.canvasId = null;
		self.ctx = null;
		self.draw = false;
		self.drawVolume = true;
		
		self.init();
	}
	
	// Public
	
	ns.AudioVisualizer.prototype.start = function() {
		const self = this;
		self.setupCanvas();
		if ( !self.el )
			return;
		
		if ( self.draw )
			return;
		
		self.draw = true;
		self.drawAV();
	}
	
	ns.AudioVisualizer.prototype.stop = function() {
		const self = this;
		self.draw = false;
		if ( self.animFReq )
			window.cancelAnimationFrame( self.animFReq );
		
		self.removeCanvas();
	}
	
	ns.AudioVisualizer.prototype.close = function() {
		const self = this;
		self.stop();
		
		let el = document.getElementById( self.id );
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		//self.releaseSource();
		delete self.id;
		delete self.canvasId;
		delete self.containerId;
		delete self.ctx;
		delete self.source;
		delete self.template;
	}
	
	// Private
	
	ns.AudioVisualizer.prototype.init = function() {
		const self = this;
		self.start();
	}
	
	ns.AudioVisualizer.prototype.setupCanvas = function() {
		const self = this;
		const container = document.getElementById( self.containerId );
		self.id = self.id || friendUP.tool.uid( 'AV' );
		self.canvasId = self.canvasId || friendUP.tool.uid( 'canvas' );
		const conf = {
			id       : self.id,
			canvasId : self.canvasId,
			width    : container.clientWidth,
			height   : container.clientHeight,
		};
		self.el = self.template.getElement( 'peer-av-tmpl', conf );
		container.appendChild( self.el );
		self.el.addEventListener( 'click', click, true );
		function click( e ) {
			self.drawVolume = !self.drawVolume;
			self.drawAV();
		}
		
		var cw = self.el.clientWidth;
		var ch = self.el.clientHeight;
		if ( !ch || !cw ) {
			self.stop();
			return;
		}
		
		self.canvas = document.getElementById( self.canvasId );
		if ( !self.canvas ) {
			self.stop();
			return;
		}
		
		// anim setup
		self.ctx = self.canvas.getContext( '2d' );
		if ( !self.ctx ) {
			self.stop();
			return;
		}
		
		self.cW = self.ctx.canvas.clientWidth;
		self.cH = self.ctx.canvas.clientHeight;
		self.ctx.lineWidth = 3;
		self.ctx.lineCap = 'round';
	}
	
	ns.AudioVisualizer.prototype.removeCanvas = function() {
		const self = this;
		delete self.cW;
		delete self.cH;
		delete self.ctx;
		if ( self.canvas )
			self.canvas.parentNode.removeChild( self.canvas );
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.canvas;
		delete self.el;
	}
	
	ns.AudioVisualizer.prototype.drawAV = function() {
		const self = this;
		if ( !self.ctx )
			return;
		
		if ( self.animFReq ) {
			cancelAnimationFrame( self.animFReq );
			self.animFReq = null;
		}
		
		if ( self.drawVolume )
			self.updateVolume();
		else
			self.updateWaveform();
	}
	
	ns.AudioVisualizer.prototype.updateVolume = function() {
		const self = this;
		self.animFReq = window.requestAnimationFrame( loop );
		function loop() {
			if ( !self.draw || !self.drawVolume )
				return;
			
			self.animFReq = window.requestAnimationFrame( loop );
			redraw();
		}
		
		function redraw() {
			if ( !self.source.averageOverTime )
				return;
			
			let buf = self.source.averageOverTime.slice( -18 );
			if ( !buf || !buf.length ) {
				console.log( 'AV - invalid volumeHistory', self.source );
				return;
			}
			
			self.clearCanvas();
			let  stepLength = ( self.cW * 1.0  ) / buf.length;
			
			// move line to pos
			let len = buf.length;
			let i = buf.length;
			for( ; i-=3 ; ) {
				self.ctx.beginPath();
				let alpha = i / len;
				if ( alpha > 1 )
					alpha = 1;
				self.ctx.strokeStyle = 'rgba( 255, 255, 255, ' + alpha + ')';
				let v1 = buf[ i ];
				let v2 = buf[ i - 3 ];
				let y1 = self.cH - (( v1 / 128.0 ) * self.cH );
				let y2 = self.cH - (( v2 / 128.0 ) * self.cH );
				y1+=1;
				y2+=1;
				let x1 = ( i * stepLength );
				let x2 = (( i - 3 ) * stepLength );
				self.ctx.moveTo( x1, y1 );
				self.ctx.lineTo( x2, y2 );
				self.ctx.stroke();
			}
		}
	}
	
	ns.AudioVisualizer.prototype.updateWaveform = function() {
		const self = this;
		self.ctx.strokeStyle = 'white';
		self.animFReq = window.requestAnimationFrame( loop );
		function loop() {
			if ( !self.draw || self.drawVolume )
				return;
			
			self.animFReq = window.requestAnimationFrame( loop );
			redraw();
		}
		
		function redraw() {
			let buf = self.source.timeBuffer;
			if ( !buf || !buf.length ) {
				console.log( 'AV - invalid time buffer', self.source );
				return;
			}
			
			self.clearCanvas();
			self.ctx.beginPath();
			let stepLength = ( self.cW * 1.0 ) / buf.length;
			
			// move line to pos
			let i = buf.length;
			for ( ; i-- ; ) {
				let value = buf[ i ];
				let y = ( value / 128.0 ) * ( self.cH / 2.0 );
				let x = ( self.cW - ( i * stepLength ));
				if ( i === buf.length )
					self.ctx.moveTo( x, y );
				else
					self.ctx.lineTo( x, y );
			}
			
			self.ctx.stroke();
		}
	
	}
	
	ns.AudioVisualizer.prototype.clearCanvas = function() {
		const self = this;
		if ( !self.ctx )
			return;
		
		self.ctx.clearRect( 0, 0, self.cW, self.cH );
	}
	
	/*
	ns.AudioVisualizer.prototype.connectSource = function() {
		const self = this;
		console.log( 'connectSource' );
		if ( !self.source )
			throw new Error( 'AudioVisualizer.connectSource - \
				no source, called after .close?' );
		
		self.bufferId = self.source.on( '')
	}
	
	ns.AudioVisualizer.prototype.disconnectSource = function() {
		const self = this;
		console.log( 'releaseSource', self.source );
		if ( !self.source )
			return;
		
		if ( self.bufferId )
			self.source.off( self.bufferId );
		
		if ( self.volumeId )
			self.source.off( self.volumeId );
		
	}
	*/
	
})( library.view );


// INIT -------------------
if ( !window.View )
	throw new Error( 'window.View is not defined' );

window.View.run = fun;
function fun() {
	window.live = new library.view.LiveInit();
}
