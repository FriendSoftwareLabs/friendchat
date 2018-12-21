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

// SUBSCRIBER
(function( ns, undefined ) {
	ns.Subscriber = function( conf ) {
		if ( !( this instanceof ns.Subscriber ))
			return new ns.Subscriber( conf );
		
		var self = this;
		self.type = 'subscription';
		self.data = conf.subscriber;
		self.isReceived = conf.subscriber.isRecieved; // TODO received / recieved - spelling
		
		library.view.BaseContact.call( self, conf );
		
		self.init();
	}
	
	ns.Subscriber.prototype = Object.create( library.view.BaseContact.prototype );
	
	// Public
	
	
	// Private
	
	ns.Subscriber.prototype.init = function() {
		var self = this;
		self.bindEvents();
	}
	
	ns.Subscriber.prototype.bindActionPanel = function() {
		// subscribers do not have an action panel, so dummying it
		return true;
	}
	
	ns.Subscriber.prototype.buildElement = function() {
		var self = this;
		var tmplId = self.isReceived ? 'subscription-tmpl' : 'subscribee-tmpl';
		var tmplConf = {
			clientId : self.clientId,
			contactName : self.identity.name,
		};
		var element = hello.template.getElement( tmplId, tmplConf );
		var container = document.getElementById( self.containerId );
		container.appendChild( element );
	}
	
	ns.Subscriber.prototype.bindEvents = function() {
		var self = this;
		var element = document.getElementById( self.clientId );
		
		var acceptBtn = element.querySelector( '.subscriber .allowSub' );
		var denyBtn = element.querySelector( '.subscriber .denySub' );
		var cancelBtn = element.querySelector('.subscribee .cancelSub' );
		
		if ( self.isReceived ) {
			acceptBtn.addEventListener( 'click', acceptSub, false );
			denyBtn.addEventListener( 'click', denySub, false );
		}
		else
			cancelBtn.addEventListener( 'click', cancelSub, false );
		
		function acceptSub( e ) { self.acceptSub( e ); }
		function denySub( e ) { self.denySub( e ); }
		function cancelSub( e ) { self.cancelSub( e ); }
	}
	
	ns.Subscriber.prototype.acceptSub = function( e ) {
		var self = this;
		self.conn.send({
			type : 'allow',
		});
		self.showSpinner();
	}
	
	ns.Subscriber.prototype.denySub = function( e ) {
		var self = this;
		self.conn.send({
			type : 'deny',
		});
		self.showSpinner();
	}
	
	ns.Subscriber.prototype.cancelSub = function( e ) {
		var self = this;
		self.conn.send({
			type : 'cancel'
		});
		self.showSpinner();
	}
	
	ns.Subscriber.prototype.showSpinner = function() {
		var self = this;
		var element = document.getElementById( self.clientId );
		var actions = element.querySelector( '.actions-container' );
		var spinner = element.querySelector( '.action-pending' );
		actions.classList.toggle( 'hidden', true );
		spinner.classList.toggle( 'hidden', false );
	}
	
})( library.view );


// TREEROOTCONTACT
(function( ns, undefined ) {
	ns.TreerootContact = function( conf ) {
		if ( !( this instanceof ns.TreerootContact ))
			return new ns.TreerootContact( conf );
		
		var self = this;
		self.data = conf.contact;
		self.online = conf.contact.online;
		// id is later replaced by the component
		self.messageWaiting = friendUP.tool.uid( 'msgWaiting' );
		self.presence = friendUP.tool.uid( 'presence' );
		self.unreadMessages = 0;
		
		library.view.BaseContact.call( self, conf );
		
		self.init();
	}
	
	ns.TreerootContact.prototype = Object.create( library.view.BaseContact.prototype );
	
	// Public
	
	ns.TreerootContact.prototype.updatePresence = function( event ) {
		const self = this;
		self.online = 'online' === event.value;
		self.presence.set( event.value );
		self.emit( 'online', self.online );
	}
	
	ns.TreerootContact.prototype.getOnline = function() {
		const self = this;
		return self.online;
	}
	
	ns.TreerootContact.prototype.getUnreadMessages = function() {
		const self = this;
		return self.unreadMessages;
	}
	
	// Private
	
	ns.TreerootContact.prototype.getMenuOptions = function() {
		const self = this;
		const opts = [
			self.menuActions[ 'open-chat' ],
			self.menuActions[ 'invite-video' ],
			self.menuActions[ 'invite-audio' ],
			self.menuActions[ 'remove-contact' ],
		];
		return opts;
	}
	
	ns.TreerootContact.prototype.init = function() {
		var self = this;
		self.messageWaiting = new library.component.StatusDisplay({
			containerId : self.messageWaiting,
			type        : 'icon',
			cssClass    : 'fa-comment',
			statusMap   : {
				'false'   : 'Off',
				'true'    : 'Notify',
			},
			display : '',
		});
		
		self.presence = new library.component.StatusIndicator({
			containerId : self.presence,
			type      : 'icon',
			cssClass  : 'fa-user',
			statusMap : {
				offline : 'Off',
				online  : 'On'
			}
		});
		self.presence.set( self.online ? 'online' : 'offline' );
		
		self.bindEvents();
		self.bindView();
		
		if ( !!self.data.unreadMessages )
			window.setTimeout( msgWaiting, 250 );
		
		function msgWaiting() {
			const state = {
				unread : self.data.unreadMessages,
			};
			if ( self.lastMessage ) {
				const lm = self.lastMessage.data;
				state.message = lm.message;
				state.from = !!lm.from;
				state.time = lm.time;
			}
			self.handleMessageWaiting( state );
		}
	}
	
	ns.TreerootContact.prototype.buildElement = function() {
		var self = this;
		var conf = {
			clientId         : self.clientId,
			avatar           : self.identity.avatar,
			name             : self.identity.name,
			messageWaitingId : self.messageWaiting,
			presenceId       : self.presence,
			optionId         : self.optionMenu,
		};
		
		var element = hello.template.getElement( 'treeroot-contact-tmpl', conf );
		var container = document.getElementById( self.containerId );
		container.appendChild( element );
	}
	
	ns.TreerootContact.prototype.bindEvents = function() {
		const self = this;
	}
	
	ns.TreerootContact.prototype.showSettings = function() {
		var self = this;
		console.log( 'view.treerootcontact.showSettings - NYI' );
	}
	
	ns.TreerootContact.prototype.bindView = function() {
		var self = this;
		self.conn.on( 'presence', presence );
		self.conn.on( 'message', message );
		self.conn.on( 'msg-waiting', messageWaiting );
		
		function presence( state ) {
			self.presence.set( state );
		}
		
		function message( msg ) {
			self.lastMessage = msg;
			self.emit( 'message', msg );
		}
		
		function messageWaiting( state ) {
			self.handleMessageWaiting( state );
		}
	}
	
	ns.TreerootContact.prototype.handleMessageWaiting = function( state ) {
		const self = this;
			let isWaiting;
			if ( state.unread ) {
				isWaiting = !!state.unread;
				self.unreadMessages = state.unread;
			} else {
				isWaiting = !!state.isWaiting;
				if ( isWaiting )
					self.unreadMessages += 1;
				else
					self.unreadMessages = 0;
			}
			
			self.messageWaiting.set( isWaiting ? 'true' : 'false' );
			let num = '';
			if ( 2 <= self.unreadMessages )
				num = self.unreadMessages.toString();
			
			self.messageWaiting.setDisplay( num );
			state.isWaiting = isWaiting;
			state.unread = self.unreadMessages;
			self.emit( 'msg-waiting', state );
	}
	
})( library.view );


// TREEROOT module
(function( ns, undefined ) {
	ns.Treeroot = function( conf ) {
		const self = this;
		self.activeId = friendUP.tool.uid( 'active' );
		self.inactiveFolditId = friendUP.tool.uid( 'inactiveFoldit' );
		self.inactiveId = friendUP.tool.uid( 'inactive' );
		
		library.view.BaseModule.call( this, conf );
		
		self.online = {};
		self.onlineIds = [];
		self.inactive = {};
		self.inactiveIds = [];
		self.subs = {};
		self.subIds = [];
		
		self.init();
	}
	
	ns.Treeroot.prototype = Object.create( library.view.BaseModule.prototype );
	
	ns.Treeroot.prototype.init = function() {
		var self = this;
		self.infoMap = self.infoMap || {};
		self.infoMap[ 'offline' ] = serverOffline;
		self.infoMap[ 'reconnecting' ] = reconnecting;
		self.infoMap[ 'info-missing' ] = moduleInfoMissing;
		
		function serverOffline( msg ) { self.serverOffline( msg ); }
		function reconnecting( msg ) { self.reconnecting( msg ); }
		function moduleInfoMissing( msg ) { self.moduleInfoMissing( msg ); }
		
		self.queryMap[ 'host' ] = hostError;
		function hostError( e ) { self.handleHostError( e ); }
		
		self.contactMap = {
			'presence' : contactPresence,
			'add' : addContact,
		};
		
		function contactPresence( msg ) { self.contactPresence( msg ); }
		function addContact( msg ) { self.addContact( msg ); }
		
		self.queryMap[ 'treeroot-pass-reset' ] = queryPassReset;
		function queryPassReset( e ) { self.queryPassReset( e ); }
		
		self.bind();
		self.bindView();
		//self.showInitializing();
	}
	
	ns.Treeroot.prototype.buildRoomsElement = function() {
		const self = this;
		self.roomsId = null;
		self.roomsFoldit = null;
		self.roomsConnState = null;
		self.roomItemsId = null;
	}
	
	ns.Treeroot.prototype.buildContactsElement = function() {
		const self = this;
		const tmplId = 'treeroot-module-tmpl';
		const title = self.getTitleString();
		const conf = {
			clientId         : self.contactsId,
			folditId         : self.contactsFoldit,
			moduleTitle      : title,
			connStateId      : self.contactsConnState,
			itemsId          : self.contactItemsId,
			activeId         : self.activeId,
			inactiveFolditId : self.inactiveFolditId,
			inactiveId       : self.inactiveId,
		};
		const element = hello.template.getElement( tmplId, conf );
		const container = document.getElementById( self.containers.contact );
		container.appendChild( element );
	}
	
	ns.Treeroot.prototype.setLogoCss = function() {
		var self = this;
		var logoPath = 'https://treeroot.org/upload/images-master/logo.png';
		var conf = {
			logoPath : logoPath,
		};
		self.insertLogoCss( 'image-logo-css-tmpl', conf, self.contactsId );
	}
	
	ns.Treeroot.prototype.initFoldit = function() {
		var self = this;
		self.contactsFoldit = new library.component.Foldit({
			folderId : self.contactsFoldit,
			foldeeId : self.contactItemsId,
		});
		
		self.inactiveFoldit = new library.component.Foldit({
			folderId : self.inactiveFolditId,
			foldeeId : self.inactiveId,
			startClosed : true,
		});
	}
	
	ns.Treeroot.prototype.setServerMessageBox = function() {
		const self = this;
		const conf = {
			containerId : self.activeId,
		};
		self.serverMessage = new library.component.InfoBox( conf );
	}
	
	ns.Treeroot.prototype.serverOffline = function( data ) {
		var self = this;
		var tmplConf = {
			id : friendUP.tool.uid( 'module-offline' ),
		};
		var element = hello.template.getElement( 'offline-reconnect-tmpl', tmplConf );
		self.serverMessage.show( element );
		bind( element );
		
		function bind( element ) {
			var reconnectBtn = element.querySelector( '.reconnect' );
			reconnectBtn.addEventListener( 'click', sendConnect, false );
			function sendConnect( e ) {
				self.send({
					type : 'reconnect',
				});
			}
		}
	}
	
	ns.Treeroot.prototype.reconnecting = function( msg ) {
		var self = this;
		var tmplConf = {
			id : friendUP.tool.uid( 'reconnecting' ),
		};
		var element = hello.template.getElement( 'error-reconnect-tmpl', tmplConf );
		self.serverMessage.show( element );
		bind( element );
		
		function bind( element ) {
			var reconnectBtn = element.querySelector( '.reconnect-now' );
			reconnectBtn.addEventListener( 'click', reconnectNow, false );
			
			function reconnectNow( e ) {
				e.preventDefault();
				self.optionReconnect();
			}
		}
	}
	
	ns.Treeroot.prototype.moduleInfoMissing = function( data ) {
		var self = this;
		var tmplConf = {
			id : friendUP.tool.uid( 'login-missing' ),
		};
		var element = hello.template.getElement( 'info-missing-tmpl', tmplConf );
		self.serverMessage.show( element );
		bind( element );
		
		function bind( element ) {
			var scienceBtn = element.querySelector( '.science' );
			var settingsBtn = element.querySelector( '.settings' );
			var accountBtn = element.querySelector( '.account' );
			scienceBtn.addEventListener( 'click', scienceAccount, false );
			settingsBtn.addEventListener( 'click', showSettings, false );
			accountBtn.addEventListener( 'click', createAccount, false );
			
			function scienceAccount( e ) { self.scienceRegister(); }
			function showSettings( e ) { self.handleAction( 'settings' ); }
			function createAccount( e ) { self.showCreateAccount(); }
		}
	}
	
	ns.Treeroot.prototype.handleHostError = function( event ) {
		const self = this;
		const tmplId = 'query-host-err';
		const err = event.value;
		if ( tmplId === self.serverMessage.tmplId )
			updateCurrent( self.serverMessage.element, err );
		else
			buildNew( err, tmplId, event.callbackId );
		
		setRetryBar( err.time, err.retry, self.serverMessage.element );
		
		function buildNew( data, tmplId, callbackId ) {
			const conf = {
				id    : friendUP.tool.uid( 'host-err' ),
				error : self.translateError( data.err ),
				host  : data.host,
			}
			const el = hello.template.getElement( tmplId, conf );
			self.serverMessage.show( el, tmplId );
			
			// bind
			const input = el.querySelector( 'input' );
			const retryBtn = el.querySelector( '.button.accept' );
			
			retryBtn.addEventListener( 'click', retryClick, false );
			
			function retryClick( e ) {
				e.preventDefault();
				e.stopPropagation();
				const res = {
					host : null,
				};
				const host = input.value;
				if ( host !== data.host )
					res.host = host;
				
				self.returnQuery( callbackId, res );
			}
		}
		
		function updateCurrent( el, data ) {
			
			
		}
		
		function setRetryBar( startTime, retryTime, el ) {
			startTime = Date.now();
			const retryBar = el.querySelector( '.retry-bar' );
			if ( !retryBar )
				return;
			
			step();
			
			function step() {
				window.requestAnimationFrame( updateRetry );
			}
			
			function updateRetry() {
				const now = Date.now();
				const total = retryTime - startTime;
				const msLeft = retryTime - now;
				var percentLeft = ( msLeft / total ) * 100;
				if ( 0 > percentLeft )
					percentLeft = 0;
				
				if ( 100 < percentLeft )
					percentLeft = 100;
				
				setWidth( retryBar, percentLeft );
				if ( now > retryTime )
					return;
				
				step();
				
				function setWidth( el, percent ) {
					try {
						el.style.width = percent + '%';
					} catch( e ) {
						console.log( 'setting width on retryBar failed', {
							el : el,
							ex : e
						});
					}
				}
				
			}
		}
	}
	
	ns.Treeroot.prototype.translateError = function( errCode ) {
		const self = this;
		return self.errorStrings[ errCode ] || errCode;
	}
	
	ns.Treeroot.prototype.scienceRegister = function() {
		var self = this;
		var msg = {
			type : 'scienceregister',
		};
		self.mod.send( msg );
	}
	
	ns.Treeroot.prototype.showCreateAccount = function() {
		var self = this;
		var registerEvent = {
			type : 'register',
		};
		self.mod.send( registerEvent );
	}
	
	ns.Treeroot.prototype.saveSetting = function( type, value ) {
		var self = this;
		var update = {
			setting : type,
			value : value,
		};
		var wrap = {
			type : 'setting',
			data : update,
		};
		self.send( wrap );
	}
	
	ns.Treeroot.prototype.bind = function() {
		var self = this;
		var element = document.getElementById( self.contactsId );
		self.inactiveContainer = element.querySelector( '.inactive-container' );
		self.inactiveStats = self.inactiveContainer.querySelector( '.inactive-stats' );
	}
	
	ns.Treeroot.prototype.bindView = function() {
		var self = this;
		self.mod.on( 'account', updateAccount );
		self.mod.on( 'contact', handleContact );
		self.mod.on( 'subscriber', addSubscriber );
		self.mod.on( 'remove', removeTheThing );
		
		//function updateModule( msg ) { self.updateModule( msg ); }
		function updateAccount( msg ) { self.updateAccount( msg ); }
		function handleContact( msg ) { self.handleContact( msg ); }
		function addSubscriber( msg ) { self.addSubscriber( msg ); }
		function removeTheThing( e ) { self.removeContact( e ); }
	}
	
	ns.Treeroot.prototype.updateAccount = function( account ) {
		var self = this;
		self.identity = account;
		self.identity.name = self.identity.name || '---';
		self.updateTitle();
	}
	
	ns.Treeroot.prototype.addContact = function( data ) {
		var self = this;
		self.serverMessage.hide();
		var conf = {
			contact     : data,
			containerId : self.inactiveId,
			conn        : window.View,
			menuActions : self.menuActions,
		};
		var contact = new library.view.TreerootContact( conf );
		self.contacts[ contact.clientId ] = contact;
		self.sortContact( contact );
		self.emit( 'add', contact, self.module.name );
	}
	
	ns.Treeroot.prototype.addSubscriber = function( subData ) {
		var self = this;
		self.serverMessage.hide();
		var conf = {
			subscriber  : subData,
			containerId : self.activeId,
			conn        : window.View,
			menuActions : self.menuActions,
		};
		var subscriber = new library.view.Subscriber( conf );
		self.contacts[ subscriber.clientId ] = subscriber;
		self.subs[ subscriber.clientId ] = subscriber;
		self.subIds = Object.keys( self.subs );
		self.sortSubs();
		self.updateCount();
	}
	
	ns.Treeroot.prototype.handleContact = function( msg ) {
		var self = this;
		var handler = self.contactMap[ msg.type ];
		if ( !handler ) {
			console.log( 'view.module.handleContact - no handler for', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.Treeroot.prototype.contactPresence = function( data ) {
		var self = this;
		var contact = self.contacts[ data.clientId ];
		if ( !contact ) {
			console.log( 'view.module.contactPresence - no contact found for', data );
			return;
		}
		
		contact.updatePresence( data );
		self.sortContact( contact );
	}
	
	ns.Treeroot.prototype.sortContact = function( contact ) {
		var self = this;
		var clientId = contact.clientId;
		var presence = contact.presence.get();
		if ( 'offline' !== presence ) {
			moveFromTo(
				self.inactive,
				self.online,
				contact
			);
			regenIds();
			self.sortOnline();
		}
		else {
			moveFromTo(
				self.online,
				self.inactive,
				contact
			);
			regenIds();
			self.sortInactive();
		}
		
		self.updateCount();
		
		function moveFromTo( from, to, contact ) {
			var cId = contact.clientId;
			if ( from[ cId ] )
				delete from[ cId ];
			
			to[ cId ] = contact;
		}
		
		function regenIds() {
			self.onlineIds = Object.keys( self.online );
			self.sortContactIds( self.onlineIds );
			
			self.inactiveIds = Object.keys( self.inactive );
			self.sortContactIds( self.inactiveIds );
		}
	}
	
	ns.Treeroot.prototype.sortOnline = function() {
		var self = this;
		var container = document.getElementById( self.activeId );
		var beforeElement = getBeforeElement();
		
		self.onlineIds.forEach( reorder );
		function reorder( clientId ) {
			var element = document.getElementById( clientId );
			container.insertBefore( element, beforeElement );
		}
		
		function getBeforeElement() {
			if ( !self.subIds.length )
				return null;
			
			var firstReceived = null;
			self.subIds.some( findReceived );
			return document.getElementById( firstReceived );
			
			function findReceived( cid ) {
				var sub = self.subs[ cid ];
				if ( sub.isReceived ) {
					firstReceived = cid;
					return true;
				}
				
				return false;
			}
		}
	}
	
	ns.Treeroot.prototype.sortInactive = function() {
		var self = this;
		var container = document.getElementById( self.inactiveId );
		self.inactiveIds.forEach( reorder );
		function reorder( clientId ) {
			var element = document.getElementById( clientId );
			container.appendChild( element );
		}
		
	}
	
	ns.Treeroot.prototype.sortSubs = function() {
		var self = this;
		var actives = document.getElementById( self.activeId );
		var hidden = document.getElementById( self.inactiveId );
		self.sortContactIds( self.subIds );
		self.subIds.forEach( reorder );
		function reorder( clientId ) {
			var sub = self.subs[ clientId ];
			var element = document.getElementById( clientId );
			if ( sub.isReceived )
				actives.appendChild( element );
			else
				hidden.appendChild( element );
		}
	}
	
	ns.Treeroot.prototype.sortContactIds = function( idArr ) {
		var self = this;
		idArr.sort( byName );
		function byName( a, b ) {
			var ca = self.contacts[ a ].identity.name.toUpperCase();
			var cb = self.contacts[ b ].identity.name.toUpperCase();
			if ( ca > cb )
				return 1;
			if ( ca < cb )
				return -1;
			return 0;
		}
	}
	
	ns.Treeroot.prototype.updateCount = function() {
		var self = this;
		var max = Object.keys( self.contacts ).length;
		var num = self.inactiveIds.length;
		num = num + self.subIds.length;
		self.inactiveStats.textContent = num + ' / ' + max;
		self.inactiveContainer.classList.toggle( 'hidden', !num );
	}
	
	ns.Treeroot.prototype.removeContact = function( clientId ) {
		var self = this;
		var contact = self.contacts[ clientId ];
		if ( !contact ) {
			console.log( 'no contact for clientId', clientId );
			return;
		}
		
		self.emit( 'remove', clientId );
		contact.close();
		delete self.contacts[ clientId ];
		
		if ( contact.type == 'subscription' )
			removeSub();
		else
			removeContact();
		
		self.updateCount();
		
		function removeSub() {
			delete self.subs[ clientId ];
			self.subIds = Object.keys( self.subs );
			self.sortContactIds( self.subIds );
		}
		
		function removeContact() {
			var other = self.inactive[ clientId ];
			var online = self.online[ clientId ];
			if ( other ) {
				delete self.inactive[ clientId ];
				self.inactiveIds = Object.keys( self.inactive );
				self.sortContactIds( self.inactiveIds );
			} else {
				delete self.online[ clientId ];
				self.onlineIds = Object.keys( self.online );
				self.sortContactIds( self.onlineIds );
			}
		}
	}
	
	ns.Treeroot.prototype.updateSettings = function( msg ) {
		const self = this;
		console.log( 'view.treeroot.updateSettings - NYI', msg );
	}
	
	ns.Treeroot.prototype.getMenuOptions = function( type ) {
		const self = this;
		const opts = [
			self.menuActions[ 'settings' ],
			self.menuActions[ 'reconnect' ],
			self.menuActions[ 'remove-module' ],
		];
		
		return opts;
	}
	
	ns.Treeroot.prototype.subscribe = function( e ) {
		var self = this;
		e.preventDefault();
		e.stopPropagation();
		self.mod.send({
			type : 'subscribe',
		});
	}
	
	ns.Treeroot.prototype.queryPassReset = function( data ) {
		var self = this;
		var tmplConf = {
			id      : friendUP.tool.uid( 'query-pass-reset' ),
			message : data.message,
		};
		var el = hello.template.getElement( 'treeroot-pass-reset-tmpl', tmplConf );
		self.serverMessage.show( el );
		bind( el );
		
		function bind( el ) {
			var codeInput = el.querySelector( '.recovery-code' );
			var passInput = el.querySelector( '.new-pass' );
			el.addEventListener( 'submit', onsubmit,  false );
			
			function onsubmit( e ) {
				e.preventDefault();
				e.stopPropagation();
				var form = e.target;
				var code = codeInput.value;
				var pass = passInput.value;
				
				if ( !code || !pass )
					return;
				
				var res = {
					recoveryKey : code,
					newPass     : pass,
				};
				self.returnQuery( data.callbackId, res );
			}
		}
	}
	
	ns.Treeroot.prototype.getName = function() {
		var self = this;
		var host = self.module.host.split( '.' )[ 0 ];
		var name = self.module.displayName || host || self.type;
		name = friendUP.tool.ucfirst( name );
		return name;
	}
	
	ns.Treeroot.prototype.close = function() {
		const self = this;
		self.closeBaseModule();
	}
	
})( library.view );


// IRC CHANNEL
(function( ns, undefined ) {
	ns.IrcChannel = function( conf ) {
		if ( !( this instanceof ns.IrcChannel ))
			return new ns.IrcChannel( conf );
		
		var self = this;
		self.data = conf.channel;
		self.topic = '';
		self.mode = {};
		self.users = {};
		
		self.highlight = friendUP.tool.uid( 'highlight' );
		self.messageWaiting = friendUP.tool.uid( 'msgWaiting' );
		self.optionMenu = friendUP.tool.uid( 'optionMenu' );
		
		library.view.BaseContact.call( self, conf );
		
		self.init();
	}
	
	ns.IrcChannel.prototype = Object.create( library.view.BaseContact.prototype );
	
	ns.IrcChannel.prototype.init = function() {
		var self = this;
		self.messageWaiting = new library.component.StatusIndicator({
			containerId : self.messageWaiting,
			type : 'icon',
			cssClass : 'fa-comment',
			statusMap : {
				'false' : 'Off',
				'true' : 'Notify',
			},
		});
		
		self.bindView();
		self.bindEvents();
	}
	
	ns.IrcChannel.prototype.buildElement = function() {
		var self = this;
		var conf = {
			clientId : self.clientId,
			channelName : self.identity.name,
			highlightId : self.highlight,
			messageWaitingId : self.messageWaiting,
			optionId : self.optionMenu,
		};
		var container = document.getElementById( self.containerId );
		var element = hello.template.getElement( 'irc-channel-tmpl', conf );
		container.appendChild( element );
	}
	
	ns.IrcChannel.prototype.bindView = function() {
		var self = this;
		self.conn.on( 'highlight', highlight );
		self.conn.on( 'msg-waiting', messageWaiting );
		
		function highlight( msg ) { self.setHighlight( msg ); }
		function messageWaiting( state ) { self.messageWaiting.set( state.isWaiting ? 'true' : 'false' ); }
	}
	
	ns.IrcChannel.prototype.setHighlight = function( msg ) {
		var self = this;
		console.log( 'view.IrcChannel.setHighlight - NYI', msg );
	}
	
	ns.IrcChannel.prototype.bindEvents = function() {
	
	}
	
	ns.IrcChannel.prototype.getMenuOptions = function() {
		const self = this;
		const opts = [
			self.menuActions[ 'open-chat' ],
			self.menuActions[ 'leave-room' ],
		];
		return opts;
	}

})( library.view );

// IRC PRIVATE

(function( ns, undefined ) {
	ns.IrcPrivate = function( conf ) {
		if ( !( this instanceof ns.IrcPrivate ))
			return new ns.IrcPrivate( conf );
		
		var self = this;
		self.data = conf.contact;
		self.messageWaiting = friendUP.tool.uid( 'message-waiting' );
		
		library.view.BaseContact.call( self, conf );
		
		self.init();
	}
	
	ns.IrcPrivate.prototype = Object.create( library.view.BaseContact.prototype );
	
	// Public
	
	// Private
	
	ns.IrcPrivate.prototype.init = function() {
		var self = this;
		self.messageWaiting = new library.component.StatusIndicator({
			containerId : self.messageWaiting,
			type : 'icon',
			cssClass : 'fa-comment',
			statusMap : {
				'false' : 'Off',
				'true' : 'Notify'
			}
		});
		
		self.bindEvents();
		self.bindView();
	}
	
	ns.IrcPrivate.prototype.buildElement = function() {
		var self = this;
		var tmplId = 'irc-private-tmpl';
		var conf = {
			clientId : self.clientId,
			contactName : self.identity.name,
			messageWaitingId : self.messageWaiting,
		};
		var container = document.getElementById( self.containerId );
		var element = hello.template.getElement( tmplId, conf );
		container.appendChild( element );
	}
	
	ns.IrcPrivate.prototype.bindEvents = function() {
		const self = this;
	}
	
	ns.IrcPrivate.prototype.getMenuOptions = function() {
		const self = this;
		const opts = [
			self.menuActions[ 'open-chat' ],
			self.menuActions[ 'invite-video' ],
			self.menuActions[ 'invite-audio' ],
			self.menuActions[ 'remove-chat' ],
		];
		return opts;
	}
	
	ns.IrcPrivate.prototype.bindView = function() {
		var self = this;
		self.conn.on( 'msg-waiting', messageWaiting );
		self.conn.on( 'highlight', handleHighlight );
		
		function messageWaiting( state ) {
			let isWaiting = state.isWaiting;
			self.messageWaiting.set( isWaiting ? 'true' : 'false' );
			let num = 'true' === isWaiting ? 1 : 0;
			state.unread = num;
			self.emit( 'msg-waiting', state );
		}
		
		function handleHighlight( msg ) {
			console.log( 'view.ircPriv - highlight - NYI', msg );
		}
	}
	
})( library.view );

// IRC
(function( ns, undefined ) {
	ns.IRC = function( conf ) {
		const self = this;
		library.view.BaseModule.call( self, conf );
		
		self.init();
	}
	
	ns.IRC.prototype = Object.create( library.view.BaseModule.prototype );
	
	ns.IRC.prototype.init = function() {
		var self = this;
		self.identity = {
			name : self.module.settings.nick,
		};
		
		self.connectionMap = {
			'error'   : cleanupClient,
			'offline' : cleanupClient,
		};
		
		function cleanupClient( msg ) { self.cleanupClient( msg ); }
		
		self.bindModuleEvents();
	}
	
	ns.IRC.prototype.buildRoomsElement = function() {
		var self = this;
		var tmplId = 'irc-module-tmpl';
		var title = self.getTitleString();
		var conf = {
			clientId    : self.roomsId,
			folditId    : self.roomsFoldit,
			moduleTitle : title,
			connStateId : self.roomsConnState,
			itemsId     : self.roomItemsId,
		};
		
		var element = hello.template.getElement( tmplId, conf );
		var container = document.getElementById( self.containers.conference );
		container.appendChild( element );
	}
	
	ns.IRC.prototype.buildContactsElement = function() {
		const self = this;
		self.contactsId = null;
		self.contactsFoldit = null;
		self.contactsConnState = null;
		self.contactItemsId = null;
	}
	
	ns.IRC.prototype.setLogoCss = function() {
		const self = this;
		const tmplId = 'fa-icon-logo-css-tmpl';
		// template conf
		const conf = {
		};
		self.insertLogoCss( tmplId, conf, self.roomsId );
		//self.insertLogoCss( tmplId, conf, self.contactsId );
	}
	
	ns.IRC.prototype.bindModuleEvents = function() {
		var self = this;
		self.mod.on( 'private', handlePrivate );
		self.mod.on( 'join', handleJoin );
		self.mod.on( 'leave', handleLeave );
		self.mod.on( 'setting', handleSetting );
		self.mod.on( 'remove', handleRemove );
		
		function handlePrivate( e ) { self.addPrivate( e ); }
		function handleJoin( e ) { self.joinChannel( e ); }
		function handleLeave( e ) { self.leaveChannel( e ); }
		function handleSetting( e ) { self.updateSetting( e ); }
		function handleRemove( e ) { self.removePrivate( e ); }
		
	}
	
	ns.IRC.prototype.addPrivate = function( data ) {
		var self = this;
		var conf = {
			menuActison : self.menuActions,
			containerId : self.roomItemsId,
			conn        : window.View,
			contact     : data,
		};
		var priv = new library.view.IrcPrivate( conf );
		self.contacts[ priv.clientId ] = priv;
		self.emit( 'add', priv, self.module.name );
	}
	
	ns.IRC.prototype.joinChannel = function( data ) {
		var self = this;
		var conf = {
			menuActions : self.menuActions,
			containerId : self.roomItemsId,
			conn        : window.View,
			channel     : data,
		};
		var channel = new library.view.IrcChannel( conf );
		self.contacts[ channel.clientId ] = channel;
	}
	
	ns.IRC.prototype.leaveChannel = function( clientId ) {
		var self = this;
		var channel = self.contacts[ clientId ];
		if ( !channel ) {
			return;
		}
		
		channel.close();
		delete self.contacts[ clientId ];
	}
	
	ns.IRC.prototype.removePrivate = function( clientId ) {
		const self = this;
		const priv = self.contacts[ clientId ];
		if ( !priv )
			return;
		
		priv.close();
		delete self.contacts[ clientId ];
	}
	
	ns.IRC.prototype.updateSetting = function( data ) {
		var self = this;
		if ( data.setting != 'displayName' )
			return;
		
		var element = document.getElementById( self.clientId );
		var title = element.querySelector( '.module-title' );
		title.innerHTML = data.value;
	}
	
	ns.IRC.prototype.getMenuOptions = function() {
		const self = this;
		const opts = [
			self.menuActions[ 'console' ],
			self.menuActions[ 'settings' ],
			self.menuActions[ 'reconnect' ],
			self.menuActions[ 'remove-module' ],
		];
		
		return opts;
	}
	
	ns.IRC.prototype.close = function() {
		const self = this;
		self.closeBaseModule();
	}
	
	
})( library.view );

// Presence
(function( ns, undefined ) {
	ns.Presence = function( conf ) {
		const self = this;
		self.userId = conf.userId;
		
		library.view.BaseModule.call( self, conf );
		self.init();
	}
	
	ns.Presence.prototype = Object.create( library.view.BaseModule.prototype );
	
	// Public
	
	// Pirvate
	ns.Presence.prototype.init = function() {
		const self = this;
		self.queryMap[ 'account-ask' ] = askForAccount;
		self.queryMap[ 'account-create' ] = createAccount;
		self.queryMap[ 'login-invalid' ] = loginInvalid;
		
		function askForAccount( e ) { self.askForAccount( e ); }
		function createAccount( e ) { self.createAccount( e ); }
		function loginInvalid( e ) { self.loginInvalid( e ); }
		
		self.bindModuleEvents();
	}
	
	ns.Presence.prototype.buildRoomsElement = function() {
		const self = this;
		const tmplId = 'presence-rooms-tmpl';
		const conf = {
			roomsId      : self.roomsId,
			folditId     : self.roomsFoldit,
			title        : self.getTitleString( 'conference' ),
			connStateId  : self.roomsConnState,
			itemsId      : self.roomItemsId,
		};
		const el = hello.template.getElement( tmplId, conf );
		const container = document.getElementById( self.containers.conference );
		container.appendChild( el );
	}
	
	ns.Presence.prototype.buildContactsElement = function() {
		const self = this;
		const tmplId = 'presence-rooms-tmpl';
		const conf = {
			roomsId     : self.contactsId,
			folditId     : self.contactsFoldit,
			title        : self.getTitleString( 'contact' ),
			connStateId  : self.contactsConnState,
			itemsId      : self.contactItemsId,
		};
		const el = hello.template.getElement( tmplId, conf );
		const container = document.getElementById( self.containers.contact );
		container.appendChild( el );
	}
	
	ns.Presence.prototype.setLogoCss = function() {
		const self = this;
		const tmplId = 'fa-icon-logo-css-tmpl';
		// template conf
		const conf = {
		};
		self.insertLogoCss( tmplId, conf, self.roomsId );
		self.insertLogoCss( tmplId, conf, self.contactsId );
	}
	
	ns.Presence.prototype.getTitleString = function( type ) {
		const self = this;
		if ( 'conference' === type )
			return window.View.i18n( 'i18n_conference_rooms' );//'Conference rooms';
		else
			return window.View.i18n( 'i18n_workgroup_contacts' );//'Workgroup contacts';
	}
	
	ns.Presence.prototype.bindModuleEvents = function() {
		var self = this;
		self.mod.on( 'user-id', userId );
		self.mod.on( 'join', joinedRoom );
		self.mod.on( 'remove', leftRoom );
		self.mod.on( 'contact-list', contactList );
		self.mod.on( 'contact-add', contactAdd );
		self.mod.on( 'contact-remove', contactRemove );
		
		function userId( e ) { self.userId = e; }
		function joinedRoom( e ) { self.handleRoomJoin( e ); }
		function leftRoom( e ) { self.handleRoomLeave( e ); }
		function contactList( e ) { self.handleContactList( e ); }
		function contactAdd( e ) { self.handleContactAdd( e ); }
		function contactRemove( e ) { self.handleContactRemove( e ); }
	}
	
	ns.Presence.prototype.updateTitle = function() {
		const self = this;
		update( self.roomsId, 'conference' );
		update( self.contactsId, 'contact' );
		
		function update( id, type ) {
			let el = document.getElementById( id );
			if ( !el )
				return;
			
			let title = self.getTitleString( type );
			let titleEl = el.querySelector( '.module-title' );
			titleEl.textContent = title;
		}
	}
	
	ns.Presence.prototype.handleRoomJoin = function( conf ) {
		const self = this;
		if ( conf.isPrivate ) {
			self.handleContactJoin( conf );
			return;
		}
		
		const cId = conf.clientId;
		if ( self.rooms[ cId ]) {
			return;
		}
		
		const roomConf = {
			menuActions : self.menuActions,
			containerId : self.roomItemsId,
			conn        : window.View,
			userId      : self.userId,
			room        : conf,
		};
		const room = new library.view.PresenceRoom( roomConf );
		self.rooms[ cId ] = room;
		self.emit( 'add', room );
	}
	
	ns.Presence.prototype.handleRoomLeave = function( roomId ) {
		const self = this;
		self.emit( 'remove', roomId );
		const room = self.rooms[ roomId ];
		if ( !room ) {
			return;
		}
		
		delete self.rooms[ roomId ];
		room.close();
	}
	
	ns.Presence.prototype.handleContactList = function( list ) {
		const self = this;
		if ( !list || !list.length )
			return;
		
		list.forEach( item => {
			self.addContact( item );
		});
	}
	
	ns.Presence.prototype.handleContactAdd = function( contact ) {
		const self = this;
		self.addContact( contact );
		
	}
	
	ns.Presence.prototype.handleContactRemove = function( clientId ) {
		const self = this;
		const contact = self.contacts[ clientId ];
		if ( !contact )
			return;
		
		delete self.contacts[ clientId ];
		self.contactIds = Object.keys( self.contacts );
		contact.close();
	}
	
	ns.Presence.prototype.addContact = function( conf ) {
		const self = this;
		const cId = conf.clientId;
		if ( cId === self.userId ) {
			console.log( 'Presence.addContact - is self, not adding' );
			return;
		}
		
		if ( self.contacts[ cId ]) {
			console.log( 'Presence.addContact - already added', cId );
			return;
		}
		
		const contactConf = {
			menuActions : self.menuActions,
			containerId : self.contactItemsId,
			userId      : self.userId,
			contact     : conf,
		};
		const contact = new library.view.PresenceContact( contactConf, window.View );
		self.contacts[ cId ] = contact;
		self.contactIds.push( cId );
		self.emit( 'add', contact );
	}
	
	ns.Presence.prototype.handleContactJoin = function( conf ) {
		const self = this;
		console.log( 'handleContactJoin - NYI', conf );
	}
	
	ns.Presence.prototype.getMenuOptions = function( type ) {
		const self = this;
		let opts = [
			self.menuActions[ 'reconnect' ],
		];
		if ( 'conference' === type )
			opts.push( self.menuActions[ 'create-room' ]);
		
		if ( 'contact' === type )
			;
		
		return opts;
	}
	
	ns.Presence.prototype.askForAccount = function( event ) {
		var self = this;
		const createId = friendUP.tool.uid( 'create' );
		const haveId = friendUP.tool.uid( 'have' );
		var conf = {
			id       : friendUP.tool.uid( 'ask-acc' ),
			createId : createId,
			haveId   : haveId,
		};
		var el = hello.template.getElement( 'presence-ask-account-tmpl', conf );
		self.serverMessage.show( el );
		bind( el );
		
		function bind( el ) {
			var createBtn = document.getElementById( createId );
			var haveBtn = document.getElementById( haveId );
			var cid = event.callbackId;
			createBtn.addEventListener( 'click', createClick, false );
			haveBtn.addEventListener( 'click', haveClick, false );
			function createClick( e ) { self.returnQuery( cid, 'create' ); }
			function haveClick( e ) { self.returnQuery( cid, 'have' ); }
		}
	}
	
	ns.Presence.prototype.createAccount = function( event ) {
		var self = this;
		var el = hello.template.getElement( 'presence-create-account-tmpl', conf );
		self.serverMessage.show( el );
		bind( el );
		
		function bind( el ) {
			var login = el.querySelector( 'input.login' );
			var pass = el.querySelector( 'input.passphrase' );
			
			el.addEventListener( 'submit', submit, false );
			function submit( e ) {
				e.stopPropagation();
				e.preventDefault();
				var info = {
					login : login.value.trim(),
					pass : pass.value.trim(),
				}
				
				if ( !info.pass )
					return;
				
				self.returnQuery( event.callbackId, info );
			}
		}
	}
	
	ns.Presence.prototype.loginInvalid = function( event ) {
		var self = this;
		console.log( 'loginInvalid', event );
	}
	
	ns.Presence.prototype.close = function() {
		const self = this;
		self.closeBaseModule();
	}
	
})( library.view );


(function( ns, undefined ) {
	ns.PresenceRoom = function( conf ) {
		var self = this;
		self.type = 'room';
		self.data = conf.room;
		self.userId = conf.userId;
		self.roomStatus = friendUP.tool.uid( 'room-status' );
		self.liveStatus = friendUP.tool.uid( 'live-status' );
		self.msgWaiting = friendUP.tool.uid( 'msg-waiting' );
		self.livePeers = [];
		self.isLive = false;
		
		self.unreadMessages = 0;
		
		ns.BaseContact.call( self, conf );
		self.init();
	}
	
	ns.PresenceRoom.prototype = Object.create( ns.BaseContact.prototype );
	
	ns.PresenceRoom.prototype.init = function() {
		var self = this;
		if ( !self.identity.name ) {
			self.unnamed = true;
			self.identity.name = '[ temporary room ]';
			self.updateName();
		}
		
		const roomConf = {
			containerId : self.roomStatus,
			type        : 'icon',
			cssClass    : 'fa-users',
			statusMap   : {
				'empty' : 'Off',
				'users' : 'Available',
			},
			display : '- / -',
		};
		self.roomStatus = new library.component.StatusDisplay( roomConf );
		
		const liveConf = {
			containerId : self.liveStatus,
			type      : 'icon',
			cssClass  : 'fa-video-camera',
			statusMap : {
				'empty'  : 'Off',
				'others' : 'Available',
				'timeout': 'Notify',
				'user'   : 'On',
			},
			display : '-',
		};
		self.liveStatus = new library.component.StatusDisplay( liveConf );
		
		const msgConf = {
			containerId : self.msgWaiting,
			type : 'icon',
			cssClass : 'fa-comment',
			statusMap : {
				'false' : 'Off',
				'true' : 'Notify'
			},
		};
		self.msgWaiting = new library.component.StatusIndicator( msgConf );
		
		self.bindUI();
		self.bindView();
	}
	
	ns.PresenceRoom.prototype.buildElement = function() {
		var self = this;
		var tmplId = 'presence-room-tmpl';
		var conf = {
			clientId     : self.clientId,
			name         : self.identity.name,
			roomStatusId : self.roomStatus,
			liveStatusId : self.liveStatus,
			msgWaitingId : self.msgWaiting,
		};
		var container = document.getElementById( self.containerId );
		var el = hello.template.getElement( tmplId, conf );
		container.appendChild( el );
	}
	
	ns.PresenceRoom.prototype.bindUI = function() {
		var self = this;
		var el = document.getElementById( self.clientId );
		
		self.showSetNameBtn = el.querySelector( '.show-set-name' );
		self.setNameForm = el.querySelector( '.room-name-form' );
		self.nameEl = el.querySelector( '.contact-name' );
		const hideSetNameBtn = self.setNameForm.querySelector( '.hide-set-name' );
		self.setNameInput = self.setNameForm.querySelector( 'input' );
		
		self.showSetNameBtn.addEventListener( 'click', showSetName, false );
		hideSetNameBtn.addEventListener( 'click', hideSetName, false );
		self.setNameForm.addEventListener( 'submit', setNameSubmit, false );
		self.setNameForm.addEventListener( 'click', nameInputEvent, false );
		self.setNameInput.addEventListener( 'focus', nameInputEvent, false );
		self.setNameInput.addEventListener( 'click', nameInputEvent, false );
		
		function videoClick( e ) {
			self.startVideo();
		}
		
		function audioClick( e ) {
			self.startVoice();
		}
		
		function chatClick( e ) {
			self.openChat();
		}
		
		function settingsClick( e ) {
			const openSettings = {
				type : 'settings',
				data : {
					tab : 'chat',
				},
			};
			self.send( openSettings );
		}
		
		function leaveClick( e ) {
			if ( !self.isAuthed && self.isPersistent )
				return;
			
			self.send({ type : 'leave' });
		}
		
		function showSetName( e ) {
			e.stopPropagation();
			self.toggleShowSetName( true );
		}
		
		function hideSetName( e ) {
			e.stopPropagation();
			self.toggleShowSetName( false );
		}
		
		function nameInputEvent( e ) {
			e.stopPropagation();
		}
		
		function setNameSubmit( e ) {
			e.preventDefault();
			e.stopPropagation();
			let name = self.setNameInput.value;
			if ( !name || !name.length )
				return;
			
			name = name.trim();
			const type = self.isPersistent ? 'rename' : 'persist';
			const nameEvent = {
				type : type,
				data : name,
			};
			send( nameEvent );
		}
		
		function send( event ) {
			self.send( event );
		}
	}
	
	ns.PresenceRoom.prototype.getMenuOptions = function() {
		const self = this;
		const opts = [
			self.menuActions[ 'open-chat' ],
			self.menuActions[ 'live-video' ],
			self.menuActions[ 'live-audio' ],
		];
		
		if ( self.menuSettings )
			opts.push( self.menuActions[ 'settings' ]);
		
		if ( self.isAuthed )
			opts.push( self.menuActions[ 'leave-room' ]);
		
		return opts;
	}
	
	ns.PresenceRoom.prototype.toggleShowSetName = function( show ) {
		const self = this;
		if ( !self.setNameForm )
			return;
		
		if ( self.showSetNameBtn )
			self.showSetNameBtn.classList.toggle( 'hidden', show );
		
		self.nameEl.classList.toggle( 'hidden', show );
		self.setNameForm.classList.toggle( 'hidden', !show );
		if ( show )
			self.setNameInput.focus();
	}
	
	ns.PresenceRoom.prototype.bindView = function() {
		var self = this;
		self.conn.on( 'init', init );
		self.conn.on( 'auth', auth );
		self.conn.on( 'persistent', persistent );
		self.conn.on( 'message', message );
		self.conn.on( 'msg-waiting', msgWaiting );
		self.conn.on( 'users', users );
		
		self.bindLive();
		
		function init( e ) { self.handleInit( e ); }
		function persistent( e ) { self.handlePersistent( e ); }
		function auth( e ) { self.handleIsAuthed( e ); }
		function message( e ) { self.handleMessage( e ); }
		function msgWaiting( e ) { self.handleMsgWaiting( e ); }
		function users( e ) { self.updateRoomStatus( e ); }
	}
	
	ns.PresenceRoom.prototype.handleInit = function( event ) {
		const self = this;
		self.isOwner = event.isOwner;
		self.isAdmin = event.isAdmin;
		self.handlePersistent( event );
		self.handleIsAuthed( event.isAuthed );
		self.toggleSettings(( self.isOwner || self.isAdmin ) && self.isPersistent );
	}
	
	ns.PresenceRoom.prototype.handlePersistent = function( event ) {
		const self = this;
		self.isPersistent = event.persistent;
		if ( !self.isPersistent ) {
			if (( self.isOwner || self.isAdmin ) && self.showSetNameBtn )
				self.showSetNameBtn.classList.toggle( 'hidden', false );
			return;
		}
		
		self.removeNameThings();
		if ( self.isOwner || self.isAdmin )
			self.toggleSettings( true );
	}
	
	ns.PresenceRoom.prototype.handleIsAuthed = function( isAuthed ) {
		const self = this;
		self.isAuthed = isAuthed || false;
	}
	
	ns.PresenceRoom.prototype.removeNameThings = function() {
		const self = this;
		self.toggleShowSetName( false );
		if ( self.showSetNameBtn )
			self.showSetNameBtn.parentNode.removeChild( self.showSetNameBtn );
		
		if ( self.setNameForm )
			self.setNameForm.parentNode.removeChild( self.setNameForm );
		
		delete self.showSetNameBtn;
		delete self.setNameForm;
	}
	
	ns.PresenceRoom.prototype.handleMessage = function( msg ) {
		const self = this;
		self.emit( 'message', msg );
	}
	
	ns.PresenceRoom.prototype.handleMsgWaiting = function( state ) {
		const self = this;
		if ( state.isWaiting )
			self.unreadMessages++;
		else
			self.unreadMessages = 0;
		
		state.unread = self.unreadMessages;
		self.msgWaiting.set( state.isWaiting ? 'true' : 'false' );
		self.emit( 'msg-waiting', state );
	}
	
	ns.PresenceRoom.prototype.toggleSettings = function( show ) {
		const self = this;
		self.menuSettings = show;
	}
	
	ns.PresenceRoom.prototype.updateRoomStatus = function( data ) {
		const self = this;
		let state = 'empty';
		if ( 0 !== data.online )
			state = 'users';
		
		//let display = [ data.online, data.users ];
		//display = display.join( ' / ' );
		let online = '-';
		if ( 0 !== data.online )
			online = data.online;
		
		self.roomStatus.set( state );
		self.roomStatus.setDisplay( online );
		self.emit( 'participants', data.online );
	}
	
	ns.PresenceRoom.prototype.bindLive = function() {
		const self = this;
		self.live = new library.component.EventNode(
			'live',
			self.conn
		);
		self.live.on( 'user-join', userJoin );
		self.live.on( 'user-leave', userLeave );
		self.live.on( 'peers', peers );
		self.live.on( 'join', join );
		self.live.on( 'leave', leave );
		
		function userJoin( accId ) {
			self.isLive = true;
			self.updateLiveDisplay();
		}
		
		function userLeave( accId ) {
			self.isLive = false;
			self.updateLiveDisplay();
		}
		
		function peers( peers ) {
			self.livePeers = peers;
			self.updateLiveDisplay();
		}
		
		function join( peer ) {
			const peerId = peer.peerId;
			const pix = self.livePeers.indexOf( peerId );
			if ( -1 === pix )
				self.livePeers.push( peerId );
			
			self.updateLiveDisplay();
		}
		
		function leave( peer ) {
			const peerId = peer.peerId;
			self.livePeers = self.livePeers
				.filter( isNotLeaver );
				
			self.updateLiveDisplay();
			
			function isNotLeaver( pid ) {
				return pid !== peerId;
			}
		}
	}
	
	ns.PresenceRoom.prototype.updateLiveDisplay = function() {
		const self = this;
		const num = self.livePeers.length;
		if ( !num )
			self.emit( 'live', false );
		else
			self.emit( 'live', true );
		
		setDisplay();
		const isInPeerList = !( -1 == self.livePeers.indexOf( self.userId ));
		if ( isInPeerList && self.isLive ) {
			setStatus( 'user' );
			self.emit( 'user-live', true );
			self.userIsLive = true;
			return;
		}
		
		if ( isInPeerList ) {
			setStatus( 'timeout' );
			return;
		}
		
		if ( self.userIsLive ) {
			self.userIsLive = false;
			self.emit( 'user-live', false );
		}
		
		if ( self.livePeers.length )
			setStatus( 'others' );
		else
			setStatus( 'empty' );
		
		function setStatus( type ) {
			self.liveStatus.set( type );
		}
		function setDisplay( num ) {
			if ( 0 == num )
				num = '-';
			
			self.liveStatus.setDisplay( num );
		}
	}
	
})( library.view );


// PresenceContact
(function( ns, undefiend ) {
	ns.PresenceContact = function( conf, conn ) {
		const self = this;
		self.type = 'contact';
		self.data = conf.contact;
		self.userId = conf.userId;
		self.userLive = false;
		self.contactLive = false;
		self.isOnline = false;
		
		library.view.BaseContact.call( self, conf, conn );
		
		self.init( conf.contact );
	}
	
	ns.PresenceContact.prototype = Object.create( library.view.BaseContact.prototype );
	
	// Public
	
	ns.PresenceContact.prototype.getOnline = function() {
		const self = this;
		return self.identity.isOnline;
	}
	
	// Private
	
	ns.PresenceContact.prototype.buildElement = function() {
		const self = this;
		self.onlineStatus = friendUP.tool.uid( 'status' );
		self.liveStatus = friendUP.tool.uid( 'live' );
		self.msgStatus = friendUP.tool.uid( 'msg' );
		const tmplId = 'presence-contact-tmpl';
		const conf = {
			clientId     : self.clientId,
			avatarSrc    : self.identity.avatar,
			statusId     : self.onlineStatus,
			name         : self.identity.name,
			liveStatusId : self.liveStatus,
			msgWaitingId : self.msgStatus,
		};
		const container = document.getElementById( self.containerId );
		const el = hello.template.getElement( tmplId, conf );
		container.appendChild( el );
	}
	
	ns.PresenceContact.prototype.init = function( contact ) {
		const self = this;
		self.unreadMessages = contact.unreadMessages || 0;
		self.lastMessage = contact.lastMessage || null;
		
		self.buildStatus();
		self.buildLive();
		self.buildMsgWaiting();
		
		self.conn.on( 'online', isOnline );
		self.conn.on( 'message', message );
		self.conn.on( 'msg-waiting', msgWaiting );
		
		self.bindLive();
		
		function isOnline( e ) { self.handleOnline( e ); }
		function message( e ) { self.handleMessage( e ); }
		function msgWaiting( e ) { self.handleMsgWaiting( e ); }
		
		self.handleOnline( self.identity.isOnline );
		if ( !!self.unreadMessages )
			unreadMessages();
		
		function unreadMessages() {
			const state = {
				unread : self.unreadMessages,
			};
			if ( self.lastMessage ) {
				const lm = self.lastMessage.data;
				state.message = lm.message;
				state.from = !!lm.from;
				state.time = lm.time;
			}
			self.handleMsgWaiting( state );
		}
	}
	
	ns.PresenceContact.prototype.buildStatus = function() {
		const self = this;
		self.onlineStatus = new library.component.StatusIndicator({
			containerId : self.onlineStatus,
			type        : 'led',
			cssClass    : 'led-online-status PadBorder',
			statusMap   : {
				offline   : 'Off',
				online    : 'On',
			},
		});
		self.handleOnline();
	}
	
	ns.PresenceContact.prototype.buildLive = function() {
		const self = this;
		self.liveStatus = new library.component.CallStatus( self.liveStatus, true );
		self.liveStatus.on( 'video', () => self.startVideo());
		self.liveStatus.on( 'audio', () => self.startVoice());
		self.liveStatus.on( 'notify', () => self.sendCallNotification());
		/*
		self.liveStatus = new library.component.StatusCall({
			containerId : self.liveStatus,
			statusMap : {
				'empty'  : 'Off',
				'other'  : 'Available',
				'timeout': 'Notify',
				'user'   : 'On',
			},
		});
		*/
	}
	
	ns.PresenceContact.prototype.buildMsgWaiting = function() {
		const self = this;
		self.msgStatus = new library.component.StatusDisplay({
			containerId : self.msgStatus,
			type        : 'led',
			cssClass    : 'led-unread-status',
			statusMap   : {
				'false'   : 'Off',
				'true'    : 'Notify',
			},
			display : '',
		});
	}
	
	ns.PresenceContact.prototype.getMenuOptions = function() {
		const self = this;
		const opts = [
			self.menuActions[ 'open-chat' ],
			self.menuActions[ 'live-video' ],
			self.menuActions[ 'live-audio' ],
		];
		return opts;
	}
	
	ns.PresenceContact.prototype.bindLive = function() {
		const self = this;
		self.live = new library.component.EventNode(
			'live',
			self.conn
		);
		self.live.on( 'user-join', userJoin );
		self.live.on( 'user-leave', userLeave );
		self.live.on( 'peers', peers );
		self.live.on( 'join', join );
		self.live.on( 'leave', leave );
		
		function userJoin( accId ) {
			self.isLive = true;
			self.liveStatus.setUserLive( true );
			self.emit( 'live-user', true );
		}
		
		function userLeave( accId ) {
			self.isLive = false;
			self.liveStatus.setUserLive( false );
			self.emit( 'live-user', false );
		}
		
		function peers( peers ) {
			console.log( 'peers', peers );
			self.livePeers = peers;
			
		}
		
		function join( peer ) {
			const peerId = peer.peerId;
			if ( peerId !== self.clientId )
				return;
			
			self.liveStatus.setContactLive( true );
			self.emit( 'live-contact', true );
		}
		
		function leave( peer ) {
			const peerId = peer.peerId;
			if ( peerId !== self.clientId )
				return;
			
			self.liveStatus.setContactLive( false );
			self.emit( 'live-contact', false );
		}
	}
	
	ns.PresenceContact.prototype.handleOnline = function( isOnline ) {
		const self = this;
		isOnline = !!isOnline;
		self.isOnline = isOnline;
		self.emit( 'online', isOnline );
		if ( isOnline ) {
			self.onlineStatus.set( 'online' );
			self.onlineStatus.show();
		} else {
			self.onlineStatus.set( 'offline' );
			self.onlineStatus.hide();
		}
	}
	
	ns.PresenceContact.prototype.handleMessage = function( msg ) {
		const self = this;
		self.emit( 'message', msg );
	}
	
	ns.PresenceContact.prototype.handleMsgWaiting = function( state ) {
		const self = this;
		if ( state.unread ) {
			self.unreadMessages = state.unread;
			state.isWaiting = true;
		}
		else {
			if ( state.isWaiting )
				self.unreadMessages++;
			else
				self.unreadMessages = 0;
		}
		
		state.unread = self.unreadMessages;
		self.msgStatus.set( state.isWaiting ? 'true' : 'false' );
		self.msgStatus.setDisplay( self.unreadMessages );
		self.emit( 'msg-waiting', state );
		if ( state.isWaiting )
			self.msgStatus.show();
		else
			self.msgStatus.hide();
	}
	
	ns.PresenceContact.prototype.sendCallNotification = function() {
		const self = this;
		const notie = {
			type : 'call-notification',
			data : null,
		};
		self.send( notie );
	}
	
})( library.view );


// TElegram
(function( ns, undefined ) {
	ns.Telegram = function( conf ) {
		if ( !( this instanceof ns.Telegram ))
			return new ns.Telegram( conf );
		
		var self = this;
		library.view.BaseModule.call( self, conf );
		
		self.init();
	}
	
	ns.Telegram.prototype = Object.create( library.view.BaseModule.prototype );
	
	// Public
	
	// Private
	
	ns.Telegram.prototype.init = function() {
		const self = this;
	}
	
})( library.view );


// ACCONT
(function( ns, undefined ) {
	ns.Account = function() {
		if ( !( this instanceof ns.Account ))
			return new ns.Account();
		
		var self = this;
		self.view = null;
		
		self.init();
	}
	
	ns.Account.prototype.init = function() {
		var self = this;
		self.view = new library.component.SubView({
			parent : window.View,
			type : 'account',
		});
		
		self.bindView();
	}
	
	ns.Account.prototype.bindView = function() {
		var self = this;
		self.view.on( 'update', update );
		self.view.on( 'availability', setAvailability );
		
		function update( msg ) { self.update( msg ); }
		function setAvailability( msg ) { self.setAvailability( msg ); }
	}
	
	ns.Account.prototype.update = function( data ) {
		var self = this;
		console.log( 'view.Account.update - NYI', data );
	}
	
	ns.Account.prototype.setAvailability = function( state ) {
		var self = this;
		console.log( 'view.Account.setAvaliability - NYI', state );
	}
	
	ns.Account.prototype.showSettings = function() {
		var self = this;
		self.view.send({
			type : 'settings',
		});
	}
	
})( library.view );

// MODULECONTROL sub view
(function( ns, undefined ) {
	ns.ModuleControl = function( recent ) {
		const self = this;
		self.recent = recent;
		self.type = 'module';
		self.view = null;
		self.containerId = 'active-modules';
		self.addButtonId = 'add-module';
		self.askAddType = null;
		
		self.active = {};
		
		self.init();
	}
	
	// Public
	
	ns.ModuleControl.prototype.create = function( module ) {
		var self = this;
		var msg = {
			type : 'create',
		};
		
		if ( module )
			msg.data = module;
		
		self.send( msg );
	}
	
	// Private
	
	ns.ModuleControl.prototype.init = function() {
		var self = this;
		self.moduleTypeMap = {
			treeroot : library.view.Treeroot,
			irc      : library.view.IRC,
			presence : library.view.Presence,
			telegram : library.view.Telegram,
		};
		
		self.setGuide();
		
		self.view = new library.component.SubView({
			parent : window.View,
			type : self.type,
		});
		self.bindView();
	}
	
	ns.ModuleControl.prototype.setGuide = function() {
		const self = this;
		self.guide = new library.component.InfoBox({
			containerId : 'active-modules',
			element     : null,
		});
	}
	
	ns.ModuleControl.prototype.bindView = function() {
		var self = this;
		self.view.on( 'add', add );
		self.view.on( 'remove', remove );
		self.view.on( 'showguide', showguide );
		self.view.on( 'askaddmodule', askAddModule );
		
		function add( msg ) { self.add( msg ); }
		function remove( msg ) { self.remove( msg ); }
		function showguide() { self.guide.show(); }
		function askAddModule( msg ) { self.askAddModule( msg ); }
	}
	
	ns.ModuleControl.prototype.add = function( data ) {
		const self = this;
		self.addModule( data );
	}
	
	ns.ModuleControl.prototype.getContainerId = function( moduleType ) {
		const self = this;
		return {
			conference : 'active-modules',
			contact    : 'active-modules',
		};
	}
	
	ns.ModuleControl.prototype.addModule = function( data ) {
		const self = this;
		if ( data.module.type == self.askAddType || !self.askAddType )
			self.guide.hide();
		
		// TODO: Check for module options and gui options
		const containers = self.getContainerId( data.module.type );
		const conf = {
			module     : data.module,
			identity   : data.identity,
			containers : containers,
			parentView : window.View,
		};
		let Constructor = self.moduleTypeMap[ data.module.type ];
		if ( !Constructor ) {
			console.log( 'view.ModuleControl.add - no real constructor for ', data.module );
			Constructor = library.view.BaseModule;
		}
		
		const module = new Constructor( conf );
		self.active[ module.id ] = module;
		if ( self.recent )
			self.recent.registerModule( module );
		
	}
	
	ns.ModuleControl.prototype.remove = function( clientId ) {
		var self = this;
		var module = self.active[ clientId ];
		
		if ( !module )
			throw new Error( 'view.ModuleControl.remove - invalid clinetId ' + clientId );
		
		if( self.recent )
			self.recent.releaseModule( clientId );
		
		module.close();
		delete self.active[ clientId ];
		
		if ( noModulesLeft())
			self.showGuide();
		
		function noModulesLeft() {
			var keys = Object.keys( self.active );
			return !keys.length;
		}
	}
	
	ns.ModuleControl.prototype.askAddModule = function( data ) {
		var self = this;
		self.askAddType = data.type;
		var tmplConf = {
			id : friendUP.tool.uid( 'ask-add-mod' ),
			name : data.name,
		};
		var element = hello.template.getElement( 'ask-add-module-tmpl', tmplConf );
		self.guide.show( element );
		bind( element );
		
		function bind( element ) {
			var acceptBtn = element.querySelector( '.choice-buttons .accept' );
			var choiceBtn = element.querySelector( '.choice-buttons .choice' );
			var cancelBtn = element.querySelector( '.choice-buttons .cancel' );
			
			acceptBtn.addEventListener( 'click', accept, false );
			choiceBtn.addEventListener( 'click', choice, false );
			cancelBtn.addEventListener( 'click', cancel, false );
			
			function accept( e ) {
				resetAskAdd();
				self.create( data );
			}
			
			function choice( e ) {
				resetAskAdd();
				self.create();
			}
			
			function cancel( e ) {
				resetAskAdd();
				self.guide.hide();
			}
			
			function resetAskAdd() {
				self.askAddType = null;
			}
		}
	}
	
	ns.ModuleControl.prototype.showGuide = function() {
		var self = this;
		var guideConf = {
			title : 'Ohnoes!',
			explanation : 'No chat network added ',
			figureClass : 'native-menu-pointer',
		};
		var element = hello.template.getElement( 'guide-tmpl', guideConf );
		self.guide.show( element );
	}
	
	ns.ModuleControl.prototype.send = function( msg ) {
		var self = this;
		self.view.send( msg );
	}
})( library.view );


// NOTIFICATION
(function( ns, undefined ) {
	ns.Notification = function( containerId ) {
		if( !( this instanceof ns.Notification))
			return new ns.Notification( containerId );
		
		var self = this;
		self.type = 'notification';
		self.containerId = containerId;
		self.output = friendUP.tool.uid( 'notification-output' );
		self.unread = friendUP.tool.uid( 'notification-unread' );
		self.view = null;
		
		self.init();
	}
	
	ns.Notification.prototype.init = function() {
		var self = this;
		self.buildHtml();
		self.view = new library.component.SubView({
			parent : window.View,
			type : self.type,
		});
		
		self.bindView();
		self.bindEvents();
		
		self.setEmpty();
	}
	
	ns.Notification.prototype.buildHtml = function() {
		var self = this;
		var conf = {
			outputId : self.output,
			unreadId : self.unread,
		};
		var element = hello.template.getElement( 'notification-tmpl', conf )
		var container = document.getElementById( self.containerId );
		container.appendChild( element );
		self.output = document.getElementById( self.output );
		self.unread = document.getElementById( self.unread );
	}
	
	ns.Notification.prototype.bindView = function() {
		var self = this;
		self.view.on( 'clear', clear );
		self.view.on( 'toggle', setLogOpen );
		self.view.on( 'info', info );
		self.view.on( 'positive', positive );
		self.view.on( 'notify', notify );
		self.view.on( 'alert', alert );
		self.view.on( 'waiting', waiting );
		self.view.on( 'theskyisfalling', runForTheHills );
		
		function clear( msg ) { self.clear( msg ); }
		function setLogOpen( msg ) { self.setLogOpen( msg ); }
		function info( msg ) { self.setInfo( msg ); }
		function positive( msg ) { self.setPositive( msg ); }
		function notify( msg ) { self.setNotify( msg ); }
		function alert( msg ) { self.setAlert( msg ); }
		function waiting( msg ) { self.setWaiting( msg ); }
		function runForTheHills( msg ) { self.setRunForTheHills( msg ); }
	}
	
	ns.Notification.prototype.clear = function() {
		var self = this;
		self.setEmpty();
		self.clearUnread();
	}
	
	ns.Notification.prototype.setLogOpen = function( isOpen ) {
		var self = this;
		self.logIsOpen = isOpen === 'true' ? true : false;
		if ( self.logIsOpen )
			self.clearUnread();
	}
	
	ns.Notification.prototype.setInfo = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg );
		self.set( data );
	}
	
	ns.Notification.prototype.setPositive = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg );
		data.tmplId = '';
		self.set( data );
	}
	
	ns.Notification.prototype.setNotify = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg );
		data.tmplId = '';
		self.set( data );
	}
	
	ns.Notification.prototype.setAlert = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg );
		data.tmplId = '';
		self.set( data );
	}
	
	ns.Notification.prototype.setWaiting = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg );
		data.tmplId = '';
		self.set( data );
	}
	
	ns.Notification.prototype.setRunForTheHills = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg );
		data.tmplId = '';
		self.set( data );
	}
	
	ns.Notification.prototype.setEmpty = function() {
		var self = this;
		var data = self.getGeneric( '-' );
		self.set( data, false );
		self.clearUnread();
	}
	
	ns.Notification.prototype.getGeneric = function( msg ) {
		return {
			tmplId : null,
			conf : {
				message : msg.message,
				time : msg.time,
			}
		}
	}
	
	ns.Notification.prototype.set = function( msg, doIncrement ) { // doIncrement defaults to true
		var self = this;
		var increment = ( typeof( doIncrement ) != 'undefined' ) ? doIncrement : true;
		var tmplId = msg.tmplId || 'notification-message-tmpl';
		var html = hello.template.get( tmplId, msg.conf );
		self.output.innerHTML = html;
		
		if ( !increment )
			return;
		
		self.setUnread();
	}
	
	ns.Notification.prototype.bindEvents = function() {
		var self = this;
		var container = document.getElementById( self.containerId );
		container.addEventListener( 'click', click, false );
		function click( e ) { self.toggle(); }
	}
	
	ns.Notification.prototype.toggle = function() {
		var self = this;
		self.view.send({
			type : 'toggle',
		});
		
		self.clearUnread();
	}
	
	ns.Notification.prototype.setUnread = function() {
		var self = this;
		if ( self.logIsOpen )
			return;
		
		self.output.classList.toggle( 'unread', true );
		var currentNum = parseInt( self.unread.innerHTML, 10 ) || 0;
		self.unread.innerHTML = currentNum + 1;
	}
	
	ns.Notification.prototype.clearUnread = function() {
		var self = this;
		self.output.classList.toggle( 'unread', false );
		self.unread.innerHTML = ' ';
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.AssistUI = function( parentId ) {
		const self = this;
		self.parentId = parentId;
		
		self.mode = '';
		self.modules = {};
		self.contacts = {};
		self.unread = {};
		self.onlineIds = [];
		
		self.init();
		
	}
	
	// Public
	
	ns.AssistUI.prototype.registerModule = function( module ) {
		const self = this;
		let mId = module.id;
		if ( self.modules[ mId ]) {
			console.log( 'AssistUI.register - module already registered', module );
			throw new Error( 'see above ^^^' );
		}
		
		self.modules[ mId ] = {
			addId    : null,
			removeId : null,
			module   : module,
		};
		const mod = self.modules[ mId ];
		mod.addId = module.on( 'add', add );
		mod.removeId = module.on( 'remove', remove );
		
		function add( contact, modName ) {
			self.addContactFor( mId, contact, modName );
		}
		
		function remove( contactId ) {
			self.removeContactFor( mId, contactId );
		}
	}
	
	ns.AssistUI.prototype.releaseModule = function( modId ) {
		const self = this;
		const mod = self.modules[ modId ];
		if ( !mod )
			return;
		
		delete self.modules[ modId ];
		const module = mod.module;
		module.off( mod.addId );
		module.off( mod.removeId );
	}
	
	ns.AssistUI.prototype.close = function() {
		const self = this;
		delete self.parentId;
		
		delete self.videoBtn;
		delete self.videoSel;
		delete self.voiceBtn;
		delete self.voiceSel;
		delete self.textBt;
		delete self.textSel;
		
		delete self.selectUser;
		delete self.selectUnread;
		
		delete self.contacts;
		delete self.unread;
		delete self.storage;
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
	}
	
	// Private
	
	ns.AssistUI.prototype.init = function() {
		const self = this;
		self.modeMap = {
			'video' : startVideo,
			'voice' : startVoice,
			'text'  : openChat,
		};
		
		function startVideo( e ) { self.startVideo( e ); }
		function startVoice( e ) { self.startVoice( e ); }
		function openChat( e ) { self.openChat( e ); }
		
		const parent = document.getElementById( self.parentId );
		self.el = hello.template.getElement( 'assist-ui-tmpl', {} );
		parent.appendChild( self.el );
		parent.classList.toggle( 'hidden', false );
		
		self.videoBtn = document.getElementById( 'assist-video-btn' );
		self.videoSel = document.getElementById( 'assist-video-selected' );
		self.voiceBtn = document.getElementById( 'assist-voice-btn' );
		self.voiceSel = document.getElementById( 'assist-voice-selected' );
		self.textBtn = document.getElementById( 'assist-text-btn' );
		self.textSel = document.getElementById( 'assist-text-selected' );
		
		self.selectUser = document.getElementById( 'assist-select-user' );
		self.selectUnread = document.getElementById( 'assist-select-from' );
		
		self.storage = document.getElementById( 'assist-options-storage' );
		
		self.videoBtn.addEventListener( 'click', videoClick, false );
		self.voiceBtn.addEventListener( 'click', voiceClick, false );
		self.textBtn.addEventListener( 'click', textClick, false );
		
		self.selectUser.addEventListener( 'input', userInput, false );
		self.selectUnread.addEventListener( 'input', unreadInput, false );
		
		self.handleTextClick();
		self.updateUnread();
		
		function videoClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.handleVideoClick();
		}
		
		function voiceClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.handleVoiceClick();
		}
		
		function textClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.handleTextClick();
		}
		
		function userInput( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.handleSelectUser();
		}
		
		function unreadInput( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.handleSelectUnread();
		}
		
	}
	
	ns.AssistUI.prototype.handleVideoClick = function() {
		const self = this;
		self.clearClicked();
		self.toggleSelect( self.videoBtn, true );
		self.toggleOn( self.videoSel, true );
		self.setSelectUserReady();
		self.mode = 'video';
	}
	
	ns.AssistUI.prototype.handleVoiceClick = function() {
		const self = this;
		self.clearClicked();
		self.toggleSelect( self.voiceBtn, true );
		self.toggleOn( self.voiceSel, true );
		self.setSelectUserReady();
		self.mode = 'voice';
	}
	
	ns.AssistUI.prototype.handleTextClick = function() {
		const self = this;
		self.clearClicked();
		self.toggleSelect( self.textBtn, true );
		self.toggleOn( self.textSel, true );
		self.setSelectUserReady();
		self.mode = 'text';
	}
	
	ns.AssistUI.prototype.setSelectUserReady = function() {
		const self = this;
		self.selectUser.classList.toggle( 'Accept', true );
	}
	
	ns.AssistUI.prototype.clearClicked = function() {
		const self = this;
		self.toggleSelect( self.videoBtn, false );
		self.toggleSelect( self.voiceBtn, false );
		self.toggleSelect( self.textBtn, false );
		self.selectUser.classList.toggle( 'Accept', false )
		self.clearOn();
	}
	
	ns.AssistUI.prototype.clearOn = function() {
		const self = this;
		self.toggleOn( self.videoSel, false );
		self.toggleOn( self.voiceSel, false );
		self.toggleOn( self.textSel, false );
	}
	
	ns.AssistUI.prototype.toggleSelect = function( el, isOn ) {
		const self = this;
		el.classList.toggle( 'Accept', isOn );
	}
	
	ns.AssistUI.prototype.toggleOn = function( el, isOn ) {
		const self = this;
		el.classList.toggle( 'On', isOn );
		el.classList.toggle( 'Off', !isOn );
	}
	
	ns.AssistUI.prototype.handleSelectUser = function() {
		const self = this;
		const cId = self.selectUser.value;
		self.resetSelectUser();
		if ( !self.mode )
			return;
		
		const handler = self.modeMap[ self.mode ];
		handler( cId );
	}
	
	ns.AssistUI.prototype.startVideo = function( contactId ) {
		const self = this;
		const meta = self.contacts[ contactId ];
		if ( !meta )
			return;
		
		meta.contact.startVideo();
	}
	
	ns.AssistUI.prototype.startVoice = function( contactId ) {
		const self = this;
		const meta = self.contacts[ contactId ];
		if ( !meta )
			return;
		
		meta.contact.startVoice();
	}
	
	ns.AssistUI.prototype.openChat = function( contactId ) {
		const self = this;
		const meta = self.contacts[ contactId ];
		if ( !meta )
			return;
		
		meta.contact.openChat();
	}
	
	ns.AssistUI.prototype.handleSelectUnread = function() {
		const self = this;
		const cId = self.selectUnread.value;
		const meta = self.contacts[ cId ];
		self.resetSelectUnread();
		if ( !meta )
			return;
		
		meta.contact.openChat();
	}
	
	ns.AssistUI.prototype.resetSelectUser = function() {
		const self = this;
		self.selectUser.value = 'initial';
	}
	
	ns.AssistUI.prototype.resetSelectUnread = function() {
		const self = this;
		self.selectUnread.value = 'unread-initial';
	}
	
	ns.AssistUI.prototype.addContactFor = function( modId, contact, modName ) {
		const self = this;
		//modName = !!modName ? ' - ' + modName : '';
		modName = '';
		const cId = contact.id;
		const name = contact.getName();
		const isOnline = contact.getOnline();
		const unread = contact.getUnreadMessages();
		const userOptId = cId + '_assist_user';
		const unreadOptId = cId + '_assist_unread';
		const optionConf = {
			id       : userOptId,
			clientId : cId,
			name     : name,
			modName  : modName,
		};
		
		const optEl = hello.template.getElement( 'assist-call-option-tmpl', optionConf );
		self.storage.appendChild( optEl );
		self.contacts[ cId ] = {
			userOptId   : userOptId,
			unreadOptId : unreadOptId,
			contact     : contact,
			name        : name,
			modName     : modName,
			el          : optEl,
		};
		
		if ( isOnline )
			self.updateContactOnline( cId, true );
		
		if ( unread )
			self.setMsgUnread( cId, unread );
		
		contact.on( 'online', online );
		contact.on( 'msg-waiting', waiting );
		
		function online( isOnline ) {
			self.updateContactOnline( cId, isOnline );
		}
		
		function waiting( num ) {
			self.setMsgUnread( cId, num );
		}
	}
	
	ns.AssistUI.prototype.removeContactFor = function( modId, contactId ) {
		const self = this;
		const meta = self.contacts[ contactId ];
		if ( !meta )
			return;
		
		self.removeFromUnread( contactId );
		self.setOffline( contactId, meta );
		delete self.contacts[ contactId ];
		if ( meta.el && meta.el.parentNode )
			meta.el.parentNode.removeChild( meta.el );
		
		const contact = meta.contact;
		delete meta.contact;
		contact.release( 'online' );
		contact.release( 'msg-waiting' );
	}
	
	ns.AssistUI.prototype.updateContactOnline = function( cId, isOnline ) {
		const self = this;
		const meta = self.contacts[ cId ];
		if ( !meta )
			return;
		
		if ( isOnline )
			setOnline( cId );
		else
			self.setOffline( cId, meta );
		
		function setOnline( cId ) {
			self.onlineIds.push( cId );
			self.sortOnline();
		}
		
	}
	
	ns.AssistUI.prototype.setOffline = function( cId, meta ) {
		const self = this;
		self.onlineIds = self.onlineIds.filter( notCId );
		self.storage.appendChild( meta.el );
		
		function notCId( oId ) {
			return oId !== cId;
		}
	}
	
	ns.AssistUI.prototype.sortOnline = function() {
		const self = this;
		if ( !self.onlineSortTimeout )
			self.onlineSortTimeout = setTimeout( sort, 250 );
		else {
			clearTimeout( self.onlineSortTimeout );
			self.onlineSortTimeout = setTimeout( sort, 250 );
		}
		
		function sort() {
			self.onlineSortTimeout = null;
			let idNameMap = {};
			self.onlineIds.forEach( idNamePairs );
			let sortedIds = self.sortByName( idNameMap );
			sortedIds.forEach( reAppend );
			
			function idNamePairs( id ) {
				let contact = self.contacts[ id ];
				idNameMap[ id ] = contact.name;
			}
			
			function reAppend( id ) {
				let contact = self.contacts[ id ];
				self.selectUser.appendChild( contact.el );
			}
		}
	}
	
	ns.AssistUI.prototype.setMsgUnread = function( cId, unread ) {
		const self = this;
		const unMeta = self.unread[ cId ];
		if ( !unMeta && unread ) {
			self.addToUnread( cId, unread );
			return;
		}
		
		if ( unread )
			self.updateUnreadFrom( cId, unread );
		else
			self.removeFromUnread( cId );
	}
	
	ns.AssistUI.prototype.setMsgWaiting = function( cId, unread ) {
		const self = this;
	}
	
	ns.AssistUI.prototype.addToUnread = function( cId, unread ) {
		const self = this;
		const meta = self.contacts[ cId ];
		if ( !meta )
			return;
		
		self.unread[ cId ] = {
			id     : meta.unreadOptId,
			el     : null,
			name   : meta.name,
			unread : unread,
		};
		
		const el = self.buildUnreadOpt( cId );
		if ( !el )
			return;
		
		self.unread[ cId ].el = el;
		self.selectUnread.appendChild( el );
		self.updateUnread();
	}
	
	ns.AssistUI.prototype.updateUnreadFrom = function( cId, unread ) {
		const self = this;
		const meta = self.unread[ cId ];
		meta.el.textContent = unread + ' - ' + meta.name;
	}
	
	ns.AssistUI.prototype.removeFromUnread = function( cId ) {
		const self = this;
		const meta = self.unread[ cId ];
		if ( !meta )
			return;
		
		delete self.unread[ cId ];
		meta.unread = null;
		meta.el.parentNode.removeChild( meta.el );
		meta.el = null;
		self.updateUnread();
	}
	
	ns.AssistUI.prototype.buildUnreadOpt = function( cId ) {
		const self = this;
		const meta = self.unread[ cId ];
		if ( !meta )
			return null;
		
		const conf = {
			id       : meta.id,
			name     : meta.name,
			unread   : meta.unread,
			clientId : cId,
		};
		const unreadEl = hello.template.getElement( 'assist-msg-option-tmpl', conf );
		return unreadEl;
	}
	
	ns.AssistUI.prototype.updateUnread = function() {
		const self = this;
		const ids = Object.keys( self.unread );
		const msgEl = document.getElementById( 'assist-status-new' );
		if ( ids && ids.length ) {
			showSelect();
			msgEl.textContent = View.i18n( 'i18n_new_messages' );
		}
		else {
			hideSelect();
			msgEl.textContent = View.i18n( 'i18n_no_new_messages' );
		}
		
		function showSelect() { toggle( true ); }
		function hideSelect() { toggle( false ); }
		function toggle( show ) { self.selectUnread.classList.toggle( 'hidden', !show ); }
	}
	
	ns.AssistUI.prototype.sortByName = function( idNameMap ) {
		const self = this;
		let sorted = {};
		let ids = Object.keys( idNameMap );
		ids.sort( byName );
		return ids;
		
		function byName( idA, idB ) {
			let na = idNameMap[ idA ].toLowerCase();
			let nb = idNameMap[ idB ].toLowerCase();
			let ci = 0; // character index
			let a = na[ ci ];
			let b = nb[ ci ];
			while ( !!a && !!b ) {
				if ( a > b )
					return 1;
				if ( a < b )
					return -1;
				
				ci++;
				a = na[ ci ];
				b = nb[ ci ];
			}
			
			return 0;
		}
	}
	
})( library.view );


// MAIN
(function( ns, undefined ) {
	ns.Main = function() {
		if ( !( this instanceof ns.Main ))
			return new ns.Main();
		
		var self = this;
		self.view = window.View;
		self.optionMenu = 'option-menu';
		self.notification = null;
		self.account = null;
		self.module = null;
		
		self.connState = null;
		
		self.init();
	}
	
	ns.Main.prototype.close = function() {
		const self = this;
		self.connState.close();
	}
	
	ns.Main.prototype.init = function()
	{
		var self = this;
		self.bindEvents();
		self.bindView();
		self.setTemplate();
		
		self.view.send({
			type : 'loaded',
		});
	}
	
	ns.Main.prototype.bindEvents = function()
	{
		var self = this;
		self.mainMenuContainer = document.getElementById( 'main-menu' );
		self.mainMenuBtn = document.getElementById( 'menu-btn' );
		
		self.mainMenuContainer.addEventListener( 'click', mainMenuBgClick, true );
		self.mainMenuBtn.addEventListener( 'click', mainMenuBtnClick, false );
		
		function mainMenuBgClick( e ) {
			if ( 'main-menu' !== e.target.id )
				return;
			
			self.hideMenu();
		}
		
		function mainMenuBtnClick( e ) { self.showMenu(); }
	}
	
	ns.Main.prototype.bindView = function()
	{
		var self = this;
		//self.view.receiveMessage = receiveMessage;
		self.view.on( 'initialize', initialize );
		
		function receiveMessage( e ) { self.receiveMessage( e ); }
		function initialize( e ) { self.initialize( e ); }
		function isOnline( e ) { self.updateIsOnline( e ); }
	}
	
	ns.Main.prototype.initialize = function( data ) {
		const self = this;
		self.recentHistory = data.recentHistory || [];
		self.identity = data.identity;
		self.setAvatar();
		
		let settings = data.account.settings;
		hello.template.addFragments( data.fragments );
		hello.template.addFragments( data.mainFragments );
		
		self.addMenu();
		
		// See if we have a simple gui? Then init.
		if( self.initSimple )
			self.initSimple();
		else
			self.initMain( settings );
		
		self.connState = new library.component.ConnState(
			'online-status',
			self.view,
			hello.template
		);
		
		self.account = new library.view.Account();
		self.module = new library.view.ModuleControl(
			self.recent || null
		);
		
		self.view.send({
			type : 'ready',
		});
	}
	
	ns.Main.prototype.initMain = function( settings ) {
		const self = this;
		let notificationRootId = 'notifications-foot';
		
		if ( settings.inAppMenu ) {
			self.enableInAppMenu();
			notificationRootId = 'notifications-head';
		}
		
		self.notification = new library.view.Notification( notificationRootId );
	}
	
	ns.Main.prototype.setAvatar = function() {
		const self = this;
		const ava = document.getElementById( 'self-avatar' );
		if ( !ava )
			return;
		
		if ( !self.identity || !self.identity.avatar )
			return;
		
		ava.classList.toggle( 'default-avatar', false );
		ava.style = "background-image : url(" + self.identity.avatar + " )";
	}
	
	ns.Main.prototype.addMenu = function() {
		var self = this;
		var modules = {
			type   : 'folder',
			id     : 'modules',
			name   : View.i18n('i18n_modules'),
			faIcon : 'fa-folder-o',
		};
		
		var addChatItem = {
			type   : 'item',
			id     : 'account-add-chat',
			name   : View.i18n('i18n_add_chat_account'),
			faIcon : 'fa-users',
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
			addChatItem,
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
		self.menu.on( 'account-add-chat', handleAddChat );
		self.menu.on( 'account-settings', handleAccountSettings );
		self.menu.on( 'about', handleAbout );
		self.menu.on( 'logout', handleLogout );
		self.menu.on( 'quit', handleQuit );
		
		function handleStartLive( e ) { self.view.send({ type : 'live' }); }
		function handleAddChat( e ) { self.module.create(); }
		function handleAccountSettings( e ) { self.account.showSettings(); }
		function handleAbout( e ) { self.view.send({ type : 'about' }); }
		function handleLogout( e ) { self.view.send({ type : 'logout' }); }
		function handleQuit( e ) { self.view.send({ type : 'quit' }); }
	}
	
	ns.Main.prototype.showMenu = function( folderId ) {
		var self = this;
		self.mainMenuContainer.classList.toggle( 'hidden', false );
		self.menu.show( folderId );
	}
	
	ns.Main.prototype.hideMenu = function() {
		var self = this;
		self.mainMenuContainer.classList.toggle( 'hidden', true );
		self.menu.hide();
	}
	
	ns.Main.prototype.enableInAppMenu = function() {
		var self = this;
		var foot = document.getElementById( 'foot' );
		var head = document.getElementById( 'head' );
		foot.classList.add( 'hidden' );
		head.classList.remove( 'hidden' );
	}
	
	ns.Main.prototype.setTemplate = function()
	{
		var self = this;
		var fragments = document.getElementById( 'fragments' );
		var fragStr = fragments.innerHTML;
		fragStr = View.i18nReplaceInString( fragStr );
		hello.template = new friendUP.gui.TemplateManager( fragStr );
	}
	
	ns.Main.prototype.receiveMessage = function( msg ) {
		var self = this;
		
	}
	
})( library.view );

window.View.run = run;
function run() {
	window.main = new library.view.Main();
}
