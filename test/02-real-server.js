var ClickHouse = require ("../src/clickhouse");

var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var assert = require ("assert");

describe ("real server queries", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		dbCreated = false;

	it ("pings", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.ping (function (err, ok) {
			assert (!err);
			assert.equal (ok, "Ok.\n", "ping response should be 'Ok.\\n'");
			done ();
		});
	});

	it ("selects using callback", function (done) {
		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
		ch.query ("SELECT 1", {syncParser: true}, function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			done ();
		});
	});

	it ("returns error", function (done) {
		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
		var stream = ch.query ("ABCDEFGHIJKLMN", {syncParser: true}, function (err, result) {
			// assert (err);
			// done ();
		});

		stream.on ('error', function (err) {
			assert (err);
			console.log (err);
			done();
		});
	});

	it ("selects using callback and query submitted in the POST body", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("SELECT 1", {syncParser: true}, function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			done ();
		});
	});

	it ("selects numbers using callback", function (done) {
		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
		ch.query ("SELECT number FROM system.numbers LIMIT 10", {syncParser: true}, function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			assert (result.meta.constructor === Array, "metadata is an array with column descriptions");
			assert (result.meta[0].name === "number");
			assert (result.data.constructor === Array, "data is a row set");
			assert (result.data[0].constructor === Array, "each row contains list of values (using FORMAT JSONCompact)");
			assert (result.data[9][0] === "9"); // this should be corrected at database side
			assert (result.rows === 10);
			assert (result.rows_before_limit_at_least === 10);
			done ();
		});
	});

	it ("selects numbers using callback and query submitted in the POST body", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("SELECT number FROM system.numbers LIMIT 10", {syncParser: true}, function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `meta` key to represent rows");
			assert (result.data, "result should be Object with `data` key to represent column info");
			assert (result.meta.constructor === Array, "metadata is an array with column descriptions");
			assert (result.meta[0].name === "number");
			assert (result.data.constructor === Array, "data is a row set");
			assert (result.data[0].constructor === Array, "each row contains list of values (using FORMAT JSONCompact)");
			assert (result.data[9][0] === "9"); // this should be corrected at database side
			assert (result.rows === 10);
			assert (result.rows_before_limit_at_least === 10);

			done ();
		});
	});

	it ("selects numbers asynchronously using events and query submitted in the POST body", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		var rows = [];
		var stream = ch.query ("SELECT number FROM system.numbers LIMIT 10", function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `meta` key to represent rows");
			assert (rows, "result should be Object with `data` key to represent column info");
			assert (result.meta.constructor === Array, "metadata is an array with column descriptions");
			assert (result.meta[0].name === "number");
			assert (rows.length === 10, "total 10 rows");
			assert (rows[0].constructor === Array, "each row contains list of values (using FORMAT JSONCompact)");
			assert (rows[9][0] === "9"); // this should be corrected at database side
			assert (result.rows === 10);
			assert (result.rows_before_limit_at_least === 10);

			done ();
		});
		stream.on ('data', function (row) {
			rows.push (row);
		})
	});

	it ("selects numbers asynchronously using stream and query submitted in the POST body", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		var metadata;
		var rows = [];
		var stream = ch.query ("SELECT number FROM system.numbers LIMIT 10");

		stream.on ('metadata', function (_meta) {
			metadata = _meta;
		});
		stream.on ('data', function (row) {
			rows.push (row);
		});
		stream.on ('error', function (err) {
			assert (err);
		});
		stream.on ('end', function () {
			assert (metadata, "result should be Object with `meta` key to represent rows");
			assert (rows, "result should be Object with `data` key to represent column info");
			assert (metadata.constructor === Array, "metadata is an array with column descriptions");
			assert (metadata[0].name === "number");
			assert (rows.length === 10, "total 10 rows");
			assert (rows[0].constructor === Array, "each row contains list of values (using FORMAT JSONCompact)");
			assert (rows[9][0] === "9"); // this should be corrected at database side
			assert (stream.supplemental.rows === 10);
			assert (stream.supplemental.rows_before_limit_at_least === 10);

			done ();
		});
	});

	it ("selects number objects asynchronously using stream and query submitted in the POST body", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		var metadata;
		var rows = [];
		var stream = ch.query ("SELECT number FROM system.numbers LIMIT 10", {dataObjects: true});

		stream.on ('metadata', function (_meta) {
			metadata = _meta;
		});
		stream.on ('data', function (row) {
			rows.push (row);
		});
		stream.on ('error', function (err) {
			assert (err);
		});
		stream.on ('end', function () {
			assert (metadata, "result should be Object with `meta` key to represent rows");
			assert (rows, "result should be Object with `data` key to represent column info");
			assert (metadata.constructor === Array, "metadata is an array with column descriptions");
			assert (metadata[0].name === "number");
			assert (rows.length === 10, "total 10 rows");
			assert ('number' in rows[0], "each row contains fields (using FORMAT JSON)");
			assert (rows[9].number === "9"); // this should be corrected at database side
			assert (stream.supplemental.rows === 10);
			assert (stream.supplemental.rows_before_limit_at_least === 10);

			done ();
		});
	});

	it ("selects from system columns", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("SELECT * FROM system.columns", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("creates a database", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("CREATE DATABASE node_clickhouse_test", function (err, result) {
			assert (!err);

			dbCreated = true;
			// console.log (result);

			done ();
		});
	});

	it ("creates a table", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("CREATE TABLE node_clickhouse_test.t (a UInt8) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("drops a table", function (done) {
		var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: 'node_clickhouse_test'}});
		ch.query ("DROP TABLE t", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("creates a table", function (done) {
		var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: 'node_clickhouse_test'}});
		ch.query ("CREATE TABLE t (a UInt8) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts some data", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("INSERT INTO t VALUES (1),(2),(3)", {queryOptions: {database: 'node_clickhouse_test'}}, function (err, result) {
			assert (!err);

			// let's wait a few seconds
			setTimeout (function () {done ()}, 500);
		});
	});

	it ("gets back data", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		var rows = [];
		var stream = ch.query ("select a FROM t", {queryOptions: {database: 'node_clickhouse_test'}});

		stream.on ('data', function (row) {
			rows.push (row);
		});

		stream.on ('end', function () {

			done();
		});
	});


	after (function (done) {

		if (!dbCreated)
			return done;

		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("DROP DATABASE node_clickhouse_test", function (err, result) {
			assert (!err);

			// console.log (result);

			done ();
		});
	});
});
