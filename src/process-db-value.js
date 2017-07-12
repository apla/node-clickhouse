/*

Formats:

CSV: https://clickhouse.yandex/docs/en/formats/csv.html

During parsing, values could be enclosed or not enclosed in quotes.
Supported both single and double quotes. In particular,
Strings could be represented without quotes - in that case,
they are parsed up to comma or newline (CR or LF).
Contrary to RFC, in case of parsing strings without quotes,
leading and trailing spaces and tabs are ignored. As line delimiter,
both Unix (LF), Windows (CR LF) or Mac OS Classic (LF CR) variants are supported.

TSV/TabSeparated: https://clickhouse.yandex/docs/en/formats/tabseparated.html

In TabSeparated format, data is written by row. Each row contains values separated by tabs.
Each value is follow by a tab, except the last value in the row,
which is followed by a line break. Strictly Unix line breaks are assumed everywhere.
The last row also must contain a line break at the end. Values are written in text format,
without enclosing quotation marks, and with special characters escaped.

Minimum set of symbols that you must escape in TabSeparated format is tab, newline (LF) and backslash.

Arrays are formatted as a list of comma-separated values in square brackets.
Number items in the array are formatted as normally, but dates, dates with times,
and strings are formatted in single quotes with the same escaping rules as above.

As an exception, parsing DateTime is also supported in Unix timestamp format,
if it consists of exactly 10 decimal digits. The result is not time zone-dependent.
The formats YYYY-MM-DD hh:mm:ss and NNNNNNNNNN are differentiated automatically.

Values: https://clickhouse.yandex/docs/en/formats/values.html

Prints every row in parentheses. Rows are separated by commas.
There is no comma after the last row. The values inside the parentheses are also comma-separated.
Numbers are output in decimal format without quotes. Arrays are output in square brackets.
Strings, dates, and dates with times are output in quotes.
Escaping rules and parsing are same as in the TabSeparated format.
During formatting, extra spaces aren’t inserted, but during parsing,
they are allowed and skipped (except for spaces inside array values, which are not allowed).

Minimum set of symbols that you must escape in Values format is single quote and backslash.

Nulls: \N?

https://github.com/yandex/ClickHouse/issues/252
https://github.com/yandex/ClickHouse/issues/700
https://github.com/Infinidat/infi.clickhouse_orm/pull/42

*/

function encodeValue (wrapString, v, format) {
	switch (typeof v) {
		case 'string':
			return v.replace (/\\/g, '\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
		case 'number':
			if (isNaN (v))
				return 'nan';
			if (v === +Infinity)
				return '+inf';
			if (v === -Infinity)
				return '-inf';
			if (v === Infinity)
				return 'inf';
			return v.toString ();
		case 'object':
			if (v instanceof Date)
				return ("" + v.valueOf ()).substr (0, 10);
			if (v instanceof Array)
				return '[' + v.map (encodeValue.bind (this, true)).join (',') + ']'
			if (v === null)
				return '\\N';
			return '\\N';
			console.warn ('Cannot stringify [Object]:', v);
		case 'boolean':
			return v === true ? 1 : 0;
					}
}

function encodeTSRow (row) {
	return row.map (encodeValue.bind (this, false));
}

module.exports = {
	encodeValue: encodeValue
}
