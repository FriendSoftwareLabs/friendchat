'use strict';

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

// Login
(function( ns, undefined ) {
	ns.Login = function() {
		if ( !( this instanceof ns.Login ))
			return new ns.Login();
		
		var self = this;
		self.account = {};
		self.init();
	}
	
	ns.Login.prototype.init = function()
	{
		var self = this;
		if ( !window.View )
			throw new Error( 'view.Login - window.View is not defined' );
		
		View.setBody();
		self.view = window.View;
		self.container = document.getElementById( 'login-account-list' );
		self.bindView();
		self.bindEvents();
		
		self.view.sendMessage({
			type : 'loaded',
		});
	}
	
	ns.Login.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initailize );
		self.view.on( 'add', add );
		self.view.on( 'remove', remove );
		self.view.on( 'response', response );
		self.view.on( 'showguide', showGuide );
		self.view.receiveMessage = receiveMessage; // messages unhandled by view.on
		
		function initailize( data ) {
			friend.template.addFragments( data.fragments );
			self.makeGuide();
			self.view.sendMessage({
				type : 'ready',
			});
		}
		function add( msg ) { self.add( msg ); }
		function remove( msg ) { self.remove( msg ); }
		function response( msg ) { self.response( msg ); }
		function showGuide( msg ) { self.guide.show( msg ); }
		function receiveMessage( msg ) { self.receiveMessage( msg ); }
	}
	
	ns.Login.prototype.makeGuide = function() {
		var self = this;
		var conf = {
			title : 'No user!',
			explanation : 'You have no user',
			figureClass : 'app-menu-pointer',
		}
		var element = friend.template.getElement( 'guide-tmpl', conf );
		self.guide = new library.component.Guide({
			containerId : 'main',
			element : element,
		});
	}
	
	ns.Login.prototype.add = function( account )
	{
		var self = this;
		console.log( 'login.add', account );
		self.guide.hide();
		if ( self.account[ account.clientId ])
			return;
		
		self.account[ account.clientId ] = account;
		
		var accountTmplConf = {
			id : account.clientId,
			name : account.name,
			hidden : account.skipPass ? 'hidden' : '',
		};
		var accountElement = friend.template.getElement(
			'login-account-tmpl',
			accountTmplConf
		);
		
		self.container.appendChild( accountElement );
		self.bindAccount( account );
	}
	
	ns.Login.prototype.bindAccount = function( account ) {
		var self = this;
		var accountElement = document.getElementById( account.clientId );
		var deleteButton = accountElement.querySelector( 'button[type="button"' );
		var passwordInput = accountElement.querySelector( '.password > input' );
		
		accountElement.addEventListener( 'submit', loginSubmit, false );
		deleteButton.addEventListener( 'click', deleteAccount, false );
		passwordInput.addEventListener( 'focus', showFocus, false );
		
		function loginSubmit( e ) {
			e.preventDefault();
			e.stopPropagation();
			var loginData = {
				clientId : account.clientId,
				password : passwordInput.value,
			};
			self.login( loginData );
			clearPass();
		}
		
		function deleteAccount( e ) {
			e.preventDefault();
			e.stopPropagation();
			var deleteData = {
				account : account.clientId,
				password : passwordInput.value,
			};
			self.deleteAccount( deleteData );
			clearPass();
		}
		
		function showFocus( e ) {
			e.preventDefault();
			e.stopPropagation();
			accountElement.classList.add( 'focus' );
			passwordInput.addEventListener( 'blur', blur, false );
			function blur( e ) {
				accountElement.classList.remove( 'focus' );
			}
		}
		
		function clearPass() {
			var passwordInput = accountElement.querySelector( 'input' );
			passwordInput.value = '';
		}
	}
	
	ns.Login.prototype.login = function( data ) {
		var self = this;
		var msg = {
			type : 'login',
			data : data
		};
		self.view.sendMessage( msg );
	}
	
	ns.Login.prototype.response = function( data ) {
		var self = this;
		console.log( 'Login.response', data );
	}
	
	ns.Login.prototype.deleteAccount = function( data ) {
		var self = this;
		var msg = {
			type : 'delete',
			data : data
		};
		self.view.sendMessage( msg );
	}
	
	ns.Login.prototype.remove = function( id ) {
		var self = this;
		var element = document.getElementById( id );
		element.parentNode.removeChild( element );
		delete self.account[ id ];
		console.log( 'accounts left', self.account );
		var accIds = Object.keys( self.account );
		if ( !accIds.length )
			self.guide.show();
	}
	
	ns.Login.prototype.bindEvents = function() {
		var self = this;
		var createButton = document.getElementById( 'create' );
		
		createButton.addEventListener( 'click', showCreate, false );
		
		function showCreate( e ) { self.showCreate( e ); }
	}
	
	ns.Login.prototype.showCreate = function( e ) {
		var self = this;
		self.view.sendMessage({
			type : 'create'
		});
	}
	
	ns.Login.prototype.receiveMessage = function( msg ) {
		var self = this;
		//console.log( 'view.Login.reciveMessage.msg - unhandled msg', msg );
	}
	
	ns.Login.prototype.showFormError = function( msg ) {
		var self = this;
		console.log( 'view.login.showFormError' );
	}
	
})( library.view );

window.View.run = function() {
	window.login = new library.view.Login();
}

