var util   = require ('util');
var Duplex = require ('stream').Duplex;

var encodeRow = require ('./process-db-value').encodeRow;

/**
 * Simplified JSON stream parser
 * @param   {object}   emitter parser will emit metadata event when metadata is available
 * @returns {function} string consumer
 */
function JSONStream (emitter) {
	// states are:
	// start: { encountered, look for keys
	// meta: meta encountered with `[`, parse everything until `]`
	// data: data encountered with `[`, just parse every string until `]`
	// other keys: concatenate until the end, then prepend `{` and JSON.parse
	var state = null;

	var objBuffer;

	function processLine (l) {
		// console.log ("LINE>", l);
		l = l.trim ();
		if (!l.length)
			return;

		var lineRows = [];

		if (state === null) {
			// first string should contains `{`
			if (l === '{') {
				state = 'topKeys';
			}
		} else if (state === 'topKeys') {
			// console.log ('TOP>', l);
			if (l === '"meta":') {
				state = 'meta';
			} else if (l === '"data":') {
				state = 'data';
			} else if (l === '"meta": [') {
				state = 'meta-array';
			} else if (l === '"data": [') {
				state = 'data-array';
			} else {
				processLine.supplementalString += l;
			}
		} else if (state === 'meta') {
			if (l === '[') {
				state = 'meta-array';
			}
		} else if (state === 'data') {
			if (l === '[') {
				state = 'data-array';
			}
		} else if (state === 'meta-array') {
			if (l.match (/^},?$/)) {
				processLine.columns.push (JSON.parse (objBuffer + '}'));
				objBuffer = undefined;
			} else if (l === '{') {
				objBuffer = l;
			} else if (l.match (/^],?$/)) {

				emitter.emit ('metadata', processLine.columns);

				state = 'topKeys';
			} else {
				objBuffer += l;
			}
		} else if (state === 'data-array') {
			if (l.match (/^[\]\}],?$/) && objBuffer) {
				lineRows.push (JSON.parse (objBuffer + l[0]));
				objBuffer = undefined;
			} else if (l === '{' || l === '[') {
				objBuffer = l;
			} else if (l.match (/^],?$/)) {
				state = 'topKeys';
			} else if (objBuffer === undefined) {
				lineRows.push (JSON.parse (l[l.length - 1] !== ',' ? l : l.substr (0, l.length - 1)));
			} else {
				objBuffer += l;
			}
		}

		return lineRows.length ? lineRows : undefined;

	}

	processLine.columns            = [];
	// processLine.rows               = [];
	processLine.supplementalString = '{';


	return processLine;
}

function makeEmptyBuffer () {
	return Buffer.alloc ? Buffer.alloc (0) : new Buffer (0);
}

/**
 * Duplex stream to work with database
 * @param {object} [options] options
 * @param {object} [options.format] how to format filelds/rows internally
 */
function RecordStream (options) {
	// if (! (this instanceof RecordStream)) return new RecordStream(options);
	options = options || {};
	options.writableObjectMode = true;
	options.readableObjectMode = options.format && options.format.match (/^(?:JSON|JSONCompact)$/) ? true : false;
	Duplex.call (this, options);

	this.format = options.format;

	this._writeBuffer = [];
	this._canWrite = false;
	this._canRead  = false;

	Object.defineProperty (this, 'req', {
		get: function () {return this._req},
		set: function (req) {
			this._req = req;
			this._canWrite = true;
		}
	})

	Object.defineProperty (this, 'res', {
		get: function () {return this._res},
		set: function (res) {
			this._res = res;
			this._canRead = true;

			if (res.statusCode === 200) {
				this._resData  = makeEmptyBuffer ();
			} else {
				this._resError = makeEmptyBuffer ();
			}

			this.jsonParser = new JSONStream (this);

			this.transferred = 0;

			res.on ('readable', this.readData.bind (this));
			res.on ('end', this.endResponse.bind (this));

			console.log ('RES');
		}
	})
}

util.inherits(RecordStream, Duplex);

RecordStream.prototype._read = function _read () {
	if (!this.res) {
		// why?
		return;
		console.log ('=====================');
	}
	this._res.resume ();
};

RecordStream.prototype.consume = function consume (stream) {
	var consumed = makeEmptyBuffer (),
		chunk;

	if (stream._readableState.objectMode === true) {
		consumed = [];
		while (null !== (chunk = stream.read())) {
			consumed.push (chunk);
		}
		return consumed;
	}

	while (null !== (chunk = stream.read())) {
		console.log (consumed, chunk);
		consumed = Buffer.concat ([consumed, chunk]);
	}

	return consumed;
};



RecordStream.prototype.readData = function readData () {

	console.log ('time to read');

	var chunk;

	var dataToPush;

	// if successful response from clickhouse
	if (this._resData) {

		while (null !== (chunk = this.res.read())) {
			this._resData = Buffer.concat ([this._resData, chunk]);
			this.transferred += chunk.length;
		}

		// format can be parsed by line
		if (!this.format || !this.format.match (/^(?:BlockTabSeparated|CSV|CSVWithNames|JSON|JSONCompact|JSONEachRow|Pretty|PrettyCompact|PrettyCompactMonoBlock|PrettyNoEscapes|PrettyCompactNoEscapes|PrettySpaceNoEscapes|PrettySpace|TabSeparated|TabSeparatedWithNames|TabSeparatedWithNamesAndTypes|TSKV|Values|Vertical|XML)$/)) {
			dataToPush = [this._resData];
			this._resData = makeEmptyBuffer ();
		} else {
			// store in buffer anything after
			var newLinePos = this._resData.lastIndexOf ("\n");

			dataToPush = this._resData.slice (0, newLinePos);

			if (this.format.match (/^(?:JSON|JSONCompact)$/)) {
				dataToPush = dataToPush.toString ().split ('\n')
					.map (function (l) {return this.jsonParser (l)}.bind (this))
					.filter (function (v) {return v})
					.reduce (function (acc, v) {return acc.concat (v)}, []);
			} else {
				dataToPush = [dataToPush];
			}

			this._resData = this._resData.slice (newLinePos + 1);

		}
	} else {
		// assume error
		while (null !== (chunk = this.res.read())) {
			this._resError = Buffer.concat([this._resError, chunk]);
		}

	}

	if (dataToPush && !dataToPush.every (function (data) {return this.push (data);}.bind (this)))
		this.res.pause ();

};

RecordStream.prototype.cleanBuffer = function cleanBuffer () {
	// if (!this.listeners ('data').length && !this.listeners ('readable').length) {
		this._readableState.length = 0;
	// }
	this.push (null);
	this.read ();
}

RecordStream.prototype.endResponse = function endResponse () {

	console.log ('time to end');

	// debug (response.headers);

	/*
	if (this._resData || this._resError) {
		this.readData ();
	}
	*/

	console.log (4567456, this._readableState.length, this._readableState.ended);

	if (this._resError) {
		return this.res.emit ('error', this._resError);
	}

	var data;

	var contentType = this.res.headers['content-type'];

	if (this.res.statusCode === 200 && (
		!contentType
		|| contentType.indexOf ('text/plain') === 0
		|| contentType.indexOf ('text/html') === 0 // WTF: xenial - no content-type, precise - text/html
	)) {
		// probably this is a ping response or any other successful response with *empty* body
		this.push (null);
		this.emit ('response-end');

		return;
	}

	console.log (2134);

	var supplemental = {};

	// we already pushed all the data
	if (this.jsonParser.columns.length) {
		try {
			supplemental = JSON.parse (this.jsonParser.supplementalString + str.toString ('utf8'));
		} catch (e) {
			// TODO
		}
		this.supplemental = supplemental;

		// end stream
		this.push (null);
		this.emit ('response-end');

		return;
	}

	// one shot data parsing, should be much faster for smaller datasets
	try {
		data = JSON.parse (str.toString ('utf8'));

		data.transferred = symbolsTransferred;

		if (data.meta) {
			this.emit ('metadata', data.meta);
		}

		if (data.data) {
			// no highWatermark support
			data.data.forEach (function (row) {
				this.push (row);
			}.bind (this));

			this.emit ('response-end');
			this.push (null);
		}
	} catch (e) {
		if (this.format.match (/^(JSON|JSONCompact)$/)) {
			return this.res.emit ('error', e);
		}
	}

	// this.push (null);
};


// http://ey3ball.github.io/posts/2014/07/17/node-streams-back-pressure/
// https://nodejs.org/en/docs/guides/backpressuring-in-streams/
// https://nodejs.org/docs/latest/api/stream.html#stream_implementing_a_writable_stream

// TODO: implement _writev

RecordStream.prototype._write = function _write (chunk, enc, cb) {

	if (!Buffer.isBuffer (chunk) && typeof chunk !== 'string')
		chunk = encodeRow (chunk, this.format);

	// there is no way to determine line ending efficiently for Buffer
	if (typeof chunk === 'string') {
		if (chunk.substr (chunk.length - 1) !== "\n") {
			chunk = chunk + "\n";
		}
		chunk = Buffer.from ? Buffer.from (chunk, enc) : new Buffer (chunk, enc);
	}

	if (!(chunk instanceof Buffer)) {
		return this.emit ('error', new Error ('Incompatible format'));
	}

	// node stores further write requests into `_writableState.bufferedRequest` chain
	// until cb is called.
	this._canWrite = this.req.write (chunk, cb);

};

RecordStream.prototype.end = function end (chunk, enc, cb) {

	RecordStream.super_.prototype.end.call (this, chunk, enc, function () {
		this.req.end (cb);
	}.bind (this));
};


module.exports = {
	JSONStream: JSONStream,
	RecordStream: RecordStream
};
