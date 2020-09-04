var ClickHouse = require ("../src/clickhouse");

var assert = require ("assert");

describe ("select data from database", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		dbCreated = false;

	it ("selects using callback", function (done) {
		var ch = new ClickHouse ({host: host, port: port, readonly: true});
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
		var ch = new ClickHouse ({host: host, port: port, readonly: true});
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

	it ("selects numbers using promise should already have parsed data", function () {
		var ch = new ClickHouse ({host: host, port: port, readonly: true});
		return ch.querying ("SELECT number FROM system.numbers LIMIT 10").then (function (result) {
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

	it ("selects numbers as dataObjects using promise", function () {
		var ch = new ClickHouse ({host: host, port: port, readonly: true, dataObjects: true});
		return ch.querying ("SELECT number FROM system.numbers LIMIT 10").then (function (result) {
			assert (result.meta, "result should be Object with `data` key to represent rows");
			assert (result.data, "result should be Object with `meta` key to represent column info");
			assert (result.meta.constructor === Array, "metadata is an array with column descriptions");
			assert (result.meta[0].name === "number");
			assert (result.data.constructor === Array, "data is a row set");
			assert (result.data[0].constructor === Object, "each row contains key-valued rows (using FORMAT JSON)");
			assert (result.data[9].number === "9");
			assert (result.data.length === 10);
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

	it("can cancel an ongoing select by calling destroy", function (done) {
		var RecordStream = require("../src/streams").RecordStream;
		if (typeof RecordStream.prototype.destroy !== "function") {
			// If current Node.js version lacks Stream#destroy impl, skip the test
			this.skip ();
			return;
		}

		var ch = new ClickHouse ({host: host, port: port});
		var rows = [];
		var limit = 10000;
		var stream = ch.query ("SELECT number FROM system.numbers LIMIT " + limit, function () {
			assert (stream.destroyed);
			assert (rows.length < limit);

			done ();
		});

		stream.on ('data', function (row) {
			rows.push (row);
		});

		stream.once ('data', function () {
			stream.destroy ();
		});
	});

	it("select query with WITH clause will produces result formatted ", function (done) {
		var ch = new ClickHouse({ host: host, port: port, format: "JSON" });
		ch.query("WITH 10 as pagesize SELECT 1", { syncParser: true }, function (err, result) {
			assert(!err);
			assert(result.meta, "result should be Object with `data` key to represent rows");
			assert(result.data, "result should be Object with `meta` key to represent column info");
			assert(Object.prototype.toString.call(result.data[0]) === '[object Object]', "data should be formatted JSON" )
			done();
		});
	})
});
