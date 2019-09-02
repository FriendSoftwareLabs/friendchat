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
	ns.PresenceRoom = function( fupConf ) {
		if ( !( this instanceof ns.PresenceRoom ))
			return new ns.PresenceRoom( fupConf );
		
		library.view.Settings.call( this );
	}
	
	ns.PresenceRoom.prototype = Object.create( library.view.Settings.prototype );
	
	ns.PresenceRoom.prototype.setup = function( validKeys ) {
		var self = this;
		console.log( 'settings.PresenceRoom.setup', validKeys );
		self.validKeys = validKeys;
		
		self.displayOrder = [
			'roomName',
			'userLimit',
			'isStream',
			'isClassroom',
			'workgroups',
			'authorized',
		];
		
		self.labelMap = {
			roomName    : View.i18n( 'i18n_room_name' ),
			userLimit   : View.i18n( 'i18n_user_limit' ),
			isStream    : View.i18n( 'i18n_is_stream' ),
			isClassroom : View.i18n( 'i18n_is_classroom' ),
			workgroups  : View.i18n( 'i18n_workgroups' ),
			authorized  : View.i18n( 'i18n_authorized' ),
		};
		
		self.buildMap = {
			roomName    : textInput,
			userLimit   : numberInput,
			isStream    : singleCheck,
			isClassroom : singleCheck,
			workgroups  : assignWorkgroup,
			authorized  : removeAuthed,
		};
		
		function textInput( setting ) { self.setTextInput( setting ); }
		function numberInput( setting ) { self.setNumberInput( setting ); }
		function singleCheck( setting ) { self.singleCheck( setting ); }
		function assignWorkgroup( setting ) { self.assignWorkgroup( setting ); }
		function removeAuthed( setting ) { self.removeAuthed( setting ); }
	}
	
	ns.PresenceRoom.prototype.assignWorkgroup = function( setting ) {
		const self = this;
		const data = self.settings[ setting ];
		const items = data.available;
		console.log( 'assignWorgs', items );
		const ids = Object.keys( items );
		const state = {
			assigned : data.assigned,
			items    : items,
			ids      : ids,
			el       : null,
		};
		build( setting, state );
		bind( setting, state );
		
		function build( setting, state ) {
			const label = self.labelMap[ setting ] || setting;
			const statusHTML = hello.template.get( 'settings-status-tmpl', { setting : setting });
			const items = state.ids.map( buildItem );
			const itemsHTML = items.join( '\r\n' );
			const tmplConf = {
				label      : label,
				itemsHTML  : itemsHTML,
				statusHTML : statusHTML,
			};
			state.el = hello.template.getElement( 'setting-assigned-worgs-tmpl', tmplConf );
			self.container.appendChild( state.el );
			
			function buildItem( wId ) {
				let item = state.items[ wId ];
				console.log( 'buildItem', {
					item  : item,
					state : state,
				});
				let isAssigned = -1 !== data.assigned.indexOf( item.clientId );
				let checked = isAssigned ? 'checked' : '';
				const conf = {
					id      : item.clientId,
					label   : item.name,
					checked : checked,
				};
				const html = hello.template.get( 'setting-worg-item-tmpl', conf );
				return html;
			}
		}
		
		function bind( setting, state ) {
			console.log( 'bind', state );
			const el = state.el;
			el.addEventListener( 'submit', submit, false );
			state.ids.forEach( bindChecked );
			self.updateMap[ setting ] = updateWorgItem;
			
			function bindChecked( id ) {
				let el = document.getElementById( id );
				el.addEventListener( 'change', changed, false );
				function changed( e ) {
					console.log( 'im changed', {
						id : id,
						e  : e,
						el : el,
						c  : el.checked,
					});
					let value = {
						clientId : id,
						value    : el.checked,
					}
					self.save( setting, value );
				}
			}
			
			function updateWorgItem( event ) {
				console.log( 'updateWorgItem', event );
				if ( event.clientId ) {
					let el = document.getElementById( event.clientId );
					el.checked = event.value;
					return;
				}
				
				event.available.forEach( revert );
				function revert( item ) {
					const cid = item.clientId;
					const el = document.getElementById( cid );
					const ass = event.assigned.find( assignedWorg );
					console.log( 'ass', ass );
					
					if( !ass )
						el.checked = false;
					else
						el.checked = true;
					
					function assignedWorg( item ) {
						if ( item.clientId === cid )
							return true;
						return false;
					}
				}
			}
			
			function submit( e ) {
				e.preventDefault();
				e.stopPropagation();
				console.log( 'submit', e );
			}
		}
	}
	
	ns.PresenceRoom.prototype.removeAuthed = function( setting ) {
		const self = this;
		const data = self.settings[ setting ];
		console.log( 'removeAuthed', {
			setting  : setting,
			settings : self.settings,
			data     : data,
		});
		const state = {
			el    : null,
			ids   : data.ids,
			list  : data.authed,
			idMap : {},
		};
		
		sort();
		build();
		bind();
		self.updateMap[ setting ] = updateAuthList;
		
		function sort() {
			state.list.sort(( a, b ) => {
				aN = state.ids[ a ].name.toLowerCase();
				bN = state.ids[ b ].name.toLowerCase();
				console.log( 'n', {
					aN : aN,
					bN : bN,
					updown : ( aN < bN ),
				});
				if ( aN === bN )
					return 0;
				if ( aN < bN )
					return -1;
				else
					return 1;
			});
		}
		
		function build() {
			const label = self.labelMap[ setting ] || setting;
			const statusHTML = hello.template.get( 'settings-status-tmpl', { setting : setting });
			const items = state.list.map( buildItem );
			const itemsHTML = items.join( '\r\n' );
			const conf = {
				label      : label,
				itemsHTML  : itemsHTML,
				statusHTML : statusHTML,
			};
			const el = hello.template.getElement( 'setting-authorized-tmpl', conf );
			self.container.appendChild( el );
			state.el = el;
			
			function buildItem( cId ) {
				const id = state.ids[ cId ];
				const iId = friendUP.tool.uid( 'auth' );
				state.idMap[ iId ] = cId;
				state.idMap[ cId ] = iId;
				const conf = {
					id   : iId,
					name : id.name,
				};
				const html = hello.template.get( 'setting-auth-item-tmpl', conf );
				return html;
			}
		}
		
		function bind() {
			state.list.forEach( bindItem );
			function bindItem( cId ) {
				const itemId = state.idMap[ cId ];
				const el = document.getElementById( itemId );
				const btn = el.querySelector( 'button' );
				btn.addEventListener( 'click', removeClick, false );
				function removeClick( e ) {
					e.preventDefault();
					e.stopPropagation();
					console.log( 'removeClick', {
						cId : cId,
						iId : itemId,
					});
					const value = {
						clientId : cId,
					};
					self.save( setting, value );
				}
			}
		}
		
		function updateAuthList( event ) {
			console.log( 'updateAuthList', event );
			const cId = event.clientId;
			const itemId = state.idMap[ cId ];
			const el = document.getElementById( itemId );
			if ( !el )
				return;
			
			el.parentNode.removeChild( el );
		}
		
	}
	
})( library.view );

window.View.run = walk;
function walk( fupConf ) {
	window.settings = new library.view.PresenceRoom( fupConf );
}
