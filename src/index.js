const client = require('./client');
const server = require('./server');

exports.initClient = client.init;
exports.getGitHash = client.getGitHash;
exports.sendPhonehome = client.sendPhonehome;
exports.updateToHash = client.updateToHash;

exports.initServer = server.init;
exports.phonehomeHandler = server.phonehomeHandler;
