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
		console.log( 'LiveChat.init - conf', conf );
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
		};
		self.input = new library.component.MultiInput( inputConf );
		self.input.on( 'submit', onSubmit );
		function onSubmit( e ) { self.submit( e ); };
		
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
			const submit = new Event( 'submit' );
			self.inputForm.dispatchEvent( submit );
		}
		
		function inputFocus( e ) { self.handleInputFocus( true ); }
		function inputBlur( e ) { self.handleInputFocus( false ); }
		function inputKeyDown( e ) { self.handleInputKey( e ); }
		function inputKeyUp( e ) { self.handleInputKey( e ); }
		
		if ( conf.logTail && conf.logTail.length )
			conf.logTail.forEach( msg => self.addMessage( msg.data, true ));
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
	
	ns.LiveChat.prototype.addMessage = function( data, isLog ) {
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
		if ( self.tease
			&& !isLog
			&& !self.isVisible
			&& notFromSelf( data.fromId )
		) {
			self.tease.showMessage( conf.message, conf.from );
		}
		
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


// SourceSelect
(function( ns, undefined ) {
	ns.SourceSelect = function( onSelect ) {
		const self = this;
		self.onselect = onSelect;
		
		self.previewId = 'source-preview';
		
		self.audioId = 'audioinput';
		self.videoId = 'videoinput';
		self.outputId = 'audiooutput';
		
		self.sources = null;
		self.currentDevices = null;
		self.selectedDevices = null;
		self.allDevices = null;
		
		self.audioinput = null;
		self.videoinput = null;
		self.audiooutput = null;
		
		self.supportsSinkId = false;
		
		self.init();
	}
	
	// Public
	
	ns.SourceSelect.prototype.showDevices = function( currentDevices ) {
		const self = this;
		console.log( 'showDevices - currentDevices', currentDevices );
		self.refreshDevices( currentDevices );
	}
	
	ns.SourceSelect.prototype.showGetUserMediaError = function( data ) {
		const self = this;
		self.clear();
		const error = 'Failed to attach media: ' + data.err.name;
		const errorElement = document.getElementById( 'source-error' );
		const errorMsg = errorElement.querySelector( '.error-message' );
		errorMsg.innerText = error;
		self.toggleExplain( false );
		self.toggleSelects( false );
	}
	
	ns.SourceSelect.prototype.getSelected = function() {
		const self = this;
		const audioDevice = getSelectDevice(
			self[ self.audioId ],
			'audioinput'
		);
		const videoDevice = getSelectDevice(
			self[ self.videoId ],
			'videoinput'
		);
		
		let outputDevice = null;
		if ( self.supportsSinkId )
			outputDevice = getSelectDevice(
				self[ self.outputId ],
				'audiooutput'
			);
		
		const selected = {
			audioinput  : audioDevice,
			videoinput  : videoDevice,
			audiooutput : outputDevice || undefined,
		};
		
		console.log( 'getSelected', selected );
		if ( outputDevice )
			selected.audiooutput = outputDevice;
		
		return selected;
		
		function getSelectDevice( select, type ) {
			if ( !select )
				return null;
			
			const deviceId = select.value;
			if ( !deviceId.length )
				return null;
			
			if ( 'none' === deviceId )
				return false;
			
			if ( !self.allDevices )
				return null;
			
			const devs = self.allDevices[ type ];
			if ( !devs )
				return null;
			
			const device = devs[ deviceId ];
			return device || null;
		}
	}
	
	ns.SourceSelect.prototype.close = function() {
		const self = this;
		if( self.sources )
			self.sources.close();
		
		delete self.sources;
		delete self.onselect;
	}
	
	// Private
	
	ns.SourceSelect.prototype.init = function() {
		const self = this;
		self.sources = new library.rtc.MediaDevices();
		self.bind();
		self.checkOutputSelectSupport();
	}
	
	ns.SourceSelect.prototype.bind = function() {
		const self = this;
		const bg = document.getElementById( self.paneId );
		self.previewHint = document.getElementById( 'source-preview-hint' );
		self.previewEl = document.getElementById( 'source-preview-video' );
		self.previewEl.muted = true;
		self.previewEl.preload = 'metadata';
		
		const element = document.getElementById( 'source-select' );
		const closeBtn = document.getElementById( 'source-back' );
		
		const applyBtn = document.getElementById( 'apply-select' );
		const discardBtn = document.getElementById( 'discard-select' );
		const refreshBtn = document.getElementById( 'refresh-select' );
		
		const errElement = document.getElementById( 'source-error' );
		const errAvailableBtn = errElement.querySelector( '.error-buttons .available' );
		const errIgnoreBtn = errElement.querySelector( '.error-buttons .ignore' );
		
		self.audioOutput = document.getElementById( 'audiooutput-container' );
		self.outputTestEl = document.getElementById( 'audiooutput-test' );
		self.avEl = document.getElementById( 'source-select-av-container' );
		
		closeBtn.addEventListener( 'click', closeClick, false );
		applyBtn.addEventListener( 'click', applyClick, false );
		refreshBtn.addEventListener( 'click', refreshClick, false );
		discardBtn.addEventListener( 'click', discardClick, false );
		
		errAvailableBtn.addEventListener( 'click', errShowAvailable, false );
		errIgnoreBtn.addEventListener( 'click', errIgnore, false );
		
		self.previewEl.onloadedmetadata = letsPlay;
		function letsPlay( e ) {
			self.previewEl.play();
		}
		
		function closeClick( e ) {
			self.done();
		}
		
		function applyClick( e ) {
			var selected = self.getSelected();
			self.done( selected );
		}
		
		function refreshClick( e ) {
			self.refreshDevices();
		}
		
		function discardClick( e ) {
			self.done();
		}
		
		function errShowAvailable( e ) {
			self.refreshDevices();
		}
		
		function errIgnore( e ) {
			self.done();
		}
	}
	
	ns.SourceSelect.prototype.checkOutputSelectSupport = function() {
		const self = this;
		if ( !self.outputTestEl )
			return;
		
		if ( !self.outputTestEl.setSinkId )
			return;
		
		self.audioOutput.classList.toggle( 'hidden', false );
		self.supportsSinkId = true;
	}
	
	ns.SourceSelect.prototype.refreshDevices = function( current ) {
		const self = this;
		self.clear();
		self.clearErrors();
		self.toggleExplain( true );
		self.toggleSelects( true );
		
		if ( current )
			self.currentDevices = current;
		
		self.sources.getByType()
			.then( show )
			.catch( showErr );
		
		function show( devices ) {
			self.allDevices = devices;
			console.log( 'available devices', devices );
			self.populate();
		}
		
		function showErr( err ) {
			self.showMediaDevicesErr ( err );
		}
	}
	
	ns.SourceSelect.prototype.showMediaDevicesErr = function( err ) {
		const self = this;
		console.log( 'SourceSelect.showMediaDevicesErr', err.stack || err );
	}
	
	ns.SourceSelect.prototype.clearErrors = function() {
		const self = this;
		self.toggleExplain( true );
		self.toggleSelectError( self.audioId );
		self.toggleSelectError( self.videoId );
		self.toggleSelectError( self.outputId );
	}
	
	ns.SourceSelect.prototype.populate = function() {
		const self = this;
		setupAudio();
		setupVideo();
		
		if ( self.supportsSinkId )
			setupOutput();
		
		const selected = self.getSelected();
		self.setPreview( selected );
		
		function setupAudio() {
			var conf = {
				type    : self.audioId,
				errType : 'audio',
			};
			setupSelect( conf );
		}
		
		function setupVideo() {
			var conf = {
				type    : self.videoId,
				errType : 'video',
			};
			setupSelect( conf );
		}
		
		function setupOutput() {
			const conf = {
				type    : self.outputId,
				errType : 'output',
			};
			setupSelect( conf );
		}
		
		function setupSelect( conf ) {
			const devices = self.allDevices[ conf.type ];
			const deviceIds = Object.keys( devices );
			// no devices available
			if ( !deviceIds.length ) {
				self.toggleSelectError( conf.type, View.i18n('i18n_no_devices_detected'), true );
				return;
			}
			
			// Ignores blocked devices...
			if ( deviceIds.length === 1 ) {
				if ( deviceIds[ 0 ] === '' ) {
					self.toggleSelectError( conf.type,
							View.i18n('i18n_devices_detected_unavailable'),
						true );
					return;
				}
			}
			
			// add no select option to the list
			if ( conf.type !== self.outputId )
				devices[ 'none' ] = {
					label        : 'none',
					displayLabel : View.i18n( 'i18n_no_selection' ),
					kind         : conf.type,
					deviceId     : 'none',
				}
			
			const select = self.buildSelect( conf.type, devices );
			const containerId = conf.type + '-select';
			const container = document.getElementById( containerId );
			container.appendChild( select );
			self.bindSelect( select );
			self[ conf.type ] = select;
		}
	}
	
	// Set the preview video rect
	ns.SourceSelect.prototype.setPreview = function( selected ) {
		const self = this;
		self.clearPreview();
		let audioDevice = false;
		let videoDevice = false;
		let audioDeviceId = null;
		let videoDeviceId = null;
		
		// The selected has audio
		if ( selected.audioinput ) {
			const saD = selected.audioinput;
			const aiDev = self.allDevices.audioinput[ saD.deviceId ];
			if( aiDev && aiDev.deviceId )
			{
				audioDeviceId = aiDev.deviceId;
			}
		}
		
		// The selected has video
		if ( selected.videoinput ) {
			const svD = selected.videoinput;
			const viDev = self.allDevices.videoinput[ svD.deviceId ];
			if( viDev && viDev.deviceId )
			{
				videoDeviceId = viDev.deviceId;
			}
		}
		
		// If video device
		if ( audioDeviceId )
			audioDevice = { "deviceId" : audioDeviceId };
		
		// If audio device
		if ( videoDeviceId )
			videoDevice = { "deviceId" : videoDeviceId };
		
		const mediaConf = {
			audio : audioDevice,
			video : videoDevice
		};
		
		// No audio and video - just return
		if ( !mediaConf.audio && !mediaConf.video ) {
			togglePreviewHint( true );
			return;
		}
	   
		// Get user media depending on query 
		navigator.mediaDevices.getUserMedia( mediaConf )
			.then( setMedia )
			.catch( mediaErr );
		
		// Upon getting a media stream, set audio and or video
		function setMedia( stream ) {
			if ( mediaConf.audio ) {
				self.showAV( stream );
				self.checkAudioInput( stream );
			}
			
			// Get stream tracks
			const tracks = stream.getTracks();
			const hasVideo = tracks.some( isVideo );
			togglePreviewHint( !hasVideo );
			
			if( stream )
				self.previewEl.srcObject = stream;
			else
				self.previewEl.srcObject = null;
		}
		
		function mediaErr( err ) {
			console.log( 'preview media failed', err );
		}
		
		function togglePreviewHint( show ) {
			self.previewHint.classList.toggle( 'hidden', !show );
		}
		
		function isVideo( track ) {
			return 'video' === track.kind;
		}
	}
	
	ns.SourceSelect.prototype.clearPreview = function() {
		const self = this;
		self.closeAV();
		self.previewEl.pause();
		let srcObj = self.previewEl.srcObject;
		
		if ( !srcObj )
			return;
		
		var tracks = srcObj.getTracks();
		tracks.forEach( stop );
		self.previewEl.load();
		
		function stop( track ) {
			track.stop();
			if ( srcObj.removeTrack )
				srcObj.removeTrack( track );
		}
	}
	
	ns.SourceSelect.prototype.showAV = function( stream ) {
		const self = this;
		console.log( 'SourceSleectPane.showAV', stream );
		self.volume = new library.rtc.Volume(
			stream,
			null,
			null
		);
		
		self.AV = new library.view.AudioVisualizer(
			self.volume,
			hello.template,
			'source-select-av-container'
		);
	}
	
	ns.SourceSelect.prototype.closeAV = function() {
		const self = this;
		if ( self.AV )
			self.AV.close();
		
		if ( self.volume )
			self.volume.close();
		
		delete self.AV;
		delete self.volume;
	}
	
	// Check audio device
	ns.SourceSelect.prototype.checkAudioInput = function( stream ) {
		const self = this;
		const audioIcon = document.getElementById( 'audioinput-icon' );
		const checkIcon = document.getElementById( 'audioinput-checking' );
		showChecking( true );
		new library.rtc.AudioInputDetect( stream )
			.then( checkBack )
			.catch( checkErr );
		
		function checkBack( hasInput ) {
			showChecking( false );
			if ( !hasInput )
				self.toggleSelectError( 'audioinput', 'No inputs' );
		}
		
		function checkErr( err ) {
			console.log( 'checkAudiooInput - checkErr', err );
			self.toggleSelectError( 'audioinput', err );
		}
		
		function showChecking( show ) {
			audioIcon.classList.toggle( 'hidden', show );
			checkIcon.classList.toggle( 'hidden', !show );
		}
	}
	
	// Set the audio device
	ns.SourceSelect.prototype.setAudioSink = function( selected ) {
		const self = this;
		if ( !self.previewEl )
			return;
		
		const sD = selected[ 'audiooutput' ];
		const dev = self.allDevices.audiooutput[ sD.deviceId ];
		
		if ( !dev )
			return;
		
		self.previewEl.setSinkId( dev.deviceId )
			.then( ok )
			.catch( fail );
			
		function ok() {
			//console.log( 'source select - sink id set', self.previewEl.sinkId );
		}
		
		function fail( err ) {
			console.log( 'source select - failed to set sink id', err.stack || err );
		}
	}
	
	// Bind select element
	ns.SourceSelect.prototype.bindSelect = function( element ) {
		const self = this;
		element.addEventListener( 'change', selectChange, false );
		function selectChange( e ) {
			const selected = self.getSelected();
			if ( 'source-select-audiooutput' === e.target.id ) {
				self.setAudioSink( selected );
			}
			else {
				self.setPreview( selected );
			}
		}
	}
	
	// Build select options
	ns.SourceSelect.prototype.buildSelect = function( type, devices ) {
		const self = this;
		const dIds = Object.keys( devices );
		const options = dIds.map( dId => {
			const dev = devices[ dId ];
			const optStr = buildOption( dev );
			return optStr;
		});
		
		console.log( 'buildSelect', {
			type           : type,
			devices        : devices,
			currentDevices : self.currentDevices,
		});
		const selectConf = {
			type : type,
			name : type,
			optionsHtml : options.join(),
		};
		const selectElement = hello.template.getElement( 'source-select-tmpl', selectConf );
		
		return selectElement;
		
		function buildOption( item ) {
			let selected = '';
			let label = null
			if ( item.label )
				label = item.label;
			else
				label = item.labelExtra || 'please report me, i shouldnt happen';
			
			// if there is a device dfined..
			if ( self.currentDevices && self.currentDevices[ item.kind ]) {
				const currDev = self.currentDevices[ item.kind ];
				// ..check if its this one
				console.log( 'checkSelected', {
					prefered : currDev,
					item     : item,
				});
				
				if ( currDev.label === item.label )
					selected = 'selected';
				
				if ( currDev.deviceId === item.deviceId )
					selected = 'selected';
				
			} else {
				// ..no device defined, so check if this is the 'no select' or default entry
				if (( label === 'none' ) || ( 'default' === item.deviceId ))
					selected = 'selected';
			}
			
			if ( selected )
				console.log( 'selected', item );
			
			const optionConf = {
				value    : item.deviceId,
				selected : selected,
				label    : item.displayLabel || label
			};
			const html = hello.template.get( 'source-select-option-tmpl', optionConf );
			return html;
		}
	}
	
	ns.SourceSelect.prototype.toggleExplain = function( show ) {
		const self = this;
		//var explainElement = document.getElementById( 'source-explain' );
		const errorElement = document.getElementById( 'source-error' );
		//explainElement.classList.toggle( 'hidden', !show );
		errorElement.classList.toggle( 'hidden', show );
	}
	
	ns.SourceSelect.prototype.toggleSelects = function( show ) {
		const self = this;
		var selects = document.getElementById( 'source-input' );
		selects.classList.toggle( 'hidden', !show );
	}
	
	ns.SourceSelect.prototype.toggleSelectError = function( type, errorMessage, hideSelect ) {
		const self = this;
		var hideSelect = !!hideSelect;
		var hasErr = !!errorMessage;
		var selectId = type + '-select';
		var errorId = type + '-error';
		var selectElement = document.getElementById( selectId );
		var errorElement = document.getElementById( errorId );
		
		selectElement.classList.toggle( 'hidden', hideSelect );
		errorElement.innerText = errorMessage;
		errorElement.classList.toggle( 'hidden', !hasErr );
	}
	
	ns.SourceSelect.prototype.clear = function() {
		const self = this;
		var clear = [
			self.audioId,
			self.videoId,
			self.outputId,
		];
		
		clear.forEach( remove );
		function remove( type ) {
			var id = 'source-select-' + type;
			var element = document.getElementById( id );
			if ( !element )
				return;
			
			element.parentNode.removeChild( element );
		}
	}
	
	ns.SourceSelect.prototype.done = function( selected ) {
		const self = this;
		self.clearPreview();
		if ( selected )
			selected = getChanged( selected );
		
		self.onselect( selected );
		
		function getChanged( sel ) {
			const curr = self.currentDevices;
			if ( sel.audioinput === curr.audioinput )
				sel.audioinput = null;
			if ( self.videoinput === curr.videoinput )
				sel.videoinput = null;
			if ( sel.audiooutput === curr.audiooutput )
				sel.audiooutput = null;
			
			return sel;
		}
	}
	
})( library.view );
