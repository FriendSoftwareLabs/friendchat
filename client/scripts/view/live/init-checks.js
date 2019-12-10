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

library.rtc = library.rtc || {};

// Initchecks
(function( ns, undefined ) {
	ns.InitChecks = function( statusMsg ) {
		const self = this;
		library.component.EventEmitter.call( self );
		
		self.ui = statusMsg;
		
		self.hasError = false;
		self.canContinue = true;
		self.checksDone = null;
		
		self.init();
	}
	
	ns.InitChecks.prototype =
		Object.create( library.component.EventEmitter.prototype );
	
	// Public
	
	ns.InitChecks.prototype.checkBrowser = function( userAgent, callback ) {
		const self = this;
		const type = 'browser-check';
		self.startingCheck( type );
		if ( !userAgent )
			userAgent = navigator.userAgent;
		
		new library.rtc.BrowserCheck( userAgent, checkBack );
		function checkBack( res ) {
			if ( 'success' == res.type ) {
				callback( null, res.browser );
				done();
			} else {
				self.ui.updateBrowserCheck( res );
				self.ui.once( type, uiClick );
				checkErrors( res );
			}
			
			function checkErrors( res ) {
				console.log( 'checkErrors', res );
				isCrit = false;
				if ( 'error' === res.type )
					isCrit = true;
				
				self.setHasError( isCrit );
				callback( isCrit, res.browser );
			}
			
			function uiClick( type ) {
				if ( 'close-live' === type ) {
					self.done( true );
					return;
				}
				
				done();
			}
			
			function done() {
				self.setCheckDone( type );
			}
		}
	}
	
	ns.InitChecks.prototype.checkSignal = function( conn, type ) {
		const self = this;
		if ( 'host' === type )
			self.ui.showHostSignal();
		
		var type = type + '-signal';
		self.startingCheck( type );
		var uptd = {
			desc : conn.url,
		};
		updateUi( uptd );
		var localState = {
			open : conn.onopen,
			close : conn.onclose,
		};
		conn.onopen = onopen;
		conn.onclose = onclose;
		localState.checkTimeout = window.setTimeout( resultTimeout, 20000 );
		
		function onopen() {
			restoreHandlers();
			cancelResultTimeout();
						
			var success = {
				type : 'success',
				message : '',
			};
			updateUi( success );
			self.setCheckDone( type );
			conn.onopen.apply( this, arguments );
		}
		
		function onclose( errMsg ) {
			errMsg = errMsg || 'connection error';
			restoreHandlers();
			cancelResultTimeout();
			
			var err = {
				type : 'error',
				message : errMsg,
			}
			updateUi( err );
			self.setHasError( true );
			self.setCheckDone( type );
			conn.onclose.apply( this, arguments );
		}
		
		function resultTimeout() {
			localState.checkTimeout = null;
			conn.close();
			onclose( 'connection timeout' );
		}
		
		function cancelResultTimeout() {
			if ( !localState.checkTimeout ) {
				console.log( 'no localState.checkTimeout?????', localState );
				return;
			}
			
			window.clearTimeout( localState.checkTimeout );
			localState.checkTimeout = null;
		}
		
		function restoreHandlers() {
			if ( !localState.open )
				return;
			
			conn.onopen = localState.open;
			conn.onclose = localState.close;
			
			delete localState.open;
			delete localState.close;
		}
		
		function updateUi( uptd ) {
			if ( 'host-signal' === type )
				self.ui.updateHostSignal(  uptd );
			if ( 'room-signal' === type )
				self.ui.updateRoomSignal( uptd );
		}
	}
	
	ns.InitChecks.prototype.checkICE = function( conf ) {
		const self = this;
		const checkId = 'ice-servers-check';
		self.startingCheck( checkId, conf );
		let hasTURN = false;
		let TURNPass = false;
		const errors = [];
		//conf.forEach( addToView );
		new library.rtc.ICECheck( conf, stepBack, doneBack );
		
		/*
		function addToView( server ) {
			const state = {
				type : 'add',
				server : server,
			};
			self.ui.updateICEServers( state );
		}
		*/
		
		function stepBack( result ) {
			const isTURN = checkIsTURN( result.server );
			if ( TURNPass )
				return;
			
			if ( isTURN )
				hasTURN = true;
			
			if ( isTURN && !result.err  )
				TURNPass = true;
			
			if ( !result.err )
				return;
			
			errors.push( result );
			
			function checkIsTURN( server ) {
				const url = server.urls[ 0 ];
				const match = url.match( /^turn:/);
				return !!match;
			}
		}
		
		function doneBack() {
			if ( hasTURN && !TURNPass ) {
				showStatus( 'error', 'ERR_NO_TURN' );
				return;
			}
			
			if ( !hasTURN && errors.length ) {
				showStatus( 'warning', 'WARN_STUN_ERRORS' );
				return;
			}
			
			self.setCheckDone( checkId );
		}
		
		function showStatus( type, errCode ) {
			const state = {
				type    : type,
				message : errCode,
				errors  : errors,
			};
			self.ui.updateICEServers( state );
			self.ui.once( checkId, uiBack );
			self.setHasError();
		}
		
		function uiBack( event ) {
			if ( 'close-live' === event )
				self.done( true );
			
			self.setCheckDone( checkId );
		}
	}
	
	ns.InitChecks.prototype.checkAudioInput = function( mediaStream, preferedDevices ) {
		const self = this;
		const checkId = 'audio-input-check';
		self.startingCheck( checkId );
		self.ui.once( checkId, uiClick );
		const tracks = mediaStream.getAudioTracks();
		if ( !tracks.length ) {
			setError( 'ERR_NO_DEVICES_FOUND' );
			return;
		}
		
		new library.rtc.AudioInputDetect( mediaStream )
			.then( checkBack )
			.catch( checkErr );
		
		let warnSet = false;
		let warnTimeout = window.setTimeout( warn, 2000 );
		
		function warn() {
			if ( null == warnTimeout )
				return;
			
			warnSet = true;
			const state = {
				type    : 'warning',
				message : 'WARN_NO_AUDIO',
			};
			self.ui.updateAudioInput( state );
		}
		
		function checkBack( hasInput ) {
			console.log( 'checkBack', hasInput );
			if ( null != warnTimeout )
				window.clearTimeout( warnTimeout );
			
			if ( !hasInput )
				setError( 'ERR_SYSTEM_MUTE' );
			else {
				if ( warnSet ) {
					const state = {
						type    : 'success',
						message : 'SUCC_ITS_FINE',
					};
					self.ui.updateAudioInput( state );
				} else
					done();
			}
		}
		
		function checkErr( err ) {
			console.log( 'checkAudioDevice checkErr', err );
			setError( err );
		}
		
		function setError( err ) {
			const state = {
				type    : 'error',
				message : err,
			};
			self.ui.updateAudioInput( state );
			self.setHasError();
		}
		
		function uiClick( type ) {
			if ( 'close-live' === type ) {
				self.done( true );
				return;
			}
			
			if ( 'source-select' === type ) {
				self.emit( 'source-select' );
			}
			
			done();
		}
		
		function done() {
			self.setCheckDone( checkId );
		}
	}
	
	ns.InitChecks.prototype.checkVideoInput = function( mediaStream, preferedDevices ) {
		const self = this;
		const checkId = 'video-input-check';
		self.setCheckDone( checkId );
	}
	
	ns.InitChecks.prototype.checkDeviceAccess = function( permissions ) {
		const self = this;
		const checkId = 'devices-check';
		self.startingCheck( checkId );
		return new Promise(( resolve, reject ) => {
			let devices = null;
			let access = null;
			getDevices()
				.then( devsBack )
				.catch( abortErr );
			
			function devsBack( devs ) {
				devices = devs;
				checkAccess( devices )
					.then( accessBack )
					.catch( abortErr );
			}
			
			function accessBack( access ) {
				access = access;
				if ( permissions.audio && !access.audio )
					permissions.audio = false;
				
				if ( permissions.video && !access.video )
					permissions.video = false;
				
				resolve( permissions, devices );
			}
			
			function abortErr( err ) {
				reject( err );
			}
		});
		
		function getDevices() {
			return new Promise(( resolve, reject ) => {
				const sources = new library.rtc.MediaDevices();
				sources.getByType()
					.then( resolve )
					.catch( error );
			});
			
			function error( err ) {
				console.log( 'checkDeviceAccess - getDevices - err', err );
				const error = {
					type    : 'error',
					message : 'ERR_ENUMERATE_DEVICES_FAILED',
				};
				reject( error );
			}
		}
		
		function checkAccess( devices ) {
			const access = {
				audio : permissions.audio,
				video : permissions.video,
			};
			const aDevs = devices.audioinput;
			const vDevs = devices.videoinput;
			const aKeys = Object.keys( aDevs );
			const vKeys = Object.keys( vDevs );
			return new Promise(( resolve, reject ) => {
				checkAvailable( aKeys, vKeys, access )
					.then( hasAvailable )
					.catch( reject );
				
				function hasAvailable( ava ) {
					if ( !ava.audio )
						access.audio = false;
					if ( !ava.video )
						access.video = false;
					
					if ( !access.audio && !access.video ) {
						resolve( access );
						return;
					}
					
					checkPermissions(
						aDevs[ aKeys[ 0 ]],
						vDevs[ vKeys[ 0 ]]
					)
						.then( hasPermissisons )
						.catch( reject );
				}
				
				function hasPermissisons( perms ) {
					if ( !perms.audio )
						access.audio = false;
					if ( !perms.video )
						access.video = false;
					
					resolve( access );
				}
				
			});
			
		}
		
		function checkAvailable( a, v, access ) {
			const available = {
				audio : access.audio,
				video : access.video,
			};
			return new Promise(( resolve, reject ) => {
				if ( access.video && !a.length && !v.length ) {
					showStatus( 'warning', 'WARN_NO_DEVICES' )
						.then( noDevsBack )
						.catch( reject );
					return;
				}
				
				if ( !a.length ) {
					showStatus( 'warning', 'WARN_NO_DEVICE_AUDIO' )
						.then( noAudioBack )
						.catch( reject );
						
					return;
				}
				
				if ( access.video && !v.length ) {
					showStatus( 'warning', 'WARN_NO_DEVICE_VIDEO' )
						.then( noVideoBack )
						.catch( reject );
					
					return;
				}
				
				resolve( available );
				
				function noDevsBack( event ) {
					available.audio = false;
					available.video = false;
					resolve( available );
				}
				
				function noAudioBack( event ) {
					available.audio = false;
					resolve( available );
				}
				
				function noVideoBack( event ) {
					available.video = false;
					resolve( available );
				}
			});
		}
		
		function checkPermissions( aDev, vDev ) {
			const perms = {
				audio : permissions.audio,
				video : permissions.video,
			};
			const blocked = {
				audio : undefined,
				video : undefined,
			};
			return new Promise(( resolve, reject ) => {
				askForDeviceAccess( perms )
					.then( askBack )
					.catch( askErr );
					
				function askBack( success ) {
					resolve( perms );
				}
				
				function askErr( err ) {
					console.log( 'check - askErr', err );
					// all asked for are blocked
					if ( 'NotAllowedError' === err ) {
						if ( permissions.audio ) {
							blocked.audio = true;
							perms.audio = false;
						}
						if ( permissions.video ) {
							blocked.video = true;
							perms.video = false;
						}
						
						done();
						return;
					}
					
					checkType( 'audio', aDev )
						.then( audioBack )
						.catch( audioBack );
				}
				
				function audioBack( err ) {
					perms.audio = !err;
					if ( 'NotAllowedError' === err )
						blocked.audio = true;
					
					if ( !perms.video )
						done();
					else
						checkType( 'video', vDev )
							.then( videoBack )
							.catch( videoBack );
				}
				
				function videoBack( err ) {
					perms.video = !err;
					if ( 'NotAllowedError' === err )
						blocked.video = true;
					
					done();
				}
				
				function done() {
					showBlockStatus( blocked );
					resolve( perms );
				}
			});
			
			function checkType( typeStr, typeDev ) {
				return new Promise(( resolve, reject ) => {
					if ( !permissions[ typeStr ] || !typeDev ) {
						reject( 'ERR_NOT_AVAILABLE' );
						return;
					}
					
					const perm = {};
					perm[ typeStr ] = true;
					askForDeviceAccess( perm )
						.then( askBack )
						.catch( askErr );
						
					function askBack() {
						resolve( null );
					}
					
					function askErr( err ) {
						const name = err.name;
						console.log( 'askErr', {
							err  : err,
							name : name,
						});
						/*
						let ERR = null;
						if ( 'NotFoundError' === name )
							ERR = 'WARN_GUM_BLOCKED';
						
						if ( 'NotAllowedError' === name ) {
							ERR = 'ERR_GUM_NOT_ALLOWED';
						
						if ( 'NoMediaError' === name )
							ERR = 'ERR_GUM_NO_MEDIA';
						
						*/
						reject( name || err );
					}
				});
			}
			
			function showBlockStatus( blocked ) {
				if ( !blocked.audio && !blocked.video )
					return;
				
				let ERR = null;
				if ( null == blocked.audio )
					ERR = 'INFO_GUM_BLOCKED_VIDEO';
				if ( null == blocked.video )
					ERR = 'INFO_GUM_BLOCKED_AUDIO';
				if ( blocked.audio && blocked.video )
					ERR = 'INFO_GUM_BLOCKED';
				
				const state = {
					type    : 'info',
					message : ERR,
					title   : 'access-blocked',
					events  : [ 'ok' ],
				};
				const id = self.ui.showStatus( state );
				const ui = self.ui;
				ui.once( id, infoBack );
				function infoBack( event ) {
					ui.removeStatus( id );
				}
			}
		}
		
		function checkBlocked( perm ) {
			
		}
		
		function showStatus( type, code ) {
			const state = {
				type    : type,
				message : code,
			};
			return new Promise(( resolve, reject ) => {
				self.ui.updateDevicesCheck( state );
				self.ui.once( checkId, statusBack );
				
				function statusBack( event ) {
					self.ui.removeStatus( checkId );
					if ( 'close-live' === event )
						reject( event );
					else
						resolve( event );
				}
			});
		}
		
		function check( devices ) {
			// user has unchecked both audio and video. usecase: screensharing
			if ( !permissions.audio && !permissions.video ) {
				done( permissions, devices );
				return;
			}
			
			const audioIds = Object.keys( devices.audioinput );
			const videoIds = Object.keys( devices.videoinput );
			let deviceErr = checkHasDevices( audioIds, videoIds );
			if ( deviceErr ) {
				error( deviceErr, permissions, devices );
				return;
			}
			
			let blockedErr = checkIsBlocked( audioIds, videoIds );
			if ( blockedErr ) {
				askForDeviceAccess( askBack );
				return;
			}
			
			done( permissions, devices );
			return;
			
			function askBack( err ) {
				if ( !err ) {
					getDevices( devicesBack );
					return;
				}
				
				let label = err.name;
				let ERR = 'ERR_GUM_' + label;
				if ( 'NotFoundError' === label )
					ERR = 'WARN_GUM_BLOCKED';
				
				if ( 'NotAllowedError' === label )
					ERR = 'ERR_GUM_NOT_ALLOWED';
				
				if ( 'NoMediaError' === label )
					ERR = 'ERR_GUM_NO_MEDIA';
				
				done( ERR, permissions, devices );
				
				function devicesBack( devices ) {
					done( permissions, devices );
				}
			}
			
			function checkHasDevices( a, v ) {
				const ERR_all = 'ERR_NO_DEVICES_FOUND';
				const ERR_audio = 'ERR_NO_MIC_FOUND';
				const ERR_video = 'ERR_NO_CAM_FOUND';
				if ( !a.length && !v.length )
					return ERR_all;
				
				if ( onlyAudio()) {
					if ( !a.length )
						return ERR_audio;
				}
				
				if ( onlyVideo()) {
					if ( !v.length )
						return ERR_video;
				}
				
				// has permissions for both ( default )
				// if theres no video device
				// fallback to one or the other
				if ( !v.length )
					permissions.video = false;
				
				if ( !a.length )
					permissions.audio = false;
				
				return null;
			}
			
			function checkIsBlocked( a, v ) {
				if ( 'DESKTOP' !== window.View.deviceType ) {
					console.log( "InitCheck device check - \
						checkIsBlocked - well, we're on mobile so who tf knowns v0v" );
					return null;
				}
				
				const aId = a[ 0 ];
				const vId = v[ 0 ];
				const aDev = devices.audioinput[ aId ];
				const vDev = devices.videoinput[ vId ];
				const ERR = 'ERR_DEVICES_BLOCKED';
				const ERR_dev = 'ERR_DEVICE_BLOCKED';
				const WARN_audio = 'WARN_AUDIO_BLOCKED';
				const WARN_video = 'WARN_VIDEO_BLOCKED';
				
				// if both are blocked, ask for device access ( probably first time use )
				if ( "" === aDev.label && "" === vDev.label )
					return ERR;
				
				if ( onlyAudio()) {
					if ( "" === aDev.label )
						return ERR_dev;
				}
				
				if ( onlyVideo()) {
					if ( "" === vDev.label )
						return ERR_dev;
				}
				
				if ( "" === aDev.label ) {
					//permissions.audio = false;
					return WARN_audio;
				}
				
				if ( "" === vDev.label ) {
					//permissions.video = false;
					return WARN_video;
				}
				
				return null;
			}
			
			function onlyAudio() {
				return !permissions.video && permissions.audio;
			}
			
			function onlyVideo() {
				return !permissions.audio && permissions.video;
			}
			
			
		} // check
		
		function askForDeviceAccess( perm ) {
			return new Promise(( resolve, reject ) => {
				window.navigator.mediaDevices.getUserMedia( perm )
					.then( gumBack )
					.catch( gumError );
					
				function gumBack( mediaStream ) {
					close ( mediaStream );
					resolve( true );
				}
				
				function gumError( err ) {
					const name = err.name;
					console.log( 'gumError', {
						err  : err,
						name : name,
					});
					reject( err );
				}
				
				function close( media ) {
					let tracks = media.getTracks();
					tracks.forEach( end );
					function end( track ) {
						media.removeTrack( track );
						track.stop();
					}
				}
			});
			
		} // askPermission
		
		function done( perms, devs ) {
			self.setCheckDone( checkId );
			resolve( perms, devs );
		}
		
		function error( err, perms, devs ) {
			console.trace( 'error', err );
			self.setHasError( true );
			const type = getType( err );
			const state = {
				type        : type,
				message     : err,
				permissions : perms,
				devices     : devs,
			};
			
			self.ui.updateDevicesCheck( state );
			self.ui.once( checkId, uiBack );
			
			function uiBack( event ) {
				self.setCheckDone( checkId );
				if ( 'close-live' === event ) {
					reject( err );
					self.done( true );
					return;
				}
				
				resolve( permissions, devices );
			}
			
			function getType( code ) {
				if ( !code || !code.length )
					return 'error';
				
				const pre = code.split( '_' )[ 0 ];
				if ( 'WARN' === pre )
					return 'warning';
				else
					return 'error';
			}
		}
	}
	
	ns.InitChecks.prototype.checkSourceReady = function( hasMedia, mediaErr ) {
		const self = this;
		const checkId = 'source-check';
		let ready = hasMedia;
		self.startingCheck( checkId );
		if ( ready ) {
			self.setCheckDone( checkId );
			return true;
		}
		
		const msg = 'ERR_SELF_NO_MEDIA';
		const state = {
			type    : 'error',
			message : msg,
		};
		
		if ( mediaErr ) {
			console.log( 'mediaErr', mediaErr );
			state.message = 'ERR_GUM_ERROR';
			try {
				state.err = JSON.stringify( mediaErr.err, null, 2 );
			} catch( e ) {
				state.err = mediaErr.err;
			}
			
			try {
				state.constraints = JSON.stringify( mediaErr.constraints, null, 2 );
			} catch( e ) {
				state.constraints = '';
			}
		}
		
		self.ui.updateSelfieCheck( state );
		self.ui.once( checkId, uiBack );
		self.setHasError( true );
		
		function uiBack( type ) {
			if ( 'close-live' === type ) {
				self.done( true );
				return;
			}
			
			self.setCheckDone( checkId );
		}
		
		return false;
	}
	
	ns.InitChecks.prototype.passCheck = function( check ) {
		const self = this;
		if ( self.ui )
			self.ui.removeStatus( check );
		
		self.setCheckDone( check );
	}
	
	ns.InitChecks.prototype.close = function() {
		const self = this;
		self.isDone = true;
		
		removeChecks();
		
		delete self.view;
		delete self.ui;
		self.closeEventEmitter();
		
		function removeChecks() {
			if ( !self.ui )
				return;
			
			const checks = Object.keys( self.checksDone );
			checks.forEach( checkId => {
				self.ui.removeStatus( checkId )
				self.ui.release( checkId );
			});
		}
	}
	
	// Private
	
	ns.InitChecks.prototype.init = function() {
		const self = this;
		self.checksDone = {
			'source-check'      : false,
			'devices-check'     : false,
		};
		
		//self.ui.on( 'close', onclose );
		//self.ui.on( 'close-live', e => self.done( true ));
		//self.ui.on( 'continue', oncontinue );
		//self.ui.on( 'source-select', onsource );
		
		function onclose( statusId ) {
			self.passCheck( statusId );
		}
		
		function oncontinue() {
			self.done();
		}
		
		function onsource( checkId ) {
			if ( self.ui )
				self.ui.removeStatus( checkId );
			
			self.emit( 'source-select', checkId );
			self.passCheck( checkId );
		}
	}
	
	ns.InitChecks.prototype.setHasError = function( critical ) {
		const self = this;
		self.hasError = true;
		
		if ( critical  )
			self.canContinue = false;
		
	}
	
	ns.InitChecks.prototype.startingCheck = function( id ) {
		const self = this;
		self.checksDone[ id ] = false;
	}
	
	ns.InitChecks.prototype.setCheckDone = function( id ) {
		const self = this;
		if ( null == self.checksDone[ id ]) {
			console.log( 'setCheckDone - no check for', id );
			return;
		}
		
		self.checksDone[ id ] = true;
		if ( self.ui ) {
			self.ui.release( id );
			self.ui.removeStatus( id );
		}
		
		if ( !isDone() ) {
			console.log( 'not done yet', self.checksDone );
			return;
		}
		
		if ( self.hasError )
			return;
		
		self.done();
		
		function isDone() {
			var ids = Object.keys( self.checksDone );
			return ids.every( done );
			
			function done( id ) {
				return self.checksDone[ id ];
			}
		}
	}
	
	ns.InitChecks.prototype.done = function( forceClose ) {
		const self = this;
		self.emit( 'done', forceClose );
		//self.ondone( forceClose );
	}
	
})( library.rtc );

// ICECheck
(function( ns, undefined ) {
	ns.ICECheck = function( conf, stepBack, doneBack ) {
		if ( !( this instanceof ns.ICECheck ))
			return new ns.ICECheck( conf );
		
		const self = this;
		self.conf = conf;
		self.stepBack = stepBack;
		self.doneBack = doneBack;
		
		self.timeoutMS = 1000 * 20; // 20 sec
		
		self.init();
	}
	
	ns.ICECheck.prototype.init = function() {
		const self = this;
		self.checks = 0;
		self.turnSuccess = false;
		self.conf.forEach( check );
		
		function check( server ) {
			self.checkServer( server, checkBack );
			function checkBack( res ) {
				if ( res && res.ret )
					return;
				
				self.checks++;
				var err = res.err;
				var ret = {
					err : err || null,
					server : server,
				};
				
				if ( self.stepBack )
					self.stepBack( ret );
				
				if ( 'turn' === res.srv )
					self.turnSuccess = true;
				
				checkDone();
			}
		}
		
		function checkDone() {
			if ( self.isDone )
				return;
			
			if ( self.checks === self.conf.length || self.turnSuccess )
				self.done();
		}
	}
	
	ns.ICECheck.prototype.checkServer = function( server, checkBack ) {
		const self = this;
		if ( !server || !server.urls || !server.urls[ 0 ] ) {
			console.log( 'ICECheck - checkServer, not a thing', server );
			checkBack({
				err : 'ERR_INVALID_SERVER',
			});
			return;
		}
		
		let host = server.urls[ 0 ];
		let match = host.match( /^(stun|turn):/i );
		if ( !match ) {
			console.log( 'ICECheck - checkServer, invalid host string', host );
			checkBack({
				err : 'ERR_INVALID_HOST_STRING',
			});
			return;
		}
		
		const srvType = match[ 1 ];
		var conf = {
			iceServers : [ server ],
		};
		new window.Promise( checkTheICE )
			.then( result )
			.catch( result );
		
		function checkTheICE( resolve, reject ) {
			var returned = false;
			var timeout = window.setTimeout( checkTimedOut, self.timeoutMS );
			window.rtcConf = conf;
			var test = new window.RTCPeerConnection( conf );
			test.onicecandidate = onICE;
			test.createDataChannel( 'test' );
			test.createOffer()
				.then( offerCreated )
				.catch( offerFailed );
			
			function offerCreated( offer ) {
				test.setLocalDescription( offer );
			}
			
			function offerFailed( err ) {
				error( 'offer failed' );
			}
			
			function onICE( e ) {
				if ( !e.candidate || !e.candidate.candidate )
					return;
				
				let sdp = e.candidate.candidate;
				let tm = sdp.match( /typ\s([a-z]+)\s/i );
				if ( !tm )
					return;
				
				let typ = tm[ 1 ];
				
				// 'typ host' is localhost
				if ( 'host' === typ )
					return;
				
				if (( 'turn' === srvType ) && ( 'relay' !== typ ))
					return;
				
				if ( 'stun' === srvType && 'srflx' !== typ )
					return;
				
				success( srvType );
			}
			
			function checkTimedOut() {
				error( 'ERR_HOST_TIMEOUT' );
			}
			
			function success( srvType ) {
				var res = {
					ret  : returned,
					err  : null,
					srv : srvType,
				};
				resolve( res );
				clear();
			}
			
			function error( err ) {
				var res = {
					ret : returned,
					err : err,
				};
				reject( res );
				clear();
			}
			
			function clear() {
				returned = true;
				try {
					test.close();
				} catch( e ) {
					console.log( 'test.close exep', e );
				}
				if ( timeout )
					window.clearTimeout( timeout );
				timeout = null;
			}
		}
		
		function result( res ) { checkBack( res ); }
		//function pass( res ) { checkBack( res ); }
		//function fail( res ) { checkBack( res ); }
	}
	
	ns.ICECheck.prototype.done = function() {
		const self = this;
		var doneBack = self.doneBack;
		self.isDone = true;
		delete self.conf;
		delete self.stepBack;
		delete self.doneBack;
		doneBack();
	}
	
})( library.rtc );

// Browser check
(function( ns, undefined ) {
	ns.BrowserCheck = function( userAgent, onResult ) {
		if ( !( this instanceof ns.BrowserCheck ))
			return new ns.BrowserCheck();
		
		const self = this;
		self.userAgent = userAgent || window.navigator.userAgent;
		self.onresult = onResult;
		self.isSecure = false;
		self.browser = null;
		self.version = null;
		self.isMobile = false;
		self.isVR = false;
		self.is = {};
		self.capabilities = {
			webRTC   : null,
			audioAPI : null,
		};
		self.init();
	}
	
	// Public
	
	// Private
	
	ns.BrowserCheck.prototype.supportMap = {
		'ie'      : 'error',
		'edge'    : 'error',
		'opera'   : 'warning',
		'safari'  : 'success',
		'firefox' : 'success',
		'chrome'  : 'success',
		'brave'   : 'success',
		'blink'   : 'success',
		'samsung' : 'success',
		'android' : 'warning',
		'iphone'  : 'warning',
		'unknown' : 'warning',
	}
	
	ns.BrowserCheck.prototype.supportString = {
		'error'   : 'ERR_NO_SUPPORT',
		'warning' : 'WARN_EXPERIMENTAL_SUPPORT',
		'success' : 'SUCC_FULL_SUPPORT',
	}
	
	ns.BrowserCheck.prototype.init = function() {
		const self = this;
		self.checkSecure();
		self.checkMobile();
		if ( self.isMobile )
			self.mangleMobile();
		else
			self.identifyDesktopBrowser();
		
		self.checkVR();
		self.checkCapabilities();
		self.done();
	}
	
	ns.BrowserCheck.prototype.mangleMobile = function() {
		const self = this;
		var uaId = self.getApprovedUAId();
		if ( uaId )
			self.is[ uaId ] = true;
		else
			self.is[ self.isMobile ] = true;
	}
	
	ns.BrowserCheck.prototype.identifyDesktopBrowser = function() {
		const self = this;
		let is = self.is || {};
		// IE
		is[ 'ie' ] = !!document.documentMode; // old ie
		is[ 'edge' ] = !is[ 'ie ' ] && !!window.StyleMedia; // new ie. They both fail, lol
		
		// OPERA
		is[ 'opera' ] = ( !!window.opr && !!window.opr.addons )
			|| window.opera
			|| self.userAgent.indexOf( ' OPR/' ) >= 0;
		
		// SAFARI
		is[ 'safari' ] = /constructor/i.test(window.HTMLElement) 
			|| (function (p)
				{ return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] 
				|| (typeof safari !== 'undefined' && safari.pushNotification)) 
			|| /^((?!chrome|android).)*safari/i.test( self.userAgent );
		
		// FIREFOX
		is[ 'firefox' ] = !!window.InstallTrigger;
		
		// CHROME
		is[ 'chrome' ] = !!window.chrome;
		is[ 'blink' ] = ( is[ 'chrome' ] || is[ 'opera' ] ) && !!window.CSS;
		
		// BRAVE
		//is[ 'brave' ] = ( is[ 'chrome' ] && self.userAgent.includes( 'Brave' ));
		is[ 'brave' ] = ( is[ 'chrome' ] && self.checkIsBrave() );
		/*
		if ( is[ 'blink' ]) {
			is[ 'chrome' ] = false;
			is[ 'opera' ] = false;
		}
		*/
		
		self.is = is;
	}
	
	ns.BrowserCheck.prototype.checkIsBrave = function() {
		const self = this;
		const test = document.createElement( 'iframe' );
		test.classList.toggle( 'hidden', true );
		document.body.appendChild( test );
		let isBrave = false;
		if ( test.contentWindow.google_onload_fired === true )
			isBrave = true;
		
		test.parentNode.removeChild( test );
		return isBrave;
	}
	
	ns.BrowserCheck.prototype.checkSecure = function() {
		const self = this;
		const url = window.document.URL;
		if ( !url )
			return;
		
		let isHttps = url.match( /^https/i );
		if ( isHttps )
			self.isSecure = true;
	}
	
	ns.BrowserCheck.prototype.checkCapabilities = function() {
		const self = this;
		const cap = {};
		cap[ 'webAudio' ] = !!window.AudioContext;
		cap[ 'webRTC' ] = !!window.RTCPeerConnection;
		cap[ 'mediaDevices' ] = !!window.navigator.mediaDevices;
		if ( cap[ 'mediaDevices' ]) {
			cap[ 'getUserMedia' ] = !!window.navigator.mediaDevices.getUserMedia;
			cap[ 'enumerateDevices' ] = !!window.navigator.mediaDevices.enumerateDevices;
		}
		
		self.cap = cap;
	}
	
	ns.BrowserCheck.prototype.checkMobile = function() {
		const self = this;
		const tokens = [
			'Android',
			'webOS',
			'iPhone',
			'iPad',
			'iPod',
			'BlackBerry',
			'IEMobile',
			'Opera Mini',
			'Mobile',
			'mobile',
			'CriOS',
		];
		const rxStr = tokens.join( '|' );
		const rx = new RegExp( rxStr, '' );
		const match = self.userAgent.match( rx );
		if ( match )
			self.isMobile = match[ 0 ];
		
		return self.isMobile;
	}
	
	ns.BrowserCheck.prototype.getApprovedUAId = function() {
		const self = this;
		var tokens = [
			'Chrome',
			'Samsung',
			'iPhone',
		];
		var rxStr = tokens.join( '|' );
		var rx = new RegExp( rxStr, 'i' );
		var match = self.userAgent.match( rx );
		if ( match )
			return match[ 0 ];
		
		return '';
	}
	
	ns.BrowserCheck.prototype.checkVR = function() {
		const self = this;
		var match = self.userAgent.match( /VR/ );
		if ( match )
			self.isVR = true;
	}
	
	ns.BrowserCheck.prototype.done = function() {
		const self = this;
		const checks = [];
		let browser = getBrowser();
		let supType = self.supportMap[ browser.toLowerCase() ] || 'error';
		
		if ( self.isMobile ) {
			browser += ' ' + self.isMobile;
		}
		
		if ( self.isVR ) {
			browser += ' VR';
			if ( 'success' === supType )
				supType = 'warning';
		}
		
		const supString = self.supportString[ supType ];
		const support = {
			id      : 'browser-support-check',
			type    : supType,
			message : supString,
			data    : browser,
		};
		checks.push( support );
		
		const secure = {
			id      : 'browser-secure-check',
			type    : self.isSecure ? 'success' : 'error',
			message : 'ERR_HTTPS_REQUIRED',
		};
		checks.push( secure );
		
		const allSupported = checkAllSupported( self.cap );
		const capas = {
			id      : 'browser-capabilities-check',
			type    : allSupported ? 'success' : 'error',
			message : 'ERR_DECREPIT_API',
			data    : self.cap,
		};
		checks.push( capas );
		const worst = getWorst( checks );
		const res = {
			type    : worst,
			browser : browser,
			data    : {},
		};
		checks.forEach( check => {
			res.data[ check.id ] = check;
		});
		
		const cb = self.onresult;
		self.close();
		cb( res );
		
		function getBrowser() {
			for ( var browser in self.is )
				if ( !!self.is[ browser ])
					return browser;
				
			return 'unknown';
		}
		
		function checkAllSupported( caps ) {
			const keys = Object.keys( caps );
			let fail = false;
			fail = keys.some( cap => {
				return !caps[ cap ];
			});
			return !fail;
		}
		
		function getWorst( checks ) {
			let worst = 'success';
			checks.some( check => {
				if ( 'error' === check.type ) {
					worst = 'error';
					return true;
				}
				
				if ( 'warning' === check.type )
					worst = 'warning';
				
				return false;
			});
			
			return worst;
		}
	}
	
	ns.BrowserCheck.prototype.close = function() {
		const self = this;
		delete self.onresult;
	}
	
	
})( library.rtc );
