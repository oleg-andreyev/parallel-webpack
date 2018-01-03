import workerFarm from 'worker-farm';
import Ajv from 'ajv';
import Promise from 'bluebird';
import chalk from 'chalk';
import pluralize from 'pluralize';
import schema from '../schema.json';
import loadConfigurationFile from './loadConfigurationFile';
import { startWatchIPCServer } from './watchModeIPC';

const validate = new Ajv({
    allErrors: true,
    coerceTypes: true,
    removeAdditional: 'all',
    useDefaults: true,
}).compile(schema);

const startFarm = (config, configPath, options = {}, runWorker, callback) => {
    config = Array.isArray(config) ? config : [config];
    const silent = !!options.json;

    // When in watch mode and a callback is provided start IPC server to invoke callback
    // once all webpack configurations have been compiled
    if (options.watch) {
        startWatchIPCServer(callback, Object.keys(config));
    }

    if (!silent) {
        console.log(
            `${chalk.blue('[WEBPACK]')} Building ${chalk.yellow(
                config.length,
            )} ${pluralize('target', config.length)}`,
        );
    }

    const builds = config.map((c, i) =>
        runWorker(configPath, options, i, config.length),
    );

    if (options.bail) {
        return Promise.all(builds);
    } else {
        return Promise.settle(builds).then(results =>
            Promise.all(
                results.map(
                    result =>
                        result.isFulfilled()
                            ? result.value()
                            : Promise.reject(result.reason()),
                ),
            ),
        );
    }
};

/**
 * Runs the specified webpack configuration in parallel.
 * @param {String} configPath The path to the webpack.config.js
 * @param {Object} options
 * @param {Boolean} [options.watch=false] If `true`, Webpack will run in
 *   `watch-mode`.
 * @param {Number} [options.maxCallsPerWorker=Infinity] The maximum amount of calls
 *   per parallel worker
 * @param {Number} [options.maxConcurrentWorkers=require('os').cpus().length] The
 *   maximum number of parallel workers
 * @param {Number} [options.maxConcurrentCallsPerWorker=10] The maximum number of
 *   concurrent call per prallel worker
 * @param {Number} [options.maxConcurrentCalls=Infinity] The maximum number of
 *   concurrent calls
 * @param {Number} [options.maxRetries=0] The maximum amount of retries
 *   on build error
 * @param {Function} [callback] A callback to be invoked once the build has
 *   been completed
 * @return {Promise} A Promise that is resolved once all builds have been
 *   created
 */
export const run = (configPath, options = {}, callback) => {
    const argvBackup = process.argv;
    const farmOptions = { ...options };
    const silent = !!options.json;
    let config;

    if (!options.colors) {
        options.colors = chalk.supportsColor;
    }
    if (!options.argv) {
        options.argv = [];
    }
    options.argv.unshift(process.execPath, 'parallel-webpack');

    try {
        process.argv = options.argv;
        config = loadConfigurationFile(configPath);
        process.argv = argvBackup;
    } catch (e) {
        process.argv = argvBackup;
        return Promise.reject(
            new Error(
                chalk.red('[WEBPACK]') +
                    ' Could not load configuration file ' +
                    chalk.underline(configPath) +
                    '\n' +
                    e,
            ),
        );
    }

    if (!validate(farmOptions)) {
        return Promise.reject(
            new Error(
                'Options validation failed:\n' +
                    validate.errors
                        .map(error => {
                            return (
                                'Property: "options' +
                                error.dataPath +
                                '" ' +
                                error.message
                            );
                        })
                        .join('\n'),
            ),
        );
    }

    const workers = workerFarm(farmOptions, require.resolve('./webpackWorker'));

    const shutdownCallback = () => {
        if (!silent) {
            console.log(chalk.red('[WEBPACK]') + ' Forcefully shutting down');
        }
        workerFarm.end(workers);
    };

    process.on('SIGINT', shutdownCallback);

    const startTime = Date.now();
    const farmPromise = startFarm(
        config,
        configPath,
        options,
        Promise.promisify(workers),
        callback,
    )
        .error(err => {
            if (!silent) {
                console.log(
                    '%s Build failed after %s seconds',
                    chalk.red('[WEBPACK]'),
                    chalk.blue((Date.now() - startTime) / 1000),
                );
            }
            return Promise.reject(err);
        })
        .then(results => {
            if (!silent) {
                console.log(
                    '%s Finished build after %s seconds',
                    chalk.blue('[WEBPACK]'),
                    chalk.blue((Date.now() - startTime) / 1000),
                );
            }
            results = results.filter(result => result);
            if (results.length) {
                return results;
            }
        })
        .finally(function() {
            workerFarm.end(workers);
            process.removeListener('SIGINT', shutdownCallback);
        });

    if (!options.watch) {
        farmPromise.asCallback(callback);
    }
    return farmPromise;
};

export { createVariants } from './createVariants';
