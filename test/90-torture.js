var ClickHouse = require ("../src/clickhouse");

var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var assert = require ("assert");

var memwatch;
try {
	var nodeMajorVersion = parseInt(process.version.substr(1));
	if (nodeMajorVersion >= 10) {
		memwatch = require('memwatch');
	} else {
		memwatch = require('memwatch-next');
	}
} catch (err) {
	if (process.env.TORTURE) {
		console.error ("For the torture test you should install memwatch-next (node 8) or @airbnb/memwatch (node >= 10)");
		console.error (err);
		process.exit (1);
	}
}

// replace with it, if you want to run this test suite
var method  = process.env.TORTURE ? it : it.skip;
var timeout = 60000;

function checkUsageAndGC (used, baseline) {
	function inMB (v) {
		return (v/Math.pow (2, 20)).toFixed (1) + 'MB';
	}
	var usage = 'rss heapTotal heapUsed external'.split (' ').map (function (k) {
		var delta = used[k] - baseline[k];
		return k + ' ' + inMB (used[k]) + ' / +' + inMB (delta);
	});

	console.log (usage.join (' '));

	gc ();
}

describe ("torturing", function () {

	global.gc && gc();

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		lastSuite,
		baselineMemoryUsage = process.memoryUsage();

	before (function () {
		memwatch && memwatch.on ('leak', function (info) {
			console.log (info);
		});

		// console.log (process.memoryUsage());
	})

	method ("selects 1 million using async parser", function (done) {

		this.timeout (timeout);

		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var queryCount = 0;
		var symbolsTransferred = 0;

		function runQuery () {
			var stream = ch.query ("SELECT number FROM system.numbers LIMIT 1000000", function (err, result) {
				symbolsTransferred += result.transferred;
				queryCount ++;
				if (queryCount < 10)
					return runQuery ();
				console.log ('symbols transferred:', symbolsTransferred);
				done();
			});

			stream.on ('error', function (err) {
				done (err);
			});

			stream.on ('data', function (row) {
				// just throw away that data
			});
		}

		runQuery ();

		lastSuite = 'async';
	});

	// enable this test separately
	it.skip ("selects 1 million using sync parser", function (done) {

		this.timeout (timeout);

		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var queryCount = 0;
		var symbolsTransferred = 0;

		function runQuery () {
			var stream = ch.query ("SELECT number FROM system.numbers LIMIT 1000000", {syncParser: true}, function (err, result) {
				symbolsTransferred += result.transferred;
				queryCount ++;
				if (queryCount < 10)
					return runQuery ();
				console.log ('symbols transferred:', symbolsTransferred);
				done();
			});

			stream.on ('error', function (err) {
				done (err);
			});

			stream.on ('data', function (row) {
				// just throw away that data
			});
		}

		runQuery ();

		lastSuite = 'sync';
	});

	method ("selects system.columns using async parser #1", function (done) {

		this.timeout (timeout);

		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var queryCount = 0;
		var symbolsTransferred = 0;

		function runQuery () {
			var stream = ch.query ("SELECT * FROM system.columns", function (err, result) {
				symbolsTransferred += result.transferred;
				queryCount ++;
				if (queryCount < 10000)
					return runQuery ();
				console.log ('symbols transferred:', symbolsTransferred);
				done();
			});

			stream.on ('error', function (err) {
				done (err);
			});

			stream.on ('data', function (row) {
				// just throw away that data
			});
		}

		runQuery ();

		lastSuite = 'async';
	});

	method ("selects system.columns using sync parser #1", function (done) {

		this.timeout (timeout);

		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var queryCount = 0;
		var symbolsTransferred = 0;

		function runQuery () {
			var stream = ch.query ("SELECT * FROM system.columns", {syncParser: true}, function (err, result) {
				symbolsTransferred += result.transferred;
				queryCount ++;
				if (queryCount < 10000)
					return runQuery ();
				console.log ('symbols transferred:', symbolsTransferred);
				done();
			});

			stream.on ('error', function (err) {
				done (err);
			});

			stream.on ('data', function (row) {
				// just throw away that data
			});
		}

		runQuery ();

		lastSuite = 'sync';
	});

	method ("selects system.columns using async parser #2", function (done) {

		this.timeout (timeout);

		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var queryCount = 0;
		var symbolsTransferred = 0;

		function runQuery () {
			var stream = ch.query ("SELECT * FROM system.columns", function (err, result) {
				symbolsTransferred += result.transferred;
				queryCount ++;
				if (queryCount < 10000)
					return runQuery ();
				console.log ('symbols transferred:', symbolsTransferred);
				done();
			});

			stream.on ('error', function (err) {
				done (err);
			});

			stream.on ('data', function (row) {
				// just throw away that data
			});
		}

		runQuery ();

		lastSuite = 'async';
	});

	method ("selects system.columns using sync parser #2", function (done) {

		this.timeout (timeout);

		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var queryCount = 0;
		var symbolsTransferred = 0;

		function runQuery () {
			var stream = ch.query ("SELECT * FROM system.columns", {syncParser: true}, function (err, result) {
				symbolsTransferred += result.transferred;
				queryCount ++;
				if (queryCount < 10000)
					return runQuery ();
				console.log ('symbols transferred:', symbolsTransferred);
				done();
			});

			stream.on ('error', function (err) {
				done (err);
			});

			stream.on ('data', function (row) {
				// just throw away that data
			});
		}

		runQuery ();

		lastSuite = 'sync';
	});

	afterEach (function () {

		checkUsageAndGC (process.memoryUsage(), baselineMemoryUsage)

		// console.log ('after', lastSuite,  process.memoryUsage());

	})

});
