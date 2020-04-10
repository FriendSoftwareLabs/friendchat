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

// Init

(function( ns, undefined ) {
	ns.Init = function( viewConf ) {
		const self = this;
		console.log( 'viewConf', viewConf );
		self.conn = window.View;
		self.rtc = null;
		self.ui = null;
		self.appOnline = null;
		
		self.init();
	}
	
	// Public??
	
	// Private
	ns.Init.prototype.init = function() {
		const self = this;
		hello.template = friend.template;
		
		//
		const dropConf = {
			targetId : 'hello',
			ondrop   : onDrop,
		};
		self.drop = new library.component.Drop( dropConf );
		function onDrop( dropped ) {
			self.conn.send( dropped );
		}
		
		//
		self.conn.on( 'focus', focus );
		self.conn.on( 'initialize', e => self.initialize( e ));
		self.conn.on( 'restore', restore );
		self.conn.on( 'closeview', closeView );
		
		function focus( e ) {}
		function restore( e ) { self.handleRestore( e ); }
		function closeView( e ) {
			self.closeAllTheThings( e );
		}
		
		//
		/*
		const loaded = {
			type : 'loaded',
			data : 'pølse',
		};
		self.conn.send( loaded );
		*/
		window.View.loaded();
	}
	
	ns.Init.prototype.preInit = function( initConf ) {
		const self = this;
		throw new Error( 'no u' );
		
		const honk = document.getElementById( 'honk' );
		honk.play()
			.then( honkOk )
			.catch( honkEx );
		
		function honkOk( e ) {
			console.log( 'honkOk' );
			if ( self.pContainer ) {
				self.pContainer.classList.toggle( 'hidden', true );
			}
			
			const initCover = document.getElementById( 'init-cover' );
			initCover.classList.toggle( 'hidden', false );
			self.initialize( initConf );
		}
		
		function honkEx( ex ) {
			console.log( 'honkEx', ex );
			self.pContainer = document.getElementById( 'play-container' );
			self.pContainer.classList.toggle( 'hidden', false );
			const playBtn = document.getElementById( 'play-btn' );
			playBtn.addEventListener( 'click', pClick, false );
		}
		
		function pClick( e ) {
			console.log( 'pClick', e );
			self.preInit( initConf );
		}
	}
	
	ns.Init.prototype.initialize = function( data ) {
		const self = this;
		console.log( 'Live.initalize', data );
		//hello.template.addFragments( data.fragments );
		hello.template.addFragments( data.liveFragments );
		//
		hello.parser = new library.component.parse.Parser();
		hello.parser.use( 'LinkStd' );
		hello.parser.use( 'Emojii', data.emojii );
		
		// we dont need these any more
		delete data.fragments;
		delete data.emojii;
		
		const liveConf = data.liveConf;
		const localSettings = liveConf.localSettings;
		
		// init ui
		let UI = library.view.UI;
		if ( liveConf.isStream )
			UI = library.view.UIStream;
		
		self.ui = new UI(
			self.conn,
			liveConf,
			localSettings
		);
		
		// init Model
		let RTC = library.rtc.RTC;
		if ( liveConf.isStream )
			RTC = library.rtc.RTCStream;
		
		self.rtc = new RTC(
			self.conn,
			self.ui,
			liveConf,
			onclose,
			onready
		);
		
		function onready( err ) {
			console.log( 'Live onready' );
			window.View.ready();
		}
		
		function onclose() {
			self.closeAllTheThings();
		}
	}
	
	ns.Init.prototype.handleRestore = function( init ) {
		const self = this;
		if ( !self.rtc )
			self.closeAllTheThings();
		
		self.rtc.restore( init );
	}
	
	ns.Init.prototype.closeAllTheThings = function() {
		const self = this;
		console.trace( 'Live.closeAllTheThings' );
		if ( self.rtc )
			self.rtc.close();
		
		if ( self.ui )
			self.ui.close();
		
		window.View.sendMessage({
			type : 'close',
		});
	}
	
})( library.view );


// INIT -------------------
if ( !window.View )
	throw new Error( 'window.View is not defined' );

window.View.run = fun;
function fun() {
	window.live = new library.view.Init();
}
