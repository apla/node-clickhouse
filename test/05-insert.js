var ClickHouse = require ("../src/clickhouse");

var assert = require ("assert");
var fs     = require ("fs");
var crypto = require ("crypto");

var encodeValue = require ('../src/process-db-value').encodeValue;
var encodeRow   = require ('../src/process-db-value').encodeRow;

function randomDate(start, end) {
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateData (format, fileName, cb) {
	var rs = fs.createWriteStream (fileName);
	for (var i = 0; i < 10; i++) {

		rs.write (
			encodeRow ([
				Math.ceil (Math.random () * 1000),
				Math.random () * 1000,
				crypto.randomBytes(20).toString('hex'),
				randomDate(new Date(2012, 0, 1), new Date())
			], format)
		);
	}

	rs.end (function () {
		cb ();
	});
}

var testDate = new Date ();
var testDateISO = testDate.toISOString ().replace (/\..*/, '').replace ('T', ' ');

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

	it ("inserts some prepared data using stream", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		var stream = ch.query ("INSERT INTO t", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			ch.query ("SELECT * FROM t", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

				assert.equal (result.data[0][0], 8);
				assert.equal (result.data[1][0], 73);
				assert.equal (result.data[2][0], 42);

				done ();

			});
		});

		stream.write ('8');
		stream.write ('73');
		stream.write (Buffer.from ? Buffer.from ('42') : new Buffer ('42'));
		stream.end ();
	});

	it ("inserts some data", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("INSERT INTO t VALUES (1),(2),(3)", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			done ();
		});
	});

	it ("inserts some data using promise", function () {
		var ch = new ClickHouse ({host: host, port: port});
		return ch.querying ("INSERT INTO t VALUES (1),(2),(3)", {queryOptions: {database: dbName}});
	});

	it ("creates a table 2", function (done) {
		var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: dbName}});
		ch.query ("CREATE TABLE t2 (a UInt8, b Float32, x Nullable(String), z DateTime) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts data from array using stream", function (done) {
		var ch = new ClickHouse ({host: host, port: port});

		var stream = ch.query ("INSERT INTO t2", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			ch.query ("SELECT * FROM t2", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

				assert.equal (result.data[0][0], 1);
				assert.equal (result.data[0][1], 2.22);
				assert.equal (result.data[0][2], null);
				assert.equal (result.data[0][3], testDateISO);

				assert.equal (result.data[1][0], 20);
				assert.equal (result.data[1][1], 1.11);
				assert.equal (result.data[1][2], "wrqwefqwef");
				assert.equal (result.data[1][3], "2017-07-07 12:12:12");

				done ();

			});
		});

		stream.write ([1, 2.22, null, testDate]);
		stream.write ("20\t1.11\twrqwefqwef\t2017-07-07 12:12:12");

		// stream.write ([0, Infinity, null, new Date ()]);
		// stream.write ([23, NaN, "yyy", new Date ()]);

		stream.end ();
	});

	it ("creates a table 3", function (done) {
		var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: dbName}});
		ch.query ("CREATE TABLE t3 (a UInt8, b Float32, x Nullable(String), z DateTime) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts data from array of objects using stream", function (done) {
		var ch = new ClickHouse ({host: host, port: port});

		var stream = ch.query ("INSERT INTO t3", {format: "JSONEachRow", queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			ch.query ("SELECT * FROM t3", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

				assert.equal (result.data[0][0], 1);
				assert.equal (result.data[0][1], 2.22);
				assert.equal (result.data[0][2], null);
				assert.equal (result.data[0][3], testDateISO);

				assert.equal (result.data[1][0], 20);
				assert.equal (result.data[1][1], 1.11);
				assert.equal (result.data[1][2], "wrqwefqwef");
				assert.equal (result.data[1][3], "2017-07-07 12:12:12");

				assert.equal (result.data.length, 2);

				done ();

			});
		});

		stream.write ({a: 1, b: 2.22, x: null, z: testDate});
		stream.write ({a: 20, b: 1.11, x: "wrqwefqwef", z: "2017-07-07 12:12:12"});

		// stream.write ([0, Infinity, null, new Date ()]);
		// stream.write ([23, NaN, "yyy", new Date ()]);

		stream.end ();
	});

	it ("inserts from select", function (done) {
		var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: dbName}});

		var stream = ch.query ("INSERT INTO t3 SELECT * FROM t2", {}, function (err, result) {
			assert (!err, err);

			ch.query ("SELECT * FROM t3", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

				assert.equal (result.data[2][0], 1);
				assert.equal (result.data[2][1], 2.22);
				assert.equal (result.data[2][2], null);
				assert.equal (result.data[2][3], testDateISO);

				assert.equal (result.data[3][0], 20);
				assert.equal (result.data[3][1], 1.11);
				assert.equal (result.data[3][2], "wrqwefqwef");
				assert.equal (result.data[3][3], "2017-07-07 12:12:12");

				assert.equal (result.data.length, 4);

				done ();

			});
		});

		// stream.end ();
	});

	it ("piping data from csv file", function (done) {

		this.timeout (5000);

		var ch = new ClickHouse ({host: host, port: port});

		var csvFileName = __filename.replace ('.js', '.csv');

		function processFileStream (fileStream) {
			var stream = ch.query ("INSERT INTO t3", {format: "CSV", queryOptions: {database: dbName}}, function (err, result) {

				assert (!err, err);

				ch.query ("SELECT * FROM t3", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

					assert (!err, err);

					fs.unlink (csvFileName, function () {
						done ();
					});
				});
			});

			fileStream.pipe (stream);

			stream.on ('error', function (err) {
				// console.log (err);
			});
		}

		fs.stat (csvFileName, function (err, stat) {
			//if (err) {
				return generateData ('CSV', csvFileName, function () {
					processFileStream (fs.createReadStream (csvFileName));
				})
			//}

			processFileStream (fs.createReadStream (csvFileName));
		});

	});

	it ("piping data from tsv file", function (done) {

		this.timeout (5000);

		var ch = new ClickHouse ({host: host, port: port});

		var tsvFileName = __filename.replace ('.js', '.tsv');

		function processFileStream (fileStream) {
			var stream = ch.query ("INSERT INTO t3", {format: "TabSeparated", queryOptions: {database: dbName}}, function (err, result) {

				assert (!err, err);

				ch.query ("SELECT * FROM t3", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

					assert (!err, err);

					fs.unlink (tsvFileName, function () {
						done ();
					});
				});
			});

			fileStream.pipe (stream);

			stream.on ('error', function (err) {
				// console.log (err);
			});
		}

		fs.stat (tsvFileName, function (err, stat) {
			//if (err) {
			return generateData ('TSV', tsvFileName, function () {
				processFileStream (fs.createReadStream (tsvFileName));
			})
			//}

			processFileStream (fs.createReadStream (tsvFileName));
		});

	});

    it ("creates a table 4", function (done) {
        var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: dbName}});
        ch.query ("CREATE TABLE t4 (arrayString Array(String), arrayInt Array(UInt32)) ENGINE = Memory", function (err, result) {
            assert (!err);

            done ();
        });
    });

    it ("inserts array with format JSON using stream", function (done) {
        var ch = new ClickHouse ({host: host, port: port});

        var stream = ch.query ("INSERT INTO t4", {queryOptions: {database: dbName}, format: "JSONEachRow"}, function (err, result) {
            assert (!err, err);

            ch.query ("SELECT * FROM t4", {syncParser: true, queryOptions: {database: dbName}, dataObjects: "JSON"}, function (err, result) {
                assert.deepEqual (result.data[0].arrayString, ['first', 'second']);
                assert.deepEqual (result.data[0].arrayInt, [1, 0, 100]);

                done ();
            });
        });

        stream.write ({
            arrayString: ['first', 'second'],
            arrayInt: [1, 0, 100]
        });

        stream.end ();
    });

		it ("creates a table 5", function () {
			var ch = new ClickHouse ({host: host, port: port, queryOptions: {database: dbName}});
			return ch.querying ("CREATE TABLE t5 (a UInt8, b Float32, x Nullable(String), z DateTime) ENGINE = Memory");
		});

		it ("inserts csv with FORMAT clause", function (done) {
			var ch = new ClickHouse ({host: host, port: port});
			var stream = ch.query ("INSERT INTO t5 FORMAT CSV", {queryOptions: {database: dbName}}, function (err, result) {
				assert (!err, err);

				ch.query ("SELECT * FROM t5", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

					assert.equal (result.data[0][0], 0);
					assert.equal (result.data[0][1], 0);
					assert.equal (result.data[0][2], null);
					assert.equal (result.data[0][3], '1970-01-02 00:00:00');
					assert.equal (result.data[1][0], 1);
					assert.equal (result.data[1][1], 1.5);
					assert.equal (result.data[1][2], '1');
					assert.equal (result.data[1][3], '2050-01-01 00:00:00');

					done ();

				});
			});
			stream.write('0,0,\\N,"1970-01-02 00:00:00"\n1,1.5,"1","2050-01-01 00:00:00"')
			stream.end ();
		});

		it ("select data with FORMAT clause", function () {
			var ch = new ClickHouse ({host: host, port: port});
			return ch.querying("SELECT * FROM t5 FORMAT Values", {queryOptions: {database: dbName}})
				.then((data) => {
					assert.equal (data, `(0,0,NULL,'1970-01-02 00:00:00'),(1,1.5,'1','2050-01-01 00:00:00')`)
				})
		});

		it ("select data with GET method and FORMAT clause", function () {
			var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
			return ch.querying("SELECT * FROM t5 FORMAT Values", {queryOptions: {database: dbName}})
				.then((data) => {
					assert.equal (data, `(0,0,NULL,'1970-01-02 00:00:00'),(1,1.5,'1','2050-01-01 00:00:00')`)
				})
		});

		it ("select data with GET method and format option", function () {
			var ch = new ClickHouse ({host: host, port: port, useQueryString: true});
			return ch.querying("SELECT * FROM t5", {queryOptions: {database: dbName}, format: 'Values'})
				.then((data) => {
					assert.equal (data, `(0,0,NULL,'1970-01-02 00:00:00'),(1,1.5,'1','2050-01-01 00:00:00')`)
				})
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
