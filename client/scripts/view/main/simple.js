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

/*
	main
*/
(function( ns, undefined ) {
	ns.Main.prototype.addMenu = function() {
		var self = this;
		var modules = {
			type : 'folder',
			id : 'modules',
			name : View.i18n('i18n_modules'),
			faIcon : 'fa-folder-o',
		};
		
		var settingsItem = {
			type   : 'item',
			id     : 'account-settings',
			name   : View.i18n('i18n_account_settings'),
			faIcon : 'fa-cog',
		};
		
		var liveItem = {
			type   : 'item',
			id     : 'start-live',
			name   : View.i18n('i18n_start_live_session'),
			faIcon : 'fa-video-camera',
		};
		
		var aboutItem = {
			type   : 'item',
			id     : 'about',
			name   : View.i18n('i18n_about'),
			faIcon : 'fa-info',
		};
		
		var logoutItem = {
			type   : 'item',
			id     : 'logout',
			name   : View.i18n('i18n_log_out'),
			faIcon : 'fa-sign-out',
		};
		
		var quitItem = {
			type   : 'item',
			id     : 'quit',
			name   : View.i18n('i18n_quit'),
			faIcon : 'fa-close',
		};
		
		var menuItems = [
			modules,
			liveItem,
			settingsItem,
			aboutItem,
			logoutItem,
			quitItem,
		];
		
		var conf = {
			id              : friendUP.tool.uid( 'menu' ),
			parentId        : 'main-menu',
			templateManager : hello.template,
			content         : menuItems,
			onnolistener    : onNoListener,
			onhide          : onHide,
			onclose         : onClose,
		};
		
		self.menu = new library.component.Menu( conf );
		function onNoListener( e ) { console.log( 'menu - no listener for event', e ); }
		function onHide( e ) { self.mainMenuContainer.classList.toggle( 'hidden', true ); }
		function onClose( e ) {}
		
		self.menu.on( 'start-live', handleStartLive );
		self.menu.on( 'account-settings', handleAccountSettings );
		self.menu.on( 'about', handleAbout );
		self.menu.on( 'logout', handleLogout );
		self.menu.on( 'quit', handleQuit );
		
		function handleStartLive( e ) { self.view.send({ type : 'live' }); }
		function handleAccountSettings( e ) { self.account.showSettings(); }
		function handleAbout( e ) { self.view.send({ type : 'about' }); }
		function handleLogout( e ) { self.view.send({ type : 'logout' }); }
		function handleQuit( e ) { self.view.send({ type : 'quit' }); }
	}
	
	ns.Main.prototype.initMain = function() {}
	
	// To initialize simple GUI
	ns.Main.prototype.initSimple = function() {
		const self = this;
		// search
		self.search = new library.component.Search(
			self.view,
			'search-bar',
			'search-results',
			hello.template,
			onSearchActive
		);
		
		function onSearchActive( isActive ) {
			const el = document.getElementById( 'search-results' );
			el.classList.toggle( 'hidden', !isActive );
		}
		
		// Recent conversations
		self.recent = new library.view.Recent(
			'conversations',
			self.recentHistory,
			hello.template
		);
		
		// tabs
		var btabs = document.getElementById( 'main-tabs' );
		var eles = document.getElementsByTagName( '*' );
		var tabs = [];
		var pages = [];
		for( var a = 0; a < eles.length; a++ ) {
			if( eles[a].classList ) {
				if( eles[a].classList.contains( 'page-item' ) ) {
					pages.push( eles[a] );
				}
				if( eles[a].classList.contains( 'tab-item' ) ) {
					tabs.push( eles[a] );
				}
			}
		}
		
		function addTab( tab, pages, index ) {
			tab.onclick = function() {
				if ( self.search )
					self.search.hide();
				
				pages[ index ].classList.add( 'active' );
				this.classList.add( 'active' );
				for( var b = 0; b < pages.length; b++ ) {
					if( b != index ) {
						pages[ b ].classList.remove( 'active' );
						tabs[ b ].classList.remove( 'active' );
					}
				}
			}
			if( index == 0 )
				tab.onclick();
		}
		for( var a = 0; a < tabs.length; a++ ) {
			addTab( tabs[a], pages, a );
		}
	}
	
})( library.view );

/*
	module control
*/
(function( ns, undefined ) {
	ns.ModuleControl.prototype.add = function( data ) {
		const self = this;
		if ( !data || !data.module ) {
			console.log( 'ModuleControl.add - invalid data', data );
			return;
		}
		
		const type = data.module.type;
		if ( 'presence' !== type && 'treeroot' !== type ) {
			console.log( 'ModuleControl.add - not a valid module for simple view', data );
			return;
		}
		
		self.addModule( data );
	}
	
	ns.ModuleControl.prototype.getContainerId = function( moduleType ) {
		const self = this;
		if ( 'presence' === moduleType )
			return 'conferences';
		else
			return 'contacts';
	}
	
})( library.view );

/* 
	base module
*/
(function( ns, undefined ) {
	ns.BaseModule.prototype.setCss = function() { return; }
	ns.BaseModule.prototype.initFoldit = function() { return; }
	ns.BaseModule.prototype.initStatus = function() {
		const self = this;
		self.connectionState = new library.component.StatusIndicator({
			containerId : self.connectionState,
			type        : 'icon',
			cssClass    : 'fa-circle',
			statusMap   : {
				offline    : 'Off',
				online     : 'On',
				open       : 'Warning',
				connecting : 'Notify',
				error      : 'Alert',
			},
		});
	}
	
})( library.view );

/*
	presence
*/
(function( ns, undefined ) {
	ns.Presence.prototype.getTitleString = function() {
		const self = this;
		return 'Conference rooms';
	}
	
	ns.Presence.prototype.buildElement = function() {
		const self = this;
		const title = self.getTitleString();
		const tmplId = 'simple-presence-module-tmpl';
		const conf = {
			clientId     : self.clientId,
			title        : title,
			connStateId  : self.connectionState,
			contactsId   : self.contactsId,
		};
		const el = hello.template.getElement(  tmplId, conf );
		const cont = document.getElementById( self.containerId );
		cont.appendChild( el );
	}
	
})( library.view );


/*
	treeroot
*/
(function( ns, undefined ) {
	ns.Treeroot.prototype.getTitleString = function() {
		const self = this;
		return 'Contacts';
	}
	
	ns.Treeroot.prototype.buildElement = function() {
		const self = this;
		const title = self.getTitleString();
		const tmplId = 'simple-treeroot-module-tmpl';
		const conf = {
			clientId          : self.clientId,
			moduleTitle       : title,
			connectionStateId : self.connectionState,
			contactsId        : self.contactsId,
			activeId          : self.activeId,
			inactiveId        : self.inactiveId,
		};
		
		const el = hello.template.getElement( tmplId, conf );
		const cont = document.getElementById( self.containerId );
		cont.appendChild( el );
		
		// Toggle offline users
		var toggleOfflineUsers = document.getElementById( 'button_' + conf.inactiveId );
		toggleOfflineUsers.addEventListener( 'click', toggleOffline, false );
		
		function toggleOffline() {
			var caret = toggleOfflineUsers;
			var list = document.getElementById( conf.inactiveId );
			if( caret.classList.contains( 'fa-caret-down' ) ) {
				caret.classList.remove( 'fa-caret-down' );
				caret.classList.add( 'fa-caret-right' );
				list.classList.add( 'hidden' );
			} else {
				caret.classList.remove( 'fa-caret-right' );
				caret.classList.add( 'fa-caret-down' );
				list.classList.remove( 'hidden' );
			}
		}
	}
	
	ns.Treeroot.prototype.getMenuOptions = function() {
		const self = this;
		const opts = [
			self.menuActions[ 'add-contact' ],
			self.menuActions[ 'settings' ],
			self.menuActions[ 'reconnect' ],
		];
		
		return opts;
	}
	
	ns.Treeroot.prototype.addMenu = function() {
		const self = this;
		return;
		const settingsId = friendUP.tool.uid( 'settings' );
		const settingsItem = {
			type : 'item',
			id : settingsId,
			name : 'Settings',
			faIcon : 'fa-cog',
		};
		
		const reconnectId = friendUP.tool.uid( 'reconnect' );
		const reconnectItem = {
			type : 'item',
			id : reconnectId,
			name : 'Reconnect',
			faIcon : 'fa-refresh',
		};
		
		self.menuId = friendUP.tool.uid( 'menu' );
		const folder = {
			type : 'folder',
			id : self.menuId,
			name : 'module',
			faIcon : 'fa-folder-o',
			items : [
				settingsItem,
				reconnectItem,
			],
		};
		
		main.menu.add( folder, 'modules' );
		
		main.menu.on( settingsId, showSettings );
		main.menu.on( reconnectId, doReconnect );
		
		function showSettings() { self.optionSettings(); }
		function doReconnect() { self.optionReconnect(); }
	}
	
	ns.Treeroot.prototype.setCss = function() { return; }
	ns.Treeroot.prototype.initFoldit = function() { return; }
	
})( library.view );

// Rececnt conversations
(function( ns, undefined ) {
	ns.Recent = function(
		containerId,
		recentHistory,
		template
	) {
		const self = this;
		self.template = template;
		self.history = recentHistory;
		
		self.modules = {};
		self.items = {};
		
		self.init( containerId );
	}
	
	// Public
	
	ns.Recent.prototype.close = function() {
		const self = this;
		self.releaseModules();
		delete self.template;
		delete self.history;
		delete self.splash;
		delete self.noRecent;
		delete self.active;
		delete self.inactive;
		delete self.modules;
		delete self.items;
		const el = self.el;
		if ( !el )
			return;
		
		delete self.el;
		el.parentNode.removeChild( el );
	}
	
	ns.Recent.prototype.registerModule = function( module ) {
		const self = this;
		const moduleId = module.id;
		if ( self.modules[ moduleId ])
			self.releaseModule( moduleId );
		
		self.modules[ moduleId ] = {
			module   : module,
			addId    : null,
			removeId : null,
			items    : {},
		};
		const mod = self.modules[ moduleId ];
		mod.addId = module.on( 'add', itemAdd );
		mod.removeId = module.on( 'remove', itemRemove );
		function itemAdd( item ) { self.handleItemAdd( moduleId, item ); }
		function itemRemove( itemId ) { self.handleItemRemove( moduleId, itemId ); }
	}
	
	ns.Recent.prototype.releaseModule = function( moduleId ) {
		const self = this;
		const mod = self.modules[ moduleId ];
		if ( !mod )
			return;
		
		itemIds = Object.keys( mod.items );
		itemIds.forEach( iId => self.handleItemRemove( moduleId, iId ));
		
		delete self.modules[ moduleId ];
		const module = mod.module;
		module.off( mod.addId );
		module.off( mod.removeId );
		module.close();
	}
	
	// Private
	
	ns.Recent.prototype.init = function( containerId ) {
		const self = this;
		const container = document.getElementById( containerId );
		const tmplConf = {
			
		};
		self.el = self.template.getElement( 'recent-convos-tmpl', tmplConf );
		container.appendChild( self.el );
		self.active = document.getElementById( 'recent-active' );
		self.inactive = document.getElementById( 'recent-inactive' );
		
		self.splash = document.getElementById( 'recent-splash' );
		self.noRecent = document.getElementById( 'no-recent-convos' );
		
		self.welcomeBox = document.getElementById( 'welcome-box' );
		const welcomeClose = document.getElementById( 'welcome-box-close' );
		welcomeClose.addEventListener( 'click', closeWelcome, false );
		function closeWelcome() {
			self.toggleNoRecent();
		}
	}
	
	ns.Recent.prototype.toggleNoRecent = function() {
		const self = this;
		if ( self.welcomeBox ) {
			self.welcomeBox.parentNode.removeChild( self.welcomeBox );
			delete self.welcomeBox;
		}
		
		if ( !self.noRecent )
			return;
		
		if ( self.active.firstChild )
			self.noRecent.classList.toggle( 'hidden', true );
		else
			self.noRecent.classList.toggle( 'hidden', false );
	}
	
	ns.Recent.prototype.releaseModules = function() {
		const self = this;
		if ( !self.modules )
			return;
		
		const ids = Object.keys( self.modules );
		ids.forEach( id => self.releaseModule( id ));
	}
	
	ns.Recent.prototype.handleItemAdd = function( moduleId, contact ) {
		const self = this;
		const mod = self.modules[ moduleId ];
		if ( !mod )
			return;
		
		let Item = null;
		if ( 'room' === contact.type )
			Item = library.view.RecentRoom;
		else
			Item = library.view.RecentItem;
		
		const cId = contact.id;
		if ( mod.items[ cId ])
			self.handleItemRemove( moduleId, cId );
		
		const iId = friendUP.tool.uid( 'recent' );
		const item = new Item(
			iId,
			cId,
			moduleId,
			contact,
			'recent-inactive',
			self.template,
			onActive
		);
		mod.items[ cId ] = item;
		self.items[ item.id ] = item;
		self.checkHistory( iId );
		
		function onActive( isActive ) {
			self.updateIsActive( iId, isActive );
		}
		
	}
	
	ns.Recent.prototype.updateIsActive = function( itemId, isActive ) {
		const self = this;
		if ( isActive )
			self.toActive( itemId );
		else
			self.toInactive( itemId );
	}
	
	ns.Recent.prototype.toActive = function( itemId, isHistory ) {
		const self = this;
		if ( !isHistory )
			self.saveToHistory( itemId );
		
		if ( itemId === self.currentFirstItem )
			return;
		
		const itemEl = document.getElementById( itemId );
		let firstEl = null;
		if ( self.currentFirstItem )
			firstEl = document.getElementById( self.currentFirstItem ) || null;
		
		self.active.insertBefore( itemEl, firstEl );
		self.currentFirstItem = itemId;
		
		self.toggleNoRecent();
	}
	
	ns.Recent.prototype.toInactive = function( itemId ) {
		const self = this;
		const itemEl = document.getElementById( itemId );
		self.inactive.appendChild( itemEl );
		if ( itemId === self.currentFirstItem )
			self.currentFirstItem = getCurrentFirstItem();
		
		self.removeFromHistory( itemId );
		self.toggleNoRecent();
		
		function getCurrentFirstItem() {
			let el = self.active.firstChild;
			if ( !el )
				return null;
			
			return el.id;
		}
	}
	
	ns.Recent.prototype.handleItemRemove = function( moduleId, contactId ) {
		const self = this;
		const mod = self.modules[ moduleId ];
		if ( !mod )
			return;
		
		const item = mod.items[ contactId ];
		if ( !item )
			return;
		
		delete mod.items[ contactId ];
		delete self.items[ item.id ];
		item.close();
	}
	
	ns.Recent.prototype.checkHistory = function( itemId ) {
		const self = this;
		const item = self.items[ itemId ];
		if ( !item )
			return;
		
		const mId = item.moduleId;
		const cId = item.clientId;
		const mod = self.history[ mId ];
		if ( !mod )
			return;
		
		const event = mod[ cId ];
		if ( !event )
			return;
		
		item.setLastEvent( event );
		self.toActive( itemId, true );
	}
	
	ns.Recent.prototype.saveToHistory = function( itemId ) {
		const self = this;
		let item = self.items[ itemId ];
		if ( !item )
			return;
		
		const lastEvent = item.getLastEvent();
		self.sendHistory( 'recent-save', itemId, lastEvent );
	}
	
	ns.Recent.prototype.removeFromHistory = function( itemId ) {
		const self = this;
		self.sendHistory( 'recent-remove', itemId );
	}
	
	ns.Recent.prototype.sendHistory = function( type, itemId, lastEvent ) {
		const self = this;
		const  item = self.items[ itemId ];
		if ( !item )
			return;
		
		const event = {
			type : type,
			data : {
				moduleId  : item.moduleId,
				clientId  : item.clientId,
				lastEvent : lastEvent || null,
			},
		};
		View.send( event );
	}
	
})( library.view );


// recent conversations - item
(function( ns, undefined ) {
	ns.RecentItem = function(
		id,
		clientId,
		moduleId,
		source,
		containerId,
		templateManager,
		onActive
	) {
		const self = this;
		self.id = id;
		self.clientId = clientId;
		self.moduleId = moduleId;
		self.source = source;
		self.template = templateManager;
		self.onActive = onActive;
		
		self.lastMessage = null;
		
		self.init( containerId );
	}
	
	ns.RecentItem.prototype.tmplId = 'recent-item-tmpl';
	
	// Public
	
	ns.RecentItem.prototype.close = function() {
		const self = this;
		if ( self.status )
			self.status.close();
		
		if ( self.unread )
			self.unread.close();
		
		delete self.onActive;
		delete self.containerId;
		delete self.template;
		delete self.source;
		delete self.actions;
		delete self.unread;
		delete self.status;
		delete self.moduleId;
		delete self.clientId;
		delete self.id;
		delete self.menuBtn;
		delete self.message;
		delete self.messageTime;
		delete self.lastMessage;
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
	}
	
	ns.RecentItem.prototype.setActive = function( isActive ) {
		const self = this;
		if ( self.onActive )
			self.onActive( isActive );
	}
	
	ns.RecentItem.prototype.setEvent = function( event ) {
		const self = this;
		let handler = self.eventMap[ event.type ];
		if ( !handler )
			return;
		
		handler( event.data );
	}
	
	ns.RecentItem.prototype.setLastEvent = function( historyEvent ) {
		const self = this;
		if ( !self.lastEvent )
			self.setEvent( historyEvent );
		
		let historyTime = historyEvent.data.time;
		let lastTime = self.lastEvent.data.time;
		if ( historyTime > lastTime )
			self.setEvent( historyEvent );
	}
	
	ns.RecentItem.prototype.getLastEvent = function() {
		const self = this;
		return self.lastEvent;
	}
	
	// Private
	
	ns.RecentItem.prototype.init = function( containerId ) {
		const self = this;
		self.eventMap = {
			'message' : handleMessage,
		};
		
		function handleMessage( e ) { self.handleMessage( e ); }
		
		self.actions = new library.component.MiniMenuActions();
		const container = document.getElementById( containerId );
		self.status = friendUP.tool.uid( 'status' );
		self.unread = friendUP.tool.uid( 'unread' );
		const tmplConf = self.getTmplConf();
		self.el = self.template.getElement( self.tmplId, tmplConf );
		container.appendChild( self.el );
		self.bindElement();
		self.buildIndicators();
		
		self.source.on( 'message', message );
		self.source.on( 'msg-waiting', msgWaiting );
		const lastMessage = self.source.getLastMessage();
		if ( lastMessage ) {
			self.setMessage( lastMessage.data );
		}
		
		function message( e ) { self.handleMessage( e ); }
		function msgWaiting( e ) { self.handleMsgWaiting( e ); }
		
		self.el.addEventListener( 'click', elClick, false );
		self.menuBtn.addEventListener( 'click', menuClick, false );
		
		function elClick( e ) {
			self.handleBodyClick();
		}
		
		function menuClick( e ) {
			e.stopPropagation();
			self.handleMenuClick();
		}
		
	}
	
	ns.RecentItem.prototype.getTmplConf = function() {
		const self = this;
		return {
			id          : self.id,
			avatar      : self.source.getAvatar(),
			statusId    : self.status,
			name        : self.source.getName(),
			lastMsgTime : '',
			lastMsg     : '',
			unreadId    : self.unread,
		};
	}
	
	ns.RecentItem.prototype.bindElement = function() {
		const self = this;
		self.message = self.el.querySelector( '.recent-info .recent-state .last-message' );
		self.messageTime = self.el.querySelector( '.recent-info .name-bar .last-msg-time' );
		self.menuBtn = self.el.querySelector( '.item-menu' );
	}
	
	ns.RecentItem.prototype.buildIndicators = function() {
		const self = this;
		self.buildStatusIndicator();
		self.buildUnreadIndicator();
	}
	
	ns.RecentItem.prototype.buildStatusIndicator = function() {
		const self = this;
		self.status = new library.component.StatusIndicator({
			containerId : self.status,
			type        : 'led',
			cssClass    : 'recent-led-status PadBorder',
			statusMap   : {
				offline   : 'Off',
				online    : 'On',
			},
		});
		self.handleOnline( self.source.getOnline());
		
		self.source.on( 'online', online );
		function online( e ) { self.handleOnline( e ); }
	}
	
	ns.RecentItem.prototype.buildUnreadIndicator = function() {
		const self = this;
		self.unread = new library.component.StatusDisplay({
			containerId : self.unread,
			type        : 'led',
			cssClass    : 'recent-led-unread',
			statusMap   : {
				'false'   : 'Off',
				'true'    : 'Notify',
			},
			display : '',
		});
		self.unread.hide();
	}
	
	ns.RecentItem.prototype.handleOnline = function( isOnline ) {
		const self = this;
		if ( isOnline ) {
			self.status.show();
			self.status.set( 'online' );
		}
		else {
			self.status.hide();
			self.status.set( 'offline' );
		}
	}
	
	ns.RecentItem.prototype.handleMessage = function( msg, message ) {
		const self = this;
		if ( !msg || ( !msg.message && !message ))
			return;
		
		self.setMessage( msg, message );
		self.setActive( true );
	}
	
	ns.RecentItem.prototype.handleMsgWaiting = function( state ) {
		const self = this;
		self.unread.set( state.isWaiting ? 'true' : 'false' );
		self.unread.setDisplay( state.unread || 1 );
		if ( state.isWaiting )
			set( state );
		else
			clear();
		
		function set( state ) {
			self.unread.show();
			if ( !state.message ) {
				state.from = true;
				self.handleMessage( state, '>> You have unread messages' );
			} else
				self.handleMessage( state );
		}
		
		function clear() {
			self.unread.hide();
		}
	}
	
	ns.RecentItem.prototype.setMessage = function( msg, altMessage ) {
		const self = this;
		if ( !msg.time )
			msg.time = Date.now();
		
		if ( !msg.message )
			msg.message = altMessage || '';
		
		const now = library.tool.getChatTime( msg.time );
		let message = msg.message;
		if ( !msg.from )
			message =  'You: ' + message;
		
		self.message.textContent = message;
		self.messageTime.textContent = now;
		
		self.lastEvent = {
			type : 'message',
			data : msg,
		};
	}
	
	ns.RecentItem.prototype.handleBodyClick = function() {
		const self = this;
		self.source.openChat();
	}
	
	ns.RecentItem.prototype.handleMenuClick = function() {
		const self = this;
		const options = [
			self.actions[ 'open-chat' ],
			self.actions[ 'hide' ],
		];
		new library.component.MiniMenu(
			self.template,
			self.menuBtn,
			'hello',
			options,
			onSelect
		);
		
		function onSelect( selected ) {
			if ( 'hide' === selected ) {
				self.setActive( false );
				return;
			}
			
			if ( 'open-chat' === selected )
				self.source.openChat();
		}
	}
	
})( library.view );


/* RecentRoom
	extension of RecentItem
*/

(function( ns, undefined ) {
	ns.RecentRoom = function(
		id,
		clientId,
		moduleId,
		source,
		containerId,
		templateManager,
		onActive
	) {
		const self = this;
		library.view.RecentItem.call( self,
			id,
			clientId,
			moduleId,
			source,
			containerId,
			templateManager,
			onActive
		);
		
		self.roomInit();
	}
	
	ns.RecentRoom.prototype = Object.create( ns.RecentItem.prototype );
	
	ns.RecentRoom.prototype.tmplId = 'recent-room-tmpl';
	ns.RecentRoom.prototype.iconMap = {
		'message' : 'fa-comment',
		'live'    : 'fa-video-camera',
	};
	
	ns.RecentRoom.prototype.roomInit = function() {
		const self = this;
		self.eventMap = {
			'message' : handleMessage,
			'live'    : handleLive,
		};
		
		function handleMessage( e ) { self.handleMessage( e ); }
		function handleLive( e ) { self.handleUserLive( e ); }
	}
	
	ns.RecentRoom.prototype.baseClose = ns.RecentRoom.prototype.close;
	ns.RecentRoom.prototype.close = function() {
		const self = this;
		if ( self.live )
			self.live.close();
		
		delete self.icon;
		delete self.currentIcon;
		delete self.live;
		delete self.name;
		
		self.baseClose();
	}
	
	ns.RecentRoom.prototype.getTmplConf = function( id ) {
		const self = this;
		self.live = friendUP.tool.uid( 'live' );
		const avatar = self.source.getAvatar();
		return {
			id            : self.id,
			avatar        : avatar,
			iconHidden    : !!avatar ? 'hidden' : '',
			statusId      : self.status,
			name          : self.source.getName(),
			lastEventIcon : '',
			lastMsgTime   : '',
			lastName      : '',
			lastMsg       : '',
			liveId        : self.live,
			unreadId      : self.unread,
		};
	}
	
	ns.RecentRoom.prototype.bindElement = function() {
		const self = this;
		self.icon = self.el.querySelector( '.recent-info .recent-state .last-event-icon i' );
		self.messageTime = self.el.querySelector( '.recent-info .name-bar .last-msg-time' );
		self.name = self.el.querySelector( '.recent-info .recent-state .last-msg-name' );
		self.message = self.el.querySelector( '.recent-info .recent-state .last-message' );
		self.menuBtn = self.el.querySelector( '.item-menu' );
	}
	
	ns.RecentRoom.prototype.buildIndicators = function() {
		const self = this;
		self.buildStatusIndicator();
		self.buildLiveIndicator();
		self.buildUnreadIndicator();
	}
	
	ns.RecentRoom.prototype.buildStatusIndicator = function() {
		const self = this;
		const conf = {
			containerId : self.status,
			type        : 'led',
			cssClass    : 'recent-led-participants PadBorder',
			statusMap   : {
				empty   : 'Off',
				users   : 'Available',
			},
			display     : '-',
		};
		self.status = new library.component.StatusDisplay( conf );
		self.source.on( 'participants', parties );
		self.source.on( 'user-live', userLive );
		
		function parties( num ) {
			if ( !num )
				setNone();
			else
				setNum( num );
			
			function setNone() {
				self.status.set( 'empty' );
				self.status.setDisplay( '-' );
			}
			
			function setNum( num ) {
				self.status.set( 'users' );
				self.status.setDisplay( num );
			}
		}
		
		function userLive( isLive ) {
			self.handleUserLive( isLive );
		}
	}
	
	ns.RecentRoom.prototype.buildLiveIndicator = function() {
		const self = this;
		const conf = {
			containerId : self.live,
			type        : 'icon',
			cssClass    : 'fa-video-camera',
			statusMap   : {
				'empty'   : 'Off',
				'users'   : 'Available',
			},
		};
		self.live = new library.component.StatusIndicator( conf );
		self.live.hide();
		self.source.on( 'live', live );
		
		function live( isLive ) {
			if ( isLive ) {
				self.live.set( 'users' );
				self.live.show();
			}
			else {
				self.live.set( 'empty' );
				self.live.hide();
			}
		}
	}
	
	ns.RecentRoom.prototype.handleMessage = function( msg ) {
		const self = this;
		if ( !msg || !msg.message )
			return;
		
		self.setMessage( msg );
		self.setActive( true );
	}
	
	ns.RecentRoom.prototype.setMessage = function( msg ) {
		const self = this;
		self.lastEvent = {
			type : 'message',
			data : msg,
		};
		const time = msg.time || Date.now();
		const now = library.tool.getChatTime( time );
		let from = msg.from;
		if ( !from )
			from =  'You';
		
		self.setIcon( 'message' );
		self.name.textContent = from + ':';
		self.message.textContent = msg.message;
		self.messageTime.textContent = now;
		
	}
	
	ns.RecentRoom.prototype.handleMsgWaiting = function( state ) {
		const self = this;
		self.unread.set( state.isWaiting ? 'true' : 'false' );
		if ( state.isWaiting )
			set( state );
		else
			clear();
		
		function set( state ) {
			self.unread.show();
			self.unread.setDisplay( state.unread || 1 );
			self.handleMessage( state );
		}
		
		function clear() {
			self.unread.hide();
			self.unread.setDisplay( '' );
		}
	}
	
	ns.RecentRoom.prototype.handleUserLive = function( isLive ) {
		const self = this;
		let msg = null;
		self.lastEvent = {
			type : 'live',
			data : isLive,
		};
		
		if ( isLive )
			msg = 'You joined a live session';
		else
			msg = 'You were in a live session';
		
		const now = library.tool.getChatTime( Date.now());
		self.setIcon( 'live' );
		self.name.textContent = '';
		self.message.textContent = msg;
		self.messageTime.textContent = now;
		
		self.setActive( true );
	}
	
	ns.RecentRoom.prototype.setIcon = function( iconId ) {
		const self = this;
		if ( iconId === self.currentIcon )
			return;
		
		let curr = self.iconMap[ self.currentIcon ];
		let next = self.iconMap[ iconId ];
		if ( !next )
			return;
		
		if ( curr )
			self.icon.classList.toggle( curr, false );
		
		self.icon.classList.toggle( next, true  );
		self.currentIcon = iconId;
	}
	
})( library.view );
