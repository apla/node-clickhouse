var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');
var util = require ('util');

// var debug = require ('debug')('clickhouse');

require ('./legacy-support');

var RecordStream = require ('./streams').RecordStream;
var JSONStream   = require ('./streams').JSONStream;

var parseError = require ('./parse-error');

function httpResponseHandler (stream, reqParams, reqData, cb, response) {

	var error;

	function errorHandler (e) {
		error = parseError (e);

		// user should define callback or add event listener for the error event
		if (!cb || (cb && stream.listeners ('error').length))
			stream.emit ('error', error);
		return cb && cb (error);
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
	response.on ('_data', function (chunk) {

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

	var responseData = Buffer.alloc ? Buffer.alloc (0) : new Buffer (0),
		chunk;

	//the whole response has been received, so we just print it out here
	stream.on ('response-end', function () {

		console.log ('response end');

		console.log (stream.format, reqData.syncParser, haveReaders());

		function haveReaders () {
			return stream.listeners ('data').length + stream.listeners ('readable').length;
		}

		if (stream.format && !reqData.syncParser) {
			if (!haveReaders ()) {
				// user want to skip data
				console.warn ('Either subscribe to the stream data or use `syncParser` option');

				stream.cleanBuffer ();
			}



		} else {
			// console.log (stream);

			responseData = stream.consume (stream);

			if (reqData.syncParser) {
				console.log (1234)
			}
		}

	});

	//the whole response has been received, so we just print it out here
	stream.on ('end', function () {

		console.log ('read end', responseData);

		return responseData && !error && cb && cb (null, responseData);

		!error && cb && cb (null, Object.assign (
			{},
			stream.supplemental,
			{
				meta: stream.jsonParser.columns,
				transferred: stream.transferred
			}
		));
	});


	stream.res = response;

}

function httpRequest (reqParams, reqData, cb) {

	if (reqParams.query) {
		reqParams.path = (reqParams.pathname || reqParams.path) + '?' + qs.stringify (reqParams.query);
	}

	var stream = new RecordStream ({
		format: reqData.format
	});

	var req = http.request (reqParams, httpResponseHandler.bind (
		this, stream, reqParams, reqData, cb
	));

	req.on ('error', function (e) {
		// user should define callback or add event listener for the error event
		if (!cb || (cb && stream.listeners ('error').length))
			stream.emit ('error', e);
		return cb && cb (e);
	});

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
	"protocol auth host hostname port path localAddress headers agent createConnection".split (" ").forEach (function (k) {
		if (this.options[k] !== undefined)
			urlObject[k] = this.options[k];
	}, this);

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
	if (chQuery.match (/^(?:SELECT|SHOW|DESC|DESCRIBE|EXISTS\s+TABLE)/i)) {
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

		} else {

			reqData.finalized = false;

			if (!chQuery.match (/FORMAT/i)) {
				// simplest format to use, only need to escape \t, \\ and \n
				options.format = options.format || 'TabSeparated';
				formatEnding = ' '; // clickhouse don't like data immediately after format name
			} else {

			}
		}
	} else {
		options.omitFormat = true;
	}

	reqData.format = options.format;

	// use query string to submit ClickHouse query — useful to mock CH server
	if (this.options.useQueryString) {
		queryObject.query = chQuery + ((options.omitFormat) ? '' : ' FORMAT ' + options.format + formatEnding);
		reqParams.method = 'GET';
	} else {
		reqData.query = chQuery + (options.omitFormat ? '' : ' FORMAT ' + options.format + formatEnding);
		reqParams.method = 'POST';
	}

	reqParams.query = queryObject;

	var stream = httpRequest (reqParams, reqData, cb);

	return stream;
}

ClickHouse.prototype.querying = function (chQuery, options) {

	return new Promise (function (resolve, reject) {
		var stream = this.query (chQuery, options, function (err, data) {
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
