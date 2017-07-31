'use strict';

/*©agpl*************************************************************************
*                                                                              *
* Friend Unifying Platform                                                     *
* ------------------------                                                     *
*                                                                              *
* Copyright 2014-2016 Friend Software Labs AS, all rights reserved.            *
* Hillevaagsveien 14, 4016 Stavanger, Norway                                   *
* Tel.: (+47) 40 72 96 56                                                      *
* Mail: info@friendos.com                                                      *
*                                                                              *
*****************************************************************************©*/

var library = window.library || {};
var friendUP = window.friendUP || {}
var hello = window.hello || {};

library.view = library.view || {};

(function( ns, undefined ) {
	ns.Console = function( event ) {
		if ( !( this instanceof ns.Console ))
			return new ns.Console( event );
		
		var self = this;
		self.view = null;
		self.input = null;
		self.messages = null;
		self.messageScroller = null;
		self.inputIsRaw = false;
		self.init();
	}
	
	ns.Console.prototype.init = function() {
		var self = this;
		self.sendLog = [];
		self.sendLogCurrentIdnex = 0;
		self.view = window.View;
		self.input = document.getElementById( 'chat-input' );
		self.messages = document.getElementById( 'messages' );
		self.messageScroller = new library.component.BottomScroller( 'messages' );
		self.inputHistory = new library.component.InputHistory({
			inputId : 'chat-input',
			limit : 20,
		});
		
		self.buildMap = {
			message :  buildMessage,
			notification : buildNotification,
			error : buildError,
		};
		function buildMessage( data ) { return self.buildMessage( data ); }
		function buildNotification( data ) { return self.buildNotification( data ); }
		function buildError( data ) { return self.buildError( data ); }
		
		self.loadLocalFragments();
		self.bindView();
		self.bindEvents();
		
		self.view.sendMessage({
			type : 'loaded',
		});
		
	}
	
	ns.Console.prototype.loadLocalFragments = function() {
		var self = this;
		var fragments = document.getElementById( 'fragments' );
		hello.template = new friendUP.gui.TemplateManager( fragments );
	}
	
	ns.Console.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'log', log );
		self.view.on( 'message', message );
		self.view.on( 'notification', notification );
		self.view.on( 'error', error );
		
		function initialize( msg ) { self.initialize( msg ); }
		function log( msg ) { self.handleLog( msg ); }
		function message( msg ) { self.handleMessage( msg ); }
		function notification( msg ) { self.handleNotification( msg ); }
		function error( msg ) { self.handleError( msg ); }
	}
	
	ns.Console.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'input-form' );
		self.rawBtn = document.getElementById('raw' );
		self.slashBtn = document.getElementById( 'slash-prefix' );
		form.addEventListener( 'submit', handleSubmit, false );
		function handleSubmit( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.handleSubmit();
		}
		
		self.rawBtn.addEventListener( 'click', toggleInputType, false );
		self.slashBtn.addEventListener( 'click', toggleInputType, false );
		
		function toggleInputType( e ) { self.toggleInputType( e ); }
		function toggleInputType( e ) { self.toggleInputType( e ); }
	}
	
	ns.Console.prototype.toggleInputType = function( e ) {
		var self = this;
		e.preventDefault();
		e.stopPropagation();
		console.log( 'toggleInputType', self.inputIsRaw );
		self.inputIsRaw = !self.inputIsRaw;
		self.rawBtn.classList.toggle( 'accept', self.inputIsRaw );
		self.slashBtn.classList.toggle( 'accept', !self.inputIsRaw );
	}
	
	ns.Console.prototype.initialize = function( data ) {
		var self = this;
		if ( data.fragments )
			hello.template.addFragments( data.fragments );
		
		self.view.sendMessage({
			type : 'ready',
		});
	}
	
	ns.Console.prototype.handleLog = function( msg ) {
		var self = this;
		var elementBuilder = self.buildMap[ msg.type ];
		if ( !elementBuilder ) {
			console.log( 'no builder for ', msg );
			return;
		}
		
		var element = elementBuilder( msg.data );
		element.classList.toggle( 'Log', true );
		self.add( element );
	}
	
	ns.Console.prototype.handleMessage = function( msg ) {
		var self = this;
		var element = self.buildMessage( msg );
		self.add( element );
	}
	
	ns.Console.prototype.handleNotification = function( msg ) {
		var self = this;
		console.log( 'console.handleNotification', msg );
		var element = self.buildNotification( msg );
		self.add( element );
	}
	
	ns.Console.prototype.handleError = function( msg ) {
		var self = this;
		console.log( 'console.handleError', msg );
		var element = self.buildError( msg );
		self.add( element );
	}
	
	ns.Console.prototype.add = function( element ) {
		var self = this;
		self.messages.appendChild( element );
	}
	
	ns.Console.prototype.buildMessage = function( data ) {
		var self = this;
		return self.buildElement( 'message', data );
	}
	
	ns.Console.prototype.buildNotification = function( data ) {
		var self = this;
		return self.buildElement( 'notification', data );
	}
	
	ns.Console.prototype.buildError = function( data ) {
		var self = this;
		var msg = {
			message : friendUP.tool.stringify( data ),
		}
		return self.buildElement( 'error', msg );
	}
	
	ns.Console.prototype.buildElement = function( type, data ) {
		var self = this;
		if ( 'string' === typeof( data ))
			return data;
		
		if ( !data.time )
			data.time = Date.now();
		
		var timeStr = library.tool.getChatTime( data.time );
		var tmplConf = {
			type : type,
			message : data.message || ' >> no data.message',
			time : timeStr,
		};
		var element = hello.template.getElement( 'console-msg-tmpl', tmplConf );
		return element;
	}
	
	ns.Console.prototype.handleSubmit = function() {
		var self = this;
		var message = self.input.value;
		self.inputHistory.add( message );
		self.send( message );
		self.input.value = '';
	}
	
	ns.Console.prototype.send = function( message ) {
		var self = this;
		var type = self.inputIsRaw ? 'raw' : 'message';
		var msg = {
			type : type,
			data : message,
		};
		self.view.sendMessage( msg );
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'view/console.js - window.View is not defined' );

window.View.run = run;
function run( event ) {
	hello.console = new library.view.Console( event );
}
