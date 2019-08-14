Database interface for http://clickhouse.yandex
===

```
npm install @apla/clickhouse
```

[![travis](https://travis-ci.org/apla/node-clickhouse.svg)](https://travis-ci.org/apla/node-clickhouse)
[![codecov](https://codecov.io/gh/apla/node-clickhouse/branch/master/graph/badge.svg)](https://codecov.io/gh/apla/node-clickhouse)

Synopsis
---

```javascript
var ch = new ClickHouse ({host: clickhouse.host, port: 8123, auth: "user:password"});
// or
var ch = new ClickHouse (clickhouse.host);

// do the query, callback interface, not recommended for selects
ch.query ("CREATE DATABASE clickhouse_test", function (err, data) {

});

// promise interface (requires 'util.promisify' for node < 8, Promise shim for node < 4)
ch.querying ("CREATE DATABASE clickhouse_test").then (…);

// it is better to use stream interface to fetch select results
var stream = ch.query ("SELECT 1");

// or collect records yourself
var rows = [];

stream.on ('metadata', function (columns) {
  // do something with column list
});

stream.on ('data', function (row) {
  rows.push (row);
});

stream.on ('error', function (err) {
  // TODO: handler error
});

stream.on ('end', function () {
  // all rows are collected, let's verify count
  assert (rows.length === stream.supplemental.rows);
  // how many rows in result are set without windowing:
  console.log ('rows in result set', stream.supplemental.rows_before_limit_at_least);
});

// insert from file

var tsvStream = fs.createReadStream ('data.tsv');
var clickhouseStream = clickHouse.query (statement, {inputFormat: 'TSV'});

tsvStream.pipe (clickhouseStream);

// insert row data
var clickhouseStream = clickHouse.query (statement, {inputFormat: 'TSV'}, function (err) {

  console.log ('Insert complete!');

});

// data will be formatted for you
clickhouseStream.write ([1, 2.22, "erbgwerg", new Date ()]);

// prepare data yourself
clickhouseStream.write ("1\t2.22\terbgwerg\t2017-07-17 17:17:17");

clickhouse.end ();

```

API
---

### new ClickHouse (options)

```javascript
var options = {
  host: "clickhouse.msk",
  queryOptions: {
    profile: "web",
    database: "test"
  },
  omitFormat: false,
  readonly: true,
};

var clickHouse = new ClickHouse (options);
```

If you provide options as a string, they are assumed as a host parameter in connection options

Connection options (accept all options documented
for [http.request](https://nodejs.org/api/http.html#http_http_request_options_callback)):

 * **user**:     authentication user, optional
 * **password**:     authentication password, optional
 * **host**:     host to connect, can contain port name
 * **pathname**: pathname of ClickHouse server or `/` if omited,
 * **port**:     port number,
 * **protocol**: "https:" or "http:", default "http:".

`queryOptions` object can contain any option from Settings (docs:
[en](https://clickhouse.yandex/docs/en/operations/settings/index.html)
[ru](https://clickhouse.yandex/docs/ru/operations/settings/index.html)
)

For example:

 * **database**: default database name to lookup tables etc.
 * **profile**: settings profile to use
 * **readonly**: don't allow to change data
 * **max_rows_to_read**: self explanatory

Driver options:

 * **dataObjects**: use `FORMAT JSON` instead of `FORMAT JSONCompact` for output.
 By default (false), you'll receive array of values for each row. If you set dataObjects
 to true, every row will become an object with format: `{fieldName: fieldValue, …}`
 * **format**: this is format for data loading with `INSERT` statements.
 * **syncParser**: collect data, then parse entire response. Should be faster, but for
 large datasets all your dataset goes into memory (actually, entire response + entire dataset).
 Default: `false`
 * **omitFormat**: `FORMAT JSONCompact` will be added by default to every query
 which returns dataset. Currently `SELECT|SHOW|DESC|DESCRIBE|EXISTS\s+TABLE`.
 You can change this behaviour by providing this option. In this case you should
 add `FORMAT JSONCompact` by yourself. Should be detected automatically. Default `false`;
 * **readonly**: tells driver to send query with HTTP GET method. Same as [`readonly=1` setting](https://clickhouse.yandex/docs/en/operations/settings/permissions_for_queries/#settings_readonly). [More details](https://clickhouse.yandex/docs/en/interfaces/http/)


### var stream = clickHouse.query (statement, [options], [callback])

Query sends a statement to a server

Stream is a regular nodejs object stream, it can be piped to process records.

Stream events:

 * **metadata**: when a column information is parsed,
 * **data**: when a row is available,
 * **error**: something is wrong,
 * **end**: when entire response is processed

After response is processed, you can read a supplemental response data, such as
row count via `stream.supplemental`.

Options are the same for `query` and `constructor` excluding connection.

Callback is optional and will be called upon completion with
a standard node `(error, result)` signature.

You should have at least one error handler listening. Via callbacks or via stream errors.
If you have callback and stream listener, you'll have error notification in both listeners.

## Promise interface

Promise interface **is not recommended** for `INSERT` and `SELECT` queries.
* `INSERT` cannot bulk load data with promise interface
* `SELECT` will collect entire query result in the memory

With promise interface query result are parsed synchronously.
This means that large query result in promise interface:
* Will synchronously block JS thread/event loop
* May lead to memory leaks in your app

Use it only for queries where resulting data size is is known and extremely small.<br/>
The good cases to use it is `DESCRIBE TABLE` or `EXISTS TABLE`

### clickHouse.querying (statement, [options]).then (…)
Return `promise`, that will be resolved with entire query result.
This is an alias to `ch.query(query, {syncParser: true}, (error, data) => {})`

Usage:
```js
  ch.querying ("SELECT 1").then((result) => console.log(result.data))
  // [ [ 1 ] ]
  ch.querying ("DESCRIBE TABLE system.numbers", {dataObjects: true}).then((result) => console.log(result.data))
  // [ { name: 'number', type: 'UInt64', default_type: '', default_expression: '' } ]
```

### clickHouse.ping (function (err, response) {})

Sends an empty query and check if it "Ok.\n"

### clickHouse.pinging ().then (…)

Promise interface for `ping`

Notes
-----

## Bulk data loading with INSERT statements

`INSERT` can be used for bulk data loading. There is a 2 formats easily implementable
with javascript: CSV and TabSeparated/TSV.

CSV is useful for loading from file, thus you can read and pipe into clickhouse
file contents. To activate CSV parsing you should set `inputFormat` option to `CSV`
for driver or query (BEWARE: not works as expected, use TSV):

```javascript

var csvStream = fs.createReadStream ('data.csv');
var clickhouseStream = ch.query (statement, {inputFormat: CSV});

csvStream.pipe (clickhouseStream);

```

TSV is useful for loading from file and bulk loading from external sources, such as other databases.
Only `\\`, `\t` and `\n` need to be escaped in strings; numbers, nulls,
bools and date objects need some minor processing. You can send prepared TSV data strings
(line ending will be appended automatically), buffers (always passed as is) or Arrays with fields.

Internally, every field will be converted to the format which ClickHouse can accept.
Then escaped and joined with delimiter for the particular format.
If you ever need to store rows (in arrays) and send preformatted data, you can do it.

ClickHouse also supports [JSONEachRow](https://clickhouse.yandex/docs/en/formats/jsoneachrow.html) format
which can be useful to insert javascript objects if you have such recordset.

```js
const stream = ch.query (statement, {format: 'JSONEachRow'})

stream.write (object) // Do write as many times as possible
stream.end () // And don't forget to finish insert query
```

## Memory size

You can read all the records into memory in single call like this:

```javascript

var ch = new ClickHouse ({host: host, port: port});
ch.query ("SELECT number FROM system.numbers LIMIT 10", {syncParser: true}, function (err, result) {
  // result will contain all the data you need
});

```

In this case whole JSON response from the server will be read into memory,
then parsed into memory hogging your CPU. Default parser will parse server response
line by line and emits events. This is slower, but much more memory and CPU efficient
for larger datasets.
