import fs from 'fs';
import { jsVariants } from 'interpret';

const potentialExtensions = ['', ...Object.keys(jsVariants)];

const checkWithAccess = path => {
    try {
        fs.accessSync(path);
        return true;
    } catch (ignore) {
        return false;
    }
};

const checkWithStatSync = path => {
    try {
        var stats = fs.statSync(path);
        return stats.isFile();
    } catch (ignore) {
        return false;
    }
};

const exists = path =>
    fs.accessSync ? checkWithAccess(path) : checkWithStatSync(path);

module.exports = configPath => {
    for (let i = 0, len = potentialExtensions.length; i < len; i++) {
        const ext = potentialExtensions[i];
        if (exists(configPath + ext)) {
            // file exists, use that extension
            return configPath + ext;
        }
    }

    throw new Error('File does not exist');
};
