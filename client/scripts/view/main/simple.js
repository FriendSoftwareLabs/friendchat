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
		const self = this;
		const modules = {
			type : 'folder',
			id : 'modules',
			name : View.i18n('i18n_modules'),
			faIcon : 'fa-folder-o',
		};
		
		const settingsItem = {
			type   : 'item',
			id     : 'account-settings',
			name   : View.i18n( 'i18n_account_settings' ),
			faIcon : 'fa-cog',
		};
		
		const liveItem = {
			type   : 'item',
			id     : 'start-live',
			name   : View.i18n( 'i18n_start_live_session' ),
			faIcon : 'fa-video-camera',
		};
		
		const aboutItem = {
			type   : 'item',
			id     : 'about',
			name   : View.i18n( 'i18n_about' ),
			faIcon : 'fa-info',
		};
		
		const logoutItem = {
			type   : 'item',
			id     : 'logout',
			name   : View.i18n( 'i18n_log_out' ),
			faIcon : 'fa-sign-out',
		};
		
		const quitItem = {
			type   : 'item',
			id     : 'quit',
			name   : View.i18n( 'i18n_quit' ),
			faIcon : 'fa-power-off',
		};
		
		const menuItems = [];
		if ( !window.View.appConf.hideLive )
			menuItems.push( liveItem );
		
		menuItems.push( settingsItem );
		menuItems.push( aboutItem );
		menuItems.push( quitItem );
		
		const conf = {
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
	ns.Main.prototype.initSimple = function( settings ) {
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
		
		// Rtc sessions
		self.rtc = new library.view.RtcState(
			self.view,
			'rtc-state',
		);
		
		// Recent conversations
		self.recent = new library.view.Recent(
			'recent-events',
			self.recentHistory,
			hello.template
		);
		
		// Check if we *want* the inapp menu
		if ( settings && settings.inAppMenu ) {
			self.enableInAppMenu();
		}
		
		// tabs
		const recent = document.getElementById( 'recent-events' );
		const recentBtn = document.getElementById( 'show-recent' );
		const rooms = document.getElementById( 'rooms' );
		const roomsBtn = document.getElementById( 'show-rooms' );
		const contacts = document.getElementById( 'contacts' );
		const contactsBtn = document.getElementById( 'show-contacts' );
		
		recentBtn.addEventListener( 'click', recentClick, false );
		roomsBtn.addEventListener( 'click', roomsClick, false );
		contactsBtn.addEventListener( 'click', contactsClick, false );
		
		setActive( recent, recentBtn );
		
		function recentClick( e ) {
			btnClick();
			setActive( recent, recentBtn, true );
		}
		
		function roomsClick( e ) {
			btnClick();
			setActive( rooms, roomsBtn, true );
		}
		
		function contactsClick( e ) {
			btnClick();
			setActive( contacts, contactsBtn, true );
		}
		
		function btnClick() {
			if ( self.search )
				self.search.hide();
			 
			 setInactive();
		}
		
		function setInactive() {
			toggleActive( self.currTab, self.currTabBtn, false );
		}
		
		function setActive( el, btnEl ) {
			self.currTab = el;
			self.currTabBtn = btnEl;
			toggleActive( self.currTab, self.currTabBtn, true );
		}
		
		function toggleActive( el, btnEl, show ) {
			el.classList.toggle( 'active', !!show );
			btnEl.classList.toggle( 'active', !!show );
		}
	}
	
	ns.Main.prototype.enableInAppMenu = function() {
		const self = this;
		const menu = document.getElementById( 'menu-btn' );
		if ( menu )
			menu.classList.toggle( 'hidden', false );
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
		return {
			conference : 'rooms',
			contact    : 'contacts',
		};
	}
	
	ns.ModuleControl.prototype.setGuide = function() {
		const self = this;
		self.guide = new library.component.InfoBox({
			containerId : 'recent-events',
			element     : null,
		});
	}
	
})( library.view );

/*
	rtc state
*/
( function( ns, undefined ) {
	ns.RtcState = function( parentConn, containerId ) {
		const self = this;
		self.containerId = containerId;
		
		self.conn = null;
		
		self.init( parentConn );
	}
	
	// Public
	
	ns.RtcState.prototype.close = function() {
		const self = this;
		if ( self.conn )
			self.conn.close();
		
		self.removeAll();
		
		delete self.conn;
		delete self.el;
	}
	
	// Private
	
	ns.RtcState.prototype.init = function( parentConn ) {
		const self = this;
		self.el = document.getElementById( self.containerId );
		self.conn = new library.component.EventNode( 'rtc', parentConn, sink );
		self.conn.on( 'add', e => self.addSession( e ));
		self.conn.on( 'remove', e => self.removeSession( e ));
		
		function sink( ...args ) {
			console.log( 'view.RtcState.eventSink', args );
		}
	}
	
	ns.RtcState.prototype.addSession = function( sess ) {
		const self = this;
		if ( !self.el )
			return;
		
		const sId = sess.id;
		const id = 'sess_' + sId;
		const conf = {
			id    : id,
			title : sess.conf.roomName,
		};
		const el = hello.template.getElement( 'rtc-state-tmpl', conf );
		self.el.appendChild( el );
		el.addEventListener( 'click', elClick, false );
		
		function elClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			const show = {
				type : 'show',
				data : sId,
			};
			self.send( show );
		}
	}
	
	ns.RtcState.prototype.removeSession = function( sId ) {
		const self = this;
		const id = 'sess_' + sId;
		const el = document.getElementById( id );
		if ( !el )
			return;
		
		el.parentNode.removeChild( el );
	}
	
	ns.RtcState.prototype.removeAll = function() {
		const self = this;
	}
	
	ns.RtcState.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.send( event );
	}
	
})( library.view );

/* 
	base module
*/
(function( ns, undefined ) {
	ns.BaseModule.prototype.setLogoCss = function() { return; }
	ns.BaseModule.prototype.initFoldit = function() { return; }
	ns.BaseModule.prototype.initConnStatus = function() {
		const self = this;
		const conf = {
			containerId : null,
			type        : 'icon',
			cssClass    : 'fa-circle',
			statusMap   : {
				offline    : 'Off',
				online     : 'On',
				open       : 'Warning',
				connecting : 'Notify',
				error      : 'Alert',
			},
		};
		
		if ( self.roomsConnState ) {
			conf.containerId = self.roomsConnState;
			self.roomsConnState = new library.component.StatusIndicator( conf );
		}
		
		if ( self.contactsConnState ) {
			conf.containerId = self.contactsConnState;
			self.contactsConnState = new library.component.StatusIndicator( conf );
		}
	}
	
})( library.view );

/*
	presence
*/
(function( ns, undefined ) {
	ns.Presence.prototype.setLogoCss = function() { return; }
	ns.Presence.prototype.initFoldit = function() { return; }
	
	ns.Presence.prototype.buildRoomsElement = function() {
		const self = this;
		const title = self.getTitleString( 'conference' );
		const tmplId = 'simple-presence-rooms-tmpl';
		const conf = {
			roomsId      : self.roomsId,
			title        : title,
			connStateId  : self.roomsConnState,
			itemsId      : self.roomItemsId,
		};
		const el = hello.template.getElement(  tmplId, conf );
		const cont = document.getElementById( self.containers.conference );
		cont.appendChild( el );
	}
	
	ns.Presence.prototype.buildContactsElement = function() {
		const self = this;
		const title = self.getTitleString( 'contact' );
		const tmplId = 'simple-presence-contacts-tmpl';
		self.hiddenId = friendUP.tool.uid( 'able' );
		self.hiddenItemsId = friendUP.tool.uid( 'able' );
		const conf = {
			roomsId       : self.contactsId,
			title         : title,
			connStateId   : self.contactsConnState,
			itemsId       : self.contactItemsId,
			hiddenId      : self.hiddenId,
			hiddenItemsId : self.hiddenItemsId,
		};
		const el = hello.template.getElement(  tmplId, conf );
		const cont = document.getElementById( self.containers.contact );
		cont.appendChild( el );
		
		self.bindHidden();
	}
	
	ns.Presence.prototype.initStatus = function() {
		const self = this;
		const conf = {
			containerId : null,
			type        : 'icon',
			cssClass    : 'fa-circle',
			statusMap   : {
				offline    : 'Off',
				online     : 'On',
				open       : 'Warning',
				connecting : 'Notify',
				error      : 'Alert',
			},
		};
		
		conf.containerId = self.roomsConnState;
		self.roomsConnState = new library.component.StatusIndicator( conf );
		
		conf.containerId = self.contactsConnState;
		self.contactsConnState = new library.component.StatusIndicator( conf );
	}
	
})( library.view );


/*
	treeroot
*/
(function( ns, undefined ) {
	ns.Treeroot.prototype.setLogoCss = function() { return; }
	ns.Treeroot.prototype.initFoldit = function() { return; }
	
	ns.Treeroot.prototype.getTitleString = function() {
		const self = this;
		return window.View.i18n( 'i18n_community_contacts' );
	}
	
	ns.Treeroot.prototype.buildContactsElement = function() {
		const self = this;
		const title = self.getTitleString();
		const tmplId = 'simple-treeroot-module-tmpl';
		const conf = {
			clientId    : self.contactsId,
			moduleTitle : title,
			connStateId : self.contactsConnState,
			itemsId     : self.contactItemsId,
			activeId    : self.activeId,
			inactiveId  : self.inactiveId,
		};
		
		const el = hello.template.getElement( tmplId, conf );
		const container = document.getElementById( self.containers.contact );
		container.appendChild( el );
		
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
	
	ns.Treeroot.prototype.getMenuOptions = function( type ) {
		const self = this;
		const opts = [
			self.menuActions[ 'settings' ],
			self.menuActions[ 'reconnect' ],
		];
		
		return opts;
	}
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
		self.itemOrder = null;
		
		self.loadingDone = false;
		
		self.init( containerId );
	}
	
	// Public
	
	ns.Recent.prototype.close = function() {
		const self = this;
		if ( self.itemOrder )
			self.itemOrder.close();
		
		self.releaseModules();
		delete self.template;
		delete self.history;
		delete self.splash;
		delete self.noRecent;
		delete self.active;
		delete self.inactive;
		delete self.modules;
		delete self.items;
		delete self.itemOrder;
		
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
		mod.addId = module.on( 'add', item => self.handleItemAdd( moduleId, item ));
		mod.removeId = module.on( 'remove', itemId => self.handleItemRemove( moduleId, itemId ));
		
		if ( self.loadingDone )
			return;
		
		if ( null != self.loadingTimeout )
			return;
		
		self.loadingTimeout = window.setTimeout( wellWereWaiting, 1000 * 10 );
		function wellWereWaiting() {
			self.loadingTimeout = null;
			self.doneLoading();
			self.toggleNoRecent();
		}
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
		self.itemOrder = new library.component.ListOrder( 'recent-active', null );
		
		self.splash = document.getElementById( 'recent-splash' );
		//self.waiting = document.getElementById( 'recent-waiting' );
		self.noRecent = document.getElementById( 'no-recent-convos' );
		
		self.welcomeBox = document.getElementById( 'welcome-box' );
		const welcomeClose = document.getElementById( 'welcome-box-close' );
		welcomeClose.addEventListener( 'click', closeWelcome, false );
		if ( !self.history ) {
			showWelcome();
			return;
		}
		
		const things = Object.keys( self.history );
		if ( things.length )
			self.toggleNoRecent( true );
		else
			showWelcome();
		
		//
		function closeWelcome() {
			self.toggleNoRecent();
		}
		
		function showWelcome() {
			self.doneLoading();
			if ( !self.welcomeBox )
				return;
			
			self.welcomeBox.classList.toggle( 'hidden', false );
		}
	}
	
	ns.Recent.prototype.toggleNoRecent = function( waitingForHistory ) {
		const self = this;
		if ( self.welcomeBox ) {
			self.welcomeBox.parentNode.removeChild( self.welcomeBox );
			delete self.welcomeBox;
		}
		
		if ( waitingForHistory ) {
			self.isWaiting = true;
			//self.waiting.classList.toggle( 'hidden', false );
			return;
		}
		
		if ( self.isWaiting ) {
			//self.waiting.classList.toggle( 'hidden', true );
			self.isWaiting = false;
			self.doneLoading();
		}
		
		if ( self.active.firstChild )
			self.noRecent.classList.toggle( 'hidden', true );
		else
			self.noRecent.classList.toggle( 'hidden', false );
	}
	
	ns.Recent.prototype.doneLoading = function() {
		const self = this;
		if ( null != self.loadingTimeout )
			window.clearTimeout( self.loadingTimeout );
		
		self.loadingDone = true;
		self.loadingTimeout = null;
		window.View.showLoading( false );
	}
	
	ns.Recent.prototype.releaseModules = function() {
		const self = this;
		if ( !self.modules )
			return;
		
		const ids = Object.keys( self.modules );
		ids.forEach( id => self.releaseModule( id ));
	}
	
	ns.Recent.prototype.handleItemAdd = function( moduleId, source ) {
		const self = this;
		const mod = self.modules[ moduleId ];
		if ( !mod )
			return;
		
		if ( 'query' === source.type ) {
			self.addQuery( moduleId, source );
			return;
		}
		
		let Item = null;
		if ( 'room' === source.type )
			Item = library.view.RecentRoom;
		else
			Item = library.view.RecentItem;
		
		const cId = source.id;
		if ( mod.items[ cId ])
			self.handleItemRemove( moduleId, cId );
		
		const iId = friendUP.tool.uid( 'recent' );
		const item = new Item(
			iId,
			cId,
			moduleId,
			source,
			'recent-inactive',
			self.template,
			onActive
		);
		mod.items[ cId ] = item;
		self.items[ iId ] = item;
		self.checkHistory( iId );
		const pri = item.getPriorityConf();
		if ( 0 !== pri.priority )
			self.updateIsActive( iId, true );
		
		function onActive( isActive ) {
			self.updateIsActive( iId, isActive );
		}
	}
	
	ns.Recent.prototype.addQuery = function( modId, source ) {
		const self = this;
		const mod = self.modules[ modId ];
		if ( !mod )
			return;
		
		const sId = source.id;
		const iId = friendUP.tool.uid( 'query' );
		const item = new library.view.QueryItem(
			'recent-active',
			iId,
			source.queryMsg,
			source.avatar,
			source.typeKlass,
			source,
		);
		mod.items[ sId ] = item;
		self.items[ iId ] = item;
		const priConf = {
			clientId : iId,
			priority : 1,
			time     : Date.now(),
		};
		self.itemOrder.add( priConf );
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
		const item = self.items[ itemId ];
		if ( !item ) {
			console.log( 'Recent.toActive - no item for', itemId );
			return;
		}
		
		//self.active.appendChild( item.el );
		self.toggleNoRecent();
		
		if ( !isHistory )
			self.saveToHistory( itemId );
		
		if ( self.itemOrder.checkIsFirstItem( itemId )) {
			return;
		}
		
		const conf = item.getPriorityConf();
		self.itemOrder.add( conf );
		return;
		
	}
	
	ns.Recent.prototype.toInactive = function( itemId ) {
		const self = this;
		self.itemOrder.remove( itemId );
		moveToInactive( itemId );
		//self.removeFromItemOrder( itemId );
		self.removeFromHistory( itemId );
		self.toggleNoRecent();
		
		function moveToInactive( id ) {
			const itemEl = document.getElementById( id );
			if ( !itemEl )
				return;
			
			self.inactive.appendChild( itemEl );
		}
	}
	
	ns.Recent.prototype.handleItemRemove = function( moduleId, sourceId ) {
		const self = this;
		const mod = self.modules[ moduleId ];
		if ( !mod )
			return;
		
		const item = mod.items[ sourceId ];
		if ( !item )
			return;
		
		delete mod.items[ sourceId ];
		delete self.items[ item.id ];
		self.removeFromItemOrder( item.id );
		
		item.close();
	}
	
	ns.Recent.prototype.removeFromItemOrder = function( itemId ) {
		const self = this;
		self.itemOrder.remove( itemId );
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
		self.sourceIds = [];
		
		self.init( containerId );
	}
	
	ns.RecentItem.prototype.tmplId = 'recent-item-tmpl';
	
	// Public
	
	ns.RecentItem.prototype.getPriorityConf = function() {
		const self = this;
		const src = self.source;
		const name = src.getName();
		let time = null;
		if ( self.lastEvent && self.lastEvent.data )
			time = self.lastEvent.data.time;
		
		
		return {
			clientId : self.id,
			priority : src.getPriority(),
			time     : time,
			name     : name,
		};
	}
	
	ns.RecentItem.prototype.close = function() {
		const self = this;
		if ( self.status )
			self.status.close();
		
		if ( self.unread )
			self.unread.close();
		
		if ( self.callStatus && self.callStatus.close )
			self.callStatus.close();
		
		if ( self.source )
			self.releaseSource();
		
		delete self.icon;
		delete self.iconMap;
		delete self.currentIcon;
		delete self.onActive;
		delete self.containerId;
		delete self.template;
		delete self.actions;
		delete self.unread;
		delete self.status;
		delete self.source;
		delete self.callStatus;
		delete self.eventMap;
		delete self.moduleId;
		delete self.clientId;
		delete self.id;
		//delete self.menuBtn;
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
		if ( !historyEvent || !historyEvent.data )
			return;
		
		if ( !self.lastEvent )
			self.setEvent( historyEvent );
		
		if ( !self.lastEvent || !self.lastEvent.data ) {
			console.log( 'RecentItem.setLastEvent - missing things', {
				hE   : historyEvent,
				lE   : self.lastEvent,
				self : self,
			});
			return;
		}
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
	
	ns.RecentItem.prototype.iconMap = {
		'message' : 'fa-comment',
		'live'    : 'fa-video-camera',
	};
	
	ns.RecentItem.prototype.init = function( containerId ) {
		const self = this;
		self.eventMap = {
			'message' : ( e ) => self.handleMessage( e ),
			'live'    : ( e ) => self.handleLive( e ),
		};
		
		self.actions = new library.component.MiniMenuActions();
		const container = document.getElementById( containerId );
		self.status = friendUP.tool.uid( 'status' );
		self.unread = friendUP.tool.uid( 'unread' );
		self.callStatus = friendUP.tool.uid( 'call' );
		const tmplConf = self.getTmplConf();
		self.el = self.template.getElement( self.tmplId, tmplConf );
		container.appendChild( self.el );
		self.bindElement();
		self.buildIndicators();
		
		//
		const msgId = self.source.on( 'message', message );
		const waitId = self.source.on( 'msg-waiting', msgWaiting );
		const idId = self.source.on( 'identity', idUpdate );
		const relId = self.source.on( 'relation', relation );
		
		function message( e ) { self.handleMessage( e ); }
		function msgWaiting( e ) { self.handleMsgWaiting( e ); }
		function idUpdate( e ) { self.handleIdentity( e ); }
		function relation( e ) { self.updateRelation( e ); }
		
		self.sourceIds.push( msgId );
		self.sourceIds.push( waitId );
		self.sourceIds.push( idId );
		self.sourceIds.push( relId );
		
		self.el.addEventListener( 'click', elClick, false );
		if ( self.menuBtn ) {
			if ( 'DESKTOP' === window.View.deviceType )
				self.menuBtn.addEventListener( 'click', menuClick, false );
			else
				self.menuBtn.addEventListener( 'touchend', menuClick, false );
		}
		
		function elClick( e ) {
			self.handleBodyClick();
		}
		
		function menuClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.handleMenuClick();
		}
		
	}
	
	ns.RecentItem.prototype.updateRelation = function( relation ) {
		const self = this;
		const lastMessage = relation.lastMessage;
		const unread = relation.unreadMessages;
		if ( lastMessage )
			self.setMessage( lastMessage.data );
		
		if ( null != unread )
			self.setUnread( unread );
	}
	
	ns.RecentItem.prototype.releaseSource = function() {
		const self = this;
		if ( !self.source || !self.sourceIds )
			return;
		
		self.sourceIds.forEach( id => self.source.off( id ));
		self.sourceIds = [];
		delete self.source;
	}
	
	ns.RecentItem.prototype.getTmplConf = function() {
		const self = this;
		return {
			id            : self.id,
			avatar        : self.source.getAvatar(),
			statusId      : self.status,
			name          : self.source.getName(),
			lastEventIcon : '',
			lastMsgTime   : '',
			lastMsg       : '',
			unreadId      : self.unread,
			callStatusId  : self.callStatus,
		};
	}
	
	ns.RecentItem.prototype.bindElement = function() {
		const self = this;
		self.icon = self.el.querySelector( '.recent-info .recent-state .last-event-icon i' );
		self.message = self.el.querySelector( '.recent-info .recent-state .last-message' );
		self.messageTime = self.el.querySelector( '.recent-info .name-bar .last-msg-time' );
		//self.menuBtn = self.el.querySelector( '.item-menu' );
	}
	
	ns.RecentItem.prototype.buildIndicators = function() {
		const self = this;
		self.buildStatusIndicator();
		self.buildUnreadIndicator();
		self.buildCallStatus();
	}
	
	ns.RecentItem.prototype.buildStatusIndicator = function() {
		const self = this;
		self.status = new library.component.StatusIndicator({
			containerId : self.status,
			type        : 'led',
			cssClass    : 'led-online-status PadBorder',
			statusMap   : {
				offline   : 'Off',
				online    : 'On',
			},
		});
		self.handleOnline( self.source.getOnline());
		
		const onlineId = self.source.on( 'online', online );
		self.sourceIds.push( onlineId );
		
		function online( e ) { self.handleOnline( e ); }
	}
	
	ns.RecentItem.prototype.buildUnreadIndicator = function() {
		const self = this;
		self.unread = new library.component.StatusDisplay({
			containerId : self.unread,
			type        : 'led',
			cssClass    : 'led-unread-status',
			statusMap   : {
				'false'   : 'Off',
				'true'    : 'Notify',
			},
			display : '',
		});
		self.unread.hide();
	}
	
	ns.RecentItem.prototype.buildCallStatus = function() {
		const self = this;
		self.callStatus = new library.component.CallStatus( self.callStatus );
		self.callStatus.on( 'video', () => self.source.startVideo());
		self.callStatus.on( 'audio', () => self.source.startVoice());
		self.callStatus.on( 'show', () => self.source.showLive());
		
		const liveStateId = self.source.on( 'live-state', state => self.handleLiveState( state ));
		
		self.sourceIds.push( liveStateId );
	}
	
	ns.RecentItem.prototype.handleLiveState = function( state ) {
		const self = this;
		self.callStatus.setUserLive( state.user );
		self.callStatus.setContactLive( state.peer );
		
		if ( !state.missed )
			return;
		
		if ( !state.user && state.peer ) {
			setIncomming();
			return;
		}
		
		setMissed();
		
		function setIncomming() {
			const msg = View.i18n( 'i18n_incoming_call' );
			setLiveEvent( msg );
		}
		
		function setMissed() {
			const msg = View.i18n( 'i18n_missed_call' );
			setLiveEvent( msg );
		}
		
		function setLiveEvent( message ) {
			const inc = {
				type : 'live',
				data : {
					from    : null,
					message : message,
					time    : Date.now(),
				},
			};
			self.setEvent( inc );
		}
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
	
	ns.RecentItem.prototype.handleLive = function( event ) {
		const self = this;
		self.lastEvent = {
			type : 'live',
			data : event,
		};
		const now = library.tool.getChatTime( event.time );
		self.setIcon( 'live' );
		//self.name.textContent = '';
		self.message.textContent = event.message;
		self.messageTime.textContent = now;
		
		self.setActive( true );
	}
	
	ns.RecentItem.prototype.handleMsgWaiting = function( state ) {
		const self = this;
		self.setUnread( state.unreadMessages );
		if ( state.message )
			self.handleMessage( state );
	}
	
	ns.RecentItem.prototype.handleIdentity = function( id ) {
		const self = this;
		const nameEl = self.el.querySelector( '.name' );
		const avatarEl = self.el.querySelector( '.avatar' );
		if ( nameEl )
			nameEl.textContent = id.name;
		
		if ( avatarEl ) {
			const ava = "url('" + id.avatar + "')";
			avatarEl.style[ 'background-image' ] = ava;
		}
	}
	
	ns.RecentItem.prototype.setUnread = function( unread ) {
		const self = this;
		if ( !!unread ) {
			self.unread.set( 'true' );
			self.unread.setDisplay( unread );
			self.unread.show();
			self.setActive( true );
		} else {
			self.unread.hide();
			self.unread.set( 'false' );
			self.unread.setDisplay( '' );
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
		
		self.setIcon( 'message' );
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
	
	ns.RecentItem.prototype.setIcon = function( iconId ) {
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
	
	ns.RecentRoom.prototype.roomInit = function() {
		const self = this;
		self.eventMap = {
			'message' : e => self.handleMessage( e ),
			'live'    : e => self.handleLive( e ),
		};
	}
	
	ns.RecentRoom.prototype.baseClose = ns.RecentRoom.prototype.close;
	ns.RecentRoom.prototype.close = function() {
		const self = this;
		if ( self.live )
			self.live.close();
		
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
		//self.menuBtn = self.el.querySelector( '.item-menu' );
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
			cssClass    : 'led-participants-status PadBorder',
			statusMap   : {
				empty     : 'Off',
				users     : 'Available',
			},
			display     : '-',
		};
		self.status = new library.component.StatusDisplay( conf );
		const partyId = self.source.on( 'participants', parties );
		self.sourceIds.push( partyId );
		
		function parties( num ) { self.handleParties( num ); }
	}
	
	ns.RecentRoom.prototype.handleParties = function( num ) {
		const self = this;
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
	
	ns.RecentRoom.prototype.buildLiveIndicator = function() {
		const self = this;
		const conf = {
			containerId : self.live,
			type        : 'icon',
			cssClass    : 'fa-video-camera',
			statusMap   : {
				'empty'   : 'Off',
				'others'  : '',
				'user'    : 'Available',
			},
		};
		self.live = new library.component.StatusIndicator( conf );
		self.live.on( 'click', () => self.source.showLive());
		self.live.hide();
		
		const liveId = self.source.on( 'live', live );
		const userLiveId = self.source.on( 'live-user', ( e ) => userLive( e ))
		self.sourceIds.push( liveId );
		self.sourceIds.push( userLiveId );
		
		function live( isLive ) {
			if ( isLive ) {
				self.live.set( 'others' );
				self.live.show();
			}
			else {
				self.live.set( 'empty' );
				self.live.hide();
			}
		}
		
		function userLive( isLive ) {
			if ( isLive ) {
				self.live.set( 'user' );
				self.live.show();
			}
			
			let msg = null;
			if ( isLive )
				msg = 'You joined a live session';
			else
				msg = 'You were in a live session';
			
			const live = {
				type : 'live',
				data : {
					from    : null,
					time    : Date.now(),
					message : msg,
				},
			};
			
			self.setEvent( live );
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
			self.unread.setDisplay( state.unreadMessages || 1 );
			self.handleMessage( state );
		}
		
		function clear() {
			self.unread.hide();
			self.unread.setDisplay( '' );
		}
	}
	
	ns.RecentRoom.prototype.handleLive = function( event ) {
		const self = this;
		self.lastEvent = {
			type : 'live',
			data : event,
		};
		const now = library.tool.getChatTime( event.time );
		self.setIcon( 'live' );
		self.name.textContent = '';
		self.message.textContent = event.message;
		self.messageTime.textContent = now;
		
		self.setActive( true );
	}
	
})( library.view );
