#!/usr/bin/env node

var _ = require('lodash');
var path = require('path');
var chalk = require('chalk');
var semver = require('semver');
var Liftoff = require('liftoff');
var tildify = require('tildify');
var interpret = require('interpret');

var completion = require('../lib/completion');

var logger = console;

// set env var for ORIGINAL cwd
// before anything touches it
process.env.INIT_CWD = process.cwd();

var pkg = require('../package');

// Options Definition
var od = {
    'help': {
        alias: 'h',
        flag: true,
        description: 'Display this help text.'
    },
    'base': {
        description: 'Specify an alternate base path. By default, all file paths are relative to the flitfile.'
    },
    'flitfile': {
        description: 'Specify an alternate flitfile. By default, flit looks in the ' +
            'current or parent directories for the nearest flitfile.js or flitfile.coffee file.'
    },
    'require': {
        alias: 'r',
        description: 'Modules to pre-load'
    },
    'verbose': {
        alias: 'v',
        flag: true,
        description: 'Verbose mode. A lot more information output.'
    },
    'version': {
        alias: 'V',
        flag: true,
        description: 'Print the flit version. Combine with --verbose for more info.'
    },
    'completion': {
        description: 'Output shell auto-completion rules.'
    }
};

var parser = nomnom(od);
var options = parser.parse();

// Do stuff based on CLI options.
if ('completion' in options) {
    completion(options.completion);
}

var cli = new Liftoff({
    name: 'flit',
    completions: completion,
    extensions: interpret.jsVariants
});

// wire up a few err listeners to liftoff
cli.on('require', function (name) {
    if (options.verbose) {
        logger.log('Requiring external module', chalk.magenta(name));
    }
});

cli.on('requireFail', function (name) {
    logger.error(chalk.red('Failed to load external module'), chalk.magenta(name));
});

cli.launch({
    cwd: options.base,
    configPath: options.flitfile,
    require: options.require,
    completion: options.completion
}, invoke);

function invoke(env) {
    if (options.version) {
        console.log(pkg.name, 'v' + pkg.version);
    }

    if (!env.modulePath || !env.configPath) {
        if (options.help) {
            return console.log(parser.getUsage());
        }
        if (options.version) return;
    }

    if (!env.modulePath) {
        logger.error(
            chalk.red('Local flit not found in'),
            chalk.magenta(tildify(env.cwd))
        );
        logger.log(chalk.red('Try running: npm install flit'));
        process.exit(1);
    }

    if (!env.configPath) {
        logger.error(chalk.red('No flitfile found'));
        process.exit(1);
    }

    require(env.modulePath).cli(env, nomnom.bind(null, od));
}

function nomnom() {
    var _nomnom = require('nomnom')().script('flit');
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift({});
    var options = _.assign.apply(_, args);
    _.forEach(options, function (option, key) {
        if (typeof options === 'function') {
            console.error('Command not supported now.');
        } else {
            _nomnom.option(key, parse(option))
        }
    });

    function parse(option) {
        return _.transform(option, function (result, value, key) {
            if (['shortcut', 'short', 'alias'].indexOf(key) >= 0) {
                result.abbr = value;
            } else if (['description', 'desc', 'help'].indexOf(key) >= 0) {
                result.help = value;
            } else if (['flag', 'boolean'].indexOf(key) >= 0 || (key === 'type' && value === 'boolean')) {
                result.flag = true;
            } else {
                result[key] = value;
            }
        });
    }
    return _nomnom;
}
