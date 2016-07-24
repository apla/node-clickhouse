
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

module.exports = JSONStream;
