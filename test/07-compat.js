const ClickHouse = require("../src/clickhouse");
const assert = require("assert");

const DB_NAME = 'node_clickhouse_test_compat';
const noop = () => {}

describe("api compatibility", () => {
  const host = process.env.CLICKHOUSE_HOST || '127.0.0.1';
  const port = process.env.CLICKHOUSE_PORT || 8123;
  const ch = new ClickHouse({host: host, port: port, queryOptions: {database: DB_NAME}});

  before(() => (
    new ClickHouse({host: host, port: port})
      .querying(`CREATE DATABASE IF NOT EXISTS "${DB_NAME}"`)
  ))

  after(() => (
    ch.querying(`DROP DATABASE IF EXISTS "${DB_NAME}"`)
  ))

  describe('should emit "end" event', () => {

    before(function() {
      console.log(('CREATE TABLE x (date Date) Engine=Memory'))
      return ch.querying('CREATE TABLE x (date Date) Engine=Memory')
    })

    it('on insert done', (done) => {
      const chStream = ch.query('INSERT INTO x', { format: 'JSONEachRow' })
      chStream.on('data', noop)
      chStream.on('error', done)
      chStream.on('end', e => done())

      chStream.write({date: '2000-01-01'})
      chStream.end()
    });

    describe('on SELECT done. With default format', () => {
      it('HTTP GET', (done) => {
        const stream = ch.query('SELECT * FROM system.numbers LIMIT 0', { readonly: true });
        stream.on ('data', noop)
        stream.on ('end', () => done());
        stream.end()
      });

      it('HTTP POST', (done) => {
        const stream = ch.query('SELECT * FROM system.numbers LIMIT 0', { readonly: false });
        stream.on ('data', noop)
        stream.on ('end', () => done());
        stream.end()
      });
    })

  })

});
