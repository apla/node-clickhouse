var nodeVer = process.version.substr (1).split ('.');

if (nodeVer[0] >= 6)
	return;

var legacyModulesInstallCmd = 'npm install object-assign buffer-indexof-polyfill';

if (process.mainModule === module) {
	var spawn = require ('child_process').spawn;

	var child = spawn (legacyModulesInstallCmd);
	child.stdout.pipe (process.stdout);
	child.stderr.pipe (process.stderr);

	child.on ('error', function (err) {
		process.exit (1);
	});

	child.on ('exit', function (code) {
		process.exit (0);
	});

    return;
}


try {

if (nodeVer[0] < 4) {
	global.Promise = global.Promise || require ('bluebird');
	Object.assign  = Object.assign  || require ('object-assign');
	Array.isArray = function(arg) {
		return Object.prototype.toString.call(arg) === '[object Array]';
	};
}

if (nodeVer[0] < 6) {
	require ('buffer-indexof-polyfill');
}

} catch (err) {
	console.warn ("You're using outdated nodejs version.");
	console.warn ("This module supports nodejs down to the version 0.10, but some legwork required.");
	console.warn ("Either install version >= 6, or add dependencies to your own project with `" + legacyModulesInstallCmd + "`");

}
