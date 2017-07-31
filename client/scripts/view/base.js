/*©agpl*************************************************************************
*                                                                              *
* Friend Unifying Platform                                                     *
* ------------------------                                                     *
*                                                                              *
* Copyright 2014-2016 Friend Software Labs AS, all rights reserved.            *
* Hillevaagsveien 14, 4016 Stavanger, Norway                                   *
* Tel.: (+47) 40 72 96 56                                                      *
* Mail: info@friendos.com                                                      *
*                                                                              *
*****************************************************************************©*/

var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.view = library.view || {};

// BaseView - NYI - maybe never?
(function( ns, undefined ) {
	ns.BaseView = function() {
		
	}
})( library.view );


// BaseFormView
// anything operating on, but not limited to, self.inputMap
// will probably fail horribly with more complex forms,
// so provide your own implementation where you feel it is necessary
( function( ns, undefined ) {
	ns.BaseFormView = function() {
		if ( !( this instanceof ns.BaseFormView ))
			return new ns.BaseFormView();
		
		var self = this;
		self.inputMap = null;
		self.baseFormViewInit();
	}
	
	ns.BaseFormView.prototype.baseFormViewInit = function() {
		var self = this;
		self.view = window.View;
		self.setTemplate();
		self.buildView();
		self.bindView();
		self.bindEvents();
		
		self.view.sendMessage({ type : 'loaded' });
	}
	
	ns.BaseFormView.prototype.setTemplate = function() {
		var self = this;
		hello.template = new friendUP.gui.TemplateManager();
		const frags = document.getElementById( 'fragments' );
		var fragStr = frags.innerHTML;
		fragStr = View.i18nReplaceInString( fragStr );
		hello.template.addFragments( fragStr );
	}
	
	ns.BaseFormView.prototype.buildView = function() {
		const self = this;
		console.log( 'buildView', self.tmplId );
		const el = hello.template.getElement( self.tmplId, {} );
		console.log( 'el', el );
		document.body.appendChild( el );
	}
	
	ns.BaseFormView.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'error', error );
		self.view.on( 'success', success );
		
		function initialize( msg ) { self.initialize( msg ); }
		function error( msg ) { self.handleError( msg ); }
		function success( msg ) { self.handleSuccess( msg ); }
	}
	
	ns.BaseFormView.prototype.initialize = function( data ) {
		var self = this;
		if ( !data.inputMap ) {
			console.log( 'view.BaseFormView.initialize.data', data );
			throw new Error( 'view.BaseFormView.initialize - no inputMap in data' );
		}
		
		self.inputMap = data.inputMap;
		self.setInputValues();
		
		if ( data.fragments ) {
			
			hello.template.addFragments( data.fragments );
			self.overlay = new library.component.FormOverlay();
		}
		
		self.view.sendMessage({
			type : 'ready'
		});
	}
	
	ns.BaseFormView.prototype.handleError = function( error ) {
		var self = this;
		self.overlay.error( error.message, clickBack );
		
		function clickBack() { self.doErrorThings(); }
	}
	
	ns.BaseFormView.prototype.handleSuccess = function( success ) {
		var self = this;
		if ( success )
			var msg = success.message || 'success!';
		
		self.overlay.success( msg, clickBack );
		
		function clickBack() { self.doSuccessThings(); }
	}
	
	ns.BaseFormView.prototype.doErrorThings = function() {
		var self = this;
		console.log( 'view.BaseFormView.doErrorThings' );
		// TODO : a bunch of stuff
	}
	
	ns.BaseFormView.prototype.doSuccessThings = function() {
		var self = this;
		console.log( 'view.BaseFormView.doSuccessThings - calling close' );
		// call close on success confrimation. override this function to get specialised behavior
		self.view.sendMessage({
			type : 'exit',
		});
	}
	
	ns.BaseFormView.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'form' );
		var resetButton = document.getElementById( 'reset' );
		
		form.addEventListener( 'submit', submit, false );
		resetButton.addEventListener( 'click', reset, false );
		
		function submit( e ) { self.submit( e ); }
		function reset( e ) { self.reset( e ); }
	}
	
	ns.BaseFormView.prototype.submit = function( e ) {
		var self = this;
		e.preventDefault();
		e.stopPropagation();
		
		self.overlay.show();
		var input = self.collectInput();
		
		if ( !input )
			return; // remember to show a error message, on the overlay, in collectInput
		
		self.view.sendMessage({
			type : 'submit',
			data : input
		});
	}
	
	ns.BaseFormView.prototype.collectInput = function() {
		var self = this;
		
		// Reference implementation - build your own for more complex forms
		
		// Error checking on client? no thanks! ( TODO )
		
		var inputIds = Object.keys( self.inputMap );
		var formData = {};
		inputIds.forEach( readValue );
		function readValue( inputId ) {
			var input = document.getElementById( inputId );
			formData[ inputId ] = input.value;
		};
		
		return formData;
	}
	
	ns.BaseFormView.prototype.setInputValues = function() {
		var self = this;
		
		// Reference implementation - build your own for more complex forms
		
		var inputIds = Object.keys( self.inputMap );
		inputIds.forEach( setValue );
		function setValue( inputId ) {
			self.setInputText( inputId );
		}
	}
	
	ns.BaseFormView.prototype.setSelectOptions = function( id ) {
		var self = this;
		var select = document.getElementById( id );
		select.innerHTML = '';
		var valueMap = self.inputMap[ id ];
		var ids = Object.keys( valueMap );
		ids.forEach( add );
		function add( moduleId, index ) {
			var displayValue = valueMap[ moduleId ];
			var option = document.createElement( 'option' );
			
			if ( !index ) // by convention, the first index, 0, is the default option
				option.defaultSelected = true;
			
			option.value = moduleId;
			option.id = moduleId;
			option.innerHTML = displayValue;
			select.appendChild( option );
		}
	}
	
	ns.BaseFormView.prototype.setInputText = function( id ) {
		var self = this
		var value = self.inputMap[ id ] || '';
		var input = document.getElementById( id );
		input.value = value;
	}
	
	ns.BaseFormView.prototype.reset = function( e ) {
		var self = this;
		if ( e ) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		self.setInputValues();
	}
	
})( library.view );


// BASE CONTACT
(function( ns, undefined ) {
	ns.BaseContact = function( conf ) {
		if ( !( this instanceof ns.BaseContact ))
			return new ns.BaseContact( conf );
		
		var self = this;
		self.clientId = self.data.clientId;
		self.identity = self.data.identity;
		self.containerId = conf.containerId;
		
		self.view = null;
		
		self.baseContactInit( conf.parentView );
	}
	
	ns.BaseContact.prototype.baseContactInit = function( parentView ) {
		var self = this;
		self.view = new library.component.SubView({
			parent : parentView,
			type : self.clientId,
		});
		
		self.view.on( 'identity', updateIdentity );
		function updateIdentity( msg ) { self.updateIdentity( msg ); }
		
		self.buildElement(); // must be defined for each contact
		self.bindActionPanel();
	}
	
	ns.BaseContact.prototype.updateIdentity = function( data ) {
		var self = this;
		self.identity = data;
		self.updateName();
	}
	
	ns.BaseContact.prototype.updateName = function() {
		var self = this;
		var element = document.getElementById( self.clientId );
		var nameElement = element.querySelector( '.contact-name' );
		nameElement.textContent = self.identity.name;
	}
	
	ns.BaseContact.prototype.bindActionPanel = function() {
		var self = this;
		var element = document.getElementById( self.clientId );
		var actionPanel = element.querySelector( '.actions-container .actions' );
		if ( !actionPanel ) {
			console.log( 'no action panel found for', self );
			return;
		}
		
		var actionPanelHide = actionPanel.querySelector( 'div.hide-actions' );
		// make elements focusable - el.focus()
		actionPanel.tabIndex = 0;
		document.body.tabIndex = 0; // this is so we can unfocus the action panel easily
		
		//element.addEventListener( 'mouseenter', showActions, false );
		element.addEventListener( 'click', click, false );
		element.addEventListener( 'dblclick', doubleClick, false  );
		
		//actionPanel.addEventListener( 'mouseleave', hideActions, false );
		actionPanel.addEventListener( 'blur', hideActions, false );
		
		if ( actionPanelHide )
			actionPanelHide.addEventListener( 'click', hideClick, false );
		
		function click( e ) {
			showActions();
			actionPanel.focus();
		}
		
		function doubleClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			if ( self.onDoubleClick )
				self.onDoubleClick();
		}
		
		function hideClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			document.body.focus();
		}
		
		function showActions( e ) {
			element.classList.toggle( 'show-actions', true );
		}
		
		function hideActions( e ) {
			if ( e.relatedTarget && e.relatedTarget.tagName == 'BUTTON' ) {
				e.relatedTarget.click();
			}
			
			element.classList.toggle( 'show-actions', false );
		}
	}
	
	ns.BaseContact.prototype.onDoubleClick = function() {
		var self = this;
		self.startChat();
	}
	
	ns.BaseContact.prototype.startChat = function( e ) {
		var self = this;
		if ( e ) {
			e.stopPropagation();
			e.preventDefault();
		}
		
		self.send({
			type : 'chat',
		});
	}
	
	ns.BaseContact.prototype.startLive = function( e ) {
		var self = this;
		if ( e ) {
			e.stopPropagation();
			e.preventDefault();
		}
		self.send({
			type : 'live',
		});
	}
	
	ns.BaseContact.prototype.remove = function() {
		var self = this;
		self.send({
			type: 'remove',
		});
	}
	
	ns.BaseContact.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
	ns.BaseContact.prototype.close = function() {
		var self = this;
		self.view.close();
		
		var element = document.getElementById( self.clientId );
		element.parentNode.removeChild( element );
	}
	
})( library.view );


// BASEMODULE
(function( ns, undefined ) {
	ns.BaseModule = function( conf ) {
		if ( !( this instanceof ns.BaseModule ))
			return new ns.BaseModule( conf );
		
		var self = this;
		self.parentView = conf.parentView;
		self.containerId = conf.containerId
		self.type = conf.module.type;
		self.clientId = conf.module.clientId;
		self.module = conf.module;
		self.identity = conf.identity;
		self.tmplId = conf.tmplId || '';
		
		self.view = null;
		self.contacts = {};
		self.contactsId = friendUP.tool.uid( 'contacts' );
		self.connectionState = friendUP.tool.uid( 'connectionIndicator' );
		self.updateMap = null;
		self.contactsFoldit = friendUP.tool.uid( 'foldit' );
		
		self.optionMenu = friendUP.tool.uid( 'options' );
		self.options = {};
		
		self.initBaseModule();
	}
	
	
	ns.BaseModule.prototype.initBaseModule = function() {
		var self = this;
		if ( !self.identity ) {
			self.identity = {
				name : '---',
				avatar : null,
			};
		}
		
		self.buildElement();
		self.setCss();
		self.updateMap = {
			'module' : updateModule,
			'identity' : updateIdentity,
		};
		
		self.errorStrings = {
			'ERR_HOST_ENOTFOUND'    : View.i18n('i18n_host_was_not_found'),
			'ERR_HOST_EHOSTUNREACH' : View.i18n('i18n_host_is_unreachable'),
			'ERR_HOST_ETIMEDOUT'    : View.i18n('i18n_connection_timed_out'),
			'ERR_RESPONSE_NOT_OK'   : View.i18n('i18n_host_declined_request'),
		}
		
		function updateModule( msg ) { self.updateModule( msg ); }
		function updateIdentity( msg ) { self.updateIdentity( msg ); }
		
		// application interface
		self.view = new library.component.SubView({
			parent : self.parentView,
			type : self.clientId,
		});
		self.view.on( 'connection', connection );
		self.view.on( 'remove', removeContact );
		self.view.on( 'update', applyUpdate );
		self.view.on( 'query', handleQuery );
		self.view.on( 'info', handleInfo );
		
		function connection( e ) { self.connectionHandler( e ); }
		function removeContact( e ) { self.removeContact( e ); }
		function applyUpdate( e ) { self.updateHandler( e ); }
		function handleQuery( e ) { self.queryHandler( e ); }
		function handleInfo( e ) { self.infoHandler( e ); }
		
		self.queryMap = {
			'text'           : queryText,
			'secure'         : querySecure,
			'secure-confirm' : querySecureConfirm,
			'password'       : queryPassword,
		};
		
		function queryText( e ) { self.queryText( e ); }
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
		
		self.initFoldit();
		self.initStatus();
		
		const boxConf = {
			element     : null,
			containerId : self.activeId || self.contactsId,
		};
		self.serverMessage = new library.component.InfoBox( boxConf );
		
		self.addMenu();
		self.bindMenuBtn();
		self.updateTitle();
		
	}
	
	ns.BaseModule.prototype.addMenu = function() {
		var self = this;
		var settingsId = friendUP.tool.uid( 'settings' );
		var settingsItem = {
			type : 'item',
			id : settingsId,
			name : 'Settings',
			faIcon : 'fa-cog',
		};
		
		var reconnectId = friendUP.tool.uid( 'reconnect' );
		var reconnectItem = {
			type : 'item',
			id : reconnectId,
			name : 'Reconnect',
			faIcon : 'fa-refresh',
		};
		
		var disconnectId = friendUP.tool.uid( 'disconnect' );
		var disconnectItem = {
			type : 'item',
			id : disconnectId,
			name : 'Disconnect',
			faIcon : 'fa-power-off',
		};
		
		var removeId = friendUP.tool.uid( 'remove' );
		var removeItem = {
			type : 'item',
			id : removeId,
			name : 'Remove ',
			faIcon : 'fa-close',
		};
		
		self.menuId = friendUP.tool.uid( 'menu' );
		var folder = {
			type : 'folder',
			id : self.menuId,
			name : 'module',
			faIcon : 'fa-folder-o',
			items : [
				settingsItem,
				reconnectItem,
				disconnectItem,
				removeItem,
			],
		};
		
		main.menu.add( folder, 'modules' );
		
		main.menu.on( settingsId, showSettings );
		main.menu.on( reconnectId, doReconnect );
		main.menu.on( disconnectId, doDisconnect );
		main.menu.on( removeId, doRemove );
		
		function showSettings() { self.optionSettings(); }
		function doReconnect() { self.optionReconnect(); }
		function doDisconnect() { self.optionDisconnect(); }
		function doRemove( msg ) { self.optionRemove( msg ); }
		
	}
	
	ns.BaseModule.prototype.bindMenuBtn = function() {
		var self = this;
		var menuBtn = document.getElementById( self.optionMenu );
		menuBtn.addEventListener( 'click', menuBtnClick, false );
		function menuBtnClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			main.showMenu( self.menuId );
		}
	}
	
	// specific modules may want to reimplement
	ns.BaseModule.prototype.buildElement = function() {
		var self = this;
		var tmplId = self.tmplId || 'base-module-tmpl';
		var conf = {
			clientId : self.clientId,
			folditId : self.contactsFoldit,
			moduleTitle : self.module.name,
			connectionStateId : self.connectionState,
			optionId : self.optionMenu,
			contactsId : self.contactsId,
		};
		
		var element = hello.template.getElement( tmplId, conf );
		var container = document.getElementById( self.containerId );
		container.appendChild( element );
	}
	
	ns.BaseModule.prototype.initFoldit = function() {
		var self = this;
		self.contactsFoldit = new library.component.Foldit({
			folderId : self.contactsFoldit,
			foldeeId : self.contactsId
		});
	}
	
	ns.BaseModule.prototype.initStatus = function() {
		var self = this;
		self.connectionState = new library.component.StatusIndicator({
			containerId : self.connectionState,
			type      : 'icon',
			cssClass  : 'fa-circle-o',
			statusMap : {
				offline    : 'Off'    ,
				online     : 'On'     ,
				open       : 'Warning',
				connecting : 'Notify' ,
				error      : 'Alert'  ,
			},
		});
	}
	
	// re implement for a specific module
	ns.BaseModule.prototype.setCss = function() {
		const self = this;
		const conf = {
		};
		self.addCss( conf );
	}
	
	ns.BaseModule.prototype.addCss = function( conf, tmplId ) {
		var self = this;
		tmplId = tmplId || 'fa-icon-logo-css-tmpl';
		conf.moduleId = self.clientId;
		
		var cssId = self.getCssId();
		var exists = document.getElementById( cssId );
		if ( exists )
			self.removeCss();
		
		var cssElement = hello.template.getElement( tmplId, conf );
		document.head.appendChild( cssElement );
	}
	
	ns.BaseModule.prototype.removeCss = function() {
		var self = this;
		var cssId = self.getCssId();
		var cssElement = document.getElementById( cssId );
		if ( !cssElement ) {
			console.log( 'moduleView.removeCss - could not', { id : cssId, self : self });
			return;
		}
		
		cssElement.parentNode.removeChild( cssElement );
	}
	
	ns.BaseModule.prototype.getCssId = function() {
		var self = this;
		var id = self.clientId + '-module-css';
		return id;
	}
	
	ns.BaseModule.prototype.showInitializing = function() {
		var self = this;
		var id = friendUP.tool.uid( 'init' );
		var conf = {
			id : id,
		};
		var element = hello.template.getElement( 'module-initializing-tmpl', conf );
		self.serverMessage.show( element );
	}
	
	ns.BaseModule.prototype.clearInfo = function() {
		var self = this;
		self.serverMessage.hide();
	}
	
	ns.BaseModule.prototype.showMessage = function( message ) {
		var self = this;
		var id = friendUP.tool.uid( 'message' );
		var conf = {
			id : id,
			message : message,
		};
		var element = hello.template.getElement( 'module-message-tmpl', conf );
		self.serverMessage.show( element );
	}
	
	ns.BaseModule.prototype.connectionHandler = function( state ) {
		var self = this;
		if ( !self.connectionState )
			throw new Error( 'connectionState is not defined, use library.component.' );
		
		self.connectionState.set( state.type );
	}
	
	ns.BaseModule.prototype.updateHandler = function( update ) {
		var self = this;
		if ( !self.updateMap )
			throw new Error( 'no updateMap defined for module: ' + self.type );
		
		var handler = self.updateMap[ update.type ];
		if ( !handler ) {
			console.log( 'moduleView.updateHandler - no handler for', update );
			return;
		}
		
		handler( update.data );
	}
	
	ns.BaseModule.prototype.updateModule = function( update ) {
		var self = this;
		self.module.name = update.name;
		self.updateTitle();
	}
	
	ns.BaseModule.prototype.updateIdentity = function( update ) {
		var self = this;
		self.identity = update;
		self.updateTitle();
	}
	
	ns.BaseModule.prototype.queryHandler = function( msg ) {
		var self = this;
		var handler = self.queryMap[ msg.type ];
		if ( !handler ) {
			console.log( 'view.handleQuery - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.BaseModule.prototype.querySecure = function( data ) {
		var self = this;
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
		var self = this;
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
		var self = this;
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
				console.log( 'queryPassword - resetClick', e );
				var passReset = {
					type : 'pass-reset',
				}
				
				self.send( passReset );
				self.serverMessage.hide();
			}
		}
	}
	
	ns.BaseModule.prototype.queryText = function( data ) {
		var self = this;
		var conf = {
			id : friendUP.tool.uid( 'query-text' ),
			message : data.message || '',
			value : data.value || '',
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
		var self = this;
		var handler = self.infoMap[ info.type ];
		if ( !handler ) {
			console.log( 'no handler for info', info );
			return;
		}
		
		handler( info.data );
	}
	
	// Use this fn while using base module template. Implement your own if you make your
	// own template with changes relevant to this function
	ns.BaseModule.prototype.updateTitle = function() {
		var self = this;
		var title = self.getTitleString();
		var parentElement = document.getElementById( self.clientId );
		var titleElement = parentElement.querySelector( '.module-title' );
		titleElement.textContent = title;
		
		main.menu.update( self.menuId, title );
	}
	
	ns.BaseModule.prototype.getTitleString = function() {
		var self = this;
		var title = '';
		var modName = '';
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
	
	ns.BaseModule.prototype.removeContact = function( clientId ) {
		var self = this;
		var contact = self.contacts[ clientId ];
		if ( !contact ) {
			console.log( 'no contact for', { id : clientId, contacts : self.contacts });
			return;
		}
		
		self.contacts[ clientId ].close();
		delete self.contacts[ clientId ];
	}
	
	ns.BaseModule.prototype.optionSettings = function() {
		var self = this;
		self.send({
			type : 'settings',
		});
	}
	
	ns.BaseModule.prototype.optionReconnect = function() {
		var self = this;
		self.send({
			type : 'reconnect',
		});
	}
	
	ns.BaseModule.prototype.optionDisconnect = function( msg ) {
		var self = this;
		self.send({
			type : 'disconnect',
		});
	}
	
	ns.BaseModule.prototype.optionRemove = function() {
		var self = this;
		self.send({
			type : 'remove',
		});
	}
	
	ns.BaseModule.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
	ns.BaseModule.prototype.close = function() {
		var self = this;
		self.view.close();
		self.removeCss();
		main.menu.remove( self.menuId );
		
		var element = document.getElementById( self.clientId );
		element.parentNode.removeChild( element );
	}
	
})( library.view );
