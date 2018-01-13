'use strict';

var fs = require ('fs');
var os = require ('os');
var program = require ('commander');
var version = require ('../package').version;
var ClickHouse = require ("./clickhouse");

exports.run = function (argv) {

    program
        .version(version)
        .option('-H, --host <host>', 'server name', 'localhost')
        .option('-p, --port <port>', 'port to connect', 8123)
        .option('-u, --user <login>', 'username', process.env.CLICKHOUSE_USER || 'default')
        .option('-P, --password <password>', 'password', process.env.CLICKHOUSE_PASSWORD || '')
        .option('-q, --query <statement>', 'query to process')
        .option('-d, --database <name>', 'select the current default database', 'default')
        .option('-f, --format <name>', 'use the specified input format to insert data')
        .option('-i, --input <file>', 'insert data from file (or from STDIN if not set)')
        .option('-o, --output <file>', 'save result to file (or to STDOUT if not set)')
        .on('--help', function () {
            console.log('');
            console.log('  You can also use environment variables for authentication:');
            console.log('');
            console.log('    CLICKHOUSE_USER');
            console.log('    CLICKHOUSE_PASSWORD');
            console.log('');
        })
        .parse(argv);

    var inputStream;
    var options = {
        queryOptions: {},
        host: program.host,
        port: program.port
    };

    if (program.user !== 'default' || program.password !== '') {
        options.auth = program.user + ':' + program.password;
    }

    if (typeof program.query === 'undefined') {
        console.error('Error: query must defined');
        process.exit(1);
    }

    if (program.database !== 'default') {
        options.queryOptions.database = program.database;
    }

    if (typeof program.format !== 'undefined') {
        options.format = program.format;
    }

    if (typeof program.input !== 'undefined') {
        inputStream = fs.createReadStream (program.input);
    } else {
        inputStream = process.stdin;
        setImmediate(function () {
            inputStream.push(null);
        });
    }

    if (typeof program.output !== 'undefined') {
        var access = fs.createWriteStream (program.output, {flags: 'w'});
        process.stdout.write = access.write.bind (access);
    }

    var clickHouse = new ClickHouse (options);
    var clickHouseStream = clickHouse.query (program.query);

    clickHouseStream.on ('data', function (row) {
        process.stdout.write(row + os.EOL);
    });

    clickHouseStream.on ('error', function (err) {
        console.error(err);
        process.exit(2);
    });

    inputStream.pipe (clickHouseStream);
};
