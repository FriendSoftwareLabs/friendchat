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

// PresenceChat
(function( ns, undefined ) {
	ns.PresenceChat = function( state, eventsink, onclose ) {
		const self = this;
		library.component.EventEmitter.call( self, eventsink );
		
		self.state = state;
		self.onclose = onclose;
		
		self.drop = null;
		
		self.init();
	}
	
	ns.PresenceChat.prototype =
		Object.create( library.component.EventEmitter.prototype );
		
	// Public
	
	ns.PresenceChat.prototype.send = function( event ) {
		const self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( event );
	}
	
	ns.PresenceChat.prototype.close = function() {
		const self = this;
		delete self.initData;
		delete self.onclose;
		self.closeEventEmitter();
		if ( self.view )
			self.view.close();
	}
	
	// Private
	
	ns.PresenceChat.prototype.init = function() {
		const self = this;
		var dropConf = {
			toView : toView,
			toChat : toChat,
		};
		self.drop = new library.component.Droppings( dropConf );
		function toView( e ) {
			// lets not
		}
		function toChat( link ) {
			const chat = {
				type : 'msg',
				data : {
					message : link,
				},
			};
			self.emit( 'chat', chat );
		}
		
		const filePath = 'html/presence.html';
		const windowConf = {
			title  : self.state.roomName,
			width  : 700,
			height : 450,
		};
		
		const initData = {
			state     : self.state,
			fragments : hello.commonFragments,
			emojii    : hello.config.emojii,
		};
		
		self.view = new api.View(
			filePath,
			windowConf,
			initData,
			eventSink,
			closed
		);
		
		self.view.on( 'drag-n-drop', droppings );
		function droppings( e ) { self.drop.handle( e ); }
		function eventSink( type, data ) {
			self.emit( type, data );
		}
		
		function closed( e ) {
			if ( self.onclose )
				self.onclose();
		}
	}
	
})( library.view );

// About
(function( ns, undefined ) {
	ns.About = function( onclose ) {
		if ( !( this instanceof ns.About ))
			return new ns.About( onclose );
		
		var self = this;
		self.onclose = onclose;
		self.init();
	}
	
	ns.About.prototype.init = function() {
		var self = this;
		const windowConf = {
			title : hello.config.appName + ' - About',
			width : 400,
			height : 400,
		};
		self.view = hello.app.createView(
			'html/about.html',
			windowConf,
			null,
			null,
			closed
		);
		
		function closed() {
			self.view = null;
			const onclose = self.onclose();
			delete self.onclose;
			if ( onclose )
				onclose();
		}
	}
	
	ns.About.prototype.close = function() {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.close();
		self.view = null;
	}
	
})( library.view );

// Loading
(function( ns, undefined ) {
	ns.Loading = function( onclose ) {
		if ( !( this instanceof ns.Loading ))
			return new ns.Loading( onclose );
		
		var self = this;
		self.onclose = onclose;
		
		self.init();
	}
	
	ns.Loading.prototype.init = function() {
		const self = this;
		const winConf = {
			title : hello.config.appName,
			width : 400,
			height : 200,
		};
		const viewConf = {
			fragments : hello.commonFragments,
		};
		
		self.view = hello.app.createView(
			'html/loading.html',
			winConf,
			viewConf,
			null,
			closed
		);
		
		function closed( e ) {
			self.view = null;
			self.onclose();
		}
	}
	
	ns.Loading.prototype.setState = function( state ) {
		var self = this;
		if ( !self.view )
			return;
		
		var event = {
			type : 'conn-state',
			data : state,
		}
		self.view.sendMessage( event );
	}
	
	ns.Loading.prototype.close = function() {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.close();
		self.view = null;
	}
	
})( library.view );


// IMChat
(function( ns, undefined ) {
	ns.IMChat = function( conf ) {
		if ( !( this instanceof ns.IMChat ))
			return new ns.IMChat( conf );
		
		var self = this;
		self.state = conf.state;
		self.viewConf = conf.viewConf || {};
		self.onready = conf.onready;
		self.onclose = conf.onclose;
		self.onmessage = conf.onmessage;
		self.onlive = conf.onlive;
		self.onhighlight = conf.onhighlight;
		self.onencrypt = conf.onencrypt;
		
		self.drop = null;
		
		self.init();
	}
	
	ns.IMChat.prototype.setTitle = function( title ) {
		var self = this;
		self.view.setTitle( title );
	}
	
	ns.IMChat.prototype.init = function() {
		var self = this;
		
		// drag and drop handler
		var dropConf = {
			toView : toView,
			toChat : toChat,
		};
		self.drop = new library.component.Droppings( dropConf );
		function toView( e ) { self.sendMessage( e ); }
		function toChat( e ) { self.onmessage( e ); }
		const windowConf = {
			title    : 'Chatting with ' + self.state.contact.name,
			width    : 500,
			height   : 450,
			viewConf : self.viewConf,
		};
		
		const initData = {
			state     : self.state,
			fragments : hello.commonFragments,
			config    : hello.config,
		};
		
		self.view = hello.app.createView(
			'html/IMChat.html',
			windowConf,
			initData,
			null,
			closed
		);
		
		self.view.onready = self.onready;
		
		self.bindView();
		
		function closed( msg ) { self.closed(); }
	}
	
	ns.IMChat.prototype.bindView = function() {
		var self = this;
		self.view.on( 'exit', exit );
		self.view.on( 'message', self.onmessage );
		self.view.on( 'highlight', handleHighlight );
		self.view.on( 'start-live', self.onlive );
		self.view.on( 'drag-n-drop', handleDropped );
		self.view.on( 'encrypt', self.onencrypt );
		
		function exit( msg ) { self.close(); }
		function handleDropped( e ) { self.drop.handle( e ); }
		function handleHighlight( e ) {
			if ( self.onhighlight )
				self.onhighlight( e );
		}
	}
	
	ns.IMChat.prototype.activate = function() {
		var self = this;
		self.view.activate();
	}
	
	ns.IMChat.prototype.toggleVoice = function() {
		var self = this;
		console.log( 'viewmodel.IMChat.toggleVoice - NYI' );
	}
	
	ns.IMChat.prototype.setEncryptAvailable = function( isAvailable ) {
		var self = this;
		show = {
			type : 'showencrypt',
			data : isAvailable,
		};
		self.sendMessage( show );
	}
	
	ns.IMChat.prototype.toggleEncrypt = function( isOn ) {
		var self = this;
		var toggle = {
			type : 'encrypt',
			data : isOn,
		};
		self.sendMessage( toggle );
	}
	
	ns.IMChat.prototype.on = function( event, handler ) {
		var self = this;
		console.log( 'appView.IMChat.on - NYI', { e: event, h: handler });
	}
	
	ns.IMChat.prototype.off = function( event ) {
		var self = this;
		console.log( 'appView.IMChat.off - NYI', { e: event });
	}
	
	ns.IMChat.prototype.sendMessage = function( msg ) {
		self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
	ns.IMChat.prototype.closed = function() {
		var self = this;
		self.view = null;
		self.onclose();
	}
	
	ns.IMChat.prototype.close = function() {
		var self = this;
		if ( self.view )
			self.view.close();
	}
	
})( library.view );

// LIVE
(function( ns, undefined ) {
	ns.Live = function( liveConf, onEvent, onClose ) {
		if ( !( this instanceof ns.Live ))
			return new ns.Live( liveConf, onEvent, onClose );
		
		var self = this;
		self.liveConf = liveConf;
		self.onevent = onEvent,
		self.onclose = onClose;
		
		self.init();
	}
	
	ns.Live.prototype.init = function() {
		var self = this;
		var dropConf = {
			toView : toView,
			toChat : toChat,
		};
		self.drop = new library.component.Droppings( dropConf );
		function toView( e ) {
			self.sendMessage( e );
		}
		function toChat( link ) {
			const chat = {
				type : 'msg',
				data : {
					message : link,
				},
			};
			self.onevent( 'chat', chat );
		}
		
		api.ApplicationStorage.get( 'prefered-devices', loadBack );
		function loadBack( event ) {
			const devices = event.data;
			initLive( devices );
		}
		
		function initLive( preferedDevices ) {
			let width = 850;
			let height = 500;
			if ( isVoiceOnly() ) {
				width = 450;
				height = 350;
			}
			
			const windowConf = {
				title              : Application.i18n('i18n_live_session'),
				width              : width,
				height             : height,
				fullscreenenabled  : true,
			};
			
			self.liveConf.preferedDevices = preferedDevices;
			const viewConf = {
				fragments : hello.commonFragments,
				emojii    : hello.config.emojii,
				liveConf  : self.liveConf,
			};
			
			self.view = hello.app.createView(
				'html/live.html',
				windowConf,
				viewConf,
				self.onevent,
				closed
			);
			
			function closed( e ) { self.closed(); }
			
			self.bindView();
			delete self.initConf;
			
			function isVoiceOnly() {
				if ( 
					   !self.liveConf 
					|| !self.liveConf.rtcConf 
					|| !self.liveConf.rtcConf.permissions 
					|| !self.liveConf.rtcConf.permissions.send 
					|| !self.liveConf.rtcConf.permissions.receive 
				) {
					return false;
				}
				
				let perm = self.liveConf.rtcConf.permissions;
				if ( perm.send.video || perm.receive.video )
					return false;
				
				return true;
			}
		}
	}
	
	ns.Live.prototype.bindView = function() {
		var self = this;
		self.view.on( 'prefered-devices', storePrefered );
		self.view.on( 'drag-n-drop', heyYouDroppedThis );
		self.view.on( 'close'      , ohOkayThen );
		
		function storePrefered( e ) { self.storePrefered( e ); }
		function heyYouDroppedThis( e ) { self.drop.handle( e ); }
		function ohOkayThen( e ) { self.closed(); }
	}
	
	ns.Live.prototype.storePrefered = function( devices ) {
		const self = this;
		api.ApplicationStorage.set( 'prefered-devices', devices, setBack );
		function setBack( e ) {
			console.log( 'storePrefered - setback', e );
		}
	}
	
	ns.Live.prototype.sendMessage = function( msg ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
	ns.Live.prototype.closed = function() {
		const self = this;
		let onclose = self.onclose;
		self.close();
		if ( onclose )
			onclose();
	}
	
	ns.Live.prototype.close = function() {
		const self = this;
		let view = self.view;
		delete self.onevent;
		delete self.onclose;
		delete self.view;
		if ( view ) {
			view.close();
		}
	}
	
})( library.view );


// FormView
(function( ns, undefined ) {
	ns.FormView = function( conf ) {
		if ( !( this instanceof ns.FormView ))
			return new ns.FormView( conf );
		
		var self = this;
		self.file = conf.file;
		self.inputMap = conf.inputMap;
		self.windowConf = conf.windowConf;
		self.submitHandler = conf.submitHandler;
		self.readyCallback = conf.readyCallback;
		
		self.init();
	}
	
	ns.FormView.prototype.init = function() {
		var self = this;
		const initData = {
			inputMap : self.inputMap,
			fragments : hello.commonFragments || '',
		};
		self.view = hello.app.createView(
			'html/form/' + self.file,
			self.windowConf,
			initData,
			null,
			closed
		);
		
		self.bindView();
		delete self.windowConf;
		delete self.inputMap;
		
		function closed( msg ) {
			self.closed();
		}
	}
	
	ns.FormView.prototype.bindView = function() {
		var self = this;
		self.view.on( 'submit', self.submitHandler );
		self.view.on( 'exit', exit );
		self.view.on( 'close', closed );
		
		self.view.onready = self.readyCallback;
		function exit( msg ) { self.close(); }
	}
	
	ns.FormView.prototype.closed = function() {
		var self = this;
		self.view = null;
		if ( self.onclose )
			self.onclose();
	}
	
	ns.FormView.prototype.close = function() {
		var self = this;
		if ( self.view )
			self.view.close();
	}
	
	ns.FormView.prototype.on = function( event, handler ) {
		var self = this;
		if ( self.view )
			self.view.on( event, handler );
	}
	
	ns.FormView.prototype.off = function( event ) {
		var self = this;
		if ( self.view )
			self.view.off( event );
	}
	
	ns.FormView.prototype.sendMessage = function( msg ) {
		var self = this;
		if ( self.view )
			self.view.sendMessage( msg );
	}
	
})( library.view );

// COMPONENT FORM
(function( ns, undefined ) {
	ns.ComponentForm = function( conf ) {
		if ( !( this instanceof ns.ComponentForm ))
			return new ns.ComponentForm( conf );
		
		var self = this;
		self.file = conf.file;
		self.windowConf = conf.windowConf;
		self.onready = conf.onready;
		self.onclose = conf.onclose;
		self.onsubmit = conf.onsubmit;
		
		self.init();
	}
	
	ns.ComponentForm.prototype.init = function() {
		var self = this;
		const initData = {
			fragments : hello.commonFragments,
		};
		
		self.view = hello.app.createView(
			'html/form/' + self.file,
			self.windowConf,
			initData,
			null,
			closed
		);
		
		self.view.on( 'submit', submit );
		self.view.on( 'exit', exit );
		
		function submit( msg ) { self.submit( msg ); }
		function exit( msg ) { self.exit(); }
		function closed( msg ) { self.closed(); }
	}
	
	ns.ComponentForm.prototype.submit = function( formData ) {
		var self = this;
		self.onsubmit( formData );
	}
	
	ns.ComponentForm.prototype.response = function( resObj ) {
		var self = this;
		var responseEvent = {
			type : 'response',
			data : resObj,
		};
		self.toView( responseEvent );
	}
	
	ns.ComponentForm.prototype.toView = function( msg ) {
		var self = this;
		if ( self.view )
			self.view.sendMessage( msg );
	}
	
	ns.ComponentForm.prototype.exit = function() {
		var self = this;
		self.close();
	}
	
	ns.ComponentForm.prototype.close = function() {
		var self = this;
		if ( self.view )
			self.view.close();
	}
	
	ns.ComponentForm.prototype.closed = function() {
		var self = this;
		self.view = null;
		self.onclose();
	}
	
})( library.view );

// SETTINGS
(function( ns, undefined ) {
	ns.Settings = function( conf ) {
		if ( !( this instanceof ns.Settings ))
			return new ns.Settings( conf );
		
		var self = this;
		self.type = conf.type;
		self.title = conf.title;
		self.settings = conf.settings;
		self.onsave = conf.onsave;
		self.onclose = conf.onclose;
		self.windowConf = conf.windowConf;
		self.buffer = {};
		self.view = null;
		
		self.init();
	}
	
	ns.Settings.prototype.init = function() {
		var self = this;
		var filePath = 'html/settings/' + self.type + '.html';
		var windowConf = self.windowConf || {
			title : Application.i18n('i18n_settings') + ' - ' + ( self.title || self.type ),
			width : 420,
			height : 400,
		};
		
		const initData = {
			settings: self.settings,
			commonFragments : hello.commonFragments,
		};
		
		self.view = hello.app.createView(
			filePath,
			windowConf,
			initData,
			null,
			closed
		);
		
		self.bindView();
		
		function closed( msg ) { self.handleClose( msg ); }
	}
	
	ns.Settings.prototype.bindView = function() {
		const self = this;
		self.view.on( 'selectfile', selectFile );
		self.view.on( 'save', saveSetting );
		self.view.on( 'buffer', bufferValue );
		self.view.on( 'done', isDone );
		
		function selectFile( msg ) { self.selectFile( msg ); }
		function saveSetting( msg ) { self.pepareSave( msg ); }
		function bufferValue( msg ) { self.setBuffer( msg ); }
		function isDone( msg ) { self.isDone( msg ); }
		
	}
	
	ns.Settings.prototype.selectFile = function( data ) {
		var self = this;
		console.log( 'selectFile', data );
		self.view.showFiledialog( data, selected );
		function selected( res ) {
			console.log( 'selectFile - selected', res );
			var selected = {
				type : 'selectfile',
				data : res,
			};
			self.sendMessage( selected );
		}
	}
	
	ns.Settings.prototype.pepareSave = function( data ) {
		var self = this;
		var setting = data.setting;
		self.clearBuffer( setting );
		self.save( data );
	}
	
	ns.Settings.prototype.save = function( data ) {
		var self = this;
		self.onsave( data );
	}
	
	ns.Settings.prototype.setBuffer = function( data ) {
		var self = this;
		self.buffer[ data.setting ] = data.value;
	}
	
	ns.Settings.prototype.clearBuffer = function( setting ) {
		var self = this;
		self.buffer[ setting ] = null;
	}
	
	ns.Settings.prototype.flushBuffer = function() {
		var self = this;
		var bufferKeys = Object.keys( self.buffer );
		bufferKeys = bufferKeys.filter( hasValue );
		bufferKeys.forEach( save );
		
		function save( setting ) {
			var value = self.buffer[ setting ];
			var data = {
				setting : setting,
				value : value,
			};
			self.save( data );
		}
		
		function hasValue( setting ) { return !!self.buffer[ setting ]; }
	}
	
	ns.Settings.prototype.saved = function( data ) {
		var self = this;
		var wrap = {
			type : 'saved',
			data : data,
		};
		self.sendMessage( wrap );
	}
	
	ns.Settings.prototype.isDone = function() {
		var self = this;
		self.flushBuffer();
		self.close();
		self.onclose( true );
	}
	
	ns.Settings.prototype.handleClose = function() {
		var self = this;
		self.flushBuffer();
		self.view = null;
		self.onclose( true );
	}
	
	ns.Settings.prototype.close = function() {
		var self = this;
		self.view.close();
		self.view = null;
	}
	
	ns.Settings.prototype.sendMessage = function( msg ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
})( library.view );


// CONSOLE
(function( ns, undefined ) {
	ns.Console = function( conf ) {
		if ( !( this instanceof ns.Console ))
			return new ns.Console( conf );
		
		var self = this;
		self.view = null;
		self.onmessage = conf.message;
		self.onclose = conf.onclose;
		self.init();
	}
	
	ns.Console.prototype.init = function() {
		var self = this;
		const filePath = 'html/console.html';
		const windowConf = {
			title : Application.i18n('i18n_console'),
			width : 400,
			height : 450,
		};
		
		const initData = {
			fragments :  hello.commonFragments,
		};
		
		self.view = hello.app.createView(
			filePath,
			windowConf,
			initData,
			null,
			onclose
		);
		
		self.view.onready = ready;
		
		self.view.on( 'message', message );
		self.view.on( 'raw', raw );
		
		function ready( msg ) {
			self.send({
				type : 'log',
			});
		}
		
		function message( msg ) {
			var cmd = {
				type : 'message',
				data : msg,
			};
			self.send( cmd );
		}
		
		function raw( msg ) {
			var cmd = {
				type : 'raw',
				data : msg,
			};
			self.send( cmd );
		}
		
		function onclose( msg ) {
			self.view = null;
			self.onclose( true );
		}
	}
	
	ns.Console.prototype.send = function( msg ) {
		var self = this;
		self.onmessage( msg );
	}
	
	ns.Console.prototype.sendMessage = function( msg ) {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.sendMessage( msg );
	}
	
	ns.Console.prototype.close = function() {
		var self = this;
		delete self.onmessage;
		if ( self.view )
			self.view.close();
		
		if ( !self.onclose )
			return;
		
		var onclose = self.onclose;
		delete self.onclose;
		onclose( true );
	}
	
})( library.view );


// CONFERENCE VIEW
(function( ns, undefined ) {
	ns.Conference = function( conf, callback ) {
		if ( !( this instanceof ns.Conference ))
			return new ns.Conference( conf );
		
		var self = this;
		self.onmessage = conf.onmessage;
		self.settingsHandler = conf.onsettings;
		self.privateHandler = conf.onprivate;
		self.onhighlight = conf.onhighlight;
		self.closeHandler = conf.onclose;
		self.viewConf = conf.viewConf;
		self.state = conf.state;
		self.readyBack = callback;
		
		self.drop = null;
		
		self.init();
	}
	
	ns.Conference.prototype.init = function() {
		var self = this;
		var dropConf = {
			toView : toView,
			toChat : toChat,
		};
		self.drop = new library.component.Droppings( dropConf );
		function toView( e ) { self.sendMessage( e ); }
		function toChat( e ) { self.onmessage( e ); }
		
		const windowConf = {
			title  : self.viewConf.title || 'Conference chat with.. people?',
			width    : 500,
			height   : 450,
			viewConf : self.viewConf,
		};
		
		const initData = {
			state : self.state,
			commonFragments : hello.commonFragments,
			emojii : hello.config.emojii,
		};
		
		self.view = hello.app.createView(
			'html/conference.html',
			windowConf,
			initData,
			null,
			onclose
		);
		
		self.view.onready = self.readyBack;
		
		self.bindView();
		
		function onclose( e ) { self.viewClosed( e ); }
	}
	
	ns.Conference.prototype.bindView = function() {
		var self = this;
		self.view.on( 'message', message );
		self.view.on( 'settings', toggleSettings );
		self.view.on( 'private', openPrivate );
		self.view.on( 'highlight', handleHighlight );
		self.view.on( 'drag-n-drop', handleDropped );
		
		function message( e ) { self.onmessage( e ); }
		function toggleSettings( e ) { self.settingsHandler( e ); }
		function openPrivate( e ) { self.privateHandler( e ); }
		function handleHighlight( e ) { self.onhighlight( e ); }
		function handleDropped( e ) { self.drop.handle( e ); }
	}
	
	ns.Conference.prototype.handleFileDrop = function( data ) {
		var self = this;
		var file = new api.File( data.path );
		file.expose( linkBack );
		function linkBack( res ) {
			var success = !!res;
			if ( success )
				self.onmessage( res );
		}
	}
	
	ns.Conference.prototype.sendMessage = function( msg ) {
		var self = this;
		if ( self.view )
			self.view.sendMessage( msg );
	}
	
	ns.Conference.prototype.viewClosed = function( event ) {
		var self = this;
		self.view = null;
		self.closeHandler( event );
	}
	
	ns.Conference.prototype.close = function() {
		var self = this;
		if ( self.view )
			self.view.close();
	}
	
})( library.view );


// RTCASK
(function( ns, undefined ) {
	ns.RtcAsk = function( conf, askBack ) {
		if ( !( this instanceof ns.RtcAsk ))
			return new ns.RtcAsk( conf );
		
		var self = this;
		self.conf = conf;
		self.callback = askBack;
		self.init();
	}
	
	ns.RtcAsk.prototype.init = function() {
		var self = this;
		const windowConf = {
			title : 'Live invite',
			width : 400,
			height : 400,
		};
		self.view = hello.app.createView(
			'html/rtcAsk.html',
			windowConf,
			self.conf,
			null,
			closed
		);
		
		self.view.on( 'response', response );
		function response( msg ) { self.response( msg ); }
		function closed( msg ) { self.closed(); }
	}
	
	ns.RtcAsk.prototype.response = function( msg ) {
		var self = this;
		self.callback( msg );
		self.callback = null;
		self.close();
	}
	
	ns.RtcAsk.prototype.sendMessage = function( msg ) {
		var self = this;
		if ( self.view )
			self.view.sendMessage( msg );
	}
	
	ns.RtcAsk.prototype.closed = function() {
		const self = this;
		const callback = self.callback;
		delete self.callback;
		if ( callback )
			callback( false );
	}
	
	ns.RtcAsk.prototype.close = function() {
		var self = this;
		self.view.close();
	}
	
})( library.view );


// TREEROOT USERS VIEW
(function( ns, undefined ) {
	ns.TreerootUsers = function( conf ) {
		if ( !( this instanceof ns.TreerootUsers ))
			return new ns.TreerootUsers( conf );
		
		var self = this;
		self.onsubscribe = conf.onsubscribe;
		self.onclose = conf.onclose;
		self.view = null;
		
		self.init();
	}
	
	ns.TreerootUsers.prototype.init = function() {
		var self = this;
		const filePath = 'html/treerootUsers.html';
		const windowConf = {
			title : Application.i18n('i18n_add_contacts'),
			width : 500,
			height : 700,
		};
		const initData = {
			fragments : hello.commonFragments,
		};
		self.view = hello.app.createView(
			filePath,
			windowConf,
			initData,
			null,
			closed
		);
		
		self.view.on( 'done', done );
		self.view.on( 'subscribe', subscribe );
		
		function closed( msg ) {
			self.view = null;
			self.onclose();
		}
		function done( msg ) { self.done(); }
		function subscribe( msg ) { self.subscribe( msg ); }
	}
	
	ns.TreerootUsers.prototype.subscribe = function( data ) {
		var self = this;
		console.log( 'subscribe', data );
		self.onsubscribe( data );
	}
	
	ns.TreerootUsers.prototype.done = function() {
		var self = this;
		console.log( 'done' );
		const onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose();
	}
	
	ns.TreerootUsers.prototype.setUserList = function( userlist ) {
		var self = this;
		console.log( 'setUserList', { ul : userlist, sul : self.userlist });
		var msg = {
			type : 'userlist',
			data : userlist,
		};
		self.toView( msg );
	}
	
	ns.TreerootUsers.prototype.remove = function( sub ) {
		var self = this;
		var msg = {
			type : 'remove',
			data : sub,
		};
		self.toView( msg );
	}
	
	ns.TreerootUsers.prototype.close = function() {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.close();
		self.view = null;
	}
	
	ns.TreerootUsers.prototype.response = function( msg ) {
		var self = this;
		console.log( 'treerootUSers.response', msg );
	}
	
	ns.TreerootUsers.prototype.toView = function( msg ) {
		var self = this;
		if ( self.view )
			self.view.sendMessage( msg );
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.AddImage = function( conf ) {
		if ( !( this instanceof ns.AddImage ))
			return new ns.AddImage( conf );
		
		console.log( 'camshot', conf );
		var self = this;
		self.onimage = conf.onimage;
		self.onclose = conf.onclose;
		
		self.init();
	}
	
	ns.AddImage.prototype.init = function() {
		var self = this;
		const filePath = 'html/addImage.html';
		const winConf = {
			title : Application.i18n('i18n_add_image'),
			width : 500,
			height : 450,
		};
		
		self.view = hello.app.createView(
			filePath,
			winConf,
			null,
			null,
			onClose
		);
		
		self.bindView();
		
		function onClose( msg ) { self.viewClosed() }
	}
	
	ns.AddImage.prototype.bindView = function() {
		var self = this;
		self.view.on( 'image', onImage );
		
		function onImage( msg ) { self.onimage( msg ); }
	}
	
	ns.AddImage.prototype.viewClosed = function() {
		var self = this;
		console.log( 'view closed' );
		const onclose = self.onclose;
		delete self.onclose;
		if ( onclose )
			onclose();
	}
	
	ns.AddImage.prototype.close = function() {
		var self = this;
		if ( !self.view )
			return;
		
		self.view.close();
		self.view = null;
	}
	
	
})( library.view );

(function( ns, undefined ) {
	ns.ShareInvite = function( conf ) {
		if ( !( this instanceof ns.ShareInvite ))
			return new ns.ShareInvite( conf );
		
		var self = this;
		self.onmessage = conf.onmessage;
		self.onclose = conf.onclose;
		
		self.init();
	}
	
	ns.ShareInvite.prototype.init =function() {
		var self = this;
		const filePath = 'html/shareInvite.html';
		const windowConf = {
			title : Application.i18n('i18n_share_invite_link'),
			width : 500,
			height : 400,
		};
		self.view = hello.app.createView(
			filePath,
			windowConf,
			null,
			null,
			onClose
		);
		
		self.view.on( 'message', onMessage );
		self.view.on( 'email', sendEmail );
		
		function onMessage( e ) { self.onmessage( e ); }
		function sendEmail( e ) { self.sendEmail( e ); }
		function onClose() { self.onClose(); }
	}
	
	ns.ShareInvite.prototype.sendEmail = function( msg ) {
		var self = this;
		console.log( 'shareInvite.sendEmail', msg );
		var modConf = {
			module : 'system',
			method : 'systemmail',
			args : {
				to : msg.email,
				subject : Application.i18n('i18n_join_me_live'),
				body : "huehuehueh",
			},
			success : success,
			error : error,
		};
		console.log( "sendEmail, conf", modConf );
		var mod = new api.Module( modConf );
		
		function success( data ) {
			console.log( 'sendEmail.success', data );
			
			if ( data === 'end of the line' )
				data = false;
			
			send( data );
		}
		
		function error( e ) {
			console.log( 'sendEmail.error', e );
			send( false );
		}
		
		function send( data ) {
			var msg = {
				type : 'email',
				data : data,
			};
			self.sendMessage( msg );
		}
	}
	
	ns.ShareInvite.prototype.sendMessage = function( msg ) {
		var self = this;
		if ( self.view )
			self.view.sendMessage( msg );
	}
	
	ns.ShareInvite.prototype.onClose = function() {
		var self = this;
		self.view = null;
		self.onclose();
	}
	
	ns.ShareInvite.prototype.close = function() {
		var self = this;
		if ( self.view )
			self.view.close();
	}
	
})( library.view );

// Treeroot crypto warning
(function( ns, undefined ) {
	ns.CryptoWarning = function( conf ) {
		if ( !( this instanceof ns.CryptoWarning ))
			return new ns.CryptoWarning( conf );
		
		console.log( 'CryptoWarning', conf );
		var self = this;
		self.initBundle = conf.initBundle;
		self.onaccept = conf.onaccept;
		self.onclose = conf.onclose;
		
		self.ready = false;
		self.msgQueue = [];
		self.init();
	}
	
	ns.CryptoWarning.prototype.init = function() {
		var self = this;
		const filePath = 'html/cryptoWarning.html';
		const windowConf = {
			title : Application.i18n('i18n_encryption_warning'),
			width : 450,
			height : 220,
		};
		self.view = hello.app.createView( 
			filePath,
			windowConf,
			self.initBundle,
			null,
			closed
		);
		
		self.view.on( 'accept', accept );
		function accept( e ) {
			console.log( 'app.cryptwarning - onaccept', e );
			self.onaccept( e );
		}
		function closed( e ) { self.closed() }
	}
	
	ns.CryptoWarning.prototype.closed = function() {
		var self = this;
		console.log( 'CryptoWarning view closed' );
		self.view = null;
		var onclose = self.onclose;
		delete self.onclose;
		if ( self.cleanup )
			self.cleanup();
		
		if ( onclose )
			onclose();
	}
	
	ns.CryptoWarning.prototype.send = function( msg ) {
		var self = this;
		if ( self.view )
			self.view.sendMessage( msg );
	}
	
	ns.CryptoWarning.prototype.cleanup = function() {
		var self = this;
		delete self.onaccept;
		delete self.onclose;
		delete self.initBundle;
	}
	
	ns.CryptoWarning.prototype.close = function() {
		var self = this;
		if ( !self.view )
			return;
		
		var view = self.view;
		self.view = null;
		view.close();
	}
	
})( library.view );

(function( ns, undefined ) {
	ns.FirstWizard = function( callback ) {
		const self = this;
		self.callback = callback;
		self.init();
	}
	
	ns.FirstWizard.prototype.init = function() {
		const self = this;
		const filePath = 'html/firstWizard.html';
		const windowConf = {
			title : Application.i18n( 'i18n_first_run_wizard' ),
			width : 700,
			height : 950,
		};
		self.view = hello.app.createView( 
			filePath,
			windowConf,
			{},
			null,
			closed
		);
		
		self.view.on( 'done', done );
		
		function done( res ) {
			console.log( 'appview.FirstWizard.on done', res );
			self.callback( res );
		}
		function closed() { console.log( 'firstWiz - closed' ); }
	}
	
	ns.FirstWizard.prototype.close = function() {
		const self = this;
		delete self.callback;
		if ( !self.view )
			return;
		
		var view = self.view;
		delete self.view;
		view.close();
	}
	
})( library.view );