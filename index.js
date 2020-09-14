// Tries to import library built for modern nodejs
try {
  var nodeVer = process.version.substr(1).split ('.')
  if (nodeVer[0] >= 6) {
    return module.exports = require('./lib/clickhouse')
  }
} catch (e) {}

// Tries to import library built for legacy nodejs
try {
  module.exports = require('./lib-legacy/clickhouse')
} catch (e) {
  // If all imports are failed it may be dev enviroment
  module.exports = require('./src/clickhouse')
}
