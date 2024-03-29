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
		const self = this;
		self.validKeys = validKeys
		
		self.displayOrder = [
			'roomName',
			'userLimit',
			'isStream',
			'isClassroom',
			'workgroups',
			'authorized',
			'leaveRoom',
		]
		
		self.labelMap = {
			roomName    : View.i18n( 'i18n_channel_name' ),
			userLimit   : View.i18n( 'i18n_user_limit' ),
			isStream    : View.i18n( 'i18n_is_stream' ),
			isClassroom : View.i18n( 'i18n_is_classroom' ),
			workgroups  : View.i18n( 'i18n_workgroups' ),
			authorized  : View.i18n( 'i18n_users' ),
			leaveRoom   : View.i18n( 'i18n_leave_channel' ),
		};
		
		self.buildMap = {
			roomName    : textInput,
			userLimit   : numberInput,
			isStream    : singleCheck,
			isClassroom : singleCheck,
			workgroups  : assignWorkgroup,
			authorized  : removeAuthed,
			leaveRoom   : leaveRoom,
		};
		
		function textInput( setting ) { self.setTextInput( setting ); }
		function numberInput( setting ) { self.setNumberInput( setting ); }
		function singleCheck( setting ) { self.singleCheck( setting ); }
		function assignWorkgroup( setting ) { self.assignWorkgroup( setting ); }
		function removeAuthed( setting ) { self.removeAuthed( setting ); }
		function leaveRoom( setting ) { self.leaveRoomButt( setting ); }
	}
	
	ns.PresenceRoom.prototype.assignWorkgroup = function( setting ) {
		const self = this;
		const data = self.settings[ setting ];
		const items = data.available;
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
			const el = state.el;
			el.addEventListener( 'submit', submit, false );
			state.ids.forEach( bindChecked );
			self.updateMap[ setting ] = updateWorgItem;
			
			function bindChecked( id ) {
				let el = document.getElementById( id );
				el.addEventListener( 'change', changed, false );
				function changed( e ) {
					let value = {
						clientId : id,
						value    : el.checked,
					}
					self.save( setting, value );
				}
			}
			
			function updateWorgItem( event ) {
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
			}
		}
	}
	
	ns.PresenceRoom.prototype.removeAuthed = function( setting ) {
		const self = this;
		const users = self.settings[ setting ];
		const state = {
			el    : null,
			ids   : users.ids,
			list  : users.authed,
			idMap : {},
		};
		
		sort();
		build();
		bind();
		self.updateMap[ setting ] = updateAuthList;
		
		function sort() {
			state.list.sort(( a, b ) => {
				const aN = state.ids[ a ].name.toLowerCase();
				const bN = state.ids[ b ].name.toLowerCase();
				if ( aN === bN )
					return 0;
				if ( aN < bN )
					return -1;
				else
					return 1;
			});
		}
		
		function build() {
			const label = self.labelMap[ setting ] || setting
			const statusHTML = hello.template.get( 'settings-status-tmpl', { setting : setting })
			const items = state.list.map( buildItem )
			const itemsHTML = items.join( '\r\n' )
			const conf = {
				label      : label,
				itemsHTML  : itemsHTML,
				statusHTML : statusHTML,
			}
			const el = hello.template.getElement( 'setting-authorized-tmpl', conf )
			self.container.appendChild( el )
			state.el = el
			
			function buildItem( cId ) {
				const id = state.ids[ cId ]
				const iId = friendUP.tool.uid( 'auth' )
				state.idMap[ iId ] = cId
				state.idMap[ cId ] = iId
				const conf = {
					id     : iId,
					avatar : id.avatar,
					name   : id.name,
				}
				const html = hello.template.get( 'setting-auth-item-tmpl', conf )
				return html
			}
		}
		
		function bind() {
			state.list.forEach( bindItem );
			function bindItem( cId ) {
				const itemId = state.idMap[ cId ];
				const el = document.getElementById( itemId );
				const btn = el.querySelector( '.item-remove' );
				btn.addEventListener( 'click', removeClick, false );
				function removeClick( e ) {
					e.preventDefault();
					e.stopPropagation();
					const value = {
						clientId : cId,
					};
					self.save( setting, value );
				}
			}
		}
		
		function updateAuthList( event ) {
			const cId = event.clientId;
			const itemId = state.idMap[ cId ];
			const el = document.getElementById( itemId );
			if ( !el )
				return;
			
			el.parentNode.removeChild( el );
		}
		
	}
	
	ns.PresenceRoom.prototype.leaveRoomButt = function( setting ) {
		const self = this
		const label = self.labelMap[ setting ]
		const conf = self.settings[ setting ]
		const buttLabel = View.i18n( 'i18n_leave' )
		
		const id = build()
		bind( id )
		
		function build() {
			const status = hello.template.get( 'settings-status-tmpl', { setting : setting })
			const tmplConf = {
				setting   : setting,
				//warning   : View.i18n( 'i18n_warning_goes_here' ),
				warning   : 'If you want to delete this channel for all users, you must remove them first from the users list and then leave yourself',
				label     : label,
				buttLabel : buttLabel,
				status    : status,
			}
			
			let tmpl = null
			if ( conf.hasUsers )
				tmpl = 'setting-leave-room-warning-tmpl'
			else
				tmpl = 'setting-leave-room-tmpl'
			
			const element = hello.template.getElement( tmpl, tmplConf )
			const container = self.getContainer( setting )
			container.appendChild( element )
			return element.id
		}
		
		function bind( id ) {
			const form = document.getElementById( id )
			const buttLeave = form.querySelector( '.butt-leave' )
			const buttCancel = form.querySelector( '.butt-cancel' )
			const warning = form.querySelector( '.leave-warning' )
			
			form.addEventListener( 'submit', formSubmit, false )
			buttLeave.addEventListener( 'click', leaveMaybe, false )
			if ( buttCancel )
				buttCancel.addEventListener( 'click', hideWarning, false )
			
			self.updateMap[ setting ] = updateHandler
			function updateHandler( value ) {
			}
			
			function formSubmit( e ) {
				e.preventDefault()
				e.stopPropagation()
			}
			
			function leaveMaybe( e ) {
				const conf = self.settings[ setting ]
				if ( true == conf.warningShown )
					save()
				else
					showWarning()
			}
			
			function save() {
				self.save( setting, true );
			}
			
			function showWarning() {
				if ( null == warning ) {
					save()
					return
				}
				
				const conf = self.settings[ setting ]
				warning.classList.toggle( 'hidden', false )
				buttCancel.classList.toggle( 'hidden', false )
				conf.warningShown = true
			}
			
			function hideWarning() {
				const conf = self.settings[ setting ]
				warning.classList.toggle( 'hidden', true )
				buttCancel.classList.toggle( 'hidden', true )
				conf.warningShown = false
				
			}
		}
		
	}
	
})( library.view );

window.View.run = walk;
function walk( fupConf ) {
	window.settings = new library.view.PresenceRoom( fupConf );
}
