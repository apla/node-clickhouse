var http = require ('http');
var https = require('https');
var url  = require ('url');
var qs   = require ('querystring');
var util = require ('util');

// var debug = require ('debug')('clickhouse');

require ('./legacy-support');

var RecordStream = require ('./streams').RecordStream;
var JSONStream   = require ('./streams').JSONStream;

var parseError = require ('./parse-error');

var LIBRARY_SPECIFIC_OPTIONS = require ('./consts').LIBRARY_SPECIFIC_OPTIONS;

function httpResponseHandler (stream, reqParams, reqData, cb, response) {
	var str;
	var error;

	if (response.statusCode === 200) {
		str = Buffer.alloc ? Buffer.alloc (0) : new Buffer (0);
	} else {
		error = Buffer.alloc ? Buffer.alloc (0) : new Buffer (0);
	}

	function errorHandler (e) {
		var err = parseError (e);

		// user should define callback or add event listener for the error event
		if (!cb || (cb && stream.listeners ('error').length))
			stream.emit ('error', err);
		return cb && cb (err);
	}

	// In case of error, we're just throw away data
	response.on ('error', errorHandler);

	// TODO: use streaming interface
	// from https://github.com/jimhigson/oboe.js
	// or https://www.npmjs.com/package/stream-json or
	// or https://github.com/creationix/jsonparse

	// or implement it youself
	var jsonParser = new JSONStream (stream);

	var symbolsTransferred = 0;

	//another chunk of data has been received, so append it to `str`
	response.on ('data', function (chunk) {

		symbolsTransferred += chunk.length;

		// JSON response
		if (
			response.headers['content-type']
			&& response.headers['content-type'].indexOf ('application/json') === 0
			&& !reqData.syncParser
			&& chunk.lastIndexOf ("\n") !== -1
			&& str
		) {

			// store in buffer anything after
			var newLinePos = chunk.lastIndexOf ("\n");

			var remains = chunk.slice (newLinePos + 1);

			Buffer.concat([str, chunk.slice (0, newLinePos)])
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

		// debug (response.headers);

		if (error) {
			return errorHandler (error);
		}

		var data;

		var contentType = response.headers['content-type'];

		// Early return and stream end in case when content-type means empty body
		if (response.statusCode === 200 && (
			!contentType
			|| contentType.indexOf ('text/plain') === 0
			|| contentType.indexOf ('text/html') === 0 // WTF: xenial - no content-type, precise - text/html
		)) {
			// probably this is a ping response or any other successful response with *empty* body
			stream.push (null);
			cb && cb (null, str.toString ('utf8'));
			return;
		}

		var supplemental = {};

		// we already pushed all the data
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
				meta: jsonParser.columns,
				transferred: symbolsTransferred
			}));

			return;
		}

		// one shot data parsing, should be much faster for smaller datasets
		try {
			data = JSON.parse (str.toString ('utf8'));

			data.transferred = symbolsTransferred;

			if (data.meta) {
				stream.emit ('metadata', data.meta);
			}

			if (data.data) {
				// no highWatermark support
				data.data.forEach (function (row) {
					stream.push (row);
				});

			}
		} catch (e) {
			if (!reqData.format || !reqData.format.match (/^(JSON|JSONCompact)$/)) {
				data = str.toString ('utf8');
			} else {
				return errorHandler (e);
			}

		} finally {
			if (!stream.readableEnded) {
				stream.push (null);
				cb && cb (null, data);
			}
		}
	});

}

function httpRequest (reqParams, reqData, cb) {

	if (reqParams.query) {
		reqParams.path = (reqParams.pathname || reqParams.path) + '?' + qs.stringify (reqParams.query);
	}

	var stream = new RecordStream ({
		format: reqData.format
	});
	var requestInstance = reqParams.protocol === 'https:' ? https : http;
	var req = requestInstance.request (reqParams, httpResponseHandler.bind (
		this, stream, reqParams, reqData, cb
	));

	req.on ('error', function (e) {
		// user should define callback or add event listener for the error event
		if (!cb || (cb && stream.listeners ('error').length))
			stream.emit ('error', e);
		return cb && cb (e);
  });

  req.on('timeout', function (e) {
    req.abort();
  })

	stream.req = req;

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
	for (var name of Object.keys(this.options)) {
		if (!LIBRARY_SPECIFIC_OPTIONS.has(name)) {
			urlObject[name] = this.options[name];
		}
	}

	if (this.options.hasOwnProperty('user') || this.options.hasOwnProperty('password')) {
		urlObject.auth = (this.options.user || 'default')
			+ ':'
			+ (this.options.password || '')
	}

	urlObject.method = 'POST';

	urlObject.path = urlObject.path || '/';

	urlObject.port = urlObject.port || 8123;

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
	options.format      = options.format      || this.options.format      || null;
	options.readonly    = options.readonly    || this.options.readonly    || this.options.useQueryString || false;

	// we're adding `queryOptions` passed for constructor if any
	var queryObject = Object.assign ({}, this.options.queryOptions, options.queryOptions);

	var formatRegexp = /FORMAT\s+(BlockTabSeparated|CSV|CSVWithNames|JSON|JSONCompact|JSONEachRow|Native|Null|Pretty|PrettyCompact|PrettyCompactMonoBlock|PrettyNoEscapes|PrettyCompactNoEscapes|PrettySpaceNoEscapes|PrettySpace|RowBinary|TabSeparated|TabSeparatedRaw|TabSeparatedWithNames|TabSeparatedWithNamesAndTypes|TSKV|Values|Vertical|XML)/i;
	var formatMatch = chQuery.match (formatRegexp);

	if (!options.omitFormat && formatMatch) {
		options.format = formatMatch[1];
		options.omitFormat = true;
	}

	var reqData = {
		syncParser: options.syncParser || this.options.syncParser || false,
		finalized: true, // allows to write records into connection stream
	};

	var reqParams = this.getReqParams ();

	var formatEnding = '';

	// format should be added for data queries
	if (chQuery.match (/^(?:SELECT|WITH|SHOW|DESC|DESCRIBE|EXISTS\s+TABLE)/i)) {
		if (!options.format)
			options.format = options.dataObjects ? 'JSON' : 'JSONCompact';
	} else if (chQuery.match (/^INSERT/i)) {

		// There is some variants according to the documentation:
		// 1. Values already available in the query: INSERT INTO t VALUES (1),(2),(3)
		// 2. Values must me provided with POST data: INSERT INTO t VALUES
		// 3. Same as previous but without VALUES keyword: INSERT INTO t FORMAT Values
		// 4. Insert from SELECT: INSERT INTO t SELECT…

		// we need to handle 2 and 3 and http stream must stay open in that cases
		if (chQuery.match (/\s+VALUES\b/i)) {
			if (chQuery.match (/\s+VALUES\s*$/i))
				reqData.finalized = false;

			options.format = 'Values';
			options.omitFormat = true;

		} else if (chQuery.match (/INSERT\s+INTO\s+\S+\s+(?:\([^\)]+\)\s+)?SELECT/mi)) {
			reqData.finalized  = true;
			options.omitFormat = true;
		} else {

			reqData.finalized = false;

			// Newline is recomended https://clickhouse.yandex/docs/en/query_language/insert_into/#insert
			formatEnding = '\n';
			if (!chQuery.match (/FORMAT/i)) {
				// simplest format to use, only need to escape \t, \\ and \n
				options.format = options.format || 'TabSeparated';
			} else {
				options.omitFormat = true;
			}
		}
	} else {
		options.omitFormat = true;
	}

	reqData.format = options.format;

	// use query string to submit ClickHouse query — useful to mock CH server
	if (options.readonly) {
		queryObject.query = chQuery + ((options.omitFormat) ? '' : ' FORMAT ' + options.format + formatEnding);
		reqParams.method = 'GET';
	} else {
		// Trimmed query still may require `formatEnding` when FORMAT clause specified in query
		reqData.query = chQuery + (options.omitFormat ? '' : ' FORMAT ' + options.format) + formatEnding;
		reqParams.method = 'POST';
	}

	reqParams.query = queryObject;

	var stream = httpRequest (reqParams, reqData, cb);

	return stream;
}

ClickHouse.prototype.querying = function (chQuery, options) {

	return new Promise (function (resolve, reject) {
		// Force override `syncParser` option when using promise api
		const queryOptions = Object.assign ({}, options, {syncParser: true})
		var stream = this.query (chQuery, queryOptions, function (err, data) {
			if (err)
				return reject (err);
			resolve (data);
		});
	}.bind (this));
}

ClickHouse.prototype.ping = function (cb) {

	var reqParams = this.getReqParams ();

	reqParams.method = 'GET';

	var stream = httpRequest (reqParams, {finalized: true}, cb);

	return stream;
}

ClickHouse.prototype.pinging = function () {

	return new Promise (function (resolve, reject) {
		var reqParams = this.getReqParams ();

		reqParams.method = 'GET';

		httpRequest (reqParams, {finalized: true}, function (err, data) {
			if (err)
				return reject (err);
			resolve (data);
		});
	}.bind (this));
}

module.exports = ClickHouse;
