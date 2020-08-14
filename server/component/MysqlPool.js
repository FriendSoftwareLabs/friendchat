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
var fs = require( 'fs' );
var log = require('./Log')( 'MysqlPool' );
var pLog = require( './Log' )( 'mysql-patcher' );
var childProcess = require( 'child_process' );

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

ns.MysqlPool.prototype.getConnection = function( callback ) {
	const self = this;
	if ( self.pool )
		self.pool.getConnection( callback );
	else
		callback( false );
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
		
		self.check( patchesDone );
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
	childProcess.exec( cmd, opts, execBack );
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

ns.Patches.prototype.check = function( checkDone ) {
	var self =this;
	self.patchList = null;
	self.dbState = null;
	run();
	
	function run() {
		self.getPatchList( patchBack );
	}
	function patchBack( err, patchList ) {
		if ( err ) {
			pLog( 'error reading files', err );
			done( false );
			return;
		}
		
		if ( !patchList.length ) {
			done( true );
			return;
		}
		
		self.patchList = patchList;
		self.getDbVersion( versionBack );
	}
	
	function versionBack( err, dbState ) {
		if ( err ) {
			pLog( 'error reading db state', err );
			done( false );
			return;
		}
		
		self.dbState = dbState;
		checkUpToDate();
	}
	function checkUpToDate() {
		var lastPatch = self.patchList[ self.patchList.length -1 ];
		if ( lastPatch.patch == self.dbState.patch ) {
			done( true );
			return;
		}
		
		self.applyPatches( done );
	}
	function done( success ) {
		checkDone( success );
	}
}

ns.Patches.prototype.getPatchList =function( resultBack ) {
	const self = this;
	fs.readdir( self.patchDirectory, readBack );
	function readBack( err, fileList ) {
		if ( err ) {
			resultBack( err );
			return;
		}
		
		var parsed = fileList.map( parse );
		var patchList = parsed.filter( is );
		patchList.sort( byVersionThenPatch );
		resultBack( null, patchList );
		
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
}

ns.Patches.prototype.getDbVersion = function( resultBack ) {
	const self = this;
	var query = "SELECT * FROM db_history ORDER BY `_id` DESC LIMIT 1";
	self.db.query( query, queryBack );
	function queryBack( err, rows ) {
		if ( err ) {
			resultBack( err, null );
			return;
		}
		
		var dbState = {
			version : 0,
			patch : 0,
		};
		
		if ( !rows.length ) {
			pLog( 'no rows' );
			resultBack( null, dbState );
			return;
		}
		
		var dbState = rows[ 0 ];
		resultBack( null, dbState );
	}
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

ns.Patches.prototype.applyPatches = function( doneBack ) {
	const self = this;
	var success = false;
	var lastApplied = self.dbState.patch;
	var notApplied = self.patchList.filter( isGreaterThanDb );
	
	applyPatch( 0, applied );
	function applied( lastIndex ) {
		var nextIndex = lastIndex + 1;
		if ( notApplied[ nextIndex ] ) {
			applyPatch( nextIndex, applied );
			return;
		}
		
		done( true );
	}
	
	function applyPatch( index, appliedBack ) {
		var patch = notApplied[ index ];
		var queries;
		readPatch( patch.filename, prepareContents );
		function prepareContents( err, file ) {
			queries = file.split( ';' );
			queries = queries.map( cleanup ).filter( is );
			if ( !queries.length )
				queriesDone( true );
			
			runQueries( queriesDone );
			
			function cleanup( query ) { return query.trim(); }
			function is( query ) {
				if ( !query )
					return false;
				return true;
			}
		}
		
		function runQueries( runBack ) {
			var executed = new Array( queries.length );
			queries.forEach( execute );
			
			function execute( query, index ) {
				executed[ index ] = false;
				try {
					self.db.query( query, queryBack );
				} catch( e ) {
					pLog( 'stopped applying patches because', e );
					pLog( 'error in patch', patch );
					runBack( false );
				}
				
				function queryBack( err, res ) {
					if ( err )
						throw new Error( 'error running query: ' + query + ' -- ERR: ' + err );
					
					pLog( 'applied db patch:', patch );
					sayDone( index );
				}
			}
			
			function sayDone( index ) {
				executed[ index ] = true;
				checkAllDone();
			}
			
			function checkAllDone() {
				var allDone = executed.every( isDone );
				if ( allDone ) {
					runBack( true );
				}
				
				function isDone( item ) {
					return !!item;
				}
			}
		}
		
		function queriesDone( success ) {
			if ( !success ) {
				pLog( 'one or more queries failed', patch )
				// DO rollback ?
				done( false );
				return;
			}
			
			setPatchHistory();
		}
		
		function setPatchHistory() {
			var query = "INSERT INTO db_history( version, patch, comment )"
				+ " VALUES( " + patch.version + ", " + patch.patch + ", '" + patch.comment + "' )";
			self.db.query( query, queryBack  );
			function queryBack( err, res ) {
				if ( err ) {
					pLog( 'failed to update history', err );
					done( false );
					return;
				}
				
				appliedBack( index );
			}
		}
	}
	
	function readPatch( filename, contentBack ) {
		var filepath = self.patchDirectory + filename;
		readFile( filepath, contentBack );
	}
	
	function readProcedures( callback ) {
		readFile( self.procsScriptPath, callback );
	}
	
	function readFile( path, callback ) {
		var opt = { encoding : 'utf8' };
		fs.readFile( path, opt, callback );
	}
	
	function isGreaterThanDb( patch ) {
		if ( patch.patch > lastApplied )
			return true;
		return false;
	}
	
	function done( success ) {
		doneBack( success );
	}
}
