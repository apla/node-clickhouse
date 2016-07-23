var ClickHouse = require ("../src/clickhouse");

var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var assert = require ("assert");

describe ("real server queries", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123;

	it ("pings", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.ping (function (err, ok) {
			assert (!err);
			assert (ok === "Ok.\n", "ping response should be 'Ok.\\n'");
			done ();
		});
	});

	it ("selects using callback", function (done) {
		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
		ch.query ("SELECT 1", function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			done ();
		});
	});

	it ("selects using callback and query submitted in the POST body", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("SELECT 1", function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			done ();
		});
	});

	it ("selects numbers using callback", function (done) {
		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
		ch.query ("SELECT number FROM system.numbers LIMIT 10", function (err, result) {
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
		ch.query ("SELECT number FROM system.numbers LIMIT 10", function (err, result) {
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


});
