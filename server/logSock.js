#!/usr/bin/env node

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

const fs = require( 'fs' );
const util = require( 'util' );
const fork = require( 'child_process' ).fork;
const log = require( './component/Log' )( 'LogSock' );
const WSS = require( './component/WebSocketServer' );
const uuid = require( './component/UuidPrefix' )();

const conf = require( './component/Config' ); // not really bothering with saving the obj,
                                              // it writes itself to global.config

const inspectOpts = {
	depth      : 3,
	showHidden : true,
	colors     : true,
};

if ( conf.server.dev )
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//application state
const state = {
	clients : {},
	names   : [
		'apekatt',
		'flybåt',
		'hengekøye',
		'venteliste',
		'arntstian',
		'knekkebrød',
		'gråfarget',
		'smårips',
		'tutogkjør',
		'grevling',
		'kniiiis',
	],
	counter : 0,
};

state.config = global.config.get();

setup();
async function setup() {
	log( 'load certs' );
	const tls = await loadCert( state.config.server.tls );
	const logPort = 12321;
	
	log( 'start ws server' );
	const wssConf = {
		port : logPort,
		tls  : tls,
	};
	const wss = new WSS( wssConf );
	wss.on( 'connection', handleClient );
	
	log( 'listening..' );
}

function handleClient( conn ) {
	const id = uuid.get( 'client' );
	const client = {
		id   : id,
		conn : conn,
		name : state.names[ state.counter ],
	};
	
	state.clients[ id ] = client;
	
	log( 'handleClient, ' + client.name + ' connected' );
	if ( state.counter == ( state.names.length - 1 ))
		state.counter = 0;
	else
		state.counter++;
	
	conn.on( 'error', e => {});
	conn.on( 'close', e => closeClient( id ));
	conn.on( 'message', e => handleClientEvent( e, id ));
	
}

function closeClient( connId ) {
	const client = state.clients[ connId ];
	log( 'closeClient', client.name );
	const conn = client.conn;
	client.conn = null;
	delete state.clients[ connId ];
	if ( !conn )
		return;
	
	conn.removeAllListeners( 'message' );
	conn.removeAllListeners( 'error' );
	conn.removeAllListeners( 'close' );
}

function handleClientEvent( eventStr, clientId ) {
	let event = null;
	try {
		event = JSON.parse( eventStr );
	} catch( ex ) {
		log( 'handleClientEvent - could not parse', eventStr );
		return;
	}
	
	const client = state.clients[ clientId ];
	
	if ( 'init' === event.type ) {
		const init = event.data;
		log( 'client init', event );
		if ( init.name ) {
			log( 'client ' + client.name + ' has changed name to ' + init.name );
			client.name = init.name;
		}
		return;
	}
	
	if ( 'log' === event.type ) {
		logEvent( client, event.data );
		return;
	}
}

function logEvent( client, data ) {
	const timeStr = getTimeString( data.time || Date.now());
	const viewName = data.viewName || null;
	const args = data.args;
	if ( !args )
		return;
	
	const name = client.name;
	const logStr = args[ 0 ] || '';
	let prefix = ' >>> ' + name + ' : ' + timeStr;
	if ( viewName )
		prefix += ' >> ' + viewName;
	
	prefix += ' > ' + logStr;
	console.log( prefix );
	console.log( util.inspect( args[ 1 ], inspectOpts ));
	//console.log( ' ' );
}

function getTimeString( timestamp ) {
	const now = new Date( timestamp );
	const hours = now.getHours();
	const minutes = now.getMinutes();
	const seconds = now.getSeconds();
	const millis = now.getMilliseconds();
	return pad( hours )
		+ ':' + pad( minutes )
		+ ':' + pad( seconds )
		+ ':' + pad( millis, true );
	
	function pad( arg, millis ) {
		var int = parseInt( arg );
		if ( millis ) {
			if ( int < 10 )
				return '00' + int;
			if ( int < 100 )
				return '0' + int;
		}
		
		if ( int < 10 )
			return '0' + int;
		
		return arg;
	}
}

async function loadCert( paths ) {
	log( 'loadCert', paths );
	const opt = { encoding : 'ascii' };
	return new Promise(( resolve, reject ) => {
		const tls = {};
		tls.key = fs.readFileSync( paths.keyPath, opt );
		tls.cert = fs.readFileSync( paths.certPath, opt );
		if ( !tls.key || !tls.cert ) {
			reject( tls );
			return;
		}
		
		resolve( tls );
	});
}