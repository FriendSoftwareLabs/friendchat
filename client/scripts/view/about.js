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

var friend = window.friend || {};
var library = window.library || {};
library.view = library.view || {};

(function( ns, undefined ) {
	ns.About = function() {
		const self = this;
		self.mouseIsOver = false;
		self.currOp = 0;
		this.init();
	}
	
	ns.About.prototype.init = function() {
		const self = this;
		View.setBody();
		View.on( 'initialize', e => self.handleInit( e ));
		
		self.height = document.body.clientHeight;
		self.bg = document.getElementById( 'bg' );
		self.content = document.getElementById( 'content' );
		self.about = document.getElementById( 'about' );
		self.version = document.getElementById( 'version' );
		self.legal = document.getElementById( 'legal' );
		const aboutBtn = document.getElementById( 'about-menu' );
		const versionBtn = document.getElementById( 'version-menu' );
		const legalBtn = document.getElementById( 'legal-menu' );
		
		window.addEventListener( 'resize', viewResize, false );
		document.addEventListener( 'mousemove', mouseMove, false );
		document.addEventListener( 'mouseleave', mouseLeave, false );
		content.addEventListener( 'click', toggleBg, false );
		aboutBtn.addEventListener( 'click', showAbout, false );
		versionBtn.addEventListener( 'click', showVersion, false );
		legalBtn.addEventListener( 'click', showLegal, false );
		
		window.View.loaded();
		
		function viewResize( e ) { self.handleResize( e ); }
		function mouseMove( e ) { self.handleMouseMove( e ); }
		function mouseLeave( e ) { self.toggleAbout( false ); }
		
		function toggleBg( e ) {
			self.toggleAbout( !self.currOp );
		}
		
		function showAbout( e ) { self.showAbout( e ); }
		function showVersion( e ) { self.showVersion( e ); }
		function showLegal( e ) { self.showLegal( e ); }
	}
	
	ns.About.prototype.handleInit = function( info ) {
		const self = this;
		console.log( 'About.handleInit', info );
		const hasInfo = !!info;
		info = info || {
			version : 'no version info available',
			branch  : 'make sure local.config.js in app dir',
			date    : 'has "about : null" set',
			commit  : 'then run updateAll.sh from git dir'
		};
		info = check( info );
		const el = friend.template.getElement( 'version-tmpl', info );
		self.version.appendChild( el );
		
		if ( !hasInfo )
			return;
		
		const copy = document.getElementById( 'version-copy' );
		copy.classList.toggle( 'hidden', false );
		
		const input = document.getElementById( 'version-copy-input' );
		const btn = document.getElementById( 'version-copy-btn' );
		const infoStr = JSON.stringify( info );
		input.value = infoStr;
		btn.addEventListener( 'click', toClippy, false );
		
		window.View.ready();
		
		function check( info ) {
			info.version = info.version || 'unknown';
			info.branch = info.branch || 'unknown';
			info.date = info.date || 'unknown';
			info.commit = info.commit || 'unknown';
			return info;
		}
		
		function toClippy( e ) {
			e.preventDefault();
			e.stopPropagation();
			const strLen = input.value.length;
			input.focus();
			input.setSelectionRange( 0, strLen );
			let success = false;
			try {
				success = document.execCommand( 'copy' );
			} catch( ex ) {
				console.log( 'view.About.toClippy - fail', ex );
				return;
			}
			
			btn.classList.toggle( 'Accept', true );
		}
		
		function formatStr( info ) {
			let str = '';
			str += 'version: ' + info.version + '\r\n';
			str += ' branch: ' + info.branch + '\r\n';
			str += ' date: ' + info.date + '\r\n';
			str += ' commit: ' + info.commit;
			return str;
		}
	}
	
	ns.About.prototype.showAbout = function( e ) {
		const self = this;
		self.hideAll();
		self.about.classList.toggle( 'hidden', false );
	}
	
	ns.About.prototype.showVersion = function( e ) {
		const self = this;
		self.hideAll();
		self.version.classList.toggle( 'hidden', false );
	}
	
	ns.About.prototype.showLegal = function( e ) {
		const self = this;
		self.hideAll();
		self.legal.classList.toggle( 'hidden', false );
	}
	
	ns.About.prototype.hideAll = function() {
		const self = this;
		self.about.classList.toggle( 'hidden', true );
		self.version.classList.toggle( 'hidden', true );
		self.legal.classList.toggle( 'hidden', true );
	}
	
	ns.About.prototype.handleResize = function( e ) {
		const self = this;
		self.height = document.body.clientHeight;
	}
	
	ns.About.prototype.handleMouseMove = function( e ) {
		const self = this;
		const h = self.height;
		const y = e.clientY;
		const rel = 1 - ( y / h );
		self.bg.style.opacity = rel;
	}
	
	ns.About.prototype.toggleAbout = function( show ) {
		const self = this;
		let op = null;
		if ( show )
			op = 1;
		else
			op = 0;
		
		self.currOp = op;
		self.bg.style.opacity = op;
	}
	
})( library.view );

window.View.run = fun;
function fun( fupConf ) {
	new library.view.About( fupConf );
}