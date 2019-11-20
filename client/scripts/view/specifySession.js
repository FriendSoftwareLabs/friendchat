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

(function( ns, undefined ) {
	ns.SpecifySession = function( fupConf ) {
		console.log( 'view.SpecifySession', fupConf );
		const self = this;
		self.view = window.View;
		self.view.setBody();
		self.view.on( 'initialize', init );
		self.bindUI();
		
		self.view.loaded();
		
		function init( e ) { self.init( e ); }
	}
	
	// """""Public"""""
	
	ns.SpecifySession.prototype.close = function() {
		const self = this;
		delete self.view;
	}
	
	ns.SpecifySession.prototype.selected = function( roomId ) {
		const self = this;
		console.log( 'selected', roomId );
		if ( !self.view )
			return;
		
		let select = {
			type : 'select',
			data : roomId,
		};
		self.view.sendMessage( select );
	}
	
	// Private
	
	ns.SpecifySession.prototype.init = function( initData ) {
		const self = this;
		console.log( 'init', initData );
		const container = document.getElementById( 'sessions' );
		initData.sessions.forEach( add );
		
		window.View.ready();
		
		function add( session ) {
			console.log( 'add', session );
			let peers = session.peers.length;
			let faIcon = peers < 3 ? 'fa-user' : 'fa-users';
			let duration = getDuration( session.created );
			let conf = {
				sessionId : session.id,
				faIcon    : faIcon,
				roomName  : session.name,
				peers     : peers,
				duration  : duration,
			};
			let item = friend.template.getElement( 'session-tmpl', conf );
			container.appendChild( item );
			bind( item );
		}
		
		function getDuration( created ) {
			let now = Date.now();
			let duration = Math.floor(( now - created ) / 1000 ); // in seconds
			if ( duration < 60 )
				return 'less than a minute';
			
			let minutes = Math.ceil(( duration - 30 ) / 60 );
			let str = '~' + minutes + ' minute';
			if ( minutes > 1 )
				str += 's';
			
			return str;
		}
		
		function bind( item ) {
			console.log( 'bind', item );
			let id = item.id;
			item.addEventListener( 'click', click, false );
			function click( e ) {
				self.selected( id );
			}
		}
	}
	
	ns.SpecifySession.prototype.bindUI = function() {
		const self = this;
		const create = document.getElementById( 'create-new' );
		create.addEventListener( 'click', click, false );
		function click( e ) {
			self.selected( null );
		}
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.rtcAsk = new library.view.SpecifySession( fupConf );
}