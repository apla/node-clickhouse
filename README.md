Database interface for http://clickhouse.yandex
===

```sh
npm install @apla/clickhouse
```

[![travis](https://travis-ci.org/apla/node-clickhouse.svg)](https://travis-ci.org/apla/node-clickhouse)
[![codecov](https://codecov.io/gh/apla/node-clickhouse/branch/master/graph/badge.svg)](https://codecov.io/gh/apla/node-clickhouse)

Synopsis
---
Basic API:

```javascript
const ClickHouse = require('@apla/clickhouse')
const ch = new ClickHouse({ host, port, user, password })

const stream = ch.query("SELECT 1", (err, data) => {})
stream.pipe(process.stdout)

// promise interface, not recommended for selects
// (requires 'util.promisify' for node < 8, Promise shim for node < 4)
await ch.querying("CREATE DATABASE test")
```
Examples:
- [Selecting large dataset](README.md#selecting-large-dataset)
- [Inserting large dataset](README.md#inserting-large-dataset)
- [Inserting single row](README.md#insert-single-row-of-data)


API
---

### `new ClickHouse (options: string | Options)`

#### `options: string`
String are assumed as a host parameter.
```javascript
const clickHouse = new ClickHouse ('clickhouse.msk')
```

#### `options: Options`

##### `host` Required
Host to connect
##### `user`
Authentication user.
##### `password`
Authentication password
##### `pathname` Default: `/`
pathname of ClickHouse server
##### `port` Default: `8123`
port number,
##### `protocol` Default: `'http:'`
`'https:'` or `'http:'`.

##### `dataObjects` Default: `false`
By default (`false`), you'll receive array of values for each row.
If you set `dataObjects: true`, every row will become an object with format: `{fieldName: fieldValue, …}`.
Alias to `format: 'JSON'`
##### `format` Default: `JSONCompact`
Adds the `FORMAT` statement for query. Specifies format of [selected](https://clickhouse.yandex/docs/en/query_language/select/#format-clause) or [inserted](https://clickhouse.yandex/docs/en/query_language/insert_into/#insert) data.
See ["Formats for input and output data"](https://clickhouse.yandex/docs/en/interfaces/formats/#formats)

##### `syncParser` Default: `false`
Collects all data, then parse entire response.
**Not recommended for large amounts of data!**
May be faster, but for large datasets all your dataset goes into memory (actually, entire response + entire dataset).

##### `omitFormat` Default `false`
By default `FORMAT JSONCompact` statement will be added to the query if it did not have it.
You can change disable this behaviour by providing this option.

Connection options (accept all options documented
for [http.request](https://nodejs.org/api/http.html#http_http_request_options_callback)):

##### `queryOptions`
Object, can contain any option from [Settings](https://clickhouse.yandex/docs/en/operations/settings/index.html), [Restrictions](https://clickhouse.yandex/docs/en/operations/settings/query_complexity/) and [Permissions](https://clickhouse.yandex/docs/en/operations/settings/permissions_for_queries/).

 ```javascript
   queryOptions: {
     database: "test",
     profile: "web",
     readonly: 2,
     force_index_by_date: 1,
     max_rows_to_read: 10 * 1e6,
     insert_quorum: 2,
   },
```

##### `timeout`, `headers`, `agent`, `localAddress`, `servername` and all other [http.request](https://nodejs.org/api/http.html#http_http_request_options_callback) or [https.request](https://nodejs.org/api/https.html#https_https_request_options_callback) options are also available.

```javascript
new ClickHouse ({
  host: 'clickhouse.msk',
  port: '8443',
  protocol: 'https:',
  checkServerIdentity: () => { /* Check something here */ }
})
```

##### Options example
```javascript
const ch = new ClickHouse ({
  host: "clickhouse.msk",
  queryOptions: {
    profile: "web",
    database: "test",
  },
  omitFormat: false,
})
```


### `const stream = clickHouse.query (query, [options], [callback])`
Sends a query statement to a server.

##### `options: Options`
The same as for `constructor`, excluding connection options.

##### `callback: (error, result) => void`
Will be called upon completion.

##### Returns: [`stream: Duplex Stream`](https://nodejs.org/api/stream.html#stream_duplex_and_transform_streams)
It supports [`.pipe`](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options) to process records.

Stream events:
 * **metadata**: when a column information is parsed,
 * **data**: when a row is available,
 * **error**: something is wrong,
 * **end**: when entire response is processed

After response is processed, you can read a supplemental response data, such as
row count via `stream.supplemental`.

You should have at least one error handler listening. Via callbacks or via stream errors.
If you have callback and stream listener, you'll have error notification in both listeners.

```javascript
const readableStream = fs.createReadStream('./x.csv')
const writableStream = ch.query ('INSERT INTO table FORMAT CSV', (err, result) => {})
readableStream.pipe(writableStream)
```

```javascript
const readableStream = ch.query ('SELECT * FROM system.contributors FORMAT JSON', (err, result) => {})
const writableStream = fs.createWriteStream('./contributors.json')
readableStream.pipe(writableStream)
```

### `clickHouse.ping (callback)`
Sends an empty query and check if it `"Ok.\n"`.
Doesn't requires authorization.

##### `callback: (error, result) => void` Required
Will be called upon completion.

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

### `clickHouse.querying (query, [options])`
This is an alias to `ch.query(query, {syncParser: true}, (error, data) => {})`
##### `options: Options`
The same as for `constructor`, excluding connection options.

##### Returns: `Promise`
Will be resolved with entire query result.


Usage:
```js
  ch.querying ("SELECT 1").then((result) => console.log(result.data))
  // [ [ 1 ] ]
  ch.querying ("DESCRIBE TABLE system.numbers", {dataObjects: true}).then((result) => console.log(result.data))
  // [ { name: 'number', type: 'UInt64', default_type: '', default_expression: '' } ]
```

### `clickHouse.pinging ()`
Promise interface for `ping`

##### Returns: `Promise`

Notes
-----

## Bulk data loading with INSERT statements

`INSERT` can be used for bulk data loading. There is a 2 formats easily implementable
with javascript: CSV and TabSeparated/TSV.

CSV is useful for loading from file, thus you can read and `.pipe` into clickhouse
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

## Examples
#### Insert single row of data:
```javascript
const ch = new ClickHouse(options)
const writableStream = ch.query(`INSERT INTO table FORMAT TSV`, (err) => {
  console.log('Insert complete!')
})

// data will be formatted for you
writableStream.write([1, 2.22, "erbgwerg", new Date ()])

// prepare data yourself
writableStream.write("1\t2.22\terbgwerg\t2017-07-17 17:17:17")

writableStream.end()

```

#### Selecting large dataset:</summary>

```javascript
const ch = new ClickHouse(options)
// it is better to use stream interface to fetch select results
const stream = ch.query("SELECT * FROM system.numbers LIMIT 10000000")

stream.on('metadata', (columns) => { /* do something with column list */ })

let rows = [];
stream.on('data', (row) => rows.push(row))

stream.on('error', (err) => { /* handler error */ })

stream.on('end', () => {
  console.log(
    rows.length,
    stream.supplemental.rows,
    stream.supplemental.rows_before_limit_at_least, // how many rows in result are set without windowing
  )
});
```


#### Inserting large dataset:
```javascript
const ch = new ClickHouse(options)
// insert from file
var tsvStream = fs.createReadStream('data.tsv')
var clickhouseStream = ch.query('INSERT INTO table FORMAT TSV')

tsvStream.pipe(clickhouseStream)
```
