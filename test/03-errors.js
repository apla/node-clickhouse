var ClickHouse = require ("../src/clickhouse");

var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var assert = require ("assert");

describe ("error parsing", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		dbCreated = false;

	it ("will not throw on http error", function (done) {
		var ch = new ClickHouse ({host: host, port: 59999, readonly: true});
		var stream = ch.query ("ABCDEFGHIJKLMN", {syncParser: true}, function (err, result) {
			// assert (err);
			// done ();
		});

		stream.on ('error', function (err) {
			done();
		});
	});

	it ("returns error for unknown sql", function (done) {
		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var stream = ch.query ("ABCDEFGHIJKLMN", {syncParser: true}, function (err, result) {
			// assert (err);
			// done ();
		});

		stream.on ('error', function (err) {

			assert (err);
			assert (err.message.match (/Syntax error/));
			assert.equal (err.lineno, 1, "line number should eq 1");
			assert.equal (err.colno, 1, "col  number should eq 1");
			// console.log (err);
			done();
		});
	});

	it ("returns error with line/col for sql with garbage", function (done) {
		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var stream = ch.query ("CREATE\n\t\tABCDEFGHIJKLMN", {syncParser: true}, function (err, result) {
			// assert (err);
			// done ();
		});

		stream.on ('error', function (err) {

			assert (err);
			assert (err.message.match (/Syntax error/));
			assert.equal (err.lineno, 2, "line number should eq 2");
			assert.equal (err.colno, 3, "col  number should eq 3");
			// console.log (err);
			done();
		});
	});

	it ("returns error for empty sql", function (done) {
		var ch = new ClickHouse ({host: host, port: port, readonly: true});

		function countCallbacks (err) {
			countCallbacks.count = (countCallbacks.count || 0) + 1;

			if (countCallbacks.count === 2) {
				//
				done ();
			}
		}

		var stream = ch.query ("-- nothing here", {syncParser: true}, function (err, result) {
			countCallbacks (err);
			// assert (err);
			// done ();
		});

		stream.on ('error', function (err) {

			// console.log (err); // failed at end of query

			assert (err);
			assert (err.message.match (/Empty query/) || err.message.match (/Syntax error/), err);
			// clickhouse doesn't return lineno and colno for some queries
			// assert.ifError ('lineno' in err);
			// assert.ifError ('colno'  in err);

			countCallbacks (err);
		});
	});

	it ("returns error for unknown table", function (done) {
		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		var stream = ch.query ("SELECT * FROM xxx", {syncParser: true}, function (err, result) {
			assert (err);
		});

		stream.on ('error', function (err) {

			assert (err);
			assert.ifError (err.message.match (/Syntax error/));
			// clickhouse doesn't return lineno and colno for some queries
			// assert.ifError ('lineno' in err);
			// assert.ifError ('colno'  in err);

			done();
		});
	});

	// TODO turn it on when fixed https://github.com/ClickHouse/ClickHouse/issues/9914
	// it ("returns error for writing in readonly mode", function (done) {
	// 	var ch = new ClickHouse ({host: host, port: port});
	// 	ch.querying ("CREATE TABLE xxx (a UInt8) ENGINE = Memory()", {readonly: true})
	// 		.then(() => done('Should fail in readonly mode'))
	// 		.catch(() => done())
	// });



});
