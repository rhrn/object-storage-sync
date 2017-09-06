# object-storage-sync

* Sync files between object storages (based on [pkgcloud](https://github.com/pkgcloud/pkgcloud))

## Install

```
npm install -g object-storage-sync
```

## Usage

* Create `source.json` and `target.json` with credentials

  - Examples: https://github.com/pkgcloud/pkgcloud#storage

  * amazon
  ```
    {
      "provider": "amazon",
      "keyId": "your-access-key-id",
      "key": "your-secret-key-id",
      "region": "us-west-2"
    }
  ```

  * azure
  ```
    {
      "provider": "azure",
      "storageAccount": "test-storage-account",
      "storageAccessKey": "test-storage-access-key"
    }
  ```

  * google
  ```
    {
      "provider": "google",
      "keyFilename": "/path/to/a/keyfile.json",
      "projectId": "eco-channel-658"
    }
  ```

  * hp
  ```
    {
      "provider": "hp",
      "username": "your-user-name",
      "apiKey": "your-api-key",
      "region": "region of identity service",
      "authUrl": "https://your-identity-service"
    }
  ```

  * openstack
  ```
    {
      "provider": "openstack",
      "username": "your-user-name",
      "password": "your-password",
      "authUrl": "your identity service url"
    }
  ```

  * rackspace
  ```
    {
      "provider": "rackspace",
      "username": "your-user-name",
      "apiKey": "your-api-key",
      "region": "IAD",
      "useInternal": false
    }
  ```

* Sync by filename (ordered by path)

  * init sync
  ```
  object-storage-sync sync-name my-container --to my-special-container
  ```

  * start sync from certain fileaname or path
  ```
  object-storage-sync sync-name my-container --to my-special-container --marker dir/filename.jpg
  ```

  * show help
  ```
  object-storage-sync sync-name --help
  ```

* Sync by last modified

  * init sync
  ```
  object-storage-sync sync-date my-container --to my-special-container
  ```

  * start from certain date
  ```
  object-storage-sync sync-date my-container --to my-special-container --since 2017-01-01
  ```

  * show help
  ```
  object-storage-sync sync-date --help
  ```

## Help

```
object-storage-sync --help
```

```
Commands:

help [command...]                Provides help for a given command.
credentials                      Show credentials
containers                       Show containers list
sync-date [options] [container]  Syncronize container by date
sync-name [options] [container]  Syncronize container by file name
clear-date-marker [container]    Clear date marker
clear-name-marker [container]    Clear name marker
```
