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

window.friend = window.friend || {};
window.library = window.library || {};
library.view = library.view || {};

(function( ns, undefined ) {
	ns.PresenceInviter = function() {
		const self = this;
		self.invitesSentTo = {};
		
		self.init();
	}
	
	ns.PresenceInviter.prototype.init = function() {
		const self = this;
		window.View.setBody();
		self.roomName = document.getElementById( 'room-name' );
		window.View.on( 'initialize', e => self.handleInit( e ));
		
		window.View.loaded();
	}
	
	ns.PresenceInviter.prototype.handleInit = function( info ) {
		const self = this;
		friend.template.addFragments( info.fragments );
		self.roomName.textContent = '#' + info.roomName;
		self.setList( info.idList );
		
		const ids = info.idList;
		self.filter = new library.component.FilterList(
			friend.template,
			'filter',
			'list',
			[ 'name' ],
			ids
		);
		self.filter.focus();
		
		self.filter.on( 'active', e => onActive );
		function onActive( isActive ) {
			
		}
		
		window.View.ready();
	}
	
	ns.PresenceInviter.prototype.setList = function( idList ) {
		const self = this;
		const noItems = document.getElementById( 'no-items' );
		if ( !idList || !idList.length ) {
			noItems.classList.toggle( 'hidden', false );
			return;
		} else
			noItems.parentNode.removeChild( noItems );
		
		idList.sort( byName );
		const container = document.getElementById( 'list' );
		idList.forEach( id => {
			const el = build( id );
			bind( el, id );
		});
		
		function byName( a, b ) {
			const an = a.name;
			const bn = b.name;
			if ( an < bn )
				return -1;
			if ( an > bn )
				return 1;
			return 0;
		}
		
		function build( id ) {
			const tmplConf = {
				clientId  : id.clientId,
				avatarSrc : id.avatar,
				name      : id.name,
			};
			const el = friend.template.getElement( 'list-user-tmpl', tmplConf );
			container.appendChild( el );
			return el;
		}
		
		function bind( el, id ) {
			const invBtn = el.querySelector( '.inviter .inv-btn' );
			const cId = id.clientId;
			invBtn.addEventListener( 'click', sendInvite, false );
			function sendInvite() {
				if ( self.invitesSentTo[ cId ])
					return;
				
				const inv = {
					type : 'add',
					data : {
						clientId : cId,
					},
				};
				self.send( inv );
				self.setInviteSent( cId );
			}
		}
	}
	
	ns.PresenceInviter.prototype.setInviteSent = function( cId ) {
		const self = this;
		const el = document.getElementById( cId );
		const invIcon = el.querySelector( '.inviter .inv-btn i' );
		invIcon.classList.toggle( 'fa-plus', false );
		invIcon.classList.toggle( 'fa-check', true );
		self.invitesSentTo[ cId ] = true;
	}
	
	ns.PresenceInviter.prototype.send = function( event ) {
		const self = this;
		window.View.send( event );
	}
	
})( library.view );

window.View.run = fun;
function fun( fupConf ) {
	new library.view.PresenceInviter( fupConf );
}