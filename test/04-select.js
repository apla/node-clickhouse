var ClickHouse = require ("../src/clickhouse");

var assert = require ("assert");

describe ("select data from database", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		dbCreated = false;

	it ("selects using callback", function (done) {
		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
		ch.query ("SELECT 1", {syncParser: true}, function (err, result) {
			assert (!err);
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			done ();
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

	it ("selects numbers using promise", function () {
		var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
		return ch.querying ("SELECT number FROM system.numbers LIMIT 10", {syncParser: true}).then (function (result) {
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			assert (result.meta.constructor === Array, "metadata is an array with column descriptions");
			assert (result.meta[0].name === "number");
			assert (result.data.constructor === Array, "data is a row set");
			assert (result.data[0].constructor === Array, "each row contains list of values (using FORMAT JSONCompact)");
			assert (result.data[9][0] === "9"); // this should be corrected at database side
			assert (result.rows === 10);
			assert (result.rows_before_limit_at_least === 10);
			return Promise.resolve ();
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

	it ("select data in unsupported format", function (done) {

		var ch = new ClickHouse ({host: host, port: port});

		ch.query ("SELECT number FROM system.numbers LIMIT 10", {format: "CSV"}, function (err, result) {

			assert (!err, err);

			assert (result.match (/1\n2\n3\n4\n5\n6\n7\n8\n9/));

			done ();

		});
	});

});
