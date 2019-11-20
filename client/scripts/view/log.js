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

var friendUP = window.friendUP || {};
var library = window.library || {};
var hello = window.hello || {};

library.view = library.view || {};

// Log
( function( ns, undefined ) {
	ns.Log = function( conf ) {
		if ( !( this instanceof ns.Log ))
			return new ns.Log( conf );
		
		var self = this;
		self.view = null;
		
		self.init();
	}
	
	ns.Log.prototype.init = function() {
		const self = this;
		self.view = window.View;
		
		self.scrollAtBottom = true;
		self.scrollBottomSnapDistance = 10;
		self.messages = document.getElementById( 'messages' );
		
		self.bindView();
		self.bindEvents();
		
		View.loaded();
	};
	
	ns.Log.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'info', addInfo );
		self.view.on( 'positive', addPositive );
		self.view.on( 'notify', addNotify );
		self.view.on( 'alert', addAlert );
		self.view.on( 'waiting', addWaiting );
		self.view.on( 'theskyisfalling', addRunForTheHills );
		self.view.on( 'clear', clearView );
		
		function initialize( msg ) { self.initialize( msg ); }
		function addInfo( msg ) { self.addInfo( msg ); }
		function addPositive( msg ) { self.addPositive( msg ); }
		function addNotify( msg ) { self.addNotify( msg ); }
		function addAlert( msg ) { self.addAlert( msg ); }
		function addWaiting( msg ) { self.addWaiting( msg ); }
		function addRunForTheHills( msg ) { self.addRunForTheHills( msg ); }
		function clearView( msg ) { self.clearView( msg ); }
	}
	
	ns.Log.prototype.addInfo = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg );
		self.add( data );
	}
	
	ns.Log.prototype.addPositive = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg, 'positive' );
		self.add( data );
	}
	
	ns.Log.prototype.addNotify = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg, 'notification' );
		self.add( data );
	}
	
	ns.Log.prototype.addAlert = function( msg ) {
		var self = this;
		var data = self.getGeneric( msg, 'alert' );
		self.add( data );
	}
	
	ns.Log.prototype.addWaiting = function( msg ) {
		var self = this;
		console.log( 'log.addWaiting - NYI', msg );
		return;
		
		var data = self.getGeneric( msg, 'waiting' );
		data.tmplId = 'waiting-logmessage-tmpl';
		var element = self.add( data );
		setTimer( element, msg.time );
		
		function setTimer( element, timeLeft ) {
			console.log( 'setTimer', { e : element, tl : timeLeft });
		}
	}
	
	ns.Log.prototype.addRunForTheHills = function( msg ) {
		var self = this;
		console.log( 'log.addRunForTheHills - NYI', msg );
		return;
		var data = self.getGeneric( msg );
		self.add( data );
	}
	
	ns.Log.prototype.getGeneric = function( msg, alertLevel ) {
		msg.alertLevel = alertLevel || 'info';
		msg.time = msg.time || Date.now();
		var data = {
			tmplId : 'default-logmessage-tmpl',
			conf : msg,
		};
		
		return data;
	}
	
	ns.Log.prototype.add = function( msg ) {
		var self = this;
		msg.conf.time = library.tool.getChatTime( msg.conf.time );
		var element = hello.template.getElement( msg.tmplId, msg.conf );
		
		self.messages.appendChild( element );
		
		if ( self.scrollAtBottom )
			self.setScrollBottom();
		
		return element;
	}
	
	ns.Log.prototype.setScrollBottom = function() {
		var self = this;
		self.messages.scrollTop = self.messages.scrollHeight;
	}
	
	ns.Log.prototype.clearView = function() {
		var self = this;
		self.messages.innerHTML = '';
	}
	
	ns.Log.prototype.initialize = function( data ) {
		var self = this;
		hello.template.addFragments( data.fragments );
		self.view.ready();
	}
	
	ns.Log.prototype.bindEvents = function() {
		var self = this;
		var form = document.body.querySelector( 'form' );
		form.addEventListener( 'submit', clear, false );
		self.messages.addEventListener( 'scroll', scrollEvent, false );
		
		function clear( e ) { self.clear( e ); }
		function scrollEvent( e ) { self.scrollEvent( e ); }
	}
	
	ns.Log.prototype.clear = function( e ) {
		var self = this;
		e.preventDefault();
		e.stopPropagation();
		
		self.view.sendMessage({
			type : 'clear',
		});
	}
	
	ns.Log.prototype.scrollEvent = function( scrollEvent ) {
		var self = this;
		var element = scrollEvent.target;
		var viewPort = element.parentNode.scrollHeight;
		var scrollPosition = element.scrollTop + viewPort;
		scrollPosition += self.scrollBottomSnapDistance;
		
		if ( scrollPosition < element.scrollHeight )
			self.scrollAtBottom = false;
		else
			self.scrollAtBottom = true;
	}
	
})( library.view );

// wait for view to call run
window.View.run = run;
function run( conf ) {
	window.chat = new library.view.Log( conf );
}