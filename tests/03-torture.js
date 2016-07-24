var ClickHouse = require ("../src/clickhouse");

var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var assert = require ("assert");

var memwatch = require('memwatch-next');

describe ("torturing", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		lastSuite;

	before (function () {
		memwatch.on ('leak', function (info) {
			console.log (info);
		});

		console.log (process.memoryUsage());
	})

	it ("selects 1 million using async parser 1", function (done) {

		this.timeout(50000);

		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
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

	it.skip ("selects 1 million using sync parser 1", function (done) {

		this.timeout(50000);

		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
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

	it ("selects system.columns using async parser 2", function (done) {

		this.timeout(50000);

		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
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

	it ("selects system.columns using sync parser 2", function (done) {

		this.timeout(50000);

		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
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

	it ("selects system.columns using async parser 3", function (done) {

		this.timeout(50000);

		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
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

	it ("selects system.columns using sync parser 3", function (done) {

		this.timeout(50000);

		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
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


	afterEach (function (done) {
		console.log ('after', lastSuite,  process.memoryUsage());

		setTimeout (function () {
			console.log ('before next',  process.memoryUsage());
			done ();
		}, 1000);
	})

});
