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

library.component = library.component || {};


// FormOverlay
// load and result screen for form submits
( function( ns, undefined ) {
	ns.FormOverlay = function( parentId ) {
		if ( !( this instanceof ns.FormOverlay ))
			return new ns.FormOverlay( parentId );
		
		if ( !hello.template )
			throw new Error( 'hello.template not defined' );
		
		var self = this;
		self.parentId = parentId || 'form';
		self.templateId = 'form-overlay-tmpl';
		self.overlayId = 'form-overlay';
		self.parent = null;
		self.element = null;
		self.msgContainer = null;
		self.init();
	}
	
	ns.FormOverlay.prototype.init = function() {
		var self = this;
		self.parent = document.getElementById( self.parentId );
		self.build();
	}
	
	ns.FormOverlay.prototype.build = function() {
		var self = this;
		var overlayElement = hello.template.getElement( self.templateId );
		self.parent.appendChild( overlayElement );
		self.bind();
	}
	
	ns.FormOverlay.prototype.bind = function() {
		var self = this;
		self.element = document.getElementById( self.overlayId );
		self.msgContainer = self.element.querySelector( '.message-container' );
		self.spinner = self.element.querySelector( '.spinner' );
	}
	
	ns.FormOverlay.prototype.show = function() {
		var self = this;
		self.msgContainer.innerHTML = '';
		self.msgContainer.classList.toggle( 'hidden', true );
		self.spinner.classList.toggle( 'hidden', false );
		self.element.classList.toggle( 'hidden', false );
		self.element.focus();
	}
	
	ns.FormOverlay.prototype.hide = function() {
		var self = this;
		self.element.classList.toggle( 'hidden', true );
	}
	
	ns.FormOverlay.prototype.success = function( msg, callback ) {
		var self = this;
		self.clickBack = callback;
		var tmplConf = {
			type : 'success',
			typeText : 'Success!',
			message : msg || '',
			buttonClass : 'accept',
		};
		self.showMessage( tmplConf );
	}
	
	ns.FormOverlay.prototype.error = function( msg, callback ) {
		var self = this;
		self.clickBack = callback;
		var tmplConf = {
			type : 'error',
			typeText : 'Ohnoes!',
			message : msg || 'so bad, much unfortuante',
			buttonClass : 'danger',
		};
		self.showMessage( tmplConf );
	}
	
	ns.FormOverlay.prototype.showMessage = function( msgConf ) {
		var self = this;
		var message = hello.template.getElement( 'form-overlay-message-tmpl', msgConf );
		self.spinner.classList.add( 'hidden' );
		self.msgContainer.appendChild( message );
		self.msgContainer.classList.remove( 'hidden' );
		self.element.classList.toggle( 'hidden', false );
		
		var button = self.msgContainer.querySelector( 'button' );
		button.addEventListener( 'click', okidoki, false );
		button.focus();
		function okidoki( e ) {
			e.preventDefault();
			self.hide();
			self.clickBack();
		}
	}
	
})( library.component );


// OPTION  MENY
(function( ns, undefined ) {
	ns.OptionMenu = function( conf ) {
		if ( !( this instanceof ns.OptionMenu ))
			return new ns.OptionMenu( conf );
		
		var self = this;
		self.buttonParentId = conf.buttonParentId;
		self.options = conf.options;
		self.order = conf.order;
		self.menuParentId = conf.menuParentId || null;
		self.title = conf.title || 'options';
		
		self.buttonId = friendUP.tool.uid( 'option-button' );
		self.menu = friendUP.tool.uid( 'option-menu' );
		self.menuOptions = null;
		self.init();
	};
	
	ns.OptionMenu.prototype.init = function() {
		var self = this;
		self.build();
		self.setMenu();
	};
	
	ns.OptionMenu.prototype.build = function() {
		var self = this;
		var buttonContainer = document.getElementById( self.buttonParentId );
		if ( !buttonContainer )
			throw new Error( 'could not ' + self.buttonParentId );
		
		if ( self.parent )
			var menuContainer = document.getElementById( self.menuParentId );
		else
			var menuContainer = document.body;
		
		var menuContainerStyle = friendUP.tool.getCssValue( menuContainer, 'position' );
		
		var fragments = hello.template.getFragment( 'option-menu-tmpl', {
			buttonId : self.buttonId,
			menuId : self.menu,
			title : self.title,
		});
		
		var buttonFragment = fragments.querySelector( '.button' );
		var menuFragment = fragments.querySelector( '.option-menu-container' );
		
		buttonContainer.appendChild( buttonFragment );
		menuContainer.appendChild( menuFragment );
		
		self.menu = document.getElementById( self.menu );
		self.menuOptions = self.menu.querySelector( '.option-menu' );
		
		self.bind();
	}
	
	ns.OptionMenu.prototype.bind = function() {
		var self = this;
		var button = document.getElementById( self.buttonId );
		
		button.addEventListener( 'click', showMenu, false );
		self.menu.addEventListener( 'click', menuBodyClick, false )
		
		function showMenu( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.show( e );
		}
		
		function menuBodyClick( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.hide();
		}
	}
	
	ns.OptionMenu.prototype.setMenu = function() {
		var self = this;
		var container = self.menu.querySelector( '.menu-items' );
		var order = self.order || Object.keys( self.options );
		order.forEach( build );
		
		function build( id ) {
			var item = self.options[ id ];
			var conf = {
				faIconClass : item.faIconClass,
				description : item.description,
			};
			var element = hello.template.getElement( 'option-menu-item-tmpl', conf );
			element.addEventListener( 'click', click, false );
			container.appendChild( element );
			
			function click( e ) {
				e.preventDefault();
				e.stopPropagation();
				item.handler();
				self.hide();
			}
		}
	}
	
	ns.OptionMenu.prototype.show = function( event ) {
		var self = this;
		if ( event )
			setPos( event.pageY );
		
		show();
		
		function setPos( fromTop ) {}
		function show() { self.menu.classList.toggle( 'show', true ); }
	}
	
	ns.OptionMenu.prototype.hide = function() {
		var self = this;
		self.menu.classList.toggle( 'show', false );
	}
	
})( library.component );


// STATUSINDICATOR
(function( ns, undefined) {
	ns.StatusIndicator = function( conf ) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.containerId = conf.containerId;
		self.type = conf.type;
		self.cssClass = conf.cssClass;
		self.inner = null;
		self.statusMap = conf.statusMap;
		self.state = 'hamsters';
		
		self.initIndicator();
	}
	
	ns.StatusIndicator.prototype = Object.create( 
		library.component.EventEmitter.prototype );
	
	ns.StatusIndicator.prototype.typeTmplMap = {
		'led' : 'status-indicator-led-tmpl',
		'icon' : 'status-indicator-icon-tmpl',
	};
	
	// Public
	
	ns.StatusIndicator.prototype.close = function() {
		const self = this;
		if ( self.el && self.el.parentNode )
			self.el.parentNode.removeChild( self.el );
		
		delete self.inner;
		delete self.el;
	}
	
	ns.StatusIndicator.prototype.set = function( stateKey ) {
		const self = this;
		self.setState( stateKey );
	}
	
	ns.StatusIndicator.prototype.get = function() {
		const self = this;
		return self.getState();
	}
	
	ns.StatusIndicator.prototype.show = function() {
		const self = this;
		const el = document.getElementById( self.containerId );
		el.classList.toggle( 'hidden', false );
	}
	
	ns.StatusIndicator.prototype.hide = function() {
		const self = this;
		const el = document.getElementById( self.containerId );
		el.classList.toggle( 'hidden', true );
	}
	
	// Private
	
	ns.StatusIndicator.prototype.initIndicator = function() {
		const self = this;
		if ( !hello.template )
			throw new Error( 'hello.template not defined' );
		
		const container = document.getElementById( self.containerId );
		if ( !container ) {
			console.log(
				'StatusIndicator.initIndicator - could not find element for id:',
				self.containerId
			);
			return;
		}
		
		if ( 'icon' === self.type )
			self.buildIconIndicator( container );
		else
			self.buildLEDIndicator( container );
		
		const stateKeys = Object.keys( self.statusMap );
		self.state = stateKeys[ 0 ];
		self.inner.classList.add( self.statusMap[ self.state ]);
		self.el.addEventListener( 'click', elClick, false );
		function elClick( e ) {
			const handled = self.emit( 'click' );
			if ( handled ) {
				e.preventDefault();
				e.stopPropagation();
			}
		}
	}
	
	ns.StatusIndicator.prototype.buildIconIndicator = function( container ) {
		const self = this;
		const tmplId = self.typeTmplMap[ 'icon' ];
		const conf = {
			faClass : self.cssClass,
		};
		self.el = hello.template.getElement( tmplId, conf );
		container.appendChild( self.el );
		self.bindIconIndicator( container );
	}
	
	ns.StatusIndicator.prototype.buildLEDIndicator = function( container ) {
		const self = this;
		const tmplId = self.typeTmplMap[ 'led' ];
		const conf = {
			ledShapeClass : self.cssClass,
		};
		self.el = hello.template.getElement( tmplId, conf );
		container.appendChild( self.el );
		self.bindLEDIndicator( container );
	}
	
	ns.StatusIndicator.prototype.bindIconIndicator = function( container ) {
		const self = this;
		self.inner = container.querySelector( '.status-indicator > i' );
	}
	
	ns.StatusIndicator.prototype.bindLEDIndicator = function( container ) {
		const self = this;
		self.inner = container.querySelector( '.status-indicator > div' );
	}
	
	ns.StatusIndicator.prototype.setState = function( stateKey ) {
		const self = this;
		if ( !stateKey ) {
			console.log( 'no statekey', stateKey );
			return;
		}
		
		stateKey = stateKey.toString();
		if ( !self.statusMap[ stateKey ]) {
			console.log( 'statusIndicator.set - unknown state', stateKey );
			return;
		}
		
		self.state = stateKey
		removeCurrentClass();
		addNewStateClass();
		
		function removeCurrentClass() {
			const parts = self.inner.className.split( ' ' );
			parts.pop(); // remove last
			self.inner.className = parts.join( ' ' );
		}
		
		function addNewStateClass() {
			self.inner.classList.add( self.statusMap[ stateKey ]);
		}
	}
	
	ns.StatusIndicator.prototype.getState = function() {
		return this.state;
	}
	
})( library.component );


// Extends StatusIndicator with a display field
(function( ns, undefined ) {
	ns.StatusDisplay = function( conf ) {
		
		var self = this;
		self.display = conf.display || '';
		self.displayArea = null;
		
		ns.StatusIndicator.call( self, conf );
		self.initDisplay();
	}
	
	ns.StatusDisplay.prototype = Object.create( ns.StatusIndicator.prototype );
	ns.StatusDisplay.prototype.typeTmplMap = {
		'led' : 'status-display-led-tmpl',
		'icon' : 'status-display-icon-tmpl',
	};
	
	// public
	
	ns.StatusDisplay.prototype.setDisplay = function( str ) {
		var self = this;
		self.display = str;
		self.displayArea.textContent = str;
	}
	
	// private
	
	ns.StatusDisplay.prototype.initDisplay = function() {
		const self = this;
		const container = document.getElementById( self.containerId );
		self.displayArea = container.querySelector( '.status-display .display-area' );
		self.displayArea.textContent = self.display;
	}
	
	ns.StatusDisplay.prototype.bindIconIndicator = function( container ) {
		const self = this;
		self.inner = container.querySelector( '.status-display .icon-status i' );
	}
	
	ns.StatusDisplay.prototype.bindLEDIndicator = function( container ) {
		const self = this;
		self.inner = container.querySelector( '.status-display .led-status > div' );
	}
	
	
})( library.component );


// BOTTOMSCROLLER
(function( ns, undefined ) {
	ns.BottomScroller = function( elementId, conf  ) {
		const self = this;
		if ( !elementId )
			throw new Error( 'library.component.BottomScroller requires an elementId' );
		
		conf = conf || {};
		
		self.elementId = elementId; // the element being scrolled, as opposed to its
									// viewport / container
		self.scrollAtBottom = true;
		self.scrollTresholdPercent = 25; // percent - used to calculate scrollTreshold.
		                                 // For a static ( pixel ) value, set to 
		                                 // null AND set scrollTreshold to a number
		self.scrollTreshold = null;
		
		self.element = null;
		self.observer = null;
		
		self.init();
	}
	
	// public
	ns.BottomScroller.prototype.update = function() {
		const self = this;
		self.updateScrollTreshold();
		self.scrollToBottom();
	}
	
	// private
	
	ns.BottomScroller.prototype.init = function() {
		const self = this;
		window.addEventListener( 'resize', resizeEvent, false ); 
		self.element = document.getElementById( self.elementId );
		self.element.addEventListener( 'scroll', scrollEvent, false );
		if ( window.ResizeObserver ) {
			self.boxResize = new window.ResizeObserver( resizeEvent );
			self.boxResize.observe( self.element );
		}
		
		function scrollEvent( e ) { self.checkIsAtBottom( e ); }
		function resizeEvent( e ) { self.handleResize(); }
		
		self.observer = new window.MutationObserver( domMutated );
		self.observer.observe( self.element, {
			attributes : true,
			childList  : true,
			subtree    : true,
		});
		function domMutated( e ) {
			self.onMutation( e );
		}
		
		self.updateScrollTreshold();
		self.checkIsAtBottom();
	}
	
	ns.BottomScroller.prototype.handleResize = function( e ) {
		const self = this;
		if ( null != self.resizeTimeout ) {
			window.clearTimeout( self.resizeTimeout );
			self.resizeTimeout = null;
		}
		
		self.resizeTimeout = window.setTimeout( update, 100 );
		function update() {
			self.resizeTimeout = null;
			self.updateScrollTreshold();
			self.scrollToBottom();
		}
	}
	
	ns.BottomScroller.prototype.onMutation = function( mutations ) {
		var self = this;
		self.reposition();
		return;
		
		
		mutations.forEach( handle );
		function handle( mutation ) {
			var isAdded = !!mutation.addedNodes.length;
			if ( isAdded )
				self.bindLoad( mutation.addedNodes );
		}
	}
	
	ns.BottomScroller.prototype.bindLoad = function( nodes ) {
		var self = this;
		nodes.forEach( findLoadyThings );
		function findLoadyThings( node ) {
			var imgs = node.getElementsByTagName( 'img' );
			var vids = node.getElementsByTagName( 'video' );
			
			if ( 'img' === node.tagName )
				push( imgs, node );
			if ( 'video' === node.tagName )
				push( vids, node );
			
			if ( imgs.length )
				bind( imgs, 'load' );
			if ( vids.length )
				bind( vids, 'resize' );
		}
		
		function bind( eles, event ) {
			Array.prototype.forEach.call( eles, addListener );
			function addListener( el ) {
				el.addEventListener( event, handler, false );
				function handler( e ) {
					self.reposition();
					// nesting functions, fick ja
				}
			}
		}
		
		function push( tar, item ) {
			Array.prototype.push.call( tar, item );
		}
	}
	
	ns.BottomScroller.prototype.updateScrollTreshold = function() {
		var self = this;
		var viewport = self.element.parentNode;
		var sH = viewport.scrollHeight;
		var sTP = self.scrollTresholdPercent;
		self.scrollTreshold = ( sH * sTP ) / 100;
	}
	
	ns.BottomScroller.prototype.checkIsAtBottom = function( e ) {
		var self = this;
		var viewport = self.element.parentNode;
		var scrollHeight = self.element.scrollHeight;
		var difference = self.element.scrollTop + viewport.scrollHeight;
		var scrolledFromBottom = scrollHeight - difference;
		if ( scrolledFromBottom < self.scrollTreshold ) {
			self.scrollAtBottom = true;
			if ( scrolledFromBottom < 0 )
				self.reposition();
		}
		else
			self.scrollAtBottom = false;
		
	}
	
	ns.BottomScroller.prototype.reposition = function() {
		var self = this;
		if ( !self.scrollAtBottom )
			return;
		
		self.scrollToBottom();
	}
	
	ns.BottomScroller.prototype.scrollToBottom = function() {
		var self = this;
		self.element.scrollTop = self.element.scrollHeight;
	}
	
})( library.component );

// FOLDIT

(function( ns, undefined ) {
	ns.Foldit = function( conf ) {
		if ( !( this instanceof ns.Foldit ))
			return new ns.Foldit( conf );
		
		var self = this;
		self.folderId = conf.folderId;
		self.foldeeId = conf.foldeeId;
		
		self.setup( conf.startClosed );
	}
	
	ns.Foldit.prototype.up = function() {
		var self = this;
		self.togglePosition( true );
	}
	
	ns.Foldit.prototype.down = function() {
		var self = this;
		self.togglePosition( false );
	}
	
	// PRIVATE
	
	ns.Foldit.prototype.setup = function( startClosed ) {
		var self = this;
		self.folder = document.getElementById( self.folderId );
		self.folder.classList.add( 'foldit');
		
		self.foldee = document.getElementById( self.foldeeId );
		self.foldee.classList.add( 'foldee' );
		
		self.stateContainer = self.folder.querySelector( '.foldit-status' );
		
		self.insertHtml();
		
		self.stateIndicator = self.stateContainer.querySelector( 'i' );
		self.bindEvents();
		
		if ( startClosed )
			self.up();
	}
	
	ns.Foldit.prototype.insertHtml = function() {
		var self = this;
		var element = hello.template.getElement( 'foldit-tmpl' );
		self.stateContainer.appendChild( element );
	}
	
	ns.Foldit.prototype.bindEvents = function() {
		var self = this;
		self.stateIndicator.addEventListener( 'click', fold, false );
		self.folder.addEventListener( 'click', fold, false );
		
		function fold( e ) {
			if( e ) {
				e.preventDefault();
				e.stopPropagation();
			}
			
			self.toggleFold();
		}
	}
	
	ns.Foldit.prototype.toggleFold = function () {
		var self = this;
		if ( isUp() )
			self.down();
		else
			self.up();
		
		function isUp() {
			return self.foldee.classList.contains( 'fold' );
		}
	}
	
	ns.Foldit.prototype.togglePosition = function( setUp ) {
		var self = this;
		self.stateIndicator.classList.toggle( 'fa-rotate-90', setUp );
		self.stateIndicator.classList.toggle( 'fa-rotate-180', !setUp );
		self.foldee.classList.toggle( 'fold', setUp );
	}
	
})( library.component );

//
(function( ns, undefined ) {
	ns.Guide = function( conf ) {
		if ( !( this instanceof ns.Guide ))
			return new ns.Guide( conf );
		
		var self = this;
		self.element = conf.element;
		self.containerId = conf.containerId;
	}
	
	ns.Guide.prototype.show = function() {
		var self = this;
		var exists = document.getElementById( self.element.id );
		if ( exists )
			return;
		
		var container = document.getElementById( self.containerId );
		container.appendChild( self.element );
	}
	
	ns.Guide.prototype.hide = function() {
		var self = this;
		if ( !self.element.parentNode )
			return;
		
		self.element.parentNode.removeChild( self.element );
	}
	
})( library.component );

// INFOBOX
(function( ns, undefined ) {
	ns.InfoBox = function( conf ) {
		if ( !( this instanceof ns.InfoBox ))
			return new ns.InfoBox( conf );
		
		var self = this;
		self.element = conf.element || null;
		self.containerId = conf.containerId;
		
		self.init();
	}
	
	ns.InfoBox.prototype.init = function() {
		var self = this;
		if ( self.element )
			self.show();
	}
	
	// public
	
	ns.InfoBox.prototype.show = function( element, tmplId ) {
		var self = this;
		if ( element && self.element )
			self.remove();
		
		self.element = element || self.element;
		if ( !self.element )
			return;
		
		var exists = document.getElementById( self.element.id );
		if ( exists )
			return;
		
		if ( tmplId )
			self.tmplId = tmplId;
		
		const container = document.getElementById( self.containerId );
		self.toggleSiblings( false );
		container.appendChild( self.element );
		self.setFocus();
	}
	
	ns.InfoBox.prototype.setFocus = function() {
		var self = this;
		var inputs = self.element.querySelectorAll( 'input, button' );
		var firstInput = inputs[ 0 ];
		if ( firstInput )
			firstInput.focus();
	}
	
	ns.InfoBox.prototype.hide = function() {
		var self = this;
		self.remove();
		self.tmplId = null;
		self.toggleSiblings( true );
	}
	
	// private
	
	ns.InfoBox.prototype.isSet = function( elementId ) {
		var self = this;
		var exists = document.getElementById( elementId );
		return !!exists;
	}
	
	ns.InfoBox.prototype.remove = function() {
		var self = this;
		if ( !self.element )
			return;
		
		if ( self.element.parentNode )
			self.element.parentNode.removeChild( self.element );
		
		self.element = null;
	}
	
	ns.InfoBox.prototype.toggleSiblings = function( setVisible ) {
		const self = this;
		const container = document.getElementById( self.containerId );
		const siblings = container.children;
		Array.prototype.forEach.call( siblings, toggle );
		function toggle( element ) {
			element.classList.toggle( 'hidden', !setVisible );
		}
	}
	
})( library.component );


// INPUT HISTORY
// conf = {
//	inputId
//	limit ( optional, default 20 )
// }
// .add( str )
// .clear()
(function( ns, undefined ) {
	ns.InputHistory = function( conf ) {
		if ( !( this instanceof ns.InputHistory ))
			return new ns.InputHistory( conf );
		
		var self = this;
		self.inputId = conf.inputId;
		self.limit = conf.limit || 50;
		self.history = [];
		self.index = 0;
		self.init();
	}
	
	ns.InputHistory.prototype.init = function() {
		var self = this;
		self.actionMap = {
			'ArrowUp'        : maybeShowOlder,
			'shiftArrowUp'   : older,
			'shiftArrowDown' : newer,
			'ctrlArrowUp'    : oldest,
			'ctrlArrowDown'  : newest,
		};
		
		function maybeShowOlder() { return self.maybeShowOlder(); }
		function older()          { return self.showOlder(); }
		function newer()          { return self.showNewer(); }
		function oldest()         { return self.showOldest(); }
		function newest()         { return self.showNewest(); }
		
		self.input = document.getElementById( self.inputId );
		self.input.addEventListener( 'keydown', keyDown, false );
		function keyDown( e ) { self.handleKey( e ); }
	}
	
	ns.InputHistory.prototype.handleKey = function( e ) {
		var self = this;
		var key = e.code || e.key;
		if ( e.shiftKey )
			key = 'shift' + key;
		
		if ( e.ctrlKey )
			key = 'ctrl' + key;
		
		var handler = self.actionMap[ key ];
		if ( !handler )
			return;
		
		const noAction = handler();
		// if handler returns true, nothing was done, so dont prevent default
		if ( !noAction )
			e.preventDefault();
	}
	
	ns.InputHistory.prototype.add = function( str ) {
		var self = this;
		var prev = self.history[( self.history.length - 1 )];
		if ( prev !== str )
			self.history.push( str );
		
		if ( self.history.length > ( self.limit + 10 )) // lets not do a slice every time
			self.history = self.history.slice( -self.limit ); // from 'end', aka keep newer
		
		self.index = self.history.length;
	}
	
	ns.InputHistory.prototype.clear = function() {
		var self = this;
		self.history = [];
		self.index = self.history.length;
		self.setInput();
	}
	
	ns.InputHistory.prototype.maybeShowOlder = function() {
		const self = this;
		const value = self.input.value;
		if ( value )
			return true;
		
		return self.showOlder();
	}
	
	ns.InputHistory.prototype.showOlder = function() {
		var self = this;
		self.index = self.index -1;
		self.setInput();
	}
	
	ns.InputHistory.prototype.showNewer = function() {
		var self = this;
		self.index = self.index + 1;
		self.setInput();
	}
	
	ns.InputHistory.prototype.showOldest = function() {
		var self = this;
		self.index = 0;
		self.setInput();
	}
	
	ns.InputHistory.prototype.showNewest = function() {
		var self = this;
		self.index = self.history.length - 1;
		self.setInput();
	}
	
	ns.InputHistory.prototype.setInput = function() {
		var self = this;
		var str = self.getStr();
		self.input.value = str;
		self.input.setSelectionRange( 0, 0 );
	}
	
	ns.InputHistory.prototype.boundIndex = function() {
		var self = this;
		var oob = false; // out of bounds
		var index = self.index;
		var length = self.history.length;
		
		if ( index < 0 ) // one out of bounds
			oob = true;
		
		if ( index < -1 ) // more than one out of bounds
			self.index = -1;
		
		if ( index > ( length -1 ))
			oob = true;
		
		if ( index > length )
			self.index = length;
		
		return oob;
	}
	
	ns.InputHistory.prototype.getStr = function() {
		var self = this;
		var isOutOfBounds = self.boundIndex();
		if ( isOutOfBounds )
			return '';
		
		return self.history[ self.index ];
	}
	
})( library.component );


// FLOURISH
(function( ns, undefined ) {
	ns.Flourish = function( defaultCssClass ) {
		if ( !( this instanceof ns.Flourish ))
			return new ns.Flourish( defaultCssClass );
		
		var self = this;
		self.defaultCssClass = defaultCssClass;
		
		self.init();
	}
	
	ns.Flourish.prototype.init = function() {
		var self = this;
	}
	
	ns.Flourish.prototype.do = function( element, cssClass ) {
		var self = this;
		cssClass = cssClass || self.defaultCssClass || '';
		if ( !cssClass )
			throw new Error( 'Flourish - no cssClass provided' );
		
		element.classList.toggle( cssClass, true );
		element.addEventListener( 'animationend', animEnd, false );
		function animEnd( e ) {
			element.classList.toggle( cssClass, false );
		}
	}
	
})( library.component );


// HIGHLIGHT
(function( ns, undefined ) {
	ns.Highlight = function( conf ) {
		if ( !( this instanceof ns.Highlight ))
			return new ns.Highlight( conf );
		
		var self = this;
		self.hlClass = conf.cssClass;
		self.checks = conf.checks || [];
		self.listener = conf.listener;
		self.RX = null;
		
		self.init();
	}
	ns.Highlight.prototype.check = function( str, element ) {
		var self = this;
		if ( !str || ( typeof( str ) !== 'string' ))
			return false;
		
		var match = str.match( self.RX );
		if ( !match )
			return false;
		
		element.classList.toggle( self.hlClass, true );
		if ( self.listener )
			self.listener( str );
		
		return true;
	}
	
	ns.Highlight.prototype.addCheck = function( str ) {
		var self = this;
		self.checks.push( str );
		self.updateCheckRX();
	}
	
	ns.Highlight.prototype.setCheck = function( str ) {
		var self = this;
		self.checks = [];
		self.checks.push( str );
		self.updateCheckRX();
	}
	
	ns.Highlight.prototype.removeCheck = function( str ) {
		var self = this;
		self.checks = self.checks.filter( isNot );
		self.updateCheckRX();
		
		function isNot( check ) {
			if ( check === str )
				return false;
			return true;
		}
	}
	
	ns.Highlight.prototype.setClass = function( cssClass ) {
		var self = this
		self.highlightClass = cssClass;
	}
	
	// Private
	
	ns.Highlight.prototype.init = function() {
		var self = this;
		if ( self.check.length )
			self.updateCheckRX();
	}
	
	ns.Highlight.prototype.updateCheckRX = function() {
		var self = this;
		var args = self.checks.map( addParens );
		var rx = args.join( '|' );
		self.RX = new window.RegExp( rx, 'i' );
		
		function addParens( check ) {
			return '(' + check + ')';
		}
	}
	
})( library.component );

// LinkExpand
(function( ns, undefined ) {
	ns.LinkExpand = function( conf ) {
		if ( !( this instanceof ns.LinkExpand ))
			return new ns.LinkExpand( conf );
			
		var self = this;
		self.template = conf.templateManager; // should be pre-loaded with relevant fragments
		
		self.init();
	}
	
	// Public
	
	ns.LinkExpand.prototype.work = function( el ) {
		var self = this;
		var links = el.querySelectorAll( 'a' );
		Array.prototype.forEach.call( links, expand );
		
		function expand( a ) {
			var url = a.href.toString();
			self.getMIME( url )
				.then( success )
				.catch( failed );
			return;
			
			function success( mime ) {
				var handler = self.mimeMap[ mime.type ];
				if ( !handler )
					return;
				
				var content = handler( a, mime );
				if ( !content )
					return null;
				
				self.replace( a, content );
			}
			
			function failed( err ) {
				//console.log( 'LE.mime.failed', err );
			}
		}
	}
	
	// private
	
	ns.LinkExpand.prototype.init = function() {
		var self = this;
		self.mimeMap = {
			'image'       : image,
			'audio'       : audio,
			'video'       : video,
			'text'        : file,
			'application' : file,
		};
		
		// anchor, mime
		function image( a, m ) { return self.expandImage( a, m ); }
		function audio( a, m ) { return self.expandAudio( a, m ); }
		function video( a, m ) { return self.expandVideo( a, m ); }
		function text( a, m ) { return self.expandOther( a, m ); }
		function file( a, m ) { return self.expandFile( a, m ); }
	}
	
	ns.LinkExpand.prototype.getMIME = function( url ) {
		var self = this;
		return new window.Promise( urlCheck );
		function urlCheck( resolve, reject ) {
			if ( !url || !url.length )
				reject();
			
			url = url.replace( /^http:/, 'https:' );
			var req = new window.XMLHttpRequest();
			//req.addEventListener( 'progress', reqProgress );
			req.addEventListener( 'readystatechange', reqReadyState );
			req.addEventListener( 'error', reqError );
			req.open( 'GET', url );
			req.send();
			
			function reqProgress( e ) {
			}
			
			function reqReadyState( e ) {
				var ev = JSON.stringify( e );
				var headers = req.getAllResponseHeaders();
				if ( !headers.length )
					return;
				
				var mime = getContentType( headers );
				if ( !mime )
					return;
				
				req.abort();
				resolve( mime );
			}
			
			function getContentType( headerStr ) {
				const headers = headerStr.split( /\r\n/ );
				const cType = headers
					.map( rxCType )
					.filter( notNull )
					[ 0 ];
				
				return cType;
			}
			
			function rxCType( str ) {
				var match = str.match( /^content-type: (([a-z]+)\/(.+))$/i );
				if ( !match || !match[ 2 ] || !match[ 3 ] )
					return null;
				
				var res = {
					type : match[ 2 ],
					ext  : match[ 3 ],
				};
				return res;
			}
			
			function notNull( item ) { return null != item }
			
			function reqError( e ) {
				var headers = req.getAllResponseHeaders();
				/*
				console.log( 'reqError', {
					e : e,
					r : req,
					t : req.responseType,
					h : headers,
				});
*/
				reject( 'invalid' );
			}
		}
	}
	
	ns.LinkExpand.prototype.getHandler = function( a ) {
		var self = this;
		var url = a.href;
		var ext = getFileExtension( url );
		if ( !ext )
			return null;
		
		ext = ext.toLowerCase();
		var handler = self.extensionMap[ ext ];
		if ( !handler )
			return null;
		
		return handler;
		
		function getFileExtension( url ) {
			var match = url.match( /[\w\d]\/.*\.([\w\d]*)$/ );
			if ( !match )
				return;
			
			return match[ 1 ];
		}
	}
	
	// Evaluate content and add a "link"
	ns.LinkExpand.prototype.replace = function( a, content ) {
		var self = this;
		var src = a.href;
		var file = null;
		var fileMatch = src.match( /\/([-_%\w\s]+\.[\w]+)$/i);
		if ( fileMatch )
			file = fileMatch[ 1 ];
		else
			file = src;
		
		file = window.decodeURIComponent( file );
		
		var conf = {
			href    : a.href,
			file    : file
		};
		
		var el = self.template.getElement( 'link-expand-tmpl', conf );
		el.querySelector( '.link-expand-content' ).appendChild( content );
		var parent = a.parentNode;
		parent.removeChild( a );
		
		if( el.querySelector( '.link-expand-image' ) && content.secretOnClickFunction )
		{
			var as = el.getElementsByTagName( 'a' );
			for( var a = 0; a < as.length; a++ ) {
				as[ a ].href = 'javascript:void(0)';
				as[ a ].onclick = content.secretOnClickFunction;
				break;
			}
		}
		
		parent.appendChild( el );
	}
	
	ns.LinkExpand.prototype.expandImage = function( a ) {
		var self = this;
		var src = a.href;
		var conf = {
			src : src,
		};
		var htmlElement = self.template.getElement( 'image-expand-tmpl', conf );
		function clFunc( e )
		{
			e.preventDefault();
			e.stopPropagation();
			
			self.getMIME( src )
				.then( success )
				.catch( failed );
			return
			
			function failed()
			{
				return false;
			}
			function success( mime ) {
				if( mime.type == 'image' )
				{
					window.View.sendBase( {
						type: 'dos',
						method: 'openWindowByFilename',
						args: { fileInfo: { Path: src }, ext: 'jpg' }
					} );
				}
			}
		}
		htmlElement.addEventListener( 'click', clFunc, false );
		htmlElement.secretOnClickFunction = clFunc;
		return htmlElement;
	}
	
	ns.LinkExpand.prototype.expandAudio = function( a ) {
		var self = this;
		var src = a.href;
		var conf = {
			src : src,
		};
		var htmlElement = self.template.getElement( 'audio-expand-tmpl', conf );
		return htmlElement;
	}
	
	ns.LinkExpand.prototype.expandVideo = function( a ) {
		var self = this;
		var src = a.href;
		var conf = {
			src : src,
		};
		var htmlElement = self.template.getElement( 'video-expand-tmpl', conf );
		return htmlElement;
	}
	
	ns.LinkExpand.prototype.expandFile = function( a, mime ) {
		var self = this;
		return '';
		
		typeClass = 'File';
		if ( mime && mime.ext )
			typeClass = 'Type' + mime.ext.toUpperCase();
		
		var conf = {
			typeClass : typeClass
		};
		var htmlElement = self.template.getElement( 'file-expand-tmpl', conf );
		return htmlElement;
	}
	
	ns.LinkExpand.prototype.expandText = function( a, mime ) {
		var self = this;
		return null;
		//return a.href;
	}
	
	ns.LinkExpand.prototype.expandOther = function( a, mime ) {
		var self = this;
		return null;
		//return a.href;
	}
	
	
})( library.component );


// TouchScroll
(function( ns, undefined ) {
	ns.TouchScroll = function( elementId ) {
		if ( !( this instanceof ns.TouchScroll ))
			return new ns.TouchScroll( elementId );
		
		var self = this;
		self.elId = elementId;
		
		self.init();
	}
	
	ns.TouchScroll.prototype.init = function() {
		var self = this;
		self.prevY = 0;
		self.prevX = 0;
		self.target = document.getElementById( self.elId );
		self.target.addEventListener( 'touchstart', tstart, false );
		self.target.addEventListener( 'touchmove', tmove, false );
		self.target.addEventListener( 'touchend', tend, false );
		
		function tstart( e ) { self.tStart( e ); }
		function tmove( e ) { self.tMove( e ); }
		function tend( e ) { self.tEnd( e ); }
	}
	
	ns.TouchScroll.prototype.tStart = function( e ) {
		var self = this;
		var touch = e.touches[ 0 ];
		self.prevY = touch.pageY;
		self.prevX = touch.pageX;
	}
	
	ns.TouchScroll.prototype.tMove = function( e ) {
		var self = this;
		var touch = e.touches[ 0 ];
		var deltaY = self.prevY - touch.pageY;
		var deltaX = self.prevX - touch.pageX;
		self.prevY = touch.pageY;
		self.prevX = touch.pageX;
		
		// lets not do anything with a swipe ( left / right )
		if ( deltaX > deltaY )
			return true;
		
		e.preventDefault();
		e.stopPropagation();
		self.target.scrollTop = self.target.scrollTop + deltaY;
	}
	
	ns.TouchScroll.prototype.tEnd = function( e ) {
		var self = this;
		var touch = e.touches[ 0 ];
	}
	
	ns.TouchScroll.prototype.close = function() {
		var self = this;
		// unregister all the things
	}
	
})( library.component );


// multiline input
(function( ns, undefined ) {
	ns.MultiInput = function( conf ) {
		if ( !( this instanceof ns.MultiInput ))
			return new ns.MultiInput( conf );
		
		const self = this;
		self.containerId = conf.containerId;
		self.singleOnly = !!conf.singleOnly;
		self.multiIsOn = !!conf.multiIsOn;
		self.enterIsNewline = !!conf.enterIsNewline;
		self.template = conf.templateManager;
		self.onsubmit = conf.onsubmit;
		self.onstate = conf.onstate;
		self.onmode = conf.onmode || null;
		
		self.currentTAHeight = '';
		self.isTyping = false;
		
		self.init();
	}
	
	ns.MultiInput.prototype.inputTmpl = 'multiline-input-tmpl';
	
	// Public
	
	ns.MultiInput.prototype.submit = function() {
		var self = this;
		self.doSubmit();
	}
	
	ns.MultiInput.prototype.add = function( str ) {
		const self = this;
		if ( !self.ta )
			return;
		
		const current = self.ta.value;
		self.ta.value = current + str;
	}
	
	ns.MultiInput.prototype.focus = function() {
		var self = this;
		if ( !self.ta )
			return;
		
		self.ta.focus();
	}
	
	ns.MultiInput.prototype.setValue = function( string ) {
		var self = this;
		if ( !self.ta )
			return;
		
		self.ta.value = string;
		self.checkLineBreaks();
	}
	
	ns.MultiInput.prototype.getValue = function() {
		var self = this;
		if ( !self.ta )
			return;
		
		return self.ta.value;
	}
	
	ns.MultiInput.prototype.toggleMultiline = function( force ) {
		var self = this;
		if ( null == force )
			self.multiIsOn = !self.multiIsOn;
		else
			self.multiIsOn = !!force;
		
		if ( self.onmode )
			self.onmode( self.multiIsOn );
	}
	
	ns.MultiInput.prototype.setSingleOnly = function( singleOnly ) {
		var self = this;
		self.singleOnly = !!singleOnly;
	}
	
	ns.MultiInput.prototype.close = function() {
		var self = this;
		delete self.containerId;
		delete self.enterIsNewline;
		delete self.template;
		delete self.onsubmit;
		delete self.onstate;
		delete self.onmode;
		delete self.taWrap;
		delete self.ta;
	}
	
	// Private
	
	ns.MultiInput.prototype.init = function() {
		var self = this;
		// setup
		self.keyMap = {
			'shiftTab'       : handleTab,
			'shiftEnter'     : handleSpecialEnter,
			'Enter'          : handleEnter,
		};
		
		function handleTab( e ) { self.handleTab( e ); }
		function handleEnter( e ) { self.handleEnter( e ); }
		function handleSpecialEnter( e ) { self.handleSpecialEnter( e ); }
		
		// build
		var cont = document.getElementById( self.containerId );
		self.taWrap = self.template.getElement( self.inputTmpl, {} );
		cont.appendChild( self.taWrap );
		self.isTypingHint = document.getElementById( 'typing-hint' );
		self.ta = self.taWrap.querySelector( 'textarea' );
		
		// bind
		self.ta.addEventListener( 'focus', inputFocus, false );
		self.ta.addEventListener( 'blur', inputBlur, false );
		self.ta.addEventListener( 'keydown', keyDown, false );
		self.ta.addEventListener( 'keyup', keyUp, false );
		
		function inputFocus( e ) { self.handleFocus( true ); }
		function inputBlur( e ) { self.handleFocus( false ); }
		function keyDown( e ) { self.handleKeyDown( e ); }
		function keyUp( e ) { self.handleKeyUp( e ); }
	}
	
	ns.MultiInput.prototype.handleFocus = function( hasFocus ) {
		const self = this;
		self.inputHasFocus = hasFocus;
		if ( !hasFocus )
			self.clearIsTyping();
		
	}
	
	ns.MultiInput.prototype.handleKeyUp = function( e ) {
		const self = this;
		self.checkLineBreaks();
		self.checkIsTyping();
	}
	
	ns.MultiInput.prototype.handleKeyDown = function( e ) {
		var self = this;
		var eventStr = '';
		if ( e.ctrlKey )
			eventStr = 'ctrl';
		
		if ( e.shiftKey )
			eventStr = 'shift';
		
		eventStr += e.code || e.key;
		var handler = self.keyMap[ eventStr ];
		if ( !handler ) {
			self.checkIsTyping();
			return;
		}
		
		const notSubmit = handler( e );
		if ( notSubmit )
			self.checkIsTyping();
	}
	
	ns.MultiInput.prototype.handleTab = function( e ) {
		var self = this;
		e.preventDefault();
		const currInput = self.ta.value;
		const newInput = currInput + '\t';
		self.ta.value = newInput;
		return true;
	}
	
	ns.MultiInput.prototype.handleEnter = function( e ) {
		var self = this;
		if ( self.enterIsNewline ) {
			self.checkLineBreaks( true );
			return true;
		} else {
			self.doSubmit( e );
			return false;
		}
	}
	
	ns.MultiInput.prototype.handleSpecialEnter = function( e ) {
		var self = this;
		// a newline was inserted in text area
		self.checkLineBreaks( true );
		return true;
	}
	
	ns.MultiInput.prototype.doSubmit = function( e ) {
		var self = this;
		if ( e ) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		self.clearIsTyping();
		if ( !self.ta )
			return;
		
		let str = self.ta.value;
		if ( str.length && self.onsubmit )
			self.onsubmit( str );
		
		self.setValue( '' );
		self.focus();
	}
	
	ns.MultiInput.prototype.checkLineBreaks = function( addOne ) {
		const self = this;
		let str = self.ta.value;
		let num = str.split( '\n' ).length;
		if ( addOne )
			num++;
		
		let newHeight = '';
		if ( 1 === num )
			newHeight = '';
		
		if ( 2 === num )
			newHeight = 'two-lines';
		
		if ( 3 <= num )
			newHeight = 'three-lines';
		
		if ( self.currentTAHeight === newHeight )
			return;
		
		if ( '' !== self.currentTAHeight )
			self.taWrap.classList.toggle( self.currentTAHeight, false );
		
		if ( '' !== newHeight )
			self.taWrap.classList.toggle( newHeight, true );
		
		self.currentTAHeight = newHeight;
	}
	
	ns.MultiInput.prototype.checkIsTyping = function() {
		const self = this;
		const val = self.ta.value;
		if ( val && val.length )
			self.setIsTyping();
		else
			self.clearIsTyping();
		
	}
	
	ns.MultiInput.prototype.setIsTyping = function() {
		const self = this;
		if ( self.isTyping )
			return;
		
		self.isTyping = true;
		if ( self.isTypingHint )
			self.isTypingHint.classList.toggle( 'blink-icon', true );
		
		const event = {
			type : 'set-typing',
			data : null,
		};
		
		if ( self.onstate )
			self.onstate( event );
	}
	
	ns.MultiInput.prototype.clearIsTyping = function() {
		const self = this;
		if ( !self.isTyping )
			return;
		
		self.isTyping = false;
		if ( self.isTypingHint )
			self.isTypingHint.classList.toggle( 'blink-icon', false );
		
		const event = {
			type : 'clear-typing',
			data : null,
		};
		
		if ( self.onstate )
			self.onstate( event );
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.MsgBuilder = function( conf )  {
		if ( !( this instanceof ns.MsgBuilder ))
			return new ns.MsgBuilder( conf );
		
		var self = this;
		self.user = conf.user;
		self.contact = conf.contact || {};
		self.parser = conf.parser;
		self.template = conf.template;
		self.linkExpand = conf.linkExpand;
		self.messageTmpl = conf.messageTmpl;
		self.actionTmpl = conf.actionTmpl;
		self.notieTmpl = conf.notificationTmpl;
		self.logClass = conf.logClass;
		
		self.init();
	}
	
	// Public
	
	ns.MsgBuilder.prototype.message = function( msg ) {
		var self = this;
		return self.buildMessage( msg, self.messageTmpl );
	}
	
	ns.MsgBuilder.prototype.action = function( msg ) {
		var self = this;
		return self.buildMessage( msg, self.actionTmpl );
	}
	
	ns.MsgBuilder.prototype.notification = function( msg ) {
		var self = this;
		return self.buildNotification( msg );
	}
	
	ns.MsgBuilder.prototype.log = function( msg ) {
		var self = this;
		var handler = self.logHandlers[ msg.type ];
		if ( !handler ) {
			console.log( 'MsgBuilder.log - unknown log type', msg );
			return null;
		}
		
		return handler( msg.data );
	}
	
	ns.MsgBuilder.prototype.close = function() {
		var self = this;
		delete self.user;
		delete self.contact;
		delete self.parser;
		delete self.template;
		delete self.linkExpand;
	}
	
	// Private
	
	ns.MsgBuilder.prototype.init = function() {
		var self = this;
		self.logHandlers = {
			'message'      : message,
			'action'       : action,
			'notification' : notie,
		};
		
		function message( data ) {
			var el = self.message( data );
			el.classList.add( self.logClass );
			return el;
		}
		
		function action( data ) {
			var el = self.action( data );
			el.classList.add( self.logClass );
			return el;
		}
		
		function notie( data ) {
			data.level = 'log';
			return self.notification( data );
		}
	}
	
	ns.MsgBuilder.prototype.buildMessage = function( data, tmplId ) {
		var self = this;
		var mId = data.mid || '';
		var time = library.tool.getChatTime( data.time );
		var speakerClass = 'contact sw2'; // sw 1/2 is a friendup theme class.
		var name = self.contact.name || data.from;
		var message = data.message;
		if ( self.parser )
			message = self.parser.work( message );
		
		var encrypted = data.encrypted ? '' : 'hidden';
		var cipherText = data.cipherText || '';
		
		if ( !data.from ) {
			speakerClass = 'self sw1';
			name = self.user.name;
		}
		
		var conf = {
			mId          : mId,
			speakerClass : speakerClass,
			from         : name,
			time         : time,
			message      : message,
			encrypted    : encrypted,
			cipherText   : cipherText,
		};
		
		var tmplId = tmplId;
		var element = self.template.getElement( tmplId, conf );
		if ( self.linkExpand ) {
			self.linkExpand.work( element );
		}
		
		if ( data.encrypted )
			bindShowCrypt( element );
		
		return element;
		
		function bindShowCrypt( element ) {
			var lockEle = element.querySelector( '.encrypted' );
			var cTextEle = element.querySelector( '.cipher-text' );
			if ( lockEle && cTextEle )
				lockEle.addEventListener( 'click', showCText, false );
			
			function showCText( e ) {
				e.preventDefault();
				e.stopPropagation();
				cTextEle.classList.toggle( 'hidden' );
			}
		}
	}
	
	ns.MsgBuilder.prototype.buildNotification = function( data ) {
		var self = this;
		var conf = {
			level : data.level,
			message : data.message,
			time : library.tool.getChatTime( data.time ),
		};
		var element = self.template.getElement( self.notieTmpl, conf );
		return element;
	}
	
})( library.component );

// 
(function( ns, undefined ) {
	ns.AppOnline = function( View ) {
		const self = this;
		self.view = View;
		self.init();
	}
	
	ns.AppOnline.prototype.close = function() {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.release( 'app-online' );
		delete self.view;
	}
	
	ns.AppOnline.prototype.init = function() {
		const self = this;
		self.view.on( 'app-online', appOnline );
		function appOnline( isOnline ) {
			self.view.setIsLoading( !isOnline );
			//document.body.classList.toggle( 'app-offline', !isOnline );
		}
	}
	
})( library.component );


// ConnState
(function( ns, undefined ) {
	ns.ConnState = function( elementId, conn ) {
		const self = this;
		self.id = elementId;
		
		self.init( conn );
	}
	
	// Public
	
	ns.ConnState.prototype.close = function() {
		const self = this;
		delete self.id;
		delete self.loading;
		delete self.connecting;
		delete self.reconnect;
		delete self.denied;
		
		if ( !self.conn )
			return;
		
		self.conn.close();
		delete self.conn;
	}
	
	// Priv
	
	ns.ConnState.prototype.init = function( parentConn ) {
		const self = this;
		self.build();
		self.conn = new library.component.EventNode( 'conn-state', parentConn, eventSink );
		self.conn.on( 'load', load );
		self.conn.on( 'connect', connect );
		self.conn.on( 'session', session );
		self.conn.on( 'close', close );
		self.conn.on( 'timeout', timeout );
		self.conn.on( 'error', error );
		self.conn.on( 'resume', resume );
		self.conn.on( 'wait-reconnect', reconnect );
		self.conn.on( 'access-denied', denied );
		
		function load( e ) { self.handleLoad( e ); }
		function connect( e ) { self.handleConnect( e ); }
		function session( e ) { self.handleSession( e ); }
		function close( e ) { self.handleClose( e ); }
		function timeout( e ) { console.log( 'ConnState.timeout', e ); }
		function error( e ) { self.handleError( e ); }
		function resume( e ) { self.handleResume( e ); }
		function reconnect( e ) { self.handleReconnect( e ); }
		function denied( e ) { self.handleDenied( e ); }
		
		function eventSink( ) {
			console.log( 'ConnState - unknown event', arguments );
		}
	}
	
	ns.ConnState.prototype.handleLoad = function( data ) {
		const self = this;
		self.showUI( true );
		self.hideProgressStates();
		self.loading.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.handleConnect = function( e ) {
		const self = this;
		self.showUI( true );
		self.hideProgressStates();
		self.connecting.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.handleSession = function( sid ) {
		const self = this;
		self.showError( false );
		self.isOnline = true;
		self.showUI( false );
	}
	
	ns.ConnState.prototype.handleClose = function( e ) {
		const self = this;
		self.showUI( true );
	}
	
	ns.ConnState.prototype.handleError = function( err ) {
		const self = this;
		self.showUI( true );
		self.hideErrorStates();
		self.hideProgressStates();
		self.showError( true );
		self.errorMessage.textContent = err;
		self.error.classList.toggle( 'hidden', false );
		self.reconnect.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.handleResume = function( event ) {
		const self = this;
		self.showUI( true );
		self.hideProgressStates();
		self.loading.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.handleReconnect = function( event ) {
		const self = this;
		self.showError( false );
		self.showUI( true );
		self.hideErrorStates();
		self.hideProgressStates();
		self.connecting.classList.toggle( 'hidden', false );
		self.reconnect.classList.toggle( 'hidden', false );
		const cont = document.getElementById( 'conn-state-rc-bar-container' );
		const bar = document.getElementById( 'conn-state-rc-bar' );
		if ( !event.time ) {
			hideBar();
			return;
		}
		
		if ( self.reconnectFrame ) {
			window.cancelAnimationFrame( self.reconnectFrame );
			self.reconnectFrame = null;
		}
		
		bar.style.width = '100%';
		let start = Date.now();
		let end = event.time;
		let total = end - start;
		
		step();
		showBar();
		
		function step() {
			self.reconnectFrame = window.requestAnimationFrame( update );
		}
		
		function update() {
			let now = Date.now();
			if ( now > end ) {
				hideBar();
				return;
			}
			
			let left = end - now;
			let p = ( left / total );
			let percent = Math.floor( p * 100 );
			bar.style.width = percent + '%';
			
			step();
		}
		
		function showBar() {
			bar.classList.toggle( 'hidden', false );
		}
		
		function hideBar() {
			bar.classList.toggle( 'hidden', true );
		}
	}
	
	ns.ConnState.prototype.handleDenied = function( host ) {
		const self = this;
		self.showUI( true );
		self.hideErrorStates();
		self.showError( true );
		self.denied.classList.toggle( 'hidden', false );
	}
	
	ns.ConnState.prototype.showUI = function( show ) {
		const self = this;
		self.el.classList.toggle( 'hidden', !show );
	}
	
	ns.ConnState.prototype.hideProgressStates = function() {
		const self = this;
		self.loading.classList.toggle( 'hidden', true );
		self.connecting.classList.toggle( 'hidden', true );
		self.reconnect.classList.toggle( 'hidden', true );
	}
	
	ns.ConnState.prototype.hideErrorStates = function() {
		const self = this;
		self.denied.classList.toggle( 'hidden', true );
		self.error.classList.toggle( 'hidden', true );
	}
	
	ns.ConnState.prototype.showProgress = function( show ) {
		const self = this;
		self.progress.classList.toggle( 'hidden', !show );
	}
	
	ns.ConnState.prototype.showError = function( show ) {
		const self = this;
		self.errorHead.classList.toggle( 'hidden', !show );
		self.progressHead.classList.toggle( 'hidden', show );
		self.oops.classList.toggle( 'hidden', !show );
	}
	
	ns.ConnState.prototype.build = function() {
		const self = this;
		const ui = hello.template.getElement( 'conn-state-tmpl', {} );
		self.el = document.getElementById( self.id );
		self.el.appendChild( ui );
		
		// bind ui
		let rcBtn = document.getElementById( 'conn-state-reconnect-btn' );
		let qBtn = document.getElementById( 'conn-state-quit-btn' );
		self.errorHead = document.getElementById( 'conn-state-error-head' );
		self.progressHead = document.getElementById( 'conn-state-progress-head' );
		self.oops = document.getElementById( 'conn-state-oops' );
		self.yay = document.getElementById( 'conn-state-yay' );
		self.loading = document.getElementById( 'conn-state-loading' );
		self.connecting = document.getElementById( 'conn-state-connecting' );
		self.reconnect = document.getElementById( 'conn-state-reconnect' );
		self.denied = document.getElementById( 'conn-state-denied' );
		self.error = document.getElementById( 'conn-state-error' );
		self.errorMessage = document.getElementById( 'conn-state-error-msg' );
		
		rcBtn.addEventListener( 'click', reconnect, false );
		qBtn.addEventListener( 'click', quit, false );
		
		function reconnect( e ) {
			self.send({
				type : 'reconnect',
			});
		}
		
		function quit( e ) {
			self.send({
				type : 'quit',
			});
		}
	}
	
	ns.ConnState.prototype.send = function( event ) {
		const self = this;
		if ( !self.conn )
			return;
		
		self.conn.send( event );
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.Search = function(
		conn,
		inputContainerId,
		resultsContainerId,
		template,
		onActive,
	) {
		const self = this;
		self.conn = null;
		self.template = template;
		self.onActive = onActive;
		
		self.input = null;
		self.output = null;
		self.searching = null;
		self.results = null;
		self.items = null;
		self.pools = null;
		
		self.init( conn, inputContainerId, resultsContainerId );
	}
	
	// Public
	
	ns.Search.prototype.close = function() {
		const self = this;
		if ( self.conn )
			self.conn.release( 'search-result' );
		
		delete self.conn;
		delete self.input;
		delete self.inputIcon;
		delete self.output;
		delete self.searching;
		delete self.results;
		delete self.pools;
		delete self.items;
		delete self.template;
		delete self.onActive;
	}
	
	ns.Search.prototype.hide = function() {
		const self = this;
		self.clearSearch();
		self.setInactive();
	}
	
	// Private
	
	ns.Search.prototype.renameMap = {
		'Presence' : 'i18n_conference_rooms',
		'Treeroot' : 'i18n_community_contacts',
	}
	
	ns.Search.prototype.init = function( parentConn, inputContainerId, resultsContainerId ) {
		const self = this;
		self.setActions();
		self.conn = new library.component.EventNode( 'search', parentConn, eventSink );
		function eventSink( type, data ) {
			console.log( 'Main.Search event sink - no handler for event', {
				type : type,
				data : data,
			});
		}
		
		self.conn.on( 'result', e => self.handleResult( e ));
		self.conn.on( 'add_relation', e => self.handleAddRelation( e ));
		
		const inputContainer = document.getElementById( inputContainerId );
		const inputHtml = self.template.get( 'search-input-tmpl', {});
		inputContainer.innerHTML = inputHtml;
		
		self.input = inputContainer.querySelector( 'input' );
		self.input.addEventListener( 'keyup', hasSearchInput, false );
		self.input.addEventListener( 'blur', lostFocus, false );
		self.inputIcon = inputContainer.querySelector( 'i' );
		self.inputIcon.parentNode.addEventListener( 'click', clearClick, false );
		
		const resContainer = document.getElementById( resultsContainerId );
		const resultsId = friendUP.tool.uid( 'results' );
		const tmplConf = {
			resultsId   : resultsId,
		};
		
		self.output = self.template.getElement( 'search-results-tmpl', tmplConf );
		resContainer.appendChild( self.output );
		self.results = document.getElementById( resultsId );
		
		function hasSearchInput( e ) {
			self.handleInput();
		}
		
		function lostFocus( e ) {
			let val = self.input.value;
			if ( val && val.length > 0 )
				return;
			
			self.clearSearch();
			self.setInactive();
		}
		
		function clearClick( e ) {
			self.handleClear();
		}
		
	}
	
	ns.Search.prototype.handleClear = function() {
		const self = this;
		self.input.value = '';
		self.handleInput();
	}
	
	ns.Search.prototype.handleInput = function() {
		const self = this;
		let str = self.input.value;
		if ( !str || !str.trim ) {
			self.clearSearch();
			self.setInactive();
			return;
		}
		
		str = str.trim();
		if ( !str || !str.length ) {
			self.clearSearch();
			self.setInactive();
			return;
		}
		
		if ( self.searchStr === str )
			return;
		
		self.clearSearch();
		self.setActive();
		if ( isSameBaseSearch( str )) {
			self.searchStr = str;
			self.searchTimeout = window.setTimeout( searchAnyway, 250 );
			return;
		}
		
		if ( 1 === str.length ) {
			self.searchStr = str;
			self.searchTimeout = window.setTimeout( searchAnyway, 2000 );
			return;
		}
		
		if ( 2 === str.length ) {
			self.searchStr = str;
			self.searchTimeout = window.setTimeout( searchAnyway, 500 );
			return;
		}
		
		self.searchStr = str;
		self.sendSearch();
		
		function isSameBaseSearch( str ) {
			if ( !self.sentSearchStr )
				return false;
			
			if ( 0 === str.indexOf( self.sentSearchStr ))
				return true;
			else
				return false;
		}
		
		function searchAnyway() {
			self.sendSearch();
		}
	}
	
	ns.Search.prototype.sendSearch = function() {
		const self = this;
		self.pools = [];
		self.sources = {};
		self.items = {};
		self.searchId = friendUP.tool.uid( 'search' );
		self.sentSearchStr = self.searchStr;
		const search = {
			type : 'search',
			data : {
				id  : self.searchId,
				str : self.searchStr,
			},
		};
		self.conn.send( search );
	}
	
	ns.Search.prototype.setActive = function() {
		const self = this;
		self.searchActive = true;
		if ( self.onActive )
			self.onActive( true );
		
		self.setIsSearching( true );
	}
	
	ns.Search.prototype.setInactive = function() {
		const self = this;
		self.searchActive = false;
		self.input.value = '';
		if ( self.onActive )
			self.onActive( false );
	}
	
	ns.Search.prototype.clearSearch = function() {
		const self = this;
		self.searchActive = false;
		self.clearDelayedSearch();
		self.searchId = null;
		self.searchStr = null;
		self.sentSearchStr = null;
		self.pools = null;
		self.sources = null;
		self.items = null;
		self.results.innerHTML = '';
		self.setIsSearching( false );
	}
	
	ns.Search.prototype.setIsSearching = function( isSearching ) {
		const self = this;
		if ( !self.inputIcon )
			return;
		
		if ( isSearching )
			self.inputIcon.className = 'fa fa-fw fa-spinner fa-pulse';
		else {
			if ( self.searchActive ) {
				self.inputIcon.parentNode.classList.toggle( 'flat-btn', true );
				self.inputIcon.className = 'fa fa-fw fa-close';
			}
			else {
				self.inputIcon.parentNode.classList.toggle( 'flat-btn', false );
				self.inputIcon.className = 'fa fa-fw fa-search';
			}
		}
	}
	
	ns.Search.prototype.clearDelayedSearch = function() {
		const self = this;
		if ( !self.searchTimeout )
			return;
		
		window.clearTimeout( self.searchTimeout );
		self.searchTimeout = null;
	}
	
	ns.Search.prototype.handleResult = function( event ) {
		const self = this;
		if ( self.searchId !== event.id )
			return;
		
		if ( event.current === event.total )
			self.setIsSearching( false );
		
		const src = event.data;
		const sId = friendUP.tool.uid( 'src' );
		const items = src.result;
		if ( !items || !items.length )
			return;
		
		const source = addSource( src, sId );
		const poolEl = document.getElementById( source.uuid );
		const poolContent = poolEl.querySelector( '.content' );
		items.forEach( add );
		
		function add( item ) {
			let uuid = friendUP.tool.uid();
			item.uuid = uuid;
			item.sourceId = source.sourceId;
			item.poolId = sId;
			source.pool.push( item );
			self.items[ uuid ] = item;
			let el = null;
			if ( 'contact' === item.type )
				el = self.buildContact( item );
			
			if ( 'room' === item.type )
				el = self.buildRoom( item );
			
			poolContent.appendChild( el );
		}
		
		function addSource( conf, sId ) {
			const name = self.sourceNamer2k( conf.source );
			const type = typeNamerPro( conf.type );
			const poolConf = {
				uuid : sId,
				name : name,
				type : type,
			};
			let el = self.template.getElement( 'search-result-pool-tmpl', poolConf );
			self.results.appendChild( el );
			const source = {
				el       : el,
				uuid     : sId,
				sourceId : conf.sourceId,
				source   : conf.source,
				actions  : conf.actions,
				pool     : [],
			};
			self.pools.push( sId );
			self.sources[ sId ] = source;
			
			return source;
			
			function typeNamerPro( type ) {
				if ( !type || !type.length )
					return '';
				
				return ' - ' + View.i18n( type );
			}
		}
	}
	
	ns.Search.prototype.sourceNamer2k = function( name ) {
		const self = this;
		let rename = self.renameMap[ name ] || name;
		return View.i18n( rename );
	}
	
	ns.Search.prototype.buildContact = function( item ) {
		const self = this;
		const actions = self.sources[ item.poolId ].actions;
		let hasAddRelation = false;
		let hasMenu = true;
		if ( actions.indexOf( 'add-relation' ) != -1 )
			hasAddRelation = true;
		
		if ( !actions.length || ( hasAddRelation && ( actions.length == 1 )))
			hasMenu = false;
		
		const conf = {
			uuid        : item.uuid,
			name        : item.name || '',
			email       : item.email || '',
			avatar      : item.avatar || '',
			emailHidden : item.email ? '' : 'hidden',
			subHidden   : hasAddRelation ? '' : 'hidden',
			menuHidden  : hasMenu ? '' : 'hidden',
		};
		
		const el = self.template.getElement( 'search-result-contact-tmpl', conf );
		const uuid = item.uuid;
		if ( hasMenu ) {
			const menuBtn = el.querySelector( '.item-menu' );
			menuBtn.addEventListener( 'click', menuClick, false );
		}
		
		if ( hasAddRelation ) {
			const subBtn = el.querySelector( '.search-result-subscribe' );
			subBtn.addEventListener( 'click', subClick, false );
		}
		
		el.addEventListener( 'click', elClick, false );
		
		function subClick( e ) {
			e.stopPropagation();
			self.handleAddRelationClick( uuid );
		}
		function menuClick( e ) {
			e.stopPropagation();
			self.handleMenuClick( uuid );
		}
		function elClick( e ) { self.handleItemClick( uuid ); }
		
		return el;
	}
	
	ns.Search.prototype.buildRoom = function( item ) {
		const self = this;
		const conf = {
			uuid       : item.uuid,
			name       : item.name || '',
			avatar     : item.avatar || '',
			iconHidden : item.avatar ? 'hidden' : '',
		};
		const el = self.template.getElement( 'search-result-room-tmpl', conf );
		const menuBtn = el.querySelector( '.item-menu')
		const uuid = item.uuid;
		
		el.addEventListener( 'click', elClick, false );
		menuBtn.addEventListener( 'click', menuClick, false );
		
		function menuClick( e ) {
			e.stopPropagation();
			self.handleMenuClick( uuid );
		}
		function elClick( e ) { self.handleItemClick( uuid ); }
		
		return el;
	}
	
	ns.Search.prototype.handleAddRelationClick = function( uuid ) {
		const self = this;
		const item = self.items[ uuid ];
		if ( item.disabled )
			return;
		
		item.disabled = true;
		const el = document.getElementById( uuid );
		const icon = el.querySelector( '.search-result-subscribe i' );
		icon.classList.toggle( 'fa-plus', false );
		icon.classList.toggle( 'fa-spinner', true );
		icon.classList.toggle( 'fa-pulse', true );
		const sub = {
			type : 'add-relation',
			data : item,
		};
		self.sendAction( sub );
	}
	
	ns.Search.prototype.handleAddRelation = function( res ) {
		const self = this;
		const id = res.uuid;
		if ( !self.items || !self.items[ id ])
			return;
		
		const item = self.items[ id ];
		const el = document.getElementById( id );
		if ( !el )
			return;
		
		const subBtn = el.querySelector( '.search-result-subscribe' );
		const icon = subBtn.querySelector( 'i' );
		icon.classList.toggle( 'fa-plus', false );
		icon.classList.toggle( 'fa-spinner', false );
		icon.classList.toggle( 'fa-pulse', false );
		if ( res.success )
			icon.classList.toggle( 'fa-check', true );
		else {
			item.disabled = false;
			icon.classList.toggle( 'fa-plus', true );
		}
	}
	
	ns.Search.prototype.handleMenuClick = function( uuid ) {
		const self = this;
		const item = self.items[ uuid ];
		if ( item.disabled )
			return;
		
		const el = document.getElementById( uuid );
		const menuBtn = el.querySelector( '.item-menu' );
		const actions = self.getItemMenuActions( item );
		const mini = new library.component.MiniMenu(
			hello.template,
			menuBtn,
			'hello',
			actions,
			onSelect
		);
		
		function onSelect( action ) {
			mini.close();
			const event = {
				type : action,
				data : item,
			};
			self.sendAction( event );
		}
	}
	
	ns.Search.prototype.handleItemClick = function( uuid ) {
		const self = this;
		const item = self.items[ uuid ];
		if ( item.disabled )
			return;
		
		const action = {
			type : 'open-chat',
			data : item,
		};
		
		self.sendAction( action );
	}
	
	ns.Search.prototype.getItemMenuActions = function( item ) {
		const self = this;
		const source = self.sources[ item.poolId ];
		const actions = source.actions.map( build ).filter( item => !!item );
		return actions;
		
		function build( type ) {
			if ( 'add-relation' === type )
				return null;
			
			return self.menuActions[ type ] || null;
		}
	}
	
	ns.Search.prototype.sendAction = function( action ) {
		const self = this;
		const event = {
			type : 'action',
			data : action,
		};
		self.conn.send( event );
	}
	
	ns.Search.prototype.setActions = function() {
		const self = this;
		self.menuActions = library.component.MiniMenuActions();
	}
	
})( library.component );


// Filter list
/*
inputContainerId
listContainerId
itemList - optional, list of DOM elements to show in the list
*/
(function( ns, undefined ) {
	ns.FilterList = function(
		templater,
		inputContainerId,
		listContainerId,
		filterProps,
		itemList,
	) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.templater = templater,
		self.inputCId = inputContainerId;
		self.listCId = listContainerId;
		self.filterProps = filterProps;
		
		self.items = {};
		self.itemIds = [];
		self.visible = [];
		self.hidden = [];
		
		self.init( itemList );
	}
	
	ns.FilterList.prototype =
		Object.create( library.component.EventEmitter.prototype );
		
	// Public
	
	ns.FilterList.prototype.add = function( items ) {
		const self = this;
		console.log( 'FilterList.add', items );
	}
	
	ns.FilterList.prototype.update = function( item ) {
		const self = this;
		console.log( 'FilterList.update', item );
	}
	
	ns.FilterList.prototype.remove = function( itemIds ) {
		const self = this;
		console.log( 'FilterList.remove', itemIds );
	}
	
	ns.FilterList.prototype.focus = function() {
		const self = this;
		self.input.focus();
	}
	
	// Private
	
	ns.FilterList.prototype.init = function( itemList ) {
		const self = this;
		self.setInput();
		if ( itemList )
			itemList.forEach( addItem );
		
		function addItem( source ) {
			const id = source.clientId;
			const item = {
				id : source.clientId,
			};
			addProps( item, source );
			self.items[ id ] = item;
			self.itemIds.push( id );
			self.visible.push( item );
		}
		
		function addProps( item, source ) {
			self.filterProps.forEach( prop => {
				const value = source[ prop ] || '';
				item[ prop ] = value.toLowerCase();
			});
		}
	}
	
	ns.FilterList.prototype.setInput = function() {
		const self = this;
		const container = document.getElementById( self.inputCId );
		const el = self.templater.getElement( 'search-input-tmpl', {});
		container.appendChild( el );
		self.input = el.querySelector( 'input' );
		self.input.addEventListener( 'keyup', hasFilterInput, false );
		self.input.addEventListener( 'focus', hasFocus, false );
		self.input.addEventListener( 'blur', lostFocus, false );
		self.inputIcon = el.querySelector( 'i' );
		self.inputIcon.parentNode.addEventListener( 'click', clearClick, false );
		
		function hasFilterInput( e ) {
			self.handleInput();
		}
		
		function hasFocus( e ) {
			self.handleFocus();
		}
		
		function lostFocus( e ) {
			self.handleBlur();
		}
		
		function clearClick( e ) {
			self.clearFilter();
		}
	}
	
	ns.FilterList.prototype.handleInput = function() {
		const self = this;
		let str = self.input.value;
		if ( !str || !str.trim ) {
			self.clearFilter();
			return;
		}
		
		str = str.trim();
		if ( !str || !str.length ) {
			self.clearFilter();
			return;
		}
		
		if ( self.filterStr === str )
			return;
		
		self.setFilterStateIcon( true );
		if ( null != self.filterTimeout ) {
			window.clearTimeout( self.filterTimeout );
			self.filterTimeout = null;
		}
		
		if ( self.checkIsSameBase( self.filterStr, str )) {
			self.filterStr = str;
			self.filterTimeout = window.setTimeout( filterAnyway, 200 );
			return;
		}
		
		self.filterStr = str;
		if ( 1 === str.length ) {
			self.filterTimeout = window.setTimeout( filterAnyway, 1000 );
			return;
		}
		
		if ( 2 === str.length ) {
			self.filterTimeout = window.setTimeout( filterAnyway, 500 );
			return;
		}
		
		if ( null != self.filterTimeout ) {
			window.clearTimeout( self.filterTimeout );
			self.filterTimeout = null;
		}
		
		self.applyFilter();
		
		function filterAnyway() {
			self.applyFilter();
		}
	}
	
	ns.FilterList.prototype.handleFocus = function() {
		const self = this;
		self.setFocus( true );
	}
	
	ns.FilterList.prototype.handleBlur = function() {
		const self = this;
		const str = self.input.value;
		if ( !str || !str.length )
			self.clearFilter();
		
		self.setFocus( false );
	}
	
	ns.FilterList.prototype.clearFilter = function() {
		const self = this;
		if ( null != self.filterTimeout ) {
			window.clearTimeout( self.filterTimeout );
			self.filterTimeout = null;
		}
		
		self.filterStr = null;
		self.input.value = '';
		self.visible = self.itemIds.slice();
		self.hidden = [];
		self.visible.forEach( id => {
			self.toggleVisible( id, true );
		});
		self.setFilterStateIcon();
	}
	
	ns.FilterList.prototype.applyFilter = function() {
		const self = this;
		if ( !self.filterStr )
			return;
		
		self.filterStr = self.filterStr.toLowerCase();
		if ( !self.checkIsSameBase( self.currentFilter, self.filterStr )) {
			self.visible = self.itemIds.slice();
			self.hidden = [];
		}
		
		self.visible = self.visible.filter( setVisibility );
		self.setFilterStateIcon();
		self.currentFilter = self.filterStr;
		
		function setVisibility( vId ) {
			const visible = self.items[ vId ];
			const hasMatch = self.filterProps.some( prop => {
				const value = visible[ prop ];
				const index = value.indexOf( self.filterStr );
				return ( -1 !== index );
			});
			
			if ( hasMatch ) {
				self.toggleVisible( vId, true );
				return true;
			}
			
			self.hidden.push( vId );
			self.toggleVisible( vId, false );
			return false;
		}
	}
	
	ns.FilterList.prototype.setFocus = function( isFocus ) {
		const self = this;
		self.hasFocus = isFocus;
		self.setFilterStateIcon();
		self.emit( 'focus', isFocus );
	}
	
	ns.FilterList.prototype.setFilterStateIcon = function( isFiltering ) {
		const self = this;
		if ( !self.inputIcon )
			return;
		
		if ( isFiltering )
			self.inputIcon.className = 'fa fa-fw fa-spinner fa-pulse';
		else {
			if ( !!self.filterStr ) {
				self.inputIcon.parentNode.classList.toggle( 'flat-btn', true );
				self.inputIcon.className = 'fa fa-fw fa-close';
			}
			else {
				self.inputIcon.parentNode.classList.toggle( 'flat-btn', false );
				self.inputIcon.className = 'fa fa-fw fa-search';
			}
		}
	}
	
	ns.FilterList.prototype.checkIsSameBase = function( base, check ) {
		const self = this;
		if ( 0 === check.indexOf( base ))
			return true;
		else
			return false;
	}
	
	ns.FilterList.prototype.toggleVisible = function( id, show ) {
		const self = this;
		const el = document.getElementById( id );
		if ( !el )
			return;
		
		el.classList.toggle( 'hidden', !show );
	}
	
	ns.FilterList.prototype.setList = function() {
		const self = this;
	}
	
})( library.component );


// mini menu
/*
originElement <DOM element> - element to align the menu to
parentId <DOM id string> - menu parent container, menu will be appended here
options <list> - menu entries, list of objects:
{
	event : <string> - will be returned in onselect when item is clicked
	name  : <string> - will be shown in the menu
	faIcon : <fa-icon class string>  - class of fa icon to show, defaults to 'fa-cube'
}

onselect <fn> - fires when an item is clicked

The menu will remove itself if it loses focus or a menu item is clicked
*/
(function( ns, undefined ) {
	ns.MiniMenu = function(
		templateManager,
		originElement,
		parentId,
		options,
		onselect
	) {
		const self = this;
		self.tmpl = templateManager;
		self.onselect = onselect;
		
		self.init( originElement, parentId, options );
	}
	
	// Public
	
	ns.MiniMenu.prototype.close = function() {
		const self = this;
		let el = self.el;
		if ( el ) {
			delete self.el;
			el.parentNode.removeChild( el );
		}
		
		delete self.tmpl;
		delete self.menu;
		delete self.onselect;
	}
	
	// Private
	
	ns.MiniMenu.prototype.init = function( originEl, parentId, options ) {
		const self = this;
		const viewWidth = document.body.clientWidth;
		const viewHeight = document.body.clientHeight;
		const middle = viewWidth / 2;
		const originPos = self.getoriginPosition( originEl );
		const align = self.getAlignment( middle, originPos );
		let x1 = null;
		let x2 = null;
		if ( 'left' === align )
			x1 = originPos.x1;
		else
			x2 = originPos.x2;
		
		const yCenter = self.getYCenter( originPos );
		self.id = friendUP.tool.uid( 'mm' );
		const tmplConf = {
			id : self.id,
		};
		self.el = self.tmpl.getElement( 'mini-menu-tmpl', tmplConf );
		self.menu = self.el.querySelector( '.mini-menu-content' );
		self.addOptions( options );
		
		if ( x1 )
			self.menu.style.right = viewWidth - x1;
		else
			self.menu.style.left = x2;
		
		const parent = document.getElementById( parentId );
		parent.appendChild( self.el );
		const ownHeight = self.menu.clientHeight;
		let maxHeight = ( viewHeight - 10 ) + 'px';
		let top = Math.floor( yCenter - ( ownHeight / 2 ));
		top = self.boundVerticalPosition( viewHeight, ownHeight, top );
		self.menu.style.maxHeight = maxHeight;
		self.menu.style.top = top;
		self.menu.focus();
		self.menu.addEventListener( 'blur', menuBlur, false );
		self.el.addEventListener( 'touchstart', touchStart, false );
		self.el.addEventListener( 'touchend', touchEnd, false );
		
		function menuBlur( e ) {
			self.close();
		}
		
		function touchStart( e ) {
			e.stopPropagation();
			e.preventDefault();
		}
		
		function touchEnd( e ) {
			e.stopPropagation();
			e.preventDefault();
			self.close();
		}
	}
	
	ns.MiniMenu.prototype.getoriginPosition = function( oEl ) {
		let bRekt = oEl.getBoundingClientRect();
		return {
			x1 : bRekt.x,
			x2 : bRekt.right,
			y1 : bRekt.y,
			y2 : bRekt.bottom,
		};
	}
	
	ns.MiniMenu.prototype.getAlignment = function( middle, origin ) {
		if ( origin.x2 < middle )
			return 'right';
		
		if ( origin.x1 > middle )
			return 'left';
		
		return 'right';
	}
	
	ns.MiniMenu.prototype.getYCenter = function( origin ) {
		return Math.floor(( origin.y1 + origin.y2 ) / 2 );
	}
	
	ns.MiniMenu.prototype.boundVerticalPosition = function( viewH, ownH, currTop ) {
		if ( ownH > ( viewH - 10 ))
			return 5;
		
		if ( currTop < 10 )
			return 5;
		
		let bottomGap = viewH - ( ownH + currTop );
		if ( bottomGap < 0 )
			return (( currTop + bottomGap ) - 10 );
		
		if ( bottomGap < 10 ) // [0..10>
			return ( currTop + ( bottomGap - 10 ));
		
		return currTop;
	}
	
	ns.MiniMenu.prototype.addOptions = function( options ) {
		const self = this;
		options.forEach( opt => self.add(  opt ));
	}
	
	ns.MiniMenu.prototype.add = function( opt ) {
		const self = this;
		const event = opt.event;
		let conf = {
			name   : opt.name,
			faIcon : opt.faIcon || 'fa-cube',
		};
		let optEl = self.tmpl.getElement( 'mini-menu-option-tmpl', conf );
		if ( 'DESKTOP' === window.View.deviceType )
			optEl.addEventListener( 'click', optClick, false );
		else
			optEl.addEventListener( 'touchstart', optClick, false );
		
		self.menu.appendChild( optEl );
		
		function optClick( e ) {
			let onselect = self.onselect;
			if ( !onselect )
				return;
			
			delete self.onselect;
			onselect( event );
			self.close();
		}
	}
	
})( library.component );


/* mini menu actions */
(function( ns, undefined ) {
	ns.MiniMenuActions = function() {
		let self = this;
		self = {
			'hide' : {
				event  : 'hide',
				name   : View.i18n( 'i18n_hide_from_list' ),
				faIcon : 'fa-eye-slash',
			},
			'open-chat' : {
				event  : 'open-chat',
				name   : View.i18n( 'i18n_open_chat' ),
				faIcon : 'fa-comments',
			},
			'live-audio' : {
				event : 'live-audio',
				name   : View.i18n( 'i18n_go_live_audio' ),
				faIcon : 'fa-microphone',
			},
			'live-video' : {
				event : 'live-video',
				name   : View.i18n( 'i18n_go_live_video' ),
				faIcon : 'fa-video-camera',
			},
			'invite-video' : {
				event  : 'invite-video',
				name   : View.i18n( 'i18n_invite_to_video' ),
				faIcon : 'fa-video-camera',
			},
			'invite-audio' : {
				event  : 'invite-audio',
				name   : View.i18n( 'i18n_invite_to_audio' ),
				faIcon : 'fa-microphone',
			},
			'invite-room' : {
				event  : 'invite-room',
				name   : View.i18n( 'i18n_invite_to_room' ),
				faIcon : 'fa-cube',
			},
			'remove-contact' : {
				event  : 'remove-relation',
				name   : View.i18n( 'i18n_remove_contact' ),
				faIcon : 'fa-close',
			},
			'remove-chat' : {
				event  : 'remove-chat',
				name   : View.i18n( 'i18n_remove_chat' ),
				faIcon : 'fa-close',
			},
			'leave-room' : {
				event  : 'leave-room',
				name   : View.i18n( 'i18n_leave_room' ),
				faIcon : 'fa-sign-out',
			},
			'settings' : {
				event  : 'settings',
				name   : View.i18n( 'i18n_settings' ),
				faIcon : 'fa-cog',
			},
			'remove-module' : {
				event  : 'remove',
				name   : View.i18n( 'i18n_remove_module' ),
				faIcon : 'fa-close',
			},
			'add-contact' : {
				event  : 'add-contact',
				name   : View.i18n( 'i18n_add_contact' ),
				faIcon : 'fa-user-plus',
			},
			'reconnect' : {
				event  : 'reconnect',
				name   : View.i18n( 'i18n_reconnect' ),
				faIcon : 'fa-refresh',
			},
			'create-room' : {
				event  : 'create-room',
				name   : View.i18n( 'i18n_create_room' ),
				faIcon : 'fa-plus',
			},
			'console' : {
				event  : 'console',
				name   : View.i18n( 'i18n_console' ),
				faIcon : 'fa-tv',
			}
		};
		
		return self;
	};
})( library.component );

/* ListOrder
	
	order a list of DOM elements in a specific container,
	first on priority
	priority is 1 - 9, with 0 as no/lowest priority.
	1 is first prio and will be sorted to top
	
	elements are then ordered winthin the priority group by a set of properties
	The order-by properties default to [ time, name ], but a different set can be
	provided to the constructor
	
	the element must already be set in DOM before adding
	the element will be moved from its original location
	the element will not be removed from DOM by ListOrder.remove(),
		it will still be visible in the list, but not longer considered for sorting
*/
( function( ns, undefined ) {
	ns.ListOrder = function( listElId, orderBy ) {
		const self = this;
		if ( !orderBy || !orderBy.length )
			orderBy = [ 'time', 'name' ];
		
		self.list = null;
		self.orderBy = orderBy;
		self.prio = [];
		self.prio[ 0 ] = []; // 0, no prio

		self.init( listElId );
	}
	
	// Public
	
	/* add
		item should already be present in the DOM
		with a id matching itemConf.clientId
		
		itemConf : {
			clientId : <unique string>,
			priority : <number: 1, 2, ..., 9 >, optional, 0 is no priority
			time     : <int>, used for odering within a priority group,
			           takes precedence over name
			name     : <string>, used for ordering within a priority group
		}
	*/
	ns.ListOrder.prototype.add = function( itemConf ) {
		const self = this;
		if ( !itemConf ) {
			console.log( 'ListOrder.add - u wot m8?' );
			return;
		}
		
		const cId = itemConf.clientId;
		const el = document.getElementById( cId );
		if ( !el ) {
			console.log( 'ListOrder.add - no el found for', itemConf );
			return;
		}
		
		if ( self.checkIsAdded( cId ))
			self.update( itemConf );
		else
			self.addToPrio( itemConf );
	}
	
	/* update
		itemConf is same as for .add()
	*/
	ns.ListOrder.prototype.update = function( itemConf ) {
		const self = this;
		if ( !itemConf )
			return;
		
		const cId = itemConf.clientId;
		const el = document.getElementById( cId );
		if ( !el ) {
			console.log( 'ListOrder.update - no element for id, removing', itemConf );
			self.remove( cId );
			return;
		}
		
		self.updateInPrio( itemConf );
	}
	
	/* get
		returns the current config for a given element
	*/
	ns.ListOrder.prototype.get = function( clientId ) {
		const self = this;
		return self.getItem( clientId );
	}
	
	/* remove
		does not remove the element from DOM, only from being sorted in the list
	*/
	ns.ListOrder.prototype.remove = function( clientId ) {
		const self = this;
		let foundIn = null;
		self.prio.some( prio => {
			const index = prio.findIndex( item => {
				return item.id === clientId;
			});
			
			if ( -1 === index )
				return false;
			
			prio.splice( index, 1 );
			foundIn = prio;
			return true;
		});
		return !!foundIn;
	}
	
	ns.ListOrder.prototype.checkIsFirstItem = function( clientId ) {
		const self = this;
		const index = self.getItemIndex( clientId );
		return ( 0 === index );
	}
	
	ns.ListOrder.prototype.close = function() {
		const self = this;
	}
	
	// Private
	
	ns.ListOrder.prototype.init = function( listId ) {
		const self = this;
		self.list = document.getElementById( listId );
		if ( !self.list )
			throw new Error( 'ListOrder - could not init, no element found' );
		
		const children = self.list.children;
		if ( !children.length ) {
			self.children = [];
			return;
		}
		
		let i = children.length;
		for( ;!!i; ) {
			--i;
			const el = children[ i ];
			self.prio[ 0 ][ i ] = {
				id   : el.id,
				pri  : 0,
				time : 0,
				name : '',
			};
		}
	}
	
	ns.ListOrder.prototype.getItem = function( id ) {
		const self = this;
		let getItem = null;
		self.prio.some( prio => {
			return prio.some(( item ) => {
				if ( item.id !== id )
					return false;
				
				getItem = item;
				return true;
			});
		});
		
		return getItem;
	}
	
	ns.ListOrder.prototype.getItemIndex = function( id ) {
		const self = this;
		let itemIndex = null;
		self.prio.some( prio => {
			return prio.some(( item, index ) => {
				if ( item.id !== id )
					return false;
				
				itemIndex = index;
				return true;
			});
		});
		
		return itemIndex;
	}
	
	ns.ListOrder.prototype.checkIsAdded = function( id ) {
		const self = this;
		const index = self.getItemIndex( id );
		return index != null;
	}
	
	ns.ListOrder.prototype.addToPrio = function( conf ) {
		const self = this;
		const id = conf.clientId;
		let pri = self.normalizePriority( conf.priority );
		const time = conf.time || null;
		const name = conf.name || '';
		if ( !self.prio[ pri ])
			self.prio[ pri ] = [];
		
		const prio = self.prio[ pri ];
		prio.push({
			id   : id,
			time : time,
			name : name,
		});
		
		if ( ( null == time ) && ( '' === name )) {
			self.applyOrder( pri );
			return;
		}
		
		self.reorder( pri );
	}
	
	ns.ListOrder.prototype.updateInPrio = function( conf ) {
		const self = this;
		const id = conf.clientId;
		let pri = self.normalizePriority( conf.priority );
		const prio = self.prio[ pri ];
		if ( !prio ) {
			console.log( 'ListOrder.updateInPrio - prio not found', {
				conf : conf,
				pri  : pri,
				prio : self.prio,
			});
			return;
		}
		
		prio.some( item => {
			if ( item.id != id )
				return false;
			
			item.time = conf.time;
			item.name = conf.name;
			return true;
		});
		
		self.reorder( pri );
	}
	
	ns.ListOrder.prototype.reorder = function( pri  ) {
		const self = this;
		const prio = self.prio[ pri ];
		if ( !prio ) {
			console.log( 'ListOrder.reorder - no prio found', {
				pri  : pri,
				prio : self.prio,
			});
			return;
		}
		
		prio.sort(( a, b ) => {
			let res = 0;
			if ( null != a.time )
				res = sortByTime( a, b );
			else
				res = sortByName( a, b );
			
			return res;
		});
		
		
		self.applyOrder( pri );
		
		function sortByTime( a, b ) {
			at = a.time || 0;
			bt = b.time || 0;
			if ( at < bt )
				return 1;
			if ( at > bt )
				return -1;
			
			if ( a.name && b.name )
				return sortByName( a, b );
			else
				return 0;
		}
		
		function sortByName( a, b ) {
			if ( !a.name || !b.name )
				return 0;
			
			const an = a.name.toLowerCase();
			const bn = b.name.toLowerCase();
			if ( '' === an )
				return -1;
			if ( '' === bn )
				return 1;
			if ( an < bn )
				return -1;
			if ( an > bn )
				return 1;
			return 0;
		}
	}
	
	ns.ListOrder.prototype.applyOrder = function( pri ) {
		const self = this;
		const prio = self.prio[ pri ];
		if ( !prio )
			return;
		
		if ( 0 === pri ) {
			reapply( null, prio );
			return;
		}
		
		const nextIndex = self.getNextPri( pri );
		const nextPrio = self.prio[ nextIndex ];
		const nextFirstItem = nextPrio[ 0 ];
		let nextEl = null
		if ( nextFirstItem )
			nextEl = document.getElementById( nextFirstItem.id );
		
		reapply( nextEl, prio );
		
		function reapply( before, list ) {
			list.forEach( item => {
				id = item.id;
				const el = document.getElementById( id );
				if ( !el ) {
					console.log( 'listOrder.applyOrder, apply - no el for', {
						item  : item,
						shelf : self,
					});
					return;
				}
				self.list.insertBefore( el, before );
			});
		}
	}
	
	ns.ListOrder.prototype.getNextPri = function( basePrio ) {
		const self = this;
		let getNext = false;
		let prevPrio = null;
		let nextPrio = null;
		self.prio.some(( prio, index ) => {
			if ( getNext ) {
				nextPrio = index;
				return true;
			}
			
			if ( basePrio === index )
				getNext = true;
			else
				prevPrio = index;
		});
		
		return nextPrio || 0;
	}
	
	ns.ListOrder.prototype.getFirstPri = function() {
		const self = this;
		let firstPrio = 0;
		self.prio.some(( prio, index ) => {
			if ( 0 == index )
				return false;
			
			//const prio = self.prio[ index ];
			if ( !prio.length )
				return false;
			
			firstPrio = index;
			return true;
		});
		return firstPrio;
	}
	
	ns.ListOrder.prototype.normalizePriority = function( pri ) {
		if ( null == pri )
			return 0;
		
		pri = pri || 0;
		if ( pri > 9 )
			pri = 0;
		
		return pri;
	}
	
})( library.component );
