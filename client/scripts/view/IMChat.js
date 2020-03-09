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

library.view = library.view || {};
library.component = library.component || {};

// IMChat
( function( ns, undefined ) {
	ns.IMChat = function( conf ) {
		if ( !( this instanceof ns.IMChat ))
			return new ns.IMChat( conf );
		
		var self = this;
		self.contact = null;
		self.user = null;
		self.view = null;
		self.isWaiting = true;
		self.firstNonLog = null;
		self.firstNonLogSet = false;
		self.firstNonLogTime = null;
		self.voiceSynthActive = false;
		self.multilineActive = false;
		
		self.appOnline = null;
		
		self.init();
	}
	
	ns.IMChat.prototype.init = function() {
		const self = this;
		window.View.setBody(); // sets friend.template
		if ( window.View.appConf.hideLive )
			self.toggleLiveBtns( false );
		
		self.view = window.View;
		self.messages = document.getElementById( 'messages' );
		self.placeholder = document.getElementById( 'message-confirm' );
		self.placeholderText = document.getElementById( 'message-ph' );
		
		self.bottomScroller = new library.component.BottomScroller( 'messages' );
		self.flourish = new library.component.Flourish( 'flourish-message' );
		self.highlight = new library.component.Highlight({
			cssClass : 'hajlajt',
			listener : handleHighlight,
		});
		
		function handleHighlight( e ) {
			self.view.sendMessage({
				type : 'highlight',
			});
		}
		
		// handle drag and drop
		var dropConf = {
			targetId : 'hello',
			ondrop : onDrop,
		};
		self.drop = new library.component.Drop( dropConf );
		function onDrop( e ) { self.send( e ); }
		
		// generic
		self.bindView();
		self.bindEvents();
		
		window.View.loaded();
		
		// Timeout for loading messages
		setTimeout( function()
		{
			self.messages.classList.add( 'SmoothScrolling' );
		}, 50 );
	};
	
	ns.IMChat.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'log', log );
		self.view.on( 'message', message );
		self.view.on( 'action', action );
		self.view.on( 'notification', notification );
		self.view.on( 'state', updateState );
		self.view.on( 'focus', setFocus );
		self.view.on( 'identity', updateIdentity );
		self.view.on( 'user', updateUser );
		self.view.on( 'link', fileShared );
		self.view.on( 'showencrypt', toggleCanEncrypt );
		self.view.on( 'encrypt', encryptToggle );
		
		function log( e ) { self.handleLog( e ); }
		function message( e ) { self.handleMessage( e ); }
		function action( e ) { self.handleAction( e ); }
		function notification( e ) { self.handleNotification( e ); }
		function initialize( e ) { self.initialize( e ); }
		function updateState( e ) { self.updateState };
		function setFocus( e ) { self.handleFocus( e ); }
		function updateIdentity( e ) { self.updateIdentity( e ); }
		function updateUser( e ) { self.updateUser( e ); }
		function fileShared( e ) { self.handleFileShared( e ); }
		function toggleCanEncrypt( e ) { self.toggleCanEncrypt( e ); }
		function encryptToggle( e ) { self.toggleIsEncrypting( e ); }
	}
	
	ns.IMChat.prototype.toggleLiveBtns = function( show ) {
		const self = this;
		vBtn = document.getElementById( 'start-video' );
		aBtn = document.getElementById( 'start-audio' );
		vBtn.classList.toggle( 'hidden', !show );
		aBtn.classList.toggle( 'hidden', !show );
	}
	
	ns.IMChat.prototype.handleLog = function( log ) {
		var self = this;
		if ( self.isWaiting )
			self.removeWaiting();
		
		if ( !log ) {
			self.toggleSmoothScroll( true );
			return;
		}
		
		if ( !logIsHistory( log ))
			return;
		
		var element = self.msgBuilder.log( log );
		self.addLog( element );
		
		function logIsHistory( log ) {
			if ( !self.firstNonLogTime )
				return true;
			
			var logTime = log.data.time;
			if ( self.firstNonLogTime <= logTime ) {
				console.log( 'invalid log item', {
					t : self.firstNonLogTime,
					lt : logTime,
				});
				return false;
			}
			
			return true;
		}
	}
	
	ns.IMChat.prototype.handleMessage = function( data ) {
		var self = this;
		if ( data.mid && self.checkExists( data.mid )) {
			return;
		}
		
		if ( self.isWaiting )
			self.removeWaiting();
		
		// self sent
		if ( !data.from )
			self.hideMessagePlaceholder();
		
		if ( self.voiceSynthActive && data.from )
			api.Say( data.message );
		
		var element = self.msgBuilder.message( data );
		if ( !self.firstNonLogSet )
			self.setFirstNonLog( element, data.time );
		
		self.highlight.check( data.message, element );
		self.add( element );
		
		//self.flourish.do( element );
	}
	
	ns.IMChat.prototype.handleAction = function( data ) {
		var self = this;
		if ( self.isWaiting )
			self.removeWaiting();
		
		var element = self.msgBuilder.action( data );
		if ( !self.firstNonLogSet )
			self.setFirstNonLog( element, data.time );
		
		self.highlight.check( data.message, element );
		self.add( element );
	}
	
	ns.IMChat.prototype.handleNotification = function( data ) {
		var self = this;
		if ( self.isWaiting )
			self.removeWaiting();
		
		var element = self.msgBuilder.notification( data );
		if ( !self.firstNonLogSet )
			self.setFirstNonLog( element, data.time );
		
		self.add( element );
	}
	
	ns.IMChat.prototype.checkExists = function( msgId ) {
		var self = this;
		if ( !msgId )
			return false;
		
		var element = document.getElementById( msgId );
		if ( !element )
			return false;
		
		return true;
	}
	
	ns.IMChat.prototype.removeWaiting = function() {
		var self = this;
		self.isWaiting = false;
		var waitingElement = document.getElementById( 'waiting' );
		if ( !waitingElement )
			return;
		
		waitingElement.parentNode.removeChild( waitingElement );
	}
	
	ns.IMChat.prototype.toggleSmoothScroll = function( setSmooth ) {
		const self = this;
		if ( !self.messages )
			return;
		
		self.messages.classList.toggle( 'SmoothScrolling', setSmooth );
	}
	
	ns.IMChat.prototype.initialize = function( data ) {
		var self = this;
		self.contact = data.state.contact;
		self.user = data.state.user;
		self.highlight.setCheck( self.user.name );
		self.encryptIsDefault = !!data.state.encryptIsDefault;
		self.updateButtons( data.state );
		
		hello.config = data.config;
		
		// parser
		self.parser = new library.component.parse.Parser();
		self.parser.use( 'LinkStd' );
		self.parser.use( 'Emojii', hello.config.emojii );
		
		// link expansion
		const leConf = {
			templateManager : friend.template,
		};
		self.linkExpand = new library.component.LinkExpand( leConf );
		
		// msgBuilder
		const msgConf = {
			user             : self.user,
			contact          : self.contact,
			parser           : self.parser,
			template         : friend.template,
			linkExpand       : self.linkExpand,
			messageTmpl      : 'IM-msg-tmpl',
			actionTmpl       : 'IM-action-tmpl',
			notificationTmpl : 'chat-notie-tmpl',
			logClass         : 'LogText',
		}
		self.msgBuilder = new library.component.MsgBuilder( msgConf );
		
		// multi line input
		const multiConf = {
			containerId     : 'input-container',
			templateManager : friend.template,
			singleOnly      : !data.state.multilineCap,
			multiIsOn       : false,
		};
		self.input = new library.component.MultiInput( multiConf );
		self.input.on( 'submit'   , e => self.handleSubmit( e ));
		self.input.on( 'multiline', e => self.toggleMultilineActive( e ));
		
		// input history
		self.inputHistory = new library.component.InputHistory({
			inputId : 'chat-input',
		});
		
		// stuff
		self.setChattingWith();
		self.setAvatarCss();
		//self.toggleSmoothScroll( false );
		
		self.view.ready();
		
		if ( 'DESKTOP' !== window.View.deviceType )
			self.setFocus( true );
	}
	
	ns.IMChat.prototype.updateState = function( data ) {
		var self = this;
		console.log( 'view.IMChat.updateState - NYI', data );
	}
	
	ns.IMChat.prototype.updateButtons = function( state ) {
		var self = this;
		self.toggleCanMultilineBtn( !!state.multilineCap );
		self.toggleCanEncrypt( !!state.canEncrypt );
		self.toggleIsEncrypting( !!state.doEncrypt );
	}
	
	ns.IMChat.prototype.updateIdentity = function( data ) {
		var self = this;
		self.contact = data;
		self.setChattingWith();
	}
	
	ns.IMChat.prototype.updateUser = function( data ) {
		var self = this;
		self.user = data;
		//self.updateUserName();
	}
	
	ns.IMChat.prototype.handleDrop = function( e ) {
		var self = this;
		console.log( 'handleDrop - NYI', e );
		
	}
	
	ns.IMChat.prototype.handleFileShared = function( msg ) {
		var self = this;
		console.log( 'file shared - NYI', msg );
	}
	
	ns.IMChat.prototype.toggleCanMultilineBtn = function( canMultiline ) {
		var self = this;
		self.toggleMultilineBtn.classList.toggle( 'hidden', !canMultiline );
	}
	
	ns.IMChat.prototype.toggleCanEncrypt = function( canEncrypt ) {
		var self = this;
		self.encryptBtn.classList.toggle( 'hidden', !canEncrypt );
	}
	
	ns.IMChat.prototype.toggleIsEncrypting = function( cryptIsOn ) {
		var self = this;
		var icon = self.encryptBtn.querySelector( 'i' );
		icon.classList.toggle( 'fa-unlock', !cryptIsOn );
		
		if ( self.encryptIsDefault ){
			// self.encryptBtn.classList.toggle( 'blink-red', !cryptIsOn );
		}
		else
			self.encryptBtn.classList.toggle( 'accept', cryptIsOn );
	}
	
	ns.IMChat.prototype.bindEvents = function() {
		var self = this;
		self.form = document.getElementById( 'input-form' );
		const attachBtn = document.getElementById( 'attachment' );
		const submitBtn = document.getElementById( 'chat-submit' );
		self.toggleMultilineBtn = document.getElementById( 'leeloodallasmultiline' );
		self.toggleVoiceBtn = document.getElementById( 'toggle-voice' );
		const startVideoBtn = document.getElementById( 'start-video' );
		const startAudioBtn = document.getElementById( 'start-audio' );
		self.encryptBtn = document.getElementById( 'toggle-encrypt' );
		
		attachBtn.addEventListener( 'click', attach, false );
		submitBtn.addEventListener( 'click', submit, false );
		self.form.addEventListener( 'submit', submit, false );
		self.toggleMultilineBtn.addEventListener( 'click', toggleMultiline, false );
		self.toggleVoiceBtn.addEventListener( 'click', toggleVoice, false );
		startVideoBtn.addEventListener( 'click', startVideo, false );
		startAudioBtn.addEventListener( 'click', startAudio, false );
		self.encryptBtn.addEventListener( 'click', toggleEncrypt, false );
		
		// Handle paste if it isn't a file
		window.addEventListener( 'paste', function( evt )
		{
			var pastedItems = (evt.clipboardData || evt.originalEvent.clipboardData).items;
			for( var i in pastedItems ) {
				var item = pastedItems[i];
				if( item.kind === 'file' ) {
					var p = new api.PasteHandler();
					p.paste( evt, function( res ) {
						if( res.response == true ) {
							self.view.send(	{
								type: 'drag-n-drop',
								data: [ {
									Type: 'File',
									Path: res.path
								} ]
							} );
						}
					} );
					evt.preventDefault();
					evt.stopPropagation();
					break;
				}
			}
		} );
		
		function submit( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.input.submit();
		}
		
		function attach( e ) {
			var men = ge( 'attachment-menu' );
			
			var can = men.querySelector( '.Cancel' );
			var cam = men.querySelector( '.Camera' );
			var upl = men.querySelector( '.Upload' );
			can.onclick = function(){
				console.log( 'Here: ', men );
				men.classList.remove( 'Showing' );
			}
			
			if( men.classList.contains( 'Showing' ) ) {
				men.classList.remove( 'Showing' );
			}
			else {
				men.classList.add( 'Showing' );
			}
			upl.onclick = function( e ){
				men.classList.remove( 'Showing' );
				executeAttach( e );
			}
			
			self.view.prepareCamera( cam, function( data ) {
				men.classList.remove( 'Showing' );
			} );
		}
		
		function executeAttach( e )
		{
			self.send( {
				type: 'attach',
				data: false
			} );
		};
		
		function toggleMultiline( e ) { self.input.toggleMultiline(); }
		function toggleVoice( e ) { self.toggleVoice( e ); }
		function startVideo( e ) { self.startLive( 'video' ); }
		function startAudio( e ) { self.startLive( 'audio' ); }
		function toggleEncrypt( e ) { self.toggleEncrypt( e ); }
	}
	
	ns.IMChat.prototype.handleFocus = function( isFocus ) {
		if( View.deviceType != 'DESKTOP' )
			return;
		var self= this;
		if ( !self.input )
			return;
		
		if ( !!self.hasFocus === !!isFocus )
			return;
		
		self.hasFocus = !!isFocus;
		if ( self.hasFocus )
			self.input.focus();
	}
	
	ns.IMChat.prototype.setFocus = function() {
		if( View.deviceType != 'DESKTOP' )
			return;
		var self = this;
		if ( !self.input )
			return;
		
		self.input.focus();
	}
	
	ns.IMChat.prototype.handleSubmit = function( message ) {
		var self = this;
		if ( !message || !message.length ) {
			done();
			return;
		}
		
		self.inputHistory.add( message );
		if ( self.isChatMessage( message ))
			self.toggleMessagePlaceholder( message );
		
		var msg = {
			type : 'message',
			data : message,
		};
		self.send( msg );
		done();
		
		function done() {
			self.input.setValue( '' );
		}
	}
	
	// implement for each thingie, IRC, Treeroot etc
	ns.IMChat.prototype.isChatMessage = function( msg ) {
		const self = this;
		return true;
	}
	
	ns.IMChat.prototype.hideMessagePlaceholder = function( event ) {
		const self = this;
		self.toggleMessagePlaceholder();
	}
	
	ns.IMChat.prototype.toggleMessagePlaceholder = function( msg ) {
		var self = this;
		if ( msg ) {
			self.placeholderText.textContent = msg;
			self.placeholder.classList.toggle( 'hidden', false );
		}
		else
			self.placeholder.classList.toggle( 'hidden', true );
	}
	
	ns.IMChat.prototype.add = function( element ) {
		var self = this;
		self.messages.appendChild( element );
	}
	
	ns.IMChat.prototype.setFirstNonLog = function( element, timestamp ) {
		var self = this;
		self.firstNonLog = element;
		self.firstNonLogTime = timestamp;
		self.firstNonLogSet = true;
	}
	
	ns.IMChat.prototype.addLog = function( element ) {
		var self = this;
		if ( self.firstNonLog )
			self.messages.insertBefore( element, self.firstNonLog );
		else
			self.messages.appendChild( element );
	}
	
	ns.IMChat.prototype.toggleMultilineActive = function( isActive ) {
		var self = this;
		self.toggleMultilineBtn.classList.toggle( 'blink-green', isActive );
	}
	
	ns.IMChat.prototype.toggleVoice = function( e ) {
		var self = this;
		self.voiceSynthActive = !self.voiceSynthActive;
		self.toggleVoiceBtn.classList.toggle( 'blink-green', self.voiceSynthActive );
	}
	
	ns.IMChat.prototype.startLive = function( mode ) {
		var self = this;
		const startLive = {
			type : 'start-live',
			data : {
				mode        : mode,
				permissions : null,
			},
		};
		self.send( startLive );
	}
	
	ns.IMChat.prototype.toggleEncrypt = function() {
		var self = this;
		var encrypt = {
			type : 'encrypt',
		};
		self.send( encrypt );
	}
	
	ns.IMChat.prototype.setChattingWith = function() {
		var self = this;
		var element = document.getElementById( 'chatting-with' );
		element.textContent = self.contact.name;
	}
	
	ns.IMChat.prototype.setAvatarCss = function( data ) {
		var self = this;
		self.styleId = 'IM-chat-styleId';
		var contactAvatar = self.contact.avatar 
			|| library.component.Identity.prototype.avatarAlt;
		var userAvatar = self.user.avatar 
			|| library.component.Identity.prototype.avatar;
		
		var styleConf = {
			styleId : self.styleId,
			contactAvatarUrl : contactAvatar,
			selfAvatarUrl : userAvatar,
		};
		
		var style = friend.template.getElement( 'chatIM-custom-css-tmpl', styleConf );
		document.head.appendChild( style );
	}
	
	ns.IMChat.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
})( library.view );


(function( ns, undefined ) {
	ns.TreerootChat = function( conf ) {
		const self = this;
		library.view.IMChat.call( self, conf );
	}
	
	ns.TreerootChat.prototype = Object.create( library.view.IMChat.prototype );
	
	ns.TreerootChat.prototype.isChatMessage = function( msg ) {
		const self = this;
		return true;
	}
	
})( library.view );


(function( ns, undefined ) {
	ns.IRCChat = function( conf ) {
		const self = this;
		library.view.IMChat.call( self, conf );
	}
	
	ns.IRCChat.prototype = Object.create( library.view.IMChat.prototype );
	
	ns.IRCChat.prototype.isChatMessage = function( msg ) {
		const self = this;
		if ( '/' === msg[ 0 ])
			return false;
		
		return true;
	}
})( library.view );


// wait for view to call run
window.View.run = run;
function run( conf ) {
	if ( !conf || !conf.chatType )
		throw new Error( 'conf || conf.chatType is missing RABBLE RABBLE RABBLE' );
	
	let Chat = null;
	if ( 'irc' === conf.chatType )
		Chat = library.view.IRCChat;
	
	if ( 'treeroot' === conf.chatType )
		Chat = library.view.TreerootChat;
	
	window.chat = new Chat( conf );
}
