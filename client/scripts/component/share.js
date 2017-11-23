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

library.component = library.component || {};

(function( ns, undefined ) {
	ns.ShareView = function( conf ) {
		if ( !( this instanceof ns.ShareView ))
			return new ns.ShareView( fupConf );
		
		const self = this;
		self.type = 'invite';
		self.pid = conf.parentId;
		self.parentConn = conf.conn;
		
		self.host = null;
		self.invites = {};
		
		self.init();
	}
	
	ns.ShareView.prototype.init = function() {
		var self = this;
		self.bindConn();
		self.bindEvents();
		self.send({ type : 'state' });
	}
	
	ns.ShareView.prototype.bindConn = function() {
		var self = this;
		self.conn = new library.component.EventNode( self.type, self.parentConn );
		self.conn.on( 'state', state );
		self.conn.on( 'private', priv );
		self.conn.on( 'public', pub );
		self.conn.on( 'revoke', revoke );
		self.conn.on( 'email', emailSent );
		
		function state( e ) { self.handleState( e ); }
		function priv( e ) { self.handlePrivate( e ); }
		function pub( e ) { self.handlePublic( e ); }
		function revoke( e ) { self.handleRevoke( e ); }
		function emailSent( e ) { self.confirmEmailSent( e ); }
	}
	
	ns.ShareView.prototype.bindEvents = function() {
		var self = this;
		self.inviteContainer = document.getElementById( 'share-invites' );
		self.inviteBtn = document.getElementById( 'share-add-invite' );
		
		self.pubContainer = document.getElementById( 'share-public' );
		self.pubInput = document.getElementById( 'share-public-input' );
		self.pubCopy = document.getElementById( 'share-public-to-clippy' );
		self.pubEmail = document.getElementById( 'share-public-to-email' );
		self.pubUnset = document.getElementById( 'share-unset-public');
		self.pubSet = document.getElementById( 'share-set-public' );
		
		self.emailInput = document.getElementById( 'share-email-input' );
		self.emailBtn = document.getElementById( 'share-email-btn' );
		
		self.inviteBtn.addEventListener( 'click', getInvite, false );
		
		self.pubSet.addEventListener( 'click', setPublic, false );
		self.pubUnset.addEventListener( 'click', revokePublic, false );
		self.pubCopy.addEventListener( 'click', copyPublic, false );
		self.pubEmail.addEventListener( 'click', createPublicEmail, false );
		
		self.emailBtn.addEventListener( 'click', getEmailLink, false );
		
		function getInvite( e ) {
			e.preventDefault();
			e.stopPropagation();
			self.requestInvite();
		}
		
		function setPublic( e ) {
			e.stopPropagation();
			self.setPublic();
		}
		
		function revokePublic( e ) {
			e.stopPropagation();
			self.revoke( 'public' );
		}
		
		function copyPublic( e ) {
			e.stopPropagation();
			self.copyToClipboard( self.publicToken );
		}
		
		function createPublicEmail( e ) {
			e.stopPropagation();
			self.createEmail( self.publicToken );
		}
		
		function getEmailLink( e ) {
			self.getEmailLink( e );
		}
	}
	
	ns.ShareView.prototype.handleRevoke = function( token ) {
		var self = this;
		if ( 'public' === token || self.publicToken === token )
			revokePublic();
		else
			revoke( token );
		
		function revoke( id ) {
			var invite = self.invites[ id ];
			if ( !invite ) {
				console.log( 'no invite found for', id );
				return;
			}
			
			if ( invite.input )
				invite.input.value = '< link used >';
			
			var element = document.getElementById( id );
			if ( !element )
				return;
			
			element.classList.toggle( 'invalid', true );
			setTimeout( remove, 1000 * 30 )
			function remove() {
				self.remove( id );
			}
		}
		
		function revokePublic() {
			self.handlePublic({
				data : null,
			});
		}
	}
	
	ns.ShareView.prototype.handlePrivate = function( invite ) {
		var self = this;
		self.invites[ invite.token ] = invite;
		build( invite );
		bind( invite );
		
		function build( invite ) {
			var conf = {
				id : invite.token,
				invite : invite.link,
			};
			var element = hello.template.getElement( 'viewpane-share-invite-tmpl', conf );
			self.inviteContainer.appendChild( element );
		}
		
		function bind( invite ) {
			var element = document.getElementById( invite.token );
			invite.input = element.querySelector( 'input' );
			var emailBtn = element.querySelector( '.create-email' );
			var copyBtn = element.querySelector( '.copy-to-clippy' );
			var removeBtn = element.querySelector( '.remove' );
			
			emailBtn.addEventListener( 'click', createEmail, false );
			copyBtn.addEventListener( 'click', copyToClippy, false );
			removeBtn.addEventListener( 'click', remove, false );
			
			function createEmail( e ) {
				e.preventDefault();
				e.stopPropagation();
				self.createEmail( invite.token );
			}
			
			function copyToClippy( e ) {
				e.preventDefault();
				e.stopPropagation();
				self.copyToClipboard( invite.token );
			}
			
			function remove( e ) {
				e.stopPropagation();
				e.preventDefault();
				self.remove( invite.token );
			}
		}
	}
	
	ns.ShareView.prototype.setPublic = function( bool ) {
		var self = this;
		var setPub = {
			type : 'public',
		};
		self.send( setPub );
	}
	
	ns.ShareView.prototype.handlePublic = function( data ) {
		var self = this;
		// clear styles
		if ( self.publicToken === self.copyId )
			self.clearCopy();
		
		self.pubContainer.classList.toggle( 'previously-copied', false );
		self.pubContainer.id = data.token;
		self.publicToken = data.token;
		var isPublic = !!data.token;
		var link = isPublic ? data.link : '';
		self.pubInput.value = link;
		self.pubContainer.classList.toggle( 'hidden', !isPublic );
		self.pubSet.classList.toggle( 'hidden', isPublic );
	}
	
	ns.ShareView.prototype.handleState = function( data ) {
		var self = this;
		self.host = data.host;
		data.privateTokens
			.forEach( add );
			
		if ( data.publicToken )
			self.handlePublic( data.publicToken );
			
		function add( invite ) {
			self.handlePrivate( invite );
		}
	}
	
	ns.ShareView.prototype.requestInvite = function( callback ) {
		var self = this;
		if ( callback )
			self.inviteIntercept = callback;
		
		var getInv = {
				type : 'private',
			};
		self.send( getInv );
	}
	
	ns.ShareView.prototype.getEmailLink = function() {
		var self = this;
		var email = self.emailInput.value;
		if ( !email )
			return;
		
		email = email.trim();
		if ( !email ) {
			self.emailInput.value = '';
			return;
		}
		
		self.toggleEmailSending( true );
		self.requestInvite( inviteBack );
		
		function inviteBack( e ) {
			self.sendEmailLink( email, e.str );
		}
	}
	
	ns.ShareView.prototype.sendEmailLink = function( email, link ) {
		var self = this;
		var msg = {
			type : 'email',
			data : {
				email : email,
				link, link,
			},
		};
		
		self.send( msg );
	}
	
	ns.ShareView.prototype.confirmEmailSent = function( success ) {
		var self = this;
		if ( !success )
			return;
		
		self.toggleEmailSending( false );
		self.emailInput.value = '';
	}
	
	ns.ShareView.prototype.toggleEmailSending = function( isWorking ) {
		var self = this;
		if ( !isWorking )
			isWorking = false;
		
		var icon = self.emailBtn.querySelector( 'i' );
		icon.classList.toggle( 'fa-paper-plane', !isWorking );
		icon.classList.toggle( 'fa-pulse', isWorking );
		icon.classList.toggle( 'fa-spinner', isWorking );
	}
	
	ns.ShareView.prototype.revoke = function( token ) {
		const self = this;
		const revoke = {
			type : 'revoke',
			data : token,
		};
		self.send( revoke );
	}
	
	ns.ShareView.prototype.remove = function( token ) {
		const self = this;
		var element = document.getElementById( token );
		if ( element )
			element.parentNode.removeChild( element );
		
		if ( token === self.copyId )
			self.copyId = null;
		
		delete self.invites[ token ];
		self.revoke( token );
	}
	
	ns.ShareView.prototype.copyToClipboard = function( id ) {
		var self = this;
		self.selectAll( id );
		try {
			var success = document.execCommand( 'copy' );
		} catch( e ) {
			console.log( 'failed to copy to clippy', e );
		}
		
		if ( !success ) {
			console.log( 'copyToClipboard - not success' );
			return;
		}
		
		self.clearCopy();
		self.setCopy( id );
	}
	
	ns.ShareView.prototype.createEmail = function( id ) {
		var self = this;
		var input = self.getInputById( id );
		if ( !input || !input.value || !input.value.length ) {
			console.log( 'createEmail - input has no content', { id : id, input : input });
			return;
		}
		
		var match = input.value.match( /http.*/ );
		if ( !match )
			return;
		
		var link = match[ 0 ];
		var enSubject =  window.encodeURIComponent( 'Friend Chat - join me live' );
		var enLink = window.encodeURIComponent( link );
		var href = 'mailto:'
			+ '?subject=' + enSubject
			+ '&body=' + enLink;
		var iframe = document.createElement( 'iframe' );
		iframe.classList.add( 'hidden' );
		document.body.appendChild( iframe );
		iframe.src = href;
		window.setTimeout( remove, 1000 );
		
		self.setEmail( id );
		
		function remove() {
			iframe.parentNode.removeChild( iframe );
		}
	}
	
	ns.ShareView.prototype.selectAll = function( id ) {
		var self = this;
		var input = self.getInputById( id );
		if ( !input || !input.value || !input.value.length ) {
			console.log( 'shareView.selectAll - invalid input id', {
				id : id,
				input : input,
				value : input.value,
			});
			return;
		}
		
		var strLen = input.value.length;
		input.focus();
		input.setSelectionRange( 0, strLen );
	}
	
	ns.ShareView.prototype.getInputById = function( id ) {
		var self = this;
		var container = document.getElementById( id );
		var input = container.querySelector( 'input' );
		return input;
	}
	
	ns.ShareView.prototype.setCopy = function( id ) {
		var self = this;
		var element = document.getElementById( id );
		if ( !element )
			return;
		
		element.classList.toggle( 'previously-copied', true );
		element.classList.toggle( 'on-clipboard', true );
		self.copyId = id;
	}
	
	ns.ShareView.prototype.setEmail = function( id ) {
		var self = this;
		var element = document.getElementById( id );
		if ( !element )
			return;
		
		element.classList.toggle( 'in-email', true );
	}
	
	ns.ShareView.prototype.clearCopy = function() {
		var self = this;
		if ( !self.copyId )
			return;
		
		var element = document.getElementById( self.copyId );
		if ( !element )
			return;
		
		element.classList.toggle( 'on-clipboard', false );
		self.copyId = null;
	}
	
	ns.ShareView.prototype.send = function( msg ) {
		var self = this;
		self.conn.send( msg );
	}
	
})( library.component );
