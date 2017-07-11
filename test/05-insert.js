var ClickHouse = require ("../src/clickhouse");

var assert = require ("assert");

describe ("insert data", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		dbCreated = false,
		dbName = 'node_clickhouse_test_insert';

	before (function () {
		var ch = new ClickHouse ({host: host, port: port});
		var okFn = function () {return Promise.resolve()};
		return ch.querying ("DROP DATABASE " + dbName).then (
			okFn, okFn
		).then (function () {
			return ch.querying ("CREATE DATABASE " + dbName);
		}).then (function (result) {
			dbCreated = true;
			// console.log (result);
			return Promise.resolve ();
		});
	});

	it ("creates a table", function (done) {
		var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: dbName}});
		ch.query ("CREATE TABLE t (a UInt8) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts some data", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("INSERT INTO t VALUES (1),(2),(3)", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err);

			// let's wait a few seconds
			setTimeout (function () {done ()}, 500);
		});
	});

	it ("inserts some prepared data using stream", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		var stream = ch.query ("INSERT INTO t", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			console.log (err, result);

			// let's wait a few seconds
			setTimeout (function () {done ()}, 500);
		});

		stream.write ('8');
		stream.write ('73');
		stream.write (Buffer.from ? Buffer.from ('42') : new Buffer ('42'));
		stream.end ();
	});

	after (function (done) {

		if (!dbCreated)
			return done;

		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("DROP DATABASE " + dbName, function (err, result) {
			assert (!err);

			// console.log (result);

			done ();
		});
	});

});
