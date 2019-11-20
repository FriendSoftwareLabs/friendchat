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
	ns.CryptWarn = function( fupConf ) {
		if ( !( this instanceof ns.CryptWarn ))
			return new ns.CryptWarn( fupConf );
		
		if ( fupConf )
			console.log( 'view.CryptWarn - fupconf', fupConf );
		
		var self = this;
		self.init();
		
	}
	
	ns.CryptWarn.prototype.init = function() {
		var self = this;
		View.setBody();
		self.view = window.View;
		self.bindEvents();
		
		self.view.on( 'initialize', initialize );
		function initialize( msg ) { self.initialize( msg ); }
		
		window.View.loaded();
	}
	
	ns.CryptWarn.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.cryptwarn.initialize', data );
		var cryptoOn = document.getElementById( 'crypto-host' );
		cryptoOn.innerHTML = cryptoOn.innerHTML + data.host;
		
		window.View.ready();
	}
	
	ns.CryptWarn.prototype.bindEvents = function() {
		var self = this;
		var acceptBtn = document.getElementById( 'accept' );
		var cancelBtn = document.getElementById( 'cancel' );
		acceptBtn.addEventListener( 'click', accept, false );
		cancelBtn.addEventListener( 'click', cancel, false );
		
		function accept( e ) { self.accept( true ); }
		function cancel( e ) { self.accept( false ); }
	}
	
	ns.CryptWarn.prototype.accept = function( accept ) {
		var self = this;
		var acc = {
			type : 'accept',
			data : accept,
		};
		console.log( 'view.cryptwarn', acc );
		self.send( acc );
	}
	
	ns.CryptWarn.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.cryptWarn = new library.view.CryptWarn( fupConf );
}