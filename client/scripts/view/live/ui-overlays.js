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
window.library = window.library || {};
window.friendUP = window.friendUP || {};
window.hello = window.hello || {};

library.view = library.view || {};
library.component = library.component || {};

/*
	Overlay is defined in components/viewComponents.js
*/

// Share link
(function( ns, undefined ) {
	ns.ShareLink = function( anchor, conn ) {
		console.log( 'ShareLink ( overlay )', conn );
		const self = this;
		self.conn = conn;
		const conf = {
			css      : 'grad-bg-down',
			show     : false,
			position : {
				outside : {
					parent  : 'top-right',
					self    : 'bottom-right',
					offsetX : 10,
					offsetY : -10,
				},
			},
		};
		library.component.Overlay.call( self, anchor, conf );
		
	}
	
	ns.ShareLink.prototype = 
		Object.create( library.component.Overlay.prototype );
	
	ns.ShareLink.prototype.close = function() {
		const self = this;
		if ( self.share )
			self.share.close();
		
		delete self.share;
		
		self.closeOverlay();
	}
	
	ns.ShareLink.prototype.build = function() {
		const self = this;
		console.log( 'ShareLink.build' );
		const el = hello.template.getElement( 'live-overlay-share-tmpl', {});
		return el;
	}
	
	ns.ShareLink.prototype.bind = function() {
		const self = this;
		console.log( 'ShareLink.bind - NOOP' );
		const conf = {
			conn : self.conn,
		};
		self.share = new library.component.ShareLink( conf );
		const closeBtn = document.getElementById( 'share-close-inline' );
		closeBtn.addEventListener( 'click', close, false );
		
		function close( e ) {
			self.hide();
		}
	}
	
	
})( library.view );

