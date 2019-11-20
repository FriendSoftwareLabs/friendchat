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

var library = window.library || {};
var friendUP = window.friendUP || {};
var hello = window.hello || {};

library.view = library.view || {};

// COMPONENTFORM
(function( ns, undefined ) {
	ns.ComponentForm = function() {
		const self = this;
		self.inputs = [];
		self.container = null;
		
		self.initComponentForm();
	}
	
	ns.ComponentForm.prototype.initComponentForm = function() {
		const self = this;
		hello.template = friend.template;
		
		self.buildView();
		
		self.view = window.View;
		self.view.on( 'initialize', initialize );
		self.view.on( 'response', response );
		
		function initialize( msg ) { self.initialize( msg ); }
		function response( msg ) { self.handleResponse( msg ); }
		
		self.componentMap = {
			'text'             : text,
			'email'            : email,
			'secure-confirmed' : secureConfirmed,
		}
		
		function text( data ) { self.setText( data ); }
		function email( data ) { self.setEmail( data ); }
		function secureConfirmed( data ) { self.setSecureConfirmed( data ); }
		
		self.container = document.getElementById( 'input' );
		self.form = document.getElementById( 'form' );
		
		if ( !self.setup )
			throw new Error( 'ComponentForm - setup() not implemented' );
		
		self.setup();
		
		window.View.loaded();
	}
	
	ns.ComponentForm.prototype.buildView = function() {
		const self = this;
		const el = hello.template.getElement( self.tmplId );
		console.log( 'el', el );
		document.body.appendChild( el );
	}
	
	ns.ComponentForm.prototype.initialize = function( data ) {
		var self = this;
		if ( !data.fragments ) {
			console.log( 'ComponentForm.initialize - no fragments found', data );
			return;
		}
		
		hello.template.addFragments( data.fragments );
		
		
		if ( !self.buildForm )
			throw new Error( 'ComponentForm - buildForm() is not defined by the form' );
		
		self.buildForm();
		self.bindForm();
		
		self.overlay = new library.component.FormOverlay( self.form.id );
		
		window.View.ready();
	}
	
	ns.ComponentForm.prototype.buildForm = function() {
		var self = this;
		if ( !self.buildMap )
			throw new Error( 'buildMap not defined by form ( do it in setup() )' );
		
		var tabIndex = 1;
		var parentContainer = [];
		self.buildMap.forEach( add );
		
		function add( conf ) {
			if ( conf.type == 'container' )
				addContainer( conf );
			else
				addInput( conf );
		}
		
		function addContainer( conf ) {
			parentContainer.push( self.container.id );
			var containerId = self.setContainer( conf.data );
			self.container = document.getElementById( containerId );
			conf.data.content.forEach( add );
			self.container = document.getElementById( parentContainer.pop());
		}
		
		function addInput( conf ) {
			conf.data.tabIndex = tabIndex;
			tabIndex++;
			
			var handler = self.componentMap[ conf.type ];
			if ( !handler ) {
				console.log( 'ComponentForm - no handler for', conf );
				return;
			}
			
			handler( conf.data );
		}
	}
	
	ns.ComponentForm.prototype.bindForm = function() {
		var self = this;
		self.form.addEventListener( 'submit', submit, false );
		self.form.addEventListener( 'reset', reset, false );
		
		function submit( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.submit();
		}
		
		function reset( e ) {
			//e.preventDefault();
			console.log( 'ComponentForm.reset - NYI' );
		}
	}
	
	ns.ComponentForm.prototype.setContainer = function( data ) {
		var self = this;
		var tmplConf = {
			id : data.id || data.name,
			legend : data.legend || data.name,
		};
		var element = hello.template.getElement( 'form-container-tmpl', tmplConf );
		self.container.appendChild( element );
		return element.id;
	}
	
	ns.ComponentForm.prototype.setText = function( data ) {
		var self = this;
		const tmplConf = {
			id : data.id || data.name,
			label : data.label || data.name || 'textinputlabel',
			name : data.name || 'textinputname',
			type : data.type || 'text',
			tabIndex : data.tabIndex || 0,
			placeholder : data.placeholder || data.label || data.name,
			required : data.required || false,
		};
		var element = hello.template.getElement( 'form-text-input-tmpl', tmplConf );
		self.container.appendChild( element );
		var model = new library.view.Text( tmplConf );
		self.inputs.push( model );
	}
	
	ns.ComponentForm.prototype.setEmail = function( data ) {
		var self = this;
		data.type = 'email';
		self.setText( data );
	}
	
	ns.ComponentForm.prototype.setPulldown = function( data ) {
		var self = this;
		console.log( 'ComponentForm.setPulldown', data );
		var options = buildOptionsString( data.options );
		const tmplConf = {
			id : data.id || data.name,
			label : data.label || data.name,
			name : data.name,
			required : data.required || false,
			options : options,
		};
		var element = hello.template.getElement( 'form-pulldown-tmpl', tmplConf );
		self.container.appendChild( element );
		var model = new library.view.Pulldown( tmplConf );
		self.inputs.push( model );
		
		function buildOptionsString( options ) {
			console.log( 'ComponentForm.setPulldown.buildOptionString', options );
			var stringArr = options.map( buildOption );
			return stringArr.join( '' );
			
			function buildOption( data ) {
				var tmplConf = {
					value : data.value,
					label : data.label || data.value,
				};
				var optionString = hello.template.get( 'form-pulldown-option-tmpl', tmplConf );
				return optionString;
			}
		}
	}
	
	ns.ComponentForm.prototype.setCheckbox = function( data ) {
		var self = this;
		console.log( 'ComponentForm.setCheckbox - NYI', data );
	}
	
	ns.ComponentForm.prototype.setSecureConfirmed = function( data ) {
		var self = this;
		var tmplConf = {
			id : data.id || data.name,
			name : data.name,
			label : data.label || data.name,
			tabIndex : data.tabIndex || 0,
			placeholder : data.label || data.name,
			required : data.required || true,
		};
		var element = hello.template.getElement( 'form-secure-confirmed-tmpl', tmplConf );
		self.container.appendChild( element );
		var model = new library.view.SecureConfirmed( tmplConf );
		self.inputs.push( model );
	}
	
	ns.ComponentForm.prototype.validate = function() {
		var self = this;
		var required = self.inputs.filter( isRequired );
		var invalid = required.filter( notValid );
		return invalid;
		
		function isRequired( input ) {
			return input.required;
		}
		
		function notValid( input ) {
			return !input.valid;
		}
	}
	
	ns.ComponentForm.prototype.collect = function() {
		var self = this;
		var formData = {};
		self.inputs.forEach( getValue );
		return formData;
		
		function getValue( input ) {
			formData[ input.name ] = input.value;
		}
	}
	
	ns.ComponentForm.prototype.submit = function() {
		var self = this;
		var invalidInputs = self.validate();
		if ( invalidInputs.length ) {
			console.log( 'form.submit - invalid form' );
			invalidInputs.forEach( showError );
			return;
		}
		
		var data = self.collect();
		self.overlay.show();
		var submitEvent = {
			type : 'submit',
			data : data,
		};
		self.send( submitEvent );
		
		function showError( input ) {
			input.showError();
		}
	}
	
	ns.ComponentForm.prototype.handleResponse = function( res ) {
		var self = this;
		if ( !res.success ) {
			self.overlay.error( res.message, showForm );
			self.populate( res.data );
			self.showErrors( res.error );
			return;
		}
		
		self.overlay.success( 'registered', close );
		
		function showForm() {
			console.log( 'overlay callback' );
		}
		
		function close() {
			self.close();
		}
	}
	
	ns.ComponentForm.prototype.populate = function( data ) {
		var self = this;
		self.inputs.forEach( setValue );
		function setValue( input ) {
			var key = input.name;
			var value = data[ key ];
			if ( !value )
				return;
			
			input.value = value;
		}
	}
	
	ns.ComponentForm.prototype.showErrors = function( errors ) {
		var self = this;
		self.inputs.forEach( showError );
		function showError( input ) {
			var key = input.name;
			var message = errors[ key ];
			if ( message )
				input.showError( message );
			else
				input.showError();
		}
	}
	
	ns.ComponentForm.prototype.clearErrors = function() {
		var self = this;
		console.log( 'clear errors - NYI' );
	}
	
	ns.ComponentForm.prototype.close = function() {
		var self = this;
		var closeMsg = {
			type : 'exit',
		};
		self.send( closeMsg );
	}
	
	ns.ComponentForm.prototype.send = function( msg ) {
		var self = this;
		self.view.sendMessage( msg );
	}
})( library.view );


// BASE FORM COMPONENT
(function( ns, undefined ) {
	ns.FormBase = function() {
		var self = this;
	}
	
	ns.FormBase.prototype.showError = function( message ) {
		var self = this;
		if ( !message )
			message = self.getError();
		
		if ( !message )
			return;
		
		var errId = self.getErrId();
		self.hideError();
		var errorConf = {
			id : errId,
			message : message,
		};
		var errElement = hello.template.getElement( 'form-error-tooltip-tmpl', errorConf );
		var inputs = self.element.querySelectorAll( '.input' );
		var container = inputs[ inputs.length -1 ];
		self.element.classList.toggle( 'has-error', true );
		container.appendChild( errElement );
		
		function removeExisting( errId ) {
			var err = document.getElementById( errId );
			if ( !err )
				return;
			
			err.parentNode.removeChild( err );
		}
	}
	
	ns.FormBase.prototype.hideError = function() {
		var self = this;
		self.element.classList.toggle( 'has-error', false );
		var errId = self.getErrId();
		var errElement = document.getElementById( errId );
		if ( errElement )
			errElement.parentNode.removeChild( errElement );
	}
	
	ns.FormBase.prototype.getError = function() {
		var self = this;
		if ( self.valid )
			return false;
		
		if ( self.required && !self.value.length )
			return 'This field is required';
		
		if ( !self.valid )
			return 'Invalid input';
		
		return 'unspecified error';
	}
	
	ns.FormBase.prototype.getErrId = function() {
		var self = this;
		var errId = self.id + '-error';
		return errId;
	}
	
})( library.view );


// TEXT
(function( ns, undefined ) {
	ns.Text = function( conf ) {
		if ( !( this instanceof ns.Text ))
			return new ns.Text( conf );
		
		var self = this;
		library.view.FormBase.call( self );
		
		self.id = conf.id;
		self.name = conf.name;
		self.required = conf.required;
		self.element = null;
		
		self.init();
	}
	
	ns.Text.prototype = Object.create( library.view.FormBase.prototype );
	
	ns.Text.prototype.init = function() {
		var self = this;
		Object.defineProperty( self, 'value', {
			get : getValue,
			set : setValue,
		});
		
		Object.defineProperty( self, 'valid', {
			get : isValid,
		});
		
		function getValue() { return self.input.value.trim(); }
		function setValue( str ) { self.setValue( str ); }
		function isValid() { return self.isValid(); }
		
		self.element = document.getElementById( self.id );
		self.bind();
	}
	
	ns.Text.prototype.bind = function() {
		var self = this;
		var inputId = self.id + '-input';
		self.input = document.getElementById( inputId );
		self.input.addEventListener( 'focus', inputFocus, false );
		self.input.addEventListener( 'blur', inputBlur, false );
		
		function inputFocus( e ) { self.hideError(); }
		function inputBlur( e ) { self.checkInput(); }
	}
	
	ns.Text.prototype.setValue = function( str ) {
		var self = this;
		if ( !str || !str.trim )
			return;
		
		str = str.trim();
		self.input.value = str;
	}
	
	ns.Text.prototype.checkInput = function() {
		var self = this;
	}
	
	ns.Text.prototype.isValid = function() {
		var self = this;
		if ( self.required && !self.value.length ) {
			return false;
		}
		
		return true;
	}
	
})( library.view );

// PULLDOWN
(function( ns, undefined ) {
	ns.Pulldown = function( conf ) {
		if ( !( this instanceof ns.Pulldown ))
			return new ns.Pulldown( conf );
		
		var self = this;
		library.view.FormBase.call( self );
		
		self.id = conf.id;
		self.name = conf.name;
		self.required = conf.required;
		self.conf = conf;
		self.element =null;
		
		self.init();
	}
	
	ns.Pulldown.prototype = Object.create( library.view.FormBase.prototype );
	
	ns.Pulldown.prototype.init = function() {
		var self = this;
		Object.defineProperty( self, 'value', {
			get : getValue,
			set : setValue,
		});
		
		Object.defineProperty( self, 'valid', {
			get : isValid,
		});
		
		function getValue() { return self.select.value; }
		function setValue( str ) { self.setValue( str ); }
		function isValid() { return true; }
		
		self.element = document.getElementById( self.id );
		self.bind();
	}
	
	ns.Pulldown.prototype.bind = function() {
		var self = this;
		var selectId = self.id + '-select';
		self.select = document.getElementById( selectId );
	}
	
	ns.Pulldown.prototype.setValue = function( str ) {
		var self = this;
		console.log( 'pulldown.setvalue - NYI', str );
	}
	
})( library.view );


// SECURE-CONFIRMED
(function( ns, undefined ) {
	ns.SecureConfirmed = function( conf ) {
		if ( !( this instanceof ns.SecureConfirmed ))
			return new ns.SecureConfirmed( conf );
		
		var self = this;
		library.view.FormBase.call( self );
		
		self.id = conf.id;
		self.name = conf.name;
		self.tabIndex = conf.tabIndex;
		self.required = conf.required;
		self.conf = conf;
		self.element = null;
		
		self.isSecure = true;
		
		self.init();
	}
	
	ns.SecureConfirmed.prototype = Object.create( library.view.FormBase.prototype );
	
	ns.SecureConfirmed.prototype.init = function() {
		var self = this;
		Object.defineProperty( self, 'value', {
			get : getValue,
			set : setValue,
		});
		
		Object.defineProperty( self, 'valid', {
			get : checkIsConfirmed,
		});
		
		function getValue() { return self.getValue() }
		function setValue( str ) { self.setValue( str ); }
		function checkIsConfirmed() { return self.checkIsConfirmed(); }
		
		self.element = document.getElementById( self.id );
		self.bind();
		self.updateStrength();
	}
	
	ns.SecureConfirmed.prototype.bind = function() {
		var self = this;
		var passSecure = self.id + '-pass-secure';
		var passPlain = self.id + '-pass-plain';
		var confirmSecure = self.id + '-confirm-secure';
		var confirmPlain = self.id + '-confirm-plain';
		var setPlain = self.id + '-set-plain';
		var setSecure = self.id + '-set-secure';
		var confirmValid = self.id + '-confirm-valid';
		var confirmInvalid = self.id + '-confirm-invalid';
		var strengthBar = self.id + '-strength-bar';
		
		self.passSecure = document.getElementById( passSecure );
		self.passPlain = document.getElementById( passPlain );
		self.confirmSecure = document.getElementById( confirmSecure );
		self.confirmPlain = document.getElementById( confirmPlain );
		self.setPlainBtn = document.getElementById( setPlain );
		self.setSecureBtn = document.getElementById( setSecure );
		self.confirmValid = document.getElementById( confirmValid );
		self.confirmInvalid = document.getElementById( confirmInvalid );
		self.strengthBar = document.getElementById( strengthBar );
		
		self.passSecure.addEventListener( 'focus', inputFocus, false );
		self.passPlain.addEventListener( 'focus', inputFocus, false );
		self.confirmSecure.addEventListener( 'focus', inputFocus, false );
		self.confirmPlain.addEventListener( 'focus', inputFocus, false );
		
		self.passSecure.addEventListener( 'keyup', inputUpdate, false );
		self.passPlain.addEventListener( 'keyup', inputUpdate, false );
		self.confirmSecure.addEventListener( 'keyup', inputUpdate, false );
		self.confirmPlain.addEventListener( 'keyup', inputUpdate, false );
		
		self.passSecure.addEventListener( 'blur', inputUpdate, false );
		self.passPlain.addEventListener( 'blur', inputUpdate, false );
		self.confirmSecure.addEventListener( 'blur', inputUpdate, false );
		self.confirmPlain.addEventListener( 'blur', inputUpdate, false );
		
		self.setPlainBtn.addEventListener( 'mousedown', setPlainClick, false );
		self.setSecureBtn.addEventListener( 'mousedown', setSecureClick, false );
		
		function inputFocus( e ) { self.hideError(); }
		
		function inputUpdate( e ) {
			var input = e.target;
			if ( input.value !== input.value.trim() )
				input.value = input.value.trim();
			
			self.updateIsConfirmed();
			if (( input.id === self.passSecure.id ) || ( input.id === self.passPlain.id ))
				self.updateStrength();
		}
		
		function setPlainClick( e ) { self.toggleSecure( false ); }
		function setSecureClick( e ) { self.toggleSecure( true ); }
	}
	
	ns.SecureConfirmed.prototype.updateIsConfirmed = function() {
		var self = this;
		if ( self.valid )
			toggleConfirmed( true );
		else
			toggleConfirmed( false );
		
		function toggleConfirmed( isConfirmed ) {
			self.confirmValid.classList.toggle( 'hidden', !isConfirmed );
			self.confirmInvalid.classList.toggle( 'hidden', isConfirmed );
		}
	}
	
	ns.SecureConfirmed.prototype.updateStrength = function() {
		var self = this;
		if ( self.isSecure )
			var input = self.passSecure;
		else
			var input = self.passPlain;
		
		var length = input.value.length || 0;
		var percent = ( length / 16 ) * 100;
		percent = percent > 100 ? 100 : percent;
		self.strengthBar.style.width = percent + '%';
		
		if ( length < 8 )
			setWeak();
		if ( length >= 8 )
			setMeh();
		if ( length > 14 )
			setStrong();
		
		function setWeak() {
			self.strengthBar.classList.toggle( 'meh', false );
			self.strengthBar.classList.toggle( 'strong', false );
		}
		
		function setMeh() {
			self.strengthBar.classList.toggle( 'meh', true );
			self.strengthBar.classList.toggle( 'strong', false );
		}
		
		function setStrong() {
			self.strengthBar.classList.toggle( 'meh', false );
			self.strengthBar.classList.toggle( 'strong', true );
		}
	}
	
	ns.SecureConfirmed.prototype.toggleSecure = function( useSecure ) {
		var self = this;
		self.isSecure = useSecure;
		toggleInputs( useSecure );
		toggleButtons( useSecure );
		moveValues( useSecure );
		moveTabIndex( useSecure );
			
		function toggleInputs( hidePlain ) {
			self.passSecure.classList.toggle( 'hidden', !hidePlain );
			self.confirmSecure.classList.toggle( 'hidden', !hidePlain );
			self.passPlain.classList.toggle( 'hidden', hidePlain );
			self.confirmPlain.classList.toggle( 'hidden', hidePlain );
		}
		
		function toggleButtons( hideSetPlain ) {
			self.setSecureBtn.classList.toggle( 'hidden', hideSetPlain );
			self.setPlainBtn.classList.toggle( 'hidden', !hideSetPlain );
		}
		
		function moveValues( toSecure ) {
			if ( toSecure ) {
				self.passSecure.value = self.passPlain.value;
				self.passPlain.value = '';
				self.confirmSecure.value = self.confirmPlain.value;
				self.confirmPlain.value = '';
			} else {
				self.passPlain.value = self.passSecure.value;
				self.passSecure.value = '';
				self.confirmPlain.value = self.confirmSecure.value;
				self.confirmSecure.value = '';
			}
		}
		
		function moveTabIndex( toSecure ) {
			if ( toSecure ) {
				self.passSecure.tabIndex = self.passPlain.tabIndex;
				self.passPlain.tabIndex = 0;
				self.confirmSecure.tabIndex = self.confirmPlain.tabIndex;
				self.confirmPlain.tabIndex = 0;
			} else {
				self.passPlain.tabIndex = self.passSecure.tabIndex;
				self.passSecure.tabIndex = 0;
				self.confirmPlain.tabIndex = self.confirmSecure.tabIndex;
				self.confirmSecure.tabIndex = 0;
			}
		}
	}
	
	ns.SecureConfirmed.prototype.setValue = function( value ) {
		var self = this;
		if ( !value || !value.trim )
			return;
		
		value = value.trim();
		
		if ( self.isSecure ) {
			self.passSecure.value = value;
			self.confirmSecure.value = value;
		} else {
			self.passPlain.value = value;
			self.confirmPlain.value = value;
		}
		
		self.updateStrength();
	}
	
	ns.SecureConfirmed.prototype.getValue = function() {
		var self = this;
		if ( !self.valid ) {
			return '';
		}
		
		if ( self.isSecure )
			return self.passSecure.value.trim();
		else
			return self.passPlain.value.trim();
	}
	
	ns.SecureConfirmed.prototype.checkIsConfirmed = function() {
		var self = this;
		var pS = self.passSecure.value.trim();
		var cS = self.confirmSecure.value.trim();
		var pP = self.passPlain.value.trim();
		var cP = self.confirmPlain.value.trim();
		
		if ( self.isSecure ) {
			return !!(( pS === cS ) && !!pS.length );
		}
		else {
			return !!(( pP === cP ) && !!pP.length );
		}
	}
	
})( library.view );


// BaseFormView
// anything operating on, but not limited to, self.inputMap
// will probably fail horribly with more complex forms,
// so provide your own implementation where you feel it is necessary
( function( ns, undefined ) {
	ns.BaseFormView = function() {
		if ( !( this instanceof ns.BaseFormView ))
			return new ns.BaseFormView();
		
		var self = this;
		self.inputMap = null;
		self.baseFormViewInit();
	}
	
	ns.BaseFormView.prototype.baseFormViewInit = function() {
		var self = this;
		self.view = window.View;
		self.setTemplate();
		self.buildView();
		self.bindView();
		self.bindEvents();
		
		self.view.sendMessage({ type : 'loaded' });
	}
	
	ns.BaseFormView.prototype.setTemplate = function() {
		var self = this;
		hello.template = new friendUP.gui.TemplateManager();
		const frags = document.getElementById( 'fragments' );
		var fragStr = frags.innerHTML;
		fragStr = View.i18nReplaceInString( fragStr );
		hello.template.addFragments( fragStr );
	}
	
	ns.BaseFormView.prototype.buildView = function() {
		const self = this;
		console.log( 'buildView', self.tmplId );
		const el = hello.template.getElement( self.tmplId, {} );
		console.log( 'el', el );
		document.body.appendChild( el );
	}
	
	ns.BaseFormView.prototype.bindView = function() {
		var self = this;
		self.view.on( 'initialize', initialize );
		self.view.on( 'error', error );
		self.view.on( 'success', success );
		
		function initialize( msg ) { self.initialize( msg ); }
		function error( msg ) { self.handleError( msg ); }
		function success( msg ) { self.handleSuccess( msg ); }
	}
	
	ns.BaseFormView.prototype.initialize = function( data ) {
		var self = this;
		if ( !data.inputMap ) {
			console.log( 'view.BaseFormView.initialize.data', data );
			throw new Error( 'view.BaseFormView.initialize - no inputMap in data' );
		}
		
		self.inputMap = data.inputMap;
		self.setInputValues();
		
		if ( data.fragments ) {
			
			hello.template.addFragments( data.fragments );
			self.overlay = new library.component.FormOverlay();
		}
		
		self.view.sendMessage({
			type : 'ready'
		});
	}
	
	ns.BaseFormView.prototype.handleError = function( error ) {
		var self = this;
		self.overlay.error( error.message, clickBack );
		
		function clickBack() { self.doErrorThings(); }
	}
	
	ns.BaseFormView.prototype.handleSuccess = function( success ) {
		var self = this;
		if ( success )
			var msg = success.message || 'success!';
		
		self.overlay.success( msg, clickBack );
		
		function clickBack() { self.doSuccessThings(); }
	}
	
	ns.BaseFormView.prototype.doErrorThings = function() {
		var self = this;
		console.log( 'view.BaseFormView.doErrorThings' );
		// TODO : a bunch of stuff
	}
	
	ns.BaseFormView.prototype.doSuccessThings = function() {
		var self = this;
		console.log( 'view.BaseFormView.doSuccessThings - calling close' );
		// call close on success confrimation. override this function to get specialised behavior
		self.view.sendMessage({
			type : 'exit',
		});
	}
	
	ns.BaseFormView.prototype.bindEvents = function() {
		var self = this;
		var form = document.getElementById( 'form' );
		var resetButton = document.getElementById( 'reset' );
		
		form.addEventListener( 'submit', submit, false );
		resetButton.addEventListener( 'click', reset, false );
		
		function submit( e ) { self.submit( e ); }
		function reset( e ) { self.reset( e ); }
	}
	
	ns.BaseFormView.prototype.submit = function( e ) {
		var self = this;
		e.preventDefault();
		e.stopPropagation();
		
		self.overlay.show();
		var input = self.collectInput();
		
		if ( !input )
			return; // remember to show a error message, on the overlay, in collectInput
		
		self.view.sendMessage({
			type : 'submit',
			data : input
		});
	}
	
	ns.BaseFormView.prototype.collectInput = function() {
		var self = this;
		
		// Reference implementation - build your own for more complex forms
		
		// Error checking on client? no thanks! ( TODO )
		
		var inputIds = Object.keys( self.inputMap );
		var formData = {};
		inputIds.forEach( readValue );
		function readValue( inputId ) {
			var input = document.getElementById( inputId );
			formData[ inputId ] = input.value;
		};
		
		return formData;
	}
	
	ns.BaseFormView.prototype.setInputValues = function() {
		var self = this;
		
		// Reference implementation - build your own for more complex forms
		
		var inputIds = Object.keys( self.inputMap );
		inputIds.forEach( setValue );
		function setValue( inputId ) {
			self.setInputText( inputId );
		}
	}
	
	ns.BaseFormView.prototype.setSelectOptions = function( id ) {
		var self = this;
		var select = document.getElementById( id );
		select.innerHTML = '';
		var valueMap = self.inputMap[ id ];
		var ids = Object.keys( valueMap );
		ids.forEach( add );
		function add( moduleId, index ) {
			var displayValue = valueMap[ moduleId ];
			var option = document.createElement( 'option' );
			
			if ( !index ) // by convention, the first index, 0, is the default option
				option.defaultSelected = true;
			
			option.value = moduleId;
			option.id = moduleId;
			option.innerHTML = displayValue;
			select.appendChild( option );
		}
	}
	
	ns.BaseFormView.prototype.setInputText = function( id ) {
		var self = this
		var value = self.inputMap[ id ] || '';
		var input = document.getElementById( id );
		input.value = value;
	}
	
	ns.BaseFormView.prototype.reset = function( e ) {
		var self = this;
		if ( e ) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		self.setInputValues();
	}
	
})( library.view );
