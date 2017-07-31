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
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.view = library.view || {};

(function( ns, undefined ) {
	ns.RtcAsk = function( fupConf ) {
		if ( !( this instanceof ns.RtcAsk ))
			return new ns.RtcAsk( fupConf );
		
		if ( fupConf )
			console.log( 'view.RtcAsk - fupconf', fupConf );
		
		var self = this;
		
		self.init();
		
	}
	
	ns.RtcAsk.prototype.init = function() {
		var self = this;
		View.setBody();
		self.view = window.View;
		self.bindEvents();
		
		self.view.on( 'initialize', initialize );
		function initialize( msg ) { self.initialize( msg ); }
		
		self.send({
			type : 'loaded',
		});
	}
	
	ns.RtcAsk.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.askRtc.initialize', data );
		setMessage( data.message );
		if ( data.guestLink ) {
			self.guestLink = data.guestLink;
			showGuestBtn();
		}
		
		self.startTimeSince();
		
		if ( data.activeSession )
			showSessionWarning();
		
		function setMessage( message ) {
			self.inviteTime = Date.now();
			var timeStr = library.tool.getChatTime( self.inviteTime );
			var conf = {
				message : message,
				time : timeStr,
			};
			var container = document.getElementById( 'message' );
			var element = friend.template.getElement( 'message-tmpl', conf );
			container.appendChild( element );
		}
		
		function showSessionWarning() {
			console.log( 'show session warning, i guess' );
			var element = document.getElementById( 'session-warning' );
			element.classList.remove( 'hidden' );
		}
		
		function showGuestBtn() {
			const guestBtn = document.getElementById( 'open-guest' );
			const submitBtn = document.getElementById( 'confirm' );
			submitBtn.classList.toggle( 'hidden', true );
			guestBtn.classList.toggle( 'hidden', false );
		}
	}
	
	ns.RtcAsk.prototype.startTimeSince = function() {
		var self = this;
		self.sinceEl = document.getElementById( 'time-since' );
		self.sinceInterval = window.setInterval( updateTimePassed, 10000 );
		function updateTimePassed() {
			var now = Date.now();
			var passed = now - self.inviteTime;
			var steps = Math.floor( passed / 10000 ); // we are counting in steps of 10 sec
			console.log( 'updatetimePassed', {
				passed : passed,
				steps : steps,
			});
			
			if ( 2 <= steps )
				showPassed();
			
			updatePassed( steps );
		}
		
		function showPassed() {
			if ( self.passedIsVisible )
				return;
			
			console.log( 'showPassed' );
			self.passedIsVisible = true;
			var el = document.getElementById( 'time-passed' );
			el.classList.toggle( 'hidden', false );
		}
		
		function updatePassed( steps ) {
			console.log( 'updatePassed', steps );
			var postfix = 'sec';
			if ( 6 <= steps ) {
				postfix = 'min';
				steps = Math.floor( steps / 6 );
			} else
				steps = steps * 10;
			
			var str = '~' + steps + postfix;
			self.sinceEl.textContent = str;
		}
	}
	
	ns.RtcAsk.prototype.bindEvents = function() {
		const self = this;
		const form = document.getElementById( 'form' );
		const guestBtn = document.getElementById( 'open-guest' );
		const cancelBtn = document.getElementById( 'deny' );
		console.log( 'form?', form );
		form.addEventListener( 'submit', submit, false );
		guestBtn.addEventListener( 'click', guest, false );
		cancelBtn.addEventListener( 'click', cancel, false );
		
		function submit( e ) { self.submit( e ); }
		function guest( e ) { self.openGuest( e ); }
		function cancel( e ) { self.cancel( e ); }
	}
	
	ns.RtcAsk.prototype.submit = function( e ) {
		var self = this;
		e.preventDefault();
		e.stopPropagation();
		//var inputs = e.target.elements;
		//var allowAudio = inputs.allowAudio.checked;
		//var allowVideo = inputs.allowVideo.checked;
		//console.log( 'rtcAsk.submit', { a : allowAudio, v : allowVideo } );
		console.log( 'rtcAsk.submit' );
		/*
		var response = {
			audio : allowAudio,
			video : allowVideo,
		};
		*/
		
		self.send({
			type : 'response',
			//data : response,
			data : {
				accept : true,
				audio : null,
				video : null,
			},
		});
	}
	
	ns.RtcAsk.prototype.openGuest = function( e ) {
		const self = this;
		window.open( self.guestLink );
		self.cancel();
	}
	
	ns.RtcAsk.prototype.cancel = function( e ) {
		var self = this;
		self.send({
			type : 'response',
			data : {
				accept : false,
			},
		});
	}
	
	ns.RtcAsk.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.rtcAsk = new library.view.RtcAsk( fupConf );
}