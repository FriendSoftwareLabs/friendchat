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

var api = window.api || {};

// Say
(function( ns, undefined ) {
	ns.Say = function( toSay, langCode ) {
		if ( !window.speechSynthesis ) {
			console.log( 'api.Say - speechSynthesis is not available', { s : toSay, l : langCode });
			return;
		}
		
		var defaultLanguage = 'en-GR';
		var availableVoices = window.speechSynthesis.getVoices();
		var utterance = new window.SpeechSynthesisUtterance( toSay );
		//console.log( 'availableVoices', availableVoices );
		availableVoices.forEach( matchPreference );
		
		utterance.lang = defaultLanguage;
		window.speechSynthesis.speak( utterance );
		
		function matchPreference( voice, index ) {
			//console.log( 'voice', { l: voice, i: index });
		}
	}
})( api );
