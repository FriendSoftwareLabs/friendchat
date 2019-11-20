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
		
		View.loaded();
	}
	
	ns.RtcAsk.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.askRtc.initialize', data );
		setMessage( data.message );
		if ( data.guestLink ) {
			self.guestLink = data.guestLink;
			showGuest();
		}
		
		if ( data.name )
			self.showNameOption( data.name );
		
		self.startTimeSince();
		
		if ( data.activeSession )
			showSessionWarning();
		
		window.View.ready();
		
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
		
		function showGuest() {
			self.showGuest = true;
			self.simple.classList.toggle( 'hidden', true );
			self.confirm.classList.toggle( 'hidden', true );
			self.toggleAdvBtn.classList.toggle( 'hidden', true );
			self.guest.classList.toggle( 'hidden', false );
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
		self.name = document.getElementById( 'set-name' );
		self.nameInput = document.getElementById( 'set-name-input' );
		self.simple = document.getElementById( 'simple' );
		self.guest = document.getElementById( 'guest' );
		self.advOpts = document.getElementById( 'advanced-options' );
		self.confirm = document.getElementById( 'confirm' );
		self.toggleAdvBtn = document.getElementById( 'toggle-advanced' );
		const simpleAudio = document.getElementById( 'allow-audio' );
		const simpleVideo = document.getElementById( 'allow-video' );
		const guestBtn = document.getElementById( 'open-guest' );
		const cancelBtn = document.getElementById( 'deny' );
		form.addEventListener( 'submit', submit, false );
		self.toggleAdvBtn.addEventListener( 'click', toggleAdvanced, false );
		simpleAudio.addEventListener( 'click', allowAudio, false );
		simpleVideo.addEventListener( 'click', allowVideo, false );
		guestBtn.addEventListener( 'click', guest, false );
		cancelBtn.addEventListener( 'click', cancel, false );
		
		function toggleAdvanced( e ) { self.toggleAdvanced(); }
		function allowAudio( e ) { self.allowAudio(); }
		function allowVideo( e ) { self.allowVideo(); }
		function submit( e ) { self.submit( e ); }
		function guest( e ) { self.openGuest( e ); }
		function cancel( e ) { self.cancel( e ); }
	}
	
	ns.RtcAsk.prototype.submit = function( e ) {
		var self = this;
		e.preventDefault();
		e.stopPropagation();
		const perms = self.getAdvPermissions( e );
		const response = {
			accept       : true,
			permissions  : perms,
		}
		self.respond( response );
	}
	
	ns.RtcAsk.prototype.showNameOption = function( name ) {
		const self = this;
		self.useName = name;
		self.nameInput.value = name;
		self.name.classList.toggle( 'hidden', false );
	}
	
	ns.RtcAsk.prototype.toggleAdvanced = function() {
		const self = this;
		console.log( 'toggleAdvanced', self.showAdvanced );
		self.showAdvanced = !self.showAdvanced;
		self.advOpts.classList.toggle( 'hidden', !self.showAdvanced );
		self.confirm.classList.toggle( 'hidden', !self.showAdvanced );
		self.simple.classList.toggle( 'hidden', self.showAdvanced );
	}
	
	ns.RtcAsk.prototype.allowAudio = function() {
		const self = this;
		console.log( 'allowAudio' );
		const perms = {
			send : {
				audio : true,
				video : false,
			},
			receive : {
				audio : true,
				video : false,
			},
		};
		const res = {
			accept      : true,
			permissions : perms,
		};
		self.respond( res );
	}
	
	ns.RtcAsk.prototype.allowVideo = function() {
		const self = this;
		console.log( 'allowVideo' );
		const perms = {
			send : {
				audio : true,
				video : true,
			},
			receive : {
				audio : true,
				video : true,
			},
		};
		const res = {
			accept      : true,
			permissions : perms,
		};
		self.respond( res );
	}
	
	ns.RtcAsk.prototype.openGuest = function( e ) {
		const self = this;
		window.open( self.guestLink );
		self.cancel();
	}
	
	ns.RtcAsk.prototype.cancel = function( e ) {
		var self = this;
		self.respond({ accept : false });
	}
	
	ns.RtcAsk.prototype.respond = function( data ) {
		const self = this;
		if ( self.useName )
			data.name = getName();
		
		console.log( 'respond', data );
		const response = {
			type : 'response',
			data : data,
		};
		self.send( response );
		
		function getName() {
			let name = self.nameInput.value;
			name = name.trim();
			if ( !name || !name.length )
				return self.useName;
			
			return name;
		}
	}
	
	ns.RtcAsk.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
	
	ns.RtcAsk.prototype.getAdvPermissions = function( e ) {
		const self = this;
		const inputs = e.target.elements;
		const sendA = inputs.sendAudio.checked;
		const sendV = inputs.sendVideo.checked;
		const receiveA = inputs.receiveAudio.checked;
		const receiveV = inputs.receiveVideo.checked;
		const permissions = {
			send : {
				audio : sendA,
				video : sendV,
			},
			receive : {
				audio : receiveA,
				video : receiveV,
			},
		};
		return permissions;
	}
	
})( library.view );

window.View.run = run;
function run( fupConf ) {
	window.rtcAsk = new library.view.RtcAsk( fupConf );
}