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
	ns.TreerootUsers = function( fupconf ) {
		if ( !( this instanceof ns.TreerootUsers ))
			return new ns.TreerootUsers( fupconf );
		
		var self = this;
		self.init();
	}
	
	ns.TreerootUsers.prototype.init = function() {
		var self = this;
		View.setBody();
		self.view = window.View;
		self.bindView();
		self.bindEvents();
		
		View.loaded();
	}
	
	ns.TreerootUsers.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'userlist', addUserList );
		self.view.on( 'remove', removeFromList );
		
		function initialize( msg ) { self.initialize( msg ); }
		function addUserList( msg ) { self.addUserList( msg ); }
		function removeFromList( msg ) { self.remove( msg ); }
	}
	
	ns.TreerootUsers.prototype.initialize = function( data ) {
		const self = this;
		window.View.ready();
	}
	
	ns.TreerootUsers.prototype.addUserList = function( userlist ) {
		var self = this;
		if ( !userlist )
			return;
		
		var container = document.getElementById( 'user-list' );
		container.innerHTML = '';
		userlist = userlist.sort( byDisplayName );
		
		self.userlist = userlist;
		self.toggleLoading( false );
		
		userlist.forEach( add );
		function add( user ) {
			user.elementId = build( user );
			bind( user );
			
			function build( user ) {
				user.elementId = friendUP.tool.uid( 'user' );
				user.displayName = user.displayName || user.name;
				var element = friend.template.getElement( 'treeroot-user-tmpl', user );
				container.appendChild( element );
				return element.id;
			}
			
			function bind( user ) {
				var element = document.getElementById( user.elementId );
				var addBtn = element.querySelector( '.add .button' );
				addBtn.addEventListener( 'click', addClick, false );
				
				function addClick( e ) {
					e.stopPropagation();
					e.preventDefault();
					self.addUser( user );
				}
			}
		}
		
		function byDisplayName( a, b ) {
			let aName = a.displayName || a.name;
			let bName = b.displayName || a.name;
			aName = aName.toUpperCase();
			bName = bName.toUpperCase();
			if ( aName > bName )
				return 1
			if ( aName < bName )
				return -1
			return 0;
		}
	}
	
	ns.TreerootUsers.prototype.addUser = function( user ) {
		var self = this;
		var msg = {
			type : 'ContactUsername',
			id : user.username,
		};
		self.sendSubscribe( msg );
		self.setPending( user.id );
	}
	
	ns.TreerootUsers.prototype.toggleLoading = function( showLoading ) {
		var self = this;
		var loading = document.getElementById( 'list-loading' );
		var listTitle = document.getElementById( 'list-title' );
		loading.classList.toggle( 'hidden', !showLoading );
		listTitle.classList.toggle( 'hidden', showLoading );
	}
	
	ns.TreerootUsers.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'sub-form' );
		var doneBtn = document.getElementById( 'done' );
		
		form.addEventListener( 'submit', formSubmit, false );
		function formSubmit( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.formSubmit();
		}
		
		doneBtn.addEventListener( 'click', doneClick, false );
		function doneClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.done();
		}
	}
	
	ns.TreerootUsers.prototype.formSubmit = function( e ) {
		var self = this;
		var typeInput = document.getElementById( 'id-type' );
		var valueInput = document.getElementById( 'id-value' );
		var type = typeInput.value;
		var value = valueInput.value.trim();
		if ( !value.length )
			return; // TODO : when component form, set error
		
		valueInput.value = "";
		
		var subMsg = {
			type : type,
			id : value,
		};
		
		self.sendSubscribe( subMsg );
		
	}
	
	ns.TreerootUsers.prototype.setPending = function( id ) {
		var self = this;
		var user = self.findInList( id );
		showWorking( user );
		
		function showWorking( user ) {
			var element = document.getElementById( user.elementId );
			var addBtn = element.querySelector( '.add .button' );
			var spinner = element.querySelector( '.add .add-working' );
			
			addBtn.classList.add( 'hidden' );
			spinner.classList.remove( 'hidden' );
		}
	}
	
	ns.TreerootUsers.prototype.remove = function( sub ) {
		var self = this;
		if ( !sub || !sub.id )
			return;
		
		var user = self.findInList( sub.id );
		if ( !user || !user.elementId )
			return;
		
		var element = document.getElementById( user.elementId );
		if ( element )
			element.parentNode.removeChild( element );
	}
	
	ns.TreerootUsers.prototype.findInList = function( id ) {
		var self = this;
		var user = self.userlist.filter( isId )[ 0 ];
		return user;
		
		function isId( user ) {
			return user.id === id;
		}
	}
	
	ns.TreerootUsers.prototype.done = function() {
		var self = this;
		var doneMsg = {
			type : 'done',
		};
		self.send( doneMsg );
	}
	
	ns.TreerootUsers.prototype.sendSubscribe = function( msg ) {
		var self = this;
		var wrap = {
			type : 'subscribe',
			data : msg,
		};
		self.send( wrap );
	}
	
	ns.TreerootUsers.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	new library.view.TreerootUsers( fupConf );
}