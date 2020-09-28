const child_process = require('child_process');
const os = require('os');
const { join: pathJoin } = require('path');
const request = require('request');

exports.init = init;
exports.getConfig = getConfig;
exports.getBootGitHash = getBootGitHash;
exports.getUpdateGitHash = getUpdateGitHash;
exports.isUpdateAvailable = isUpdateAvailable;
exports.runUpdate = runUpdate;
exports.needsRestart = needsRestart;
exports.sendPhonehome = sendPhonehome;
exports.updateToHash = updateToHash;

const REST_TIMEOUT = 20 * 1000;

let g_bootGitHash = null;
let g_currentGitHash = null;
let g_updateGitHash = null;
let errorLog = _defaultErrorLog;

let g_config = {
  packageName: '',
  repoDir: '.',
  url: null,
  requestExtra: {},
  restartHandler: _defaultRestartHandler,
  interval: 0,
  timeout: REST_TIMEOUT,
  autoUpdate: false,
  autoRestart: false,
};

function init(args, done) {
  Object.assign(g_config, args);
  if (args.errorLog) {
    errorLog = args.errorLog;
  }
  _readGitHash((err) => {
    done(err);

    sendPhonehome(_sendLater);
  });
}
function getConfig() {
  return g_config;
}
function getBootGitHash() {
  return g_bootGitHash;
}
function getUpdateGitHash() {
  return g_updateGitHash;
}
function isUpdateAvailable() {
  return Boolean(g_updateGitHash && g_updateGitHash !== g_currentGitHash);
}
function needsRestart() {
  return g_currentGitHash !== g_bootGitHash;
}
function runUpdate(done) {
  if (isUpdateAvailable()) {
    updateToHash(g_updateGitHash, done);
  } else {
    done('no_update');
  }
}

function _readGitHash(done) {
  if (g_bootGitHash) {
    done(null, g_bootGitHash);
  } else {
    var cmd = 'git log -n 1 --pretty=format:"%H"';
    const opts = {
      cwd: g_config.repoDir,
    };
    child_process.exec(cmd, opts, function (err, stdout, stderr) {
      if (err) {
        errorLog('getGitHash: failed with err:', err, stdout, stderr);
      } else {
        g_bootGitHash = stdout.trim();
        g_currentGitHash = g_bootGitHash;
      }
      done(err, g_bootGitHash);
    });
  }
}
function sendPhonehome(done) {
  const opts = {
    url: g_config.url,
    body: {
      package_name: g_config.packageName,
      hostname: os.hostname(),
      git_hash: g_bootGitHash,
      ip_list: _getIPList(),
    },
    method: 'POST',
    json: true,
    timeout: g_config.timeout,
    ...g_config.requestExtra,
  };
  request(opts, (err, response, body) => {
    const statusCode = response && response.statusCode;
    if (err) {
      errorLog('sendPhonehome: err:', err);
      done(err);
    } else if (statusCode < 200 || statusCode >= 300) {
      errorLog('sendPhonehome: bad status:', statusCode);
      done(statusCode);
    } else if (!body) {
      done('bad_body');
    } else {
      const { force_update, force_restart, git_hash } = body;
      g_updateGitHash = git_hash;
      if (force_restart) {
        g_config.autoRestart = true;
      }
      if (isUpdateAvailable() && (g_config.autoUpdate || force_update)) {
        updateToHash(g_updateGitHash, done);
      } else {
        done();
      }
    }
  });
}
function updateToHash(git_hash, done) {
  const script = pathJoin(__dirname, '../scripts/git_update_to_hash.sh');
  const cmd = `${script} ${git_hash} ${g_bootGitHash}`;
  const opts = {
    cwd: g_config.repoDir,
  };
  child_process.exec(cmd, opts, (err, stdout, stderr) => {
    if (err) {
      errorLog(
        'updateToHash: script failed with err:',
        err,
        'stdout:',
        stdout,
        'stderr:',
        stderr
      );
      done(err);
    } else {
      g_currentGitHash = git_hash;
      if (g_config.autoRestart) {
        g_config.restartHandler(done);
      } else {
        done();
      }
    }
  });
}

function _sendLater() {
  if (g_config.interval) {
    const next = sendPhonehome.bind(null, _sendLater);
    setTimeout(next, g_config.interval);
  }
}

function _getIPList() {
  const ip_list = [];
  const map = os.networkInterfaces();
  if (map) {
    for (let key in map) {
      const list = map[key];
      if (list && list.length > 0) {
        list.forEach((iface) => {
          const { internal, address } = iface;
          if (
            !internal &&
            address &&
            !address.startsWith('fe80') &&
            !address.startsWith('169.254')
          ) {
            ip_list.push(address);
          }
        });
      }
    }
  }
  return ip_list;
}
function _defaultErrorLog(...args) {
  console.error(...args);
}
function _defaultRestartHandler(done) {
  setTimeout(() => {
    process.exit(0);
  }, 100);
  done();
}
