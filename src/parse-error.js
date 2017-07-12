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

module.exports = parseError;
