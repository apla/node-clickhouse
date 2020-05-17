Simple and powerful interface for [ClickHouse](https://clickhouse.yandex/) [![travis](https://travis-ci.org/apla/node-clickhouse.svg)](https://travis-ci.org/apla/node-clickhouse) [![codecov](https://codecov.io/gh/apla/node-clickhouse/branch/master/graph/badge.svg)](https://codecov.io/gh/apla/node-clickhouse)
===
```sh
npm install @apla/clickhouse
```

Synopsis
---
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

### `new ClickHouse(options: Options)`

#### `Options`

|                  | required | default       | description
| :--------------- | :------: | :------------ | :----------
| `host`           | ✓        |               | Host to connect.
| `user`           |          |               | Authentication user.
| `password`       |          |               | Authentication password.
| `path` (`pathname`) |       | `/`           | Pathname of ClickHouse server.
| `port`           |          | `8123`        | Server port number.
| `protocol`       |          | `'http:'`     | `'https:'` or `'http:'`.
| `dataObjects`    |          | `false`       | By default (`false`), you'll receive array of values for each row. <br /> If you set `dataObjects: true`, every row will become an object with format: `{ fieldName: fieldValue, … }`. <br /> Alias to `format: 'JSON'`.
| `format`         |          | `JSONCompact` | Adds the `FORMAT` statement for query if it did not have one. <br /> Specifies format of [selected](https://clickhouse.yandex/docs/en/query_language/select/#format-clause) or [inserted](https://clickhouse.yandex/docs/en/query_language/insert_into/#insert) data. <br /> See ["Formats for input and output data"](https://clickhouse.yandex/docs/en/interfaces/formats/#formats) to find out possible values.
| `queryOptions`   |          |               | Object, can contain any ClickHouse option from [Settings](https://clickhouse.yandex/docs/en/operations/settings/index.html), [Restrictions](https://clickhouse.yandex/docs/en/operations/settings/query_complexity/) and [Permissions](https://clickhouse.yandex/docs/en/operations/settings/permissions_for_queries/). <br /> See [example](README.md#settings-for-connection).
| `readonly`       |          | `false`       | Tells driver to send query with HTTP GET method. Same as [`readonly=1` setting](https://clickhouse.yandex/docs/en/operations/settings/permissions_for_queries/#settings_readonly). [More details](https://clickhouse.yandex/docs/en/interfaces/http/).
| `timeout`, <br /> `headers`, <br /> `agent`, <br /> `localAddress`, <br /> `servername`, <br /> etc… |   |   |  Any [http.request](https://nodejs.org/api/http.html#http_http_request_options_callback) or [https.request](https://nodejs.org/api/https.html#https_https_request_options_callback) options are also available.

<!--
This are dangerous for using by end user

| `syncParser`     |          | `false`       | **Not recommended for large amounts of data!** <br /> Collects all data, then parse entire response. <br /> May be faster, but for large datasets all your dataset goes into memory (actually, entire response + entire dataset).
# Might be completely replaced with promise interface.

| `omitFormat`     |          | `false`       | By default `FORMAT JSONCompact` statement will be added to the query if it did not have it. <br /> You can change disable this behaviour by providing this option.
# Looks like internal option
-->

##### Options example:
```javascript
const ch = new ClickHouse({
  host: "clickhouse.msk",
  dataObjects: true,
  readonly: true,
  queryOptions: {
    profile: "web",
    database: "test",
  },
})
```


### `clickHouse.query(query, [options], [callback])`
Sends a query statement to a server.

##### `query: string`
SQL query statement.

##### `options: Options`
The same [`Options`](README.md#options), excluding connection options.

##### `callback: (error, result) => void`
Will be always called upon completion.

##### Returns: [`DuplexStream`](https://nodejs.org/api/stream.html#stream_duplex_and_transform_streams)
It supports [`.pipe`](https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options) to process records. <br/>
You should have at least one error handler listening. Via query callback or via stream `error` event.

| Stream event | Description
| ------------ | -----------
| `'error'`      | Query execution finished with error. <br /> If you have both query `callback` and stream `error` listener, you'll have error notification in both listeners.
| `'metadata'`   | When a column information is parsed.
| `'data'`       | When a row is available.
| `'end'`        | When entire response is processed. <blockquote>Regardless of whether there is an `'end'` listener, the query `callback` are always called.</blockquote> <blockquote>You should always listen to `'data'` event together with `'end'` event. <br/>["The 'end' event will not be emitted unless the data is completely consumed."](https://nodejs.org/api/stream.html#stream_event_end) <br/> If you don't need to handle `'data'` event prefer to use only `callback` or [Promise interface](#promise-interface).</blockquote>

##### `stream.supplemental`
After response is processed, you can read a supplemental response data from it, such as row count.


Examples:
- [Selecting with stream](README.md#selecting-with-stream)
- [Inserting with stream](README.md#inserting-with-stream)

### `clickHouse.ping(callback)`
Sends an empty query.
Doesn't requires authorization.

##### `callback: (error, result) => void`
Will be called upon completion.

<br />

## Promise interface

Promise interface **is not recommended** for `INSERT` and `SELECT` queries.
* `INSERT` can't do bulk load data with promise interface.
* `SELECT` will collect entire query result in the memory. See the [Memory size](README.md#memory-size) section.

With promise interface query result are parsed synchronously.
This means that large query result in promise interface:
* Will synchronously block JS thread/event loop.
* May lead to memory leaks in your app due peak GC loads.

Use it only for queries where resulting data size is is known and extremely small.<br/>
The good cases to use it is `DESCRIBE TABLE` or `EXISTS TABLE`

### `clickHouse.querying(query, [options])`
Similar to `ch.query(query)` but collects entire response in memory and resolves with complete query result. <br />
See the [Memory size](README.md#memory-size) section.
##### `options: Options`
The same [`Options`](README.md#options), excluding connection options.

##### Returns: `Promise`
Will be resolved with entire query result.

Example of [promise interface](README.md#promise-interface).

### `clickHouse.pinging()`
Promise interface for [`.ping`](README.md#clickhousepingcallback).

##### Returns: `Promise`

<br />

How it works
-----

### Bulk data loading with `INSERT` statements

`INSERT` can be used for bulk data loading. There is a 2 formats easily implementable
with javascript: CSV and TabSeparated/TSV.

CSV is useful for loading from file, thus you can read and `.pipe` into clickhouse
file contents. <br />
To activate CSV parsing you should set `format` driver option or query `FORMAT` statement to `CSV`:

```javascript

var csvStream = fs.createReadStream('data.csv')
var clickhouseStream = ch.query(statement, { format: CSV })

csvStream.pipe(clickhouseStream)

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
const stream = ch.query(statement, { format: 'JSONEachRow' })

stream.write(object) // Do write as many times as possible
stream.end() // And don't forget to finish insert query
```

### Memory size

You can read all the records into memory in single call like this:

```javascript

var ch = new ClickHouse({ host: host, port: port })
ch.querying("SELECT number FROM system.numbers LIMIT 10", (err, result) => {
  // result will contain all the data you need
})

```

In this case whole JSON response from the server will be read into memory,
then parsed into memory hogging your CPU. Default parser will parse server response
line by line and emits events. This is slower, but much more memory and CPU efficient
for larger datasets.

<br />

## Examples
#### Selecting with stream:
```javascript
const readableStream = ch.query(
  'SELECT * FROM system.contributors FORMAT JSONEachRow',
  (err, result) => {},
)
const writableStream = fs.createWriteStream('./contributors.json')
readableStream.pipe(writableStream)
```

#### Inserting with stream:
```javascript
const readableStream = fs.createReadStream('./x.csv')
const writableStream = ch.query('INSERT INTO table FORMAT CSV', (err, result) => {})
readableStream.pipe(writableStream)
```

#### Insert single row of data:
```javascript
const ch = new ClickHouse(options)
const writableStream = ch.query(`INSERT INTO table FORMAT TSV`, (err) => {
  if (err) {
    console.error(err)
  }
  console.log('Insert complete!')
})

// data will be formatted for you
writableStream.write([1, 2.22, "erbgwerg", new Date()])

// prepare data yourself
writableStream.write("1\t2.22\terbgwerg\t2017-07-17 17:17:17")

writableStream.end()

```

#### Selecting large dataset:

```javascript
const ch = new ClickHouse(options)
// it is better to use stream interface to fetch select results
const stream = ch.query("SELECT * FROM system.numbers LIMIT 10000000")

stream.on('metadata', (columns) => { /* do something with column list */ })

let rows = []
stream.on('data', (row) => rows.push(row))

stream.on('error', (err) => { /* handler error */ })

stream.on('end', () => {
  console.log(
    rows.length,
    stream.supplemental.rows,
    stream.supplemental.rows_before_limit_at_least, // how many rows in result are set without windowing
  )
})
```

#### Inserting large dataset:
```javascript
const ch = new ClickHouse(options)
// insert from file
const tsvStream = fs.createReadStream('data.tsv')
const clickhouseStream = ch.query('INSERT INTO table FORMAT TSV')

tsvStream.pipe(clickhouseStream)
```

#### Settings for connection:
```javascript
const ch = new ClickHouse({
  host: 'clickhouse.msk',
  queryOptions: {
    database: "test",
    profile: "web",
    readonly: 2,
    force_index_by_date: 1,
    max_rows_to_read: 10 * 1e6,
  },
})
```

#### Settings for query:
```javascript
const ch = new ClickHouse({ host: 'clickhouse.msk' })
const stream = ch.query('INSERT INTO table FORMAT TSV', {
  queryOptions: {
    database: "test",
    insert_quorum: 2,
  },
})
```

#### Promise interface:
```js
const ch = new ClickHouse(options)
// Check connection to server. Doesn't requires authorization.
await ch.pinging()
```
```js
const { data } = await ch.querying("SELECT 1")
// [ [ 1 ] ]
const { data } = await ch.querying("DESCRIBE TABLE system.numbers", { dataObjects: true })
// [ { name: 'number', type: 'UInt64', default_type: '', default_expression: '' } ]
```
