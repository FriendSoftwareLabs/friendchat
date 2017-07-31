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

var friendUP = window.friendUP || {};
var library = window.library || {};
var hello = window.hello || {};

library.view = library.view || {};

(function( ns, undefined ) {
	ns.Conference = function( fupConf ) {
		if ( !( this instanceof ns.Conference ))
			return new ns.Conference( fupConf );
		
		library.view.Settings.call( this, fupConf );
		console.log( 'conference settings view' );
	}
	
	ns.Conference.prototype = Object.create( library.view.Settings.prototype );
	
	ns.Conference.prototype.setup = function() {
		var self = this;
		self.validKeys = [
			'topic',
			'mode',
		];
		self.labelMap = {
			topic : 'Topic',
			mode : View.i18n('i18n_channel_modes'),
		};
		self.buildMap = {
			topic : textInput,
			mode : checkbox,
		};
		
		function textInput( setting ) { self.setTextInput( setting ); }
		function checkbox( setting ) { self.setCheckbox( setting ); }
	}
	
	ns.Conference.prototype.buildView = function() {
		const self = this;
		const tmplId = 'settings-conference-tmpl';
		const el = hello.template.getElement( tmplId, {});
		el.innerHTML = View.i18nReplaceInString( el.innerHTML );
		document.body.appendChild( el );
	}
	
	
})( library.view );

window.View.run = initView;
function initView( fupCOnf ) {
	window.confSettings = new library.view.Conference( fupCOnf );
}