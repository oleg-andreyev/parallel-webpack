import { jsVariants as jsVars } from 'interpret';
import { endsWith } from 'lodash';
import chalk from 'chalk';

const availableExts = Object.keys(jsVars);

// sort extensions to ensure that .babel.js and
// similar ones are always matched before .js
const compareExtensions = (a, b) => {
    const res = -(a.split(/\./).length - b.split(/\./).length);
    // all things being equal, we need to
    // prioritize .js as it is most likely
    if (res === 0) {
        if (a === '.js') {
            return -1;
        }
        if (b === '.js') {
            return 1;
        }
        return 0;
    }
    return res;
};

availableExts.sort(compareExtensions);

const getMatchingLoaderFn = (configPath, extensions, variants) => {
    let availableExtensions = extensions || availableExts;
    let jsVariants = variants || jsVars;
    let retVal = null;

    availableExtensions.some(ext => {
        if (endsWith(configPath, ext)) {
            retVal = jsVariants[ext];
            return true;
        }
    });
    return retVal;
};

const callConfigFunction = fn =>
    fn(require('minimist')(process.argv, { '--': true }).env || {});

const getConfig = configPath => {
    const configModule = require(configPath);
    const configDefault =
        configModule && configModule.__esModule
            ? configModule.default
            : configModule;
    return typeof configDefault === 'function'
        ? callConfigFunction(configDefault)
        : configDefault;
};

export default (configPath, matchingLoader) => {
    const getMatchingLoader = matchingLoader || getMatchingLoaderFn;

    let mod = getMatchingLoader(configPath);
    if (mod) {
        let mods = Array.isArray(mod) ? mod : [mod];
        let installed = false;

        for (let mod of mods) {
            if (typeof mod === 'string') {
                try {
                    require(mod);
                    installed = true;
                } catch (ignored) {}
            } else if (typeof mod === 'object') {
                try {
                    var s = require(mod.module);
                    mod.register(s);
                    installed = true;
                } catch (ignored) {}
            }

            if (installed) {
                break;
            }
        }

        if (!installed) {
            throw new Error(
                'Could not load required module loading for ' +
                    chalk.underline(configPath),
            );
        }
    }
    return getConfig(configPath);
};

export const getMatchingLoader = getMatchingLoaderFn;
export const availableExtensions = availableExts;
