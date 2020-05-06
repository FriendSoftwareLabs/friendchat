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

// UserGroup
(function( ns, undefined ) {
	ns.UserGroup = function(
		conf,
		containerId,
		userSource,
		templateManager
	) {
		const self = this;
		self.clientId = conf.clientId;
		self.type = conf.clientId;
		self.name = conf.name;
		self.usersId = conf.clientId + '-users';
		self.sectionKlass = conf.sectionKlass;
		self.containerId = containerId;
		self.userSource = userSource;
		self.template = templateManager;
		
		self.items = {};
		self.itemList = [];
		
		self.el = null;
		
		self.init();
	}
	
	// Public
	
	ns.UserGroup.prototype.setList = function( idList ) {
		const self = this;
		console.log( 'UserGroup.setList - NYI', idList );
	}
	
	ns.UserGroup.prototype.attach = function( id ) {
		const self = this;
		const item = self.userSource[ id ];
		if ( !item ) {
			console.log( 'UserGroup.attach - no item for id', {
				id : id,
				items : self.userSource,
			});
			return false;
		}
		
		item.group = self.type;
		if ( self.items[ id ])
			return;
		
		self.items[ id ] = item;
		self.itemList.push( id );
		self.sort( id );
		self.reorder( id );
		self.updateVisible();
		return item;
	}
	
	ns.UserGroup.prototype.detach = function( id ) {
		const self = this;
		if ( !self.items )
			return;
		
		const item = self.items[ id ];
		if ( !item ) {
			console.log( 'UserGroup.attach - no item for id', {
				id : id,
				items : self.items,
			});
			return null;
		}
		
		item.group = null;
		delete self.items[ id ];
		self.itemList = self.itemList.filter( notId );
		self.updateVisible();
		return item;
		
		function notId( itemId ) {
			return itemId !== id;
		}
	}
	
	ns.UserGroup.prototype.remove = function( id ) {
		const self = this;
		const item = self.detach( id );
		if ( !item || !item.el )
			return false;
		
		const el = item.el;
		el.parentNode.removeChild( el );
		return item;
	}
	
	ns.UserGroup.prototype.close = function() {
		const self = this;
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
		delete self.userSource;
		delete self.template;
		delete self.items;
		delete self.itemList;
	}
	
	// Private
	
	ns.UserGroup.prototype.init =  function() {
		const self = this;
		const elConf = {
			clientId     : self.clientId,
			name         : self.name,
			sectionKlass : self.sectionKlass,
			usersId      : self.usersId,
		};
		self.el = self.template.getElement( 'user-group-tmpl', elConf );
		const container = document.getElementById( self.containerId );
		if ( !container )
			throw new Error( 'UserGroup.init - invalid container id: ' + self.containerId );
		
		container.appendChild( self.el );
		self.usersEl = document.getElementById( self.usersId );
		self.updateVisible();
	}
	
	ns.UserGroup.prototype.updateVisible = function() {
		const self = this;
		const hasItems = !!self.itemList.length;
		self.el.classList.toggle( 'hidden', !hasItems );
	}
	
	ns.UserGroup.prototype.sort = function( id ) {
		const self = this;
		self.itemList.sort( byName );
		function byName( idA, idB ) {
			let a = self.items[ idA ];
			let b = self.items[ idB ];

			if ( a.name === b.name )
				return 0;
			
			let ni = 0; // name character index
			let res = 0;
			do {
				res = compare( a, b, ni );
				ni++;
			} while ( res === 0 );
			
			return res;
			
			function compare( a, b, ni ) {
				let aN = a.name[ ni ];
				let bN = b.name[ ni ];
				if ( aN === bN )
					return 0;
				
				if ( aN < bN )
					return -1;
				else
					return 1;
			}
		}
	}
	
	ns.UserGroup.prototype.reorder = function( id ) {
		const self = this;
		if ( id )
			reorderItem( id );
		else
			applyListOrder();
		
		function reorderItem( id ){
			const item = self.items[ id ];
			if ( !item || !item.el )
				return;
			
			const index = self.itemList.indexOf( id );
			if ( -1 === index ) {
				throw new Error( 'did you forget to add the id to the itemList?' );
			}
			
			if (( index + 1 ) === self.itemList.length ) {
				// id is last item in the list
				self.usersEl.appendChild( item.el );
				return;
			}
			
			const beforeIndex = index + 1; // before is the item we will insert before
			const beforeId = self.itemList[ beforeIndex ];
			const beforeItem = self.items[ beforeId ];
			const beforeEl = beforeItem.el || null; // better safe than sorry
			self.usersEl.insertBefore( item.el, beforeEl );
		}
		
		function applyListOrder() {
			self.itemList.forEach( append );
			function append( id ) {
				const item = self.items[ id ];
				if ( !item || item.el )
					return;
				
				self.usersEl.appendChild( item.el );
			}
		}
	}
	
})( library.component );


// GroupUser
(function( ns, undefined ) {
	ns.GroupUser = function(
		clientId,
		conn,
		user,
		id,
		tmplManager
	) {
		const self = this;
		self.id = clientId;
		self.conn = conn;
		self.name = id.name;
		self.avatar = id.avatar;
		self.isAdmin = !!id.isAdmin;
		self.isAuthed = !!user.isAuthed;
		self.isGuest = !!id.isGuest;
		self.workgroups = user.workgroups;
		self.state = user.state || '';
		self.template = tmplManager;
		
		self.el = null;
		self.group = null;
		self.states = {};
		
		self.init();
	}
	
	// Public
	
	ns.GroupUser.prototype.updateName = function( name ) {
		const self = this;
		self.name = name;
		const nameEl = self.el.querySelector( '.name' );
		nameEl.textContent = name;
	}
	
	// add defaults to true
	ns.GroupUser.prototype.setState = function( type, add ) {
		const self = this;
		if ( !type || !type.length || !isValid( type ))
			return;
		
		if ( null == add )
			add = true;
		
		if ( add )
			self.states[ type ] = type;
		else
			delete self.states[ type ];
		
		let topState = null;
		self.stateOrder.some( setTopState );
		let stateKlass = self.stateKlasses[ topState ] || '';
		self.stateEl.className = 'fa fa-fw ' + stateKlass;
		
		if ( 'typing' === type )
			self.handleTyping( add );
		
		function setTopState( state ) {
			if ( !self.states[ state ])
				return false;
			
			topState = state;
			return true;
		}
		
		function isValid( type ) {
			return -1 !== self.stateOrder.indexOf( type );
		}
	}
	
	ns.GroupUser.prototype.close = function() {
		const self = this;
		if ( self.el && self.el.parentNode )
			self.el.parentNode.removeChild( self.el );
		
		delete self.id;
		delete self.conn;
		delete self.template;
		delete self.group;
		delete self.el;
	}
	
	// Private
	
	ns.GroupUser.prototype.stateKlasses = {
		'typing' : 'fa-keyboard-o',
		'live'   : 'fa-video-camera',
	}
	
	ns.GroupUser.prototype.stateOrder = [
		'typing',
		'live',
	];
	
	ns.GroupUser.prototype.init = function() {
		const self = this;
		self.el = buildElement();
		bindElement();
		if ( self.state )
			self.setState( self.state );
		
		delete self.state;
		
		function buildElement() {
			const conf = {
				id     : self.id,
				name   : self.name,
			};
			const el = self.template.getElement( 'user-list-item-tmpl', conf );
			return el;
		}

		function bindElement() {
			self.stateEl = self.el.querySelector( '.state > i' );
			if ( self.isGuest )
				return;
			
			self.el.addEventListener( 'click', userPoke, false );
			/*
			if ( 'DESKTOP' === window.View.deviceType )
				self.el.addEventListener( 'click', userPoke, false );
			else
				self.el.addEventListener( 'touchend', userPoke, false );
			*/
			
			function userPoke( e ) {
				e.preventDefault();
				self.handleClick( e );
			}
		}
	}
	
	ns.GroupUser.prototype.handleTyping = function( add ) {
		const self = this;
		if ( null != self.typingTimeout ) {
			window.clearTimeout( self.typingTimeout );
			self.typingTimeout = null;
		}
		
		if ( !add )
			return;
		
		self.typingTimeout = window.setTimeout( removeTyping, 1000 * 10 );
		function removeTyping() {
			self.setState( 'typing', false );
		}
	}
	
	ns.GroupUser.prototype.handleClick = function( e ) {
		const self = this;
		self.conn.send({
			type : 'contact-open',
			data : self.id,
		});
	}
	
})( library.component );

// UserCtrl
(function( ns, undefined ) {
	ns.UserCtrl = function(
		conn,
		users,
		identities,
		onlineList,
		workgroups,
		room,
		guestAvatar,
		containerId,
		templateManager
	) {
		const self = this;
		library.component.EventEmitter.call( self );

		self.conn = conn;
		self.users = {};
		self.userIds = [];
		self.onlines = onlineList;
		self.identities = {};
		self.containerId = containerId;
		self.template = templateManager;
		
		self.groups = {};
		self.groupIds = [];
		self.groupsAvailable = {};
		
		self.init(
			workgroups,
			users,
			identities,
			room,
			guestAvatar
		);
	}
	
	ns.UserCtrl.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.UserCtrl.prototype.get = function( userId ) {
		const self = this;
		return self.users[ userId ] || null;
	}
	
	ns.UserCtrl.prototype.getGroup = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user )
			return null;
		
		return self.groups[ user.group ] || null;
	}
	
	ns.UserCtrl.prototype.getUserNames = function( excludeId ) {
		const self = this;
		const names = self.userIds
			.filter( uId => uId != excludeId )
			.map( uId => {
				const user = self.users[ uId ];
				return user.name;
			});
		
		names.sort();
		return names;
	}
	
	ns.UserCtrl.prototype.getGroupNames = function() {
		const self = this;
		const gIds = self.groupIds.filter( id => {
			if ( 'offline' == id
				|| 'online' == id
				|| 'bug' == id
				|| 'admins' == id
			) {
				return false;
			}
			
			return true;
		});
		
		const names = gIds.map( id => {
			const grp = self.groupsAvailable[ id ];
			return grp.name;
		});
		
		return names;
	}
	
	ns.UserCtrl.prototype.getId = function( clientId ) {
		const self = this;
		const id = self.identities[ clientId ];
		return id || null;
	}
	
	ns.UserCtrl.prototype.getWorkgroup = function( worgId ) {
		const self = this;
		return self.groupsAvailable[ worgId ] || null;
	}
	
	ns.UserCtrl.prototype.checkIsOnline = function( userId ) {
		const self = this;
		return self.onlines.some( oId => oId === userId );
	}
	
	ns.UserCtrl.prototype.setState = function( userId, state, isSet ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'UserCtrl.setState - no user for uid', {
				uid : userId,
				users : self.users,
			});
			return;
		}
		
		user.setState( state, isSet );
		self.emit( 'state', {
			state  : state,
			isSet  : isSet,
			userId : userId,
		});
	}
	
	ns.UserCtrl.prototype.addIdentities = function( idMap ) {
		const self = this;
		const cIds = Object.keys( idMap );
		cIds.forEach( cId => {
			const id = idMap[ cId ];
			self.addId( id );
		});
	}
	
	ns.UserCtrl.prototype.addIdentity = function( id ) {
		const self = this;
		return self.addId( id );
	}
	
	ns.UserCtrl.prototype.updateIdentity = function( update ) {
		const self = this;
		const id = update.data;
		const cId = id.clientId;
		self.identities[ cId ] = id;
		if ( 'avatar' === update.type )
			self.addUserCss( cId, id.avatar );
	}
	
	ns.UserCtrl.prototype.updateAll = function( state ) {
		const self = this;
		removeOld( state.users );
		addNew( state.users );
		updateOnline( state.online );
		updateLive( state.peers );
		
		function removeOld( fresh ) {
			let current = Object.keys( self.users );
			let remove = current.filter( uid => {
				if ( null == fresh[ uid ] )
					return true;
				else
					return false;
			});
			
			remove.forEach( uid => self.handleLeave( uid ));
		}
		
		function addNew( fresh ) {
			let freshIds = Object.keys( fresh );
			let add = freshIds.filter( fid => {
				if ( null == self.users[ fid ])
					return true;
				else
					return false;
			});
			add.forEach( uid => {
				const event = {
					user : fresh[ uid ],
				};
				self.handleJoin( event );
			});
		}
		
		function updateOnline( fresh ) {
			let uids = Object.keys( self.users );
			uids.forEach( uid => {
				if ( fresh.some( fid => fid === uid ))
					self.handleOnline( uid );
				else
					self.handleOffline( uid );
			});
		}
		
		function updateLive( peers ) {
			let uids = Object.keys( self.users );
			uids.forEach( uid => {
				let isLive = false;
				if ( peers.some( pid => pid === uid ))
					isLive = true;
				
				self.setState( uid, 'live', isLive );
			});
		}
	}
	
	ns.UserCtrl.prototype.getAvatarKlass = function( clientId ) {
		const self = this;
		const user = self.get( clientId );
		if ( user && user.isGuest )
			return clientId = 'guest-user';
		
		return self.getUserCssKlass( clientId );
	}
	
	ns.UserCtrl.prototype.close = function() {
		const self = this;
		self.releaseConn();
		self.closeUsers();
		self.closeGroups();
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		if ( self.conn )
			self.conn.close();
		
		delete self.detached;
		delete self.el;
		delete self.conn;
		delete self.users;
		delete self.userIds;
		delete self.onlines;
		delete self.groups;
		delete self.groupIds;
		delete self.groupsAvailable;
	}
	
	// Private
	
	ns.UserCtrl.prototype.init = function(
		workgroups,
		users,
		identities,
		room,
		guestAvatar
	) {
		const self = this;
		self.build();
		self.groupList = new library.component.ListOrder( 'user-groups' );
		self.initBaseGroups();
		self.setWorkgroups( workgroups );
		self.addIdentities( identities );
		self.addUsers( users );
		self.addId( room );
		self.addUserCss( 'guest-user', guestAvatar );
		self.addUserCss( 'default-user', guestAvatar );
		self.bindConn();
	}
	
	ns.UserCtrl.prototype.build = function() {
		const self = this;
		const container = document.getElementById( self.containerId );
		const conf = {};
		self.el = self.template.getElement( 'user-ctrl-tmpl', conf );
		container.appendChild( self.el );
		self.detached = document.getElementById( 'user-ctrl-detached' );
	}
	
	ns.UserCtrl.prototype.initBaseGroups = function() {
		const self = this;
		self.worgPri = 4;
		const base = [
			{
				clientId     : 'offline',
				name         : View.i18n( 'i18n_offline' ),
				sectionKlass : 'BackgroundHeavy',
				priority     : 0
			},
			{
				clientId     : 'admins',
				name         : View.i18n( 'i18n_admins' ),
				sectionKlass : 'Action',
				priority     : 1
			},
			{
				clientId     : 'online',
				name         : View.i18n( 'i18n_online' ),
				sectionKlass : 'Accept',
				priority     : 3
			},
			{
				clientId     : 'guests',
				name         : View.i18n( 'i18n_guests' ),
				sectionKlass : 'Warning',
				priority     : 2
			},
			{
				clientId     : 'bug',
				name         : View.i18n( 'i18n_bug' ),
				sectionKlass : 'Danger',
				priority     : 0
			},
		];
		
		base.forEach( worg => {
			let wId = worg.clientId;
			self.groupsAvailable[ wId ] = worg;
			self.addUserGroup( worg.clientId );
		});
	}
	
	ns.UserCtrl.prototype.setWorkgroups = function( conf ) {
		const self = this;
		if ( !conf || !conf.assigned )
			return;
		
		self.workId = conf.workId;
		const ava = conf.available;
		const ass = conf.assigned;
		const avaIds = Object.keys( ava );
		avaIds.forEach( wId => {
			let worg = ava[ wId ];
			self.addWorgAvailable( worg );
		});
		ass.forEach( worg => self.addUserGroup( worg.clientId ));
	}
	
	ns.UserCtrl.prototype.addWorgAvailable = function( worg ) {
		const self = this;
		const wId = worg.clientId;
		worg.priority = worg.priority || self.worgPri;
		self.groupsAvailable[ wId ] = worg;
	}
	
	ns.UserCtrl.prototype.addUserGroup = function( groupId, sectionKlass ) {
		const self = this;
		if ( !groupId )
			return;
		
		const wId = groupId;
		const worg = self.groupsAvailable[ wId ];
		if ( self.groups[ wId ]) {
			//self.groupList.update( worg );
			return;
		}
		
		if ( null == worg.sectionKlass )
			worg.sectionKlass = sectionKlass || 'Available';
		
		let group = new library.component.UserGroup(
			worg,
			self.el.id,
			self.users,
			self.template,
		);
		
		self.groupList.add( worg );
		self.groups[ wId ] = group;
		self.groupIds.push( wId );
	}
	
	ns.UserCtrl.prototype.removeUserGroup = function( worgId ) {
		const self = this;
		self.groupList.remove( worgId );
	}
	
	ns.UserCtrl.prototype.addUsers = function( users ) {
		const self = this;
		if ( !users )
			return;
		
		let uids = Object.keys( users );
		uids.forEach( uid => {
			const event = {
				user : users[ uid ],
			};
			self.handleJoin( event );
		});
	}
	
	ns.UserCtrl.prototype.addId = function( id ) {
		const self = this;
		if ( !id )
			return false;
		
		const cId = id.clientId;
		if ( self.identities[ cId ]) {
			update( id );
			return true;
		}
		
		self.identities[ cId ] = id;
		self.addUserCss( cId, id.avatar );
		return true;
		
		function update( id ) {
			const cId = id.clientId;
			const curr = self.identities[ cId ];
			curr.isOnline = id.isOnline;
			curr.avatar = id.avatar;
			curr.isAdmin = id.isAdmin;
			curr.isGuest = id.isGuest;
		}
	}
	
	ns.UserCtrl.prototype.bindConn = function() {
		const self = this;
		if ( !self.conn ) {
			throw new Error( 'UserCtrl.bindConn - no conn' );
			return;
		}
		
		self.conn.on( 'online', online );
		self.conn.on( 'offline', offline );
		self.conn.on( 'join', join );
		self.conn.on( 'leave', leave );
		self.conn.on( 'identity', identity );
		self.conn.on( 'auth', auth );
		self.conn.on( 'workgroups-assigned', worgsAssigned );
		self.conn.on( 'workgroup-added', worgAvailable );
		self.conn.on( 'workgroup-removed', e => self.handleWorgRemoved( e ));
		
		function online( e ) { self.handleOnline( e ); }
		function offline( e ) { self.handleOffline( e ); }
		function join( e ) { self.handleJoin( e ); }
		function leave( e ) { self.handleLeave( e ); }
		function identity( e ) { self.handleIdentity( e ); }
		function auth( e ) { self.handleAuth( e ); }
		function worgsAssigned( e ) { self.handleWorgsAssigned( e ); }
		function worgAvailable( e ) { self.addWorgAvailable( e ); }
	}
	
	ns.UserCtrl.prototype.releaseConn = function() {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.release( 'online' );
		self.conn.release( 'offline' );
		self.conn.release( 'join' );
		self.conn.release( 'leave' );
		self.conn.release( 'identity' );
		self.conn.release( 'auth' );
		self.conn.release( 'workgroup' );
	}
	
	ns.UserCtrl.prototype.closeUsers = function() {
		const self = this;
		console.log( 'closeUsers - NYI', self.users );
	}
	
	ns.UserCtrl.prototype.closeGroups = function() {
		const self = this;
		console.log( 'closeGroups - NYI', self.groups );
	}
	
	ns.UserCtrl.prototype.handleOnline = function( id ) {
		const self = this;
		const uid = id.clientId;
		const user = self.users[ uid ];
		if ( !user )
			return;
		
		if ( self.onlines.some( oid => oid === uid ))
			return;
		
		self.onlines.push( uid );
		user.isAdmin = id.isAdmin;
		self.setUserToGroup( uid );
	}
	
	ns.UserCtrl.prototype.handleOffline = function( userId ) {
		const self = this;
		let user = self.users[ userId ];
		if ( !user || !user.isAuthed ) {
			return;
		}
		
		self.onlines = self.onlines.filter( uid => userId !== uid );
		self.moveUserToGroup( userId, 'offline' );
	}
	
	ns.UserCtrl.prototype.handleJoin = function( event ) {
		const self = this;
		const user = event.user;
		const uid = user.clientId;
		let id = event.id;
		if ( id )
			self.addId( id );
		
		if ( null != self.users[ uid ] ) {
			console.log( 'UserCtrl.addUser - user already present ( hueuhueh )', {
				user  : user,
				users : self.users,
			});
			return;
		}
		
		if ( !id )
			id = self.identities[ uid ];
		
		if ( !id ) {
			console.log( 'UserCtrl.handleJoin - no id for user', {
				event : event,
				user : user,
				id : id,
				ids : self.identities,
			});
			return;
		}
		
		const userItem = new library.component.GroupUser(
			uid,
			self.conn,
			user,
			id,
			self.template
		);
		self.users[ uid ] = userItem;
		self.userIds.push( uid );
		self.addUserCss( userItem.id, userItem.avatar );
		if ( id.isOnline )
			self.handleOnline( id );
		
		self.setUserToGroup( uid );
	}
	
	ns.UserCtrl.prototype.setUserToGroup = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'setUSertoGroup - no user for', {
				uid : userId,
				users : self.users,
			});
			return;
		}
		
		let isOnline = checkOnline( userId );
		let groupId = null;
		if ( user.isAuthed ) {
			if ( isOnline )
				groupId = 'online';
			else
				groupId = 'offline';
		}
		
		if ( user.isAdmin && isOnline )
			groupId = 'admins';
		
		if ( user.isGuest )
			groupId = 'guests';
		
		if ( !groupId && user.workgroups ) {
			let available = user.workgroups.filter( wgId => !!self.groups[ wgId ]);
			groupId = available[ 0 ];
			if ( !self.groups[ groupId ]) {
				console.log( 'UserCtrl.handleJoin - no group for workgroup', {
					u : user,
					g : self.groups,
				});
				groupId = null;
			}
		}
		
		self.moveUserToGroup( user.id, groupId );
		
		function checkOnline( userId ) {
			const index = self.onlines.indexOf( userId );
			if ( -1 !== index )
				return true;
			else
				return false;
		}
	}
	
	ns.UserCtrl.prototype.handleLeave = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user )
			return;
		
		self.removeFromGroup( userId );
		delete self.users[ userId ];
		self.userIds = Object.keys( self.users );
		user.close();
	}
	
	ns.UserCtrl.prototype.handleIdentity = function( id ) {
		const self = this;
		if ( !id || !id.clientId ) {
			console.log( 'UserCtrl.handleIdentity - invalid id', id );
			return;
		}
		
		const cId = id.clientId;
		self.addUserCss( cId, id.avatar );
		self.identities[ cId ] = id;
	}
	
	ns.UserCtrl.prototype.handleAuth = function( event ) {
		const self = this;
		console.log( 'presence.handleAuth - NYI', event );
	}
	
	ns.UserCtrl.prototype.handleWorgsAssigned = function( wgs ) {
		const self = this;
		if ( !wgs || !wgs.forEach )
			return;
		
		wgs.forEach( add );
		function add( wg ) { self.addUserGroup( wg.clientId ); }
	}
	
	ns.UserCtrl.prototype.moveUserToGroup = function( userId, groupId ) {
		const self = this;
		if ( !groupId )
			groupId = 'bug';
		
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'UserCtrl.moveUserToGroup - no user for id', {
				uid   : userId,
				users : self.users,
			});
			return;
		}
		
		if ( user.group && ( user.group !== groupId ))
			detachFromGroup( user );
		
		const group = self.groups[ groupId ];
		if ( !group ) {
			console.log( 'UserCtrl.moveUserToGroup - invalid groupId', {
				type   : groupId,
				groups : self.groups,
			});
			return;
		}
		
		group.attach( user.id );
		
		function detachFromGroup( user ) {
			const detachGrp = self.groups[ user.group ];
			if ( !detachGrp )
				return;
			
			detachGrp.detach( user.id );
		}
	}
	
	ns.UserCtrl.prototype.removeFromGroup = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'UserCtrl.removeFromGroup - no user', {
				uid   : userId,
				users : Object.keys( self.users ),
			});
			return;
		}
		
		const group = self.groups[ user.group ];
		if ( !group ) {
			console.log( 'UserCtrl.removeFromGroup - no group for user', {
				user   : user,
				groups : Object.keys( self.groups ),
			});
			return;
		}
		
		group.remove( userId );
	}
	
	ns.UserCtrl.prototype.addUserCss = function( userId, avatar ) {
		const self = this;
		if ( !avatar )
			console.log( 'addUserCss - missing avatar', {
				uid : userId,
				ava : avatar,
			});
		
		const container = document.getElementById( 'user-css' );
		const styleId = self.getUserCssId( userId );
		const klassName = self.getUserCssKlass( userId );
		const exists = document.getElementById( styleId );
		if ( exists ) {
			exists.parentNode.removeChild( exists );
		}
		
		if ( !avatar )
			return;
		
		const cssConf = {
			styleId   : styleId,
			klassName : klassName,
			avatar    : avatar,
		};
		const cssEl = friend.template.getElement( 'user-css-tmpl', cssConf );
		container.appendChild( cssEl );
	}
	
	ns.UserCtrl.prototype.getUserCssKlass = function( userId ) {
		const self = this;
		return userId + '-klass';
	}
	
	ns.UserCtrl.prototype.getUserCssId = function( userId ) {
		const self = this;
		return userId + '-style';
	}
	
})( library.component );


// MsgBuilder
(function( ns, undefined ) {
	ns.MsgBuilder = function(
		parentConn,
		containerId,
		users,
		userId,
		contactId,
		roomId,
		workgroups,
		input,
		parser,
		linkExpand,
		templateManager
	) {
		const self = this;
		self.containerId = containerId;
		self.users = users;
		self.userId = userId;
		self.contactId = contactId;
		self.roomId = roomId;
		self.workgroupId = null;
		self.supergroupId = null;
		self.input = input;
		self.parser = parser || null;
		self.linkEx = linkExpand || null;
		self.template = templateManager;
		
		self.conn = null
		self.envelopes = {};
		self.envelopeOrder = [];
		self.supressConfirm = false;
		
		self.init( parentConn, workgroups );
	}
	
	// Public
	
	ns.MsgBuilder.prototype.handle = function( event ) {
		const self = this;
		const handler = self.eventMap[ event.type ];
		if ( !handler ) {
			console.log( 'MsgBuilder.handle - no handler for event', {
				e : event,
				h : self.eventMap,
			});
			return null;
		}
		
		return handler( event.data );
	}
	
	ns.MsgBuilder.prototype.update = function( event, isEdit ) {
		const self = this;
		if ( !event || !event.data )
			return;
		
		let msg = event.data;
		const el = document.getElementById( msg.msgId );
		if ( !el ) {
			console.log( 'no msg el to update', event );
			return;
		}
		
		let update = msg.message;
		let parsed = null;
		if ( self.parser )
			parsed = self.parser.work( update );
		else
			parsed = update;
		
		const orgEl = el.querySelector( '.msg-container .str' );
		const msgEl = el.querySelector( '.msg-container .message' );
		orgEl.textContent = update;
		msgEl.innerHTML = parsed;
		if ( isEdit )
			self.setEdit( msg );
		
		if ( self.linkEx )
			self.linkEx.work( msgEl );
		
		self.confirmEvent( 'message', msg.msgId );
	}
	
	ns.MsgBuilder.prototype.editMessage = function( itemId ) {
		const self = this;
		const el = document.getElementById( itemId );
		if ( el.isEditing )
			return;
		
		const getMsg = {
			msgId : itemId,
		};
		const req = {
			type : 'edit-get',
			data : getMsg,
		};
		self.conn.request( req )
			.then( msgBack )
			.catch( reqErr );
		
		function msgBack( event ) {
			if ( !event ) {
				editError( 'ERR_EDIT_NO_EVENT' );
				return;
			}
			
			self.doEdit( event );
		}
		
		function reqErr( err ) {
			console.log( 'reqErr', err );
			editError( 'ERR_EDIT_REQUEST_FAILED' );
		}
		
		function editError( err ) {
			console.log( 'editError', err );
		}
	}
	
	ns.MsgBuilder.prototype.doEdit =  function( event ) {
		const self = this;
		const msg = event.data;
		const mId = msg.msgId;
		const el = document.getElementById( mId );
		if ( !el ) {
			console.log( 'MsgBuilder.doEdit - no element found for', event );
			return;
		}
		
		el.isEditing = true;
		el.classList.add(
			'editing',
			'BordersDefault',
			'BackgroundHeavy',
			'Rounded'
		);
		const actionsEl = el.querySelector( '.msg-container .msg-actions' );
		if ( actionsEl )
			actionsEl.classList.toggle( 'hidden', true );
		
		const sysEl = el.querySelector( '.system-container' );
		const multiId = friendUP.tool.uid( 'edit' );
		const reasonRequired = checkReasonIsRequired( msg );
		let reasonHidden = 'hidden';
		if ( reasonRequired )
			reasonHidden = '';
		
		const editConf = {
			multiId      : multiId,
			reasonHidden : reasonHidden,
		};
		const editEl = self.template.getElement( 'edit-msg-ui-tmpl', editConf );
		const reasonInput = editEl.querySelector( '.edit-reason-input' );
		const subBtn = editEl.querySelector( '.actions .edit-submit' );
		const cancelBtn = editEl.querySelector( '.actions .edit-cancel' );
		sysEl.appendChild( editEl );
		
		const multiConf = {
			containerId     : multiId,
			templateManager : self.template,
		};
		const edit = new library.component.MultiInput( multiConf );
		edit.setValue( msg.message );
		edit.on( 'submit', onSubmit );
		
		subBtn.addEventListener( 'click', subClick, false );
		cancelBtn.addEventListener( 'click', cancelClick, false );
		
		function onSubmit( newMsg ) {
			handleInput( newMsg );
		}
		
		function subClick( e ) {
			let newMsg = edit.getValue();
			handleInput( newMsg );
		}
		
		function handleInput( msg ) {
			let reason = null;
			if ( reasonInput ) {
				reason = getReason();
				if ( reasonRequired && !reason ) {
					setReasonRequired();
					return;
				}
			}
			
			saveEdit( msg, reason );
			close();
		}
		
		function isAuthor() {
			const user = self.users.get( self.userId );
			if ( !user )
				return false;
			
			return msg.fromId === self.userId;
		}
		
		function getReason() {
			let reason = reasonInput.value;
			if ( reason && reason.length ) {
				setReasonRequired( false );
				return reason;
			} else
				return null;
		}
		
		function setReasonRequired( show ) {
			if ( null == show )
				show = true;
			
			reasonInput.classList.toggle( 'Required', show );
		}
		
		function checkReasonIsRequired( msg ) {
			if ( msg.editId )
				return true;
			
			if ( !isAuthor())
				return true;
			
			const now = Date.now();
			const gracePeriod = 1000 * 60 * 5;
			let maxTime = msg.time + gracePeriod;
			if ( maxTime < now )
				return true;
			
			return false;
		}
		
		function cancelClick( e ) {
			close();
		}
		
		function saveEdit( newMsg, reason ) {
			const edit = {
				msgId   : mId,
				message : newMsg,
				reason  : reason,
			};
			
			const req = {
				type : 'edit-save',
				data : edit,
			};
			self.conn.request( req )
				.then( editBack )
				.catch( editErr );
			
			function editBack( res ) {
				console.log( 'editBack', res );
			}
			
			function editErr( err ) {
				console.log( 'editErr', err );
			}
		}
		
		function close() {
			el.isEditing = false;
			if ( actionsEl )
				actionsEl.classList.toggle( 'hidden', false );
			
			edit.close();
			editEl.parentNode.removeChild( editEl );
			el.classList.remove(
				'editing',
				'BordersDefault',
				'BackgroundHeavy',
				'Rounded'
			);
		}
	}
	
	ns.MsgBuilder.prototype.forwardMessage = function( msgId ) {
		const self = this;
		const el = document.getElementById( msgId );
		const srcEl = el.querySelector( '.msg-content .str' );
		if ( !srcEl ) {
			console.log( 'forwardMessage - could not find str', {
				mId : msgId,
				el  : el,
			});
			return;
		}
		
		const str = srcEl.textContent;
		if ( !str || !str.length ) {
			console.log( 'forwardMessage - no content found', {
				mId : msgId,
				el  : el,
				str : str,
			});
			return;
		}
		
		self.input.setValue( str );
	}
	
	ns.MsgBuilder.prototype.getFirstMsgId = function() {
		const self = this;
		const firstMsg = self.getFirstMsg();
		if ( !firstMsg )
			return null;
		
		return firstMsg.msgId;
	}
	
	ns.MsgBuilder.prototype.getFirstMsgTime = function() {
		const self = this;
		let firstMsg = self.getFirstMsg();
		if ( !firstMsg )
			return null;
		
		return firstMsg.time;
	}
	
	ns.MsgBuilder.prototype.getLastMsgId = function() {
		const self = this;
		const lastMsg = self.getLastMsg();
		if ( !lastMsg )
			return null;
		
		return lastMsg.msgId;
	}
	
	ns.MsgBuilder.prototype.getLastMsgTime = function() {
		const self = this;
		const lastMsg = self.getLastMsg();
		if ( !lastMsg )
			return null;
		
		return lastMsg.time;
	}
	
	ns.MsgBuilder.prototype.close = function() {
		const self = this;
		if ( self.envelopeUpdate != null ) {
			window.clearTimeout( self.envelopeUpdate );
			delete self.envelopeUpdate;
		}
		
		delete self.conn;
		delete self.users;
		delete self.userId;
		delete self.roomId;
		delete self.workgroupId;
		delete self.input;
		delete self.onEdit;
		delete self.parser;
		delete self.linkEx;
		delete self.template;
	}
	
	// Private
	
	ns.MsgBuilder.prototype.logKlass = 'LogText';
	ns.MsgBuilder.prototype.tmplMap = {
		'msg-group'    : 'msg-group-tmpl',
		'msg'          : 'msg-tmpl',
		'action'       : 'action-tmpl',
		'notification' : 'chat-notie-tmpl',
	}
	
	ns.MsgBuilder.prototype.init = function( parentConn, workgroups ) {
		const self = this;
		self.settings = window.View.getSettings();
		
		if ( workgroups) {
			self.workgroupId = workgroups.workId || '';
			self.supergroupId = workgroups.superId || '';
		}
		
		self.conn = new library.component.RequestNode(
			'chat',
			parentConn,
			eSink
		);
		
		function eSink( ...args ) {
			//console.log( 'MsgBuilder eSink', args );
		}
		
		self.container = document.getElementById( self.containerId );
		if ( !self.container )
			throw new Error( 'MsgBuilder.init - container element not found for id: '
				+ self.containerId );
		
		if ( !self.users || !self.template ) {
			console.log( 'MsgBuilder - missing things', self );
			throw new Error( 'MsgBuilder - missing things ^^^' );
		}
		
		self.users.on( 'msg-target', e => self.handleMsgTarget( e ));
		self.startEnvelopeUpdates();
		
		self.eventMap = {
			'msg'          : msg,
			'work-msg'     : msg,
			'action'       : action,
			'notification' : notie,
			'log'          : log,
			'update'       : e => { self.update( e )},
			'edit'         : e => { self.update( e, true )},
			'confirm'      : e => self.handleConfirm( e ),
		};
		
		function msg( e ) { return self.handleMsg( e ); }
		function action( e ) { return self.handleAction( e ); }
		function notie( e ) { return self.handleNotie( e ); }
		function log( e ) { return self.handleLog( e ); }
		
		self.buildMap = {
			'msg'          : logMsg,
			'work-msg'     : logWorkMsg,
			'action'       : logAction,
			'notification' : logNotie,
		};
		
		function logMsg( e ) { return self.buildMsg( e, true ); }
		function logWorkMsg( e ) { return self.buildWorkMsg( e, true ); }
		function logAction( e ) { return self.buildAction( e, true ); }
		function logNotie( e ) { return self.buildNotie( e, true ); }
	}
	
	ns.MsgBuilder.prototype.getFirstMsg = function() {
		const self = this;
		if ( !self.envelopeOrder.length )
			return null;
		
		const firstEnvelopeId = self.envelopeOrder[ 0 ];
		const firstEnvelope = self.envelopes[ firstEnvelopeId ];
		return firstEnvelope.firstMsg || null;
	}
	
	ns.MsgBuilder.prototype.getLastMsg = function() {
		const self = this;
		if ( !self.envelopeOrder.length )
			return null;
		
		const eo = self.envelopeOrder;
		const lastEnvId = eo[ eo.length - 1 ];
		const lastEnvelope = self.envelopes[ lastEnvId ];
		return lastEnvelope.lastMsg || null;
	}
	
	ns.MsgBuilder.prototype.handleMsgTarget = function( data ) {
		const self = this;
		if ( !self.msgTargets )
			self.msgTargets = {};
		
		const AG = 'all_groups';
		const AM = 'all_members';
		const wId = data.workgroup;
		const uId = data.user;
		const wT = self.msgTargets[ wId ];
		
		// special target, discard any other targets
		if ( AG === wId || AM === wId ) {
			self.msgTargets = {};
			self.msgTargets[ wId ] = true;
			self.updateMsgTarget();
			return;
		}
		
		if ( self.msgTargets[ AG ] || self.msgTargets[ AM ])
			return;
		
		// worg already set as target, no further action required
		if ( wT && ( null == wT.length ))
			return;
		
		// worg set as target, discard any user targets in worg
		if ( wT && !uId )
			self.msgTargets[ wId ] = true;
		
		// worg+user target, add
		if ( wT && uId ) {
			const uIdx = wT.indexOf( uId );
			if ( -1 !== uIdx )
				return; // already set
			
			wT.push( uId );
		}
		
		// not yet set, do the thing
		if ( !wT ) {
			if ( !uId )
				self.msgTargets[ wId ] = true;
			else
				self.msgTargets[ wId ] = [ uId ];
		}
		
		self.updateMsgTarget();
	}
	
	ns.MsgBuilder.prototype.updateMsgTarget = function() {
		const self = this;
		if ( !self.msgTargetEl )
			buildBox();
		
		setTargets();
		
		function buildBox() {
			self.msgTargetId = friendUP.tool.uid( 'target' );
			let inputId = friendUP.tool.uid( 'input' );
			const conf = {
				id      : self.msgTargetId,
				inputId : inputId,
			};
			self.msgTargetEl = self.template.getElement( 'msg-target-box-tmpl', conf );
			self.container.appendChild( self.msgTargetEl );
			const cancelBtn = self.msgTargetEl.querySelector( '.edit-cancel' );
			const sendBtn = self.msgTargetEl.querySelector( '.send' );
			
			cancelBtn.addEventListener( 'click', cancel, false );
			sendBtn.addEventListener( 'click', send, false );
			
			function cancel( e ) {
				e.stopPropagation();
				e.preventDefault();
				self.cancelMsgTarget();
			}
			
			function send( e ) {
				e.stopPropagation();
				e.preventDefault();
				self.sendMsgTarget();
			}
			
			const multiConf = {
				containerId     : inputId,
				templateManager : self.template,
			};
			self.msgTargetInput = new library.component.MultiInput( multiConf );
			self.msgTargetInput.on( 'submit', onSubmit );
			
			const currMsg = self.input.getValue();
			self.msgTargetInput.setValue( currMsg );
			self.input.setValue( '' );
			
			function onSubmit() {
				self.sendMsgTarget();
			}
		}
		
		function setTargets() {
			const targetsEl = self.msgTargetEl.querySelector( '.msg-target-targets' );
			targetsEl.innerHTML = null;
			wTIds = Object.keys( self.msgTargets );
			wTIds.some( wId => {
				if ( 'all_groups' === wId || 'all_members' === wId ) {
					setSpecial( wId );
					return true;
				}
				
				const wT = self.msgTargets[ wId ];
				if ( null == wT.length ) {
					addWorg( wId );
					return false;
				}
				
				wT.forEach( uId => addUser( uId, wId ));
				return false;
			});
			
			function setSpecial( id ) {
				const worg = self.users.getWorkgroup( id );
				setEl( worg.name, id, null );
			}
			
			function addWorg( worgId ) {
				const worg = self.users.getWorkgroup( worgId );
				const name = '#' + worg.name;
				setEl( name, worgId, null );
			}
			
			function addUser( userId, worgId ) {
				const worg = self.users.getWorkgroup( worgId );
				const user = self.users.getMember( worgId, userId );
				const name = '#' + worg.name + '/' + user.name;
				setEl( name, worgId, userId );
			}
			
			function setEl( name, worgId, userId ) {
				const conf = {
					name : name,
				};
				const el = self.template.getElement( 'msg-target-tmpl', conf );
				targetsEl.appendChild( el );
				const cancelBtn = el.querySelector( '.target-cancel' );
				cancelBtn.addEventListener( 'click', cancel, false );
				
				function cancel( e ) {
					e.stopPropagation();
					e.preventDefault();
					remove( el, worgId, userId );
				}
			}
			
			function remove( el, worgId, userId ) {
				el.parentNode.removeChild( el );
				if ( !userId )
					delete self.msgTargets[ worgId ];
				else {
					wTs = self.msgTargets[ worgId ];
					self.msgTargets[ worgId ] = wTs.filter( tId => tId != userId );
					if ( self.msgTargets[ worgId ].length )
						return;
					
					delete self.msgTargets[ worgId ];
				}
				
				const anyLeft = !!Object.keys( self.msgTargets ).length
				if ( !anyLeft )
					self.cancelMsgTarget();
				
			}
		}
		
	}
	
	ns.MsgBuilder.prototype.sendMsgTarget = function() {
		const self = this;
		if ( !self.msgTargetInput )
			return;
		
		const message = self.msgTargetInput.getValue();
		if ( !message || !message.length )
			return;
		
		const msg = {
			type : 'work-msg',
			data : {
				message : message,
				targets : self.msgTargets,
			},
		};
		self.send( msg );
		self.msgTargetInput.setValue( '' );
		self.cancelMsgTarget();
	}
	
	ns.MsgBuilder.prototype.cancelMsgTarget = function() {
		const self = this;
		if ( !self.msgTargets )
			return;
		
		const message = self.msgTargetInput.getValue();
		if ( message && message.length )
			self.input.setValue( message );
		
		self.msgTargetInput.close();
		const el = self.msgTargetEl;
		el.parentNode.removeChild( el );
		delete self.msgTargetId;
		delete self.msgTargetEl;
		delete self.msgTargets;
	}
	
	ns.MsgBuilder.prototype.startEnvelopeUpdates = function() {
		const self = this;
		if ( self.envelopeUpdate != null )
			return;
		
		setNextUpdate();
		
		function setNextUpdate() {
			const now = Date.now();
			const midnight = new Date().setHours( 24, 0, 0, 0 ); // set time to nearest next midnight,
			// ..and it returns a timestamp of that midnight
			const timeToMidnight = midnight - now;
			self.envelopeUpdate = window.setTimeout( update, timeToMidnight );
		}
		
		function update() {
			self.updateEnvelopeDate();
			delete self.envelopeUpdate;
			setNextUpdate();
		}
	}
	
	ns.MsgBuilder.prototype.exists = function( msgId ) {
		const self = this;
		const el = document.getElementById( msgId );
		return !!el;
	}
	
	ns.MsgBuilder.prototype.handleMsg = function( event ) {
		const self = this;
		if ( self.exists( event.msgId ))
			return;
		
		const time = self.parseTime( event.time );
		const envelope = self.getEnvelope( time.envelope );
		const conf = {
			inGroup : self.isLastSpeaker( event, envelope ),
			event   : event,
		};
		
		const el = self.buildMsg( conf );
		if ( !el ) {
			console.log( 'could not build el for msg', event );
			return;
		}
		
		envelope.lastSpeakerId = event.fromId;
		
		self.addItem( el, envelope, event );
		if ( self.contactId )
			self.updateLastDelivered( event );
		
		self.confirmEvent( 'message', event.msgId );
		return el;
	}
	
	ns.MsgBuilder.prototype.handleAction = function( event ) {
		const self = this;
		
		return el;
	}
	
	ns.MsgBuilder.prototype.handleNotie = function( event ) {
		const self = this;
		
		return el;
	}
	
	ns.MsgBuilder.prototype.handleLog = function( log ) {
		const self = this;
		let events = log.data.events;
		let newIds = log.data.ids;
		let relations = log.data.relations;
		if ( newIds )
			self.users.addIdentities( newIds );
		
		self.toggleSmooth( false );
		self.supressConfirm = true;
		
		if ( 'before' === log.type )
			self.handleLogBefore( events );
		else
			self.handleLogAfter( events );
		
		self.supressConfirm = false;
		let lMId = self.getLastMsgId();
		self.confirmEvent( 'message', lMId );
		if ( relations )
			self.updateRelationState( relations );
		
		window.setTimeout( tglsmt, 1000 );
		function tglsmt() {
			self.toggleSmooth( true );
			
		}
	}
	
	ns.MsgBuilder.prototype.handleLogBefore = function( items ) {
		const self = this;
		if ( null == items.length )
			return;
		
		let lastSpeakerId = null;
		let lastIndex = ( items.length - 1 );
		let prevEnvelope = null;
		let firstMsg = null;
		items.forEach( handle );
		if ( prevEnvelope )
			prevEnvelope.firstMsg = firstMsg;
		
		function handle( item, index ) {
			const handler = self.buildMap[ item.type ];
			if ( !handler ) {
				console.log( 'no handler for event', item );
				return;
			}
			
			const event = item.data;
			if ( self.exists( event.msgId ))
				return;
			
			// 
			if ( null == firstMsg ) {
				firstMsg = event;
			}
			
			let time = self.parseTime( event.time );
			let envelope = self.getEnvelope( time.envelope );
			if ( prevEnvelope && ( envelope.id !== prevEnvelope.id )) {
				prevEnvelope.firstMsg = firstMsg;
				lastSpeakerId = null;
				firstMsg = event;
				prevEnvelope = envelope;
			}
			
			//event.time = time.time;
			let isPrevSpeaker = (
				( null != event.fromId )
				&& ( lastSpeakerId === event.fromId )
				&& ( event.type === 'msg' )
			);
			
			let conf = {
				inGroup : isPrevSpeaker,
				event   : event,
			};
			
			let el = handler( conf );
			if ( !el ) {
				console.log( 'no el, abort', event );
				prevEnvelope = envelope;
				if ( firstMsg.msgId === event.msgId )
					firstMsg = null;
				
				return;
			}
			
			self.addLogItem( el, envelope, event );
			
			if ( 'msg' === event.type )
				lastSpeakerId = event.fromId;
			else
				lastSpeakerId = null;
			
			prevEnvelope = envelope;
		}
		//return el;
	}
	
	ns.MsgBuilder.prototype.handleLogAfter = function( items ) {
		const self = this;
		if ( !items )
			return;
		
		items.forEach( item => self.handle( item ));
	}
	
	ns.MsgBuilder.prototype.isLastSpeaker = function( event, envelope ) {
		const self = this;
		if ( 'msg' !== event.type )
			return false;
		
		if ( null == envelope.lastSpeakerId )
			return false;
		
		return event.fromId === envelope.lastSpeakerId;
	}
	
	ns.MsgBuilder.prototype.toggleSmooth = function( setSmooth ) {
		const self = this;
		if ( !self.container )
			return;
		
		self.container.classList.toggle( 'SmoothScrolling', setSmooth );
	}
	
	ns.MsgBuilder.prototype.addItem = function( el, envelope, msg ) {
		const self = this;
		if ( null == envelope.firstMsg )
			envelope.firstMsg = msg;
		
		envelope.lastMsg = msg;
		envelope.el.appendChild( el );
		self.bindItem( el.id );
		
		if ( msg.editId )
			self.setEdit( msg );
	}
	
	ns.MsgBuilder.prototype.addLogItem = function( el, envelope, msg ) {
		const self = this;
		if ( !envelope.firstMsg )
			envelope.lastMsg = msg;
		
		let fMsg = envelope.firstMsg;
		let before = null;
		if ( fMsg )
			before = document.getElementById( fMsg.msgId );
		
		envelope.el.insertBefore( el, before );
		self.bindItem( el.id );
		
		if ( msg.editId )
			self.setEdit( msg );
		
	}
	
	ns.MsgBuilder.prototype.buildMsg = function( conf, isLog ) {
		const self = this;
		const tmplId =  conf.inGroup ? 'msg-tmpl' : 'msg-group-tmpl';
		const msg = conf.event;
		const uId = msg.fromId;
		const mId = msg.msgId;
		const user = self.users.get( self.userId );
		const from = self.users.get( uId );
		const isGuest = uId == null ? true : false;
		
		let name = '';
		let userKlass = '';
		let selfKlass = 'sw1';
		let canEdit = false;
		let canForward = self.checkCanForward( msg );
		if ( isGuest ) {
			name = 'Guest > ' + msg.name;
			userKlass = 'guest-user-klass';
		} else {
			if ( from )
				name = from.name;
			else
				name = msg.name;
			
			userKlass = uId + '-klass';
		}
		
		if ( uId === self.userId ) {
			selfKlass = 'sw2 isSelf';
			canEdit = true;
		}
		
		if ( user && user.isAdmin )
			canEdit = true;
		
		if ( self.contactId && uId === self.contactId )
			canEdit = false;
		
		let original = msg.message;
		let message = null;
		if ( self.parser )
			message = self.parser.work( original, isLog );
		else
			message = original;
		
		const timeStr = self.getClockStamp( msg.time );
		const actionsHtml = self.buildMsgActions( canEdit, canForward );
		const msgConf = {
			msgId      : mId,
			userKlass  : userKlass,
			selfKlass  : selfKlass,
			from       : name,
			time       : timeStr,
			original   : original,
			message    : message,
			msgActions : actionsHtml,
		};
		const el = self.template.getElement( tmplId, msgConf );
		if ( self.linkEx )
			self.linkEx.work( el );
		
		return el;
	}
	
	ns.MsgBuilder.prototype.buildMsgActions = function( canEdit, canForward ) {
		const self = this;
		const editHidden = set( canEdit );
		const forwardHidden = set( canForward );
		const gradHidden = set( canEdit || canForward );
		const conf = {
			editHidden    : editHidden,
			forwardHidden : forwardHidden,
			gradHidden    : gradHidden,
		};
		const html = self.template.get( 'msg-actions-tmpl', conf );
		return html;
		
		function set( canDo ) {
			return canDo ? '' : 'hidden';
		}
	}
	
	ns.MsgBuilder.prototype.buildNotie = function() {
		const self = this;
	}
	
	ns.MsgBuilder.prototype.setEdit = function( msg ) {
		const self = this;
		const mId = msg.msgId;
		const eId = msg.editId;
		const el = document.getElementById( mId );
		if ( !el ) {
			console.log( 'MsgBuilder.setEdit - no element for', msg );
			return;
		}
		
		const editer = self.getEditer( msg );
		const reason = msg.editReason;
		const time = self.getClockStamp( msg.editTime );
		let name = '';
		if ( editer ) {
			name = editer.name;
		} else {
			console.log( 'MsgBuilder.update - could not find editer for', msg );
			name = 'unknown';
		}
		
		let editEl = el.querySelector( '.edited-info' );
		if ( editEl ) {
			editEl.parentNode.removeChild( editEl );
			editEl = null;
		}
		
		const editContEl = el.querySelector( '.edit-state' );
		const conf = {
			editId : eId,
			name   : name,
			time   : time,
			reason : reason,
		};
		editEl = self.template.getElement( 'edit-info-tmpl', conf );
		editContEl.appendChild( editEl );
	}
	
	ns.MsgBuilder.prototype.getEditer = function( msg ) {
		const self = this;
		const cId = msg.editBy;
		return self.users.getId( cId );
	}
	
	ns.MsgBuilder.prototype.bindItem = function( itemId ) {
		const self = this;
		const el = document.getElementById( itemId );
		const actionsQuery = '.msg-content .msg-actions';
		const editBtn = el.querySelector( actionsQuery + ' .edit-msg' );
		const fwdBtn = el.querySelector( actionsQuery + ' .forward-msg' );
		if ( editBtn )
		  editBtn.addEventListener( 'click', editClick, false );
		if ( fwdBtn )
		  fwdBtn.addEventListener( 'click', fwdClick, false );
		
		function editClick( e ) {
			self.editMessage( itemId );
		}
		
		function fwdClick( e ) {
			self.forwardMessage( itemId );
		}
	}
	
	ns.MsgBuilder.prototype.checkCanForward = function( msg ) {
		const self = this;
		if ( !self.workgroupId )
			return;
		
		let user = self.users.get( self.userId );
		let from = self.users.get( msg.fromId );
		if ( !user )
			return false;
		
		if ( user.isAdmin )
			return true;
		
		if ( msg.fromId === self.userId )
			return true;
		
		return false;
	}
	
	ns.MsgBuilder.prototype.getEnvelope = function( envConf ) {
		const self = this;
		let envelope = self.envelopes[ envConf.id ];
		if ( envelope )
			return envelope;
		
		envelope = envConf;
		const el = self.template.getElement( 'time-envelope-tmpl', envConf );
		envelope.el = el;
		self.envelopes[ envelope.id ] = envelope;
		self.envelopeOrder.push( envelope.id );
		self.envelopeOrder.sort( oldFirst );
		const index = self.envelopeOrder.indexOf( envelope.id );
		const beforeId = self.envelopeOrder[( index + 1 )] || null;
		let beforeEl = null;
		if ( beforeId )
			beforeEl = document.getElementById( beforeId );
		
		self.container.insertBefore( envelope.el, beforeEl );
		return envelope;
		
		function oldFirst( idA, idB ) {
			let a = self.envelopes[ idA ];
			let b = self.envelopes[ idB ];
			if ( a.order > b.order )
				return 1;
			else
				return -1;
		}
	}
	
	ns.MsgBuilder.prototype.updateEnvelopeDate = function() {
		const self = this;
		self.envelopeOrder.forEach( eId => {
			let env = self.envelopes[ eId ];
			let timeStr = self.getEnvelopeDayString( env.time, env.order );
			let timeEl = env.el.querySelector( '.envelope-date' );
			timeEl.textContent = timeStr;
		});
	}
	
	ns.MsgBuilder.prototype.parseTime = function( timestamp ) {
		const self = this;
		const time = new Date( timestamp );
		if ( !time )
			return null;
		
		const tokens = {
			time       : self.getClockStamp( timestamp ),
			date       : self.getDateStamp( timestamp ),
			envelope   : getEnvelope( time ),
			timestamp  : timestamp,
		};
		
		return tokens;
		
		function getEnvelope( time ) {
			const order = self.getEnvelopeTime( time );
			const id = 'envelope-' + order.toString();
			const date = self.getEnvelopeDayString( time, order );
			const envelope = {
				id    : id,
				date  : date,
				time  : time,
				order : order,
			};
			return envelope;
		}
	}
	
	ns.MsgBuilder.prototype.getClockStamp = function( timestamp ) {
		const time = new Date( timestamp );
		const str = ''
			+ pad( time.getHours()) + ':'
			+ pad( time.getMinutes()) + ':'
			+ pad( time.getSeconds());
		return str;
		
		function pad( time ) {
			var str = time.toString();
			return 1 !== str.length ? str : '0' + str;
		}
	}
	
	ns.MsgBuilder.prototype.getDateStamp = function( timestamp ) {
		const time = new Date( timestamp );
		return time.toLocaleDateString();
	}
	
	ns.MsgBuilder.prototype.getEnvelopeTime = function( time ) {
		const self = this;
		const timeStr = getTimeStr( time );
		const envTime = parseInt( timeStr, 10 );
		return envTime;
		
		function getTimeStr( time ) {
			let str = ''
			+ pad( time.getFullYear())
			+ pad(( time.getMonth() + 1 ))
			+ pad( time.getDate());
			return str;
		}
		
		function pad( time ) {
			var str = time.toString();
			return 1 !== str.length ? str : '0' + str;
		}
	}
	
	ns.MsgBuilder.prototype.getEnvelopeDayString = function( time, envelopeTime ) {
		const self = this;
		const now = new Date();
		const today = self.getEnvelopeTime( now );
		const yesterday = today - 1;
		const isToday = ( envelopeTime === today );
		const isYesterday = ( envelopeTime === yesterday );
		if ( isToday )
			return View.i18n( 'i18n_today' );
		
		if ( isYesterday )
			return View.i18n( 'i18n_yesterday' );
		
		return time.toLocaleDateString();
	}
	
	ns.MsgBuilder.prototype.updateRelationState = function( relations ) {
		const self = this;
		if ( !self.contactId )
			return;
		
		const user = relations[ self.userId ];
		const contact = relations[ self.contactId ];
		
		if ( !relations.lastMsgId )
			return;
		
		if ( null == contact.lastReadId )
			return;
		
		if ( self.lastRead === contact.lastReadId )
			return;
		
		self.updateLastRead({
			msgId        : contact.lastReadId,
			lastReadTime : contact.lastReadTime,
		});
	}
	
	ns.MsgBuilder.prototype.confirmEvent = function( type, eventId ) {
		const self = this;
		if ( self.supressConfirm )
			return;
		
		const confirm = {
			type : 'confirm',
			data : {
				type    : type,
				eventId : eventId,
			},
		};
		self.send( confirm );
	}
	
	ns.MsgBuilder.prototype.handleConfirm = function( event ) {
		const self = this;
		if ( !self.contactId )
			return;
		
		
		if ( 'message' == event.type ) {
			confirmMessage( event.data );
			return;
		}
		
		console.log( 'MsgBuilder.handleConfirm - unknown confirm event', event );
		
		function confirmMessage( state ) {
			const mId = state.msgId;
			const msgEl = document.getElementById( mId );
			if ( !msgEl ) {
				console.log( 'handleConfirm.confirmMessage - no el found for', state );
				return;
			}
			
			if ( state.lastReadTime )
				self.updateLastRead( state );
			else
				updateLastDelivered( state );
			
			/*
			if ( state.userId === self.userId )
				self.updateLastDelivered( state );
			else
				self.updateLastRead( state );
			*/
		}
	}
	
	ns.MsgBuilder.prototype.updateLastRead = function( state ) {
		const self = this;
		if ( state.fromId === self.contactId )
			return;
		
		const mId = state.msgId;
		if ( self.lastRead && ( self.lastRead !== mId ))
			self.clearConfirmState( self.lastRead );
		
		self.lastRead = mId;
		self.setConfirmState( mId, true, state.lastReadTime );
	}
	
	ns.MsgBuilder.prototype.updateLastDelivered = function( state ) {
		const self = this;
		if ( state.fromId === self.contactId )
			return;
		
		const msgId = state.msgId;
		if ( self.lastDelivered
			&& ( self.lastDelivered != self.lastRead )
		) {
			self.clearConfirmState( self.lastDelivered );
		}
		
		self.lastDelivered = msgId;
		self.setConfirmState( msgId, false );
	}
	
	ns.MsgBuilder.prototype.setConfirmState = function( msgId, isConfirmed, timestamp ) {
		const self = this;
		let timeStr = '';
		if ( null != timestamp ) {
			timeStr = self.getClockStamp( timestamp );
			self.addConfirmExtInfo( msgId, timestamp );
		}
		
		if ( !self.settings.compactChat ) {
			self.setInlineConfirm( msgId, isConfirmed, timeStr );
			return;
		}
		
		const cId = self.getConfirmId( msgId );
		let cEl = document.getElementById( cId );
		if ( !cEl )
			cEl = insertEl( msgId, cId, timeStr );
		else {
			const timeEl = cEl.querySelector( '.confirm-time' );
			timeEl.textContent = timeStr;
		}
		
		self.toggleConfirmIcon( cEl, isConfirmed );
		
		function insertEl( msgId, cId, time ) {
			const conf = {
				id   : cId,
				time : time || '',
			};
			const el = self.template.getElement( 'confirm-state-tmpl', conf );
			const msgEl = document.getElementById( msgId );
			const container = msgEl.querySelector( '.confirm-state' );
			container.appendChild( el );
			return el;
		}
	}
	
	ns.MsgBuilder.prototype.setInlineConfirm = function( msgId, isConfirmed, timeStr ) {
		const self = this;
		const mEl = document.getElementById( msgId );
		if ( !mEl )
			return;
		
		const timeEl = mEl.querySelector( '.time' );
		const cId = self.getConfirmId( msgId );
		let cEl = document.getElementById( cId );
		if ( !cEl ) {
			cEl = insertEl( msgId, cId, timeStr );
			if ( 'DESKTOP' === window.View.deviceType )
				cEl.addEventListener( 'click', cClick, false );
			else
				cEl.addEventListener( 'touchend', cClick, false );
		}
		
		self.toggleConfirmIcon( cEl, isConfirmed );
		
		function insertEl( msgId, cId, time ) {
			const conf = {
				id   : cId,
			};
			const el = self.template.getElement( 'confirm-state-inline-tmpl', conf );
			const msgEl = document.getElementById( msgId );
			const container = msgEl.querySelector( '.confirm-state-inline' );
			container.appendChild( el );
			return el;
		}
		
		function cClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.toggleExtendedInfo( msgId );
		}
	}
	
	ns.MsgBuilder.prototype.clearConfirmState = function( msgId ) {
		const self = this;
		const msgEl = document.getElementById( msgId );
		if ( !msgEl )
			return;
		
		const cId = self.getConfirmId( msgId );
		const cEl = document.getElementById( cId );
		if ( cEl )
			cEl.parentNode.removeChild( cEl );
		
		const exInfoEl = msgEl.querySelector( '.extended-info .confirm-info' );
		if ( exInfoEl )
			exInfoEl.parentNode.removeChild( exInfoEl );
	}
	
	ns.MsgBuilder.prototype.addConfirmExtInfo = function( msgId, timestamp ) {
		const self = this;
		const msgEl = document.getElementById( msgId );
		if ( !msgEl )
			return;
		
		const extEl = msgEl.querySelector( '.extended-info' );
		let cInfoEl = extEl.querySelector( '.confirm-info' );
		if ( cInfoEl ) {
			cInfoEl.parentNode.removeChild( cInfoEl );
			cInfoEl = null;
		}
		
		const dateStr = self.getDateStamp( timestamp );
		const timeStr = self.getClockStamp( timestamp );
		const time = dateStr + ' ' + timeStr;
		const conf = {
			time : time,
		};
		cInfoEl = self.template.getElement( 'confirm-info-tmpl', conf );
		
		extEl.appendChild( cInfoEl );
	}
	
	ns.MsgBuilder.prototype.getConfirmId = function( msgId ) {
		const self = this;
		return msgId + '-confirm';
	}
	
	ns.MsgBuilder.prototype.toggleConfirmIcon = function( confirmEl, isConfirmed ) {
		const self = this;
		const icon = confirmEl.querySelector( '.confirm-icon' );
		const delivered = icon.querySelector( '.delivered' );
		const confirmed = icon.querySelector( '.confirmed' );
		delivered.classList.toggle( 'hidden', isConfirmed );
		confirmed.classList.toggle( 'hidden', !isConfirmed );
	}
	
	ns.MsgBuilder.prototype.addExtendedinfo = function( msgId, el ) {
		const self = this;
		const msgEl = document.getElementById( msgId );
		if ( !msgEl ) {
			console.log( 'MsgBuilder.addExtendedinfo - no msg found for msgId', msgId );
			return;
		}
		
		const extEl = msgEl.querySelector( '.extended-info' );
		extEl.appendChild( el );
	}
	
	ns.MsgBuilder.prototype.toggleExtendedInfo = function( msgId ) {
		const self = this;
		const msgEl = document.getElementById( msgId );
		if ( !msgEl ) {
			console.log( 'MsgBuilder.toggleExtendedInfo - no msg element for msgId', msgId );
			return;
		}
		
		const ext = msgEl.querySelector( '.extended-info' );
		ext.classList.toggle( 'hidden' );
	}
	
	ns.MsgBuilder.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.send( event );
	}
	
})( library.component );


// emojii panel
(function( ns, undefined ) {
	ns.EmojiiPanel = function(
		parentId,
		templateManager,
		emojiiMap,
		onemojii
	) {
		const self = this;
		
		self.parentId = parentId;
		self.template = templateManager;
		self.emojiiMap = emojiiMap;
		self.onemojii = onemojii;
		
		self.el = null;
		
		self.init();
	}
	
	// Public
	
	ns.EmojiiPanel.prototype.show = function() {
		const self = this;
		if ( !self.el )
			return;
		
		self.el.classList.toggle( 'hidden', false );
		self.el.focus();
	}
	
	ns.EmojiiPanel.prototype.hide = function() {
		const self = this;
		if ( !self.el )
			return;
		
		self.el.classList.toggle( 'hidden', true );
	}
	
	ns.EmojiiPanel.prototype.close = function() {
		const self = this;
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.template;
		delete self.emojiiMap;
		delete self.onemojii;
		delete self.el;
	}
	
	// Private
	
	ns.EmojiiPanel.prototype.init = function() {
		const self = this;
		const conf = {
			id : friendUP.tool.uid( 'emojii' ),
		};
		self.el = self.template.getElement( 'emojii-panel-tmpl', conf );
		const parent = document.getElementById( self.parentId );
		if ( !parent )
			throw new Error( 'EmojiiPanel - no element found for parentId' );
		
		parent.appendChild( self.el );
		self.el.tabIndex = -1; // so its focusable
		self.el.addEventListener( 'blur', emoPanelBlur, false );
		self.el.addEventListener( 'focus', emoFocus, false );
		
		function emoPanelBlur( e ) {
			self.hide();
		}
		
		function emoFocus( e ) {
		}
		
		//
		const emoKeys = Object.keys( self.emojiiMap );
		emoKeys.forEach( buildAndBind );
		function buildAndBind( key ) {
			const value = self.emojiiMap[ key ];
			const itemEl = self.template.getElement( 'emojii-item-tmpl', { itml : value });
			itemEl.addEventListener( 'click', emoClick, false );
			self.el.appendChild( itemEl );
			
			function emoClick( e ) {
				e.stopPropagation();
				e.preventDefault();
				self.onemojii( key );
				self.hide();
			}
		}
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.LogFetcher = function(
		parentId,
		messagesId,
		templateManager,
		onFetch
	) {
		const self = this;
		self.parentId = parentId;
		self.messagesId = messagesId;
		self.template = templateManager;
		self.onfetch = onFetch;
		
		self.locked = false;
		self.noLogs = false;
		
		self.init();
	}
	
	// Public
	
	ns.LogFetcher.prototype.unlock = function() {
		const self = this;
		self.toggleFetching( false );
	}
	
	ns.LogFetcher.prototype.setNoLogs = function( isNoLogs ) {
		const self = this;
		self.noLogs = isNoLogs;
		if ( self.lockOut )
			clearTimeout( self.lockOut );
		
		self.lockOut = null;
		self.toggleFetching( false );
		self.infoNone.classList.toggle( 'hidden', !isNoLogs );
	}
	
	ns.LogFetcher.prototype.close = function() {
		const self = this;
		delete self.template;
		delete self.parentId;
		delete self.messagesId;
		delete self.onfetch;
		
		delete self.infoFetch;
		delete self.infoNone;
		delete self.info;
	}
	
	// Private
	
	ns.LogFetcher.prototype.init = function() {
		const self = this;
		// make sure we have valid ids
		self.parent = document.getElementById( self.parentId );
		if ( !self.parent ) {
			console.log( 'LogFetcher - no element for id', self.parentId );
			throw new Error( 'abloo ablooo ^^^' );
		}
		
		self.messages = document.getElementById( self.messagesId );
		if ( !self.messages ) {
			console.log( 'LogFetcher - no element for id', self.messagesId );
			throw new Error( 'more abloos ^^^' );
		}
		
		// insert log fetch UX element
		self.infoId = friendUP.tool.uid( 'log-fetch' );
		const infoConf = {
			id : self.infoId,
		};
		self.info = self.template.getElement( 'log-fetch-tmpl', infoConf );
		self.messages.appendChild( self.info );
		self.infoFetch = self.info.querySelector( '.log-fetch-msg' );
		self.infoNone = self.info.querySelector( '.log-no-logs' );
		self.infoHeight = self.info.clientHeight;
		
		//bind
		self.parent.addEventListener( 'wheel', checkTop, true );
		self.parent.addEventListener( 'touchend', checkTop, false );
		function checkTop( e ) {
			//e.stopPropagation();
			self.checkIsScrolledUp( e );
		}
	}
	
	ns.LogFetcher.prototype.checkIsScrolledUp = function( e ) {
		const self = this;
		if ( 0 < e.deltaY )
			return;
		
		if ( self.locked || self.lockOut )
			return;
		
		if ( self.noLogs )
			return;
		
		const msgST = self.messages.scrollTop;
		const infoH = self.infoHeight;
		// if we are more than two info heights from the top, we dont care
		if ( msgST > ( infoH * 2 ))
			return;
		
		self.toggleFetching( true );
		self.onfetch();
	}
	
	ns.LogFetcher.prototype.toggleFetching = function( isFetching ) {
		const self = this;
		self.locked = isFetching;
		if ( isFetching )
			self.lockOut = setTimeout( unlock, 3000 );
		
		const isUnlocked = !self.locked && ( null == self.lockOut );
		self.infoFetch.classList.toggle( 'hidden', isUnlocked );
		
		function unlock() {
			self.lockOut = null;
			if ( !self.locked )
				self.toggleFetching ( false );
		}
	}
	
})( library.component );

/*
	LiveStatus
*/

(function( ns, undefined ) {
	ns.LiveStatus = function(
		containerId,
		users,
		userId,
		tmplManager
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.containerId = containerId;
		self.users = users;
		self.userId = userId;
		self.template = tmplManager;
		
		self.peerIdMap = {};
		self.peerList = [];
		
		self.init();
	}
	
	ns.LiveStatus.prototype = Object.create(
		library.component.EventEmitter.prototype );
	
	// Public
	
	ns.LiveStatus.prototype.update = function( peerList ) {
		const self = this;
		peerList.forEach( peerId => self.addPeer( peerId ));
	}
	
	ns.LiveStatus.prototype.close = function() {
		const self = this;
		if ( self.users && self.stateEventId )
			self.users.off( self.stateEventId );
		
		if ( self.el && self.el.parentNode )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
		delete self.audioBtn;
		delete self.audioIcon;
		delete self.videoBtn;
		delete self.videoIcon;
		delete self.peers;
		delete self.peerList;
		delete self.peerIdMap;
		
		delete self.users;
		delete self.userId;
		delete self.template;
		delete self.containerId;
	}
	
	// Private
	
	ns.LiveStatus.prototype.init = function() {
		const self = this;
		
		// build
		self.peers = friendUP.tool.uid( 'peers' );
		const elConf = {
			peersId : self.peers,
		};
		self.el = self.template.getElement( 'live-status-tmpl', elConf );
		const container = document.getElementById( self.containerId );
		container.appendChild( self.el );
		self.videoBtn = self.el.querySelector( '.live-status-icon.video' );
		self.audioBtn = self.el.querySelector( '.live-status-icon.audio' );
		self.videoIcon = self.videoBtn.querySelector( 'i' );
		self.audioIcon = self.audioBtn.querySelector( 'i' );
		self.peers = document.getElementById( self.peers );
		
		//
		self.videoBtn.addEventListener( 'click', videoClick, false );
		self.audioBtn.addEventListener( 'click', audioClick, false );
		function videoClick( e ) {
			self.handleClick( 'video' );
		}
		
		function audioClick( e ) {
			self.handleClick( 'audio' );
		}
		
		// listen
		self.stateEventId = self.users.on( 'state', live );
		function live( e ) {
			self.handleLive( e );
		}
	}
	
	ns.LiveStatus.prototype.handleClick = function( type ) {
		const self = this;
		if ( self.userLive ) {
			self.emit( 'show' );
			return;
		}
		
		self.emit( 'join', type );
	}
	
	ns.LiveStatus.prototype.handleLive = function( event ) {
		const self = this;
		if ( 'live' !== event.state )
			return;
		
		if ( event.isSet )
			self.addPeer( event.userId );
		else
			self.removePeer( event.userId );
	}
	
	ns.LiveStatus.prototype.addPeer = function( userId ) {
		const self = this;
		if ( self.peerList.some( pId => pId === userId ))
			return;
		
		const peerId = friendUP.tool.uid( 'peer' );
		const avatarKlass = self.users.getAvatarKlass( userId );
		const peer = {
			id          : peerId,
			avatarKlass : avatarKlass,
		};
		const peerEl = self.template.getElement( 'live-status-peer-tmpl', peer );
		self.peerIdMap[ userId ] = peerId;
		self.peers.appendChild( peerEl );
		self.peerList.push( userId );
		if ( userId === self.userId )
			self.userLive = true;
			
		self.updateIconState();
		
		//self.updateVisibility();
	}
	
	ns.LiveStatus.prototype.removePeer = function( userId ) {
		const self = this;
		let peerId = self.peerIdMap[ userId ];
		if ( !peerId )
			return;
		
		delete self.peerIdMap[ userId ];
		const el = document.getElementById( peerId );
		el.parentNode.removeChild( el );
		self.peerList = self.peerList.filter( pId => pId !== userId );
		if ( userId === self.userId )
			self.userLive = false;
		
		self.updateIconState();
		
		//self.updateVisibility();
	}
	
	ns.LiveStatus.prototype.updateVisibility = function() {
		const self = this;
		const show = !!self.peerList.length ? true : false;
		self.el.classList.toggle( 'hidden', !show );
	}
	
	ns.LiveStatus.prototype.updateIconState = function() {
		const self = this;
		if ( !self.videoIcon )
			return;
			
		if ( self.currState ) {
			self.audioIcon.classList.toggle( self.currState, false );
			self.videoIcon.classList.toggle( self.currState, false );
		}
		
		if ( self.peerList.length )
			self.currState = null;
		else
			self.currState = null;
		
		if ( self.userLive )
			self.currState = 'AvailableText';
		
		if ( self.currState ) {
			self.audioIcon.classList.toggle( self.currState, true );
			self.videoIcon.classList.toggle( self.currState, true );
		}
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.InputHelper = function( type, anchorEl, conf ) {
		const self = this;
		library.component.Overlay.call( self, anchorEl, conf );
		
		self.type = type;
		self.options = {};
		self.optionIds = [];
		
	}
	
	ns.InputHelper.prototype =
		Object.create( library.component.Overlay.prototype );
	
	// Public
	
	ns.InputHelper.prototype.show = function( list, constraint ) {
		const self = this;
		self.setOptions( list );
		self.toggleVisible( true );
		constraint = constraint || '@';
		self.update( constraint );
	}
	
	ns.InputHelper.prototype.update = function( constraint ) {
		const self = this;
		if ( !constraint || !constraint.length )
			return false;
		
		constraint = constraint.toLowerCase();
		if ( constraint === self.currentConstraint )
			return false;
		
		self.unSelect();
		self.currentConstraint = constraint;
		if ( '@' === constraint )
			self.showShortList();
		else
			self.showFullList( self.currentConstraint );
	}
	
	ns.InputHelper.prototype.hide = function() {
		const self = this;
		self.toggleVisible( false );
		self.el.innerHTML = '';
		self.dotdotdot = null;
		self.currentConstraint = null;
		self.options = {};
		self.optionIds = [];
		self.visibleIds = [];
		self.selected = null;
		self.selectIndex = null;
	}
	
	ns.InputHelper.prototype.selectItem = function() {
		const self = this;
		if ( !self.selected )
			return false;
		
		if ( '...' === self.selected.str ) {
			self.showFullList();
			self.unSelect();
			return '@';
		}
		
		return self.selected.str;
	}
	
	ns.InputHelper.prototype.scrollItems = function( direction ) {
		const self = this;
		const len = self.visibleIds.length;
		if ( !len )
			return true;
		
		// first, select top or bottom depending on direction
		if ( null == self.selected ) {
			if ( 'up' == direction )
				self.selectIndex = len - 1;
			else
				self.selectIndex = 0;
			
			self.applySelection();
			return true;
		}
		
		let newIndex = null;
		if ( 'up' == direction )
			newIndex = self.selectIndex - 1;
		else
			newIndex = self.selectIndex + 1;
		
		// wrap
		self.selectIndex = newIndex;
		if ( -1 == newIndex )
			self.selectIndex = len-1;
		if ( newIndex == len )
			self.selectIndex = 0;
		
		//
		self.applySelection();
		return true;
	}
	
	ns.InputHelper.prototype.getName = function( str ) {
		const self = this;
		if ( !str )
			return null;
		
		str = str.toLowerCase();
		const match = self.optionIds.filter( id => {
			const i = id.indexOf( str );
			if ( 0 === i )
				return true;
			else
				return false;
				
		});
		
		if ( 1 != match.length )
			return null;
		
		const id = match[ 0 ];
		const conf = self.options[ id ];
		if ( !conf )
			return null;
		
		return conf.name;
	}
	
	ns.InputHelper.prototype.close = function() {
		const self = this;
		self.closeOverlay();
	}
	
	// Private
	
	ns.InputHelper.prototype.build = function() {
		const self = this;
		self.id = friendUP.tool.uid( self.type + '-input-helper' );
		const conf = {
			id : self.id,
		};
		self.el = hello.template.getElement( 'input-helper-tmpl', conf );
		return self.el;
	}
	
	ns.InputHelper.prototype.bind = function() {
		const self = this;
		//console.log( 'InputHelper.bind' );
	}
	
	ns.InputHelper.prototype.setOptions = function( list ) {
		const self = this;
		self.visibleIds = [];
		self.el.innerHTML = '';
		list.forEach( name => {
			const str = '@' + name.toLowerCase();
			const conf = {
				str : '@' + name,
			};
			const el = hello.template.getElement( 'input-helper-item-tmpl', conf );
			self.options[ str ] = {
				str  : str,
				name : name,
				el   : el,
			};
			self.optionIds.push( str );
			self.el.appendChild( el );
			el.addEventListener( 'click', click, false );
			
			function click( e ) {
				e.preventDefault();
				e.stopPropagation();
				self.emit( 'add', str );
			}
		});
		
		const dotConf = {
			str : '...',
		};
		const dotEl = hello.template.getElement( 'input-helper-item-tmpl', dotConf );
		self.el.appendChild( dotEl );
		dotConf.el = dotEl;
		self.dotdotdot = dotConf;
		dotEl.addEventListener( 'click', dotClick, false );
		
		function dotClick( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.showFullList();
		}
	}
	
	ns.InputHelper.prototype.showShortList = function() {
		const self = this;
		self.optionIds.forEach( id => {
			const conf = self.options[ id ];
			conf.el.classList.toggle( 'hidden', true );
		});
		
		const e = '@everyone';
		const eConf = self.options[ e ];
		if ( !eConf ) {
			self.showFullList();
			return;
		}
		
		eConf.el.classList.toggle( 'hidden', false );
		self.dotdotdot.el.classList.toggle( 'hidden', false );
		self.visibleIds = [ e, '...' ];
	}
	
	ns.InputHelper.prototype.showFullList = function( filter ) {
		const self = this;
		const dots = self.dotdotdot;
		toggle( dots.el, false );
		self.visibleIds = [];
		self.optionIds.forEach( id => {
			const conf = self.options[ id ];
			if ( !conf )
				return;
			
			const el = conf.el;
			if ( null == filter ) {
				toggle( el, true );
				self.visibleIds.push( id );
				return;
			}
			
			const ci = id.indexOf( filter );
			if ( 0 == ci ) {
				toggle( el, true );
				self.visibleIds.push( id );
			}
			else
				toggle( el, false );
		});
		
		function toggle( el, show ) {
			el.classList.toggle( 'hidden', !show );
		}
	}
	
	ns.InputHelper.prototype.applySelection = function() {
		const self = this;
		const id = self.visibleIds[ self.selectIndex ];
		let conf = null;
		if ( '...' === id )
			conf = self.dotdotdot;
		else
			conf = self.options[ id ];
		
		if ( self.selected )
			self.selected.el.classList.toggle( 'input-helper-selected', false );
		
		self.selected = conf;
		self.selected.el.classList.toggle( 'input-helper-selected', true );
		self.scrollTo();
	}
	
	ns.InputHelper.prototype.unSelect = function() {
		const self = this;
		if ( !self.selected )
			return;
		
		self.selected.el.classList.toggle( 'input-helper-selected', false );
		self.selected = null;
		self.selectIndex = null;
	}
	
	ns.InputHelper.prototype.scrollTo = function() {
		const self = this;
		if ( !self.selected )
			return;
		
		const box = self.el;
		const select = self.selected.el;
		const boxH = box.clientHeight;
		const boxST = box.scrollTop;
		const sH = select.clientHeight;
		const sOT = select.offsetTop;
		
		const topOffset = ( sOT + ( sH / 2 )) - ( boxH / 2 );
		box.scrollTop = topOffset;
	}
	
})( library.component );
