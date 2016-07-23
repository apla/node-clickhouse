var ClickHouse = require ("../src/clickhouse");

var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var assert = require ("assert");

// var config = require ("../config");

// if (!config.connections.mssql)
//	return;

var responses = {
	"SELECT 1 FORMAT JSONCompact": {"meta": [{"name": "1", "type": "UInt8"}], "data": [[1]], "rows": 1},
	"SHOW DATABASES FORMAT JSONCompact": {"meta": [{"name": "name", "type": "String"}], "data": [["default"], ["system"]], "rows": 3},
	"SELECT number FROM system.numbers LIMIT 10 FORMAT JSONCompact": {"meta":[{"name":"number","type":"UInt64"}],"data":[["0"],["1"],["2"],["3"],["4"],["5"],["6"],["7"],["8"],["9"]],"rows":10,"rows_before_limit_at_least":10},

};

describe ("simulated queries", function () {

	var server,
		host,
		port;

	before (function (done) {

		server = http.createServer(function (req, res) {

			var queryString = url.parse (req.url).query;

			if (!queryString) {
				res.writeHead (200, {});
				res.end ("Ok.");
				return;
			}

			var queryObject = qs.parse (queryString);

			// console.log (queryObject);

			if (queryObject.query in responses) {
				res.writeHead (200, {"Content-Type": "application/json; charset=UTF-8"});
				res.end (JSON.stringify (responses[queryObject.query]));
				return;
			}

			res.writeHead (500, {"Content-Type": "text/plain; charset=UTF-8"});
			res.end ("Hello World");
		});

		server.on('clientError', function (err, socket) {
			socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
		});

		server.listen (0, function (evt) {
			host = server.address().address;
			port = server.address().port;

			host = host === '0.0.0.0' ? '127.0.0.1' : host;
			host = host === '::' ? '::1' : host;

			done();
		});

	})

	after (function (done) {
		server.close(function () {
			done();
		});
	});

	// this.timeout (5000);

	it ("pings", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.ping (done);
	});

	it ("selects", function (done) {
		var ch = new ClickHouse ({host: host, port: port});
		ch.query ("SELECT 1", done);
	});

});
