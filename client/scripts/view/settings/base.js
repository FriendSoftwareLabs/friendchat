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
	ns.Settings = function( conf ) {
		const self = this;
		self.view = null;
		self.settings = null;
		self.container = null;
		self.locked = {};
		self.updateMap = {};
		
		self.settingsInit();
	}
	
	ns.Settings.prototype.settingsInit = function() {
		const self = this;
		self.view = window.View;
		hello.template = friend.template;
		
		self.bindView();
		
		window.View.loaded();
	}
	
	ns.Settings.prototype.buildView = function() {
		const self = this;
		console.log( 'buildView' );
		const tmplId = 'settings-base-tmpl';
		const conf = {
			headString : 'settings for thing',
		};
		const el = hello.template.getElement( tmplId, conf );
		console.log( 'el', el );
		document.body.appendChild( el );
	}
	
	ns.Settings.prototype.bindEvents = function() {
		const self = this;
		var doneBtn = document.getElementById( 'done' );
		
		doneBtn.addEventListener( 'click', doneClick, false );
		
		function doneClick( e ) { self.done( e ); }
	}
	
	ns.Settings.prototype.done = function( e ) {
		const self = this;
		e.preventDefault();
		e.stopPropagation();
		self.send({ type : 'done' });
	}
	
	ns.Settings.prototype.bindView = function() {
		const self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'selectfile', selectFile );
		self.view.on( 'saved', saved );
		
		function initialize( msg ) { self.initialize( msg ); }
		function selectFile( msg ) { self.handleSelectFile( msg ); }
		function saved( msg ) { self.saved( msg ); }
	}
	
	ns.Settings.prototype.initialize = function( data ) {
		const self = this;
		console.log( 'Settings.initalize', data );
		self.buildView();
		self.container = document.getElementById( 'settings' );
		
		self.bindEvents();
		self.setup( Object.keys( data.settings));
		
		self.settings = {};
		self.setSettings( data.settings );
		self.bindSettings();
		
		self.view.ready();
	}
	
	ns.Settings.prototype.setSettings = function( data ) {
		const self = this;
		data.settings = data.settings || {};
		self.validKeys.forEach( add );
		function add( setting ) {
			var value = get( setting );
			self.settings[ setting ] = value;
			
			function get( setting ) {
				return data[ setting ] || data.settings[ setting ];
			}
		}
	}
	
	ns.Settings.prototype.bindSettings = function() {
		const self = this;
		var settings = self.displayOrder.filter( setting => {
				return self.validKeys.some( valid => setting == valid )
			});
		
		console.log( 'bindSettings', settings );
		settings.forEach( build );
		function build( setting ) {
			var handler = self.buildMap[ setting ];
			if ( !handler ) {
				console.log( 'settings.no handler for', setting )
				return;
			}
			handler( setting );
		}
	}
	
	
	ns.Settings.prototype.setTextInput = function( setting ) {
		const self = this;
		var label = self.labelMap[ setting ] || setting;
		var value = self.settings[ setting ] || '';
		var tmplConf = {
			setting : setting,
			label : label,
			value : value,
			status : null,
		};
		var id = build();
		bind( id );
		
		function build() {
			tmplConf.status = hello.template.get( 'settings-status-tmpl', { setting : setting });
			var element = hello.template.getElement( 'settings-plaintext-tmpl', tmplConf );
			self.container.appendChild( element );
			return element.id;
		}
		
		function bind( id ) {
			var element = document.getElementById( id );
			var input = element.querySelector( 'input' );
			
			element.addEventListener( 'submit', submit, false );
			input.addEventListener( 'blur', inputBlur, false );
			input.addEventListener( 'keyup', inputKey, false );
			
			self.updateMap[ setting ] = updateTextInput;
			function updateTextInput( value ) {
				input.value = value;
			}
			
			function submit( e ) {
				e.preventDefault();
				e.stopPropagation();
				self.save( setting, input.value );
			}
			
			function inputBlur( e ) { self.save( setting, input.value ); }
			function inputKey( e ) {
				if ( self.keyIsSubmit( e ))
					return;
				
				self.buffer( setting, input.value );
			}
		}
	}
	
	ns.Settings.prototype.setNumberInput = function( setting ) {
		const self = this;
		var label = self.labelMap[ setting ] || setting;
		var value = self.settings[ setting ] || 0;
		var tmplConf = {
			setting : setting,
			label : label,
			value : value,
			status : null,
		}
		var id = build();
		bind( id );
		
		function build() {
			tmplConf.status = hello.template.get( 'settings-status-tmpl', { setting : setting });
			var element = hello.template.getElement( 'settings-number-tmpl', tmplConf );
			self.container.appendChild( element );
			return element.id;
		}
		
		function bind( id ) {
			var element = document.getElementById( id );
			var input = element.querySelector( 'input' );
			
			element.addEventListener( 'submit', submit, false );
			input.addEventListener( 'blur', inputBlur, false );
			input.addEventListener( 'keyup', inputKeyup, false );
			
			self.updateMap[ setting ] = updateNumberInput;
			function updateNumberInput( value ) {
				input.value = value;
			}
			
			function submit( e ) {
				e.preventDefault();
				e.stopPropagation();
				var value = getValue();
				self.save( setting, value  );
			}
			
			function inputBlur( e ) {
				var value = getValue();
				self.save( setting, value );
			}
			
			function inputKeyup( e ) {
				var value = getValue();
				self.buffer( setting, value );
			}
			
			function getValue() {
				let raw = input.value;
				if ( !raw || !raw.toString ) {
					console.log( 'getValue - ' + raw + ' does not have .toString' );
					return 0;
				}
				
				let str = raw.toString();
				if ( !str )
					return 0;
				
				let num = Number( str );
				if ( !num )
					return 0;
				
				return num;
			}
		}
	}
	
	ns.Settings.prototype.setSecureInput = function( setting ) {
		const self = this;
		var state = {
			currentInput : null,
		};
		var label = self.labelMap[ setting ] || setting;
		var value = self.settings[ setting ];
		var tmplConf = {
			setting : setting,
			label : label,
			value : value,
			status : null,
		};
		
		var id = build();
		bind( id );
		
		function build() {
			tmplConf.status = hello.template.get( 'settings-status-tmpl', { setting : setting });
			var element = hello.template.getElement( 'settings-securetext-tmpl', tmplConf );
			self.container.appendChild( element );
			return element.id;
		}
		
		function bind( id ) {
			var form = document.getElementById( id );
			var secureInput = document.getElementById( setting );
			var plainInput = document.getElementById( setting + '-plain' );
			var btnShowSecure = document.getElementById( setting + '-btn-secure' );
			var btnShowPlain = document.getElementById( setting + '-btn-plain' );
			
			form.addEventListener( 'submit', submit, false );
			
			secureInput.addEventListener( 'blur', blurSecure, false );
			plainInput.addEventListener( 'blur', blurPlain, false );
			
			secureInput.addEventListener( 'keyup', keyup, false );
			plainInput.addEventListener( 'keyup', keyup, false );
			
			btnShowSecure.addEventListener( 'mousedown', showSecure, false );
			btnShowPlain.addEventListener( 'mousedown', showPlain, false );
			
			state.currentInput = secureInput;
			
			self.updateMap[ setting ] = updateSecureInput;
			function updateSecureInput( value ) {
				state.currentInput.value = value;
			}
			
			function submit( e ) {
				e.preventDefault();
				var value = validateInput( state.currentInput );
				self.save( setting, value );
			}
			
			function blurSecure( e ) {
				blur( secureInput );
			}
			
			function blurPlain( e ) {
				blur( plainInput );
			}
			
			function blur( element ) {
				var value = validateInput( element );
				self.save( setting, value );
			}
			
			function  keyup( e ) {
				var value = validateInput( e.target );
				self.buffer( setting, value );
			}
			
			function showSecure( e ) {
				e.preventDefault();
				copyToSecure();
				state.currentInput = secureInput;
				toggleSecure( true );
				secureInput.focus();
			}
			function showPlain( e ) {
				e.preventDefault();
				copyToPlain();
				state.currentInput = plainInput;
				toggleSecure( false );
				plainInput.focus();
			}
			function toggleSecure( secureVisible ) {
				secureInput.classList.toggle( 'hidden', !secureVisible );
				plainInput.classList.toggle( 'hidden', secureVisible );
				btnShowSecure.classList.toggle( 'hidden', secureVisible );
				btnShowPlain.classList.toggle( 'hidden', !secureVisible );
			}
			
			function copyToSecure() { copyAndClear( plainInput, secureInput ); }
			function copyToPlain() { copyAndClear( secureInput, plainInput ); }
			function copyAndClear( fromA, toB ) {
				toB.value = fromA.value;
				fromA.value = '';
			}
			
			function validateInput( element ) {
				var current = ( state.currentInput.id === element.id );
				if ( !current ) {
					console.log( 'not current input', element );
					return null;
				}
				
				var value = element.value;
				if ( !value )
					return '';
				return value.trim();
			}
		}
	}
	
	ns.Settings.prototype.confirmedPassword = function( setting ) {
		const self = this;
		var label = self.labelMap[ setting ] || setting;
		var value = self.settings[ setting ] || '';
		var tmplConf = {
			setting : setting,
			label : label,
			value : value,
		};
		var id = build();
		bind( id );
		
		function build() {
			var element = hello.template.getElement( 'password-input-tmpl', tmplConf );
			self.container.appendChild( element );
			
			return element.id;
		}
		
		function bind( id ) {
			var form = document.getElementById( id );
			var inputPass = document.getElementById( setting );
			var inputPassPlain = document.getElementById( setting + '-plain' );
			var inputConfirm = document.getElementById( setting + '-confirm' );
			var inputConfirmPlain = document.getElementById( setting + '-plain-confirm' );
			
			var btnShowPlain = document.getElementById( setting + '-show-plain' );
			var btnShowSecure = document.getElementById( setting + '-show-secure' );
			
			var btnSubmit = document.getElementById( setting + '-btn-submit' );
			var btnError = document.getElementById( setting + '-btn-error' );
			
			form.addEventListener( 'submit', submit, false );
			
			inputPass.addEventListener( 'keyup', matchSecure, false );
			inputPassPlain.addEventListener( 'keyup', matchPlain, false );
			inputConfirm.addEventListener( 'keyup', matchSecure, false );
			inputConfirmPlain.addEventListener( 'keyup', matchPlain, false );
			
			btnShowPlain.addEventListener( 'click', showPlain, false );
			btnShowSecure.addEventListener( 'click', showSecure, false );
			
			function submit( e ) {
				e.preventDefault();
				var pass = false;
				if ( !inputPass.classList.contains( 'hidden' ))
					pass = matchSecure();
				else
					pass = matchPlain();
				
				if ( !pass )
					return;
				
				save( pass );
			}
			
			function matchSecure( e ) { return match( inputPass, inputConfirm ); }
			function matchPlain( e ) { return match( inputPassPlain, inputConfirmPlain ); }
			function match( passElement, confirmElement ) {
				var pass = passElement.value.trim();
				var confirm = confirmElement.value.trim();
				
				if ( !pass || passElement.classList.contains( 'hidden' )) {
					disableSubmit();
					return false ;
				}
				
				if ( pass !== confirm ) {
					disableSubmit();
					return false;
				}
				
				console.log( 'matched', { p : pass, c : confirm });
				enableSubmit();
				return pass;
			}
			
			function enableSubmit() {
				btnSubmit.disabled = false;
				toggleSubmitButton( true );
			}
			function disableSubmit() {
				btnSubmit.disabled = true;
				toggleSubmitButton( false );
			}
			function toggleSubmitButton( enable ) {
				console.log( 'settings.pass.toggleButton', enable.toString());
				btnSubmit.classList.toggle( 'disabled', !enable );
				btnSubmit.classList.toggle( 'accept', enable );
			}
			
			function save( pass ) {
				if ( btnSubmit.classList.contains( 'disabled' ))
					return;
				
				console.log( 'setting.pass.save', pass );
				throw new Error( 'confirmedPassword is somewhat broken, callback is deprectaed ( saveBack )' );
				self.save( setting, pass, saveBack );
			}
			
			function saveBack( response ) {
				console.log( 'settings.password.saveBack', response );
				if ( !response.success ) {
					showErrorBtn();
					return;
				}
				
				clearForm();
			}
			
			function showErrorBtn() { toggleErrorBtn( true )}
			function hideErrorBtn() { toggleErrorBtn( false )}
			function toggleErrorBtn( showError ) {
				btnSubmit.classList.toggle( 'hidden', showError );
				btnError.classList.toggle( 'hidden', !showError );
			}
			
			function clearForm( data ) {
				
			}
			
			function showSecure( e ) {
				console.log( 'settings.pass.showSecure' );
				toggleInputMode( true );
				toggleModeButton( true );
				copyValuesToSecure();
			}
			
			function showPlain( e ) {
				console.log( 'settings.pass.showPlain' );
				toggleInputMode( false );
				toggleModeButton( false );
				copyValuesToPlain();
			}
			
			function toggleInputMode( secureVisible ) {
				inputPass.classList.toggle( 'hidden', !secureVisible );
				inputConfirm.classList.toggle( 'hidden', !secureVisible );
				inputPassPlain.classList.toggle( 'hidden', secureVisible );
				inputConfirmPlain.classList.toggle( 'hidden', secureVisible );
			}
			
			function toggleModeButton( makePlainVisible ) {
				btnShowPlain.classList.toggle( 'hidden', !makePlainVisible );
				btnShowSecure.classList.toggle( 'hidden', makePlainVisible );
			}
			
			function copyValuesToSecure() {
				copyValues( inputPassPlain, inputConfirmPlain, inputPass, inputConfirm );
			}
			
			function copyValuesToPlain() {
				copyValues( inputPass, inputConfirm, inputPassPlain, inputConfirmPlain );
			}
			
			function copyValues( fromA, fromB, toA, toB ) {
				toA.value = fromA.value;
				toB.value = fromB.value;
				fromA.value = '';
				fromB.value = '';
			}
		}
	}
	
	ns.Settings.prototype.singleCheck = function( setting ) {
		const self = this;
		var isChecked = !!self.settings[ setting ];
		var label = self.labelMap[ setting ];
		
		if ( typeof( isChecked ) === 'undefined' ) {
			console.log( 'no setting for', setting );
			return;
		}
		
		var id = build();
		bind( id );
		
		function build() {
			var status = hello.template.get( 'settings-status-tmpl', { setting : setting });
			var conf = {
				setting : setting,
				label : label,
				checked : isChecked ? 'checked' : '',
				status : status,
			};
			var element = hello.template.getElement( 'settings-singlecheck-tmpl', conf );
			self.container.appendChild( element );
			return element.id;
		}
		
		function bind( id ) {
			var form = document.getElementById( id );
			var input = form.querySelector( 'input' );
			
			form.addEventListener( 'submit', formSubmit, false );
			input.addEventListener( 'click', click, false );
			
			self.updateMap[ setting ] = updateHandler;
			function updateHandler( value ) {
				input.checked = !!value;
			}
			
			function formSubmit( e ) {
				e.preventDefault();
				e.stopPropagation();
				save();
			}
			
			function click( e ) {
				save();
			}
			
			function save() {
				self.save( setting, input.checked );
			}
		}
	}
	
	ns.Settings.prototype.setCheckbox = function( setting ) {
		const self = this;
		var settings = self.settings[ setting ];
		if ( !settings) {
			console.log( 'no settings for', setting );
			return;
		}
		
		const checkerKeys = Object.keys( settings );
		const label = self.labelMap[ setting ] || setting;
		const checkConf = {
			setting : setting,
			label : label,
			checkers : null,
			status : hello.template.get( 'settings-status-tmpl', { setting : setting }),
		};
		
		var id = build();
		bind( id );
		
		function build() {
			var checkers = checkerKeys.map( buildCheck );
			checkConf.checkers = checkers.join( '' );
			var element = hello.template.getElement( 'settings-checkbox-tmpl', checkConf );
			self.container.appendChild( element );
			return element.id;
		}
		
		function buildCheck( key ) {
			var checked = settings[ key ];
			var conf = {
				id : makeId( key ),
				label : self.labelMap[ key ] || key,
				checked : checked ? 'checked' : '',
			};
			var element = hello.template.get( 'settings-checkbox-checker-tmpl', conf );
			return element;
		}
		
		function bind( id ) {
			var form = document.getElementById( id );
			form.addEventListener( 'submit', submit, false );
			checkerKeys.forEach( bindCheck );
			
			self.updateMap[ setting ] = updateCheckbox;
			function updateCheckbox( value ) {
				console.log( 'Settings.checkbox.update - NYI', value );
			}
			
			function submit( e ){
				e.preventDefault();
				save();
			}
			
			function bindCheck( key ) {
				var id = makeId( key );
				var checkElement = document.getElementById( id );
				checkElement.addEventListener( 'click', click, false );
				
				function click( e ) {
					save();
				}
			}
		}
		
		function makeId( key ) { return setting + '-' + key; }
		
		function save() {
			var values = getValues();
			self.save( setting, values );
		}
		
		function getValues() {
			var values = {};
			checkerKeys.forEach( getValue );
			return values;
			
			function getValue( key ) {
				var id = makeId( key );
				var checkElement = document.getElementById( id );
				values[ key ] = checkElement.checked;
			}
		}
	}
	
	ns.Settings.prototype.setTextarea = function( setting ) {
		const self = this;
		var label = self.labelMap[ setting ] || setting;
		var value = self.settings[ setting ];
		var conf = {
			setting : setting,
			label :label,
			value : value,
		}
		var id = build();
		bind( id );
		
		function build() {
			var status = hello.template.get( 'settings-status-tmpl', { setting : setting });
			conf.status = status;
			var element = hello.template.getElement( 'settings-textarea-tmpl', conf );
			self.container.appendChild( element );
			return element.id;
		}
		
		function bind( id ) {
			var form = document.getElementById( id );
			var textarea = document.getElementById( setting );
			
			form.addEventListener( 'submit', submit, false );
			
			textarea.addEventListener( 'blur', blur, false );
			textarea.addEventListener( 'keyup', keyup, false );
			
			function submit( e ) {
				e.preventDefault();
				console.log( 'textarea submit', e.target[ 0 ].value );
			}
			
			function blur( e ) {
				console.log( 'textarea blur', textarea.value );
				self.save( setting, textarea.value );
			}
			
			function keyup( e ) {
				console.log( 'textarea keyup', textarea.value );
				self.buffer( setting, textarea.value );
			}
		}
	}
	
	ns.Settings.prototype.setFileSelect = function( setting ) {
		const self = this;
		var label = self.labelMap[ setting ];
		var value = self.settings[ setting ] || '';
		var conf = {
			setting : setting,
			label : label,
			value : value,
		};
		
		var id = build( conf );
		bind( id );
		
		function build( conf ) {
			var status = hello.template.get( 'settings-status-tmpl', { setting : setting });
			conf.status = status;
			var element = hello.template.getElement( 'settings-fileselect-tmpl', conf );
			self.container.appendChild( element );
			return element.id;
		}
		
		function bind( id ) {
			var form = document.getElementById( id );
			var input = document.getElementById( setting );
			var selectBtn = form.querySelector( '.select-btn' );
			
			form.addEventListener( 'submit', submit, false );
			input.addEventListener( 'blur', blur, false );
			selectBtn.addEventListener( 'click', selectCSS, false );
			
			function submit( e ) {
				e.preventDefault();
				e.stopPropagation();
				var value = input.value;
				self.save( setting, value );
			}
			
			function blur( e ) {
				value = input.value;
				self.save( setting, value );
			}
			
			function selectCSS( e ) {
				e.preventDefault();
				e.stopPropagation();
				var select = {
					type : 'selectfile',
					data : {
						path : value.path || '',
						filename : value.filename || '',
						title : View.i18n('i18n_select_irc_channel'),
					},
				};
				
				self.openFiledialog( select, selectCallback );
			}
			
			function selectCallback( result ) {
				var input = document.getElementById( setting );
				input.value = result[ 0 ].Path;
				self.save( setting, input.value );
			}
		}
	}
	
	ns.Settings.prototype.openFiledialog = function( data, callback ) {
		const self = this;
		if ( self.filedialogCallback )
			return;
		
		self.filedialogCallback = callback;
		self.send( data );
	}
	
	ns.Settings.prototype.handleSelectFile = function( msg ) {
		const self = this;
		if ( !self.filedialogCallback ) {
			console.log( 'no callback found for', msg );
			return;
		}
		
		callback = self.filedialogCallback;
		self.filedialogCallback = null;
		callback( msg );
	}
	
	ns.Settings.prototype.buffer = function( setting, value ) {
		const self = this;
		
		if ( !self.metaCheck( setting, value )) {
			self.setStatus( setting, 'saved' );
			return;
		}
		
		self.setStatus( setting, 'changed' );
		var msg = {
			type : 'buffer',
			data : {
				setting : setting,
				value : value,
			},
		}
		self.send( msg );
	}
	
	ns.Settings.prototype.save = function( setting, value ) {
		const self = this;
		if ( !self.metaCheck( setting, value )) {
			self.setStatus( setting, 'saved' );
			return;
		}
		
		self.setStatus( setting, 'working' );
		lockSetting( setting );
		var update = {
			type : 'save',
			data : {
				setting : setting,
				value : value,
			},
		};
		self.send( update );
		
		function lockSetting( setting ) {
			self.locked[ setting ] = true;
		}
	}
	
	ns.Settings.prototype.saved = function( data ) {
		const self = this;
		var setting = data.setting;
		unlockSetting( setting );
		self.updateSetting( data );
		if ( !data.success ) {
			console.log( 'setting error', data );
			self.setStatus( setting, 'error' );
			return;
		}
		
		self.setStatus( setting, 'saved' );
		
		function unlockSetting( setting ) {
			self.locked[ setting ] = false;
		}
	}
	
	ns.Settings.prototype.updateSetting = function( data ) {
		const self = this;
		console.log( 'updateSetting', data );
		var setting = data.setting;
		var current = self.settings[ setting ];
		var update = data.value;
		var updateHandler = self.updateMap[ setting ];
		if ( data.success )
			setUpdate();
		else
			revert();
		
		function setUpdate() {
			if ( updateHandler )
				updateHandler( update );
			
			self.settings[ setting ] = update;
		}
		
		function revert() {
			if ( updateHandler )
				updateHandler( current );
		}
	}
	
	ns.Settings.prototype.send = function( msg ) {
		const self = this;
		self.view.sendMessage( msg );
	}
	
	ns.Settings.prototype.metaCheck = function( setting, value ) {
		const self = this;
		if ( self.locked[ setting ])
			return false;
		
		var isNew = self.isNewValue( setting, value );
		var isValid = self.isValidSetting( setting );
		return !!( isNew && isValid );
	}
	
	ns.Settings.prototype.isNewValue = function( setting, value ) {
		const self = this;
		var oldValue = self.settings[ setting ];
		return !( oldValue === value );
	}
	
	ns.Settings.prototype.keyIsSubmit = function( e ) {
		const self = this;
		return e.keyCode === 13;
	}
	
	ns.Settings.prototype.isValidSetting = function( key ) {
		const self = this;
		if ( !self.validKeys )
			throw new Error( 'settings.isValid - self.validKeys is not', self.validKeys );
		
		if ( self.validKeys.indexOf( key ) === -1 ) {
			console.log( 'not a valid key', { k : setting, v : value });
			return false;
		}
		
		return true;
	}
	
	ns.Settings.prototype.setStatus = function( setting, status ) {
		const self = this;
		var id = setting + '-status';
		var parent = document.getElementById( id );
		if ( !parent )
			return;
		
		var states = {
			saved : parent.querySelector( '.good' ),
			changed : parent.querySelector( '.changed' ),
			working : parent.querySelector( '.working' ),
			error : parent.querySelector( '.bad' ),
		};
		hideAll();
		show( states[ status ]);
		
		function show( status ) { status.classList.toggle( 'hidden', false ); }
		function hideAll() {
			states.saved.classList.toggle( 'hidden', true );
			states.changed.classList.toggle( 'hidden', true );
			states.working.classList.toggle( 'hidden', true );
			states.error.classList.toggle( 'hidden', true );
		}
	}
	
})( library.view );


// PASSWORD
(function( ns, undefined ) {
	ns.Password =  function( conf ) {
		if ( !( this instanceof ns.Password ))
			return new ns.Password( conf );
		
		const self = this;
		self.init();
	}
	
	ns.Password.prototype.init = function() {
		const self = this;
	}
	
})( library.view );
