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

var friend = window.friend || {};
var library = window.library || {};
library.view = library.view || {};

(function( ns, undefined ) {
	ns.About = function() {
		var self = this;
		self.mouseIsOver = false;
		self.currOp = 0;
		this.init();
	}
	
	ns.About.prototype.init = function() {
		var self = this;
		View.setBody();
		
		self.height = document.body.clientHeight;
		self.bg = document.getElementById( 'bg' );
		self.content = document.getElementById( 'content' );
		self.about = document.getElementById( 'about' );
		self.legal = document.getElementById( 'legal' );
		var menuAbout = document.getElementById( 'about-menu' );
		var menuLegal = document.getElementById( 'legal-menu' );
		
		window.addEventListener( 'resize', viewResize, false );
		document.addEventListener( 'mousemove', mouseMove, false );
		document.addEventListener( 'mouseleave', mouseLeave, false );
		content.addEventListener( 'click', toggleBg, false );
		menuAbout.addEventListener( 'click', showAbout, false );
		menuLegal.addEventListener( 'click', showLegal, false );
		
		function viewResize( e ) { self.handleResize( e ); }
		function mouseMove( e ) { self.handleMouseMove( e ); }
		function mouseLeave( e ) { self.toggleAbout( false ); }
		
		function toggleBg( e ) {
			self.toggleAbout( !self.currOp );
		}
		
		function showAbout( e ) { self.showAbout( e ); }
		function showLegal( e ) { self.showLegal( e ); }
	}
	
	ns.About.prototype.showAbout = function( e ) {
		var self = this;
		self.legal.classList.toggle( 'hidden', true );
		self.about.classList.toggle( 'hidden', false );
	}
	
	ns.About.prototype.showLegal = function( e ) {
		var self = this;
		self.about.classList.toggle( 'hidden', true );
		self.legal.classList.toggle( 'hidden', false );
	}
	
	ns.About.prototype.handleResize = function( e ) {
		var self = this;
		self.height = document.body.clientHeight;
	}
	
	ns.About.prototype.handleMouseMove = function( e ) {
		const self = this;
		const h = self.height;
		const y = e.clientY;
		const rel = y / h;
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