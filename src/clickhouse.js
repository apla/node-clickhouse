var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');
var util = require ('util');

var Duplex = require ('stream').Duplex;

Object.assign = require ('object-assign');

require ('@apla/buffer-indexof-polyfill');

var JSONStream = require ('./json-stream');

function RecordStream (options) {
	// if (! (this instanceof RecordStream)) return new RecordStream(options);
	options = options || {};
	options.objectMode = true;
	Duplex.call (this, options);
}

util.inherits(RecordStream, Duplex);

RecordStream.prototype._read = function read () {
	// nothing to do there, when data comes, push will be called
};

RecordStream.prototype._write = function write () {
	//
};


function httpRequest (reqParams, reqData, cb) {

	var stream = new RecordStream ();

	var onResponse = function(response) {
		var str;
		var error;

		if (response.statusCode === 200) {
			str = new Buffer (0);
		} else {
			error = new Buffer (0);
		}

		function errorHandler (e) {
			stream.emit ('error', e);
			return cb && cb (e);
		}

		// In case of error, we're just throw away data
		response.on ('error', errorHandler);

		// TODO: use streaming interface
		// from https://github.com/jimhigson/oboe.js
		// or https://www.npmjs.com/package/stream-json or
		// or https://github.com/creationix/jsonparse

		// or implement it youself
		var jsonParser = new JSONStream (stream);

		//another chunk of data has been received, so append it to `str`
		response.on ('data', function (chunk) {

			// JSON response
			if (
				response.headers['content-type']
				&& response.headers['content-type'].indexOf ('application/json') === 0
				&& !reqData.syncParser
			) {

				// store in buffer anything after
				var newLinePos = chunk.lastIndexOf ("\n");

				var remains = chunk.slice (newLinePos + 1);

				var strings = Buffer.concat([str, chunk])
					.slice (0, str.length + newLinePos)
					.toString ('utf8')
					.split ("\n")
					.forEach (jsonParser);

				jsonParser.rows.forEach (function (row) {
					// write to readable stream
					stream.push (row);
				});

				jsonParser.rows = [];

				str = remains;

			// plaintext response
			} else if (str) {
				str   = Buffer.concat ([str, chunk]);
			} else {
				error = Buffer.concat ([error, chunk]);
			}
		});

		//the whole response has been received, so we just print it out here
		response.on('end', function () {

			if (error) {
				return errorHandler (new Error (error.toString ('utf8')))
			}

			var data;

			var contentType = response.headers['content-type'];

			if (response.statusCode === 200 && (!contentType || contentType.indexOf ('text/plain') === 0)) {
				// probably this is a ping response or any other successful response with *empty* body
				stream.push (null);
				cb && cb (null, str.toString ('utf8'));
				return;
			}

			var supplemental = {};

			if (jsonParser.columns.length) {
				try {
					supplemental = JSON.parse (jsonParser.supplementalString + str.toString ('utf8'));
				} catch (e) {
					// TODO
				}
				stream.supplemental = supplemental;

				// end stream
				stream.push (null);

				cb && cb (null, Object.assign ({}, supplemental, {
					meta: jsonParser.columns
				}));

				return;
			}

			// one shot data parsing, should be much faster for smaller datasets
			try {
				data = JSON.parse (str.toString ('utf8'));

				if (data.meta) {
					stream.emit ('metadata', data.meta);
				}

				if (data.data) {
					// no highWatermark support
					data.data.forEach (function (row) {
						stream.push (row);
					});

					stream.push (null);
				}
			} catch (e) {
				return errorHandler (e);
			}

			cb && cb (null, data);
		});

	};

	var req = http.request (reqParams, onResponse);

	if (reqData.query)
		req.write (reqData.query);

	if (reqData.finalized) {
		req.end();
	}

	return stream;
}

function ClickHouse (options) {
	if (!options) {
		console.error ('You must provide at least host name to query ClickHouse');
		return null;
	}

	if (options.constructor === String) {
		options = {host: options};
	}

	this.options = options;
}

ClickHouse.prototype.getReqParams = function () {
	var urlObject = {};

	// avoid to set defaults - node http module is not happy
	"protocol auth host hostname port path localAddress headers agent createConnection".split (" ").forEach (function (k) {
		if (this.options[k] !== undefined)
			urlObject[k] = this.options[k];
	}, this);

	urlObject.method = 'POST';

	urlObject.path = urlObject.path || '/';

	return urlObject;
}

ClickHouse.prototype.query = function (chQuery, options, cb) {

	chQuery = chQuery.trim ();

	if (cb === undefined && options && options.constructor === Function) {
		cb = options;
		options = undefined;
	}

	if (!options)
		options = {
			queryOptions: {}
		};

	options.omitFormat  = options.omitFormat  || this.options.omitFormat  || false;
	options.dataObjects = options.dataObjects || this.options.dataObjects || false;

	// we're adding `queryOptions` passed for constructor if any
	var queryObject = Object.assign ({}, this.options.queryOptions, options.queryOptions);

	var reqData = {
		syncParser: options.syncParser || this.options.syncParser || false,
		finalized: true // allows to write records into connection stream
	};

	var reqParams = this.getReqParams ();

	var formatSuffix = '';

	// format should be added for data queries
	if (chQuery.match (/^(?:SELECT|SHOW|DESC|DESCRIBE|EXISTS\s+TABLE)/i)) {
		formatSuffix = ' FORMAT ' + (options.dataObjects ? 'JSON' : 'JSONCompact');
	} else if (chQuery.match (/^INSERT/i)) {

		// There is some variants according to the documentation:
		// 1. Values already available in the query: INSERT INTO t VALUES (1),(2),(3)
		// 2. Values must me provided with POST data: INSERT INTO t VALUES
		// 3. Same as previous but without VALUES keyword: INSERT INTO t FORMAT Values
		// 4. Insert from SELECT: INSERT INTO t SELECT…

		// we need to handler 2 and 3 and not to close http stream in that cases
		if (chQuery.match (/VALUES$/i)) {
			reqData.finalized = false;

			// simplest format to use, only need to escape \t, \\ and \n
			formatSuffix = ' FORMAT TabSeparated';
		}
	}

	// use query string to submit ClickHouse query — usefuful to mock CH server
	if (this.options.useQueryString) {
		queryObject.query = chQuery + ((options.omitFormat) ? '' : formatSuffix);
		reqParams.method = 'GET';
	} else {
		reqData.query = chQuery + (options.omitFormat ? '' : formatSuffix);
		reqParams.method = 'POST';
	}

	reqParams.path += '?' + qs.stringify (queryObject);

	var stream = httpRequest (reqParams, reqData, cb);

	return stream;
}

ClickHouse.prototype.ping = function (cb) {

	var reqParams = this.getReqParams ();

	reqParams.method = 'GET';

	var stream = httpRequest (reqParams, {finalized: true}, cb);

	return stream;
}

module.exports = ClickHouse;
