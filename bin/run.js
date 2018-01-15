#! /usr/bin/env node

/**
 * Created by pgotthardt on 07/12/15.
 */
var commandLineUsage = require('command-line-usage'),
    run = require('../index').run,
    path = require('path'),
    chalk = require('chalk'),
    findConfigFile = require('../src/findConfigFile'),
    argv = require('minimist')(process.argv.slice(2), {
        '--': true,
        default: {
            help: false,
            watch: false,
            'max-retries': Infinity,
            // leave off file extension so that we can find the most appropriate one
            config: 'webpack.config',
            'parallel': require('os').cpus().length,
            json: false,
            colors: require('supports-color'),
            bail: true,
            stats: true
        },
        alias: {
            'm': 'max-retries',
            'p': 'parallel',
            'v': 'version'
        }
    }),
    configPath;

if(argv.version) {
    process.stdout.write('parallel-webpack ' + chalk.blue(require('../package').version) + "\n");
} else if (argv.help || process.argv.length === 2) {
    const usage = commandLineUsage([
        {
            header: 'parallel-webpack',
            content: 'Builds multi-config webpack projects in parallel'
        },
        {
            header: 'Options',
            optionList: [
                {
                    name: 'watch',
                    description: 'Running the watcher'
                },
                {
                    name: 'max-retries',
                    type: Number,
                    alias: 'm',
                    description: 'Number of maximum retries'
                },
                {
                    name: 'config',
                    type: String,
                    description: 'webpack configuration'
                },
                {
                    name: 'parallel',
                    type: Number,
                    alias: 'p',
                    description: 'Number of parallel threads'
                },
                {
                    name: 'json',
                    description: 'Output results as JSON'
                },
                {
                    name: '[no-]colors',
                    description: 'Output with colors'
                },
                {
                    name: 'bail',
                    description: 'bail'
                },
                {
                    name: '[no-]stats',
                    description: 'Output stats'
                },
                {
                    name: 'version',
                    alias: 'v'
                },
                {
                    name: 'help',
                    description: 'Print this usage guide.'
                }
            ]
        },
        {
            content: 'Project home: [underline]{https://github.com/trivago/parallel-webpack}'
        }
    ]);
    process.stdout.write(usage);
    return;
} else {
    try {
        chalk.enabled = argv.colors;
        configPath = findConfigFile(path.resolve(argv.config));

        run(configPath, {
            watch: argv.watch,
            maxRetries: argv['max-retries'],
            maxConcurrentWorkers: argv['parallel'],
            bail: argv.bail,
            json: argv.json,
            modulesSort: argv['sort-modules-by'],
            chunksSort: argv['sort-chunks-by'],
            assetsSort: argv['sort-assets-by'],
            exclude: argv['display-exclude'],
            colors: argv['colors'],
            stats: argv['stats'],
            argv: argv['--']
        }).then(function(stats) {
            if(argv.json && stats) {
                process.stdout.write(JSON.stringify(stats.map(function(stat) {
                    return JSON.parse(stat);
                }), null, 2) + "\n");
            }
        }).catch(function(err) {
            console.log(err.message);
            process.exit(1);
        });
    } catch (e) {
        if(e.message) {
            process.stdout.write(e.message + "\n");
            console.error(e.error);
        } else {
            process.stdout.write(chalk.red('[WEBPACK]') + ' Could not load configuration ' + chalk.underline(process.cwd() + '/' + argv.config) + "\n");
        }
        process.exit(1);
    }
}
