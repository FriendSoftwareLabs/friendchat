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

var mySQL = require('mysql2');
var __fs = require( 'fs' );
var log = require('./Log')( 'MysqlPool' );
var pLog = require( './Log' )( 'mysql-patcher' );
var __childProcess = require( 'child_process' );

var ns = {};

ns.MysqlPool = function( dbConf, doneBack ) {
	const self = this;
	self.done = doneBack;
	self.connectionLimit = 10;
	self.pool = null;
	
	self.init( dbConf );
}

ns.MysqlPool.prototype.init = function( conf ) {
	const self = this;
	self.connConf = {
		user            : conf.user,
		password        : conf.pass,
		database        : conf.name,
		connectionLimit : self.connectionLimit,
	};
	
	if ( null == conf.socket ) {
		self.connConf.host = conf.host;
		self.connConf.port = conf.port;
	} else
		self.connConf.socketPath = conf.socket;
	
	self.pool = mySQL.createPool( self.connConf );
	
	self.pool.on('connection', logConnection );
	self.pool.on('enqueue', logEnqueue );
	
	self.getConnection( systemsCheck );
	function systemsCheck ( err, conn ) {
		if ( err ) {
			log( 'pool check, many sharks', err );
			if ( conn && conn.release )
				conn.release();
			
			self.done( false );
			return;
		}
		
		self.applyUpdates( conn, applyDone );
		function applyDone( success ) {
			conn.release();
			
			if ( !success ) {
				log( 'no-go, db patching failed, closing' );
				self.done( false );
				return;
			}
			
			self.runStartupProc( conn, procsDone );
		}
		
		function procsDone( success ) {
			self.done( true );
		}
	}
	
	function logConnection( e ) {
	}
	
	function logEnqueue( e ) {
		log('connection requested, queued', e );
	}
}

ns.MysqlPool.prototype.applyUpdates = function( conn, doneBack ) {
	const self = this;
	var conf = {
		dbHost : self.host,
		dbUser : self.user,
		dbPass : self.pass,
		dbName : self.database,
	};
	new ns.Patches( conn, self.connConf, doneBack );
}

ns.MysqlPool.prototype.runStartupProc = function( db, callback ) {
	const self = this;
	db.query( "CALL purge_orphaned_settings()", null, queryBack );
	function queryBack( res ) {
		callback( true );
	}
}

ns.MysqlPool.prototype.close = function( callback ) {
	const self = this;
	log( 'closing pool' );
	self.pool.end( callback );
}

ns.MysqlPool.prototype.panic = function() {
	const self = this;
	log( 'destroying pool, please panic' );
	self.pool.destroy();
}

ns.MysqlPool.prototype.query = async function( query, values ) {
	const self = this;
	let conn = await self.getConnection();
	if ( !conn )
		throw new Error( 'ERR_NO_CONN' );
	
	let res = null;
	try {
		res = await conn.promise().query( query, values );
	} catch( ex ) {
		log( 'query ex', ex );
		throw new Error( 'ERR_QUERY_EX' );
	} finally {
		conn.release();
	}
	
	return res[ 0 ];
}

ns.MysqlPool.prototype.getConnection = function( callback ) {
	const self = this;
	if ( callback ) {
		self.pool.getConnection( callback );
		return;
	}
	
	return new Promise(( resolve, reject ) => {
		if ( self.pool )
			self.pool.getConnection( connBack );
		else
			resolve( null );
		
		function connBack( err, conn ) {
			if ( err ) {
				log( 'getConnection - err', err );
				resolve( null );
			} else
				resolve( conn );
		}
	});
}

// export module
module.exports = ns.MysqlPool;


// PATCHES
// runs patches from a folder against the db
ns.Patches =function( db, conf, doneCallback ) {
	const self = this;
	self.db = db;
	self.conf = conf;
	self.done = doneCallback;
	const cwd = __dirname.split( '/' );
	cwd.pop();
	const baseDir = cwd.join( '/' );
	const sqlDirectory =  baseDir + '/scripts/sql/';
	self.patchDirectory = sqlDirectory;
	self.procsScriptPath = sqlDirectory + 'auto_update_procs.sh';
	self.procsUpdatePath = sqlDirectory + 'procedures.sql';
	self.patchList = [];
	
	self.init();
}

ns.Patches.prototype.init = function() {
	const self = this;
	self.updateProcedures( procDone );
	function procDone( success ) {
		if ( !success ) {
			self.done( false );
			return;
		}
		
		self.check()
			.then( patchesDone )
			.catch( e => pLog( 'no u' ));
	}
	
	function patchesDone( success ) {
		self.done( success );
	}
}

ns.Patches.prototype.updateProcedures = function( procsDone ) {
	const self = this;
	const env = {
		procsPath  : self.procsUpdatePath,
		dbName     : self.conf.database,
		dbUser     : self.conf.user,
		dbPass     : self.conf.password,
	};
	if ( null == self.conf.socketPath ) {
		env.dbHost = self.conf.host;
		env.dbPort = self.conf.port;
	} else
		env.dbSock = self.conf.socketPath;
	
	var opts = {
		env : env,
	};
	var cmd = 'sh ' + self.procsScriptPath;
	__childProcess.exec( cmd, opts, execBack );
	function execBack( error, stdout, stderr ) {
		if ( error ) {
			showErr();
			procsDone( false );
			return;
		}
		
		procsDone( true );
		
		function showErr() {
			var err = {
				err    : error,
				stdout : stdout,
				stderr : stderr,
			};
			log( err, 3 );
		}
	}
}

ns.Patches.prototype.check = async function( checkDone ) {
	const self =this;
	self.patchList = null;
	self.dbState = null;
	
	const patchList =  await self.getPatchList();
	if ( null == patchList ) {
		pLog( 'check - no patchList, abort' );
		return false;
	}
	
	if ( 0 === patchList.length )
		return true;
	
	self.patchList = patchList;
	const dbState = await self.getDbVersion();
	if ( null == dbState ) {
		pLog( 'check - no db state, abort' );
		return false;
	}
	
	pLog( 'db version', dbState );
	self.dbState = dbState;
	if ( checkUpToDate())
		return true;
	
	let success = null;
	try {
		success = await self.applyPatches();
	} catch( ex ) {
		log( 'check - applyPatches ex', ex );
		return false;
	}
	
	if ( !success ) {
		pLog( 'Patches - failed to apply patches', {
			patches : self.patchList,
			dbState : self.dbState,
		}, 3 );
		return false;
	}
	
	return true;
	
	function checkUpToDate() {
		const lastPatch = self.patchList[ self.patchList.length -1 ];
		const db = self.dbState;
		if ( lastPatch.version !== db.version )
			return false;
		
		if ( lastPatch.patch !== db.patch ) {
			return false;
		}
		
		return true;
	}
}

ns.Patches.prototype.getPatchList = async function() {
	const self = this;
	let fileList = __fs.readdirSync( self.patchDirectory );
	/*
	try {
		fileList = await __fs.readdirSync( self.patchDirectory );
	} catch( ex ) {
		pLog( 'getPatchList - readdir ex', {
			dir : self.patchDirectory,
			ex  : ex,
		}, 3 );
		return null;
	}
	*/
	const parsed = fileList.map( parse );
	const patchList = parsed.filter( is );
	patchList.sort( byVersionThenPatch );
	return patchList;
	
	function parse( file ) {
		if ( !file )
			return null;
		
		var patch = self.tokenize( file );
		if ( !patch )
			return null;
		
		patch.filename = file;
		return patch;
	}
	
	function is( patch ) {
		if ( !patch )
			return false;
		return true;
	}
	
	function byVersionThenPatch( a, b ) {
		if ( a.version === b.version )
			return comparePatch( a, b );
		
		return sort( a.version, b.version );
		
		function comparePatch( a, b ) { return sort( a.patch, b.patch ) }
		function sort( a, b ) {
			if ( a < b )
				return -1;
			return 1;
		}
	}
}

ns.Patches.prototype.getDbVersion = function() {
	const self = this;
	return new Promise(( resolve, reject ) => {
		const query = "SELECT * FROM db_history ORDER BY `_id` DESC LIMIT 1";
		self.db.query( query, queryBack );
		function queryBack( err, rows ) {
			if ( err ) {
				reject( err );
				return;
			}
			
			if ( !rows.length ) {
				pLog( 'no rows' );
				const dbState = {
					version : 0,
					patch   : 0,
				};
			
				resolve ( dbState );
			}
			
			const str = JSON.stringify( rows[ 0 ]);
			const state = JSON.parse( str );
			delete state[ '_id' ];
			resolve( state );
		}
	});
}

ns.Patches.prototype.tokenize = function( filename ) {
	const self = this;
	var tokens = filename.split( '.' );
	if ( tokens.length != 4 )
		return null;
	
	if ( tokens[ 3 ].toLowerCase() !== 'sql' )
		return null;
	
	var patch = {
		version : parseInt( tokens[ 0 ], 10 ),
		patch : parseInt( tokens[ 1 ], 10 ),
		comment : tokens[ 2 ],
	}
	
	return verify( patch );
	
	function verify( patch ) {
		if ( !isNum( patch.version )
			|| !isNum( patch.patch )
			|| !isComment( patch.comment )) 
		{
			pLog( 'failed to verify', patch );
			return null;
		}
		
		return patch;
		
		function isNum( num ) {
			var str = num.toString();
			if ( typeof( num ) !== 'number' )
				return false;
			
			if ( str === 'NaN' )
				return false;
			return true;
		}
		
		function isComment( str ) {
			if ( typeof( str) !== 'string' )
				return false;
			
			if ( str.length < 8 ) {
				pLog( 'comment too short, be more descriptive' );
				return false;
			}
			return true;
		}
	}
}

ns.Patches.prototype.applyPatches = async function() {
	const self = this;
	let success = false;
	const notApplied = self.patchList.filter( patch => isGreaterThanDb( patch ));
	pLog( 'applyPatches - no yet applied', notApplied );
	if ( !notApplied || !notApplied.length )
		return true;
	
	//const iter = notApplied.values();
	for ( const patch of notApplied ) {
		let res = await applyPatch( patch );
		pLog( 'patch res', res );
		if ( !res )
			return false;
	}
	
	return true;
	
	/*
	function applied( lastIndex ) {
		var nextIndex = lastIndex + 1;
		if ( notApplied[ nextIndex ] ) {
			applyPatch( nextIndex, applied );
			return;
		}
		
		done( true );
	}
	*/
	
	async function applyPatch( patch ) {
		pLog( 'applyPatch', patch );
		let queries, file;
		file = readPatch( patch.filename );
		if ( !file )
			return false;
		
		queries = file.split( ';' );
		queries = queries.map( cleanup ).filter( is );
		pLog( 'queries', queries );
		if ( !queries.length )
			return false;
		
		/*
		if ( !queries.length )
			queriesDone( true );
		*/
		
		function cleanup( query ) { return query.trim(); }
		function is( query ) {
			if ( !query )
				return false;
			return true;
		}
		
		for ( const query of queries ) {
			let res = await execute( query );
			pLog( 'query res', res );
			if ( !res )
				return false;
		}
		
		await setPatchHistory( patch );
		
		return true;
		
		function execute( query ) {
			pLog( 'execute', query );
			return new Promise(( resolve, reject ) => {
				try {
					self.db.query( query, executeBack );
				} catch( e ) {
					pLog( 'stopped applying patches because', e );
					pLog( 'error in patch', patch );
					resolve( false );
				}
				
				function executeBack( err, res ) {
					if ( err ) {
						pLog( 'error running query: ' + query + ' -- ERR: ' + err );
						resolve( false );
						return;
					}
					
					pLog( 'applied db patch:', patch );
					resolve( true );
				}
			});
		}
		
		function setPatchHistory( patch ) {
			pLog( 'setPatchHistory', patch );
			return new Promise(( resolve, reject ) => {
				const query = "INSERT INTO db_history( version, patch, comment )"
					+ " VALUES( "
					+ patch.version + ", "
					+ patch.patch   + ", '"
					+ patch.comment + "' )";
				
				try {
					self.db.query( query, historyBack  );
				} catch( ex ) {
					pLog( 'failed to update db history for patch', patch );
					resolve( false );
				}
				
				function historyBack( err, res ) {
					if ( err ) {
						pLog( 'failed to update history', err );
						resolve( false );
						return;
					}
					
					resolve( true );
				}
			});
		}
	}
	
	function readPatch( filename ) {
		const filepath = self.patchDirectory + filename;
		return readFile( filepath );
	}
	
	function readFile( path ) {
		let file = null;
		const opt = { encoding : 'utf8' };
		try {
			file = __fs.readFileSync( path, opt );
		} catch( ex ) {
			pLog( 'readFile ex', ex );
		}
		
		pLog( 'readFile', file );
		return file;
	}
	
	function isGreaterThanDb( patch ) {
		if ( patch.version < self.dbState.version )
			return false;
		
		if ( patch.version > self.dbState.version )
			return true;
		
		if ( patch.patch <= self.dbState.patch )
			return false;
		
		return true;
	}
	
}
