Yandex ClickHouse database interface
===

```
npm install @apla/clickhouse
```

Synopsis
---

```javascript

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

var ch = new ClickHouse (options);
```

If you provide options as string it is assumed as host parameter in connections options

Connection options (accept all options documentedfor [http.request](https://nodejs.org/api/http.html#http_http_request_options_callback)):

 * auth:     authentication as `user:password`, optional
 * host:     host to connect, can contain port name
 * pathname: pathname of ClickHouse server or `/` if omited,

`queryOptions` object can contains any option from Settings (docs:
[en](https://clickhouse.yandex/reference_en.html#Settings)
[ru](https://clickhouse.yandex/reference_ru.html#Настройки)
)

For example:

 * database: default database name to lookup tables etc…
 * profile: settings profile to use
 * readonly: don't allow to change data
 * max_rows_to_read: self explanatory

Driver options:

 * omitFormat: `FORMAT JSONCompact` will be added by default to every query.
 You can change this behaviour by providing this option. In such case you should
 add `FORMAT JSONCompact` by yourself.
 * syncParser: collect data, then parse whole response. Should be faster, but for
 large datasets all your dataset goes into memory (actually, whole response + whole dataset).
 Default: `false`
