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
		const self = this;
		View.setBody();
		self.connecting = document.getElementById( 'connecting' );
		
		hello.template = friend.template;
		self.view.on( 'initialize', onInit );
		function onInit( e ) { self.initialize( e ); }
		
		View.loaded();
	}
	
	ns.Loading.prototype.initialize = function( data ) {
		const self = this;
		console.log( 'Loading.initialize', data );
		self.status = new library.component.ConnState(
			'conn-status',
			window.View,
			hello.template
		);
		View.ready();
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	new library.view.Loading( fupConf );
}