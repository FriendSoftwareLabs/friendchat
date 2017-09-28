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
		if ( !( this instanceof ns.StatusIndicator ))
			return new ns.StatusIndicator( conf );
		
		var self = this;
		self.containerId = conf.containerId;
		self.type = conf.type;
		self.cssClass = conf.cssClass;
		self.inner = null;
		self.statusMap = conf.statusMap;
		self.state = 'hamsters';
		
		self.initIndicator();
	}
	
	ns.StatusIndicator.prototype.typeTmplMap = {
		'led' : 'status-indicator-led-tmpl',
		'icon' : 'status-indicator-icon-tmpl',
	};
	
	ns.StatusIndicator.prototype.initIndicator = function() {
		var self = this;
		if ( !hello.template )
			throw new Error( 'hello.template not defined' );
		
		var tmplId = self.typeTmplMap[ self.type ] || self.typeTmplMap[ 'led' ];
		var container = document.getElementById( self.containerId );
		var conf = {
			indicatorClass : self.cssClass,
		};
		var element = hello.template.getElement( tmplId, conf );
		container.appendChild( element );
		self.bind();
	}
	
	ns.StatusIndicator.prototype.bind = function() {
		var self = this;
		var container = document.getElementById( self.containerId );
		self.inner = container.querySelector('.status-indicator .' + self.cssClass );
		var stateKeys = Object.keys( self.statusMap );
		self.state = stateKeys[ 0 ];
		self.inner.classList.add( self.statusMap[ self.state ]);
	}
	
	ns.StatusIndicator.prototype.set = function( stateKey ) {
		var self = this;
		if ( !stateKey ) {
			console.log( 'no statekey', stateKey );
			return;
		}
		
		var stateKey = stateKey.toString();
		if ( !self.statusMap[ stateKey ]) {
			console.log( 'statusIndicator.set - unknown state');
			console.log( stateKey );
			return;
		}
		
		self.state = stateKey
		removeCurrentClass();
		addNewStateClass();
		
		function removeCurrentClass() {
			var parts = self.inner.className.split( ' ' );
			parts.pop(); // remove last
			self.inner.className = parts.join( ' ' );
		}
		
		function addNewStateClass() {
			self.inner.classList.add( self.statusMap[ stateKey ]);
		}
	}
	
	ns.StatusIndicator.prototype.get = function() {
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
		var self = this;
		self.displayArea.textContent = self.display;
	}
	
	ns.StatusDisplay.prototype.bind = function() {
		var self = this;
		var container = document.getElementById( self.containerId );
		self.inner = container.querySelector('.status-display .' + self.cssClass );
		self.displayArea = container.querySelector( '.status-display .display-area' );
		
		var stateKeys = Object.keys( self.statusMap );
		self.state = stateKeys[ 0 ];
		self.inner.classList.add( self.statusMap[ self.state ]);
	}
	
})( library.component );


// BOTTOMSCROLLER
(function( ns, undefined ) {
	ns.BottomScroller = function( elementId, conf  ) {
		if ( !( this instanceof ns.BottomScroller ))
			return new ns.BottomScroller( elementId, conf );
		
		if ( !elementId )
			throw new Error( 'library.component.BottomScroller requires a elementId' );
		
		conf = conf || {};
		
		var self = this;
		self.elementId = elementId; // the element being scrolled, as opposed to its viewport / container
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
		var self = this;
		
		self.element = document.getElementById( self.elementId );
		self.element.addEventListener( 'scroll', scrollEvent, false );
		window.addEventListener( 'resize', resizeEvent, false );
		function scrollEvent( e ) { self.checkIsAtBottom( e ); }
		function loadedEvent( e ) { console.log( 'BottomScroller.loadedevent', e ); }
		function resizeEvent( e ) {
			self.handleResize();
		}
		
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
	
	ns.BottomScroller.prototype.handleResize = function() {
		var self = this;
		self.updateScrollTreshold();
		self.scrollToBottom();
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
		else
			console.log( 'duplicate', { prev : prev, str : str });
		
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
		console.log( 'maybeShowOlder', value );
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
			'image'  : image,
			'audio'  : audio,
			'video'  : video,
			'text'   : file,
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
				console.log( 'reqProgress', e );
			}
			
			function reqReadyState( e ) {
				var ev = JSON.stringify( e );
				var headers = req.getAllResponseHeaders();
				if ( !headers.length )
					return;
				
				console.log( 'headers', headers );
				var mime = getContentType( headers );
				if ( !mime )
					return;
				
				req.abort();
				resolve( mime );
			}
			
			function getContentType( headerStr ) {
				const headers = headerStr.split( /\r\n/ );
				//console.log( 'LE - headers', headers );
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
			file    : file,
			content : content,
		};
		
		var el = self.template.getElement( 'link-expand-tmpl', conf );
		var parent = a.parentNode;
		parent.removeChild( a );
		parent.appendChild( el );
	}
	
	ns.LinkExpand.prototype.expandImage = function( a ) {
		var self = this;
		var src = a.href;
		var conf = {
			src : src,
		};
		var htmlStr = self.template.get( 'image-expand-tmpl', conf );
		return htmlStr;
	}
	
	ns.LinkExpand.prototype.expandAudio = function( a ) {
		var self = this;
		var src = a.href;
		var conf = {
			src : src,
		};
		var htmlStr = self.template.get( 'audio-expand-tmpl', conf );
		return htmlStr;
	}
	
	ns.LinkExpand.prototype.expandVideo = function( a ) {
		var self = this;
		var src = a.href;
		var conf = {
			src : src,
		};
		var htmlStr = self.template.get( 'video-expand-tmpl', conf );
		return htmlStr;
	}
	
	ns.LinkExpand.prototype.expandFile = function( a, mime ) {
		var self = this;
		console.log( 'expandFile', {
			a : a,
			m : mime,
		});
		
		return '';
		
		typeClass = 'File';
		if ( mime && mime.ext )
			typeClass = 'Type' + mime.ext.toUpperCase();
		
		var conf = {
			typeClass : typeClass
		};
		var htmlStr = self.template.get( 'file-expand-tmpl', conf );
		return htmlStr;
	}
	
	ns.LinkExpand.prototype.expandText = function( a, mime ) {
		var self = this;
		console.log( 'expandText', a );
		return null;
		//return a.href;
	}
	
	ns.LinkExpand.prototype.expandOther = function( a, mime ) {
		var self = this;
		console.log( 'expandOther', {
			a : a,
			m : mime });
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
		//self.tHeight = self.target.scrollHeight;
		//self.vpHeight = self.viewport.scrollHeight;
		var touch = e.touches[ 0 ];
		//console.log( 'tStart', touch );
		self.prevY = touch.pageY;
		self.prevX = touch.pageX;
	}
	
	ns.TouchScroll.prototype.tMove = function( e ) {
		var self = this;
		var touch = e.touches[ 0 ];
		//console.log( 'tMove - prev', self.prevY );
		//console.log( 'tMove - curr', touch.pageY );
		var deltaY = self.prevY - touch.pageY;
		var deltaX = self.prevX - touch.pageX;
		self.prevY = touch.pageY;
		self.prevX = touch.pageX;
		
		// lets not do anything with a swipe ( left / right )
		if ( deltaX > deltaY )
			return true;
		
		e.preventDefault();
		e.stopPropagation();
		//console.log( 'tMove - delta', delta );
		self.target.scrollTop = self.target.scrollTop + deltaY;
	}
	
	ns.TouchScroll.prototype.tEnd = function( e ) {
		var self = this;
		var touch = e.touches[ 0 ];
		//console.log( 'tEnd', touch );
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
		
		var self = this;
		self.containerId = conf.containerId;
		self.singleOnly = !!conf.singleOnly;
		self.multiIsOn = !!conf.multiIsOn;
		self.template = conf.templateManager;
		self.onsubmit = conf.onsubmit;
		self.onstate = conf.onstate;
		self.onmode = conf.onmode || null;
		
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
		const current = self.ta.value;
		self.ta.value = current + str;
	}
	
	ns.MultiInput.prototype.focus = function() {
		var self = this;
		self.ta.focus();
	}
	
	ns.MultiInput.prototype.setValue = function( string ) {
		var self = this;
		self.ta.value = string;
	}
	
	ns.MultiInput.prototype.getValue = function() {
		var self = this;
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
		delete self.template;
		delete self.onsubmit;
		delete self.onstate;
		delete self.onmode;
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
		var inputEl = self.template.getElement( self.inputTmpl, {} );
		cont.appendChild( inputEl );
		self.isTypingHint = document.getElementById( 'typing-hint' );
		self.ta = inputEl.querySelector( 'textarea' );
		
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
		self.doSubmit( e );
		return false;
	}
	
	ns.MultiInput.prototype.handleSpecialEnter = function( e ) {
		var self = this;
		// a newline was inserted in text area
		return true;
	}
	
	ns.MultiInput.prototype.doSubmit = function( e ) {
		var self = this;
		if ( e ) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		self.clearIsTyping();
		
		let str = self.ta.value;
		if ( str.length && self.onsubmit )
			self.onsubmit( str );
		
		self.setValue( '' );
		self.focus();
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
		
		console.log( 'MsgBuilder', conf );
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
		//console.log( 'MsgBuilder.log', msg );
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
		console.log( 'MsgBuilder.init =^______^=' );
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
		
		/*
		console.log( 'MsgBuilder.buildMessage', { 
			data : data,
			tmplId : tmplId,
			el : element,
			conf : conf });
		*/
		
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

