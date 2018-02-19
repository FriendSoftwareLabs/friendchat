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

// irc settings
(function( ns, undefined ) {
	ns.IRC = function( fupConf ) {
		if ( !( this instanceof ns.IRC ))
			return new ns.IRC( fupConf );
		
		if ( fupConf )
			console.log( 'settings.IRC - fupConf received, do something with?' );
		
		library.view.Settings.call( this );
	}
	
	ns.IRC.prototype = Object.create( library.view.Settings.prototype );
	
	ns.IRC.prototype.setup = function() {
		var self = this;
		self.validKeys = [
			'host',
			'port',
			'displayName',
			'login',
			'password',
			'connect',
			'nick',
			'awayNick',
			'autoAway',
			'autoBack',
			'perform',
			'join',
			//'msgAlert',
			'ircTheme',
		];
		self.displayOrder = self.validKeys;
		self.labelMap = {
			host        : View.i18n( 'i18n_host' ),
			displayName : View.i18n( 'i18n_server_name' ),
			login       : View.i18n( 'i18n_server_login' ),
			password    : View.i18n( 'i18n_server_pass' ),
			nick        : View.i18n( 'i18n_nick' ),
			awayNick    : View.i18n( 'i18n_away_nick' ),
			autoAway    : View.i18n( 'i18n_auto_away' ),
			autoBack    : View.i18n( 'i18n_auto_back' ),
			perform     : View.i18n( 'i18n_perform' ),
			connect     : View.i18n( 'i18n_on_startup' ),
			autoconnect : View.i18n( 'i18n_auto_connect' ),
			tls         : View.i18n( 'i18n_require_encryption' ),
			sasl        : View.i18n( 'i18n_use_sasl' ),
			doPerform   : View.i18n( 'i18n_send_perform_on' ),
			rainbow     : View.i18n( 'i18n_use_rainbow' ),
			kitties     : View.i18n( 'i18n_use_script_kitties' ),
			autojoin    : View.i18n( 'i18n_autojoin_channels' ),
			autoshow    : View.i18n( 'i18n_show_channel_on_join' ),
			join        : View.i18n( 'i18n_channels' ),
			ircTheme    : View.i18n( 'i18n_irc_theme_file' ),
			msgAlert    : View.i18n( 'i18n_message_alert' ),
		};
		
		self.buildMap = {
			host        : host,
			displayName : textInput,
			login       : textInput,
			password    : secureInput,
			connect     : checkbox,
			nick        : textInput,
			awayNick    : textInput,
			autoAway    : numberInput,
			autoBack    : checkbox,
			perform     : textInput,
			join        : join,
			msgAlert    : singleCheck,
			ircTheme    : fileSelect,
		};
		
		function host() { self.setHost(); }
		function join() { self.setJoin(); }
		function textInput( setting ) { self.setTextInput( setting ); }
		function numberInput( setting ) { self.setNumberInput( setting ); }
		function secureInput( setting ) { self.setSecureInput( setting ); }
		function checkbox( setting ) { self.setCheckbox( setting ); }
		function singleCheck( setting ) { self.singleCheck( setting ); }
		function textarea( setting ) { self.setTextarea( setting ); }
		function fileSelect( setting ) { self.setFileSelect( setting ); }
	}
	
	ns.IRC.prototype.setHost = function() {
		var self = this;
		var hostStatus = hello.template.get( 'settings-status-tmpl', { setting : 'host' });
		var portStatus = hello.template.get( 'settings-status-tmpl', { setting : 'port' });
		var conf = {
			label      : self.labelMap[ 'host' ],
			host       : self.settings.host,
			port       : self.settings.port,
			hostStatus : hostStatus,
			portStatus : portStatus,
		};
		
		build();
		bind();
		
		function build() {
			var element = hello.template.getElement( 'host-tmpl', conf );
			self.container.appendChild( element );
		}
		
		function bind() {
			var hostForm = document.getElementById( 'hostform' );
			var host = document.getElementById( 'host' );
			var port = document.getElementById( 'port' );
			hostForm.addEventListener( 'submit', submit, false );
			
			host.addEventListener( 'blur', hostBlur, false );
			port.addEventListener( 'blur', portBlur, false );
			
			host.addEventListener( 'keyup', bufferHost, false );
			port.addEventListener( 'keyup', bufferPort, false );
			
			self.updateMap[ 'host' ] = updateHostInput;
			self.updateMap[ 'port' ] = updatePortInput;
			function updateHostInput( value ) { host.value = value; }
			function updatePortInput( value ) { port.value = value; }
			
			function submit( e ) {
				e.preventDefault();
				var newHost  = cleanHost( host.value );
				var newPort = cleanPort( port.value );
				self.save( 'host', newHost );
				self.save( 'port', newPort );
			}
			
			function hostBlur( e ) { self.save( 'host', cleanHost( host.value ) ); }
			function portBlur( e ) { self.save( 'port', cleanPort( port.value ) ); }
			
			function bufferHost( e ) {
				if ( self.keyIsSubmit( e ))
					return;
				
				var tmpHost = cleanHost( host.value );
				self.buffer( 'host', tmpHost );
			}
			
			function bufferPort( e ) {
				if ( self.keyIsSubmit( e ))
					return;
				
				var tmpPort = cleanPort( port.value );
				self.buffer( 'port', tmpPort  );
			}
			
			function cleanHost( value ) { return String( value ).trim(); }
			function cleanPort( value ) { return parseInt( value ); }
		}
	}
	
	ns.IRC.prototype.setJoin = function() {
		var self = this;
		self.settings.join = self.settings.join || [];
		var join = {
			element : null,
			container : null,
			idMap : {},
		};
		
		buildContainer();
		bindContainer();
		
		join.addChannel = function( name ) {
			setIdMap( name );
			var chElement = buildChannel( name );
			join.container.appendChild( chElement );
			
			bindChannel( name );
		}
		
		join.removeChannel = function( name ) {
			var chId = join.idMap[ name ];
			removeFromData();
			removeFromView();
			unsetIdMap( name );
			
			function removeFromData() { delete join.idMap[ name ]; }
			function removeFromView() {
				var ele = document.getElementById( chId );
				ele.parentNode.removeChild( ele );
			}
		}
		
		join.saveWithout = function( name ) {
			var channels = self.settings.join.filter( without );
			self.save( 'join', channels );
			self.settings.join = channels;
			
			function without( channel ) { return channel != name; }
		}
		
		self.updateMap[ 'join' ] = updateJoin;
		function updateJoin( update ) {
			console.log( 'join.update', update );
			var joined = update.filter( notInSettings );
			var left = self.settings.join.filter( notInUpdate );
			
			console.log( 'joined', joined );
			console.log( 'left', left );
			
			joined.forEach( add );
			function add( name ) { join.addChannel( name ); }
			left.forEach( remove );
			function remove( name ) { join.removeChannel( name ); }
			
			function notInSettings( name ) {
				var index  = self.settings.join.indexOf( name );
				return !!( index == -1 );
			}
			
			function notInUpdate( name ) {
				var index = update.indexOf( name );
				return !!( index == -1 );
			}
		}
		
		self.settings.join.forEach( addCh );
		function addCh( name ) {
			join.addChannel( name );
		}
		
		function setIdMap( channel ) { join.idMap[ channel ] = 'join-channel-' + channel; }
		function unsetIdMap( channel ) { delete join.idMap[ channel ]; }
		
		function buildContainer() {
			var status = hello.template.get( 'settings-status-tmpl', { setting : 'join' });
			join.element = hello.template.getElement( 'join-tmpl', {
				label : self.labelMap[ 'join' ],
				status : status,
			});
			self.container.appendChild( join.element );
			join.container = join.element.querySelector( '.join-channels' );
		}
		
		function buildChannel( name ) {
			var id = join.idMap[ name ];
			var conf = {
				id : id,
				name : name,
			};
			return hello.template.getElement( 'join-channel-tmpl', conf );
		}
		
		function bindChannel( name ) {
			var channelId = join.idMap[ name ];
			var chElement = document.getElementById( channelId );
			var removeBtn = chElement.querySelector( '.remove-channel .button' );
			removeBtn.addEventListener( 'click', removeChannel, false );
			
			function removeChannel( e ) {
				e.preventDefault();
				join.saveWithout( name );
				join.removeChannel( name );
			}
		}
		
		function bindContainer() {
			var addCh = join.element.querySelector( '.input .add-channel' );
			var addBtn = addCh.querySelector( '.button' );
			var addForm = addCh.querySelector( '.add-channel-form' );
			var addFormInput = addForm.querySelector( 'input' );
			addBtn.addEventListener( 'click', addBtnClick, false );
			addForm.addEventListener( 'submit', addChannelSubmit, false );
			addFormInput.addEventListener( 'blur', addInputBlur, false );
			
			function addBtnClick( e ) {
				e.preventDefault();
				e.stopPropagation();
				toggleForm( true );
				addFormInput.focus();
			}
			
			function addChannelSubmit( e ) {
				e.preventDefault();
				var raw = addFormInput.value;
				clearInput();
				
				if ( !raw ) {
					toggleForm( false );
					return;
				}
				
				var name = fixName( raw ); // '#', '&' and whitespace
				if ( alreadySet( name )) // should # and & be considered the same channel?
					return;
				
				var channels = getCurrentChannels();
				channels.push( name );
				self.save( 'join', channels );
				//join.addChannel( name );
				
				function fixName( string ) {
					string = string.trim();
					var firstChar = string[ 0 ];
					if ( firstChar === '#' || firstChar === '&' )
						return string;
					
					return '#' + string;
				}
				
				function alreadySet( channel ) {
					var index = self.settings.join.indexOf( channel );
					if ( index === -1 )
						return false;
					return true;
				}
				
				function clearInput() {
					addFormInput.value = '';
					addFormInput.focus();
				}
				
				function getCurrentChannels() {
					var chanString = friendUP.tool.stringify( self.settings.join );
					return friendUP.tool.objectify( chanString );
				}
			}
			
			function addInputBlur( e ) {
				toggleForm( false );
			}
			
			function toggleForm( setVisible ) {
				addBtn.classList.toggle( 'hidden', setVisible );
				addForm.classList.toggle( 'hidden', !setVisible );
			}
		}
	}
	
})( library.view );

window.View.run = walk;
function walk( fupConf ) {
	window.settings = new library.view.IRC( fupConf );
}