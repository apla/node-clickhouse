var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');
var util = require ('util');

// var debug = require ('debug')('clickhouse');

var Duplex = require ('stream').Duplex;

require ('./legacy-support');

var JSONStream = require ('./json-stream');

function RecordStream (options) {
	// if (! (this instanceof RecordStream)) return new RecordStream(options);
	options = options || {};
	options.objectMode = true;
	Duplex.call (this, options);

	this.format = options.recordFormat;

	this._writeBuffer = [];
	this._canWrite = false;

	Object.defineProperty (this, 'req', {
		get: function () {return this._req},
		set: function (req) {this._req = req; this._canWrite = true;}
	})
}

util.inherits(RecordStream, Duplex);

RecordStream.prototype._read = function read () {
	// nothing to do there, when data comes, push will be called
};

RecordStream.prototype._write = function _write (chunk, enc, cb) {

	if (Array.isArray (chunk)) {
		chunk = chunk.map (function (field) {
			return encodeValue (false, field, this.format);
		}.bind (this)).join ("\t");
	}

	if (typeof chunk === 'string') {
		if (chunk.substr (chunk.length - 1) !== "\n") {
			chunk = chunk + "\n";
		}
		chunk = Buffer.from ? Buffer.from (chunk, enc) : new Buffer (chunk, enc);
	}

	// there is no way to determine line ending efficiently for Buffer

	if (!(chunk instanceof Buffer)) {
		return this.emit ('error', new Error ('Incompatible format'));

	}

	this._canWrite = this.req.write (chunk);

	if (!this._canWrite) {
		this.req.once ('drain', function () {
			// wait for drain, then emit drain event calling cb ()
			cb ();
		}.bind (this));

		return;
	}

	cb ();

};

RecordStream.prototype.end = function write (chunk, enc, cb) {
	if (chunk)
		this.write (chunk, enc);

	this.req.once ('drain', function () {
		this.req.end ();
		cb && cb ();
	}.bind (this));
};

/*

Formats:

CSV: https://clickhouse.yandex/docs/en/formats/csv.html

During parsing, values could be enclosed or not enclosed in quotes.
Supported both single and double quotes. In particular,
Strings could be represented without quotes - in that case,
they are parsed up to comma or newline (CR or LF).
Contrary to RFC, in case of parsing strings without quotes,
leading and trailing spaces and tabs are ignored. As line delimiter,
both Unix (LF), Windows (CR LF) or Mac OS Classic (LF CR) variants are supported.

TSV/TabSeparated: https://clickhouse.yandex/docs/en/formats/tabseparated.html

In TabSeparated format, data is written by row. Each row contains values separated by tabs.
Each value is follow by a tab, except the last value in the row,
which is followed by a line break. Strictly Unix line breaks are assumed everywhere.
The last row also must contain a line break at the end. Values are written in text format,
without enclosing quotation marks, and with special characters escaped.

Minimum set of symbols that you must escape in TabSeparated format is tab, newline (LF) and backslash.

Arrays are formatted as a list of comma-separated values in square brackets.
Number items in the array are formatted as normally, but dates, dates with times,
and strings are formatted in single quotes with the same escaping rules as above.

As an exception, parsing DateTime is also supported in Unix timestamp format,
if it consists of exactly 10 decimal digits. The result is not time zone-dependent.
The formats YYYY-MM-DD hh:mm:ss and NNNNNNNNNN are differentiated automatically.

Values: https://clickhouse.yandex/docs/en/formats/values.html

Prints every row in parentheses. Rows are separated by commas.
There is no comma after the last row. The values inside the parentheses are also comma-separated.
Numbers are output in decimal format without quotes. Arrays are output in square brackets.
Strings, dates, and dates with times are output in quotes.
Escaping rules and parsing are same as in the TabSeparated format.
During formatting, extra spaces aren’t inserted, but during parsing,
they are allowed and skipped (except for spaces inside array values, which are not allowed).

Minimum set of symbols that you must escape in Values format is single quote and backslash.

Nulls: \N?

https://github.com/yandex/ClickHouse/issues/252
https://github.com/yandex/ClickHouse/issues/700
https://github.com/Infinidat/infi.clickhouse_orm/pull/42

*/

function encodeValue (wrapString, v, format) {
	switch (typeof v) {
		case 'string':
			return v.replace (/\\/g, '\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
		case 'number':
			if (isNaN (v))
				return 'nan';
			if (v === +Infinity)
				return '+inf';
			if (v === -Infinity)
				return '-inf';
			if (v === Infinity)
				return 'inf';
			return v.toString ();
		case 'object':
			if (v instanceof Date)
				return ("" + v.valueOf ()).substr (0, 10);
			if (v instanceof Array)
				return '[' + v.map (encodeValue.bind (this, true)).join (',') + ']'
			if (v === null)
				return '\\N';
			return '\\N';
			console.warn ('Cannot stringify [Object]:', v);
		case 'boolean':
			return v === true ? 1 : 0;
	}
}

function encodeTSRow (row) {
	return row.map (encodeValue.bind (this, false));
}

function parseError (e) {
	var fields = new Error (e.toString ('utf8'));
	e.toString ('utf8')
		.split (/\,\s+(?=e\.)/gm)
		.map (function (f) {
		f = f.trim ().split (/\n/gm).join ('');
		var m;
		if (m = f.match (/^(?:Error: )?Code: (\d+)$/)) {
			fields.code = parseInt (m[1]);
		} else if (m = f.match (/^e\.displayText\(\) = ([A-Za-z0-9\:]+:) ([^]+)/m)) {
			// e.displayText() = DB::Exception: Syntax error: failed at position 0: SEL
			fields.scope = m[1];
			fields.message = m[2];
			if (m = fields.message.match (/Syntax error: (?:failed at position (\d+)(?:\s*\(line\s*(\d+)\,\s+col\s*(\d+)\))?)/)) {
				// console.log ('!!! syntax error: pos %s line %s col %s', m[1], m[2], m[3]);
				fields.lineno = parseInt (m[2] || 1, 10);
				fields.colno  = parseInt (m[3] || m[1], 10);
			}
		} else if (m = f.match (/^e\.what\(\) = (.*)/)) {
			fields.type = m[1];
		} else {
			console.warn ('Unknown error field:', f)
		}

	});

	return fields;
}

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

				stream.push (null);
			}
		} catch (e) {
			return errorHandler (e);
		}

		cb && cb (null, data);
	});

}

function httpRequest (reqParams, reqData, cb) {

	if (reqParams.query) {
		reqParams.path = (reqParams.pathname || reqParams.path) + '?' + qs.stringify (reqParams.query);
	}

	var stream = new RecordStream ({
		recordFormat: 'TabSeparated'
	});

	var req = http.request (reqParams, httpResponseHandler.bind (this, stream, reqParams, reqData, cb));

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

		// we need to handle 2 and 3 and http stream must stay open in that cases
		if (chQuery.match (/VALUES$/i)) {
			reqData.finalized = false;

			// TODO: use values format
			// formatSuffix = ' FORMAT TabSeparated ';
		} else if (!chQuery.match (/VALUES/i)) {

			reqData.finalized = false;

			if (!chQuery.match (/FORMAT/i)) {
				// simplest format to use, only need to escape \t, \\ and \n
				formatSuffix = ' FORMAT TabSeparated ';
			} else {
				// otherwise, we will allow user to send prepared strings/buffers
			}
		}
	}

	// use query string to submit ClickHouse query — useful to mock CH server
	if (this.options.useQueryString) {
		queryObject.query = chQuery + ((options.omitFormat) ? '' : formatSuffix);
		reqParams.method = 'GET';
	} else {
		reqData.query = chQuery + (options.omitFormat ? '' : formatSuffix);
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
