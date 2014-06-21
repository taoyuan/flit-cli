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

var ops = {
    'help': {
        alias: 'h',
        flag: true,
        description: 'Display this help text.'
    },
    'base': {
        description: 'Specify an alternate base path. By default, all file paths are relative to the flitfile.'
    },
    'flitfile': {
        description: 'Specify an alternate flitfile. By default, flit looks in the' +
            'current or parent directories for the nearest flitfile.js or' +
            'flitfile.coffee file.'
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

var argo = nomnom(ops);
var options = argo.parse();

// Do stuff based on CLI options.
if ('completion' in options) {
    completion(options.completion);
} else if (options.version) {
    console.log(pkg.name, 'v' + pkg.version);
}

var cli = new Liftoff({
    name: 'flit',
    completions: completion,
    extensions: interpret.jsVariants
});

// wire up a few err listeners to liftoff
cli.on('require', function (name) {
    if (options.verbose) logger.log('Requiring external module', chalk.magenta(name));
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
    if (!env.modulePath || !env.configPath) {
        if (options.help) {
            argo.print(argo.getUsage());
        } else if (options.version) {
            process.exit(0);
        }
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

    var flit = require(env.modulePath);

    // this is what actually loads up the flitfile
    var flitConfig = require(env.configPath);
    if (typeof flitConfig === 'function') flitConfig(flit);

    argo = nomnom(ops, flit.tools);
    options = argo.parse();

    var _tasks, _options;
    if (options.version) {
        logger.log('flit v' + flit.version);
        if (options.verbose) {
            // --verbose
            console.log('Install path: ' + chalk.magenta(tildify(path.dirname(env.modulePath))));

            // Display available tasks (for shell completion, etc).
            _tasks = Object.keys(flit.tasks).sort();
            console.log('Available tasks: ' + chalk.magenta(_tasks.join(' ')));

            _options = [];
            _.reduce(argo.specs, function (result, item) {
                if (item.position == undefined) {
                    _options.push('--' + item.name);
                    if (item.abbr) {
                        _options.push('-' + item.abbr);
                    }
                }
            });
            console.log('Available options: ' + chalk.magenta(_options.join(' ')));
        }

        return;
    }

    if (options.help) {
        argo.print(argo.getUsage());
    }

    flit.cli(env, options);
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
        return {
            abbr: option.shortcut || option.short || option.alias,
            help: option.description || option.desc || option.help,
            flag: option.flag || option.boolean || (option.type == 'boolean')
        }
    }
    return _nomnom;
}
