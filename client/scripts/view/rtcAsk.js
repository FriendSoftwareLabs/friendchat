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
			
			if ( 2 <= steps )
				showPassed();
			
			updatePassed( steps );
		}
		
		function showPassed() {
			if ( self.passedIsVisible )
				return;
			
			self.passedIsVisible = true;
			var el = document.getElementById( 'time-passed' );
			el.classList.toggle( 'hidden', false );
		}
		
		function updatePassed( steps ) {
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
		var inputs = e.target.elements;
		var allowA = inputs.allowAudio.checked;
		var allowV = inputs.allowVideo.checked;
		let receiveA = inputs.receiveAudio.checked;
		let receiveV = inputs.receiveVideo.checked;
		console.log( 'rtcAsk.submit', { a : allowA, v : allowV } );
		
		self.send({
			type : 'response',
			data : {
				accept : true,
				permissions : {
					send : {
						audio : allowA,
						video : allowV,
					},
					receive : {
						audio : receiveA,
						video : receiveV,
					},
				},
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