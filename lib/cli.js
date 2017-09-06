#!/usr/bin/env node

'use strict';

const fs = require('fs');
const Path = require('path');
const pkgcloud = require('pkgcloud');
const Promise = require('bluebird');
const Rx = require('rxjs/Rx');
const vorpal = require('vorpal')();
const cwd = process.cwd();

const markerNameFile = container => `.object-storage-migrate-marker-name-file_${ container }`;
const markerDateFile = container => `.object-storage-migrate-marker-date-file_${ container }`;

Promise.config({
  warnings: {
    wForgottenReturn: false
  }
});

let sourceCredentials;
let targetCredentials;

let sourceClient;
let targetClient;

const internals = {};

internals.loadClientsError = (file) => (`
  Create ${ file } with object storage provider credentials.
  https://github.com/pkgcloud/pkgcloud#storage
  Examples:

  * Rackspace
  {
    "provider": "rackspace",
    "username": "your-user-name",
    "apiKey": "your-api-key",
    "region": "IAD",
    "useInternal": false
  }

  * Amazon
  {
    "provider": "amazon",
    "keyId": "your-access-key-id",
    "key": "your-secret-key-id",
    "region": "us-west-2"
  }
    
`);

internals.loadClients = () => {

  let sourceCredentialFile = 'source.json';
  let targetCredentialFile = 'target.json';

  try {
    sourceCredentials = require(Path.join(cwd, sourceCredentialFile));
  } catch(e) {
    throw new Error(internals.loadClientsError(sourceCredentialFile));
  }

  try {
    targetCredentials = require(Path.join(cwd, targetCredentialFile));
  } catch(e) {
    throw new Error(internals.loadClientsError(targetCredentialFile));
  }

  if (sourceCredentials) {
    sourceClient = pkgcloud.storage.createClient(sourceCredentials);
    Promise.promisifyAll(sourceClient);
  }

  if (targetCredentials) {
    targetClient = pkgcloud.storage.createClient(targetCredentials);
    Promise.promisifyAll(targetClient);
  }

};

internals.clearMarker = name => {

  try {
    fs.unlinkSync(name);
    console.log('deleted:', name);
  } catch(e) {

    if (e.errno === -2) {
      return console.log('empty:', name);
    }

    console.log(e);
  }

};

internals.clearDateMarker = (args) => {
  internals.clearMarker(markerDateFile(args.container))
};

internals.clearNameMarker = (args) => {
  internals.clearMarker(markerNameFile(args.container));
};

internals.getFiles = (container, params) => {

  params = params || {};
  params.limit = params.limit || 1000;

  const promise = sourceClient.getFilesAsync(container, params);

  return Rx.Observable.fromPromise(promise)
    .expand(data => {

      if (data.length !== params.limit) {
        return Rx.Observable.empty();
      }

      params.marker = data[ data.length - 1 ].name;

      const promise = sourceClient.getFilesAsync(container, params);

      return Rx.Observable.fromPromise(promise);
    });

};

internals.copyFile = (file, args) => {

  return new Promise((resolve, reject) => {

    const download = {
      remote: file.name,
      container: file.container
    };

    const readStream = file.client.download(download);

    const upload = {
      remote: file.name,
      contentType: file.contentType,
      container: args && args.options && args.options.to || file.container
    };

    const writeStream = targetClient.upload(upload);

    writeStream.on('finish', () => {
      resolve({ download, upload });
    });

    writeStream.on('error', reject);

    readStream.pipe(writeStream);
  });

};

exports.credentials = () => {

  internals.loadClients();

  console.log('Source:');
  console.log();
  console.log(JSON.stringify(sourceCredentials, null, 2));

  console.log();
  console.log('Target:');
  console.log();
  console.log(JSON.stringify(targetCredentials, null, 2));
  console.log();

};

exports.showContainters = (name, data) => {
  console.log();
  console.log(name);
  data.forEach(c => console.log(' ' + c.name));
};

exports.containters = (args, done) => {

  sourceClient.getContainersAsync()
    .then(data => {
      exports.showContainters('Source:', data);
      return targetClient.getContainersAsync();
    })
    .then(data => exports.showContainters('Target:', data))
    .asCallback(done);

};

exports.syncDate = (args, done) => {

  internals.loadClients();

  console.log('Sync by date', args);

  const params = { limit: 10000 };

  const markerFile = markerDateFile(args.container);

  let count = 0;

  let marker;

  if (args.options.since) {
    marker = new Date(args.options.since);
  }

  try {
    if (!marker) {
      marker = new Date(fs.readFileSync(markerFile).toString('utf8'));
    }
  } catch(e) {
    marker = new Date(0);
  }

  console.log('since', marker);

  internals.getFiles(args.container, params)
    .map(data => {

      return data
        .map(file => {
          file.lastModified = new Date(file.lastModified);
          return file;
        })
        .filter(file => file.lastModified > marker);

    })
    .reduce((acc, data) => acc.concat(data))
    .mergeMap(data => data.sort((a, b) => a.lastModified - b.lastModified))
    .concatMap(file => {
      return internals.copyFile(file, args)
        .then(data => {
          fs.writeFileSync(markerFile, file.lastModified.toISOString())
          return data;
        });
    })
    .subscribe(
      data => {
        count++;
        console.log(count, data.upload.remote);
      },
      err => done(err),
      () => done()
    );

};

exports.syncName = (args, done) => {

  internals.loadClients();

  console.log('Sync by file name', args);

  const markerFile = markerNameFile(args.container);

  let marker;

  if (args.options.marker) {
    marker = args.options.marker;
  }

  if (!marker) {
    try {
      marker = fs.readFileSync(markerFile).toString('utf8');
    } catch(e) { }
  }

  let count = 0;

  const params = { limit: 1 };

  if (!args.options['skip-marker'] && marker) {
    params.marker = marker;
  }

  console.log('Params', params);

  internals.getFiles(args.container, params)
    .mergeMap(data => data)
    .concatMap(file => {
      return internals.copyFile(file, args)
        .then(data => {
          fs.writeFileSync(markerFile, file.name)
          return data;
        });
    })
    .subscribe(
      data => {
        count++;
        console.log(count, data.upload.remote);
      },
      err => done(err),
      () => done()
    );

};

vorpal
  .command('credentials', 'Show credentials')
  .action(exports.credentials);

vorpal
  .command('containers', 'Show containers list')
  .action(exports.containters);

vorpal
  .command('sync-date [container]', 'Syncronize container by date')
  .option('--since [date]')
  .option('--to [container]', 'Target container')
  .option('--skip-marker', 'Skip previous sync')
  .action(exports.syncDate);

vorpal
  .command('sync-name [container]', 'Syncronize container by file name')
  .option('--marker [marker]')
  .option('--to [container]', 'Target container')
  .option('--skip-marker', 'Skip previous sync')
  .action(exports.syncName);

vorpal
  .command('clear-date-marker [container]', 'Clear date marker')
  .action(internals.clearDateMarker);

vorpal
  .command('clear-name-marker [container]', 'Clear name marker')
  .action(internals.clearNameMarker);

vorpal.parse(process.argv)

if (process.argv.length <= 2) {
  vorpal.exec('help');
}
