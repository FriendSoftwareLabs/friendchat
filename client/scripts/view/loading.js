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
	ns.Loading = function() {
		console.log( 'loading..' );
		var self = this;
		self.connecting = null;
		self.error = null;
		self.errorMsg = null;
		self.view = window.View;
		
		self.init();
	}
	
	ns.Loading.prototype.init = function() {
		var self = this;
		View.setBody();
		self.connecting = document.getElementById( 'connecting' );
		self.error = document.getElementById( 'error' );
		self.errorMsg = document.getElementById( 'error-message' );
		
		self.view.on( 'error', showErr );
		function showErr( e ) { self.showError( e ); }
	}
	
	ns.Loading.prototype.showError = function( event ) {
		var self = this;
		console.log( 'Loading.showError', event );
		self.connecting.classList.toggle( 'hidden', true );
		self.error.classList.toggle( 'hidden', false );
		self.errorMsg.textContent = event;
	}
})( library.view );

window.View.run = run;
function run( fupConf ) {
	new library.view.Loading( fupConf );
}