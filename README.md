# Hyperfeed

[![NPM Version](https://img.shields.io/npm/v/hyperfeed.svg)](https://www.npmjs.com/package/hyperfeed) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Hyperfeed is a self-archiving P2P live feed. You can convert any RSS/ATOM/RDF feed to a P2P live update publishing network.

* **Self-archiving**: All published items will be archived. If the feed is updated and doesn't contain old items, Hyperfeed still preserve them.
* **P2P**: Feed items are distributed in a P2P manner. Save bandwidth and support offline mode.
* **Live**: No need to poll the RSS feed. Updates will be pushed to you.

```
npm install hyperfeed
```

## Synopsis

Publish your RSS feed through hyperfeed:

```js
const request = require('request')
const hyperfeed = require('hyperfeed')
const hyperdrive = require('hyperdrive')
const swarm = require('hyperdiscovery')

const url = 'https://medium.com/feed/google-developers'

var archive = hyperdrive('./feed')
var feed = hyperfeed(archive)
feed.ready(() => {
  swarm(archive)
  console.log(feed.key.toString('hex'))
  feed.update(request(url), (err) => {
    console.log('feed imported')
  })
})

```

Now you can replicate the hyperfeed through a p2p network:

```js
const Hyperfeed = require('hyperfeed')
const swarm = require('hyperdiscovery')
const hyperdrive = require('hyperdrive')

var archive = hyperdrive('./anotherFeed', '<KEY FROM ABOVE>')
var feed = hyperfeed(archive)
swarm(archive) // load the feed from the p2p network
feed.list((err, entries) => {
  console.log(entries) // all entries in the feed (include history entries)
})
```

## API

#### `var feed = hyperfeed(archive, [opts])`

Create a new Hyperfeed instance. `opts` includes:

```javascript
{
  scrapLink: true // set to false to stop archiving linked url for each feed item
}
```

#### `feed.key`

The public key identifying the feed.

#### `feed.discoveryKey`

A key derived from the public key that can be used to discovery other peers sharing this feed.

#### `feed.meta`

The metadata of the feed.

#### `feed.ready(cb)`

Wait for feed is fully ready and all properties has been populated.

#### `feed.update(feedStream, cb(err, feed))`

import a RSS feed into `feed`. Accept a stream.

#### `feed.setMeta(metadataObject, cb(err))`

Set feed's metadata.

#### `feed.list(cb(err, entries))`

List archived item in the feed.

#### `feed.save(item, [scrappedData], cb(err))`

Save a new feed item.  Check [https://github.com/jpmonette/feed](https://github.com/jpmonette/feed) for item detail.

If you already have scrapped data for the given item, you can pass it to `scrappedData` to avoid redundant requests.

#### `feed.export(count, cb(err, rss))`

Export a RSS-2.0 Feed containing latest `count` items.

## Related Modules

* [hyperfeed-server](https://github.com/poga/hyperfeed-server): host a hyperfeed from cli
* [hyperfeed-merge](https://github.com/poga/hyperfeed-merge): merge multiple hyperfeed into one

## License

The MIT License
