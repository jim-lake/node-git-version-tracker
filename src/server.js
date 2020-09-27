const async = require('async');

exports.init = init;
exports.phonehomeHandler = phonehomeHandler;

let g_config = {
  pool: null,
  phonehomeTable: 'ngvt_phonehome',
  versionTable: 'ngvt_version',
};
let errorLog = _defaultErrorLog;

function init(args) {
  Object.extend(g_config, args);
  if (args.errorLog) {
    errorLog = args.errorLog;
  }
}

function phonehomeHandler(req, res) {
  res.header('Cache-Control', 'no-cache,no-store,must-revalidate');
  const package_name = _reqString(req, 'package_name');
  const hostname = _reqString(req, 'hostname');
  const git_hash = _reqString(req, 'git_hash');
  const raw_ip_list = req.body.ip_list;

  let ip_list = '';
  if (Array.isArray(raw_ip_list)) {
    ip_list = raw_ip_list.join(',');
  } else if (typeof raw_ip_list === 'string') {
    ip_list = raw_ip_list;
  }

  if (!package_name) {
    res.status(400).send('package_name is required');
  } else if (!hostname) {
    res.status(400).send('hostname is required');
  } else {
    const body = {};
    async.series(
      [
        (done) => {
          if (git_hash) {
            const sql = `
INSERT INTO ${g_config.phonehomeTable} SET ?
ON DUPLICATE KEY UPDATE ?
`;
            const new_obj = {
              package_name,
              hostname,
              git_hash,
              ip_list,
            };
            const updates = {
              git_hash,
              ip_list,
            };
            const values = [new_obj, updates];
            g_config.pool.query(sql, values, (err) => {
              if (err) {
                errorLog('phonehomeHandler: insert err:', err);
              }
              done(err);
            });
          } else {
            done();
          }
        },
        (done) => {
          const sql = `
SELECT hostname_regex, git_hash
FROM ${g_config.versionTable}
WHERE package_name = ?
ORDER BY match_priority DESC, hostname_regex ASC
`;
          g_config.pool.query(sql, [package_name], (err, results) => {
            if (err) {
              errorLog('phonehomeHandler: find version err:', err);
            } else {
              const found = _findMatch(results, hostname);
              if (found) {
                body.git_hash = found.git_hash;
              }
            }
            done(err);
          });
        },
      ],
      (err) => {
        if (err) {
          res.sendStatus(500);
        } else {
          res.send(body);
        }
      }
    );
  }
}

function _findMatch(results, hostname) {
  let ret = results.find((result) => {
    const { hostname_regex } = result;
    const regex = new RegExp(hostname_regex);
    return regex.test(hostname);
  });
  return ret;
}

function _reqString(req, name) {
  const val = req.body[name];
  let ret;
  if (typeof val === 'string') {
    ret = val;
  }
  return ret;
}
function _defaultErrorLog(...args) {
  console.error(...args);
}
