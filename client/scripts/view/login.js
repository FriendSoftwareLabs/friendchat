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
		
		View.loaded();
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
			self.makeGuide();
			self.view.ready();
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
		//var deleteButton = accountElement.querySelector( 'button[type="button"' );
		//var passwordInput = accountElement.querySelector( '.password > input' );
		
		accountElement.addEventListener( 'submit', loginSubmit, false );
		//deleteButton.addEventListener( 'click', deleteAccount, false );
		//passwordInput.addEventListener( 'focus', showFocus, false );
		
		function loginSubmit( e ) {
			e.preventDefault();
			e.stopPropagation();
			var loginData = {
				clientId : account.clientId,
				//password : passwordInput.value,
			};
			self.login( loginData );
			//clearPass();
		}
		
		/*
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
		*/
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
		//var createButton = document.getElementById( 'create' );
		
		//createButton.addEventListener( 'click', showCreate, false );
		
		//function showCreate( e ) { self.showCreate( e ); }
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

