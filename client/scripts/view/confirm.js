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
	ns.Confirm = function() {
		if ( !( this instanceof ns.Confirm ))
			return new ns.Confirm();
		
		var self = this;
		self.view = window.View;
		
		self.init();
	}
	
	ns.Confirm.prototype.init = function() {
		var self = this;
		View.setBody();
		self.bindView();
		self.bindEvents();
		window.View.loaded();
	}
	
	ns.Confirm.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'close', close );
		
		function initialize( msg ) { self.initialize( msg ); }
		function close( msg ) { self.close( msg ); }
	}
	
	ns.Confirm.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.Confirm.initialize', data );
		
		var title = document.getElementById( 'title' );
		var message = document.getElementById( 'message' );
		
		title.innerHTML = data.title;
		message.innerHTML = data.message;
		
		window.View.ready();
	}
	
	ns.Confirm.prototype.close = function() {
		self = this;
		console.log( 'view.Confirm.close' );
		self.view.close();
	}
	
	ns.Confirm.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'form' );
		var denyBtn = document.getElementById( 'deny' );
		
		form.addEventListener( 'submit', confirm, false );
		denyBtn.addEventListener( 'click', deny, false );
		
		function confirm( e ) { self.confirm( e ); }
		function deny( e ) { self.deny( e ); }
	}
	
	ns.Confirm.prototype.confirm = function( e ) {
		var self = this;
		e.preventDefault();
		self.response( 'confirm' );
	}
	ns.Confirm.prototype.deny = function( e ) {
		var self = this;
		e.preventDefault();
		self.response( 'deny' );
	}
	
	ns.Confirm.prototype.response = function( msg ) {
		var self = this;
		self.view.sendMessage({
			type : 'response',
			data : msg,
		});
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'view.Confirm - window.View not defined' );

window.View.run = run;
function run() {
	window.confirm = new library.view.Confirm();
}