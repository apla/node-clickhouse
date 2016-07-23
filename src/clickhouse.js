var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var Duplex = require('stream').Duplex;
var util = require('util');

if (typeof Object.assign != 'function') {
	Object.assign = function(target) {
		'use strict';
		if (target == null) {
			throw new TypeError('Cannot convert undefined or null to object');
		}

		target = Object(target);
		for (var index = 1; index < arguments.length; index++) {
			var source = arguments[index];
			if (source != null) {
				for (var key in source) {
					if (Object.prototype.hasOwnProperty.call(source, key)) {
						target[key] = source[key];
					}
				}
			}
		}
		return target;
	};
}

function RecordStream (options) {
	if (! (this instanceof RecordStream)) return new RecordStream(options);
	if (! options) options = {};
	options.objectMode = true;
	Duplex.call(this, options);
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
		//another chunk of data has been received, so append it to `str`
		response.on ('data', function (chunk) {
			if (str) {
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

			if (response.statusCode === 200 && !('content-type' in response.headers)) {
				// probably this is a ping response or any other successful response with *empty* body
				stream.push (null);
				cb && cb (null, str.toString ('utf8'));
				return;
			}

			try {
				data = JSON.parse (str.toString ('utf8'));

				if (data.meta) {
					stream.emit ('metadata', data.meta);
				}

				if (data.data) {
					// no highWatermark support
					data.data.forEach (function (record) {
						stream.push (record);
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

	"protocol auth host hostname port path localAddress headers agent createConnection".split (" ").forEach (function (k) {
		if (this.options[k] !== undefined)
			urlObject[k] = this.options[k];
	}, this);

	urlObject.method = 'POST';

	urlObject.path = urlObject.path || '/';

	return urlObject;
}

ClickHouse.prototype.query = function (chQuery, cb) {

	chQuery = chQuery.trim ();

	// we're adding `queryOptions` passed for constructor if any
	var queryObject = Object.assign ({}, this.options.queryOptions);

	var reqData = {
		finalized: true // allows to write records into connection stream
	};

	// use query string to submit ClickHouse query — usefuful to mock CH server
	if (this.options.useQueryString) {
		queryObject.query = chQuery + (this.options.omitFormat ? '' : ' FORMAT JSONCompact');
	} else {
		reqData.query = chQuery + (this.options.omitFormat ? '' : ' FORMAT JSONCompact');
	}

	var reqParams = this.getReqParams ();

	reqParams.path += '?' + qs.stringify (queryObject);

	if (chQuery.match (/^INSERT/i)) {

		// There is some variants according to the documentation:
		// 1. Values already available in the query: INSERT INTO t VALUES (1),(2),(3)
		// 2. Values must me provided with POST data: INSERT INTO t VALUES
		// 3. Same as previous but without VALUES keyword: INSERT INTO t FORMAT Values
		// 4. Insert from SELECT: INSERT INTO t SELECT…
		if (chQuery.match (/(?:FORMAT \w+|VALUES)$/i)) {
			reqData.finalized = false;
		}
	}

	var stream = httpRequest (reqParams, reqData, cb);

	return stream;
}

ClickHouse.prototype.ping = function (cb) {

	var reqParams = this.getReqParams ();

	var stream = httpRequest (reqParams, {finalized: true}, cb);

	return stream;
}

module.exports = ClickHouse;
