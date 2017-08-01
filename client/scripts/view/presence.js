'use strict';

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

var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.view = library.view || {};

(function( ns, undefined ) {
	ns.Presence = function( fupConf ) {
		if ( !( this instanceof ns.Presence ))
			return new ns.Presence( fupConf );
		
		const self = this;
		self.conn = window.View;
		
		self.name = null;
		self.ownerId = null;
		self.userId = null;
		self.users = {};
		self.onlineList = [];
		
		self.init();
	}
	
	ns.Presence.prototype.init = function() {
		const self = this;
		View.setBody();
		
		// user groups
		self.online = new library.component.ItemGroup(
			'online',
			'online',
			'online-users',
			'Accept',
			self.users
		);
		self.offline = new library.component.ItemGroup(
			'offline',
			'offline',
			'offline-users',
			'',
			self.users
		);
		self.guest = new library.component.ItemGroup(
			'guest',
			'guests',
			'guest-users',
			'Available',
			self.users
		);
		
		// groups
		self.userGroups = {
			'online'  : self.online,
			'offline' : self.offline,
			'guest'   : self.guest,
		};
		
		// scroll to bottom on new message
		self.messageScroller = new library.component.BottomScroller( 'messages' );
		
		// highlight
		self.highlight = new library.component.Highlight({
			cssClass : 'Highlight',
			listener : handleHighlight,
		});
		
		function handleHighlight( e ) {
			self.send({
				type : 'highlight',
				data : e,
			});
		}
		
		// drag and drop handler
		var dropConf = {
			targetId : 'hello',
			ondrop : onDrop,
		}
		self.drop = new library.component.Drop( dropConf );
		function onDrop( event ) { self.send( event ); }
		
		//
		self.bindUI();
		self.bindConn();
		
		//
		self.conn.loaded();
	}
	
	// ui
	
	ns.Presence.prototype.bindUI = function() {
		const self = this;
		// buttons?
		self.goVideoBtn = document.getElementById( 'upgrade-to-video' );
		self.goAudioBtn = document.getElementById( 'upgrade-to-audio' );
		
		// user list things
		self.usersEl = document.getElementById( 'users-container' );
		self.adminsEl = document.getElementById( 'admin-users' );
		self.onlineEl = document.getElementById( 'online-users' );
		self.guestsEl = document.getElementById( 'guest-users' );
		self.offlineEl = document.getElementById( 'offline-users' );
		self.detachedEl = document.getElementById( 'detached' );
		self.toggleUsersBtn = document.getElementById( 'show-hide-btn' );
		
		// chat things
		//self.messagesEl = document.getElementById( 'messages' );
		const emoPanelBtn = document.getElementById( 'emojii-panel-button' );
		const inputForm = document.getElementById( 'input-form' );
		
		self.goVideoBtn.addEventListener( 'click', goVideoClick, false );
		self.goAudioBtn.addEventListener( 'click', goAudioClick, false );
		
		self.toggleUsersBtn.addEventListener( 'click', toggleUserList, false );
		emoPanelBtn.addEventListener( 'click', toggleEmoPanel, false );
		inputForm.addEventListener( 'submit', inputSubmit, false );
		
		function goVideoClick( e ) {
			self.goLive( 'video' ); }
		function goAudioClick( e ) { self.goLive( 'audio' ); }
		
		function toggleUserList( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.toggleUserList();
		}
		
		function toggleEmoPanel( e ) {
			self.emojiis.show();
		}
		
		// TODO : this should be moved to multiline input. The entire input form actually
		function inputSubmit( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.input.submit(); // input is multiline input model
		}
	}
	
	ns.Presence.prototype.goLive = function( type ) {
		const self = this;
		const goLive = {
			type : 'live-upgrade',
			data : type,
		};
		self.send( goLive );
	}
	
	ns.Presence.prototype.toggleUserList = function() {
		const self = this;
		self.usersEl.classList.toggle( 'users-hide' );
		self.toggleUsersBtn.classList.toggle( 'danger' );
	}
	
	// conn
	
	ns.Presence.prototype.bindConn = function() {
		const self = this;
		self.conn.on( 'initialize', initialize );
		self.conn.on( 'online', online );
		self.conn.on( 'offline', offline );
		self.conn.on( 'chat', chat );
		self.conn.on( 'live', live );
		self.conn.on( 'join', join );
		self.conn.on( 'leave', leave );
		self.conn.on( 'identity', identity );
		
		function initialize( e ) { self.handleInitialize( e ); }
		function chat( e ) { self.handleChat( e ); }
		function online( e ) { self.handleOnline( e, true ); }
		function offline( e ) { self.handleOnline( e, false ); }
		function live( e ) { self.handleLive( e ); }
		function join( e ) { self.addUser( e ); }
		function leave( e ) { self.removeUser( e ); }
		function identity( e ) { self.updateIdentity( e ); }
	}
	
	ns.Presence.prototype.handleInitialize = function( conf ) {
		const self = this;
		friend.template.addFragments( conf.fragments );
		const state = conf.state;
		// things
		self.name = state.roomName;
		self.ownerId = state.ownerId;
		self.userId = state.userId;
		
		// set online
		self.onlineList = state.onlineList;
		
		// add users
		state.users.forEach( addUser );
		function addUser( user ) { self.addUser( user ); }
		self.user = self.users[ self.userId ];
		
		// set peers live
		state.peers.forEach( setLive );
		function setLive( uid ) {
			const user = self.users[ uid ];
			if ( !user )
				return;
			
			user.setState( 'live' );
		}
		
		// get logs when scrolling to top
		self.logFetcher = new library.component.LogFetcher(
			'message-container',
			'messages',
			friend.template,
			onFetch
		);
		function onFetch() {
			const firstMsgId = self.msgBuilder.getFirstMsgId();
			const logFrom = {
				type : 'log',
				data : {
					startId : firstMsgId,
				},
			};
			self.sendChatEvent( logFrom );
		}
		
		// link expansion
		const leConf = {
			templateManager : friend.template,
		}
		self.linkExpand = new library.component.LinkExpand( leConf );
		
		// message parsing
		self.parser = new library.component.parse.Parser();
		self.parser.use( 'LinkStd' );
		self.parser.use( 'Emojii', conf.emojii );
		
		// message builder
		self.msgBuilder = new library.component.MsgBuilder(
			'messages',
			self.userId,
			self.users,
			self.parser,
			self.linkExpand,
			friend.template
		);
		
		// multiline input
		const inputConf = {
			containerId     : 'input-container',
			templateManager : friend.template,
			onsubmit        : onSubmit,
			onstate         : onState,
		};
		self.input = new library.component.MultiInput( inputConf );
		function onSubmit( message ) {
			self.inputHistory.add( message );
			const msg = {
				type : 'msg',
				data : {
					message : message,
				},
			};
			self.sendChatEvent( msg );
		}
		
		function onState( event ) {
			const state = {
				type: 'state',
				data : event,
			};
			self.sendChatEvent( state );
		}
		
		// input history
		const hConf = {
			inputId : 'chat-input',
		};
		self.inputHistory = new library.component.InputHistory( hConf );
		
		// tab complete
		const inputArea = document.getElementById( 'chat-input' );
		inputArea.addEventListener( 'keydown', inputKeyDown, false );
		function inputKeyDown( e ) {
			self.checkAutoComplete( e );
		}
		
		// emojii panel
		const emoElementMap = {};
		Object.keys( conf.emojii ).forEach( parseToMap );
		function parseToMap( key ) {
			let el = self.parser.work( key );
			emoElementMap[ key ] = el;
		}
		
		self.emojiis = new library.component.EmojiiPanel(
			//'emojii-panel-button',
			'foot',
			friend.template,
			emoElementMap,
			onEmojii
		);
		function onEmojii( str ) {
			self.input.add( ' ' + str );
			self.input.focus();
		}
		
		// dont focus input if VR device / mode
		if ( 'VR' !== window.View.deviceType )
			self.input.focus();
		
		self.conn.ready();
		self.sendChatEvent({
			type : 'log',
			data : null,
		});
	}
	
	ns.Presence.prototype.handleOnline = function( userId, isOnline ) {
		const self = this;
		const user = self.users[ userId ];
		// not in online or offline groups, aka guest, admin or whatever
		if (( 'online' !== user.group ) && ( 'offline' !== user.group ))
			return;
		
		if ( isOnline )
			self.addToGroup( 'online', userId );
		else
			self.addToGroup( 'offline', userId );
	}
	
	ns.Presence.prototype.handleChat = function( event ) {
		const self = this;
		if ( 'msg' === event.type )
			self.msgBuilder.handle( event );
		
		if ( 'state' === event.type )
			self.setChatState( event.data );
		
		if ( 'log' === event.type )
			self.handleLog( event.data );
	}
	
	ns.Presence.prototype.handleLog = function( items ) {
		const self = this;
		if ( null == items ) {
			self.logFetcher.unlock();
			self.logFetcher.setNoLogs( true );
			return;
		}
		
		self.msgBuilder.handle({
			type : 'log',
			data : items
		});
		self.logFetcher.unlock();
	}
	
	ns.Presence.prototype.setChatState = function( event ) {
		const self = this;
		const user = self.users[ event.fromId ];
		if ( !user )
			return;
		
		if ( user.state && ( 'typing' !== user.state ))
			return;
		
		let state = '';
		if ( 'set-typing' === event.state.type )
			state = 'typing';
		
		user.setState( state );
	}
	
	ns.Presence.prototype.handleLive = function( event ) {
		const self = this;
		if ( !event.data || !event.data.peerId )
			return;
		
		const user = self.users[ event.data.peerId ];
		let state = '';
		if ( 'join' === event.type )
			state = 'live';
		
		user.setState( state );
	}
	
	// things
	
	ns.Presence.prototype.addUser = function( user ) {
		const self = this;
		const uid = user.clientId;
		if ( null != self.users[ uid ] ) {
			console.log( 'view.presence.addUser - user already present ( hueuhueh )', {
				user  : user,
				users : self.users,
			});
			return;
		}
		
		//self.users[ uid ] = user;
		const name = user.name;
		const avatar = user.avatar || '';
		const itemConf = {
			id     : uid,
			name   : name,
			avatar : avatar,
			state  : '',
		};
		const userItem = new library.component.GroupItem( itemConf, friend.template );
		self.users[ uid ] = userItem;
		self.addUserCss( userItem.id, userItem.avatar );
		
		if ( user.guest )
			userItem.group = 'guest';
		else {
			if ( isOnline( uid ))
				userItem.group = 'online';
			else
				userItem.group = 'offline';
		}
		
		self.addToGroup( userItem.group, userItem.id );
		
		function isOnline( uid ) {
			const index = self.onlineList.indexOf( uid );
			if ( -1 !== index )
				return true;
			else
				return false;
		}
	}
	
	ns.Presence.prototype.removeUser = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'view.presence.removeUser - no user for id', {
				uid : userId,
				users : self.users,
			});
			return;
		}
		
		self.removeFromGroup( userId );
		delete self.users[ userId ];
	}
	
	ns.Presence.prototype.updateIdentity = function( id ) {
		const self = this;
		console.log( 'updateIdentity', id );
	}
	
	ns.Presence.prototype.addUserCss = function( clientId, avatar ) {
		const self = this;
		const container = document.getElementById( 'user-css' );
		const cssConf = {
			clientId : clientId,
			avatar   : avatar,
		};
		const cssEl = friend.template.getElement( 'user-css-tmpl', cssConf );
		container.appendChild( cssEl );
	}
	
	ns.Presence.prototype.setOnlineList = function( onlineList ) {
		const self = this;
		console.log( 'presence.setOnlineList', onlineList );
	}
	
	ns.Presence.prototype.addToGroup = function( groupType, userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'addToGroup - no user for id', {
				uid   : userId,
				users : self.users,
			});
			return;
		}
		
		if ( user.group && ( user.group !== groupType ))
			detachFromGroup( user );
		
		const group = self.userGroups[ groupType ];
		if ( !group ) {
			console.log( 'addToGroup - invalid groupType', {
				type   : groupType,
				groups : self.userGroups,
			});
			return;
		}
		
		group.attach( user.id );
		
		function detachFromGroup( user ) {
			const detachGrp = self.userGroups[ user.group ];
			if ( !detachGrp )
				return;
			
			detachGrp.detach( user.id );
		}
	}
	
	ns.Presence.prototype.removeFromGroup = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( ' removeFromGroup - no user', {
				uid   : userId,
				users : Object.keys( self.users ),
			});
			return;
		}
		
		const group = self.userGroups[ user.group ];
		if ( !group ) {
			console.log( 'removeFromGroup - no group for user', {
				user   : user,
				groups : Object.keys( self.userGroups ),
			});
			return;
		}
		
		group.remove( userId );
	}
	
	ns.Presence.prototype.checkAutoComplete = function( e ) {
		const self = this;
		var key = e.code || e.key;
		if ( 'Tab' !== key )
			return;
		
		if (
			e.shiftKey ||
			e.ctrlKey ||
			e.altKey ||
			e.repeat
		) {
			return;
		}
		
		console.log( 'checkAutoComplete', e );
	}
	
	ns.Presence.prototype.sendChatEvent = function( event ) {
		const self = this;
		const wrap = {
			type : 'chat',
			data : event,
		};
		self.send( wrap );
	}
	
	ns.Presence.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.sendMessage( event );
	}
	
	ns.Presence.prototype.close = function() {
		const self = this;
		console.log( 'view.presence.close', self );
	}
	
})( library.view );


// ItemGroup
(function( ns, undefined ) {
	ns.ItemGroup = function(
		type,
		sectionId,
		containerId,
		panelKlass,
		itemSource
	) {
		const self = this;
		self.type = type;
		self.sectionId = sectionId;
		self.containerId = containerId;
		self.itemSource = itemSource;
		self.panelKlass = panelKlass;
		
		self.items = {};
		self.itemList = [];
		
		self.init();
	}
	
	// Public
	
	ns.ItemGroup.prototype.setList = function( idList ) {
		const self = this;
		console.log( 'ItemGroup.setList', idList );
	}
	
	ns.ItemGroup.prototype.attach = function( id ) {
		const self = this;
		const item = self.itemSource[ id ];
		if ( !item ) {
			console.log( 'ItemGroup.attach - no item for id', {
				id : id,
				items : self.itemSource,
			});
			return false;
		}
		
		
		item.group = self.type;
		if ( self.items[ id ])
			return;
		
		self.items[ id ] = item;
		self.itemList.push( id );
		self.sort( id );
		self.reorder( id );
		self.updateVisible();
		return item;
	}
	
	ns.ItemGroup.prototype.detach = function( id ) {
		const self = this;
		const item = self.items[ id ];
		if ( !item ) {
			console.log( 'ItemGroup.attach - no item for id', {
				id : id,
				items : self.items,
			});
			return null;
		}
		
		item.group = null;
		delete self.items[ id ];
		self.itemList = self.itemList.filter( notId );
		self.updateVisible();
		return item;
		
		function notId( itemId ) {
			return itemId !== id;
		}
	}
	
	ns.ItemGroup.prototype.remove = function( id ) {
		const self = this;
		const item = self.detach( id );
		if ( !item || !item.el )
			return false;
		
		const el = item.el;
		el.parentNode.removeChild( el );
		return item;
	}
	
	// Private
	
	ns.ItemGroup.prototype.init =  function() {
		const self = this;
		self.el = document.getElementById( self.sectionId );
		const header = self.el.querySelector( '.section-head' );
		if ( header && self.panelKlass )
			header.classList.add( self.panelKlass );
		
		self.container = document.getElementById( self.containerId );
		if ( !self.container )
			throw new Error( 'ItemGroup.init - invalid id: ' + self.containerId );
		
		self.container.textContent = '';
		self.updateVisible();
	}
	
	ns.ItemGroup.prototype.updateVisible = function() {
		const self = this;
		const hasItems = !!self.itemList.length;
		self.el.classList.toggle( 'hidden', !hasItems );
	}
	
	ns.ItemGroup.prototype.sort = function( id ) {
		const self = this;
		self.itemList.sort( byName );
		function byName( idA, idB ) {
			let a = self.items[ idA ];
			let b = self.items[ idB ];
			let ni = 0; // name character index
			let res = 0;
			do {
				res = compare( a, b, ni );
				ni++;
			} while ( res === 0 );
			
			return res;
			
			function compare( a, b, ni ) {
				let aN = a.name[ ni ];
				let bN = b.name[ ni ];
				if ( aN === bN )
					return 0;
				
				if ( aN < bN )
					return -1;
				else
					return 1;
			}
		}
	}
	
	ns.ItemGroup.prototype.reorder = function( id ) {
		const self = this;
		if ( id )
			reorderItem( id );
		else
			applyListOrder();
		
		function reorderItem( id ){
			const item = self.items[ id ];
			if ( !item || !item.el )
				return;
			
			const index = self.itemList.indexOf( id );
			if ( -1 === index ) {
				throw new Error( 'did you forget to add the id to the itemList?' );
			}
			
			if (( index + 1 ) === self.itemList.length ) {
				// id is last item in the list
				self.container.appendChild( item.el );
				return;
			}
			
			const beforeIndex = index + 1; // before is the item we will insert before
			const beforeId = self.itemList[ beforeIndex ];
			const beforeItem = self.items[ beforeId ];
			const beforeEl = beforeItem.el || null; // better safe than sorry
			self.container.insertBefore( item.el, beforeEl );
		}
		
		function applyListOrder() {
			self.itemList.forEach( append );
			function append( id ) {
				const item = self.items[ id ];
				if ( !item || item.el )
					return;
				
				self.container.appendChild( item.el );
			}
		}
	}
	
})( library.component );


// GroupItem
(function( ns, undefined ) {
	ns.GroupItem = function( conf, tmplManager ) {
		const self = this;
		self.id = conf.id;
		self.name = conf.name;
		self.avatar = conf.avatar;
		self.state = conf.state;
		friend.template = tmplManager;
		
		self.el = null;
		self.group = null;
		
		self.init();
	}
	
	// Public
	
	ns.GroupItem.prototype.updateName = function( name ) {
		const self = this;
		console.log( 'updateName', name );
	}
	
	ns.GroupItem.prototype.setState = function( type ) {
		const self = this;
		type = type || '';
		self.state = type;
		const classStr = self.states[ type ] || '';
		self.stateEl.className = 'fa fa-fw ' + classStr;
	}
	
	ns.GroupItem.prototype.close = function() {
		const self = this;
		delete friend.template;
		delete self.group;
		delete self.el;
	}
	
	// Private
	
	ns.GroupItem.prototype.states = {
		'typing' : 'fa-keyboard-o',
		'live'   : 'fa-video-camera',
	}
	
	ns.GroupItem.prototype.init = function( conf, tmplId ) {
		const self = this;
		self.el = buildElement();
		self.stateEl = self.el.querySelector( '.state > i' );
		const detached = document.getElementById( 'detached' );
		detached.appendChild( self.el );
		
		function buildElement() {
			const conf = {
				id     : self.id,
				name   : self.name,
				state  : '',
			};
			const el = friend.template.getElement( 'user-list-item-tmpl', conf );
			return el;
		}
		
	}
	
	
})( library.component );


// MsgBuilder
(function( ns, undefined ) {
	ns.MsgBuilder = function(
		containerId,
		userId,
		users,
		parser,
		linkExpand,
		templateManager
	) {
		const self = this;
		self.containerId = containerId;
		self.users = users;
		self.userId = userId;
		self.parser = parser || null;
		self.linkEx = linkExpand || null;
		friend.template = templateManager;
		
		self.envelopes = {};
		self.envelopeOrder = [];
		
		self.init();
	}
	
	// Public
	
	ns.MsgBuilder.prototype.handle = function( event ) {
		const self = this;
		const handler = self.eventMap[ event.type ];
		if ( !handler ) {
			console.log( 'MsgBuilder.handle - no handler for event', {
				e : event,
				h : self.eventMap,
			});
			return null;
		}
		
		return handler( event.data );
	}
	
	ns.MsgBuilder.prototype.getFirstMsgId = function() {
		const self = this;
		if ( !self.envelopeOrder.length )
			return null;
		
		const firstEnvelopeId = self.envelopeOrder[ 0 ];
		const firstEnvelope = self.envelopes[ firstEnvelopeId ];
		return firstEnvelope.firstMsgId || null;
	}
	
	ns.MsgBuilder.prototype.close = function() {
		const self = this;
		delete self.userId;
		delete self.users;
		delete self.parser;
		delete self.linkEx;
		delete friend.template;
	}
	
	// Private
	
	ns.MsgBuilder.prototype.logKlass = 'LogText';
	ns.MsgBuilder.prototype.tmplMap = {
		'msg-group'    : 'msg-group-tmpl',
		'msg'          : 'msg-tmpl',
		'action'       : 'action-tmpl',
		'notification' : 'chat-notie-tmpl',
	}
	
	ns.MsgBuilder.prototype.init = function() {
		const self = this;
		self.container = document.getElementById( self.containerId );
		if ( !self.container )
			throw new Error( 'MsgBuilder.init - container element not found for id: '
				+ self.containerId );
		
		if ( !self.users || !friend.template ) {
			console.log( 'MsgBuilder - missing things', self );
			throw new Error( 'MsgBuilder - missing things ^^^' );
		}
		
		self.eventMap = {
			'msg'          : msg,
			'action'       : action,
			'notification' : notie,
			'log'          : log,
		};
		
		function msg( e ) { return self.handleMsg( e ); }
		function action( e ) { return self.handleAction( e ); }
		function notie( e ) { return self.handleNotie( e ); }
		function log( e ) { return self.handleLog( e ); }
		
		self.logMap = {
			'msg'          : logMsg,
			'action'       : logAction,
			'notification' : logNotie,
		};
		
		function logMsg( e ) { return self.buildMsg( e ); }
		function logAction( e ) { return self.buildAction( e ); }
		function logNotie( e ) { return self.buildNotie( e ); }
	}
	
	ns.MsgBuilder.prototype.exists = function( msgId ) {
		const self = this;
		const el = document.getElementById( msgId );
		return !!el;
	}
	
	ns.MsgBuilder.prototype.handleMsg = function( event ) {
		const self = this;
		if ( self.exists( event.msgId ))
			return;
		
		const time = self.parseTime( event.time );
		const envelope = self.getEnvelope( time.envelope );
		event.time = time.time;
		const conf = {
			inGroup : self.isLastSpeaker( event, envelope ),
			event   : event,
		};
		
		const el = self.buildMsg( conf );
		envelope.lastSpeakerId = event.fromId;
		self.addItem( el, envelope );
		return el;
	}
	
	ns.MsgBuilder.prototype.handleAction = function( event ) {
		const self = this;
		
		return el;
	}
	
	ns.MsgBuilder.prototype.handleNotie = function( event ) {
		const self = this;
		
		return el;
	}
	
	ns.MsgBuilder.prototype.handleLog = function( items ) {
		const self = this;
		var lastSpeakerId = null;
		var lastIndex = ( items.length - 1 );
		var prevEnvelope = null;
		var firstMsgId = null;
		items.forEach( handle );
		function handle( item, index ) {
			const handler = self.logMap[ item.type ];
			if ( !handler ) {
				console.log( 'no handler for event', item );
				return;
			}
			
			const event = item.data;
			if ( self.exists( event.msgId ))
				return;
			
			// 
			if ( null == firstMsgId )
				firstMsgId = event.msgId;
			
			let time = self.parseTime( event.time );
			let envelope = self.getEnvelope( time.envelope );
			if ( prevEnvelope && ( envelope.id !== prevEnvelope.id )) {
				lastSpeakerId = null;
				prevEnvelope.firstMsgId = firstMsgId;
				prevEnvelope = envelope;
			}
			
			event.time = time.time;
			let isPrevSpeaker = (( null != event.fromId ) &&
			                    ( lastSpeakerId === event.fromId ));
			
			let conf = {
				inGroup : isPrevSpeaker,
				event   : event,
			};
			
			let el = handler( conf );
			self.addLogItem( el, envelope );
			
			lastSpeakerId = event.fromId;
			
			if ( index === lastIndex )
				envelope.firstMsgId = firstMsgId;
			
			prevEnvelope = envelope;
		}
		//return el;
	}
	
	ns.MsgBuilder.prototype.isLastSpeaker = function( event, envelope ) {
		const self = this;
		if ( null == envelope.lastSpeakerId )
			return false;
		
		return event.fromId === envelope.lastSpeakerId;
	}
	
	ns.MsgBuilder.prototype.addItem = function( el, envelope ) {
		const self = this;
		if ( null == envelope.firstMsgId )
			envelope.firstId = el.id;
		
		envelope.el.appendChild( el );
	}
	
	ns.MsgBuilder.prototype.addLogItem = function( el, envelope ) {
		const self = this;
		const before = document.getElementById( envelope.firstMsgId );
		envelope.el.insertBefore( el, before );
	}
	
	ns.MsgBuilder.prototype.buildMsg = function( conf ) {
		const self = this;
		const tmplId =  conf.inGroup ? 'msg-tmpl' : 'msg-group-tmpl';
		const event = conf.event;
		const uid = event.fromId;
		const user = self.users[ uid ];
		
		const mId = event.msgId || '';
		const time = event.time;
		let name = '';
		if ( user )
			name = user.name;
		else
			name = 'Guest > ' + event.name;
		
		let userKlass = uid + '-klass';
		let itemKlass = 'sw1';
		if ( uid === self.userId ) {
			name = '<< You >>';
			itemKlass = 'sw2';
		}
		
		let message = event.message;
		if ( self.parser )
			message = self.parser.work( message );
		
		const msgConf = {
			msgId     : mId,
			userKlass : userKlass,
			itemKlass : itemKlass,
			from      : name,
			time      : time,
			message   : message,
		};
		const el = friend.template.getElement( tmplId, msgConf );
		if ( self.linkEx )
			self.linkEx.work( el );
		
		return el;
	}
	
	ns.MsgBuilder.prototype.buildAction = function() {
		const self = this;
	}
	
	ns.MsgBuilder.prototype.buildNotie = function() {
		const self = this;
	}
	
	ns.MsgBuilder.prototype.getEnvelope = function( envConf ) {
		const self = this;
		let envelope = self.envelopes[ envConf.id ];
		if ( envelope )
			return envelope;
		
		envelope = envConf;
		const el = friend.template.getElement( 'time-envelope-tmpl', envConf );
		envelope.el = el;
		self.envelopes[ envelope.id ] = envelope;
		self.envelopeOrder.push( envelope.id );
		self.envelopeOrder.sort( oldFirst );
		const index = self.envelopeOrder.indexOf( envelope.id );
		const beforeId = self.envelopeOrder[( index + 1 )] || null;
		let beforeEl = null;
		if ( beforeId )
			beforeEl = document.getElementById( beforeId );
		
		self.container.insertBefore( envelope.el, beforeEl );
		return envelope;
		
		function oldFirst( idA, idB ) {
			let a = self.envelopes[ idA ];
			let b = self.envelopes[ idB ];
			if ( a.order > b.order )
				return 1;
			else
				return -1;
		}
	}
	
	ns.MsgBuilder.prototype.parseTime = function( timestamp ) {
		const self = this;
		const time = new Date( timestamp );
		if ( !time )
			return null;
		
		const tokens = {
			time       : getClockStamp( time ),
			date       : getDateStamp( time ),
			envelope   : getEnvelope( time ),
			timestamp  : timestamp,
		};
		
		return tokens;
		
		//
		function getClockStamp( time ) {
			let str = ''
				+ pad( time.getHours()) + ':'
				+ pad( time.getMinutes()) + ':'
				+ pad( time.getSeconds());
			return str;
		}
		
		function getDateStamp( time ) {
			return time.toLocaleDateString();
		}
		
		function getEnvelope( time ) {
			const order = parseInt( getTimeStr( time ), 10 );
			const id = 'envelope-' + order.toString();
			const envelope = {
				id    : id,
				date  : '',
				order : order,
			};
			
			const now = new Date();
			const today = parseInt( getTimeStr( now ), 10 );
			const yesterday = today - 1;
			const isToday = order === today;
			const isYesterday = ( order === yesterday );
			
			
			if ( isToday ) {
				envelope.date = 'Today';
				return envelope;
			}
			
			if ( isYesterday ) {
				envelope.date = 'Yesterday';
				return envelope;
			}
			
			envelope.date = time.toLocaleDateString();
			return envelope;
			
			function getTimeStr( time ) {
				let str = ''
				+ pad( time.getFullYear())
				+ pad(( time.getMonth() + 1 ))
				+ pad( time.getDate());
				return str;
			}
			
			function getYesterday( today ) {
				const date = new Date();
				date.setDate( today - 1 );
				return date;
			}
		}
		
		function pad( time ) {
			var str = time.toString();
			return 1 !== str.length ? str : '0' + str;
		}
	}
	
	
})( library.component );


// emojii panel
(function( ns, undefined ) {
	ns.EmojiiPanel = function(
		parentId,
		templateManager,
		emojiiMap,
		onemojii
	) {
		const self = this;
		
		self.parentId = parentId;
		friend.template = templateManager;
		self.emojiiMap = emojiiMap;
		self.onemojii = onemojii;
		
		self.el = null;
		
		self.init();
	}
	
	// Public
	
	ns.EmojiiPanel.prototype.show = function() {
		const self = this;
		if ( !self.el )
			return;
		
		self.el.classList.toggle( 'hidden', false );
		self.el.focus();
	}
	
	ns.EmojiiPanel.prototype.hide = function() {
		const self = this;
		if ( !self.el )
			return;
		
		self.el.classList.toggle( 'hidden', true );
	}
	
	ns.EmojiiPanel.prototype.close = function() {
		const self = this;
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete friend.template;
		delete self.emojiiMap;
		delete self.onemojii;
		delete self.el;
	}
	
	// Private
	
	ns.EmojiiPanel.prototype.init = function() {
		const self = this;
		const conf = {
			id : friendUP.tool.uid( 'emojii' ),
		};
		self.el = friend.template.getElement( 'emojii-panel-tmpl', conf );
		const parent = document.getElementById( self.parentId );
		if ( !parent )
			throw new Error( 'EmojiiPanel - no element found for parentId' );
		
		parent.appendChild( self.el );
		self.el.tabIndex = -1; // so its focusable
		self.el.addEventListener( 'blur', emoPanelBlur, false );
		self.el.addEventListener( 'focus', emoFocus, false );
		
		function emoPanelBlur( e ) {
			self.hide();
		}
		
		function emoFocus( e ) {
		}
		
		//
		const emoKeys = Object.keys( self.emojiiMap );
		emoKeys.forEach( buildAndBind );
		function buildAndBind( key ) {
			const value = self.emojiiMap[ key ];
			const itemEl = friend.template.getElement( 'emojii-item-tmpl', { itml : value });
			itemEl.addEventListener( 'click', emoClick, false );
			self.el.appendChild( itemEl );
			
			function emoClick( e ) {
				e.stopPropagation();
				e.preventDefault();
				self.onemojii( key );
				self.hide();
			}
		}
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.LogFetcher = function(
		parentId,
		messagesId,
		templateManager,
		onFetch
	) {
		const self = this;
		self.parentId = parentId;
		self.messagesId = messagesId;
		friend.template = templateManager;
		self.onfetch = onFetch;
		
		self.locked = false;
		self.noLogs = false;
		
		self.init();
	}
	
	// Public
	
	ns.LogFetcher.prototype.unlock = function() {
		const self = this;
		self.toggleFetching( false );
	}
	
	ns.LogFetcher.prototype.setNoLogs = function( isNoLogs ) {
		const self = this;
		self.noLogs = isNoLogs;
		if ( self.lockOut )
			clearTimeout( self.lockOut );
		
		self.lockOut = null;
		self.toggleFetching( false );
		self.infoNone.classList.toggle( 'hidden', !isNoLogs );
	}
	
	ns.LogFetcher.prototype.close = function() {
		const self = this;
		delete friend.template;
		delete self.parentId;
		delete self.messagesId;
		delete self.onfetch;
		
		delete self.infoFetch;
		delete self.infoNone;
		delete self.info;
	}
	
	// Private
	
	ns.LogFetcher.prototype.init = function() {
		const self = this;
		// make sure we have valid ids
		self.parent = document.getElementById( self.parentId );
		if ( !self.parent ) {
			console.log( 'LogFetcher - no element for id', self.parentId );
			throw new Error( 'abloo ablooo ^^^' );
		}
		
		self.messages = document.getElementById( self.messagesId );
		if ( !self.messages ) {
			console.log( 'LogFetcher - no element for id', self.messagesId );
			throw new Error( 'more abloos ^^^' );
		}
		
		// insert log fetch UX element
		self.infoId = friendUP.tool.uid( 'log-fetch' );
		const infoConf = {
			id : self.infoId,
		};
		self.info = friend.template.getElement( 'log-fetch-tmpl', infoConf );
		self.messages.appendChild( self.info );
		self.infoFetch = self.info.querySelector( '.log-fetch-msg' );
		self.infoNone = self.info.querySelector( '.log-no-logs' );
		self.infoHeight = self.info.clientHeight;
		
		//bind
		self.parent.addEventListener( 'wheel', wheel, true );
		function wheel( e ) {
			e.stopPropagation();
			self.checkIsScrolledUp( e );
		}
	}
	
	ns.LogFetcher.prototype.checkIsScrolledUp = function( e ) {
		const self = this;
		if ( 0 < e.deltaY )
			return;
		
		if ( self.locked || self.lockOut )
			return;
		
		if ( self.noLogs )
			return;
		
		const msgST = self.messages.scrollTop;
		const infoH = self.infoHeight;
		// if we are more than two info heights from the top, we dont care
		if ( msgST > ( infoH * 2 ))
			return;
		
		self.toggleFetching( true );
		self.onfetch();
	}
	
	ns.LogFetcher.prototype.toggleFetching = function( isFetching ) {
		const self = this;
		self.locked = isFetching;
		if ( isFetching )
			self.lockOut = setTimeout( unlock, 3000 );
		
		const isUnlocked = !self.locked && ( null == self.lockOut );
		self.infoFetch.classList.toggle( 'hidden', isUnlocked );
		
		function unlock() {
			self.lockOut = null;
			if ( !self.locked )
				self.toggleFetching ( false );
		}
	}
	
})( library.component );

window.View.run = run;
function run( fupConf ) {
	window.conference = new library.view.Presence( fupConf );
}