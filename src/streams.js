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
				processLine.rows.push (JSON.parse (objBuffer + l[0]));
				objBuffer = undefined;
			} else if (l === '{' || l === '[') {
				objBuffer = l;
			} else if (l.match (/^],?$/)) {
				state = 'topKeys';
			} else if (objBuffer === undefined) {
				processLine.rows.push (JSON.parse (l[l.length - 1] !== ',' ? l : l.substr (0, l.length - 1)));
			} else {
				objBuffer += l;
			}
		}

	}

	processLine.columns            = [];
	processLine.rows               = [];
	processLine.supplementalString = '{';


	return processLine;
}

/**
 * Duplex stream to work with database
 * @param {object} [options] options
 * @param {object} [options.format] how to format filelds/rows internally
 */
function RecordStream (options) {
	// if (! (this instanceof RecordStream)) return new RecordStream(options);
	options = options || {};
	options.objectMode = true;
	Duplex.call (this, options);

	this.format = options.format;

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

RecordStream.prototype._destroy = function _destroy (err, cb) {

	process.nextTick (function () {
		RecordStream.super_.prototype._destroy.call (this, err, function (destroyErr) {
			this.req.destroy (err);
			cb (destroyErr || err);
		}.bind (this));
	}.bind (this));
}

RecordStream.prototype.end = function end (chunk, enc, cb) {

	RecordStream.super_.prototype.end.call (this, chunk, enc, function () {
		this.req.end (cb);
	}.bind (this));
};


module.exports = {
	JSONStream: JSONStream,
	RecordStream: RecordStream
};
