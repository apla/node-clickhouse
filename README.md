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
var ch = new ClickHouse ({host: clickhouse.host});

// stream is a object stream. you can pipe it
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
  // all rows is collected, let's verify count
  assert (rows.length === stream.supplemental.rows);
  // how many rows in result set without windowing:
  console.log ('rows in result set', stream.supplemental.rows_before_limit_at_least);
});

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
  omitFormat: false
};

var clickHouse = new ClickHouse (options);
```

If you provide options as string it is assumed as host parameter in connections options

Connection options (accept all options documented
for [http.request](https://nodejs.org/api/http.html#http_http_request_options_callback)):

 * **auth**:     authentication as `user:password`, optional
 * **host**:     host to connect, can contain port name
 * **pathname**: pathname of ClickHouse server or `/` if omited,

`queryOptions` object can contains any option from Settings (docs:
[en](https://clickhouse.yandex/reference_en.html#Settings)
[ru](https://clickhouse.yandex/reference_ru.html#Настройки)
)

For example:

 * **database**: default database name to lookup tables etc…
 * **profile**: settings profile to use
 * **readonly**: don't allow to change data
 * **max_rows_to_read**: self explanatory

Driver options:

 * **omitFormat**: `FORMAT JSONCompact` will be added by default to every query.
 You can change this behaviour by providing this option. In such case you should
 add `FORMAT JSONCompact` by yourself.
 * **syncParser**: collect data, then parse whole response. Should be faster, but for
 large datasets all your dataset goes into memory (actually, whole response + whole dataset).
 Default: `false`
 * **dataObjects**: use `FORMAT JSON` instead of `FORMAT JSONCompact` for output.
 By default (false), you'll receive array of values for each row. If you set dataObjects
 to true, every row will become an object with format: `{fieldName: fieldValue, …}`


### var stream = clickHouse.query (statement, [options], [callback])

Query sends statement to server

Stream is a regular nodejs object stream, it can be piped to process records.

Stream events:

 * **metadata**: when column information is parsed,
 * **data**: when row is available,
 * **error**: something wrong,
 * **end**: when whole response is processed

After response is processed, you can read an supplemental response data, such as
row count via `stream.supplemental`.

Options is the same for `query` and `constructor` excluding connection.

Callback is optional and will be called upon completion with
standard node `(error, result)` signature.

### clickHouse.ping ()

Sends empty query and check if it "Ok.\n"
