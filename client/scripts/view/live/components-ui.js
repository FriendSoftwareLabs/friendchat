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

// List
(function( ns, undefined ) {
	ns.UIList = function( conf ) {
		const self = this;
		self.id = conf.id;
		self.containerId = conf.containerId;
		self.label = conf.label;
		self.faIcon = conf.faIcon;
		self.ontoggle = conf.ontoggle;
		
		// private
		self.items = {};
		self.itemOrder = [];
		self.isShow = false;
		
		self.init( conf.state );
	}
	
	// PUBLIC
	
	ns.UIList.prototype.add = function( element, orderOn ) {
		const self = this;
		self.doAdd( element, orderOn );
	}
	
	ns.UIList.prototype.remove = function( id ) {
		const self = this;
		return self.doRemove( id );
	}
	
	ns.UIList.prototype.move = function( id, index ) {
		const self = this;
		self.doMove( id, index );
	}
	
	// event types allowed is the public api ( the functions up there ^ )
	ns.UIList.prototype.handle = function( e ) {
		const self = this;
		if ( !self[ e.type ])
			return;
		
		self[ e.type ]( e.data );
	}
	
	ns.UIList.prototype.show = function( full ) {
		const self = this;
		if ( null == full )
			self.toggleShow( true );
		else
			self.toggleFull( full );
	}
	
	ns.UIList.prototype.peek = function() {
		const self = this;
		self.toggleShow( false );
	}
	
	ns.UIList.prototype.length = function() {
		const self = this;
		return self.itemOrder.length;
	}
	
	ns.UIList.prototype.close = function() {
		const self = this;
		delete self.ontoggle;
		
		self.itemOrder.forEach( remove );
		self.itemOrder = [];
		
		function remove( iid ) {
			self.doRemove( iid );
		}
	}
	
	// PRIVATE
	
	ns.UIList.prototype.init = function( state ) {
		const self = this;
		self.id = self.id || self.label + '-list-thingie';
		self.build( state );
		self.bind();
	}
	
	ns.UIList.prototype.build = function( state ) {
		const self = this;
		let show = '';
		if ( !state || 'show' === state ) {
			self.isShow = true;
			show = 'show';
		}
		
		const tmplConf = {
			id     : self.id,
			faIcon : self.faIcon,
			label  : self.label,
			show   : show,
		};
		const element = hello.template.getElement( 'live-list-tmpl', tmplConf );
		const container = document.getElementById( self.containerId );
		container.appendChild( element );
	}
	
	ns.UIList.prototype.bind = function() {
		const self = this;
		self.element = document.getElementById( self.id );
		const head = self.element.querySelector( '.list-head' );
		self.itemsContainer = self.element.querySelector( '.list-items' );
		
		self.element.addEventListener( 'transitionend', transend, false );
		head.addEventListener( 'click', toggleShow, false );
		
		function transend( e ) {
			if ( !self.ontoggle )
				return;
			
			if ( 'width' !== e.propertyName || !self.isShowUpdated )
				return;
			
			self.isShowUpdated = false;
			let state = self.isShow ? 'show' : 'peek';
			self.ontoggle( state );
		}
		
		function toggleShow( e ) {
			e.stopPropagation();
			self.toggleShow();
		}
	}
	
	ns.UIList.prototype.doAdd = function( el ) {
		const self = this;
		const id = el.id;
		if ( !id ) {
			console.log( 'UIList.doAdd - item does not have an id', el );
			return null;
		}
		
		if ( self.items[ id ]) {
			console.log( 'List.add - el already added', { el : el, items : self.items });
			return null;
		}
		
		self.items[ id ] = el;
		self.itemOrder.push( id );
		self.itemsContainer.appendChild( el );
		
		self.updateVisibility();
		
		return id;
	}
	
	ns.UIList.prototype.doRemove = function( id ) {
		var self = this;
		var el = self.items[ id ];
		if ( !el ) {
			console.log( 'List.remove - el not found', { id : id, items : self.items });
			return;
		}
		
		const element = document.getElementById( el.id );
		if ( element )
			element.parentNode.removeChild( element );
		
		delete self.items[ id ];
		self.itemOrder = self.itemOrder.filter( notRemoved );
		self.updateVisibility();
		return el;
		
		function notRemoved( itemId ) {
			if ( itemId === id )
				return false;
			return true;
		}
	}
	
	ns.UIList.prototype.doMove = function( id, index ) {
		var self = this;
		console.log( 'List.move - NYI', { id : id, i : index });
	}
	
	ns.UIList.prototype.updateVisibility = function() {
		var self = this;
		var hide = !self.itemOrder.length;
		self.toggleHide( hide );
	}
	
	ns.UIList.prototype.toggleHide = function( hide ) {
		const self = this;
		if ( typeof( hide ) === 'undefined' )
			hide = !self.hide;
		
		self.hide = hide;
		self.element.classList.toggle( 'hide', self.hide );
	}
	
	ns.UIList.prototype.toggleShow = function( force ) {
		const self = this;
		if ( null == force )
			self.isShow = !self.isShow;
		else
			self.isShow = !!force;
		
		self.isShowUpdated = true;
		self.element.classList.toggle( 'show', self.isShow );
	}
	
	ns.UIList.prototype.toggleFull = function( setFull ) {
		const self = this;
		self.element.classList.toggle( 'full', setFull );
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.StreamUserList = function( conf ) {
		const self = this;
		self.userId = conf.userId;
		self.connected = {};
		
		library.component.UIList.call( self, conf );
		self.bindMore();
		self.updateHead();
	}
	
	ns.StreamUserList.prototype = Object.create( library.component.UIList.prototype );
	
	// Public
	
	// Overriding .add from UIList
	ns.StreamUserList.prototype.add = function( element ) {
		const self = this;
		const clientId = self.doAdd( element );
		if ( !clientId )
			return;
		
		self.connected[ clientId ] = false;
		self.updateHead();
	}
	
	ns.StreamUserList.prototype.remove = function( clientId ) {
		const self = this;
		const removed = self.doRemove( clientId );
		self.updateHead();
		return removed;
	}
	
	ns.StreamUserList.prototype.updateConnected = function( clientId, isConnected ) {
		const self = this;
		self.connected[ clientId ] = isConnected;
		self.updateHead();
	}
	
	// Private
	
	ns.StreamUserList.prototype.bindMore = function() {
		const self = this;
		const head = self.element.querySelector( '.list-head' );
		self.headIcon = head.querySelector( '.list-head-icon' );
		self.headLabel = head.querySelector( '.list-label' );
	}
	
	ns.StreamUserList.prototype.updateHead = function() {
		const self = this;
		const total = self.itemOrder.length; // dont count streamer / self
		const ready = self.itemOrder
			.filter( id => !!self.connected[ id ])
			.length;
		
		
		let allReady = total === ready;
		self.headIcon.classList.toggle( 'danger', !allReady );
		self.headLabel.textContent = ready + ' / ' + total + ' ready';
	}
	
})( library.component );

(function( ns, undefined ) {
	ns.AudioVisualizer = function(
		volumeSrc,
		templateManager,
		containerId
	) {
		const self = this;
		self.source = volumeSrc;
		self.template = templateManager;
		self.containerId = containerId;
		
		self.id = null;
		self.canvasId = null;
		self.ctx = null;
		self.draw = false;
		self.drawVolume = true;
		
		self.init();
	}
	
	// Public
	
	ns.AudioVisualizer.prototype.start = function() {
		const self = this;
		self.setupCanvas();
		if ( !self.el ) {
			console.log( 'AudioVisualizer.start - no el', self );
			return;
		}
		
		self.draw = true;
		self.drawAV();
	}
	
	ns.AudioVisualizer.prototype.setSource = function( volumeSrc ) {
		const self = this;
		self.source = volumeSrc;
	}
	
	ns.AudioVisualizer.prototype.stop = function() {
		const self = this;
		self.draw = false;
		if ( self.animFReq )
			window.cancelAnimationFrame( self.animFReq );
		
		delete self.animFReq;
		self.removeCanvas();
	}
	
	ns.AudioVisualizer.prototype.close = function() {
		const self = this;
		self.stop();
		
		//self.releaseSource();
		delete self.id;
		delete self.canvasId;
		delete self.containerId;
		delete self.ctx;
		delete self.source;
		delete self.template;
		delete self.drawVolume;
		delete self.draw;
	}
	
	// Private
	
	ns.AudioVisualizer.prototype.init = function() {
		const self = this;
		self.start();
	}
	
	ns.AudioVisualizer.prototype.setupCanvas = function() {
		const self = this;
		if ( self.canvasId )
			return;
		
		const container = document.getElementById( self.containerId );
		self.id = friendUP.tool.uid( 'AV' );
		self.canvasId = friendUP.tool.uid( 'canvas' );
		const conf = {
			id       : self.id,
			canvasId : self.canvasId,
			width    : container.clientWidth,
			height   : container.clientHeight,
		};
		self.el = self.template.getElement( 'peer-av-tmpl', conf );
		container.appendChild( self.el );
		self.el.onclick = clickIt;
		//self.el.addEventListener( 'click', clickIt, true );
		function clickIt( e ) {
			self.clicked();
		}
		
		var cw = self.el.clientWidth;
		var ch = self.el.clientHeight;
		if ( !ch || !cw ) {
			self.stop();
			return;
		}
		
		self.canvas = document.getElementById( self.canvasId );
		if ( !self.canvas ) {
			self.stop();
			return;
		}
		
		// anim setup
		self.ctx = self.canvas.getContext( '2d' );
		if ( !self.ctx ) {
			self.stop();
			return;
		}
		
		self.cW = self.ctx.canvas.clientWidth;
		self.cH = self.ctx.canvas.clientHeight;
		self.ctx.lineWidth = 3;
		self.ctx.lineCap = 'round';
	}
	
	ns.AudioVisualizer.prototype.clicked = function() {
		const self = this;
		self.drawVolume = !self.drawVolume;
		self.drawAV();
	}
	
	ns.AudioVisualizer.prototype.removeCanvas = function() {
		const self = this;
		delete self.cW;
		delete self.cH;
		delete self.ctx;
		if ( self.canvas )
			self.canvas.parentNode.removeChild( self.canvas );
		
		if ( self.el ) {
			self.el.onclick = null;
			self.el.parentNode.removeChild( self.el );
		}
		
		delete self.canvasId;
		delete self.id;
		delete self.canvas;
		delete self.el;
	}
	
	ns.AudioVisualizer.prototype.drawAV = function() {
		const self = this;
		if ( !self.ctx )
			return;
		
		if ( self.animFReq ) {
			cancelAnimationFrame( self.animFReq );
			self.animFReq = null;
		}
		
		if ( self.drawVolume )
			self.updateVolume();
		else
			self.updateWaveform();
	}
	
	ns.AudioVisualizer.prototype.updateVolume = function() {
		const self = this;
		self.animFReq = window.requestAnimationFrame( loop );
		function loop() {
			if ( !self.draw || !self.drawVolume )
				return;
			
			self.animFReq = window.requestAnimationFrame( loop );
			redraw();
		}
		
		function redraw() {
			if ( !self.source.averageOverTime )
				return;
			
			let buf = self.source.averageOverTime.slice( -18 );
			if ( !buf || !buf.length ) {
				console.log( 'AV - invalid volumeHistory', self.source );
				return;
			}
			
			self.clearCanvas();
			let  stepLength = ( self.cW * 1.0  ) / buf.length;
			
			// move line to pos
			let len = buf.length;
			let i = buf.length;
			for( ; i-=3 ; ) {
				self.ctx.beginPath();
				let alpha = i / len;
				if ( alpha > 1 )
					alpha = 1;
				self.ctx.strokeStyle = 'rgba( 255, 255, 255, ' + alpha + ')';
				let v1 = buf[ i ];
				let v2 = buf[ i - 3 ];
				let y1 = self.cH - (( v1 / 128.0 ) * self.cH );
				let y2 = self.cH - (( v2 / 128.0 ) * self.cH );
				y1+=1;
				y2+=1;
				let x1 = ( i * stepLength );
				let x2 = (( i - 3 ) * stepLength );
				self.ctx.moveTo( x1, y1 );
				self.ctx.lineTo( x2, y2 );
				self.ctx.stroke();
			}
		}
	}
	
	ns.AudioVisualizer.prototype.updateWaveform = function() {
		const self = this;
		self.ctx.strokeStyle = 'white';
		self.animFReq = window.requestAnimationFrame( loop );
		function loop() {
			if ( !self.draw || self.drawVolume )
				return;
			
			self.animFReq = window.requestAnimationFrame( loop );
			redraw();
		}
		
		function redraw() {
			let buf = self.source.timeBuffer;
			if ( !buf || !buf.length ) {
				console.log( 'AV - invalid time buffer', self.source );
				return;
			}
			
			self.clearCanvas();
			self.ctx.beginPath();
			let stepLength = ( self.cW * 1.0 ) / buf.length;
			
			// move line to pos
			let i = buf.length;
			for ( ; i-- ; ) {
				let value = buf[ i ];
				let y = ( value / 128.0 ) * ( self.cH / 2.0 );
				let x = ( self.cW - ( i * stepLength ));
				if ( i === buf.length )
					self.ctx.moveTo( x, y );
				else
					self.ctx.lineTo( x, y );
			}
			
			self.ctx.stroke();
		}
	
	}
	
	ns.AudioVisualizer.prototype.clearCanvas = function() {
		const self = this;
		if ( !self.ctx )
			return;
		
		self.ctx.clearRect( 0, 0, self.cW, self.cH + 1 );
	}
	
})( library.view );


// MiniChat
( function( ns, undefined ) {
	ns.LiveChat = function( conf, templateManager ) {
		const self = this;
		self.userId = conf.userId;
		self.identities = conf.identities;
		self.guestAvatar = conf.guestAvatar;
		self.tease = conf.chatTease || null;
		
		self.conn = null;
		
		self.init( conf, templateManager );
	}
	
	// Public
	
	ns.LiveChat.prototype.close = function() {
		const self = this;
		if ( self.conn )
			self.conn.close();
		
		delete self.conn;
		delete self.userId;
		delete self.identities;
		delete self.tease;
		delete self.el;
	}
	
	ns.LiveChat.prototype.show = function() {
		const self = this;
		self.isVisible = true;
		self.bottomScroll.update();
		if ( window.View.deviceType && ( 'VR' !== window.View.deviceType ))
			self.input.focus();
	}
	
	ns.LiveChat.prototype.hide = function() {
		const self = this;
		self.isVisible = false;
		//self.input.blur();
	}
	
	// Private
	
	ns.LiveChat.prototype.init = function( conf, templateManager ) {
		const self = this;
		// build
		let parent = document.getElementById( conf.containerId );
		let tmplConf = {
			welcomeRoomName : conf.roomName || '',
		};
		self.el = hello.template.getElement( 'live-chat-tmpl', tmplConf );
		parent.appendChild( self.el );
		
		// components
		let leConf = {
			templateManager : templateManager,
		};
		self.linkExpand = new library.component.LinkExpand( leConf );
		
		// multiline input
		let inputConf = {
			containerId     : 'input-container',
			templateManager : hello.template,
			singleOnly      : false,
			multiIsOn       : false,
			onsubmit        : onSubmit,
			onmode          : onMode,
		};
		self.input = new library.component.MultiInput( inputConf );
		function onSubmit( e ) { self.submit( e ); };
		function onMode( e ) {};
		
		// input history
		let historyConf = {
			inputId : 'chat-input',
		};
		self.inputHistory = new library.component.InputHistory( historyConf );
		
		// scrollingstuff
		self.bottomScroll = new library.component.BottomScroller( 'live-chat-messages' );
		
		// listen
		self.conn = new library.component.EventNode(
			'chat',
			conf.conn,
			eventSink
		);
		
		self.conn.on( 'msg', message );
		self.conn.on( 'state', state );
		self.stateMap = {
			'set-typing'   : setTyping,
			'clear-typing' : clearTyping,
		};
		
		function message( e ) { self.handleMessage( e ); }
		function state( e ) { self.handleState( e ); }
		function setTyping( e ) { self.handleSetTyping( e ); }
		function clearTyping( e ) { self.handleClearTyping( e ); }
		function eventSink() { console.log( 'Live Chat sink', arguments ); }
		
		// bind
		self.messages = document.getElementById( 'live-chat-messages' );
		self.isTypeingHint = document.getElementById( 'live-chat-is-typing' );
		self.sayStateBtn = document.getElementById( 'live-chat-say-state' );
		self.inputHint = document.getElementById( 'live-chat-input-hint' );
		self.inputForm = document.getElementById( 'live-chat-form' );
		self.inputBtn = document.getElementById( 'live-chat-send-btn' );
		self.inputArea = document.getElementById( 'chat-input' );
		
		self.sayStateBtn.addEventListener( 'click', toggleSay, false );
		self.inputForm.addEventListener( 'submit', submit, false );
		self.inputBtn.addEventListener( 'click', chatSendClick, false );
		
		self.inputArea.addEventListener( 'focus', inputFocus, false );
		self.inputArea.addEventListener( 'blur', inputBlur, false );
		self.inputArea.addEventListener( 'keydown', inputKeyDown, false );
		self.inputArea.addEventListener( 'keyup', inputKeyUp, false );
		
		function toggleSay( e ) { self.toggleSay(); }
		function submit( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.input.submit();
		}
		function chatSendClick( e ) {
			var submit = new Event( 'submit' );
			self.inputForm.dispatchEvent( submit );
		}
		
		function inputFocus( e ) { self.handleInputFocus( true ); }
		function inputBlur( e ) { self.handleInputFocus( false ); }
		function inputKeyDown( e ) { self.handleInputKey( e ); }
		function inputKeyUp( e ) { self.handleInputKey( e ); }
		
		if ( conf.logTail && conf.logTail.length )
			conf.logTail.forEach( msg => self.addMessage( msg.data ));
	}
	
	
	ns.LiveChat.prototype.handleEvent = function( msg ) {
		var self = this;
		var handler = self.chatMap[ msg.type ];
		if ( !handler ) {
			console.log( 'no handler for ', msg );
			return;
		}
		
		handler( msg.data );
	}
	
	ns.LiveChat.prototype.handleMessage = function( msg ) {
		const self = this;
		self.say( msg.message );
		self.addMessage( msg );
	}
	
	ns.LiveChat.prototype.handleState = function( event ) {
		const self = this;
		const handler = self.stateMap[ event.type ];
		if ( !handler ) {
			console.log( '', event );
			return;
		}
	}
	
	ns.LiveChat.prototype.handleSetTyping = function( msg ) {
		const self = this;
		const id = msg.from + '-is-typing';
		const tmplConf = {
			id   : id,
			from : msg.from,
		};
		const element = hello.template.getElement( 'is-typing-tmpl', tmplConf );
		self.isTypeingHint.appendChild( element );
	}
	
	ns.LiveChat.prototype.handleClearTyping = function( msg ) {
		const self = this;
		const id = msg.from + '-is-typing';
		const element = document.getElementById( id );
		element.parentNode.removeChild( element );
	}
	
	ns.LiveChat.prototype.say = function( message ) {
		const self = this;
		if ( !self.sayMessages )
			return;
		
		api.Say( message );
	}
	
	ns.LiveChat.prototype.addMessage = function( data ) {
		const self = this;
		let parsedMessage = hello.parser.work( data.message );
		const identity = self.identities[ data.fromId ];
		let from = '';
		if ( identity )
			from = identity.liveName || identity.name;
		else
			from = 'Guest > ' + data.name;
		
		if ( self.userId === data.fromId )
			from = 'You';
		
		const time = library.tool.getChatTime( data.time );
		const conf = {
			id      : data.msgId, // TODO : add to template
			from    : from,
			message : parsedMessage,
			time    : time,
		};
		const element = hello.template.getElement( 'message-tmpl', conf );
		self.messages.appendChild( element );
		self.linkExpand.work( element );
		scrollBottom();
		if ( self.tease && !self.isVisible && notFromSelf( data.fromId ))
			self.tease.showMessage( conf.message, conf.from );
		
		function scrollBottom() {
			self.messages.scrollTop = self.messages.scrollHeight;
		}
		
		function notFromSelf( fromId ) {
			if ( null == fromId ) // undefiend means fromId self
				return false;
			
			if ( fromId === self.userId )
				return false;
			
			return true;
		}
	}
	
	ns.LiveChat.prototype.handleInputFocus = function( hasFocus ) {
		var self = this;
		self.inputHasFocus = hasFocus;
		self.inputHint.classList.toggle( 'blink-i', hasFocus );
		
		if ( !hasFocus )
			self.clearIsTyping();
	}
	
	ns.LiveChat.prototype.handleInputKey = function( e ) {
		var self = this;
		if ( self.typingIsSet )
			return;
		
		var value = self.input.getValue();
		//value = self.makeString( value );
		if ( value.length && self.inputHasFocus )
			self.setIsTyping();
		
	}
	
	ns.LiveChat.prototype.makeString = function( str ) {
		var self = this;
		try {
			return str.toString();
		} catch( e ) {
			return null;
		}
	}
	
	ns.LiveChat.prototype.setIsTyping = function() {
		var self = this;
		if ( self.typingIsSet )
			return;
		
		self.typingIsSet = true;
		const setTyping = {
			type : 'set-typing',
			data : null,
		};
		self.sendState( setTyping );
	}
	
	ns.LiveChat.prototype.clearIsTyping = function() {
		var self = this;
		if ( !self.typingIsSet )
			return;
		
		self.typingIsSet = false;
		const clearTyping = {
			type : 'clear-typing',
			data : null,
		};
		self.sendState( clearTyping );
	}
	
	ns.LiveChat.prototype.submit = function( str ) {
		var self = this;
		if ( !str || !str.length )
			return;
		
		str = self.makeString( str );
		if ( !str.length )
			return;
		
		self.clearIsTyping();
		self.sendMessage( str );
		self.inputHistory.add( str );
	}
	
	ns.LiveChat.prototype.sendMessage = function( str ) {
		var self = this;
		var msg = {
			type : 'msg',
			data : {
				message : str,
			},
		};
		self.send( msg );
	}
	
	ns.LiveChat.prototype.sendState = function( event ) {
		var self = this;
		var evnt = {
			type : 'state',
			data : event,
		};
		self.send( evnt );
	}
	
	ns.LiveChat.prototype.send = function( msg ) {
		var self = this;
		if ( !self.conn )
			return;
		
		self.conn.send( msg );
	}
	
})( library.component );

// ChatTease
(function( ns, undefined ) {
	ns.ChatTease = function( containerId, templateManager ) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.teaseUnread = 0;
		
		self.init( containerId, templateManager );
	}
	
	ns.ChatTease.prototype = Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.ChatTease.prototype.close = function() {
		const self = this;
		self.emitterClose();
		delete self.teaseContainer;
		delete self.teaseNum;
		delete self.showChatBtn;
		delete self.clearBtn;
		
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.el;
	}
	
	ns.ChatTease.prototype.showMessage = function( message, from ) {
		const self = this;
		self.showMessageNum();
		return;
		
		/*
		console.log( 'showMessage', [
			message,
			from,
		]);
		let conf = {
			message : message,
			from    : from,
		};
		self.teaseMsg = hello.template.getElement( 'chat-tease-tmpl', conf );
		self.teaseContainer.innerHTML = '';
		self.teaseContainer.appendChild( self.teaseMsg );
		self.teaseUnread++;
		self.teaseNum.textContent = '(' + self.teaseUnread + ')';
		self.el.classList.toggle( 'hidden', false );
		*/
	}
	
	ns.ChatTease.prototype.setActive = function( active ) {
		const self = this;
		if ( self.active === active )
			return;
		
		self.active = active;
		self.updateActive();
	}
	
	ns.ChatTease.prototype.clear = function() {
		const self = this;
		self.clearMessageNum();
		return;
		
		self.teaseUnread = 0;
		self.teaseNum.textContent = '';
		self.teaseContainer.innerHTML = '';
		self.el.classList.toggle( 'hidden', true );
	}
	
	// Priv
	
	ns.ChatTease.prototype.init = function( containerId, templateManager ) {
		const self = this;
		const container = document.getElementById( containerId );
		self.el = templateManager.getElement( 'tease-chat-tmpl', {});
		container.appendChild( self.el );
		
		//self.teaseContainer = document.getElementById( 'tease-chat-content' );
		self.teaseNum = document.getElementById( 'tease-chat-num' );
		//self.showChatBtn = document.getElementById( 'tease-chat-goto-chat' );
		//self.clearBtn = document.getElementById( 'tease-chat-clear' );
		
		self.el.addEventListener( 'click', showChatClick, false );
		//self.showChatBtn.addEventListener( 'click', showChatClick, false );
		//self.clearBtn.addEventListener( 'click', clearClick, false );
		
		function showChatClick( e ) {
			self.clear();
			self.emit( 'show-chat', Date.now());
		}
		function clearClick( e ) { self.clear(); }
	}
	
	ns.ChatTease.prototype.showMessageNum = function() {
		const self = this;
		self.teaseUnread++;
		self.teaseNum.textContent = '(' + self.teaseUnread + ')';
		self.updateActive();
	}
	
	ns.ChatTease.prototype.clearMessageNum = function() {
		const self = this;
		self.teaseUnread = 0;
		self.teaseNum.textContent = '';
		self.updateActive();
	}
	
	ns.ChatTease.prototype.updateActive = function() {
		const self = this;
		if ( self.active ) {
			glow( true );
			return;
		}
		
		if ( !!self.teaseUnread ) {
			glow( true );
			return;
		}
		
		glow( false );
		
		function glow( show ) {
			self.el.classList.toggle( 'available', show );
		}
	}
	
})( library.component );


(function( ns, undefined ) {
	ns.StreamStateUI = function( containerId ) {
		const self = this;
		
		self.init( containerId );
	}
	
	// Public
	
	ns.StreamStateUI.prototype.close = function() {
		const self = this;
		if ( self.el )
			self.el.parentNode.removeChild( self.el );
		
		delete self.source;
		delete self.stream;
		delete self.el;
	}
	
	ns.StreamStateUI.prototype.show = function() {
		const self = this;
		self.el.classList.toggle( 'hidden', false );
	}
	
	ns.StreamStateUI.prototype.hide = function() {
		const self = this;
		self.el.classList.toggle( 'hidden', true );
	}
	
	ns.StreamStateUI.prototype.update = function( state ) {
		const self = this;
		let handler = self.states[ state.type ];
		if ( !handler ) {
			console.log( 'StreamStateUI.update - unknown state event', state );
			return;
		}
		
		handler( state.data );
	}
	
	// Private
	
	ns.StreamStateUI.prototype.init = function( containerId ) {
		const self = this;
		const container = document.getElementById( containerId );
		const conf = {
			
		};
		self.el = hello.template.getElement( 'stream-state-tmpl', conf );
		container.appendChild( self.el );
		
		// bind
		self.source = document.getElementById( 'source-state' );
		self.stream = document.getElementById( 'stream-state' );
		
		// states
		self.states = {
			source : source,
			stream : stream,
		};
		
		function source( e ) { self.updateSource( e ); }
		function stream( e ) { self.updateStream( e ); }
	}
	
	ns.StreamStateUI.prototype.updateSource = function( ready ) {
		const self = this;
		let sourceWait = self.source.querySelector( 'i.state-waiting' );
		let sourceOk = self.source.querySelector( 'i.state-ready' );
		
		self.toggle( sourceOk, ready );
		self.toggle( sourceWait, !ready );
		self.toggle( self.stream, ready );
		
		self.show();
	}
	
	ns.StreamStateUI.prototype.updateStream = function( ready ) {
		const self = this;
		let streamWait = self.stream.querySelector( 'i.state-waiting' );
		let streamOk = self.stream.querySelector( 'i.state-ready' );
		self.toggle( streamWait, !ready );
		self.toggle( streamOk, ready );
		
		if ( ready )
			self.hide();
		else
			self.show();
	}
	
	ns.StreamStateUI.prototype.toggle = function( el, show ) {
		const self = this;
		el.classList.toggle( 'hidden', !show );
	}
	
})( library.component );
