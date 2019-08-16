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

// BASE CONTACT
(function( ns, undefined ) {
	ns.BaseContact = function( conf, conn ) {
		if ( !( this instanceof ns.BaseContact ))
			return new ns.BaseContact( conf );
		
		const self = this;
		library.component.EventEmitter.call( self, eventSink );
		self.clientId = self.data.clientId;
		self.id = self.clientId;
		self.priority = self.data.priority;
		self.identity = self.data.identity;
		self.containerId = conf.containerId;
		self.menuActions = conf.menuActions;
		
		self.conn = null;
		
		self.baseContactInit( conn || conf.conn );
		
		function eventSink() {
			//console.log( 'BaseContact, eventSink', arguments );
		}
	}
	
	ns.BaseContact.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.BaseContact.prototype.getName = function() {
		const self = this;
		return self.identity.name || '';
	}
	
	ns.BaseContact.prototype.getOnline = function() {
		const self = this;
		return false;
	}
	
	ns.BaseContact.prototype.getPriority = function() {
		const self = this;
		return self.data.priority || 0;
	}
	
	ns.BaseContact.prototype.getAvatar = function() {
		const self = this;
		return self.identity.avatar || '';
	}
	
	ns.BaseContact.prototype.getUnreadMessages = function() {
		const self = this;
		return self.unreadMessages || 0;
	}
	
	ns.BaseContact.prototype.getLastMessage = function() {
		const self = this;
		return self.lastMessage || null;
	}
	
	ns.BaseContact.prototype.openChat = function() {
		const self = this;
		self.handleAction( 'open-chat' );
	}
	
	ns.BaseContact.prototype.startVideo = function( perms ) {
		const self = this;
		//self.startLive( 'video', perms );
		self.handleAction( 'live-video', perms );
	}
	
	ns.BaseContact.prototype.startVoice = function( perms ) {
		const self = this;
		//self.startLive( 'audio', perms );
		self.handleAction( 'live-audio', perms );
	}
	
	ns.BaseContact.prototype.handleAction = function( action, data ) {
		const self = this;
		self.send({
			type : action,
			data : data,
		});
	}
	
	ns.BaseContact.prototype.getMenuOptions = function() {
		throw new Error( 'BaseContact.getMenuOptions - implement in extension' );
	}
	
	// Private
	
	ns.BaseContact.prototype.baseContactInit = function( parentConn ) {
		const self = this;
		self.setupConn( parentConn );
		self.lastMessage = self.data.lastMessage || null;
		self.menuActions = new library.component.MiniMenuActions();
		self.buildElement(); // must be defined for each contact
		self.bindItem();
	}
	
	ns.BaseContact.prototype.setupConn = function( parentConn ) {
		const self = this;
		self.conn = new library.component.EventNode(
			self.clientId,
			parentConn,
		);
		
		self.conn.on( 'identity', updateIdentity );
		function updateIdentity( msg ) { self.updateIdentity( msg ); }
	}
	
	ns.BaseContact.prototype.updateIdentity = function( id ) {
		const self = this;
		self.identity = id;
		self.updateName();
		self.updateAvatar();
		self.emit( 'identity', self.identity );
	}
	
	ns.BaseContact.prototype.updateName = function() {
		const self = this;
		var element = document.getElementById( self.clientId );
		var nameEl = element.querySelector( '.name' );
		if ( !nameEl ) {
			console.log( 'BaseContact.updateName - could not find name element', self );
			return;
		}
		
		nameEl.textContent = self.identity.name;
	}
	
	ns.BaseContact.prototype.updateAvatar = function() {
		const self = this;
		const element = document.getElementById( self.clientId );
		const avatarEl = element.querySelector( '.avatar' );
		if ( !avatarEl ) {
			console.log( 'BaseContact.updateAvatar - could not find avatar element', self );
			return;
		}
		
		const ava = self.identity.avatar || '';
		avatarEl.style[ 'background-image' ] = "url('" + ava + "')";
	}
	
	ns.BaseContact.prototype.bindItem = function() {
		const self = this;
		var element = document.getElementById( self.clientId );
		self.itemMenu = element.querySelector( '.item-menu' );
		
		element.addEventListener( 'click', click, false );
		if ( self.itemMenu ) {
			if ( 'DESKTOP' === window.View.deviceType )
				self.itemMenu.addEventListener( 'click', menuClick, false );
			else
				self.itemMenu.addEventListener( 'touchend', menuClick, false );
		}
		
		function click( e ) { self.openChat(); }
		function menuClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.showMenu( e );
		}
	}
	
	ns.BaseContact.prototype.showMenu = function( e ) {
		const self = this;
		e.stopPropagation();
		const options = self.getMenuOptions();
		if ( !options || !options.length )
			return;
		
		new library.component.MiniMenu(
			hello.template,
			self.itemMenu,
			'hello',
			options,
			onSelect
		);
		
		function onSelect( selected ) {
			self.handleAction( selected );
		}
	}
	
	ns.BaseContact.prototype.startLive = function( mode, perms ) {
		const self = this;
		mode = mode || 'video';
		self.send({
			type : 'start-live',
			data : {
				mode        : mode,
				permissions : perms,
			},
		});
	}
	
	ns.BaseContact.prototype.remove = function() {
		const self = this;
		self.send({
			type: 'remove',
		});
	}
	
	ns.BaseContact.prototype.send = function( msg ) {
		const self = this;
		self.conn.send( msg );
	}
	
	ns.BaseContact.prototype.close = function() {
		const self = this;
		self.conn.close();
		
		var element = document.getElementById( self.clientId );
		element.parentNode.removeChild( element );
		delete self.lastMessage;
		self.closeEventEmitter();
	}
	
})( library.view );


// BASEMODULE
(function( ns, undefined ) {
	ns.BaseModule = function( conf ) {
		if ( !( this instanceof ns.BaseModule ))
			return new ns.BaseModule( conf );
		
		const self = this;
		library.component.EventEmitter.call( self, eventSink );
		
		self.clientId = conf.module.clientId;
		self.id = self.clientId;
		self.containers = conf.containers; // holds the element id for
		// conference rooms and contacts in .conference and .contact
		// Append module element to the relevant element
		self.type = conf.module.type;
		self.module = conf.module;
		self.identity = conf.identity;
		self.tmplId = conf.tmplId || '';
		
		self.mod = null;
		self.errorStrings = null;
		self.updateMap = null;
		self.queryMap = null;
		self.infoMap = null;
		self.serverMessage = null;
		
		self.roomsId = null;
		self.roomItemsId = null;
		self.rooms = {};
		self.roomIds = [];
		self.contactsId = null;
		self.contactItemsId = null;
		self.contacts = {};
		self.contactIds = [];
		
		
		self.initBaseModule( conf.parentView );
		
		function eventSink() {
			//console.log( 'BaseModule, eventSink', arguments );
		}
	}
	
	ns.BaseModule.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	
	
	// Implement in module
	
	/*
	getMenuOptions
	
	returns an array of actions available for the module.
	Predefined actions can be used from self.menuActions,
	an instance of library.component.MiniMenuActions
	*/
	ns.BaseModule.prototype.getMenuOptions = function() {
		const self = this;
		throw new Error( 'BaseModule.getMenuOptions - implement for module' );
		return [
			self.menuActions[ 'settings' ],
		];
	}
	
	/*
	setLogoCss
	
	Does nothing for normal UI. For advanced UI it sets the css for
	the logo in the head of the module
	
	for the icon logo, set the icon in html, then use this to set special css for it
	for the image logo, pass the url and it will be set as background image
	*/
	ns.BaseModule.prototype.setLogoCss = function() {
		const self = this;
		throw new Error( 'BaseModule.setLogoCss - implement for module' );
		// Two options exist, feel free to add more. These are defined in main.html
		const tmplId = 'fa-icon-logo-css-tmpl' || 'image-logo-css-tmpl';
		// template conf
		const conf = {
			logoPath  : 'url.to/thing.jpg',
		};
		self.insertLogoCss( tmplId, conf, self.roomsId );
		self.insertLogoCss( tmplId, conf, self.contactsId );
	}
	
	/*
	updateTitle
	
	Updates the head bar of the module during initializtion and in response
	to various events from app
	
	Use with base module template, implement in module of custom templates
	where the selector no longer fits
	*/
	ns.BaseModule.prototype.updateTitle = function( type ) {
		const self = this;
		const title = self.getTitleString( type );
		let elId = null;
		if ( 'conference' === type )
			elId = self.roomsId;
		else
			elId = self.contactsId;
		
		if( !elId || !title )
			return;
		
		const parentElement = document.getElementById( elId );
		const titleElement = parentElement.querySelector( '.module-title' );
		titleElement.textContent = title;
	}
	
	/*
	getTitleString
	type - 'conference' | 'contact'
	
	title to be set in module head, either for conference rooms or
	contacts ui element
	
	( below is the old default that doesnt care about type )
	*/
	ns.BaseModule.prototype.getTitleString = function( type ) {
		const self = this;
		let title = '';
		let modName = '';
		if ( self.identity )
			title = self.identity.name || '';
		
		if ( self.module )
			modName = self.module.name || '';
		
		if ( title.length && modName.length )
			title += ( ' - ' + modName );
		else
			title = modName;
		
		return title;
	}
	
	/*
	bindMenuButton
	
	binds the minimenu button on the module head, implement for module
	if this queryselector no longer fits
	
	*/
	ns.BaseModule.prototype.bindMenuButton = function() {
		const self = this;
		const roomsEl = document.getElementById( self.roomsId );
		const contactsEl = document.getElementById( self.contactsId );
		if ( roomsEl ) {
			self.roomsMenu = roomsEl.querySelector( '.actions .item-menu' );
			if ( 'DESKTOP' === window.View.deviceType )
				self.roomsMenu.addEventListener( 'click', roomsMenuClick, false );
			else
				self.roomsMenu.addEventListener( 'touchend', roomsMenuClick, false );
		}
		
		if ( contactsEl ) {
			self.contactsMenu = contactsEl.querySelector( '.actions .item-menu' );
			if ( 'DESKTOP' === window.View.deviceType )
				self.contactsMenu.addEventListener( 'click', contactsMenuClick, false );
			else
				self.contactsMenu.addEventListener( 'touchend', contactsMenuClick, false );
		}
		
		function roomsMenuClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.showMenu( 'conference' );
		}
		
		function contactsMenuClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.showMenu( 'contact' );
		}
	}
	
	/*
	buildElement
	
	*/
	ns.BaseModule.prototype.buildElement = function() {
		const self = this;
		self.roomsId = friendUP.tool.uid( 'rooms' );
		self.roomsFoldit = friendUP.tool.uid( 'fold' );
		self.roomsConnState = friendUP.tool.uid( 'conn' );
		self.roomItemsId = friendUP.tool.uid( 'items' );
		
		self.contactsId = friendUP.tool.uid( 'contact' );
		self.contactsFoldit = friendUP.tool.uid( 'fold' );
		self.contactsConnState = friendUP.tool.uid( 'conn' );
		self.contactItemsId = friendUP.tool.uid( 'items' );
		
		self.buildRoomsElement();
		self.buildContactsElement();
	}
	
	/*
	buildContact - example
	called by BaseModule.initBaseModule, each module must implement.
	
	This shows building for a contact list, the module may
	probably want to split it into separate conference rooms
	and contacts parts.
	
	self.roomsId
	self.contactsId
	are expected and should be used. Leave as null if the module does not
	have either rooms or contacts
	
	self.contactsFoldit
	self.contactsConnState
	are expected. They are initialy an Id, but will be overwritten by BaseModule.initFoldit and
	BaseModule.initConnStatus to reference the ui widget.
	
	*/
	ns.BaseModule.prototype.buildContactsElement = function() {
		const self = this;
		throw new Error( 'BaseModule.buildContactsElement - implement in module' );
		const tmplId = self.tmplId || 'base-module-tmpl';
		const conf = {
			clientId    : self.contactsId,
			folditId    : self.contactsFoldit,
			moduleTitle : self.module.name,
			connStateId : self.contactsConnState,
			itemsId     : self.contactItemsId,
		};
		
		const element = hello.template.getElement( tmplId, conf );
		const container = document.getElementById( self.containers.contacts );
		container.appendChild( element );
	}
	
	/*
	buildRoomsElement
	
	example for a module that doesnt have rooms. Another option would
	be to override .buildElement
	*/
	ns.BaseModule.prototype.buildRoomsElement = function() {
		const self = this;
		throw new Error( 'BaseModule.buildRoomsElement - implement in module' );
		self.roomsId = null;
		self.roomsFoldit = null;
		self.roomsConnState = null;
		self.roomItemsId = null;
	}
	
	/*
	bindModuleEvents
	
	module events sent from the app to view pop out of the self.mod object
	*/
	ns.BaseModule.prototype.bindModuleEvents = function() {
		const self = this;
		throw new Error( 'BaseModule.bindModuleEvents - implement in module' );
		
		self.mod.on( 'event-name', handler );
		function handler( event ) {}
	}
	
	
	/*
	bindUI
	
	called after buildElement, implement for module if needed
	*/
	ns.BaseModule.prototype.bindUI = function() {
		const self = this;
	}
	
	/*
	closeChildren
	
	Called when the module is closed. Implement in module if required
	Must close and release all resources held by conference rooms and contacts
	*/
	ns.BaseModule.prototype.closeChildren = function() {
		const self = this;
		if ( self.rooms ) {
			close( self.rooms );
			delete self.rooms;
		}
		
		if ( self.contacts ) {
			close( self.contacts );
			delete self.contacts;
		}
		
		function close( items ) {
			let ids = Object.keys( items );
			ids.forEach( id => {
				let item = items[ id ];
				item.close();
			});
		}
	}
	
	/*
	setServerMessageBox
	
	sets the object that shows info messages from the server, 
	like 'module initializeing' etc
	
	Usually the/a items container is used for this
	
	*/
	ns.BaseModule.prototype.setServerMessageBox = function() {
		const self = this;
		const boxConf = {
			element     : null,
			containerId : self.roomItemsId,
		};
		self.serverMessage = new library.component.InfoBox( boxConf );
	}
	
	/*
	close
	
	Implement for module. Must release all resources held by the module
	Must call closeBaseModule
	*/
	ns.BaseModule.prototype.close = function() {
		const self = this;
		throw new Error( 'BaseModule.close - implement for module' );
		
		self.closeBaseModule();
	}
	
	// Private
	
	ns.BaseModule.prototype.initBaseModule = function( parentConn ) {
		const self = this;
		if ( !self.identity ) {
			self.identity = {
				name : '---',
				avatar : null,
			};
		}
		
		self.buildElement();
		self.setLogoCss();
		self.initFoldit();
		self.initConnStatus();
		self.bindMenuButton();
		self.updateTitle();
		self.bindUI();
		
		self.menuActions = new library.component.MiniMenuActions();
		
		// app.module interface
		self.mod = new library.component.EventNode(
			self.clientId,
			parentConn,
		);
		self.mod.on( 'connection', connection );
		self.mod.on( 'update', applyUpdate );
		self.mod.on( 'query', handleQuery );
		self.mod.on( 'info', handleInfo );
		
		function connection( e ) { self.connectionHandler( e ); }
		function applyUpdate( e ) { self.updateHandler( e ); }
		function handleQuery( e ) { self.queryHandler( e ); }
		function handleInfo( e ) { self.infoHandler( e ); }
		
		self.updateMap = {
			'module'   : updateModule,
			'identity' : updateIdentity,
		};
		
		function updateModule( msg ) { self.updateModule( msg ); }
		function updateIdentity( msg ) { self.updateIdentity( msg ); }
		
		self.errorStrings = {
			'ERR_HOST_ENOTFOUND'    : View.i18n('i18n_host_was_not_found'),
			'ERR_HOST_EHOSTUNREACH' : View.i18n('i18n_host_is_unreachable'),
			'ERR_HOST_ETIMEDOUT'    : View.i18n('i18n_connection_timed_out'),
			'ERR_RESPONSE_NOT_OK'   : View.i18n('i18n_host_declined_request'),
		}
		
		
		self.queryMap = {
			'text'           : queryText,
			'retry'          : queryRetry,
			'secure'         : querySecure,
			'secure-confirm' : querySecureConfirm,
			'password'       : queryPassword,
		};
		
		function queryText( e ) { self.queryText( e ); }
		function queryRetry( e ) { self.queryRetry( e ); }
		function querySecure( e ) { self.querySecure( e ); }
		function querySecureConfirm( e ) { self.querySecureConfirm( e ); }
		function queryPassword( e ) { self.queryPassword( e ); }
		
		self.infoMap = {
			'clear'        : clearInfo,
			'message'      : showMessage,
			'initializing' : showInitializing,
		};
		
		function clearInfo( e ) { self.clearInfo( e ); }
		function showMessage( e ) { self.showMessage( e ); }
		function showInitializing( e ) { self.showInitializing( e ); }
		
		
		self.setServerMessageBox();
	}
	
	// Show the menu for the base module
	ns.BaseModule.prototype.showMenu = function( type ) {
		const self = this;
		if ( !type )
			return;
		
		let menuEl = null;
		if ( 'conference' === type )
			menuEl = self.roomsMenu;
		
		if ( 'contact' === type )
			menuEl = self.contactsMenu;
		
		if ( !menuEl )
			return;
		
		const opts = self.getMenuOptions( type );
		if ( !opts || !opts.length )
			return;
		
		new library.component.MiniMenu(
			hello.template,
			menuEl,
			'hello',
			opts,
			onSelect,
		);
		
		function onSelect( action ) {
			self.handleAction( action, type );
		}
	}
	
	ns.BaseModule.prototype.handleAction = function( type, data ) {
		const self = this;
		const action = {
			type : type,
			data : data,
		};
		self.send( action );
	}
	
	ns.BaseModule.prototype.initFoldit = function() {
		const self = this;
		if ( self.roomsFoldit )
			self.roomsFoldit = new library.component.Foldit({
				folderId : self.roomsFoldit,
				foldeeId : self.roomItemsId,
			});
		
		if ( self.contactsFoldit )
			self.contactsFoldit = new library.component.Foldit({
				folderId : self.contactsFoldit,
				foldeeId : self.contactItemsId,
			});
	}
	
	ns.BaseModule.prototype.initConnStatus = function() {
		const self = this;
		const conf = {
			containerId : null,
			type        : 'icon',
			cssClass    : 'fa-circle-o',
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
	
	ns.BaseModule.prototype.insertLogoCss = function( tmplId, conf, elementId ) {
		const self = this;
		tmplId = tmplId || 'fa-icon-logo-css-tmpl';
		elementId = elementId || self.clientId;
		conf.moduleId = elementId;
		const cssId = self.getLogoCssId( elementId );
		const exists = document.getElementById( cssId );
		if ( exists )
			self.removeLogoCss( elementId );
		
		const cssElement = hello.template.getElement( tmplId, conf );
		document.head.appendChild( cssElement );
	}
	
	ns.BaseModule.prototype.removeLogoCss = function( elementId ) {
		const self = this;
		const cssId = self.getLogoCssId( elementId );
		const cssElement = document.getElementById( cssId );
		if ( !cssElement )
			return;
		
		cssElement.parentNode.removeChild( cssElement );
	}
	
	ns.BaseModule.prototype.getLogoCssId = function( elementId ) {
		const self = this;
		const id = elementId + '-logo-css';
		return id;
	}
	
	ns.BaseModule.prototype.showInitializing = function() {
		const self = this;
		if ( self.initalized )
			return;
		
		var id = friendUP.tool.uid( 'init' );
		var conf = {
			id : id,
		};
		var element = hello.template.getElement( 'module-initializing-tmpl', conf );
		self.serverMessage.show( element );
	}
	
	ns.BaseModule.prototype.showMessage = function( message ) {
		const self = this;
		var id = friendUP.tool.uid( 'message' );
		var conf = {
			id : id,
			message : message,
		};
		var element = hello.template.getElement( 'module-message-tmpl', conf );
		self.serverMessage.show( element );
	}
	
	ns.BaseModule.prototype.clearInfo = function() {
		const self = this;
		self.serverMessage.hide();
	}
	
	ns.BaseModule.prototype.connectionHandler = function( state ) {
		const self = this;
		if ( self.roomsConnState )
			self.roomsConnState.set( state.type );
		
		if ( self.contactsConnState )
			self.contactsConnState.set( state.type );
	}
	
	ns.BaseModule.prototype.updateHandler = function( update ) {
		const self = this;
		if ( !self.updateMap )
			throw new Error( 'no updateMap defined for module: ' + self.type );
		
		var handler = self.updateMap[ update.type ];
		if ( !handler ) {
			console.log( 'BaseModule.updateHandler - no handler for', update );
			return;
		}
		
		handler( update.data );
	}
	
	ns.BaseModule.prototype.updateModule = function( update ) {
		const self = this;
		self.module.name = update.name;
		self.updateTitle();
	}
	
	ns.BaseModule.prototype.updateIdentity = function( update ) {
		const self = this;
		self.identity = update;
		self.updateTitle();
	}
	
	ns.BaseModule.prototype.queryHandler = function( msg ) {
		const self = this;
		var handler = self.queryMap[ msg.type ];
		if ( !handler ) {
			console.log( 'mod.handleQuery - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.BaseModule.prototype.querySecure = function( data ) {
		const self = this;
		var tmplConf = {
			id : friendUP.tool.uid( 'query-secure' ),
			message : data.message || '',
			placeholder : data.value || '',
		};
		var element = hello.template.getElement( 'query-secure-tmpl', tmplConf );
		self.serverMessage.show( element );
		bind( element );
		
		function bind( element ) {
			var input = element.querySelector( 'input' );
			element.addEventListener( 'submit', passSubmit, false );
			function passSubmit( e ) {
				e.preventDefault();
				e.stopPropagation();
				var callbackId = data.callbackId;
				var value = input.value.trim();
				if ( !value.length )
					return;
				
				self.returnQuery( callbackId, value );
			}
		}
	}
	
	ns.BaseModule.prototype.querySecureConfirm = function( data ) {
		const self = this;
		var conf = {
			id      : friendUP.tool.uid( 'query-secure-confirm' ),
			message : data.message || '',
			value : data.value || '',
		};
		var element = hello.template.getElement( 'query-secure-confirm-tmpl', conf );
		self.serverMessage.show( element );
		bind( element );
		
		function bind( element ) {
			var input = element.querySelector( 'input' );
			var secBtn = element.querySelector( 'button' );
			element.addEventListener( 'submit', submit, false );
			
			function submit( e ) {
				e.preventDefault();
				e.stopPropagation();
				var callbackId = data.callbackId;
				var value = input.value.trim();
				if ( !value.length )
					return;
				
				self.returnQuery( callbackId, value );
			}
		}
	}
	
	ns.BaseModule.prototype.queryPassword = function( data ) {
		const self = this;
		var tmplConf = {
			id : friendUP.tool.uid( 'query-password' ),
			message : data.message || '',
			resetLink : data.value || '',
		};
		var element = hello.template.getElement( 'query-password-tmpl', tmplConf );
		self.serverMessage.show( element );
		bind( element );
		
		function bind( element ) {
			var input = element.querySelector( 'input' );
			var passBtn = element.querySelector( '.pass-reset' );
			element.addEventListener( 'submit', passSubmit, false );
			passBtn.addEventListener( 'click', resetClick, false );
			
			function passSubmit( e ) {
				e.preventDefault();
				e.stopPropagation();
				var callbackId = data.callbackId;
				var value = input.value.trim();
				if ( !value.length )
					return;
				
				self.returnQuery( callbackId, value );
			}
			
			function resetClick( e ) {
				e.stopPropagation();
				e.preventDefault();
				var passReset = {
					type : 'pass-reset',
				}
				
				self.send( passReset );
				self.serverMessage.hide();
			}
		}
	}
	
	ns.BaseModule.prototype.queryText = function( data ) {
		const self = this;
		var conf = {
			id      : friendUP.tool.uid( 'query-text' ),
			message : data.message || '',
			value   : data.value || '',
		};
		var element = hello.template.getElement( 'query-text-tmpl', conf );
		self.serverMessage.show( element );
		bind( element );
		
		function bind( element ) {
			var input = element.querySelector( 'input' );
			element.addEventListener( 'submit', submit, false );
			function submit( e ) {
				e.preventDefault();
				e.stopPropagation();
				var callbackId = data.callbackId;
				var value = input.value.trim();
				if ( !value.length )
					return;
				
				self.returnQuery( callbackId, value );
			}
		}
	}
	
	ns.BaseModule.prototype.queryRetry = function( data ) {
		const self = this;
		const tmplConf = {
			id         : friendUP.tool.uid( 'query-retry' ),
			message    : data.message || '',
			retryText  : data.value.retry,
			cancelText : data.value.cancel,
		};
		const el = hello.template.getElement( 'query-retry-tmpl', tmplConf );
		self.serverMessage.show( el );
		bind( el );
		
		function bind( e ) {
			let callbackId = data.callbackId;
			let cancelBtn = el.querySelector( 'button.cancel' );
			el.addEventListener( 'submit', retry, false );
			cancelBtn.addEventListener( 'click', cancel, false );
			
			function retry( e ) {
				e.preventDefault();
				e.stopPropagation();
				self.returnQuery( callbackId, true );
			}
			
			function cancel( e ) {
				e.preventDefault();
				e.stopPropagation();
				self.returnQuery( callbackId, false );
			}
		}
	}
	
	ns.BaseModule.prototype.returnQuery = function( callbackId, value ) {
		var self= this;
		var data = {
			value : value,
			callbackId : callbackId,
		};
		
		var wrap = {
			type : 'query',
			data : data,
		};
		
		self.send( wrap );
		self.serverMessage.hide();
	}
	
	ns.BaseModule.prototype.infoHandler = function( info ) {
		const self = this;
		var handler = self.infoMap[ info.type ];
		if ( !handler ) {
			console.log( 'no handler for info', info );
			return;
		}
		
		handler( info.data );
	}
	
	ns.BaseModule.prototype.send = function( msg ) {
		const self = this;
		self.mod.send( msg );
	}
	
	ns.BaseModule.prototype.closeBaseModule = function() {
		const self = this;
		self.closeChildren();
		self.mod.close();
		if ( self.serverMessage )
			self.serverMessage.close();
		
		self.removeLogoCss( self.roomsId );
		self.removeLogoCss( self.contactsId );
		
		const element = document.getElementById( self.clientId );
		element.parentNode.removeChild( element );
		self.closeEventEmitter();
		
		delete self.menuActions;
		delete self.serverMessage;
		delete self.updateMap;
		delete self.queryMap;
		delete self.infoMap;
	}
	
})( library.view );


// QUERY ITEM
(function( ns, undefined ) {
	ns.QueryItem = function(
		containerId,
		clientId,
		queryMsg,
		avatar,
		typeKlass,
		source
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		self.type = 'query';
		self.id = clientId;
		self.queryMsg = queryMsg;
		self.avatar = avatar;
		self.typeKlass = typeKlass;
		self.source = source;
		
		self.init( containerId );
	}
	
	ns.QueryItem.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.QueryItem.prototype.accept = function() {
		const self = this;
		if ( self.source ) {
			self.source.accept();
			return;
		}
		
		self.respond( true );
	}
	
	ns.QueryItem.prototype.reject = function() {
		const self = this;
		if ( self.source ) {
			self.source.reject();
			return;
		}
		
		self.respond( false );
	}
	
	ns.QueryItem.prototype.close = function() {
		const self = this;
		self.closeEventEmitter();
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
		delete self.source;
	}
	
	// Private
	
	ns.QueryItem.prototype.init = function( containerId ) {
		const self = this;
		const conf = {
			id        : self.id,
			typeKlass : self.typeKlass,
			avatar    : self.avatar,
			queryMsg  : self.queryMsg,
		};
		
		self.el = hello.template.getElement( 'query-item-tmpl', conf );
		const container = document.getElementById( containerId );
		container.appendChild( self.el );
		const acceptBtn = self.el.querySelector( '.response-container .accept' );
		const rejectBtn = self.el.querySelector( '.response-container .reject' );
		acceptBtn.addEventListener( 'click', accept, true );
		rejectBtn.addEventListener( 'click', reject, true );
		
		function accept( e ) {
			setSpinny( acceptBtn );
			self.accept();
		}
		
		function reject( e ) {
			setSpinny( rejectBtn );
			self.reject();
		}
		
		function setSpinny( btn ) {
			if ( null != self.response )
				return;
			
			const i = btn.querySelector( 'i' );
			i.className = 'fa fa-fw fa-spinner fa-pulse';
		}
	}
	
	ns.QueryItem.prototype.respond = function( response ) {
		const self = this;
		if ( null != self.response )
			return;
		
		self.response = response;
		const res = {
			id       : self.id,
			accepted : response,
		};
		self.emit( 'response', res );
	}
	
})( library.view );
