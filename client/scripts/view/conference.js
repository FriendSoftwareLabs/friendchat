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

// Conference
(function( ns, undefined ) {
	ns.Conference = function( fupConf ) {
		if ( fupConf )
			console.log( 'view.Conference - fup conf apparently?', fupConf );
		
		const self = this;
		
		self.topic = '';
		self.mode = '';
		
		self.participantsContainerId = 'participants';
		self.participants = {};
		self.moderators = {};
		self.moderatorOrder = [];
		self.voice = {};
		self.voiceOrder = [];
		self.peons = {};
		self.peonOrder = [];
		self.user = null;
		
		self.doFlourish = false;
		
		self.view = null;
		self.appOnline = null;
		
		self.init();
	}
	
	ns.Conference.prototype.init = function() {
		const self = this;
		window.View.setBody();
		if ( window.View.appConf.hideLive )
			self.toggleLiveBtns();
		
		self.view = window.View;
		self.modes = [
			'm',
			'v',
			'',
		];
		self.modeData = {};
		self.modeStyleMap = {
			m  : 'fa-at',
			v  : 'fa-plus',
			'' : '',
		};
		
		self.systemMsgIconMap = {
			nick     : 'fa-user',
			join     : 'fa-user-plus',
			part     : 'fa-user-times',
			quit     : 'fa-user-times',
			kick     : 'fa-bolt',
			ban      : 'fa-ban',
			topic    : 'fa-bullhorn',
			usermode : 'fa-bolt',
		};
		
		self.systemMsgKlassMap = {
			nick     : 'Available',
			join     : 'Accept',
			part     : 'Warning',
			quit     : 'Warning',
			kick     : 'Danger',
			ban      : 'Danger',
			topic    : 'Accept',
			upmode   : 'Accept',
			downmode : 'Danger',
		}
		
		self.systemMsgIconDefault = 'fa-info';
		
		self.messageScroller = new library.component.BottomScroller( 'messages' );
		self.messages = document.getElementById( 'messages' );
		self.flourish = new library.component.Flourish( 'flourish-message' );
		self.highlight = new library.component.Highlight({
			cssClass : 'Highlight',
			listener : handleHighlight,
		});
		
		function handleHighlight( e ) {
			self.send({
				type : 'highlight',
			});
		}
		
		var dropConf = {
			targetId : 'hello',
			ondrop : onDrop,
		}
		self.drop = new library.component.Drop( dropConf );
		function onDrop( event ) { self.send( event ); }
		
		self.numOp = document.getElementById( 'num-op' );
		self.numVoice = document.getElementById( 'num-voice' );
		self.numPeon = document.getElementById( 'num-peon' );
		
		self.bindView();
		self.bindEvents();
		
		if ( 'MOBILE' === window.View.deviceType )
			self.showhideToggle( false );
		
		// Timeout for loading messages
		setTimeout( function()
		{
			self.messages.classList.add( 'SmoothScrolling' );
		}, 50 );
		
		window.View.loaded();
	}
	
	ns.Conference.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'message', message );
		self.view.on( 'log', log );
		self.view.on( 'notification', notification );
		self.view.on( 'action', action );
		self.view.on( 'join', join );
		self.view.on( 'part', part );
		self.view.on( 'quit', quit );
		self.view.on( 'kick', kick );
		self.view.on( 'ban', ban );
		self.view.on( 'mode', mode );
		self.view.on( 'usermode', userMode );
		self.view.on( 'nick', nick );
		self.view.on( 'participants', participants );
		self.view.on( 'topic', topic );
		self.view.on( 'user', updateUser );
		
		function initialize( e ) { self.initialize( e ); }
		function message( e ) { self.handleMessage( e ); }
		function log( e ) { self.handleLog( e ); }
		function notification( e ) { self.handleNotification( e ); }
		function action( e ) { self.handleAction( e ); }
		function join( e ) { self.join( e ); }
		function part( e ) { self.part( e ); }
		function quit( e ) { self.quit( e ); }
		function kick( e ) { self.kick( e ); }
		function ban( e ) { self.ban( e ); }
		function mode( e ) { self.setMode( e ); }
		function userMode( e ) { self.setUserMode( e ); }
		function nick( e ) { self.updateNick( e ); }
		function participants( e ) { self.moreParticipants( e ); }
		function topic( e ) { self.setTopic( e ); }
		function updateUser( e ) { self.updateUser( e ); }
	}
	
	ns.Conference.prototype.toggleLiveBtns = function( show ) {
		const self = this;
		
	}
	
	ns.Conference.prototype.initialize = function( data ) {
		var self = this;
		var state = data.state;
		self.user = state.user;
		
		// link expansion
		var leConf = {
			templateManager : friend.template,
		};
		self.linkExpand = new library.component.LinkExpand( leConf );
		
		// message parsing
		self.parser = new library.component.parse.Parser();
		self.parser.use( 'LinkStd' );
		self.parser.use( 'Emojii', data.emojii );
		
		// msgBuilder
		var msgConf = {
			user             : self.user,
			contact          : null,
			parser           : self.parser,
			template         : friend.template,
			linkExpand       : self.linkExpand,
			messageTmpl      : 'message-tmpl',
			actionTmpl       : 'action-tmpl',
			notificationTmpl : 'chat-notie-tmpl',
			logClass         : 'LogText',
		}
		self.msgBuilder = new library.component.MsgBuilder( msgConf );
		
		// multiline input
		var inputConf = {
			containerId     : 'input-container',
			templateManager : friend.template,
			singleOnly      : false,
			multiIsOn       : false,
			onsubmit        : onSubmit,
			onmode          : onMode,
		};
		self.input = new library.component.MultiInput( inputConf );
		function onSubmit( e ) { self.sendMessage( e ); }
		function onMode( e ) {
			//self.toggleMultilineActive( e );
		}
		
		// input history
		var historyConf = {
			inputId : 'chat-input',
		};
		self.inputHistory = new library.component.InputHistory( historyConf );
		
		// tab complete
		var inputArea = document.getElementById( 'chat-input' );
		inputArea.addEventListener( 'keydown', inputKeydown, false );
		function inputKeydown( e ) {
			self.tryAutoComplete( e );
		}
		
		// 
		//var resizeEvent = new Event( 'resize' );
		//document.body.dispatchEvent( resizeEvent );
		
		// stuff
		self.highlight.setCheck( state.user.name );
		self.setTopic( state.topic );
		self.setMode( state.mode );
		self.moreParticipants( state.participants );
		
		window.View.ready();
		self.doFlourish = true;
		
		if ( 'DESKTOP' == window.View.deviceType )
		{
			self.input.focus();
		}
	}
	
	ns.Conference.prototype.handleLog = function( log ) {
		var self = this;
		var el = self.msgBuilder.log( log );
		if ( !el )
			return;
		
		self.messages.appendChild( el );
	}
	
	ns.Conference.prototype.handleMessage = function( data ) {
		var self = this;
		var element = self.msgBuilder.message( data );
		self.highlight.check( data.message, element );
		self.messages.appendChild( element );
		self.bindNameDblClick( element );
	}
	
	ns.Conference.prototype.handleAction = function( data, isRealtime ) {
		var self = this;
		var element = self.msgBuilder.action( data );
		self.highlight.check( data.message, element );
		self.messages.appendChild( element );
		self.bindNameDblClick( element );
	}
	
	ns.Conference.prototype.handleNotification = function( data, isRealtime ) {
		var self = this;
		var el = self.msgBuilder.notification( data );
		self.messages.appendChild( el );
	}
	
	ns.Conference.prototype.bindNameDblClick = function( element ) {
		var self = this;
		if ( !element ) {
			throw new Error( 'bindNameDblClick - no el' );
			return;
		}
		
		element.addEventListener( 'dblclick', doubleClick, false );
		function doubleClick( e ) {
			var element = this;
			self.participantDoubleClick( element );
		}
	}
	
	ns.Conference.prototype.join = function( user ) {
		var self = this;
		var meta = self.buildParticipant( user );
		self.addParticipant( user );
		var conf = {
			type : 'join',
			message : user.name + ' ' + View.i18n( 'i18n_has_joined' ),
			time : user.time,
		};
		self.systemMsg( conf );
	}
	
	ns.Conference.prototype.part = function( data ) {
		var self = this;
		if ( !self.participants[ data.who ]) {
			console.log( 'conference.part - participant not found', data );
			return;
		}
		
		self.removeParticipant( data.who );
		var conf = {
			type    : 'part',
			message : data.who + ' ' + View.i18n( 'i18n_left' ),
			time    : data.time,
		}
		self.systemMsg( conf );
	}
	
	ns.Conference.prototype.quit = function( data ) {
		var self = this;
		if ( !self.participants[ data.who ]) {
			console.log( 'conference.quit - participant not found', data );
			return;
		}
		
		self.removeParticipant( data.who );
		var conf = {
			type    : 'quit',
			message : data.who + ' ' + View.i18n( 'i18n_has_quit' ) + ' ' + data.message + ' ).',
			time    : data.time,
		};
		self.systemMsg( conf );
	}
	
	ns.Conference.prototype.kick = function( event ) {
		const self = this;
		self.removeParticipant( event.victim );
		let victim = event.victim;
		if ( victim === self.user.name ) {
			victim = View.i18n( 'i18n_you' );
			self.clearUserList();
		}
		
		const conf = {
			type    : 'kick',
			message : event.victim + ' ' + View.i18n( 'i18n_was_kicked_by' ) + ' ' + event.kicker,
			time    : event.time,
		};
		self.systemMsg( conf );
	}
	
	ns.Conference.prototype.ban = function( event ) {
		const self = this;
		self.removeParticipant( event.victim );
		const conf = {
			type    : 'ban',
			message : event.banner + ' ' + View.i18n( 'i18n_sets_mode' ) + ' ' + event.mode + ' ' + event.victim,
			time    : event.time,
		}
		self.systemMsg( conf );
	}
	
	ns.Conference.prototype.updateUser = function( update ) {
		var self = this;
		var change = {
			current : self.user.name,
			update  : update.name,
		};
		self.highlight.setCheck( change.update );
		self.updateNick( change );
		
		self.user = update;
	}
	
	ns.Conference.prototype.updateNick = function( data ) {
		var self = this;
		var current = self.participants[ data.current ];
		var update = self.buildParticipant({ name : data.update });
		if ( !current || !update ) {
			console.log( 'view.updateNick - rabblerabblerabble', { p : self.participants, d : data });
			return;
		}
		
		update.mode = current.mode;
		self.removeParticipant( current.name );
		self.addParticipant( update );
		
		var conf = {
			type : 'nick',
			message :  data.current + ' ' + View.i18n('i18n_is_now_known_as') + ' ' + update.name,
			time : data.time,
		};
		self.systemMsg( conf );
	}
	
	ns.Conference.prototype.setTopic = function( data ) {
		var self = this;
		self.topic = {
			from : data.from,
			topic : data.topic,
			time : data.time,
		};
		
		var topicContainer = document.getElementById( 'topic' );
		topicContainer.innerHTML = data.topic || 'no topic';
		
		if ( data.from && data.topic && data.time )
			self.topicMsg( data );
	}
	
	ns.Conference.prototype.topicMsg = function( data ) {
		var self = this;
		var conf = {
			type : 'topic',
			message : data.from + ' ' + View.i18n('i18n_changed_topic_to') + ': ' + data.topic,
			time: data.time,
		};
		self.systemMsg( conf );
	}
	
	ns.Conference.prototype.setMode = function( data ) {
		var self = this;
		console.log( 'conference.setMode', data );
	}
	
	ns.Conference.prototype.setUserMode = function( data ) {
		var self = this;
		var target = data.target.name;
		self.updateParticipantMode( data.target );
		const mode = data.mode;
		const mote = '+' === mode[0] ? 'upmode' : 'downmode';
		let message = mode + ' ' + target;
		if ( data.source && data.source.name ) {
			message = data.source.name + ' ' 
			+ View.i18n('i18n_sets_mode') + ' '
			+ message;
		}
		
		var msgConf = {
			type      : 'usermode',
			klassType : mote,
			message   : message,
			time      : data.time,
		};
		self.systemMsg( msgConf );
	}
	
	ns.Conference.prototype.systemMsg = function( conf ) {
		var self = this;
		const klass = conf.klassType || conf.type;
		var icon = self.systemMsgIconMap[ conf.type ] || self.systemMsgIconDefault;
		var type = self.systemMsgKlassMap[ klass ] || klass;
		var tmplConf = {
			type : type || 'generic',
			icon : icon,
			time : conf.time || Date.now(),
			message : conf.message,
		};
		self.addMsg( 'system-msg-tmpl', tmplConf );
	}
	
	ns.Conference.prototype.addMsg = function( tmpl, conf, isRealtime ) {
		var self = this;
		if ( conf.time )
			conf.time = library.tool.getChatTime( conf.time );
		
		var element = friend.template.getElement( tmpl, conf );
		self.linkExpand.work( element );
		self.messages.appendChild( element );
	}
	
	ns.Conference.prototype.moreParticipants = function( participants ) {
		var self = this;
		var container = document.getElementById( self.participantsContainerId );
		participants = participants.filter( noExists );
		participants = participants.map( buildUser );
		participants.forEach( add );
		self.modes.forEach( sort );
		
		function noExists( meta ) {
			if ( !meta.name || !meta.name.length )
				return false;
			
			var added = self.participants[ meta.name ];
			if ( added )
				return false;
			
			return true;
		}
		
		function buildUser( meta ) { return self.buildParticipant( meta ); }
		
		function add( meta ) {
			var element = self.buildParticipantElement( meta );
			container.appendChild( element );
			self.participants[ meta.name ] = meta;
			self.addToMode( meta, null, true );
			self.setParticipantCss( meta );
		}
		
		function sort( mode ) {
			self.sortByName( mode );
			applySort( mode );
		}
		
		function applySort( mode ) {
			var mode = self.modeData[ mode ];
			if ( !mode )
				return;
			
			mode.order.forEach( reAppend );
			function reAppend( name ) {
				var meta = mode.members[ name ];
				var element = document.getElementById( meta.id );
				if ( !element )
					return;
				
				container.appendChild( element );
			}
		}
	}
	
	ns.Conference.prototype.bindEvents = function() {
		var self = this;
		self.settingsBtn = document.getElementById( 'settings-btn' );
		self.showHideBtn = document.getElementById( 'showhide-btn' );
		self.inputForm = document.getElementById( 'input-form' );
		const submitBtn = document.getElementById( 'chat-submit' );
		const attachBtn = document.getElementById( 'attachment' );
		
		//window.addEventListener( 'resize', windowResize, false );
		
		self.settingsBtn.addEventListener( 'click', showSettings, false );
		self.showHideBtn.addEventListener( 'click', showhideToggle, false );
		self.inputForm.addEventListener( 'submit', inputSubmit, false );
		submitBtn.addEventListener( 'click', inputSubmit, false );
		attachBtn.addEventListener( 'click', attach, false );
		
		function windowResize( e ) {
			self.handleWindowResize( e );
		}
		
		function showSettings( e ) {
			e.preventDefault();
			self.showSettings();
		}
		
		function showhideToggle( e ) {
			e.preventDefault();
			self.showhideToggle();
		}
		
		function inputSubmit( e ) {
			e.preventDefault();
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
	}
	
	ns.Conference.prototype.handleWindowResize = function( e ) {
		var self = this;
		if ( self.resizeTimeout ) {
			self.oneLastResize = true;
			return;
		}
		
		self.reflow();
		self.resizeTimeout = window.setTimeout( maybeResizeAgain, 100 );
		function maybeResizeAgain() {
			self.resizeTimeout = null;
			if ( self.oneLastReflow ) {
				self.oneLastReflow = false;
				self.reflow();
			}
		}
	}
	
	ns.Conference.prototype.reflow = function() {
		const self = this;
		var messages = document.getElementById( 'message-container' );
		var contacts = document.getElementById( 'participants-container' );
		window.View.triggerReflow( messages );
		window.View.triggerReflow( contacts );
	}
	
	ns.Conference.prototype.showSettings = function() {
		var self = this;
		var msg = {
			type : 'settings',
		};
		self.send( msg );
	}
	
	ns.Conference.prototype.showhideToggle = function( force ) {
		var self = this;
		var container = document.getElementById( 'participants-container', force );
		if ( null == force ) {
			container.classList.toggle( 'hide' );
		} else {
			container.classList.toggle( 'hide', !force );
		}
	}
	
	ns.Conference.prototype.sendMessage = function( str ) {
		var self = this;
		if ( !str || !str.length ) {
			done();
			return;
		}
		
		self.inputHistory.add( str );
		var msg = {
			type : 'message',
			data : str,
		};
		self.send( msg );
		done();
		
		function done() {
			self.input.setValue( '' );
		}
	}
	
	ns.Conference.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
	ns.Conference.prototype.addParticipant = function( meta ) {
		var self = this;
		meta.mode = meta.mode || ''; // empty string mode is default
		if ( exists( meta.name )) {
			console.log( 'aready added', meta );
			return;
		}
		
		var element = self.buildParticipantElement( meta );
		self.participants[ meta.name ] = meta;
		self.setParticipantCss( meta );
		self.addToMode( meta, element );
		
		if ( self.doFlourish )
			flourishJoin( meta.id );
		
		function flourishJoin( id ) {
			var element = document.getElementById( id );
			if ( !element ) {
				console.log( 'no element for', meta );
				return;
			}
			
			self.flourish.do( element, 'flourish-join' );
		}
		
		function exists( name ) { return !!self.checkParticipantExists( name ); }
	}
	
	ns.Conference.prototype.checkParticipantExists = function( name ) {
		var self = this;
		return !!self.participants[ name ];
	}
	
	ns.Conference.prototype.addToMode = function( meta, element, dontReorder ) {
		var self = this;
		if ( !element )
			element = document.getElementById( meta.id );
		
		var mode = self.modeData[ meta.mode ];
		if ( !mode )
			mode = addMode( meta.mode );
		
		mode.members[ meta.name ] = meta;
		mode.order.push( meta.name );
		self.updateModeInfo();
		
		if ( dontReorder )
			return;
		
		self.reorderInMode( meta, element );
		
		function addMode( mode ) {
			self.modeData[ mode ] = {
				members : {},
				order : [],
			};
			
			return self.modeData[ mode ];
		}
	}
	
	ns.Conference.prototype.reorderInMode = function( meta, element ) {
		var self = this;
		if ( !element )
			element = document.getElementById( meta.id );
		
		var mode = self.modeData[ meta.mode ];
		self.sortByName( meta.mode );
		var nextSiblingId = getIdOfNextSibling( meta );
		var nextSiblingNode = document.getElementById( nextSiblingId );
		if ( !nextSiblingNode )
			nextSiblingNode = null;
		
		var participantsContainer = document.getElementById( self.participantsContainerId );
		participantsContainer.insertBefore( element, nextSiblingNode );
		
		function getIdOfNextSibling( meta ) {
			var mode = self.modeData[ meta.mode ];
			var metaIndex = mode.order.indexOf( meta.name );
			var siblingName = mode.order[ metaIndex + 1 ];
			if ( siblingName )
				return mode.members[ siblingName ].id;
			
			return idOfFirstParticipantBelow( meta.mode );
			
			function idOfFirstParticipantBelow( mode ) {
				var modeIndex = self.modes.indexOf( mode );
				var member = false;
				
				do {
					modeIndex++;
					var nextMode = self.modes[ modeIndex ];
					var mode = self.modeData[ nextMode ];
					if ( mode )
						member = mode.order[ 0 ];
					
				} while ( !member && self.modes.length >= modeIndex );
				
				if ( !member )
					return null;
				
				return self.participants[ member ].id;
			}
		}
	}
	
	ns.Conference.prototype.removeFromMode = function( meta ) {
		var self = this;
		var mode = self.modeData[ meta.mode ];
		if ( !mode ) {
			console.log( 'removeFromMode - invalid mode', meta );
			return;
		}
		
		var index = mode.order.indexOf( meta.name );
		
		if ( index === -1 ) {
			console.log( 'could not find in mode', {
				m : meta,
				mode : mode,
			});
			return;
		}
		
		mode.order.splice( index, 1 );
		delete mode.members[ meta.name ];
		self.updateModeInfo();
	}
	
	ns.Conference.prototype.sortByName = function( mode ) {
		var self = this;
		var modeObj = self.modeData[ mode ];
		if ( !modeObj || !modeObj.order )
			return;
		
		var arr = modeObj.order;
		arr.sort( byName );
		
		function byName( a, b ) {
			var index = 0;
			// iterate over the string until a difference is found
			do {
				var ca = a[ index ];
				var cb = b[ index ];
				index++;
				if ( !isValid( ca ))
					return 1; // a ran out of characters to compare, it should come before b
				if ( !isValid( cb ))
					return -1;
				
				var order = compare( ca, cb );
			} while ( order === 0 );
			return order;
			
			function compare( ca, cb ) {
				ca = ca.toLowerCase();
				cb = cb.toLowerCase();
				
				if ( ca > cb )
					return 1;
				if ( ca < cb)
					return -1;
				
				return 0;
			}
			
			function isValid( letter ) {
				return typeof( letter ) !== 'undefined';
			}
		}
	}
	
	ns.Conference.prototype.updateModeInfo = function() {
		var self = this;
		var mods = self.modeData[ 'm' ];
		var voice = self.modeData[ 'v' ];
		var peons = self.modeData[ '' ];
		
		self.numOp.textContent = mods ? mods.order.length : 0;
		self.numVoice.textContent = voice ? voice.order.length : 0;
		self.numPeon.textContent = peons ? peons.order.length : 0;
	}
	
	ns.Conference.prototype.updateParticipantMode = function( update ) {
		var self = this;
		var newMode = update.mode;
		var meta = self.participants[ update.name ];
		self.removeFromMode( meta );
		meta.mode = newMode;
		
		var element = document.getElementById( meta.id );
		var modeClass = self.getModeStyle( newMode );
		var modeIcon = element.querySelector( '.mode i' );
		stripModeClasses( modeIcon );
		if ( modeClass.length )
			modeIcon.classList.add( modeClass );
		
		self.addToMode( meta );
		
		// key is not defined
		function stripModeClasses( element ) {
			for ( let key in self.modeStyleMap ) {
				var iconClass = self.modeStyleMap[ key ];
				remove( iconClass );
			}
			
			function remove( iconClass ) {
				if ( !iconClass )
					return;
				
				element.classList.remove( iconClass );
			}
		}
		
		function updateView( id, mode ) {
			
		}
	}
	
	ns.Conference.prototype.updateParticipantName = function( name, update ) {
		var self = this;
		//console.log( 'updateParticipantName', { n : name, u : update });
	}
	
	ns.Conference.prototype.removeParticipant = function( name ) {
		var self = this;
		var meta = self.participants[ name ];
		if ( !meta ) {
			console.log( 'conference.removeParticipant - not found', name );
			return;
		}
		
		self.removeParticipantCss( meta );
		self.removeFromMode( meta );
		var element = document.getElementById( meta.id );
		element.parentNode.removeChild( element );
		delete self.participants[ name ];
	}
	
	ns.Conference.prototype.clearUserList = function() {
		const self = this;
		const names = Object.keys( self.participants );
		names.forEach( remove );
		function remove( name ) { self.removeParticipant( name ); }
	}
	
	ns.Conference.prototype.setParticipantCss = function( meta ) {
		var self = this;
		var container = document.getElementById( 'participant-css' );
		var cssConf = {
			participantId : meta.id,
			avatarUrl : 'https://i.imgur.com/xn4cYl4.png',
		};
		var cssElement = friend.template.getElement( 'participant-css-tmpl', cssConf );
		container.appendChild( cssElement );
	}
	
	ns.Conference.prototype.removeParticipantCss = function( meta ) {
		var self = this;
		var cssId = meta.id + '-style';
		var cssElement = document.getElementById( cssId );
		cssElement.parentNode.removeChild( cssElement );
	}
	
	ns.Conference.prototype.buildParticipantElement = function( meta ) {
		var self = this;
		var container = document.getElementById( 'participants' );
		var modeStyle = self.getModeStyle( meta.mode );
		var conf = {
			id : meta.id,
			modeStyle : modeStyle,
			name : meta.name,
		};
		var element = friend.template.getElement( 'participant-tmpl', conf );
		bind( element, meta );
		return element;
		
		function bind( element, meta ) {
			element.addEventListener( 'dblclick', doubleClick, false );
			element.addEventListener( 'touchstart', touchStart, false );
			
			function doubleClick( e ) {
				var element = this;
				self.participantDoubleClick( element );
			}
			
			function touchStart( e ) {
				if ( self.userDblTouch ) {
					self.participantDoubleClick( element );
					window.clearTimeout( self.userDblTouch );
					self.userDblTouch = null;
				}
				
				self.userDblTouch = window.setTimeout( doubleTouchFailed, 500 );
				function doubleTouchFailed() {
					self.userDblTouch = null;
				}
			}
		}
	}
	
	ns.Conference.prototype.participantDoubleClick = function( element ) {
		var self = this;
		var nameElement = element.querySelector( '.name' );
		var name = nameElement.textContent.trim();
		var meta = self.participants[ name ];
		self.openPrivateView( meta );
	}
	
	ns.Conference.prototype.openPrivateView = function( meta ) {
		var self = this;
		if ( meta.name === self.user.name )
			return;
		
		var openPriv = {
			type : 'private',
			data : meta,
		};
		self.send( openPriv );
	}
	
	ns.Conference.prototype.buildParticipant = function( user ) {
		var self = this;
		user.id = self.getHtmlId( user.name );
		user.mode = user.mode || '';
		return user;
	}
	
	ns.Conference.prototype.getHtmlId = function( name ) {
		var self = this;
		if ( !name || !name.split )
			return;
		// repalce html/css unfriendly characters
		return name
			.split('[').join('u')
			.split(']').join('U')
			.split('{').join( 'v')
			.split( '}' ).join( 'V' )
			.split( '\\' ).join( 'x')
			.split( '`' ).join( 'y' )
			.split( '^' ).join( 'z' );
	}
	
	ns.Conference.prototype.getModeStyle = function( mode ) {
		var self = this;
		if ( !mode || !mode.length )
			mode = '';
		
		if ( 1 < mode.length ) {
			mode = mode.split( '' )[ 0 ];
			mode = mode || '';
		}
		
		const style = self.modeStyleMap[ mode ] || '';
		return style;
	}
	
	ns.Conference.prototype.tryAutoComplete = function( e ) {
		var self = this;
		var key = e.code || e.key;
		if ( 'Tab' !== key ) // 9 is tab key
			return;
		
		var inputStr = self.input.getValue();
		if ( !inputStr.length )
			return;
		
		var parts = inputStr.split( ' ' );
		var str = parts.pop(); // match against last part of input
		                       // to support tab complete in sentences
		
		var pIds = Object.keys( self.participants );
		var pId = pIds.find( match );
		if ( !pId )
			return;
		
		e.preventDefault();
		//e.stopPropagation();
		var name = self.participants[ pId ].name;
		var term = ': ';
		var input = '';
		if ( parts.length ) {
			parts.push( name );
			input = parts.join( ' ' );
		} else {
			input = name + term;
		}
		
		self.input.setValue( input );
		
		function match( pId ) {
			var pname = self.participants[ pId ].name;
			if( pname.toLowerCase().substr( 0, str.length ) === str.toLowerCase() )
				return true;
			return false;
		}
	}
	
})( library.view );


window.View.run = run;
function run( fupConf ) {
	window.conference = new library.view.Conference( fupConf );
}
