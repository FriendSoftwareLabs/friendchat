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
	ns.AddImage = function() {
		if ( !( this instanceof ns.AddImage ))
			return new ns.AddImage();
		
		var self = this;
		self.view = window.View;
		
		self.init();
	}
	
	ns.AddImage.prototype.init = function() {
		const self = this;
		self.bindView();
		self.bindEvents();
		
		View.loaded();
	}
	
	ns.AddImage.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		
		function initialize( msg ) { self.initialize( msg ); }
	}
	
	ns.AddImage.prototype.initialize = function( data ) {
		var self = this;
		console.log( 'view.AddImage.initialize', data );
		
		self.view.ready();
	}
	
	ns.AddImage.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'form' );
		var cancelBtn = document.getElementById( 'cancel' );
		var selectCamshotBtn = document.getElementById( 'selectCamshotBtn' );
		var camshot = document.getElementById( 'camshot' );
		
		form.addEventListener( 'submit', submit, false );
		cancelBtn.addEventListener( 'click', cancel, false );
		
		selectCamshotBtn.addEventListener( 'click', selectCamshot );
		
		function submit( e ) { self.submit( e ); }
		function cancel( e ) { self.cancel( e ); }
		function selectCamshot( e ) { self.selectCamshot(); }
	}
	
	ns.AddImage.prototype.submit = function( e ) {
		var self = this;
		e.preventDefault();
		self.sendImage( 'qwed"#RASDFASD' );
	}
	ns.AddImage.prototype.cancel = function( e ) {
		var self = this;
		e.preventDefault();
		self.sendImage( null );
	}
	
	ns.AddImage.prototype.sendImage = function( data ) {
		var self = this;
		self.view.sendMessage({
			type : 'image',
			data : data,
		});
	}
	
	ns.AddImage.prototype.selectCamshot = function() {
		var self = this;
		console.log( 'select camshot' );
	}
	
})( library.view );

if ( !window.View )
	throw new Error( 'view.AddImage - window.View not defined' );

window.View.run = run;
function run() {
	window.camshot = new library.view.AddImage();
}