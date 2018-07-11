var assert = require ('assert');
var encodeValue = require ('../src/process-db-value').encodeValue;

describe('encode value', function() {
	it('escaping string backslashes for TSV', function() {
		var value = '{"key1":\t"{\"key2\":\"<some \\"attr\\">With tabulated \\t and line bracking \\n</some>\"}"\n}';
		var expected = '{"key1":\\t"{"key2":"<some \\\\"attr\\\\">With tabulated \\\\t and line bracking \\\\n</some>\"}"\\n}';
		var actual = encodeValue(undefined, value, 'TSV');

		assert.equal(actual, expected);
  })
})
