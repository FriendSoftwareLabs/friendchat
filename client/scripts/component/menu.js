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
library.component = library.component || {};

// Menu
(function( ns, undefined ) {
	ns.Menu = function( conf ) {
		if ( !( this instanceof ns.Menu ))
			return new ns.Menu( conf );
		
		library.component.EventEmitter.call( this );
		
		var self = this;
		self.id = conf.id || friendUP.tool.uid( 'menu' );
		self.parentId = conf.parentId;
		self.menuConf = conf.content;
		self.onnolistener = conf.onnolistener;
		self.onhide = conf.onhide;
		self.onclose = conf.onclose;
		self.onupdate = conf.onupdate;
		self.baseTmplId = conf.baseTmplId || 'menu-container-tmpl';
		self.folderTmplId = conf.folderTmplId || 'menu-folder-tmpl';
		self.itemFolderTmplId = conf.itemFolderTmplId || 'menu-item-folder-tmpl';
		self.itemTmplId = conf.itemTmplId || 'menu-item-tmpl';
		self.template = conf.templateManager; // is expected to be preloaded with relevant fragments
		
		self.contentId = null;
		
		self.folders = {};
		self.items = {};
		self.tree = [];
		self.rootId = null;
		self.currentFolder = null;
		self.parentFolder = null;
		self.navTop = false;
		self.navPrev = false;
		
		self.init();
	}
	
	ns.Menu.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// public
	
	// show the menu
	ns.Menu.prototype.show = function( id ) {
		var self = this;
		if ( !id )
			id = self.rootId;
		
		self.switchToFolder( id );
	}
	
	// hide ( 'close' ) the menu
	ns.Menu.prototype.hide = function() {
		var self = this;
		self.onhide();
		self.switchToFolder( self.rootId );
	}
	
	// show a hidden item
	ns.Menu.prototype.enable = function( id ) {
		var self = this;
		self.toggleItem( id, true );
	}
	
	// hide an item
	ns.Menu.prototype.disable = function( id ) {
		var self = this;
		self.toggleItem( id, false );
	}
	
	ns.Menu.prototype.setState = function( id, isOn ) {
		var self = this;
		self.toggleToggle( id, isOn );
	}
	
	ns.Menu.prototype.update = function( id, newName ) {
		var self = this;
		var folder = self.folders[ id ];
		var item = self.items[ id ];
		if ( folder )
			updateFolder( folder, newName );
		
		if ( item )
			updateItem( item, newName );
		
		function updateFolder( folder, name ) {
			folder.name = name;
			if ( self.currentFolder === id )
				self.updateMenuHead();
		}
		
		function updateItem( item, name ) {
			item.name = name;
			var el = document.getElementById( item.elId );
			var nameEl = el.querySelector( '.menu-item-name' );
			nameEl.textContent = newName;
		}
	}
	
	ns.Menu.prototype.add = function( item, parentId, beforeId ) {
		var self = this;
		if ( !parentId )
			parentId = self.rootId;
		
		if ( 'folder' === item.type )
			addFolder( item, parentId, beforeId );
		else
			self.addItem( item, parentId, beforeId );
		
		function addFolder( item, pId, bId ) {
			self.addFolder( item, pId, bId );
			self.addItem( item, pId, bId );
			if ( item.items && item.items.length )
				self.buildMenu( item.items, item.id );
		}
	}
	
	ns.Menu.prototype.remove = function( id ) {
		var self = this;
		self.off( id );
		
		var item = self.items[ id ];
		if ( item )
			removeItem( item );
		
		function removeItem( item ) {
			var el = document.getElementById( item.elId );
			remove( el );
			
			if ( 'folder' === item.type ) {
				item.items.forEach( removeSub );
				removeFolder( item.id );
			}
			
			function removeSub( item ) {
				self.remove( item.id );
			}
		}
		
		function removeFolder( id ) {
			var folder = self.folders[ id ];
			if ( !folder )
				return;
			
			var el = document.getElementById( folder.elId );
			remove( el );
		}
		
		function remove( el ) {
			if ( !el || !el.parentNode )
				return;
			
			el.parentNode.removeChild( el );
		}
	}
	
	ns.Menu.prototype.close = function() {
		const self = this;
		delete self.template;
		self.release();
	}
	
	// private
	
	ns.Menu.prototype.init = function() {
		var self = this;
		self.contentId = friendUP.tool.uid( 'menu-content' );
		
		self.build();
		self.bind();
		self.setMenu();
	}
	
	ns.Menu.prototype.build = function() {
		var self = this;
		const conf = {
			id        : self.id,
			contentId : self.contentId,
		};
		var element = self.template.getElement( self.baseTmplId, conf );
		var parent = document.getElementById( self.parentId );
		if ( !parent )
			throw new Error( 'library.component.Menu.build - parent not found' );
		
		parent.appendChild( element );
	}
	
	ns.Menu.prototype.setMenu = function() {
		var self = this;
		self.addTopMenu();
		self.buildMenu( self.menuConf, null );
		self.show();
	}
	
	ns.Menu.prototype.addTopMenu = function() {
		var self = this;
		self.rootId = buildTopId();
		var item = {
			type   : 'folder',
			id     : self.rootId,
			faIcon : '',
			name   : '',
			items  : self.menuConf,
		};
		
		self.menuConf = [ item ];
		
		function buildTopId() {
			var id = friendUP.tool.uid( 'top' );
			var parts = id.split( '-' );
			parts.pop();
			parts.pop();
			return parts.join( '-' );
		}
	}
	
	ns.Menu.prototype.buildMenu = function( content, parentId ) {
		var self = this;
		content.forEach( add );
		function add( item ) {
			if ( 'folder' === item.type ) {
				addFolder( item );
			} else
				addItem( item );
			
			function addFolder( item ) {
				self.addFolder( item, parentId );
				self.addItem( item, parentId );
				if ( item.items && item.items.length )
					self.buildMenu( item.items, item.id );
			}
			
			function addItem( item ) {
				self.addItem( item, parentId );
			}
		}
	}
	
	ns.Menu.prototype.addFolder = function( item, parentId, beforeId ) {
		var self = this;
		if ( self.folders[ item.id ]) {
			throw new Error( 'Menu.addFolder - id already in use: ' + item.id );
			return;
		}
		
		var folderId = friendUP.tool.uid( item.id );
		var folder = {
			id   : item.id,
			elId : folderId,
			pId  : parentId,
		};
		var el = self.template.getElement( self.folderTmplId, folder );
		self.insertElement( el, self.contentId, null );
		self.folders[ item.id ] = folder;
	}
	
	ns.Menu.prototype.addItem = function( item, folderId, beforeId ) {
		var self = this;
		if ( self.items[ item.id ]) {
			throw new Error( 'Menu.addItem - id alread used: ' + item.id );
			return;
		}
		
		self.items[ item.id ] = item;
		if ( !folderId )
			return;
		
		var elId = friendUP.tool.uid( item.id );
		item.elId = elId;
		item.fId = folderId || null;
		var tmplId = 'folder' === item.type ? self.itemFolderTmplId : self.itemTmplId;
		var el = self.template.getElement( tmplId, item );
		var folder = self.folders[ folderId ];
		var fElId = folder.elId;
		/*
		beforeId = 'folder' === item.type ?
			self.getFolderBeforeId( folder.elId, beforeId ) :
			( beforeId || null );
		*/
		self.insertElement( el, fElId, beforeId );
		if ( null != item.toggle )
			self.toggleToggle( item.id, item.toggle );
		
		if ( item.disable )
			self.toggleItem( item.id, false );
		
		self.bindItem( item );
	}
	
	ns.Menu.prototype.getFolderBeforeId = function( parentId, beforeId ) {
		var self = this;
		var itemId = getFirstItemId( parentId );
		if ( !beforeId )
			return itemId;
		
		return itemId;
		
		function getFirstItemId( parentId ) {
			var children = document.getElementById( parentId ).children;
			if ( !children.length )
				return null;
			
			var itemId = null;
			Array.prototype.some.call( children, isNotFolder );
			return itemId;
			
			function isNotFolder( item ) {
				if ( !!item.classList.contains( 'menu-item-folder' ))
					return false;
				
				itemId = item.id;
				return true;
			}
		}
	}
	
	ns.Menu.prototype.removeFolder = function( id ) {
		var self = this;
		console.log( 'removeFolder', id );
	}
	
	ns.Menu.prototype.removeItem = function( id ) {
		var self = this;
		console.log( 'removeItem', id );
		var item = self.items[ id ];
		if ( !item )
			return;
	}
	
	ns.Menu.prototype.insertElement = function( el, containerId, beforeId ) {
		var self = this;
		var before = null;
		var container = document.getElementById( containerId );
		
		if ( beforeId )
			before = document.getElementById( beforeId );
		
		if ( before )
			container.insertBefore( el, before );
		else
			container.appendChild( el );
	}
	
	ns.Menu.prototype.bind = function() {
		var self = this;
		var element = document.getElementById( self.id );
		var nav = element.querySelector( '.menu-navigation' );
		self.topBtn = nav.querySelector( '.menu-nav-top' );
		self.prevBtn = nav.querySelector( '.menu-nav-prev' );
		var closeBtn = nav.querySelector( '.menu-nav-close' );
		self.currentFolderEl = nav.querySelector( '.menu-nav-current' );
		
		self.topBtn.addEventListener( 'click', topClick, false );
		self.prevBtn.addEventListener( 'click', prevClick, false );
		closeBtn.addEventListener( 'click', hideClick, false );
		
		function topClick( e ) {
			if ( !self.navTop )
				return;
			
			self.switchToFolder( self.rootId );
		}
		
		function prevClick( e ) {
			if ( !self.parentFolder || !self.navPrev )
				return;
			
			self.switchToFolder( self.parentFolder );
		}
		
		function hideClick( e ) {
			self.hide();
		}
		
		self.on( 'nolistener', onNoListener );
		function onNoListener( e ) { self.onnolistener( e ); }
	}
	
	ns.Menu.prototype.bindItem = function( item ) {
		var self = this;
		var id = item.id;
		var conf = self.items[ id ];
		var el = document.getElementById( conf.elId );
		
		if ( 'folder' === item.type )
			el.addEventListener( 'click', folderClick, false );
		else
			el.addEventListener( 'click', itemClick, false );
		
		function folderClick( e ) { self.switchToFolder( id ); }
		function itemClick( e ) { self.itemClicked( id ); }
	}
	
	ns.Menu.prototype.scrollToTop = function() {
		var self = this;
		var container = document.getElementById( self.contentId );
		var parent = container.parentNode;
		parent.scrollTop = 0;
	}
	
	ns.Menu.prototype.switchToFolder = function( toId ) {
		var self = this;
		var folder = self.folders[ toId ];
		if ( !folder ) {
			console.log( 'Menu.switchToFolder - folder not found for id', toId );
			return;
		}
		
		self.scrollToTop();
		
		// already in the correct place
		if ( toId === self.folderFolder )
			return;
		
		// step up - parent becomess current
		if ( toId === self.parentFolder ) {
			clearCurrent();
			set( folder );
			return;
		}
		
		// step down - current becomes parent
		if ( folder.pId === self.currentFolder ) {
			clearParent();
			set( folder );
			return;
		}
		
		// switch to sibling
		if ( folder.pId === self.parentFolder ) {
			clearCurrent();
			set( folder );
			return;
		}
		
		// more than one level away
		clearAndSet( folder );
		
		// done - implementation details follow
		
		function clearAndSet( cur ) {
			clearCurrent();
			clearParent();
			set( cur );
		}
		
		function set( cur ) {
			setParent( cur );
			setCurrent( cur );
			self.updateNavButtons();
		}
		
		function setParent( current ) {
			if ( !current.pId )
				return; // current is at top
			
			self.parentFolder = current.pId;
			var el = self.toggleFolder( current.pId, true );
			toggleCurrent( el, false );
			toggleParent( el, true );
		}
		
		function setCurrent( current ) {
			var id = current.id;
			self.isAtTop = ( id === self.rootId ) ? true : false;
			self.currentFolder = id;
			var el = self.toggleFolder( id, true );
			toggleParent( el, false );
			toggleCurrent( el, true );
			self.updateMenuHead();
		}
		
		function clearCurrent() {
			if ( !self.currentFolder )
				return;
			
			var el = self.toggleFolder( self.currentFolder, false );
			toggleCurrent( el, false );
			self.currentFolder = null;
		}
		
		function clearParent() {
			if ( !self.parentFolder )
				return;
			
			var el = self.toggleFolder( self.parentFolder, false );
			toggleParent( el, false );
			self.parentFolder = null;
		}
		
		function toggleParent( el, isPrev ) {
			if ( !el )
				return;
			
			el.classList.toggle( 'menu-parent-folder', isPrev );
		}
		
		function toggleCurrent( el, isCurr ) {
			if ( !el )
				return;
			
			el.classList.toggle( 'menu-current-folder', isCurr );
		}
	}
	
	ns.Menu.prototype.updateNavButtons = function() {
		var self = this;
		var folder = self.folders[ self.currentFolder ];
		if ( !folder.pId ) {
			disableBoth();
			return;
		}
		
		if ( folder.pId === self.rootId ) {
			showOneUp();
			return;
		} else
			showBoth();
			
		function disableBoth() {
			self.navTop = false;
			self.navPrev = false;
			applyState();
		}
		
		function showOneUp() {
			self.navTop = false;
			self.navPrev = true;
			applyState();
		}
		
		function showBoth() {
			self.navTop = true;
			self.navPrev = true;
			applyState();
		}
		
		function applyState() {
			self.topBtn.classList.toggle( 'disable', !self.navTop );
			self.prevBtn.classList.toggle( 'disable', !self.navPrev );
		}
	}
	
	ns.Menu.prototype.itemClicked = function( id, state ) {
		var self = this;
		var conf = self.items[ id ];
		if ( true === conf.close || ( null == conf.close ) ) // default is to close menu on click
			self.hide();
		
		self.emit( id, state );
	}
	
	ns.Menu.prototype.updateMenuHead = function() {
		var self = this;
		var item = self.items[ self.currentFolder ];
		self.currentFolderEl.textContent = item.name;
	}
	
	ns.Menu.prototype.toggleFolder = function( id, show ) {
		var self = this;
		var conf = self.folders[ id ];
		if ( !conf ) {
			console.log( 'toggleFolder - no folder for id', {
				id : id,
				show : show,
				conf : conf,
				folders : self.folders
			});
			return;
		}
		
		var el = document.getElementById( conf.elId );
		return el;
		
		if ( !el ) {
			console.log( 'Menu.toggleFolder - no element for', conf );
			return;
		}
		
		el.classList.toggle( 'hidden', !show );
		return el;
	}
	
	ns.Menu.prototype.toggleItem = function( id, enable ) {
		var self = this;
		var item = self.getItem( id );
		if( item )
		{
			var el = document.getElementById( item.elId );
			el.classList.toggle( 'hidden', !enable );
		}
	}
	
	ns.Menu.prototype.toggleToggle = function( id, isOn ) {
		var self = this;
		var item = self.getItem( id );
		var el = self.getElement( item.elId );
		var toggle = el.querySelector( '.menu-item-post.toggle' );
		toggle.classList.toggle( 'hidden', false );
		var icon = toggle.querySelector( 'i' );
		icon.classList.toggle( 'fa-toggle-off', !isOn );
		icon.classList.toggle( 'fa-toggle-on', isOn );
	}
	
	ns.Menu.prototype.getItem = function( id ) {
		var self = this;
		var item = self.items[ id ];
		if ( !item ) {
			console.log( 'Menu.getItem - no item for id', { id : id, items : self.items });
			//throw new Error( 'Menu.getItem failed, here is your stack trance, sir.');
			return false;
		}
		return item;
	}
	
	ns.Menu.prototype.getElement = function( elId ) {
		var self = this;
		var el = document.getElementById( elId );
		if ( !el ) {
			console.log( 'Menu.getElement - no element found for item', item );
			throw new Error( 'Menu.getElement failed, here is your stack trance, sir.');
		}
		
		return el;
	}
	
})( library.component );
