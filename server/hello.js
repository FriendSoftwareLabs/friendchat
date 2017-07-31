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

const fs = require( 'fs' );
const fork = require( 'child_process' ).fork;
var log = require( './component/Log' )( 'main' );
var TLSWatch = require( './component/TLSWatch' );
var WSS = require( './component/WebSocketServer' );
var doGcLogging = false;

if ( doGcLogging )
	registerForGCEvents();

var conf = require( './component/Config' ); // not really bothering with saving the obj,
                                            // it writes itself to global.config

// DISABLES TLS CERT/CA CHECKS - DEV ONLY, FUCKO
if ( conf.server.dev )
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//application state
var state = {
	account : {},
	module : {},
};

state.config = global.config.get();

var MysqlPool = require( './component/MysqlPool' );
var RequestHandler = require( './component/RequestHandler' );
var ChatSockets = require( './component/ChatSockets' );

checkTLSPaths( tlsLoaded );
function tlsLoaded( success ) {
	if ( !success )
		state.config.shared.tls = false;
	
	if ( state.config.shared.force_no_tls )
		state.config.tls = false;
	
}

initDb();
function initDb() { state.db = new MysqlPool( global.config.server.mysql, databaseChecked ); }
function databaseChecked( success ) {
	if ( !success ) {
		log( 'sql startup failed, aborting' );
		process.exit( 1 );
		return;
	}
	
	log( 'sql connection nominal..' );
	startListen();
}

function startListen() {
	var tls = state.config.server.tls;
	// chat websocket server
	var chatPort = global.config.shared.chat.listen;
	if ( !chatPort )
		chatPort = global.config.shared.chat.port;
	
	state.socket = new ChatSockets( tls, chatPort, state );
	
	// 
	configServer();
	log( 'servers are nominal, listening..' );
	
}

function configServer() {
	// http server - its only purpose is to serve the client config, a JSON string.
	var port = global.config.shared.http.listen;
	if ( !port )
		port = global.config.shared.http.port;
	
	state.configServer = null;
	if ( state.config.shared.tls ) {
		doSecure( serverUp );
	} else {
		doPlain( serverUp );
	}
	
	log( 'config server nominal..' );
	
	function serverUp( success ) {
		state.configServer.listen( port );
	}
	
	function doSecure( callback ) {
		var https = require( 'https' );
		var watchConf = {
			keyPath  : state.config.server.tls.keyPath,
			certPath : state.config.server.tls.certPath,
			onchange : onChange,
			onerr    : onErr,
		};
		var tlsWatch = new TLSWatch( watchConf )
		function onChange( bundle ) {
			if ( state.configServer ) {
				state.configServer.close( closeBack );
				state.configServer = null;
			} else
				createSecure( successBack );
				
			function closeBack(){ createSecure( successBack ); }
			function successBack( success ) {
				if ( success ) {
					tlsWatch.acceptUpdate();
					callback( true );
				} else
					tlsWatch.denyUpdate();
				
			}
			
			function createSecure( successCB ) {
				var opt = {
					key  : bundle.key,
					cert : bundle.cert,
				};
				try {
					state.configServer = https.createServer( opt, requestHandler );
				} catch( e ) {
					state.configServer = null;
					successCB( false );
					return;
				}
				
				successCB( true );
			}
		}
		
		function onErr( err ) {
			log( 'tlsWatchErr', err );
		}
	}
	
	function doPlain( callback ) {
		var http = require( 'http' ); // SSSSSS
		state.configServer = http.Server( requestHandler );
		callback( true );
	}
	
	function requestHandler( req, res ) {
		// null cares given about what the request actually is, client cfg will be served
		var data = JSON.stringify( state.config.shared );
		res.writeHead( 200, {
			'Access-Control-Allow-Origin' : '*',
		});
		res.end( data );
	}
}


function checkTLSPaths( successBack ) {
	var keyPath = state.config.server.tls.keyPath;
	var certPath = state.config.server.tls.certPath;
	readFile( keyPath, keyBack );
	function keyBack( keyFile ) {
		readFile( certPath, certBack );
	}
	
	function certBack( certFile ) {
		successBack( true );
	}
	
	function readFile( path, loadBack ) {
		var opt = { encoding : 'ascii' };
		fs.readFile( path, opt, fileBack );
		function fileBack( err, content ) {
			if ( err ) {
				log( 'fileBack - err', err );
				successBack( false );
				return;
			}
			
			loadBack( content );
		}
	}
}

function registerForGCEvents() {
	try {
		var gcProfiler = require( 'gc-profiler' );
	} catch ( e ) {
		log( 'no gc-profiler' );
		gcProfiler = null;
	}

	if ( doGcLogging && gcProfiler )
		gcProfiler.on( 'gc', logGC );

	function logGC( event ) {
		var print = {
			type : event.type,
			duration : event.duration,
		};
		log( 'GC', print );
	}
}
