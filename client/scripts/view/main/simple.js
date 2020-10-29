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
		self.activity = new library.view.Activity(
			window.View,
			'activity-events',
			hello.template
		);
		
		// Check if we *want* the inapp menu
		if ( settings && settings.inAppMenu ) {
			self.enableInAppMenu();
		}
		
		// tabs
		const activity = document.getElementById( 'activity-events' );
		const activityBtn = document.getElementById( 'show-activity' );
		const rooms = document.getElementById( 'rooms' );
		const roomsBtn = document.getElementById( 'show-rooms' );
		const contacts = document.getElementById( 'contacts' );
		const contactsBtn = document.getElementById( 'show-contacts' );
		
		activityBtn.addEventListener( 'click', recentClick, false );
		roomsBtn.addEventListener( 'click', roomsClick, false );
		contactsBtn.addEventListener( 'click', contactsClick, false );
		
		setActive( activity, activityBtn );
		
		function recentClick( e ) {
			btnClick();
			setActive( activity, activityBtn, true );
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
			containerId : 'activity-items',
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
	ns.Activity = function(
		pConn,
		containerId,
		template,
	) {
		const self = this;
		self.template = template;
		
		self.conn = null;
		self.history = null;
		self.modules = {};
		self.items = {};
		self.itemIds = [];
		self.itemOrder = null;
		
		self.loadingDone = false;
		
		self.init( pConn, containerId );
	}
	
	// Public
	
	ns.Activity.prototype.close = function() {
		const self = this;
		if ( self.itemOrder )
			self.itemOrder.close();
		
		//self.releaseModules();
		
		delete self.template;
		delete self.history;
		delete self.splash;
		delete self.noActivity;
		delete self.itemsContainer;
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
	
	// Private
	
	ns.Activity.prototype.init = function( parentConn, containerId ) {
		const self = this;
		self.conn = new library.component.EventNode( 'activity', parentConn, aSink );
		self.conn.on( 'loaded'  , e => self.handleLoaded(   e ));
		self.conn.on( 'reload'  , e => self.handleReload(   e ));
		self.conn.on( 'message' , e => self.handleMessage(  e ));
		self.conn.on( 'live'    , e => self.handleLive(     e ));
		self.conn.on( 'request' , e => self.handleRequest(  e ));
		self.conn.on( 'identity', e => self.handleIdUpdate( e ));
		self.conn.on( 'update'  , e => self.handleUpdate(   e ));
		self.conn.on( 'remove'  , e => self.handleRemove(   e ));
		
		function aSink( ...args ) {
			console.log( 'main.Activity aSink', args );
		}
		
		self.containerId = containerId;
		const container = document.getElementById( containerId );
		const tmplConf = {};
		self.el = self.template.getElement( 'activity-tmpl', tmplConf );
		container.appendChild( self.el );
		self.itemsContainer = document.getElementById( 'activity-items' );
		self.itemOrder = new library.component.ListOrder( 'activity-items', [ 'time' ]);
		
		self.splash = document.getElementById( 'activity-splash' );
		//self.waiting = document.getElementById( 'recent-waiting' );
		self.noActivity = document.getElementById( 'no-activity-items' );
		
		self.welcomeBox = document.getElementById( 'welcome-box' );
		/*
		const welcomeClose = document.getElementById( 'welcome-box-close' );
		welcomeClose.addEventListener( 'click', closeWelcome, false );
		*/
		
		//
		function closeWelcome() {
			self.closeWelcome();
		}
	}
	
	ns.Activity.prototype.closeWelcome = function() {
		const self =  this;
		self.welcomeBox.parentNode.removeChild( self.welcomeBox );
		delete self.welcomeBox;
		
		self.noActivity.classList.toggle( 'hidden', false );
	}
	
	ns.Activity.prototype.toggleItemsList = function( force ) {
		const self = this;
		if (( null == force ) && ( self.itemIds.length > 1 ))
			return;
		
		if ( self.welcomeBox )
			self.closeWelcome();
		
		let show = null;
		if ( null != force )
			show = force;
		else
			show = !!self.itemIds.length;
		
		if ( self.itemIds.length )
			self.splash.classList.toggle( 'hidden', true );
		else
			self.splash.classList.toggle( 'hidden', false );
	}
	
	ns.Activity.prototype.setLoading = function() {
		const self = this;
		self.loadingDone = false;
		window.View.showLoading( true );
	}
	
	ns.Activity.prototype.doneLoading = function() {
		const self = this;
		if ( null != self.loadingTimeout )
			window.clearTimeout( self.loadingTimeout );
		
		self.loadingDone = true;
		self.loadingTimeout = null;
		window.View.showLoading( false );
	}
	
	ns.Activity.prototype.handleReload = function( events ) {
		const self = this;
		/*
		if ( !events || !events.length )
			return;
		
		events.forEach( item => self.conn.handle( item ));
		*/
	}
	
	ns.Activity.prototype.handleLoaded = function() {
		const self = this;
		window.setTimeout( show, 300 );
		function show() {
			self.doneLoading();
		}
	}
	
	ns.Activity.prototype.handleUpdate = function( uptd ) {
		const self = this;
		const item = self.items[ uptd.id ];
		if ( !item ) {
			console.log( 'main.Activity.handleUpdate - no item for', uptd );
			return;
		}
		
		item.update( uptd.options );
		
		uptd.timestamp = null;
		self.updateItem( uptd );
	}
	
	ns.Activity.prototype.handleIdUpdate = function( e ) {
		const self = this;
		const id = e.id;
		const item = self.items[ id ];
		if ( !item ) {
			console.log( 'main.Activity.handleIdUpdate - no item for id', {
				e     : e,
				items : self.items,
			});
			return;
		}
		
		item.updateIdentity( e.identity );
	}
	
	ns.Activity.prototype.handleMessage = function( msg ) {
		const self = this;
		msg.icon = 'msg';
		const org = msg.message;
		const tip = org.slice( 0, 5 );
		let trans = null;
		if ( 'i18n_' === tip );
			trans = window.View.i18n( org );
		
		if ( org !== trans )
			msg.message = trans;
		
		const id = msg.id;
		let item = self.items[ id ];
		if ( !item )
			item = self.addRoomItem( msg );
		
		item.updateMessage( msg );
		self.updateItem( msg );
	}
	
	ns.Activity.prototype.handleLive = function( live ) {
		const self = this;
		live.icon = 'live';
		//live.message = View.i18n( live.message );
		const id = live.id;
		let item = self.items[ id ];
		if ( !item )
			item = self.addRoomItem( live );
		
		item.updateLive( live );
		self.updateItem( live );
	}
	
	ns.Activity.prototype.handleRequest = function( req ) {
		const self = this;
		const id = req.id;
		let item = self.items[ id ];
		if ( null != item )
			return;
		
		const parentId = 'activity-items';
		item = new library.view.ActivityRequest(
			parentId,
			self.conn,
			req
		);
		
		req.priority = 1;
		self.setItem( item, req );
	}
	
	ns.Activity.prototype.handleRemove = function( id ) {
		const self = this;
		const item = self.items[ id ];
		if ( !item ) {
			console.log( 'main.Activity.handleRemove - no item for', {
				id    : id,
				items : self.items,
			});
			return;
		}
		
		delete self.items[ id ];
		item.close();
		
		self.toggleItemsList();
	}
	
	ns.Activity.prototype.addQuery = function( modId, source ) {
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
	
	ns.Activity.prototype.addRoomItem = function( conf ) {
		const self = this;
		let Item = null;
		if ( 'contact' == conf.type )
			Item = library.view.ActivityContact;
		else
			Item = library.view.ActivityRoom;
		
		const parentId = 'activity-items';
		const item = new Item(
			parentId,
			self.conn,
			conf,
			conf.opts
		);
		
		self.setItem( item, conf );
		
		return item;
	}
	
	ns.Activity.prototype.setItem = function( item, conf ) {
		const self = this;
		const id = conf.id;
		self.items[ id ] = item;
		self.itemIds.push( id );
		
		const priConf = {
			clientId : id,
			priority : conf.priority || 0,
			time     : conf.timestamp,
		};
		self.itemOrder.add( priConf );
		
		self.toggleItemsList();
	}
	
	ns.Activity.prototype.updateItem = function( conf ) {
		const self = this;
		const opts = conf.options;
		const id = conf.id;
		const priConf = {
			clientId : id,
			//time     : conf.timestamp,
		};
		
		if ( null != conf.timestamp )
			priConf.time = conf.timestamp;
		
		if ( opts && ( null != opts.priority ))
			priConf.priority = opts.priority;
		if ( null != conf.priority )
			priConf.priority = conf.priority;
		
		self.itemOrder.update( priConf );
	}
	
	ns.Activity.prototype.handleItemRemove = function( moduleId, sourceId ) {
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
	
	ns.Activity.prototype.removeFromItemOrder = function( itemId ) {
		const self = this;
		self.itemOrder.remove( itemId );
	}
	
	ns.Activity.prototype.checkHistory = function( itemId ) {
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
	
	ns.Activity.prototype.send = function( event ) {
		const self = this;
		console.log( 'main.Activity.send - NYI', event );
	}
	
})( library.view );

/* base activity, must be extended */
(function( ns, undefined ) {
	ns.ActivityItem = function( containerId, conn, tmplConf ) {
		const self = this;
		self.id = tmplConf.id;
		self.conn = conn;
		
		self.build( containerId, tmplConf );
		self.bind();
		
		self.initItem();
	}
	
	ns.ActivityItem.prototype.build = function( cId, tmplConf ) {
		const self = this;
		if ( null == self.tmplId )
			throw new Error( 'ActivityItem - a template id must be defined' );
		
		const container = document.getElementById( cId );
		if ( null == container ) {
			console.log( 'main.ActivityItem.build - no container for id', cId );
			return;
		}
		
		if ( !tmplConf )
			throw new Error( 'main.ActivityItem.build - template config is required' );
		
		self.el = hello.template.getElement( self.tmplId, tmplConf );
		container.appendChild( self.el );
	}
	
	ns.ActivityItem.prototype.bind = function() {
		const self = this;
		throw new Error( 'ActivityItem.bind - implement in item' );
	}
	
	// "Public"
	
	ns.ActivityItem.prototype.update = function( options ) {
		const self = this;
		const keys = Object.keys( options );
		keys.forEach( key => {
			const value = options[ key ];
			self.updates.emit( key, value );
		});
	}
	
	ns.ActivityItem.prototype.updateIdentity = function( id ) {
		const self = this;
		throw new Error( 'ActivityItem.updateIdentity - implement in item')
	}
	
	ns.ActivityItem.prototype.updateMessage = function() {
		const self = this;
		throw new Error( 'ActivityItem.updateMessage - implement in item' );
	}
	
	ns.ActivityItem.prototype.updateLive = function() {
		const self = this;
		throw new Error( 'ActivityItem.updateLive - implement in item' );
	}
	
	ns.ActivityItem.prototype.close = function() {
		const self = this;
		if ( self.updates )
			self.updates.closeEventEmitter();
	}
	
	// "Private"
	
	ns.ActivityItem.prototype.iconMap = {
		'ph'   : 'fa-cube',
		'msg'  : 'fa-comment',
		'live' : 'fa-video-camera',
	};
	
	ns.ActivityItem.prototype.initItem = function() {
		const self = this;
		self.updates = new library.component.EventEmitter( uptdSink );
		
		function uptdSink( ...args ) {
			//console.log( 'ActivityItem updates sink', args );
		}
	}
	
	ns.ActivityItem.prototype.buildOnlineStatus = function() {
		const self = this;
		const conf = {
			containerId : self.status,
			type        : 'led',
			cssClass    : 'led-online-status PadBorder',
			statusMap   : {
				offline   : 'Off',
				online    : 'On',
			},
		};
		self.status = new library.component.StatusIndicator( conf );
	}
	
	ns.ActivityItem.prototype.buildRoomStatus = function() {
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
	}
	
	ns.ActivityItem.prototype.buildUnreadStatus = function() {
		const self = this;
		const conf = {
			containerId : self.unread,
			type        : 'led',
			cssClass    : 'led-unread-status',
			statusMap   : {
				'false'   : 'Off',
				'true'    : 'Available',
			},
			display : '',
			tooltip : View.i18n( 'i18n_unread_messages' ),
		};
		self.unread = new library.component.StatusDisplay( conf );
		self.unread.hide();
	}
	
	ns.ActivityItem.prototype.buildMentionStatus = function() {
		const self = this;
		const conf = {
			containerId : self.mention,
			type        : 'led',
			cssClass    : 'led-unread-status',
			statusMap   : {
				'false'   : 'Off',
				'true'    : 'Action',
			},
			display : '',
			tooltip : View.i18n( 'i18n_you_have_been_mentioned' ),
		};
		self.mention = new library.component.StatusDisplay( conf );
		self.mention.hide();
	}
	
	ns.ActivityItem.prototype.setEventIcon = function( iconId ) {
		const self = this;
		if ( iconId === self.currentIconId )
			return;
		
		if ( null != self.currentIconId ) {
			const curr = self.getEventIcon( self.currentIconId );
			self.icon.classList.toggle( curr, false );
		}
		
		const uptd = self.getEventIcon( iconId );
		self.icon.classList.toggle( uptd, true );
		self.currentIconId = iconId;
	}
	
	ns.ActivityItem.prototype.getEventIcon = function( iconId ) {
		const self = this;
		if ( null == iconId )
			return self.iconMap[ 'msg' ];
		
		return self.iconMap[ iconId ];
	}
	
	ns.ActivityItem.prototype.send = function( event ) {
		const self = this;
		const wrap = {
			type : 'item-event',
			data : {
				source : self.id,
				event  : event,
			},
		};
		self.conn.send( wrap );
	}
	
	ns.ActivityItem.prototype.sendOpen = function() {
		const self = this;
		const open = {
			type : 'open',
			data : Date.now(),
		};
		self.send( open );
	}
	
	
})( library.view );

// ActivityRoom
(function( ns, undefined ) {
	ns.ActivityRoom = function( containerId, conn, conf ) {
		const self = this;
		const tmplConf = self.setup( conf );
		library.view.ActivityItem.call( self, containerId, conn, tmplConf );
		
		self.init( conf );
	}
	
	ns.ActivityRoom.prototype =
		Object.create( library.view.ActivityItem.prototype );
		
	ns.ActivityRoom.prototype.tmplId = 'activity-room-tmpl';
	
	ns.ActivityRoom.prototype.bind = function() {
		const self = this;
		const el = self.el;
		self.avatar = el.querySelector( '.avatar' );
		self.avatarIcon = self.avatar.querySelector( 'i' );
		const info = el.querySelector( '.activity-info' );
		self.name = info.querySelector( '.name-bar .name' );
		self.time = info.querySelector( '.name-bar .last-msg-time' );
		self.icon = info.querySelector( '.activity-state .last-event-icon i' );
		self.lastMsgName = info.querySelector( '.activity-state .last-msg-name' );
		self.message = info.querySelector( '.activity-state .last-message' );
		
		self.el.addEventListener( 'click', bodyClick, false );
		
		function bodyClick( e ) {
			self.sendOpen();
		}
	}
	
	// Public
	
	ns.ActivityRoom.prototype.updateMessage = function( msg ) {
		const self = this;
		self.setEventIcon( 'msg' );
		self.lastMsgName.textContent = msg.from;
		self.message.textContent = msg.message;
		const time = library.tool.getChatTime( msg.timestamp );
		self.time.textContent = time;
		if ( msg.options )
			self.update( msg.options );
	}
	
	ns.ActivityRoom.prototype.updateLive = function( live ) {
		const self = this;
		self.setEventIcon( 'live' );
		self.lastMsgName.textContent = '';
		const text = View.i18n( live.message || 'i18n_this_ones_missing_fucko' );
		self.message.textContent = text;
		const time = library.tool.getChatTime( live.timestamp );
		self.time.textContent = time;
		if ( live.options )
			self.update( live.options );
	}
	
	ns.ActivityRoom.prototype.updateIdentity = function( id ) {
		const self = this;
		self.identity = id;
		self.name.textContent = id.name;
		if ( id && id.avatar ) {
			const ava = "url('" + id.avatar + "')";
			self.avatar.style[ 'background-image' ] = ava;
			self.avatarIcon.classList.toggle( 'hidden', true );
		}
		
		self.el.classList.toggle( 'placeholder-text', false );
	}
	
	ns.ActivityRoom.prototype.close = function() {
		const self = this;
		if ( self.updates )
			self.updates.closeEventEmitter();
		
		if ( self.unread )
			self.unread.close();
		
		if ( self.mention )
			self.mention.close();
		
		if ( self.live )
			self.live.close();
		
		delete self.updateds;
		delete self.unread;
		delete self.mention;
		delete self.live;
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
	}
	
	// Private
	
	ns.ActivityRoom.prototype.init = function( conf ) {
		const self = this;
		self.buildLiveIndicator();
		self.buildUnreadStatus();
		self.buildMentionStatus();
		
		self.updates.on( 'unread', e => self.handleUnread( e ));
		self.updates.on( 'mentions', e => self.handleMention( e ));
		self.updates.on( 'live', e => self.handleLiveNum( e ));
		self.updates.on( 'live-state', e => self.handleLiveState( e ));
	}
	
	ns.ActivityRoom.prototype.handleUnread = function( unread ) {
		const self = this;
		if ( !unread ) {
			self.unread.hide();
			self.unread.set( 'false' );
			self.unread.setDisplay( '' );
		} else {
			self.unread.show();
			self.unread.set( 'true' );
			self.unread.setDisplay( unread );
		}
	}
	
	ns.ActivityRoom.prototype.handleMention = function( mentions ) {
		const self = this;
		if ( !mentions ) {
			self.mention.hide();
			self.mention.set( 'false' );
			self.mention.setDisplay( '' );
		} else {
			self.mention.show();
			self.mention.set( 'true' );
			self.mention.setDisplay( mentions );
		}
	}
	
	ns.ActivityRoom.prototype.handleLiveNum = function( num ) {
		const self = this;
		self.liveNum = num;
		self.updateLiveDisplay();
	}
	
	ns.ActivityRoom.prototype.handleLiveState = function( state ) {
		const self = this;
		self.liveState = state;
		self.updateLiveDisplay();
	}
	
	ns.ActivityRoom.prototype.updateLiveDisplay = function() {
		const self = this;
		let state = 'empty';
		if ( !!self.liveNum )
			state = 'others';
		if ( 'user' == self.liveState )
			state = 'user';
		if ( 'client' == self.liveState )
			state = 'user';
		
		if ( 'empty' == state ) {
			self.live.hide();
			self.live.set( state );
		} else {
			self.live.show();
			self.live.set( state );
		}
	}
	
	ns.ActivityRoom.prototype.setup = function( conf ) {
		const self = this;
		const opts = conf.opts || {};
		const id = conf.identity;
		if ( id )
			self.identity = id;
		
		const name = !!id ? id.name : 'Place Holdername';
		const avatar = !!id ? id.avatar : '';
		const placeholder = !!id ? '' : 'placeholder-text';
		const roomIcon = ( id && id.avatar ) ? 'hidden' : '';
		self.live = friendUP.tool.uid( 'live' );
		self.unread = friendUP.tool.uid( 'unread' );
		self.mention = friendUP.tool.uid( 'mention' );
		const tmplConf = {
			id            : conf.id,
			placeholder   : placeholder,
			avatar        : avatar,
			roomIcon      : roomIcon,
			name          : name,
			lastMsgTime   : '',
			lastEventIcon : '',
			lastName      : '',
			lastMsg       : '',
			liveId        : self.live,
			unreadId      : self.unread,
			mentionId     : self.mention,
		};
		
		return tmplConf;
	}
	
	ns.ActivityRoom.prototype.buildLiveIndicator = function() {
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
		self.live.on( 'click', () => openLive());
		self.live.hide();
		
		function openLive() {
			const live = {
				type : 'live',
			};
			self.send( live );
		}
	}
	
})( library.view );

// ActivityRoom
( function( ns, undefined ) {
	ns.ActivityContact = function( containerId, conn, conf, opts ) {
		const self = this;
		library.view.ActivityRoom.call( self, containerId, conn, conf, opts );
	}
	
	ns.ActivityContact.prototype = 
		Object.create( library.view.ActivityRoom.prototype );
	
	ns.ActivityContact.prototype.tmplId = 'activity-contact-tmpl';
	
	ns.ActivityContact.prototype.updateIdentity = function( id ) {
		const self = this;
		self.identity = id;
		self.name.textContent = id.name;
		if ( id && id.avatar ) {
			const ava = "url('" + id.avatar + "')";
			self.avatar.style[ 'background-image' ] = ava;
			self.avatarIcon.classList.toggle( 'hidden', true );
		}
		
		self.el.classList.toggle( 'placeholder-text', false );
		
		self.checkIdOnline();
	}
	
	ns.ActivityContact.prototype.setup = function( conf ) {
		const self = this;
		const opts = conf.opts || {};
		const id = conf.identity;
		if ( id )
			self.identity = id;
		
		const time = library.tool.getChatTime( conf.timestamp );
		const name = !!id ? id.name : 'Place Holdername';
		const avatar = !!id ? id.avatar : '';
		const placeholder = !!id ? '' : 'placeholder-text';
		const roomIcon = ( id && id.avatar ) ? 'hidden' : '';
		self.status = friendUP.tool.uid( 'status' );
		self.callStatus = friendUP.tool.uid( 'call' );
		self.unread = friendUP.tool.uid( 'unread' );
		self.mention = friendUP.tool.uid( 'mention' );
		const tmplConf = {
			id            : conf.id,
			placeholder   : placeholder,
			avatar        : avatar,
			statusId      : self.status,
			roomIcon      : roomIcon,
			name          : name,
			lastMsgTime   : '',
			lastEventIcon : '',
			lastName      : '',
			lastMsg       : '',
			unreadId      : self.unread,
			mentionId     : self.mention,
			callStatusId  : self.callStatus,
		};
		
		return tmplConf;
	}
	
	ns.ActivityContact.prototype.close = function() {
		const self = this;
		if ( self.updates )
			self.updates.closeEventEmitter();
		
		if ( self.status )
			self.status.close();
		
		if ( self.unread )
			self.unread.close();
		
		if ( self.mention )
			self.mention.close();
		
		if ( self.callStatus )
			self.callStatus.close();
		
		delete self.updateds;
		delete self.status;
		delete self.unread;
		delete self.mention;
		delete self.callStatus;
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
	}
	
	// Pr1<>73
	
	ns.ActivityContact.prototype.init = function( conf ) {
		const self = this;
		self.buildOnlineStatus();
		self.buildUnreadStatus();
		self.buildMentionStatus();
		self.buildCallStatus();
		
		self.checkIdOnline();
		
		self.updates.on( 'status'    , e => self.handleStatus(    e ));
		self.updates.on( 'unread'    , e => self.handleUnread(    e ));
		self.updates.on( 'mentions'  , e => self.handleMention(   e ));
		self.updates.on( 'live'      , e => self.handleLiveNum(   e ));
		self.updates.on( 'live-state', e => self.handleLiveState( e ));
	}
	
	ns.ActivityContact.prototype.checkIdOnline = function() {
		const self = this;
		let online = false;
		if ( self.identity )
			online = self.identity.isOnline;
		
		if ( !online )
			self.handleStatus( 'offline' );
		else
			self.handleStatus( 'online' );
	}
	
	ns.ActivityContact.prototype.handleStatus = function( status ) {
		const self = this;
		if ( 'offline' == status )
			self.status.hide();
		else
			self.status.show();
		
		self.status.set( status );
	}
	
	ns.ActivityContact.prototype.updateLiveDisplay = function() {
		const self = this;
		const ls = self.liveState;
		if ( !self.callStatus || !ls )
			return;
		
		self.callStatus.setUserLive( ls.user );
		self.callStatus.setContactLive( ls.contact );
		
	}
	
	ns.ActivityContact.prototype.buildCallStatus = function() {
		const self = this;
		self.callStatus = new library.component.CallStatus( self.callStatus );
		self.callStatus.on( 'video', () => startVideo());
		self.callStatus.on( 'audio', () => startVoice());
		self.callStatus.on( 'show', () => showLive());
		
		function startVideo() {
			sendLive( 'video' );
		}
		
		function startVoice() {
			sendLive( 'audio' );
		}
		
		function showLive() {
			sendLive( 'show' );
		}
		
		function sendLive( conf ) {
			const live = {
				type : 'live',
				data : conf,
			};
			
			const wrap = {
				type : 'item-event',
				data : {
					source : self.id,
					event  : live,
				},
			};
			
			self.conn.send( wrap );
		}
	}
	
})( library.view );

// Activity request
(function( ns, undefined ) {
	ns.ActivityRequest = function( containerId, conn, conf ) {
		const self = this;
		self.id = conf.id;
		self.conn = conn;
		
		self.init( containerId, conf );
	}
	
	ns.ActivityRequest.prototype.tmplId = 'activity-request-tmpl';
	ns.ActivityRequest.prototype.btnTmplId = 'activity-request-btn-tmpl';
	
	ns.ActivityRequest.prototype.close = function() {
		const self = this;
		delete self.conn;
		delete self.id;
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
	}
	
	ns.ActivityRequest.prototype.build = function( cId, tmplConf ) {
		const self = this;
		const container = document.getElementById( cId );
		if ( null == container ) {
			console.log( 'main.ActivityItem.build - no container for id', cId );
			return;
		}
		
		if ( !tmplConf )
			throw new Error( 'main.ActivityItem.build - template config is required' );
		
		self.el = hello.template.getElement( self.tmplId, tmplConf );
		container.appendChild( self.el );
	}
	
	ns.ActivityRequest.prototype.bind = function( conf ) {
		const self = this;
		const butts = conf.responses;
		butts.forEach( key => {
			const butt = self.el.querySelector( '.response-container .' + key );
			butt.addEventListener( 'click', bClick, false );
			function bClick() {
				self.sendResponse( key );
			}
		});
		
	}
	
	ns.ActivityRequest.prototype.init = function( containerId, conf ) {
		const self = this;
		self.buttonMap = {
			'join'    : e => self.buildJoin( e ),
			'decline' : e => self.buildDecline( e ),
		};
		
		const tmplConf = self.setup( conf );
		self.build( containerId, tmplConf );
		self.bind( conf );
	}
	
	ns.ActivityRequest.prototype.sendResponse = function( response ) {
		const self = this;
		const event = {
			type : 'response',
			data : response,
		};
		
		const wrap = {
			type : 'item-event',
			data : {
				source : self.id,
				event  : event,
			},
		};
		self.conn.send( wrap );
	}
	
	ns.ActivityRequest.prototype.setup = function( conf ) {
		const self = this;
		const btns = conf.responses;
		const btnHtmls = btns.map( btnKey => {
			const handler = self.buttonMap[ btnKey ];
			const htmlStr = handler();
			return htmlStr;
		});
		const buttonHtml = btnHtmls.join( '' );
		const tmplConf = {
			id      : conf.id,
			type    : conf.type || 'room',
			avatar  : conf.identity.avatar,
			message : conf.message,
			buttons : buttonHtml,
		};
		
		return tmplConf;
	}
	
	ns.ActivityRequest.prototype.buildJoin = function() {
		const self = this;
		const conf = {
			type       : 'join',
			btnKlasses : 'Accept',
			title      : 'Join',
			faKlass    : 'fa-check',
			btnText    : 'Join',
		};
		const html = hello.template.get( self.btnTmplId, conf );
		return html;
	}
	
	ns.ActivityRequest.prototype.buildDecline = function() {
		const self = this;
		const conf = {
			type       : 'decline',
			btnKlasses : '',
			title      : 'Decline',
			faKlass    : 'fa-close',
			btnText    : 'Decline',
		};
		const html = hello.template.get( self.btnTmplId, conf );
		return html;
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
