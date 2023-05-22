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
		id,
		conf,
		containerId
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.id = id;
		self.type = id
		self.baseType = conf.clientId;
		self.name = conf.name;
		self.usersId = conf.clientId + '-users';
		self.sectionKlass = conf.sectionKlass;
		self.containerId = containerId;
		
		self.items = {};
		self.itemIds = [];
		
		self.isVisible = false;
		self.el = null;
		
		self.init();
	}
	
	ns.UserGroup.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.UserGroup.prototype.getOrderConf = function() {
		const self = this;
		const conf = {
			clientId : self.id,
			name     : self.name,
		};
		return conf;
	}
	
	ns.UserGroup.prototype.setList = function( idList ) {
		const self = this;
		console.log( 'UserGroup.setList - NYI', idList );
	}
	
	ns.UserGroup.prototype.updateName = function( name ) {
		const self = this;
		console.log( 'UserGroup.updateName - NYI', name );
	}
	
	ns.UserGroup.prototype.attach = function( item ) {
		const self = this;
		if ( !item )
			throw new Error( 'UserGroup.attach' );
		
		const id = item.id;
		item.group = self.type;
		if ( self.items[ id ])
			return;
		
		self.items[ id ] = item;
		self.itemIds.push( id );
		const orderConf = item.getOrderConf();
		self.itemList.add( orderConf );
		//self.sort( id );
		//self.reorder( id );
		self.updateVisible();
		if ( item.on ) {
			item.on( 'visible', e => {
				self.updateVisible();
			});
		}
		
		return item;
	}
	
	ns.UserGroup.prototype.detach = function( itemId ) {
		const self = this;
		if ( !self.items[ itemId ])
			return;
		
		const item = self.items[ itemId ];
		item.group = null;
		delete self.items[ itemId ];
		self.itemIds = Object.keys( self.items );
		self.itemList.remove( itemId );
		if ( item.release ) {
			item.release( 'visible' );
		}
		
		self.updateVisible();
		return item;
	}
	
	ns.UserGroup.prototype.detachAll = function() {
		const self = this;
		const detached = self.itemIds.map( itemId => {
			const item = self.items[ itemId ];
			self.detach( itemId );
			return itemId;
		});
		return detached;
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
		if ( self.visibleTimeout )
			window.clearTimeout( self.visibleTimeout );
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		self.closeEventEmitter();
		
		delete self.el;
		delete self.items;
		delete self.itemIds;
	}
	
	ns.UserGroup.prototype.showItem = function( cId ) {
		const self = this;
		const item = self.items[ cId ];
		if ( null == item )
			return;
		
		item.show();
		self.updateVisible();
	}
	
	ns.UserGroup.prototype.hideItem = function( cId ) {
		const self = this;
		const item = self.items[ cId ];
		if ( null == item )
			return;
		
		item.hide();
		self.updateVisible();
	}
	
	// Private
	
	ns.UserGroup.prototype.init =  function() {
		const self = this;
		const elConf = {
			clientId     : self.id,
			name         : self.name,
			sectionKlass : self.sectionKlass,
			usersId      : self.usersId,
		};
		self.el = hello.template.getElement( 'user-group-tmpl', elConf );
		const container = document.getElementById( self.containerId );
		if ( !container )
			throw new Error( 'UserGroup.init - invalid container id: ' + self.containerId );
		
		container.appendChild( self.el );
		self.usersEl = document.getElementById( self.usersId );
		self.itemList = new library.component.ListOrder( self.usersId, [ 'name' ]);
		self.updateVisible();
	}
	
	ns.UserGroup.prototype.updateVisible = function() {
		const self = this;
		if ( null != self.visibleTimeout )
			return;
		
		self.visibleTimeout = window.setTimeout( refreshVisible, 100 );
		return;
		
		function refreshVisible() {
			self.visibleTimeout = null;
			let hasItems = false;
			hasItems = self.itemIds.some( iId => {
				const item = self.items[ iId ];
				return !!item.isVisible;
			});
			
			if ( self.isVisible === hasItems )
				return;
			
			self.el.classList.toggle( 'hidden', !hasItems );
			//self.el.classList.toggle( 'hidden', false );
			self.isVisible = hasItems;
			self.emit( 'visible', hasItems );
		}
		
	}
	
})( library.component );


( function( ns, undefined ) {
	ns.UserGroupOther = function(
		id,
		conf,
		containerId
	) {
		const self = this;
		library.component.UserGroup.call( self,
			id,
			conf,
			containerId
		);
		
	}
	
	ns.UserGroupOther.prototype = Object.create(
		library.component.UserGroup.prototype
	);
	
	// Public
	
	// Private
	
	ns.UserGroupOther.prototype.init = function() {
		const self = this;
		self.isVisible = true;
		const elConf = {
			clientId     : self.id,
			name         : self.name,
			sectionKlass : self.sectionKlass,
			usersId      : self.usersId,
		};
		self.el = hello.template.getElement( 'user-group-other-tmpl', elConf );
		const container = document.getElementById( self.containerId );
		if ( !container )
			throw new Error( 'UserGroup.init - invalid container id: ' + self.containerId );
		
		container.appendChild( self.el );
		self.bindOther();
		self.usersEl = document.getElementById( self.usersId );
		self.itemList = new library.component.ListOrder( self.usersId, [ 'name' ]);
		self.updateVisible();
	}
	
	ns.UserGroupOther.prototype.bindOther = function() {
		const self = this;
		const other = self.el.querySelector( '.other' );
		self.otherShow = other.querySelector( '.other-show' );
		self.otherFilter = other.querySelector( '.other-filter' );
		self.otherHide = self.otherFilter.querySelector( '.other-filter-hide' );
		self.filterInput = self.otherFilter.querySelector( '.other-filter-input' );
		self.filterState = document.getElementById( 'other-filter-clear' );
		
		self.otherShow.addEventListener( 'click', show, false );
		self.otherHide.addEventListener( 'click', hide, false );
		self.filterInput.addEventListener( 'keyup', keyUp, false );
		self.filterState.addEventListener( 'click', clear, false );
		
		function show( e ) {
			e.stopPropagation();
			toggle( true );
		}
		
		function hide( e ) {
			e.stopPropagation();
			toggle( false );
			self.clearFilter();
		}
		
		function toggle( show ) {
			self.setShowOther( show );
			self.emit( 'show-other', self.showOther );
		}
		
		function keyUp( e ) {
			self.handleKeyUp( e );
		}
		
		function clear( e ) {
			self.clearFilter();
		}
	}
	
	ns.UserGroupOther.prototype.setShowOther = function( show ) {
		const self = this;
		self.showOther = show;
		self.otherShow.classList.toggle( 'hidden', self.showOther );
		self.otherFilter.classList.toggle( 'hidden', !self.showOther );
		self.updateVisible();
	}
	
	ns.UserGroupOther.prototype.updateVisible = function() {
		const self = this;
		//console.log( 'UserGroupOther.updateVisible - NOOP', self.isVisible );
	}
	
	ns.UserGroupOther.prototype.handleKeyUp = function( e ) {
		const self = this;
		if ( null != self.filterTimeout )
			return;
		
		self.filterTimeout = window.setTimeout( emitFilter, 200 );
		self.updateFilterState();
		
		function emitFilter() {
			self.filterTimeout = null;
			self.updateFilterState();
			self.emitFilter();
		}
	}
	
	ns.UserGroupOther.prototype.emitFilter = function() {
		const self = this;
		const value = self.filterInput.value;
		const str = value.trim();
		self.emit( 'filter', str );
	}
	
	ns.UserGroupOther.prototype.clearFilter = function() {
		const self = this;
		if ( null != self.filterTimeout ) {
			window.clearTimeout( self.filterTimeout );
			self.filterTimeout = null;
		}
		
		self.filterInput.value = '';
		self.updateFilterState();
		self.emitFilter();
	}
	
	ns.UserGroupOther.prototype.updateFilterState = function() {
		const self = this;
		const icon = self.filterState.querySelector( 'i' );
		let value = self.filterInput.value;
		value = value.trim();
		if ( value && value.length )
			setActive();
		else
			setEmpty();
		
		function setActive() {
			toggle( true );
		}
		
		function setEmpty() {
			toggle( false );
		}
		
		function toggle( active ) {
			icon.classList.toggle( 'fa-search', !active );
			icon.classList.toggle( 'fa-close', active );
		}
	}
	
})( library.component );


// GroupUser
(function( ns, undefined ) {
	ns.GroupUser = function(
		userId,
		conn,
		conf,
	) {
		const self = this;
		self.id = userId;
		self.conn = conn;
		self.name = conf.name;
		//self.avatar = id.avatar;
		self.isAdmin = !!conf.isAdmin;
		self.isAuthed = !!conf.isAuthed;
		self.isGuest = !!conf.isGuest;
		self.workgroups = conf.workgroups;
		self.state = conf.state || '';
		
		self.el = null;
		self.group = null;
		self.states = {};
		self.status = null;
		self.isVisible = true;
		
		self.init();
	}
	
	ns.GroupUser.prototype.userTmpl = 'user-list-item-tmpl'
	
	// Public
	
	ns.GroupUser.prototype.show = function() {
		const self = this;
		self.setVisible( true );
	}
	
	ns.GroupUser.prototype.hide = function() {
		const self = this;
		self.setVisible( false );
	}
	
	ns.GroupUser.prototype.updateName = function( name ) {
		const self = this;
		self.name = name;
		const nameEl = self.el.querySelector( '.name' );
		nameEl.textContent = name;
	}
	
	ns.GroupUser.prototype.getOrderConf = function() {
		const self = this;
		const conf = {
			clientId : self.id,
			name     : self.name,
		};
		return conf;
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
	
	ns.GroupUser.prototype.setStatus = function( status ) {
		const self = this;
		if ( null == self.status )
			self.buildStatus();
		
		self.status.set( status );
	}
	
	ns.GroupUser.prototype.close = function() {
		const self = this;
		if ( self.status )
			self.status.close();
		
		if ( self.el && self.el.parentNode )
			self.el.parentNode.removeChild( self.el );
		
		delete self.conn;
		delete self.group;
		delete self.status;
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
		const self = this
		self.statusId = friendUP.tool.uid( 'status' )
		self.el = buildElement()
		bindElement()
		if ( self.state )
			self.setState( self.state )
		
		delete self.state
		
		function buildElement() {
			const conf = self.buildElementConf()
			const el = hello.template.getElement( self.userTmpl, conf )
			return el;
		}
		
		function bindElement() {
			self.stateEl = self.el.querySelector( '.state > i' )
			if ( self.isGuest )
				return
			
			self.el.addEventListener( 'click', userPoke, false )
			
			function userPoke( e ) {
				e.preventDefault();
				self.handleClick( e );
			}
		}
	}
	
	ns.GroupUser.prototype.buildElementConf = function() {
		const self = this
		return {
			id       : self.id,
			statusId : self.statusId,
			name     : self.name,
		}
	}
	
	ns.GroupUser.prototype.buildStatus = function() {
		const self = this;
		self.status = new library.component.StatusIndicator({
			containerId : self.statusId,
			type        : 'led',
			cssClass    : 'led-userlist-status',
			statusMap   : {
				offline : 'Off',
				online  : 'On',
			},
		});
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
	
	ns.GroupUser.prototype.setVisible = function( show ) {
		const self = this;
		self.isVisible = show;
		self.el.classList.toggle( 'hidden', !show );
	}
	
})( library.component );

// UserCtrl
(function( ns, undefined ) {
	ns.UserCtrl = function(
		conn,
		userList,
		adminList,
		recentList,
		guestList,
		peerList,
		workgroups,
		room,
		guestAvatar,
		containerId,
		config,
		showOther,
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		/*
		console.log( 'UserCtrl', {
			users  : userList,
			admins : adminList,
			recent : recentList,
			guests : guestList,
			peers  : peerList,
			worgs  : workgroups,
			room   : room,
			config : config,
		});
		*/
		self.conn = conn
		self.userList = userList || []
		self.adminList = adminList || []
		self.recentList = recentList || []
		self.guestList = guestList || []
		self.peerList = peerList || []
		self.identities = {}
		self.containerId = containerId
		self.showOther = showOther || false
		
		self.users = {};
		self.userIds = [];
		self.baseGroups = {};
		self.baseGroupIds = [];
		self.groups = {};
		self.groupIds = [];
		self.groupsAvailable = {};
		self.groupsAssigned = {};
		self.groupsAssignedIds = [];
		self.worgPri = 4;
		
		self.userListActive = false
		
		self.init(
			workgroups,
			room,
			guestAvatar
		);
	}
	
	ns.UserCtrl.prototype = Object.create( library.component.EventEmitter.prototype );
	ns.UserCtrl.prototype.buildTmpl = 'user-ctrl-tmpl'
	
	ns.UserCtrl.prototype.initialize = async function( workgroups ) {
		const self = this;
		await self.setWorkgroups( workgroups );
		const worgWaits = self.groupsAssignedIds.map( wId => self.showWorgAssigned( wId ));
		await Promise.all( worgWaits );
		
		await self.setUserList();
		self.updateLiveState( self.peerList );
		self.isInitialized = true;
	}
	
	// Public
	
	ns.UserCtrl.prototype.setUserListActive = function( isActive ) {
		const self = this;
		self.userListActive = isActive;
	}
	
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
		const baseNames = [
			'admins',
			'guests',
			'active'
		].map( bId => {
			const bg = self.baseGroups[ bId ];
			return bg.name;
		});
		
		const groupNames = self.groupsAssignedIds.map( id => {
			const grp = self.groupsAvailable[ id ];
			return grp.name;
		});
		
		const names = [ ...baseNames, ...groupNames ];
		return names;
	}
	
	ns.UserCtrl.prototype.getGroups = function( worgId ) {
		const self = this;
		const base = self.baseGroups[ worgId ];
		if ( base )
			return [ base ];
		
		const groups = [];
		const activeId = self.getActiveId( worgId );
		const otherId = self.getOtherId( worgId );
		const active = self.groups[ activeId ];
		const other = self.groups[ otherId ];
		if ( active )
			groups.push( active );
		if ( other )
			groups.push( other );
		
		return groups;
	}
	
	ns.UserCtrl.prototype.getIdSync = function( clientId ) {
		const self = this;
		const id = self.identities[ clientId ];
		return id || null;
	}
	
	ns.UserCtrl.prototype.getWorkgroup = function( worgId ) {
		const self = this;
		return self.groupsAvailable[ worgId ] || null;
	}
	
	ns.UserCtrl.prototype.getAtDefaults = function() {
		const self = this;
		return [ 'everyone', 'admins', 'active', 'guests' ];
	}
	
	ns.UserCtrl.prototype.checkIsOnline = function( userId ) {
		const self = this;
		throw new Error( 'checkIsOnline' );
		return self.onlineList.some( oId => oId === userId );
	}
	
	ns.UserCtrl.prototype.setState = function( userId, state, isSet ) {
		const self = this;
		const user = self.users[ userId ];
		if ( user && user.setState )
			user.setState( state, isSet );
		
		self.emit( 'state', {
			state  : state,
			isSet  : isSet,
			userId : userId,
		});
	}
	
	ns.UserCtrl.prototype.addIdentities = function( idMap ) {
		const self = this;
		if ( null == idMap )
			return;
		
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
	
	ns.UserCtrl.prototype.updateAll = function( state ) {
		const self = this;
		removeOld( state.userList );
		addNew( state.userList );
		updateOnline( state.onlineList );
		self.updateLiveState( state.peerList );
		self.updateGuests( state.guestList );
		
		function removeOld( fresh ) {
			if ( null == fresh )
				return;
			
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
			if ( null == fresh )
				return;
			
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
			if ( null == fresh )
				return;
			
			let uids = Object.keys( self.users );
			uids.forEach( uid => {
				if ( fresh.some( fid => fid === uid ))
					self.handleOnline( uid );
				else
					self.handleOffline( uid );
			});
		}
		
	}
	
	ns.UserCtrl.prototype.getAvatarKlass = async function( clientId ) {
		const self = this;
		const id = await self.getIdentity( clientId );
		if ( id && id.isGuest )
			return 'guest-user-klass';
		
		return self.getUserCssKlass( clientId );
	}
	
	ns.UserCtrl.prototype.close = function() {
		const self = this;
		self.releaseConn();
		self.closeUsers();
		self.closeGroups();
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		/*
		if ( self.conn )
			self.conn.close();
		*/
		
		self.closeEventEmitter();
		
		delete self.detached;
		delete self.el;
		delete self.conn;
		delete self.users;
		delete self.userIds;
		delete self.onlineList;
		delete self.groups;
		delete self.groupIds;
		delete self.groupsAvailable;
	}
	
	// Private
	
	ns.UserCtrl.prototype.init = function(
		worgs,
		room,
		guestAvatar
	) {
		const self = this
		self.build()
		self.initBaseGroups()
		self.initWorkgroups( worgs )
		self.addId( room )
		self.addUserCss( 'guest-user', guestAvatar )
		self.addUserCss( 'default-user', guestAvatar )
		self.bindConn()
	}
	
	ns.UserCtrl.prototype.build = function() {
		const self = this;
		const container = document.getElementById( self.containerId );
		const conf = {};
		self.el = hello.template.getElement( self.buildTmpl, conf );
		container.appendChild( self.el );
		self.detached = document.getElementById( 'user-ctrl-detached' );
	}
	
	ns.UserCtrl.prototype.initBaseGroups = function() {
		const self = this;
		const base = [
			{
				clientId     : 'admins',
				name         : View.i18n( 'i18n_admins' ),
				sectionKlass : 'base-group group-admins',
			},
			{
				clientId     : 'guests',
				name         : View.i18n( 'i18n_guests' ),
				sectionKlass : 'base-group group-guests',
			},
			{
				clientId     : 'active',
				name         : View.i18n( 'i18n_active' ),
				sectionKlass : 'base-group group-active',
			},
			{
				clientId     : 'other',
				name         : View.i18n( 'i18n_other' ),
				sectionKlass : 'base-group group-other',
			},
		];
		
		base.forEach( section => {
			self.addBaseGroup( section );
		});
	}
	
	ns.UserCtrl.prototype.initWorkgroups = function( worgs ) {
		const self = this;
		if ( null == worgs )
			return;
		
		self.workId = worgs.workId;
		
		// available
		const ava = worgs.available;
		const avaIds = Object.keys( ava );
		avaIds.forEach( wId => {
			let worg = ava[ wId ];
			self.addWorgAvailable( worg );
		});
		
		// assigned
		const ass = worgs.assigned;
		ass.forEach( worg => {
			self.addWorgAssigned( worg );
		});
	}
	
	ns.UserCtrl.prototype.addWorgAvailable = function( worg ) {
		const self = this;
		const wId = worg.clientId;
		worg.priority = worg.priority || self.worgPri;
		self.groupsAvailable[ wId ] = worg;
	}
	
	ns.UserCtrl.prototype.addWorgAssigned = function( worg ) {
		const self = this;
		const wId = worg.clientId;
		if ( self.groupsAssigned[ wId ]) {
			return;
		}
		
		self.groupsAssigned[ wId ] = worg;
		self.groupsAssignedIds.push( wId );
		if ( !self.isInitialized )
			return;
		
		self.showWorgAssigned( wId );
	}
	
	ns.UserCtrl.prototype.removeWorgAssigned = function( wId ) {
		const self = this;
		const worgs = self.getGroups( wId );
		delete self.groupsAssigned[ wId ];
		self.groupsAssignedIds = Object.keys( self.groupsAssigned );
		if ( !worgs || !worgs.length )
			return;
		
		worgs.forEach( worg => {
			const wId = worg.id;
			const detached = worg.detachAll();
			detached.forEach( uId => self.setUserToGroup( uId ));
			
			const parent = self.getGroups( worg.group )[ 0 ];
			if ( parent )
				parent.detach( wId );
			
			worg.close();
			delete self.groups[ wId ];
			self.groupIds = Object.keys( self.groups );
		});
	}
	
	ns.UserCtrl.prototype.setWorkgroups = async function( conf ) {
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
		ass.forEach( worg => self.showWorgAssigned( wId ));
	}
	
	ns.UserCtrl.prototype.addBaseGroup = function( conf ) {
		const self = this;
		const id = conf.clientId;
		let Group = library.component.UserGroup;
		if ( 'other' == id )
			Group = library.component.UserGroupOther;
		
		const group = new Group(
			id,
			conf,
			'user-groups',
		);
		
		self.baseGroups[ id ] = group;
		self.baseGroupIds.push( id );
		if ( 'other' == id ) {
			group.on( 'show-other', e => self.handleShowOther( e ));
			group.on( 'filter', str => self.handleOtherFilter( str ));
		}
	}
	
	ns.UserCtrl.prototype.handleShowOther = function( show ) {
		const self = this;
		self.showOther = show;
		if ( show )
			self.addOther();
		else
			self.removeOther();
	}
	
	ns.UserCtrl.prototype.addOther = function() {
		const self = this;
		self.userList.map( uId => {
			return self.buildUser( uId );
		});
	}
	
	ns.UserCtrl.prototype.removeOther = function() {
		const self = this;
		self.userList.forEach( uId => {
			const user  = self.users[ uId ];
			if ( null == user )
				return;
			
			const oIdx = user.group.indexOf( 'other' );
			if ( 0 != oIdx )
				return;
			
			self.unsetUser( uId );
		});
	}
	
	ns.UserCtrl.prototype.handleOtherFilter = function( filter ) {
		const self = this;
		if ( filter && filter.length )
			filter = filter.toLowerCase();
		
		self.userList.forEach( uId => {
			const user = self.users[ uId ];
			if (( null == user ) || ( null == user.group ))
				return;
			
			const oIdx = user.group.indexOf( 'other' );
			if ( 0 != oIdx )
				return;
			
			const name = user.name.toLowerCase();
			const fIdx = name.indexOf( filter );
			if ( -1 == fIdx )
				hide( uId );
			else
				setVisible( uId );
		});
		
		function setVisible( uId ) {
			const user = self.users[ uId ];
			if ( user.isVisible )
				return;
			
			const group = self.getGroup( user.group );
			group.showItem( uId );
		}
		
		function hide( uId ) {
			const user = self.users[ uId ];
			if ( !user.isVisible )
				return;
			
			const group = self.getGroup( user.group );
			group.hideItem( uId );
		}
	}
	
	ns.UserCtrl.prototype.showWorgAssigned = async function( wId ) {
		const self = this;
		const worg = self.groupsAvailable[ wId ];
		if ( self.groups[ wId ]) {
			return;
		}
		
		if ( null == worg.sectionKlass )
			worg.sectionKlass = '';
		
		setActive( worg );
		setOther( worg );
		
		function setActive( conf ) {
			const id = self.getActiveId( conf.clientId );
			const item = set( id, conf, self.baseGroups[ 'active' ]);
			self.baseGroups[ 'active' ].attach( item );
		}
		
		function setOther( conf ) {
			const id = self.getOtherId( conf.clientId );
			const item = set( id, conf, self.baseGroups[ 'other']);
			self.baseGroups[ 'other' ].attach( item );
		}
		
		function set( id, conf, parentGroup ) {
			const group = new library.component.UserGroup(
				id,
				conf,
				'user-ctrl-detached',
			);
			
			self.groups[ id ] = group;
			self.groupIds.push( id );
			
			return group;
		}
	}
	
	ns.UserCtrl.prototype.getActiveId = function( worgId ) {
		const self = this;
		return 'active-' + worgId;
	}
	
	ns.UserCtrl.prototype.getOtherId = function( worgId ) {
		const self = this;
		return 'other-' + worgId;
	}
	
	ns.UserCtrl.prototype.removeUserGroup = function( worgId ) {
		const self = this;
		//self.groupList.remove( worgId );
	}
	
	ns.UserCtrl.prototype.setUserList = async function() {
		const self = this;
		if ( self.adminList ) {
			const waitA = self.adminList.map( aId => {
				return self.buildUser( aId );
			});
			await Promise.all( waitA );
		}
		
		if ( self.recentList ) {
			const waitR = self.recentList.map( rId => {
				return self.buildUser( rId );
			});
			await Promise.all( waitR );
		}
		
		if ( self.guestList ) {
			const waitG = self.guestList.map( gId => {
				return self.buildUser( gId );
			});
			await Promise.all( waitG );
		}
		
		if ( !self.showOther )
			return;
		
		const waitU = self.userList.map( uId => {
			return self.buildUser( uId );
		});
		await Promise.all( waitU );
	}
	
	ns.UserCtrl.prototype.addId = function( id ) {
		const self = this;
		if ( !id )
			return false;
		
		const cId = id.clientId;
		self.identities[ cId ] = id;
		self.addUserCss( cId, id.avatar );
		return true;
	}
	
	ns.UserCtrl.prototype.bindConn = function() {
		const self = this;
		if ( !self.conn )
			throw new Error( 'UserCtrl.bindConn - no conn' );
		
		self.conn.on( 'online'             , online );
		self.conn.on( 'offline'            , offline );
		self.conn.on( 'join'               , join );
		self.conn.on( 'leave'              , leave );
		self.conn.on( 'identity'           , identity );
		self.conn.on( 'auth'               , auth );
		self.conn.on( 'live'               , e => self.handleLive( e ));
		self.conn.on( 'workgroups-assigned', e => self.handleWorgsAssigned( e ));
		self.conn.on( 'workgroup-added'    , e => self.addWorgAvailable( e ));
		self.conn.on( 'workgroup-removed'  , e => self.handleWorgRemoved( e ));
		self.conn.on( 'recent-add'         , e => self.handleRecentAdd( e ));
		self.conn.on( 'recent-remove'      , e => self.handleRecentRemove( e ));
		
		function online( e ) { self.handleOnline( e ); }
		function offline( e ) { self.handleOffline( e ); }
		function join( e ) { self.handleJoin( e ); }
		function leave( e ) { self.handleLeave( e ); }
		function identity( e ) { self.handleIdentity( e ); }
		function auth( e ) { self.handleAuth( e ); }
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
		//self.conn.release( 'workgroup' );
		self.conn.release( 'live' );
		self.conn.release( 'workgroups-assigned' );
		self.conn.release( 'workgroup-added' );
		self.conn.release( 'workgroup-removed' );
		self.conn.release( 'recent-add' );
		self.conn.release( 'recent-remove' );
	}
	
	ns.UserCtrl.prototype.closeUsers = function() {
		const self = this;
		console.log( 'closeUsers - NYI', self.users );
	}
	
	ns.UserCtrl.prototype.closeGroups = function() {
		const self = this;
		console.log( 'closeGroups - NYI', self.groups );
	}
	
	ns.UserCtrl.prototype.handleOnline = function( userId ) {
		const self = this;
		const uid = userId;
		const users = self.getUser( userId );
		users.forEach( u => u.setStatus( 'online' ));
		//user.setStatus( 'online' );
		//self.setUserToGroup( uid );
	}
	
	ns.UserCtrl.prototype.handleOffline = function( userId ) {
		const self = this;
		const users = self.getUser( userId );
		users.forEach( u => u.setStatus( 'offline' ));
		//user.setStatus( 'offline' );
		//self.setUserToGroup( userId );
	}
	
	ns.UserCtrl.prototype.getUser = function( userId ) {
		const self = this;
		const list = [];
		const user = self.users[ userId ];
		if ( null == user )
			return list;
		
		list.push( user );
		return list;
	}
	
	ns.UserCtrl.prototype.handleJoin = async function( conf ) {
		const self = this;
		const user = conf.user;
		const uId = user.clientId;
		const uIdx = self.userList.indexOf( uId );
		if ( -1 != uIdx )
			return;
		
		self.userList.push( uId );
		//self.addUserToWorgs( user );
		/*
		if ( user.isAdmin )
			self.addAdmin
		*/
		
		if ( user.isRecent )
			self.recentAdd( uId );
		
		if ( user.isGuest )
			self.guestAdd( uId );
		
		if ( self.showOther ) {
			self.buildUser( uId );
			return;
		}
		
		if ( !user.isAdmin && !user.isRecent && !user.isGuest )
			return;
		
		self.buildUser( uId );
	}
	
	ns.UserCtrl.prototype.updateUserPosition = async function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user )
			return await self.buildUser( userId );
		else
			self.setUserToGroup( userId );
		
	}
	
	ns.UserCtrl.prototype.buildUser = async function( userId, worgs ) {
		const self = this;
		if ( self.users[ userId ])
			return
		
		self.users[ userId ] = true
		let id = await self.getIdentity( userId )
		if ( null != worgs )
			id.workgroups = worgs
		
		const conf = self.buildGroupUserConf( id )
		
		const GroupUser = conf.pop()
		const userItem = new GroupUser( ...conf )
		self.users[ userId ] = userItem
		self.userIds.push( userId )
		self.detached.appendChild( userItem.el )
		if ( id.isOnline )
			userItem.setStatus( 'online' )
		else
			userItem.setStatus( 'offline' )
		
		self.setUserToGroup( userId )
		const pIdx = self.peerList.indexOf( userId )
		const isLive = ( -1 != pIdx )
		if ( isLive )
			self.setState( userId, 'live', true )
	}
	
	ns.UserCtrl.prototype.buildGroupUserConf = function( identity ) {
		const self = this
		const conf = [ 
			identity.clientId, 
			self.conn, 
			identity, 
			library.component.GroupUser 
		]
		
		return conf
	}
	
	ns.UserCtrl.prototype.setUserToGroup = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( !user ) {
			console.log( 'setUSertoGroup - no user for', {
				uid   : userId,
				users : self.users,
			});
			return;
		}
		
		let groupId = null;
		const isActive = self.checkIsActive( userId );
		if ( user.isAdmin )
			groupId = 'admins';
		
		if ( user.isGuest )
			groupId = 'guests';
		
		if ( !groupId && user.workgroups ) {
			let available = user.workgroups.filter( wgId => !!self.groupsAssigned[ wgId ]);
			groupId = available[ 0 ];
			if ( groupId ) {
				if ( isActive )
					groupId = self.getActiveId( groupId );
				else {
					if ( self.showOther )
						groupId = self.getOtherId( groupId );
					else
						groupId = null;
				}
			}
		}
		
		if ( !groupId ) {
			if ( isActive )
				groupId = 'active';
			else {
				if ( self.showOther )
					groupId = 'other';
				else
					groupId = null;
			}
		}
		
		if ( null == groupId )
			self.unsetUser( userId );
		else
			self.moveUserToGroup( user.id, groupId );
	}
	
	ns.UserCtrl.prototype.handleLeave = function( userId ) {
		const self = this;
		const uIdx = self.userList.indexOf( userId );
		if ( -1 == uIdx )
			return;
		
		self.unsetUser( userId );
		self.userList.splice( uIdx, 1 );
	}
	
	ns.UserCtrl.prototype.handleIdentity = function( id ) {
		const self = this;
		if ( !id || !id.clientId ) {
			console.log( 'UserCtrl.handleIdentity - invalid id', id );
			return;
		}
		
		self.addId( id );
		
		/*
		const cId = id.clientId;
		self.addUserCss( cId, id.avatar );
		self.identities[ cId ] = id;
		*/
	}
	
	ns.UserCtrl.prototype.updateIdentity = function( update ) {
		const self = this;
		const id = update.data;
		const cId = id.clientId;
		const prop = update.type;
		if ( null == self.identities[ cId ])
			self.addId( id );
		else {
			const curr = self.identities[ cId ];
			curr[ prop ] = id[ prop ];
		}
		//self.identities[ cId ] = id;
		
		if ( 'avatar' === prop ) {
			self.addUserCss( cId, id.avatar );
		}
		
		if ( 'name' === prop ) {
			const user = self.get( cId );
			if ( null != user )
				user.updateName( id.name );
		}
		
		if ( 'isOnline' === prop ) {
			if ( id.isOnline )
				self.handleOnline( cId );
			else
				self.handleOffline( cId );
		}
	}
	
	ns.UserCtrl.prototype.getIdentity = async function( userId ) {
		const self = this;
		let id = self.identities[ userId ];
		if ( null != id )
			return id;
		
		const req = {
			type : 'get-identity',
			data : userId,
		};
		try {
			id = await self.conn.request( req );
		} catch( ex ) {
			console.log( 'UserCtrl.getIdentity - ex', ex );
			id = null;
		}
		
		if ( null != id )
			self.addId( id );
		
		return id;
	}
	
	ns.UserCtrl.prototype.handleAuth = function( event ) {
		const self = this;
		console.log( 'presence.handleAuth - NYI', event );
	}
	
	ns.UserCtrl.prototype.updateLiveState = function( peerList ) {
		const self = this;
		peerList = peerList || [];
		const current = self.peerList;
		current.forEach( uId => {
			self.setState( uId, 'live', false );
		});
		
		self.peerList = peerList;
		peerList.forEach( uId => {
			self.setState( uId, 'live', true );
		});
		
		self.emit( 'peers', self.peerList );
	}
	
	ns.UserCtrl.prototype.handleLive = function( update ) {
		const self = this;
		const type = update.type;
		const data = update.data;
		if ( !type || !data ) {
			//console.log( 'UserCtrl.handleLive, invalid', update )
			return
		}
		
		if ( 'peers' == type ) {
			reset( data.peerIds );
			return;
		}
		
		const pId = data.peerId;
		const pIdx = self.peerList.indexOf( pId );
		if ( 'join' == type ) {
			if ( -1 != pIdx )
				return;
			
			self.peerList.push( pId );
			setLive( pId, true );
			return;
		}
		
		if ( 'leave' == type ) {
			if ( -1 == pIdx )
				return;
			
			self.peerList.splice( pIdx, 1 );
			setLive( pId, false );
			return;
		}
		
		function setLive( peerId, isLive ) {
			self.setState( peerId, 'live', isLive );
		}
		
		function reset( freshList ) {
			self.peerList.forEach( pId => {
				setLive( pId, false );
			});
			freshList.forEach( pId => {
				setLive( pId, true );
			});
			self.peerList = freshList;
		}
	}
	
	ns.UserCtrl.prototype.updateGuests = function( guests ) {
		const self = this;
		//console.log( 'updateGuests - NOOP', guests );
		
	}
	
	ns.UserCtrl.prototype.handleWorgsAssigned = function( wgs ) {
		const self = this;
		const assIds = wgs.map( ass => ass.clientId );
		const remove = self.groupsAssignedIds.filter( currId => {
			return !assIds.some( assId => assId == currId );
		});
		remove.forEach( wId => self.removeWorgAssigned( wId ));
		wgs.forEach( wg => self.addWorgAssigned( wg ));
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
		
		const curr = self.getGroup( user.group );
		const to = self.getGroup( groupId );
		
		if ( user.group === groupId ) {
			return;
		}
		
		if ( curr )
			curr.detach( userId );
		
		if ( !to ) {
			console.log( 'UserCtrl.moveUserToGroup - invalid groupId', {
				type   : groupId,
				groups : self.groups,
				base   : self.baseGroups,
			});
			return;
		}
		
		to.attach( user );
	}
	
	ns.UserCtrl.prototype.getGroup = function( groupId ) {
		const self = this;
		
		if ( null == groupId )
			return null;
		
		return self.groups[ groupId ] || self.baseGroups[ groupId ] || null;
	}
	
	ns.UserCtrl.prototype.unsetUser = function( userId ) {
		const self = this;
		self.removeFromGroup( userId );
		const user = self.users[ userId ];
		delete self.users[ userId ];
		if ( !user )
			return;
		
		self.userIds = Object.keys( self.users );
		user.close();
	}
	
	ns.UserCtrl.prototype.removeFromGroup = function( userId ) {
		const self = this;
		const user = self.users[ userId ];
		if ( null == user ) {
			return;
		}
		
		if ( !user ) {
			console.log( 'UserCtrl.removeFromGroup - no user', {
				uid   : userId,
				users : Object.keys( self.users ),
			});
			return;
		}
		
		const group = self.getGroup( user.group );
		if ( !group ) {
			console.log( 'UserCtrl.removeFromGroup - no group for user', {
				user   : user,
				groups : Object.keys( self.groups ),
			});
			return;
		}
		
		group.remove( userId );
	}
	
	ns.UserCtrl.prototype.checkIsActive = function( userId ) {
		const self = this;
		return self.recentList.some( uId => uId === userId );
	}
	
	ns.UserCtrl.prototype.handleRecentAdd = function( userId ) {
		const self = this;
		const added = self.recentAdd( userId );
		self.updateUserPosition( userId );
	}
	
	ns.UserCtrl.prototype.recentAdd = function( userId ) {
		const self = this;
		const rIdx = self.recentList.indexOf( userId );
		if ( -1 != rIdx )
			return false;
		
		self.recentList.push( userId );
		return true;
	}
	
	ns.UserCtrl.prototype.handleRecentRemove = function( userId ) {
		const self = this;
		const idx = self.recentList.indexOf( userId );
		self.recentList.splice( idx, 1 );
		try {
			self.setUserToGroup( userId );
		} catch( ex ) {
			console.log( 'setToGroup ex', ex );
		}
	}
	
	ns.UserCtrl.prototype.recentRemove = function( userId ) {
		const self = this;
		const rIdx = self.recentList.indexOf( userId );
		if ( -1 == rIdx )
			return false;
		
		self.recentList.splice( rIdx, 1 );
		return true;
	}
	
	ns.UserCtrl.prototype.guestAdd = function( userId ) {
		const self = this;
		const gIdx = self.guestList.indexOf( userId );
		if ( -1 != gIdx )
			return false;
		
		self.guestList.push( userId );
		return true;
	}
	
	ns.UserCtrl.prototype.guestRemove = function( userId ) {
		const self = this;
		const gIdx = self.guestList.indexOf( userId );
		if ( -1 == gIdx )
			return false;
		
		self.guestList.splice( gIdx, 1 );
		return true;
	}
	
	ns.UserCtrl.prototype.addUserCss = function( userId, avatar ) {
		const self = this;
		/*
		if ( !avatar )
			console.log( 'addUserCss - missing avatar', {
				uid : userId,
				ava : avatar,
			});
		*/
		
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
		roomId,
		input,
		parser,
		linkExpand,
		pathExpand
	) {
		const self = this
		self.containerId = containerId
		self.users = users
		self.userId = userId
		self.roomId = roomId
		self.input = input
		self.parser = parser || null
		self.linkEx = linkExpand || null
		self.fpathEx = pathExpand || null
		
		self.conn = null
		self.days = []
		self.eventOrder = []
		self.events = {}
		self.msgOverlays = {}
		self.supressConfirm = false
		self.userLastMsg = null
		
		self.init( parentConn )
	}
	
	// Public
	
	ns.MsgBuilder.prototype.handle = function( event ) {
		const self = this
		const handler = self.eventMap[ event.type ]
		if ( !handler ) {
			return null
		}
		
		return handler( event.data )
	}
	
	ns.MsgBuilder.prototype.update = function( event, isEdit ) {
		const self = this;
		if ( !event || !event.data )
			return;
		
		let msg = event.data;
		const el = document.getElementById( msg.msgId );
		if ( !el ) {
			console.log( 'no msg el to update', event );
			return
		}
		
		let update = msg.message;
		let parsed = null;
		if ( self.parser )
			parsed = self.parser.work( update );
		else
			parsed = update;
		
		//const orgEl = el.querySelector( '.msg-container .str' );
		const msgEl = el.querySelector( '.msg-container .message' )
		//orgEl.textContent = update;
		msgEl.innerHTML = parsed
		if ( isEdit )
			self.setEdit( msg )
		
		if ( self.fpathEx )
			self.fpathEx.work( msgEl )
		
		if ( self.linkEx )
			self.linkEx.work( msgEl )
		
		self.confirmEvent( 'message', msg.msgId )
	}
	
	ns.MsgBuilder.prototype.editLastUserMessage = function() {
		const self = this;
		if ( null == self.userLastMsg )
			return false;
		
		const last = self.userLastMsg;
		self.editMessage( last.msgId );
	}
	
	ns.MsgBuilder.prototype.editMessage = async function( itemId ) {
		const self = this;
		const el = document.getElementById( itemId );
		if ( el.isEditing )
			return;
		
		const req = {
			type : 'edit-get',
			data : {
				msgId : itemId,
			},
		};
		
		let msg = null;
		try {
			msg = await self.conn.request( req );
		} catch( ex ) {
			console.log( 'reqErr', err );
			editError( 'ERR_EDIT_REQUEST_FAILED', itemId );
		}
		
		if ( null == msg ) {
			editError( 'ERR_EDIT_NO_EVENT', itemId );
			return;
		}
		
		self.doEdit( msg );
		
		function editError( err, item ) {
			console.log( 'editError', {
				err : err,
				msg : item,
			});
		}
	}
	
	ns.MsgBuilder.prototype.pauseSmoothScrolling = function() {
		const self = this;
		if ( null != self.smoothPause ) 
			window.clearTimeout( self.smoothPause );
		else
			self.setSmoothScrolling( false );
		
		self.smoothPause = window.setTimeout( reEnableSmooth, 1000 );
		function reEnableSmooth() {
			self.smoothPause = null;
			self.setSmoothScrolling( true );
		}
	}
	
	
	// Priv
	
	ns.MsgBuilder.prototype.doEdit =  function( event ) {
		const self = this;
		const msg = event.data;
		const mId = msg.msgId;
		const el = document.getElementById( mId );
		if ( !el ) {
			console.trace( 'MsgBuilder.doEdit - no element found for', event );
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
		const editEl = hello.template.getElement( 'edit-msg-ui-tmpl', editConf );
		const reasonInput = editEl.querySelector( '.edit-reason-input' );
		const subBtn = editEl.querySelector( '.actions .edit-submit' );
		const cancelBtn = editEl.querySelector( '.actions .edit-cancel' );
		sysEl.appendChild( editEl );
		
		const multiConf = {
			containerId     : multiId,
			templateManager : hello.template,
		};
		const edit = new library.component.MultiInput( multiConf );
		edit.setValue( msg.message );
		edit.on( 'submit', onSubmit );
		edit.focus();
		
		subBtn.addEventListener( 'click', subClick, false );
		cancelBtn.addEventListener( 'click', cancelClick, false );
		
		function onSubmit( newMsg ) {
			//newMsg = edit.getValue();
			handleInput( newMsg );
		}
		
		function subClick( e ) {
			let newMsg = edit.getValue();
			handleInput( newMsg );
		}
		
		async function handleInput( msg ) {
			let reason = null;
			if ( reasonInput ) {
				reason = getReason();
				if ( reasonRequired && !reason ) {
					setReasonRequired();
					edit.setValue( msg );
					return;
				}
			}
			
			const err = await saveEdit( msg, reason );
			if ( err ) {
				edit.setValue( msg );
				return;
			}
			
			close();
		}
		
		function isAuthor() {
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
		
		async function saveEdit( newMsg, reason ) {
			const edit = {
				msgId   : mId,
				message : newMsg,
				reason  : reason,
			};
			
			const req = {
				type : 'edit-save',
				data : edit,
			};
			let res = null;
			try {
				res = await self.conn.request( req );
			} catch( ex ) {
				console.log( 'editErr', ex );
				edit.setValue( newMsg );
				return ex;
			}
			
			return null;
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
			
			self.input.focus();
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
	
	ns.MsgBuilder.prototype.deleteMessage = async function( msgId ) {
		const self = this;
		self.setMsgOverlay( msgId, true );
		let confirm = null
		try {
			confirm = await window.View.confirmDialog( 
				window.View.i18n( 'i18n_confirm_delete' ),
				window.View.i18n( 'i18n_the_message_will_be_deleted' ),
				window.View.i18n( 'i18n_delete' ),
				window.View.i18n( 'i18n_cancel' )
			);
		} catch( ex ) {
			console.log( 'deleteMessage - confirm ex', ex );
		}
		
		if ( null == confirm || false === confirm ) {
			self.setMsgOverlay( msgId, false );
			return;
		}
		
		const del = {
			type : 'delete',
			data : {
				msgId : msgId,
			}
		};
		let res = null;
		try {
			res = await self.conn.request( del );
		} catch( ex ) {
			console.log( 'deleteMessage ex', ex );
			self.setMsgOverlay( msgId, false );
			
			return;
		}
		
		if ( res && res.type == 'error' ) {
			console.log( 'view.Presence.MsgBuilder.deleteMessage - error', res );
			self.setMsgOverlay( msgId, false );
		} else {
			//console.log( 'deleteMessage - deleted probaby', [ msgId, res ]);
		}
		
	}
	
	ns.MsgBuilder.prototype.setMsgOverlay = function( msgId, show ) {
		const self = this;
		if ( true == show )
			set( msgId );
		else
			unset( msgId );
		
		function set( mId ) {
			const mEl = document.getElementById( msgId );
			let oId = self.msgOverlays[ msgId ];
			if ( null != oId )
				return;
			
			oId = window.friendUP.tool.uid( 'mo' );
			const oConf = {
				id : oId,
			};
			const oEl = hello.template.getElement( 'msg-overlay', oConf );
			self.msgOverlays[ msgId ] = oId;
			mEl.appendChild( oEl );
		}
		
		function unset( msgId ) {
			const oId = self.msgOverlays[ msgId ];
			const overlay = document.getElementById( oId );
			delete self.msgOverlays[ msgId ];
			if ( null == overlay )
				return;
			
			overlay.parentNode.removeChild( overlay );
		}
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
		if ( self.dayUpdate != null ) {
			window.clearTimeout( self.dayUpdate );
			delete self.dayUpdate;
		}
		
		if ( self.conn )
			self.conn.close();
		
		delete self.conn;
		delete self.users;
		delete self.userId;
		delete self.roomId;
		delete self.workgroupId;
		delete self.input;
		delete self.onEdit;
		delete self.parser;
		delete self.linkEx;
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
		self.conn = new library.component.RequestNode(
			'chat',
			parentConn,
			eSink
		);
		
		function eSink( ...args ) {
			//console.log( 'MsgBuilder eSink', args );
		}
		
		self.container = document.getElementById( self.containerId );
		if ( !self.container ) {
			throw new Error( 'MsgBuilder.init - container element not found for id: ',
				 self.containerId )
		}
		
		if ( !self.users || !hello.template ) {
			console.log( 'MsgBuilder - missing things', self )
			throw new Error( 'MsgBuilder - missing things ^^^' )
		}
		
		self.users.on( 'msg-target', e => self.handleMsgTarget( e ))
		self.startDayUpdates()
		
		self.eventMap = {
			'msg'          : e => self.handleMsg( e ),
			'work-msg'     : e => self.handleMsg( e ),
			'action'       : e => self.handleAction( e ),
			'notification' : e => self.handleNotie( e ),
			'log'          : e => self.handleLog( e ),
			'update'       : e => self.update( e ),
			'edit'         : e => self.update( e, true ),
			'remove'       : e => self.handleRemove( e ),
			'confirm'      : e => self.handleConfirm( e ),
		}
		
		self.logMap = {
			'msg'          : e => self.buildMsg( e, true ),
			'work-msg'     : e => self.buildWorkMsg( e, true ),
			'action'       : e => self.buildAction( e, true ),
			'notification' : e => self.buildNotie( e, true ),
		}
		
	}
	
	ns.MsgBuilder.prototype.getFirstMsg = function() {
		const self = this
		const msgId = self.eventOrder[ 1 ] // the first item will always be the day insert
		return msgId || null
	}
	
	ns.MsgBuilder.prototype.getLastMsg = function() {
		const self = this;
		return self.lastMsg
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
			self.msgTargetEl = hello.template.getElement( 'msg-target-box-tmpl', conf );
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
				templateManager : hello.template,
			};
			self.msgTargetInput = new library.component.MultiInput( multiConf );
			self.msgTargetInput.on( 'submit', onSubmit );
			
			const currMsg = self.input.getValue();
			self.msgTargetInput.setValue( currMsg );
			self.input.setValue( '' );
			
			function onSubmit( e ) {
				self.sendMsgTarget( e );
			}
		}
		
		function setTargets() {
			const targetsEl = self.msgTargetEl.querySelector( '.msg-target-targets' );
			targetsEl.innerHTML = null;
			const wTIds = Object.keys( self.msgTargets );
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
				const el = hello.template.getElement( 'msg-target-tmpl', conf );
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
					const wTs = self.msgTargets[ worgId ];
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
	
	ns.MsgBuilder.prototype.sendMsgTarget = function( message ) {
		const self = this;
		if ( !self.msgTargetInput )
			return;
		
		if ( null == message )
			message = self.msgTargetInput.getValue();
		
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
	
	ns.MsgBuilder.prototype.startDayUpdates = function() {
		const self = this;
		if ( self.dayUpdate != null )
			return
		
		setNextUpdate();
		
		function setNextUpdate() {
			const now = Date.now()
			const midnight = new Date().setHours( 24, 0, 0, 0 ) // set time to nearest next midnight,
			// ..and it returns a timestamp of that midnight
			const timeToMidnight = midnight - now
			self.dayUpdate = window.setTimeout( update, timeToMidnight )
		}
		
		function update() {
			self.updateDayDisplay()
			delete self.dayUpdate
			setNextUpdate()
		}
	}
	
	ns.MsgBuilder.prototype.exists = function( msgId ) {
		const self = this;
		const el = document.getElementById( msgId );
		return !!el;
	}
	
	ns.MsgBuilder.prototype.insertEvent = function( event ) {
		const self = this
		console.log( 'insertEvent', [ event, self.lastMsg, self.eventOrder ])
		
		const pos = setPosition( event )
		const conf = {
			position : pos,
			event    : event,
		}
		
		const el = self.buildMsg( conf )
		if ( !el ) 
			throw { err : 'could not build el for msg', event : event }
		
		if ( pos.nextId == null ) {
			if ( event.fromId === self.userId )
				self.userLastMsg = event
			
			self.lastSpeakerId = event.fromId
		}
		
		self.addItem( el, pos, event )
		
		return conf
		
		function setPosition( event ) {
			self.events[ event.msgId ] = event
			const pos = {
				prevId : null,
				nextId : null,
			}
			
			const day = self.checkDay( event.time )
			if ( null == self.lastMsg ) {
				pos.prevId = day.id
				pos.isLast = true
				self.lastMsg = event
				self.eventOrder.push( event )
				return pos
			}
			
			if ( self.lastMsg.time < event.time ) {
				if ( day.time > self.lastMsg.time )
					pos.prevId = day.id
				else
					pos.prevId = self.lastMsg.msgId
				
				pos.isLast = true
				self.lastMsg = event
				self.eventOrder.push( event )
				
				return pos
			}
			
			let prev = null
			let next = null
			let mi = self.eventOrder.length
			for( ; mi-- ; ) {
				next = prev
				prev = self.eventOrder[ mi ]
				if ( prev.time < event.time ) {
					prev = self.eventOrder[ mi - 1 ]
					break
				}
			}
			
			pos.prevId = prev?.msgId
			pos.nextId = next?.msgId
			self.eventOrder.splice( mi, 0, event )
			
			console.log( 'after for', {
				pos : pos,
				mi  : mi,
				mo  : self.eventOrder,
			})
			
			return pos
		}
	}
	
	ns.MsgBuilder.prototype.handleMsg = async function( event ) {
		const self = this
		if ( self.exists( event.msgId ))
			return
		
		console.log( 'handleMsg', event )
		
		// makes sure identity is available sync
		const fromId = event.fromId
		await self.users.getIdentity( fromId )
		
		const conf = self.insertEvent( event )
		if ( null == conf )
			return null
		
		if ( self.contactId && conf?.position?.nextId == null )
			self.updateLastDelivered( event )
		
		self.confirmEvent( 'message', event.msgId )
		
		return conf.event.el
	}
	
	ns.MsgBuilder.prototype.handleAction = function( event ) {
		const self = this;
		
		return el;
	}
	
	ns.MsgBuilder.prototype.handleNotie = function( event ) {
		const self = this;
		
		return el;
	}
	
	ns.MsgBuilder.prototype.handleLog = async function( log ) {
		const self = this
		console.log( 'handleLog, weeu weeu weeu', log )
		
		let events = log.data.events
		let newIds = log.data.ids
		let relations = log.data.relations
		if ( newIds )
			self.users.addIdentities( newIds )
		
		self.pauseSmoothScrolling()
		self.supressConfirm = true
		self.writingLogs = true
		
		// make sure all ids are available sync
		await self.prefetchIds( events )
		
		if ( 'before' === log.type && null != self.lastMsg )
			self.handleLogBefore( events )
		else
			self.handleLogAfter( events )
		
		self.writingLogs = false
		self.supressConfirm = false
		let lMId = self.getLastMsgId()
		self.confirmEvent( 'message', lMId )
		if ( relations )
			self.updateRelationState( relations )
		
	}
	
	ns.MsgBuilder.prototype.handleLogBefore = function( events ) {
		const self = this
		console.log( 'befsort', events )
		
		events.sort(( a, b ) => {
			if ( a.time < b.time )
				return -1
			if ( a.time > b.time )
				return 1
			
			return 0
		})
		
		console.log( 'aftersort', events )
		
		let l = events.length
		for( ; l-- ; ) {
			const event = events[ l ]
			self.insertEventBefore( event )
		}
	}
		
	ns.MsgBuilder.prototype.insertEventBefore = function( event ) {
		const self = this
		console.log( 'logbefore add', event )
		if ( self.exists( event.msgId ))
			return null
		
		// automates building events as a log event
		const handler = self.logMap[ event.type ]
		if ( !handler ) {
			console.log( 'no handler for event', event )
			return
		}
		
		const pos = setPosition( event )
		const conf = {
			position : pos,
			event    : event,
		}
		
		let el = handler( conf )
		if ( !el ) {
			console.log( 'no el, abort', event )
			// do actual cleanup here i guess
			return
		}
		
		self.addItem( el, pos, event )
		
		return pos
		
		function setPosition( event ) {
			self.events[ event.msgId ] = event
			const pos = {
				prevId : null,
				nextId : null,
			}
			
			const day = self.checkDay( event.time )
			if ( null == self.lastMsg ) {
				pos.prevId = day.id
				pos.isLast = true
				self.lastMsg = event
				self.eventOrder.push( event )
				return pos
			}
			
			let insert = 0
			self.eventOrder.some(( curr, i ) => {
				if ( curr.time < event.time )
					return false
				
				insert = i
				return true
			})
			
			const prev = self.eventOrder[ insert - 1 ]
			const next = self.eventOrder[ insert + 1 ]
			pos.prevId = prev?.msgId
			pos.nextId = next?.msgId
			self.eventOrder.splice( insert, 0, event )
			
			console.log( 'before pos', {
				pos    : pos,
				insert : insert,
				eo     : self.eventOrder,
			})
			
			return pos
			
			/*-----------
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
				&& (( prevEvent != null ) && ( prevEvent.data.status != 'delete' ))
			);
			
			let conf = {
				inGroup : isPrevSpeaker,
				event   : event,
			};
			
			
			if ( 'msg' === event.type )
				lastSpeakerId = event.fromId;
			else
				lastSpeakerId = null;
			
			prevEnvelope = envelope;
			prevEvent = item;
			*/
		}
		//return el;
	}
	
	ns.MsgBuilder.prototype.handleLogAfter = async function( items ) {
		const self = this
		if ( !items )
			return
		
		items.forEach( item => self.handle( item ))
	}
	
	ns.MsgBuilder.prototype.prefetchIds = async function( items ) {
		const self = this;
		let prefetchIds = {};
		items.forEach( item => {
			const msg = item.data;
			const fId = msg.fromId;
			prefetchIds[ fId ] = true;
			if ( null == msg.targets )
				return;
			
			const tIds = Object.keys( msg.targets );
			tIds.forEach( tId => {
				const t = msg.targets[ tId ];
				if ( null == t.length )
					return;
				
				t.forEach( cId => {
					prefetchIds[ cId ] = true;
				});
			});
		});
		prefetchIds = Object.keys( prefetchIds );
		const idWaits = prefetchIds.map( fId => self.users.getIdentity( fId ));
		await Promise.all( idWaits );
		
		return true;
	}
	
	ns.MsgBuilder.prototype.checkIsLastSpeaker = function( event, envelope ) {
		const self = this;
		if ( 'msg' !== event.type )
			return false;
		
		const lm = envelope.lastMsg;
		if ( null == lm )
			return false;
		
		if ( event.fromId != lm.fromId )
			return false;
		
		if ( 'delete' == lm.status )
			return false;
		
		return true;
	}
	
	ns.MsgBuilder.prototype.setSmoothScrolling = function( setSmooth ) {
		const self = this;
		if ( !self.container )
			return;
		
		self.container.classList.toggle( 'SmoothScrolling', setSmooth );
	}
	
	ns.MsgBuilder.prototype.addItem = function( el, position, msg ) {
		const self = this;
		self.container.appendChild( el )
		self.bindItem( el.id )
		
		if ( msg.editId )
			self.setEdit( msg )
	}
	
	ns.MsgBuilder.prototype.checkMessageGroup = function( conf ) {
		const self = this
		console.log( 'checkMessageGroup', conf )
		const pos = conf.position
		if ( pos.prevId == null )
			return false
		
		const curr = conf.event
		const prev = self.events[ pos.prevId ]
		if ( null == prev.fromId )
			return false
		
		if ( prev.fromId != curr.fromId )
			return false
		
		return true
	}
	
	ns.MsgBuilder.prototype.buildMsg = function( conf, isLog ) {
		const self = this
		const inGrp = self.checkMessageGroup( conf )
		const tmplId =  inGrp ? 'msg-tmpl' : 'msg-group-tmpl'
		const msg = conf.event;
		const uId = msg.fromId;
		const mId = msg.msgId;
		const user = self.users.getIdSync( self.userId );
		const from = self.users.getIdSync( uId );
		const isGuest = uId == null ? true : false;
		
		let name = '';
		let userKlass = '';
		let selfKlass = 'sw1';
		let canEdit = false;
		let canDelete = false;
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
		
		if ( user && user.isAdmin ) {
			canEdit = true;
			canDelete = true;
		}
		
		let original = msg.message;
		let message = null;
		if ( self.parser )
			message = self.parser.work( original, isLog );
		else
			message = original;
		
		const timeStr = self.getClockStamp( msg.time );
		/*
		console.log( 'buildMsg', {
			msg        : msg,
			from       : from,
			user       : user,
			canEdit    : canEdit,
			canDelete  : canDelete,
			canForward : canForward,
		});
		*/
		const actionsHtml = self.buildMsgActions( canEdit, canForward, canDelete );
		const msgConf = {
			msgId      : mId,
			userKlass  : userKlass,
			selfKlass  : selfKlass,
			from       : name,
			time       : timeStr,
			message    : message,
			msgActions : actionsHtml,
		};
		const el = hello.template.getElement( tmplId, msgConf );
		if ( self.fpathEx )
			self.fpathEx.work( el )
		
		if ( self.linkEx )
			self.linkEx.work( el )
		
		return el
	}
	
	ns.MsgBuilder.prototype.buildMsgActions = function( 
		canEdit, 
		canForward, 
		canDelete 
	) {
		const self = this;
		const editHidden = set( canEdit );
		const forwardHidden = set( canForward );
		const deleteHidden = set( canDelete );
		const gradHidden = set( canEdit || canForward || canDelete );
		const conf = {
			editHidden    : editHidden,
			forwardHidden : forwardHidden,
			deleteHidden  : deleteHidden,
			gradHidden    : gradHidden,
		};
		const html = hello.template.get( 'msg-actions-tmpl', conf );
		return html;
		
		function set( canDo ) {
			return canDo ? '' : 'hidden';
		}
	}
	
	ns.MsgBuilder.prototype.buildNotie = function() {
		const self = this;
	}
	
	ns.MsgBuilder.prototype.setEdit = async function( msg ) {
		const self = this;
		const mId = msg.msgId;
		const eId = msg.editId;
		const el = document.getElementById( mId );
		if ( !el ) {
			console.log( 'MsgBuilder.setEdit - no element for', msg );
			return;
		}
		
		const editer = await self.getEditer( msg );
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
		editEl = hello.template.getElement( 'edit-info-tmpl', conf );
		editContEl.appendChild( editEl );
	}
	
	ns.MsgBuilder.prototype.getEditer = function( msg ) {
		const self = this;
		const cId = msg.editBy;
		return self.users.getIdentity( cId );
	}
	
	ns.MsgBuilder.prototype.bindItem = function( itemId ) {
		const self = this;
		const el = document.getElementById( itemId );
		const actionsQuery = '.msg-content .msg-actions';
		const editBtn = el.querySelector( actionsQuery + ' .edit-msg' );
		const fwdBtn = el.querySelector( actionsQuery + ' .forward-msg' );
		const delBtn = el.querySelector( actionsQuery + ' .delete-msg' );
		if ( editBtn )
		  editBtn.addEventListener( 'click', editClick, false );
		if ( fwdBtn )
		  fwdBtn.addEventListener( 'click', fwdClick, false );
		if ( delBtn )
			delBtn.addEventListener( 'click', delClick, false );
		
		function editClick( e ) {
			self.editMessage( itemId );
		}
		
		function fwdClick( e ) {
			self.forwardMessage( itemId );
		}
		
		function delClick( e ) {
			self.deleteMessage( itemId );
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
	
	ns.MsgBuilder.prototype.checkDay = function( timestamp ) {
		const self = this
		console.log( 'checkDay', timestamp )
		const time = new Date( timestamp )
		const midnightStamp = time.setHours( 0, 0, 0, 0 )
		const dId = 'day-' + midnightStamp
		let day = self.events[ dId ]
		if ( null != day )
			return day
		
		day = {
			type : 'day',
			id   : dId,
			time : midnightStamp,
			date : self.getDayString( timestamp ),
		}
		
		let before = false
		const first = self.days[ 0 ]
		if ( null != first && day.time < first.time )
			before = true
		
		self.events[ dId ] = day
		day.el = hello.template.getElement( 'day-separator-tmpl', day )
		
		if ( before ) {
			self.eventOrder.unshift( day )
			self.days.unshift( dId )
			const first = self.eventOrder[ 0 ]
			self.container.insertBefore( day.el, first.el )
		} else {
			self.eventOrder.push( day )
			self.days.push( dId )
			self.container.appendChild( day.el )
		}
		
		console.log( 'day', {
			day    : day,
			before : before
		})
		
		//self.container.insertBefore( day.el, beforeEl );
		//await waitLol()
		return day
		
		function waitLol() {
			return new Promise( resolve => {
				window.setTimeout( resolve, 5 );
			});
		}
	}
	
	ns.MsgBuilder.prototype.removeDay = function( dayId ) {
		const self = this
		const day = self.event[ dayId ]
		if ( null == day )
			return
		
		const del = day.el
		delete self.event[ dayId ]
		
		// remove from days
		
		// remove from eventOrder
		
		del.parentNode.removeChild( del )
	}
	
	ns.MsgBuilder.prototype.updateDayDisplay = function() {
		const self = this;
		self.days.forEach( dId => {
			const day = self.events[ dId ]
			console.log( 'day', day )
			const timeStr = self.getDayString( day.time )
			day.el.querySelector( '.day-date' )
				.textContent = timeStr
		})
	}
	
	ns.MsgBuilder.prototype.parseTime = function( timestamp ) {
		const self = this
		const tiktok = {
			time       : self.getClockStamp( timestamp ),
			date       : self.getDateStamp( timestamp ),
			dayId      : self.getDayId( timestamp ),
			timestamp  : timestamp,
		}
		
		return tiktok
	}
	
	ns.MsgBuilder.prototype.getDayId = function( timestamp ) {
		const self = this
		const time = new Date( timestamp )
		const midnightStamp = time.setHours( 0, 0, 0, 0 )
		const id = 'day-' + midnightStamp
		return id
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
	
	ns.MsgBuilder.prototype.getDayNumeric = function( time ) {
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
	
	ns.MsgBuilder.prototype.getDayString = function( timestamp ) {
		const self = this;
		const today = new Date()
		console.log( 'getDS today', today )
		const isToday = false
		const isYesterday = false
		if ( isToday )
			return View.i18n( 'i18n_today' );
		
		if ( isYesterday )
			return View.i18n( 'i18n_yesterday' );
		
		return today.toLocaleDateString()
	}
	
	ns.MsgBuilder.prototype.updateRelationState = function( relations ) {
		const self = this;
		// used for private convos, implemented in PrivateMsgBuilder
	}
	
	ns.MsgBuilder.prototype.handleRemove = async function( event ) {
		const self = this;
		const msg = event.data;
		const mId = msg.msgId;
		const el = window.document.getElementById( mId );
		if ( null == el )
			return;
		
		//const prevEl = el.previousElementSibling;
		const currGroup = el.classList.contains( 'msg-group' );
		const nextEl = el.nextElementSibling;
		remove( el );
		if ( null == nextEl )
			return;
		
		const nextGroup = nextEl.classList.contains( 'msg-group' );
		if ( nextGroup )
			return;
		
		if ( !currGroup )
			return;
		
		const nextId = nextEl.id;
		await self.rebuildMessage( nextId );
		
		function remove( el ) {
			const envEl = el.parentNode;
			el.parentNode.removeChild( el );
			if ( envEl.children.length > 1 )
				return;
			
			const envId = envEl.id;
			self.removeDay( envId );
		}
		
		/*
		function getUserIdFor( msgEl ) {
			const cl = msgEl.classList;
			let uId = null;
			cl.forEach( c => {
				if ( null != uId )
					return;
				
				const idx = c.indexOf( 'acc-' );
				console.log( 'getUserIdFor - checking', [ c, idx ]);
				if ( -1 == idx )
					return false;
				
				uId = c;
				return true;
			});
			
			return uId;
		}
		*/
	}
	
	ns.MsgBuilder.prototype.rebuildMessage = async function( msgId ) {
		const self = this;
		const currEl = window.document.getElementById( msgId );
		if ( null == currEl )
			return false;
		
		let msgConf = null;
		const get = {
			type : 'msg-get',
			data : {
				msgId : msgId,
			},
		};
		try {
			msgConf = await self.conn.request( get );
		} catch( ex ) {
			console.log( 'view.presence.MSgBuilder.handleRemove - get msg ex', ex );
			return;
		}
		
		if ( null == msgConf )
			return;
		
		const conf = {
			inGroup : false,
			event   : msgConf.data,
		};
		const freshEl = self.buildMsg( conf, true );
		currEl.parentNode.insertBefore( freshEl, currEl );
		currEl.parentNode.removeChild( currEl );
		
		self.bindItem( msgId );
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
		// used in private convos, implemented in PrivateMsgBuilder
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
			const ok = self.addConfirmExtInfo( msgId, timestamp );
			if ( !ok )
				return;
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
			const el = hello.template.getElement( 'confirm-state-tmpl', conf );
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
			const el = hello.template.getElement( 'confirm-state-inline-tmpl', conf );
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
			return false;
		
		const extEl = msgEl.querySelector( '.extended-info' );
		if ( null == extEl )
			return false;
		
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
		cInfoEl = hello.template.getElement( 'confirm-info-tmpl', conf );
		
		extEl.appendChild( cInfoEl );
		return true;
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
		emojiiMap,
		onemojii
	) {
		const self = this;
		
		self.parentId = parentId;
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
		self.el = hello.template.getElement( 'emojii-panel-tmpl', conf );
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
			const itemEl = hello.template.getElement( 'emojii-item-tmpl', { itml : value });
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
		onFetch
	) {
		const self = this;
		self.parentId = parentId;
		self.messagesId = messagesId;
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
		self.info = hello.template.getElement( 'log-fetch-tmpl', infoConf );
		self.messages.appendChild( self.info );
		self.infoFetch = self.info.querySelector( '.log-fetch-msg' );
		self.infoNone = self.info.querySelector( '.log-no-logs' );
		self.infoHeight = self.info.clientHeight;
		
		//bind
		self.parent.addEventListener( 'wheel', checkTop, true );
		self.parent.addEventListener( 'touchend', checkTop, false );
		self.messages.addEventListener( 'scroll', checkTop, false );
		function checkTop( e ) {
			//e.stopPropagation();
			self.lastScrollEvent = e;
			if ( null != self.checkTimeout )
				return;
			
			self.checkTimeout = window.setTimeout( check, 200 );
			function check() {
				self.checkTimeout = null;
				self.checkIsScrolledUp( self.lastScrollEvent );
			}
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
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.containerId = containerId;
		self.users = users;
		self.userId = userId;
		
		self.userLive = false;
		self.peerIdMap = {};
		self.peerList = [];
		
		self.init();
	}
	
	ns.LiveStatus.prototype = Object.create(
		library.component.EventEmitter.prototype );
	
	// Public
	
	ns.LiveStatus.prototype.update = function( userList ) {
		const self = this;
		userList = userList || [];
		userList = userList
			.filter( uId => null != uId );
		
		const currIds = Object.keys( self.peerIdMap );
		const remove = currIds.filter( cId => isNotInList( cId, userList ));
		remove.forEach( uId => self.removePeer( uId ));
		userList.forEach( uId => self.addPeer( uId ));
		
		function isNotInList( cId, list ) {
			return !list.some( lId => lId === cId );
		}
	}
	
	ns.LiveStatus.prototype.setLiveAllowed = function( isAllowed ) {
		const self = this
		if ( self.userLive )
			isAllowed = true
		
		self.allowLive = isAllowed
		const reason = window.View.i18n( 'i18n_you_are_in_another_live_call' )
		self.videoBtn.classList.toggle( 'disabled', !isAllowed )
		self.audioBtn.classList.toggle( 'disabled', !isAllowed )
		if ( !isAllowed ) {
			self.videoBtn.setAttribute( 'title', reason )
			self.audioBtn.setAttribute( 'title', reason )
		} else {
			self.videoBtn.removeAttribute( 'title' )
			self.audioBtn.removeAttribute( 'title' )
		}
	}
	
	ns.LiveStatus.prototype.close = function() {
		const self = this;
		if ( self.users && self.stateEventId )
			self.users.off( self.stateEventId );
		
		if ( self.el && self.el.parentNode )
			self.el.parentNode.removeChild( self.el );
		
		self.closeEventEmitter();
		
		delete self.el;
		delete self.audioBtn;
		delete self.audioIcon;
		delete self.videoBtn;
		delete self.videoIcon;
		delete self.peers;
		delete self.peerCount;
		delete self.peerList;
		delete self.peerIdMap;
		
		delete self.users;
		delete self.userId;
		delete self.containerId;
	}
	
	// Private
	
	ns.LiveStatus.prototype.init = function() {
		const self = this;
		
		// build
		self.peers = friendUP.tool.uid( 'peers' );
		self.peerCount = friendUP.tool.uid( 'count' );
		const elConf = {
			peersId : self.peers,
			peerCountId : self.peerCount,
		};
		self.el = hello.template.getElement( 'live-status-tmpl', elConf );
		const container = document.getElementById( self.containerId );
		container.appendChild( self.el );
		self.videoBtn = self.el.querySelector( '.live-status-icon.video' );
		self.audioBtn = self.el.querySelector( '.live-status-icon.audio' );
		self.videoIcon = self.videoBtn.querySelector( 'i' );
		self.audioIcon = self.audioBtn.querySelector( 'i' );
		self.peers = document.getElementById( self.peers );
		self.peerCount = document.getElementById( self.peerCount );
		
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
			self.emit( 'show', type );
			return;
		}
		
		self.emit( 'join', type );
	}
	
	ns.LiveStatus.prototype.handleLive = function( event ) {
		const self = this;
		if ( 'live' !== event.state )
			return;
		
		const uId = event.userId;
		const isLive = event.isSet;
		if ( null == uId ) {
			console.trace( 'LiveStatus.handleLive - no peer id', event );
			return;
		}
		
		if ( isLive )
			self.addPeer( uId );
		else
			self.removePeer( uId );
	}
	
	ns.LiveStatus.prototype.addPeer = async function( userId ) {
		const self = this;
		if ( self.peerIdMap[ userId ])
			return;
		
		const peerId = friendUP.tool.uid( 'peer' );
		self.peerIdMap[ userId ] = peerId;
		const avatarKlass = await self.users.getAvatarKlass( userId );
		const peer = {
			id          : peerId,
			avatarKlass : avatarKlass,
		};
		const peerEl = hello.template.getElement( 'live-status-peer-tmpl', peer );
		self.peers.insertBefore( peerEl, self.peerCount );
		self.peerList.push( peerId );
		if ( userId === self.userId )
			self.setUserLive( true )
		
		self.updateIconState();
		self.updateStacking();
		
		//self.updateVisibility();
		 window.setTimeout( show, 1 );
		 function show() {
			peerEl.classList.toggle( 'invisible', false );
		 }
	}
	
	ns.LiveStatus.prototype.removePeer = function( userId ) {
		const self = this;
		let peerId = self.peerIdMap[ userId ];
		if ( !peerId )
			return;
		
		delete self.peerIdMap[ userId ];
		const el = document.getElementById( peerId );
		el.parentNode.removeChild( el );
		const pIdx = self.peerList.indexOf( peerId );
		self.peerList.splice( pIdx, 1 );
		if ( userId === self.userId )
			self.setUserLive( false )
		
		self.updateIconState();
		self.updateStacking();
		
		//self.updateVisibility();
	}
	
	ns.LiveStatus.prototype.setUserLive = function( isLive ) {
		const self = this
		self.userLive = isLive;
		if ( self.userLive && !self.allowLive )
			self.setLiveAllowed( true );
			
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
	
	ns.LiveStatus.prototype.updateStacking = function() {
		const self = this;
		const num = self.peerList.length;
		
		let stacking = 'loose';
		let hideNum = 0;
		if ( num > 2 )
			stacking = 'tight';
		if ( num > 4 ) {
			stacking = 'plus';
			hideNum = num - 4;
		}
		
		const curr = self.currentStacking;
		// has stacking, different from new stacking
		if (( null != curr ) && ( curr !== stacking )) {
			// remove current
			self.peers.classList.toggle( curr, false );
			
			// change from plus, unhide all
			if ( 'plus' === curr )
				self.peerList.forEach( pId => {
					const el = document.getElementById( pId );
					el.classList.toggle( 'hidden', false );
				});
		}
		
		self.currentStacking = stacking;
		self.peers.classList.toggle( self.currentStacking, true );
		self.peerCount.classList.toggle( 'hidden', !hideNum );
		if ( !hideNum )
			return;
		
		self.peerCount.textContent = '+' + hideNum;
		const showToIndex = ( num - hideNum ) - 1;
		self.peerList.forEach(( pId, index ) => {
			const el = document.getElementById( pId );
			const hide = index > showToIndex;
			el.classList.toggle( 'hidden', hide );
		});
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
