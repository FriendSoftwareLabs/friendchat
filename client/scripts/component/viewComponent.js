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
		
		const self = this;
		self.parentId = parentId || 'form';
		self.templateId = 'form-overlay-tmpl';
		self.overlayId = 'form-overlay';
		self.parent = null;
		self.element = null;
		self.msgContainer = null;
		self.init();
	}
	
	ns.FormOverlay.prototype.init = function() {
		const self = this;
		self.parent = document.getElementById( self.parentId );
		self.build();
	}
	
	ns.FormOverlay.prototype.build = function() {
		const self = this;
		var overlayElement = hello.template.getElement( self.templateId );
		self.parent.appendChild( overlayElement );
		self.bind();
	}
	
	ns.FormOverlay.prototype.bind = function() {
		const self = this;
		self.element = document.getElementById( self.overlayId );
		self.msgContainer = self.element.querySelector( '.message-container' );
		self.spinner = self.element.querySelector( '.spinner' );
	}
	
	ns.FormOverlay.prototype.show = function() {
		const self = this;
		self.msgContainer.innerHTML = '';
		self.msgContainer.classList.toggle( 'hidden', true );
		self.spinner.classList.toggle( 'hidden', false );
		self.element.classList.toggle( 'hidden', false );
		self.element.focus();
	}
	
	ns.FormOverlay.prototype.hide = function() {
		const self = this;
		self.element.classList.toggle( 'hidden', true );
	}
	
	ns.FormOverlay.prototype.success = function( msg, callback ) {
		const self = this;
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
		const self = this;
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
		const self = this;
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
		
		const self = this;
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
		const self = this;
		self.build();
		self.setMenu();
	};
	
	ns.OptionMenu.prototype.build = function() {
		const self = this;
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
		const self = this;
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
		const self = this;
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
		const self = this;
		if ( event )
			setPos( event.pageY );
		
		show();
		
		function setPos( fromTop ) {}
		function show() { self.menu.classList.toggle( 'show', true ); }
	}
	
	ns.OptionMenu.prototype.hide = function() {
		const self = this;
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
		self.tooltip = conf.tooltip || '';
		self.inner = null;
		self.statusMap = conf.statusMap;
		self.state = 'hamsters';
		
		self.initIndicator();
	}
	
	ns.StatusIndicator.prototype = Object.create( 
		library.component.EventEmitter.prototype );
	
	ns.StatusIndicator.prototype.typeTmplMap = {
		'led'     : 'status-indicator-led-tmpl',
		'icon'    : 'status-indicator-icon-tmpl',
		'icon-bg' : 'status-indicator-icon-bg-tmpl',
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
			tooltip : self.tooltip,
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
			tooltip       : self.tooltip,
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
		const current = self.statusMap[ self.state ];
		const update = self.statusMap[ stateKey ];
		if ( current === update )
			return;
		
		if ( current && current.length )
			self.inner.classList.toggle( current, false );
		
		if ( null == update ) {
			self.state = null;
			console.log( 'statusIndicator.set - unknown state', {
				key    : stateKey,
				states : self.statusMap,
			});
			return;
		}
		
		self.state = stateKey
		if ( !update.length )
			return;
		
		self.inner.classList.toggle( update, true );
	}
	
	ns.StatusIndicator.prototype.getState = function() {
		return this.state;
	}
	
})( library.component );


// Extends StatusIndicator with a display field
(function( ns, undefined ) {
	ns.StatusDisplay = function( conf ) {
		
		const self = this;
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
		const self = this;
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
		const self = this;
		self.reposition();
		
		/*
		mutations.forEach( handle );
		function handle( mutation ) {
			var isAdded = !!mutation.addedNodes.length;
			if ( isAdded )
				self.bindLoad( mutation.addedNodes );
		}
		*/
	}
	
	ns.BottomScroller.prototype.bindLoad = function( nodes ) {
		const self = this;
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
		const self = this;
		var viewport = self.element.parentNode;
		var sH = viewport.scrollHeight;
		var sTP = self.scrollTresholdPercent;
		self.scrollTreshold = ( sH * sTP ) / 100;
	}
	
	ns.BottomScroller.prototype.checkIsAtBottom = function( e ) {
		const self = this;
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
		const self = this;
		if ( !self.scrollAtBottom )
			return;
		
		self.scrollToBottom();
	}
	
	ns.BottomScroller.prototype.scrollToBottom = function() {
		const self = this;
		self.element.scrollTop = self.element.scrollHeight;
	}
	
})( library.component );

// FOLDIT

(function( ns, undefined ) {
	ns.Foldit = function( conf ) {
		if ( !( this instanceof ns.Foldit ))
			return new ns.Foldit( conf );
		
		const self = this;
		self.folderId = conf.folderId;
		self.foldeeId = conf.foldeeId;
		
		self.setup( conf.startClosed );
	}
	
	ns.Foldit.prototype.up = function() {
		const self = this;
		self.togglePosition( true );
	}
	
	ns.Foldit.prototype.down = function() {
		const self = this;
		self.togglePosition( false );
	}
	
	// PRIVATE
	
	ns.Foldit.prototype.setup = function( startClosed ) {
		const self = this;
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
		const self = this;
		var element = hello.template.getElement( 'foldit-tmpl' );
		self.stateContainer.appendChild( element );
	}
	
	ns.Foldit.prototype.bindEvents = function() {
		const self = this;
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
		const self = this;
		if ( isUp() )
			self.down();
		else
			self.up();
		
		function isUp() {
			return self.foldee.classList.contains( 'fold' );
		}
	}
	
	ns.Foldit.prototype.togglePosition = function( setUp ) {
		const self = this;
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
		
		const self = this;
		self.element = conf.element;
		self.containerId = conf.containerId;
	}
	
	ns.Guide.prototype.show = function() {
		const self = this;
		var exists = document.getElementById( self.element.id );
		if ( exists )
			return;
		
		var container = document.getElementById( self.containerId );
		container.appendChild( self.element );
	}
	
	ns.Guide.prototype.hide = function() {
		const self = this;
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
		
		const self = this;
		self.element = conf.element || null;
		self.containerId = conf.containerId;
		
		self.init();
	}
	
	ns.InfoBox.prototype.init = function() {
		const self = this;
		if ( self.element )
			self.show();
	}
	
	// public
	
	ns.InfoBox.prototype.show = function( element, tmplId ) {
		const self = this;
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
		const self = this;
		var inputs = self.element.querySelectorAll( 'input, button' );
		var firstInput = inputs[ 0 ];
		if ( firstInput )
			firstInput.focus();
	}
	
	ns.InfoBox.prototype.hide = function() {
		const self = this;
		self.remove();
		self.tmplId = null;
		self.toggleSiblings( true );
	}
	
	// private
	
	ns.InfoBox.prototype.isSet = function( elementId ) {
		const self = this;
		var exists = document.getElementById( elementId );
		return !!exists;
	}
	
	ns.InfoBox.prototype.remove = function() {
		const self = this;
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
		
		const self = this;
		self.inputId = conf.inputId;
		self.limit = conf.limit || 50;
		self.history = [];
		self.index = 0;
		self.init();
	}
	
	ns.InputHistory.prototype.init = function() {
		const self = this;
		self.actionMap = {
			//'ArrowUp'        : maybeShowOlder,
			'shiftArrowUp'   : older,
			'shiftArrowDown' : newer,
			'ctrlArrowUp'    : oldest,
			'ctrlArrowDown'  : newest,
		};
		
		//function maybeShowOlder() { return self.maybeShowOlder(); }
		function older()          { return self.showOlder(); }
		function newer()          { return self.showNewer(); }
		function oldest()         { return self.showOldest(); }
		function newest()         { return self.showNewest(); }
		
		self.input = document.getElementById( self.inputId );
		self.input.addEventListener( 'keydown', keyDown, false );
		function keyDown( e ) { self.handleKey( e ); }
	}
	
	ns.InputHistory.prototype.handleKey = function( e ) {
		const self = this;
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
		const self = this;
		var prev = self.history[( self.history.length - 1 )];
		if ( prev !== str )
			self.history.push( str );
		
		if ( self.history.length > ( self.limit + 10 )) // lets not do a slice every time
			self.history = self.history.slice( -self.limit ); // from 'end', aka keep newer
		
		self.index = self.history.length;
	}
	
	ns.InputHistory.prototype.clear = function() {
		const self = this;
		self.history = [];
		self.index = self.history.length;
		self.setInput();
	}
	
	ns.InputHistory.prototype.maybeShowOlder = function() {
		const self = this;
		return true;
		
		/*
		const value = self.input.value;
		if ( value )
			return true;
		
		return self.showOlder();
		*/
	}
	
	ns.InputHistory.prototype.showOlder = function() {
		const self = this;
		self.index = self.index -1;
		self.setInput();
	}
	
	ns.InputHistory.prototype.showNewer = function() {
		const self = this;
		self.index = self.index + 1;
		self.setInput();
	}
	
	ns.InputHistory.prototype.showOldest = function() {
		const self = this;
		self.index = 0;
		self.setInput();
	}
	
	ns.InputHistory.prototype.showNewest = function() {
		const self = this;
		self.index = self.history.length - 1;
		self.setInput();
	}
	
	ns.InputHistory.prototype.setInput = function() {
		const self = this;
		var str = self.getStr();
		self.input.value = str;
		self.input.setSelectionRange( 0, 0 );
	}
	
	ns.InputHistory.prototype.boundIndex = function() {
		const self = this;
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
		const self = this;
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
		
		const self = this;
		self.defaultCssClass = defaultCssClass;
		
		self.init();
	}
	
	ns.Flourish.prototype.init = function() {
		const self = this;
	}
	
	ns.Flourish.prototype.do = function( element, cssClass ) {
		const self = this;
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
		
		const self = this;
		self.hlClass = conf.cssClass;
		self.checks = conf.checks || [];
		self.listener = conf.listener;
		self.RX = null;
		
		self.init();
	}
	ns.Highlight.prototype.check = function( str, element ) {
		const self = this;
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
		const self = this;
		self.checks.push( str );
		self.updateCheckRX();
	}
	
	ns.Highlight.prototype.setCheck = function( str ) {
		const self = this;
		self.checks = [];
		self.checks.push( str );
		self.updateCheckRX();
	}
	
	ns.Highlight.prototype.removeCheck = function( str ) {
		const self = this;
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
		const self = this;
		if ( self.check.length )
			self.updateCheckRX();
	}
	
	ns.Highlight.prototype.updateCheckRX = function() {
		const self = this;
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
			
		const self = this;
		self.template = conf.templateManager; // should be pre-loaded with relevant fragments
		
		self.init();
	}
	
	// Public
	
	ns.LinkExpand.prototype.work = function( el ) {
		const self = this;
		const links = el.querySelectorAll( 'a' );
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
				
				var conf = handler( a, mime );
				if ( !conf )
					return null;
				
				self.replace( a, conf );
			}
			
			function failed( err ) {
				//console.log( 'LE.mime.failed', err );
			}
		}
	}
	
	// private
	
	ns.LinkExpand.prototype.init = function() {
		const self = this;
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
		const self = this;
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
		const self = this;
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
	ns.LinkExpand.prototype.replace = function( a, conf ) {
		const self = this;
		const content = conf.content;
		const onClick = conf.onClick;
		const src = a.href;
		const fileMatch = src.match( /\/([-_%\w\s]+\.[\w]+)$/i);
		let file = null;
		if ( fileMatch )
			file = fileMatch[ 1 ];
		else
			file = src;
		
		file = window.decodeURIComponent( file );
		const elConf = {
			href : a.href,
			file : file
		};
		
		const el = self.template.getElement( 'link-expand-tmpl', elConf );
		el.querySelector( '.link-expand-content' )
			.appendChild( content );
		
		const parent = a.parentNode;
		parent.removeChild( a );
		parent.appendChild( el );
		
		if ( null == onClick )
			return;
		
		const headA = el.querySelector( '.link-expand-ui a' );
		if ( null == headA )
			return;
		
		headA.addEventListener( 'click', onClick, false );
	}
	
	ns.LinkExpand.prototype.expandImage = function( a, mime ) {
		const self = this;
		const src = a.href;
		const conf = {
			src : src,
		};
		const htmlElement = self.template.getElement( 'image-expand-tmpl', conf );
		htmlElement.addEventListener( 'click', onClick, false );
		return {
			content : htmlElement,
			onClick : onClick,
		}
		
		function onClick( e ) {
			const t = e.target;
			const tName = t.tagName;
			console.log( 'onClick', {
				e     : e,
				t     : t,
				tName : tName,
			});
			if ( 'IMG' != tName )
				return;
			
			e.preventDefault();
			e.stopPropagation();
			self.sendOpen( src );
		}
	}
	
	ns.LinkExpand.prototype.expandAudio = function( a, mime ) {
		const self = this;
		const src = a.href;
		const conf = {
			src : src,
		};
		const htmlElement = self.template.getElement( 'audio-expand-tmpl', conf );
		return {
			content : htmlElement,
		};
	}
	
	ns.LinkExpand.prototype.expandVideo = function( a, mime ) {
		const self = this;
		const src = a.href;
		const conf = {
			src : src,
		};
		const htmlElement = self.template.getElement( 'video-expand-tmpl', conf );
		return {
			content : htmlElement,
		};
	}
	
	ns.LinkExpand.prototype.expandFile = function( a, mime ) {
		const self = this;
		return {
			content : '',
		};
		
		/*
		typeClass = 'File';
		if ( mime && mime.ext )
			typeClass = 'Type' + mime.ext.toUpperCase();
		
		var conf = {
			typeClass : typeClass
		};
		var htmlElement = self.template.getElement( 'file-expand-tmpl', conf );
		return htmlElement;
		*/
	}
	
	ns.LinkExpand.prototype.expandText = function( a, mime ) {
		const self = this;
		return {
			content : null,
		};
		//return a.href;
	}
	
	ns.LinkExpand.prototype.expandOther = function( a, mime ) {
		const self = this;
		return {
			content : null,
		};
		//return a.href;
	}
	
	ns.LinkExpand.prototype.sendOpen = function( src ) {
		const self = this;
		console.log( 'LinkExpand.sendOpen', src );
		window.View.sendBase({
			type   : 'dos',
			method : 'openWindowByFilename',
			args   : {
				fileInfo: {
					Path: src
				},
				//ext: 'jpg',
			},
		});
	}
	
	
})( library.component );


// TouchScroll
(function( ns, undefined ) {
	ns.TouchScroll = function( elementId ) {
		if ( !( this instanceof ns.TouchScroll ))
			return new ns.TouchScroll( elementId );
		
		const self = this;
		self.elId = elementId;
		
		self.init();
	}
	
	ns.TouchScroll.prototype.init = function() {
		const self = this;
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
		const self = this;
		var touch = e.touches[ 0 ];
		self.prevY = touch.pageY;
		self.prevX = touch.pageX;
	}
	
	ns.TouchScroll.prototype.tMove = function( e ) {
		const self = this;
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
		const self = this;
		var touch = e.touches[ 0 ];
	}
	
	ns.TouchScroll.prototype.close = function() {
		const self = this;
		// unregister all the things
	}
	
})( library.component );


// multiline input
(function( ns, undefined ) {
	ns.MultiInput = function( conf ) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.containerId = conf.containerId;
		self.singleOnly = !!conf.singleOnly;
		self.multiIsOn = !!conf.multiIsOn;
		self.enterIsNewline = !!conf.enterIsNewline;
		self.template = conf.templateManager;
		
		self.currentTAHeight = '';
		self.currentInput = '';
		self.isTyping = false;
		
		self.init();
	}
	
	ns.MultiInput.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	ns.MultiInput.prototype.inputTmpl = 'multiline-input-tmpl';
	
	// Public
	
	ns.MultiInput.prototype.submit = function() {
		const self = this;
		self.doSubmit();
	}
	
	ns.MultiInput.prototype.add = function( str ) {
		const self = this;
		if ( !self.ta )
			return;
		
		if ( !str || !str.length )
			return;
		
		const current = self.ta.value;
		const update = current + str;
		self.ta.value = update;
		self.checkChange();
	}
	
	ns.MultiInput.prototype.focus = function() {
		const self = this;
		if ( !self.ta )
			return;
		
		self.ta.focus();
	}
	
	ns.MultiInput.prototype.setValue = function( string ) {
		const self = this;
		if ( !self.ta )
			return;
		
		if ( !string )
			string = '';
		
		self.ta.value = string;
		self.checkLineBreaks();
		self.checkChange();
	}
	
	ns.MultiInput.prototype.getValue = function() {
		const self = this;
		if ( !self.ta )
			return;
		
		return self.ta.value;
	}
	
	ns.MultiInput.prototype.getCursorPos = function() {
		const self = this;
		return self.ta.selectionStart;
	}
	
	ns.MultiInput.prototype.getElement = function() {
		const self = this;
		return self.taWrap;
	}
	
	ns.MultiInput.prototype.toggleMultiline = function( force ) {
		const self = this;
		if ( null == force )
			self.multiIsOn = !self.multiIsOn;
		else
			self.multiIsOn = !!force;
		
		self.emit( 'multiline', self.multiIsOn );
	}
	
	ns.MultiInput.prototype.setSingleOnly = function( singleOnly ) {
		const self = this;
		self.singleOnly = !!singleOnly;
	}
	
	ns.MultiInput.prototype.close = function() {
		const self = this;
		self.closeEventEmitter();
		delete self.containerId;
		delete self.enterIsNewline;
		delete self.template;
		delete self.taWrap;
		delete self.ta;
	}
	
	// Private
	
	ns.MultiInput.prototype.init = function() {
		const self = this;
		// setup
		self.keyMap = {
			'Tab'        : e => self.handleTab( e ),
			'Enter'      : e => self.handleEnter( e ),
			'ArrowUp'    : e => self.handleAUp( e ),
			'ArrowDown'  : e => self.handleADown( e ),
			'shiftTab'   : e => self.handleSpecialTab( e ),
			'shiftEnter' : e => self.handleSpecialEnter( e ),
		};
		
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
		self.checkChange();
	}
	
	ns.MultiInput.prototype.handleKeyDown = function( e ) {
		const self = this;
		let eventStr = '';
		if ( e.ctrlKey )
			eventStr = 'ctrl';
		
		if ( e.shiftKey )
			eventStr = 'shift';
		
		eventStr += e.code || e.key;
		const handler = self.keyMap[ eventStr ];
		if ( !handler ) {
			self.checkIsTyping();
			return;
		}
		
		const notSubmit = handler( e );
		if ( notSubmit )
			self.checkIsTyping();
	}
	
	ns.MultiInput.prototype.handleTab = function( e ) {
		const self = this;
		const used = self.emit( 'tab', e );
		return true;
	}
	
	ns.MultiInput.prototype.handleSpecialTab = function( e ) {
		const self = this;
		e.preventDefault();
		const currInput = self.ta.value;
		const newInput = currInput + '\t';
		self.ta.value = newInput;
		return true;
	}
	
	ns.MultiInput.prototype.handleAUp = function( e ) {
		const self = this;
		const value = self.ta.value;
		const used = self.emit( 'arrow', 'up', value );
		if ( !used )
			return true;
		
		if ( '' != self.currentTAHeight )
			return true;
		
		e.preventDefault();
		e.stopPropagation();
		
		return true;
	}
	
	ns.MultiInput.prototype.handleADown = function( e ) {
		const self = this;
		const value = self.ta.value;
		const used = self.emit( 'arrow', 'down', value );
		if ( !used )
			return true;
		
		e.preventDefault();
		e.stopPropagation();
		
		return true;
	}
	
	ns.MultiInput.prototype.handleEnter = function( e ) {
		const self = this;
		const used = self.emit( 'enter', e );
		if ( used ) {
			e.preventDefault();
			e.stopPropagation();
			return true;
		}
		
		if ( self.enterIsNewline ) {
			const addLB = true;
			self.checkLineBreaks( addLB );
			return true;
		} else {
			self.doSubmit( e );
			return false;
		}
	}
	
	ns.MultiInput.prototype.handleSpecialEnter = function( e ) {
		const self = this;
		// a newline was inserted in text area
		const addLB = true;
		self.checkLineBreaks( addLB );
		return true;
	}
	
	ns.MultiInput.prototype.doSubmit = function( e ) {
		const self = this;
		if ( e ) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		self.clearIsTyping();
		if ( !self.ta )
			return;
		
		let str = self.ta.value;
		self.emit( 'submit', str );
		
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
		
		if ( 3 === num )
			newHeight = 'three-lines';
		
		if ( 4 <= num )
			newHeight = 'four-lines';
		
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
		
		sendTyping();
		if ( null == self.typingInterval )
			self.typingInterval = window.setInterval( sendTyping, 1000 * 8 );
		
		function sendTyping() {
			const event = {
				type : 'set-typing',
				data : null,
			};
			self.emit( 'state', event );
		}
	}
	
	ns.MultiInput.prototype.clearIsTyping = function() {
		const self = this;
		if ( !self.isTyping )
			return;
		
		self.isTyping = false;
		if ( null != self.typingInterval )
			window.clearInterval( self.typingInterval );
		
		if ( self.isTypingHint )
			self.isTypingHint.classList.toggle( 'blink-icon', false );
		
		const event = {
			type : 'clear-typing',
			data : null,
		};
		self.emit( 'state', event );
	}
	
	ns.MultiInput.prototype.checkChange = function() {
		const self = this;
		const inputStr = self.ta.value;
		const inputPos = self.ta.selectionStart;
		const inputSelection = self.ta.selectionStart !== self.ta.selectionEnd;
		/*
		console.log( 'checkChange', {
			inputStr : inputStr,
			inputPos : inputPos,
			inputSelection : inputSelection,
			currentStr : self.currentInput,
			currentPos : self.currentPos,
		});
		*/
		let strChange = false;
		if ( inputStr !== self.currentInput )
			strChange = true;
		
		if ( !strChange )
			return;
		
		const conf = {
			string    : inputStr,
			caretPos  : inputPos,
			selection : inputSelection,
		};
		
		self.currentInput = inputStr;
		self.emit( 'change', conf );
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.ModMock = function() {
		const self = this;
		
		self.init();
	}
	
	// Public
	
	ns.ModMock.prototype.parse = function( str ) {
		const self = this;
		console.log( 'ModMock.parse', str );
		return null;
	}
	
	ns.ModMock.prototype.close = function() {
		const self = this;
	}
	
	// Private
	
	ns.ModMock.prototype.init = function() {
		const self = this;
		console.log( 'ModMock.init' );
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.MsgBuilder = function( conf )  {
		if ( !( this instanceof ns.MsgBuilder ))
			return new ns.MsgBuilder( conf );
		
		const self = this;
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
		const self = this;
		return self.buildMessage( msg, self.messageTmpl );
	}
	
	ns.MsgBuilder.prototype.action = function( msg ) {
		const self = this;
		return self.buildMessage( msg, self.actionTmpl );
	}
	
	ns.MsgBuilder.prototype.notification = function( msg ) {
		const self = this;
		return self.buildNotification( msg );
	}
	
	ns.MsgBuilder.prototype.log = function( msg ) {
		const self = this;
		var handler = self.logHandlers[ msg.type ];
		if ( !handler ) {
			console.log( 'MsgBuilder.log - unknown log type', msg );
			return null;
		}
		
		return handler( msg.data );
	}
	
	ns.MsgBuilder.prototype.close = function() {
		const self = this;
		delete self.user;
		delete self.contact;
		delete self.parser;
		delete self.template;
		delete self.linkExpand;
	}
	
	// Private
	
	ns.MsgBuilder.prototype.init = function() {
		const self = this;
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
		const self = this;
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
		const self = this;
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
		itemList
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
		const originPos = self.getOriginPosition( originEl );
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
	
	ns.MiniMenu.prototype.getOriginPosition = function( oEl ) {
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
			'load-hidden' : {
				event  : 'load-hidden',
				name   : View.i18n( 'i18n_show_hidden' ),
				faIcon : 'fa-eye-slash',
			},
			'console' : {
				event  : 'console',
				name   : View.i18n( 'i18n_console' ),
				faIcon : 'fa-tv',
			},
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
	ns.ListOrder = function( listElId, orderBy, debug ) {
		const self = this;
		if ( !orderBy || !orderBy.length )
			orderBy = [ 'time', 'name' ];
		
		self.list = null;
		self.orderBy = orderBy;
		self.debug = debug || false;
		
		self.needsReorder = [];
		self.prio = [];
		self.prio[ 0 ] = []; // 0, no prio
		self.items = {};

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
		
		if ( self.debug )
			console.log( 'add', itemConf );
		
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
		
		if ( self.debug )
			console.log( 'update', itemConf );
		
		if ( null != itemConf.priority )
			self.changePrio( itemConf );
		
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
		
		delete self.items[ clientId ];
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
	
	ns.ListOrder.prototype.changePrio = function( conf ) {
		const self = this;
		const cId = conf.clientId;
		const item = self.items[ cId ];
		if ( !item ) {
			console.log( 'changePrio - no item for', {
				conf  : conf,
				items : self.items,
			});
			return;
		}
		
		const freshPri = self.normalizePriority( conf.priority );
		const currPri = item.pri;
		
		if ( currPri === freshPri )
			return;
		
		const prio = self.prio[ currPri ];
		const index = self.getItemIndex( cId );
		
		prio.splice( index, 1 );
		item.priority = freshPri;
		item.clientId = cId;
		const noReorder = true;
		self.addToPrio( item, noReorder );
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
		return !!self.items[ id ];
		/*
		const index = self.getItemIndex( id );
		return index != null;
		*/
	}
	
	ns.ListOrder.prototype.addToPrio = function( conf, noReorder ) {
		const self = this;
		const pri = self.normalizePriority( conf.priority );
		const id = conf.clientId;
		const item = {
			id  : id,
			pri : pri,
		};
		self.orderBy.forEach( type => {
			item[ type ] = conf[ type ];
		});
		if ( !self.prio[ pri ])
			self.prio[ pri ] = [];
		
		const prio = self.prio[ pri ];
		prio.push( item );
		self.items[ id ] = item;
		if ( self.debug )
			console.log( 'addToPrio', {
				confpri : conf.priority,
				pri     : pri,
				item    : item,
			});
		
		/*
		if ( ( null == time ) && ( '' === name )) {
			self.applyOrder( pri );
			return;
		}
		*/
		if ( noReorder )
			return;
		
		const el = document.getElementById( id );
		self.list.appendChild( el );
		self.reorder( pri );
	}
	
	ns.ListOrder.prototype.updateInPrio = function( conf ) {
		const self = this;
		const id = conf.clientId;
		const item = self.items[ id ];
		if ( !item ) {
			if ( self.debug )
				console.log( 'no item for', {
					conf  : conf,
					items : self.items,
				});
			
			return;
		}
		
		let pri = self.normalizePriority( item.pri );
		self.orderBy.forEach( t => {
			const val = conf[ t ];
			if ( undefined === val )
				return;
			
			item[ t ] = val;
		});
		
		if ( self.debug )
			console.log( 'updateInPrio', item );
		
		self.reorder( pri );
	}
	
	ns.ListOrder.prototype.reorder = function( pri  ) {
		const self = this;
		if ( self.debug )
			console.log( 'reorder', {
				pri          : pri,
				ontimeout    : !!self.reorderTimeout,
				needsReorder : self.needsReorder,
			});
				
		if ( null != self.reorderTimeout ) {
			window.clearTimeout( self.reorderTimeout );
			self.reorderTimeout = window.setTimeout( allowReorder, 250 );
			if ( -1 === self.needsReorder.indexOf( pri ))
				self.needsReorder.push( pri );
			
			return;
		}
		
		self.reorderTimeout = window.setTimeout( allowReorder, 250 );
		//self.needsReorder = [];
		self.doReorder( pri );
		
		function allowReorder() {
			self.reorderTimeout = null;
			if ( self.debug )
				console.log( 'allowReorder', self.needsReorder );
			
			if ( !self.needsReorder.length )
				return;
			
			self.needsReorder.sort();
			self.needsReorder.forEach( pri => {
				self.doReorder( pri );
			});
			
			self.needsReorder = [];
		}
	}
	
	ns.ListOrder.prototype.doReorder = function( pri ) {
		const self = this;
		if ( self.debug )
			console.log( 'actually reorder', pri );
		
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
			self.orderBy.some( t => {
				const av = a[ t ];
				const bv = b[ t ];
				if ( undefined === av )
					return;
				
				const sorter = typeof( av );
				/*
				console.log( 'sort', {
					t      : t,
					av     : av,
					bv     : bv,
					sorter : sorter,
				});
				*/
				if ( 'number' == sorter )
					res = sortByNumber( av, bv );
				
				if ( 'string' == sorter )
					res = sortByString( av, bv );
				
				if ( 'boolean' == sorter )
					res = sortByBool( av, bv );
				
				if ( 0 !== res )
					return true;
				else
					return false;
			});
			
			//console.log( 'res', res );
			
			/*
			if ( null != a.time )
				res = sortByNumber( a, b );
			else
				res = sortByString( a, b );
			*/
			
			return res;
		});
		
		
		self.applyOrder( pri );
		
		function sortByNumber( an, bn ) {
			if ( an < bn )
				return 1;
			if ( an > bn )
				return -1;
			
			return 0;
		}
		
		function sortByString( as, bs ) {
			if ( !as || !bs )
				return 0;
			
			as = as.toLowerCase();
			bs = bs.toLowerCase();
			if ( '' === as )
				return -1;
			if ( '' === bs )
				return 1;
			if ( as < bs )
				return -1;
			if ( as > bs )
				return 1;
			
			return 0;
		}
		
		function sortByBool( ab, bb ) {
			/*
			console.log( 'sortByPool', {
				ab : ab,
				bb : bb,
			});
			*/
			if ( ab === bb )
				return 0;
			
			if ( ab )
				return -1;
			else
				return 1;
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
			if ( self.debug )
				console.log( 'reapply', {
					before   : before,
					list     : list,
					selflist : self.list,
				});
			
			list.forEach( item => {
				const id = item.id;
				const el = document.getElementById( id );
				if ( !el ) {
					console.log( 'listOrder.applyOrder, apply - no el for', {
						item  : item,
						shelf : self,
					});
					return;
				}
				try {
					self.list.insertBefore( el, before );
				} catch( ex ) {
					console.log( 'insertBefore ex', {
						ex       : ex,
						el       : el,
						before   : before,
						selflist : self.list,
						self     : self,
					});
				}
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
		
		if ( self.debug )
			console.log( 'getNextPri', {
				basePrio : basePrio,
				prio     : self.prio,
				nextPrio : nextPrio,
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


// Overlay
(function( ns, undefined ) {
	ns.Overlay = function( anchorEl, conf ) {
		const self = this;
		library.component.EventEmitter.call( self );
		self.anchor = anchorEl;
		self.conf = conf;
		self.isVisible = false;
		
		self.initOverlay();
	}
	
	ns.Overlay.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.Overlay.prototype.show = function() {
		const self = this;
		self.toggleVisible( true );
	}
	
	ns.Overlay.prototype.toggle = function() {
		const self = this;
		self.toggleVisible();
	}
	
	ns.Overlay.prototype.hide = function() {
		const self = this;
		self.toggleVisible( false );
	}
	
	ns.Overlay.prototype.updatePosition = function() {
		const self = this;
		self.setPosition();
	}
	
	ns.Overlay.prototype.close = function() {
		const self = this;
		self.closeOverlay();
		throw new Error( 'Overlay.prototype.close() - implement in extension' );
	}
	
	// Called by Overlay.init - must be implemented
	
	// .build must return a DOM object
	ns.Overlay.prototype.build = function() {
		const self = this;
		throw new Error( 'Overlay.prototype.build() - implement in extension' );
	}
	
	// .bind your ui events here
	ns.Overlay.prototype.bind = function() {
		const self = this;
		throw new Error( 'Overlay.prototype.bind() - implement in extension' );
	}
	
	// Private
	
	ns.Overlay.prototype.closeOverlay = function() {
		const self = this;
		self.closeEventEmitter();
		if ( self.overlay )
			self.overlay.parentNode.removeChild( self.overlay );
		
		delete self.overlay;
		delete self.anchor;
		delete self.pos;
	}
	
	ns.Overlay.prototype.initOverlay = function() {
		const self = this;
		const id = friendUP.tool.uid( 'over' );
		window.View.on( 'resize', e => self.setPosition( e ));
		
		const hidden = self.conf.show ? '' : 'hidden';
		const conf = {
			id     : id,
			css    : self.conf.css || '',
			hidden : hidden,
		};
		
		self.overlay = hello.template.getElement( 'base-overlay-tmpl', conf );
		const insert = self.build();
		self.overlay.appendChild( insert );
		document.body.appendChild( self.overlay );
		self.setPosition();
		self.bind();
	}
	
	ns.Overlay.prototype.toggleVisible = function( show ) {
		const self = this;
		if ( null == show )
			self.isVisible = !self.isVisible;
		else
			self.isVisible = show;
		
		self.overlay.classList.toggle( 'hidden', !self.isVisible );
		if ( self.isVisible )
			self.updatePosition();
		
		self.emit( 'visible', self.isVisible );
	}
	
	ns.Overlay.prototype.setPosition = function() {
		const self = this;
		const pos = self.conf.position;
		if ( pos.outside )
			self.positionOutside( pos.outside );
		else
			self.positionInside( pos.inside );
	}
	
	ns.Overlay.prototype.positionOutside = function( pos ) {
		const self = this;
		const screen = self.getScreenSpace();
		const anchor = self.getElPosition( self.anchor );
		/*
		console.log( 'outside', {
			pos    : pos,
			screen : screen,
			anchor : anchor,
		});
		*/
		
		let ap = null; // anchor point
		let op = null; // offset point
		if ( 'top-right' === pos.parent ) {
			ap = {
				x : anchor.x2,
				y : anchor.y1,
			};
		}
		
		if ( 'top-left' === pos.parent ) {
			ap = {
				x : anchor.x1,
				y : anchor.y1,
			};
		}
		
		if ( 'top-center' === pos.parent ) {
			ap = {
				x : anchor.x1 + ( anchor.w / 2 ),
				y : anchor.y1,
			};
		}
		
		if ( 'left-center' === pos.parent ) {
			ap = {
				x : anchor.x1,
				y : anchor.y1 + ( anchor.h / 2 ),
			};
		}
		
		op = {
			x : ap.x + ( pos.offsetX || 0 ),
			y : ap.y + ( pos.offsetY || 0 ),
		}
		
		const boxWidth = self.overlay.clientWidth;
		const boxHeight = self.overlay.clientHeight;
		/*
		console.log( 'possies', {
			pos : pos,
			screen : screen,
			anchor : anchor,
			ap  : ap,
			op  : op,
			boxW : boxWidth,
			boxH : boxHeight,
		});
		*/
		
		if ( 'bottom-right' === pos.self ) {
			self.overlay.style.right = ( screen.width - op.x ) + 'px';
			self.overlay.style.bottom = ( screen.height - op.y ) + 'px';
			if ( null != pos.height )
				self.overlay.style.top = pos.height + 'px';
			if ( null != pos.width )
				self.overlay.style.left = pos.width + 'px';
		}
		
		if ( 'bottom-center' === pos.self ) {
			self.overlay.style.left = ( op.x - ( boxWidth / 2 )) + 'px';
			self.overlay.style.bottom = ( screen.height - op.y ) + 'px';
		}
		
		if ( 'bottom-left' === pos.self ) {
			self.overlay.style.left = op.x + 'px';
			self.overlay.style.bottom = ( screen.height - op.y ) + 'px';
		}
		
		if ( 'right-center' === pos.self ) {
			self.overlay.style.right = ( screen.width - op.x ) + 'px';
			self.overlay.style.top = ( op.y - ( boxHeight / 2 )) + 'px';
		}
	}
	
	ns.Overlay.prototype.positionInside = function( pos ) {
		const self = this;
		//console.log( 'inside', pos );
		const screen = self.getScreenSpace();
		const anchor = self.getElPosition( self.anchor );
		if ( pos.cover )
			setCover();
		else
			setPos();
		
		function setCover() {
			
		}
		
		function setPos() {
			let ap = null;
			let op = null;
			
			// THE ANCHOR
			
			if ( 'left-center' == pos.parent ) {
				const c = ( anchor.y1 + anchor.y2 ) / 2;
				ap = {
					x : anchor.x1,
					y : c,
				};
			}

			if ( 'bottom-center' == pos.parent ) {
				const c = ( anchor.x1 + anchor.x2 ) / 2;
				ap = {
					x : c,
					y : 0,
				};
			}
			
			if ( 'right-center' == pos.parent ) {
				const c = ( anchor.y1 + anchor.y2 ) / 2;
				//console.log( 'possies - c', c );
				ap = {
					x : anchor.x2,
					y : c,
				};
			}
			
			// THE OTHER THING
			
			op = {
				x : ap.x + ( pos.offsetX || 0 ),
				y : ap.y + ( pos.offsetY || 0 ),
			};
			
			const boxWidth = self.overlay.clientWidth;
			const boxHeight = self.overlay.clientHeight;
			/*
			console.log( 'possies', {
				pos : pos,
				screen : screen,
				anchor : anchor,
				ap  : ap,
				op  : op,
				boxW : boxWidth,
			});
			*/
			
			if ( 'left-center' == pos.self ) {
				self.overlay.style.left = op.x + 'px';
				self.overlay.style.top = ( screen.height - op.y - ( boxHeight / 2 )) + 'px';
				
				self.overlay.style.maxWidth = pos.maxX;
			}
			
			if ( 'bottom-center' == pos.self ) {
				if ( pos.margin )
					self.overlay.style.top = pos.margin;
				self.overlay.style.left = ( screen.width - op.x - ( boxWidth / 2 )) + 'px';
				self.overlay.style.bottom = op.y + 'px';
				self.overlay.style.maxWidth = pos.maxX;
				
			}
			
			if ( 'right-center' == pos.self ) {
				//console.log( 'rightcenter', op );
				self.overlay.style.right =  ( screen.width - op.x ) + 'px';
				self.overlay.style.top = ( screen.height - op.y - ( boxHeight / 2 )) + 'px';
				//self.overlay.style.left = op.x + 'px';
				self.overlay.style.maxWidth = pos.maxX;
			}
			
			if ( pos.top )
				self.overlay.style.top = pos.top + 'px';
			if ( pos.right )
				self.overlay.style.right = pos.right + 'px';
			if ( pos.bottom )
				self.overlay.style.bottom = pos.bottom + 'px';
			if ( pos.left )
				self.overlay.style.left = pos.left + 'px';
		}
	}
	
	ns.Overlay.prototype.getScreenSpace = function() {
		const self = this;
		const screen = {
			width  : document.body.clientWidth,
			height : document.body.clientHeight,
		};
		return screen;
	}
	
	ns.Overlay.prototype.getElPosition = function( el ) {
		const self = this;
		const elRekt = el.getBoundingClientRect();
		const pos = {
			x1 : elRekt.x,
			x2 : elRekt.right,
			y1 : elRekt.y,
			y2 : elRekt.bottom,
			w  : elRekt.right - elRekt.x,
			h  : elRekt.bottom - elRekt.y,
		};
		//console.log( 'getElPosition - pos', pos );
		return pos;
	}
	
	
})( library.component );
