'use strict';
var crypto = require('crypto');
var querystring = require('querystring');

var gutil = require('gulp-util');
var path = require('path');
var axios = require('axios');
var through = require('through');

module.exports = function (opts) {
  opts = opts || {};

  // AUTHENTICATION params
  if (!opts.publicKey || !opts.secretKey)
    throw new gutil.PluginError('gulp-onesky', 'please specify public and secret keys');

  if (!opts.projectId)
    throw new gutil.PluginError('gulp-onesky', 'please specify project id');

  // ACTION params
  if (!opts.action)
    opts.action = 'MULTILINGUAL_FILE';

  if (!opts.sourceFile)
    throw new gutil.PluginError('gulp-onesky', 'please specify source file name');

  if (opts.action === 'LOCALE_FILE' && !opts.locale)
    throw new gutil.PluginError('gulp-onesky', 'please specify locale');

  // EXPORT params
  if (!opts.outputFile)
    opts.outputFile = opts.sourceFile + '.i18n.json';


  var stream = through(function (file, enc, cb) {
    this.push(file);
    cb();
  });

  var callback = function (err, body) {
    if (err) {
      stream.emit('error', err);
      return;
    }

    if (opts.locales) {
      Object.keys(body).forEach(function (lang) {
        stream.queue(new gutil.File({
          path: path.join(opts.outputDir, lang.split('-')[0], 'messages.json'),
          contents: new Buffer(JSON.stringify(body[lang], null, 2))
        }));
      });
    } else {
      stream.queue(new gutil.File({
        path: opts.outputFile,
        contents: new Buffer(JSON.stringify(body, null, 2))
      }));
    }

    stream.emit('end');
  };

  switch (opts.action)
  {
    default:
    case 'MULTILINGUAL_FILE':
      getMultilingualFile(opts, callback);
      break;

    case 'LOCALE_FILE':
      getFile(opts, callback);
      break;
  }

  return stream;
};

function getFile(opts, cb)
{
  var time = Math.floor(Date.now() / 1000);
  var hash = crypto.createHash('md5').update('' + time + opts.secretKey).digest('hex');

  var url = 'https://platform.api.onesky.io/1/projects/' + opts.projectId +
    '/translations?' + querystring.stringify({
      'api_key': opts.publicKey,
      'timestamp': time,
      'dev_hash': hash,
      'locale': opts.locale,
      'source_file_name': opts.sourceFile
    });

  doRequest(url, cb);
}

function getMultilingualFile(opts, cb)
{
  var time = Math.floor(Date.now() / 1000);
  var hash = crypto.createHash('md5').update('' + time + opts.secretKey).digest('hex');
  var url = 'https://platform.api.onesky.io/1/projects/' + opts.projectId +
    '/translations/multilingual?' + querystring.stringify({
      'api_key': opts.publicKey,
      'timestamp': time,
      'dev_hash': hash,
      'file_format': 'I18NEXT_MULTILINGUAL_JSON',
      'source_file_name': opts.sourceFile
    });

  doRequest(url, cb);
}

function doRequest(url, cb)
{
  axios.get(url, {
    responseType: 'arraybuffer'
  })
    .then(function (response) {
      var body = response.data;
      var err = null;

      if (body.meta) {
        if (body.meta.status !== 200) {
          err = new gutil.PluginError('gulp-onesky', body.meta.message);
          cb(err, null);
          return;
        } else {
          body = body.meta.data;
        }
      }

      cb(null, body);
    })
    .catch(function (error) {
      var err = new gutil.PluginError('gulp-onesky', error.message || error.toString());
      cb(err, null);
    });
}

module.exports.locales = function (opts) {
  opts.locales = true;
  return module.exports(opts);
};
