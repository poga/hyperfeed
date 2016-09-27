# Hyperfeed

[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

a self-archiving p2p live RSS feed.

* **Self-archiving**: All published items will be archived. If the feed is updated and doesn't contain old items, Hyperfeed still preserve them.
* **P2P Live**: No need to constantly scrap a RSS feed, Updates will be pushed to you.
* **Secure**: All items are verified via publisher's public key.

```
npm install hyperfeed
```

## Synopsis

host a feed:

```js
const request = require('request')
const Hyperfeed = require('hyperfeed')

request('https://medium.com/feed/google-developers', (err, resp, body) => {
  var feed = new Hyperfeed()
  feed.update(body).then(feed => {
    feed.swarm() // share it through a p2p network
    console.log(feed.key().toString('hex')) // this will be the key for discovering
  })
})
```

download feed from peer

```js
const Hyperfeed = require('hyperfeed')

var feed = new Hyperfeed(<KEY FROM ABOVE>)
feed.swarm() // load the feed from the p2p network
feed.list((err, entries) => {
  console.log(entries) // all entries in the feed (include history entries)
})
```

## API

#### `new Hyperfeed([key], [options])`

Create a new Hyperfeed instance. If you want to download from an existing feed, pass the feed's key as the first argument. Options include

```js
{
  storage: memdb() // a level db instance. default to memdb.
}
```

#### `feed.swarm(opts)`

Start replicating the feed with a swarm p2p network. Peers can download this feed with its key.

##### Options

* `signalhub`: the url of the signalhub.
* `signalhubPrefix`: the prefix for the archive's signalhub key
* `wrtc`: a webrtc instance, e.g. electron-webrtc, if not natively supported
* `upload`: bool, upload data to the other peer?
* `download`: bool, download data from the other peer?
* `port`: port for discovery swarm
* `utp`: use utp in discovery swarm
* `tcp`: use tcp in discovery swarm

Defaults from datland-swarm-defaults can also be overwritten:

* `dns.server`: DNS server
* `dns.domain`: DNS domain
* `dht.bootstrap`: distributed hash table bootstrapping nodes

#### `feed.key()`

Returns the 32-bit public key of the feed.

#### `var promise = feed.update(rssXML)`

Parse and save new items from a Feed XML. We support RSS and ATOM.

#### `feed.meta`

Returns the metadata of the feed.

#### `var promise = feed.setMeta(obj)`

Explicitly set the metadata

#### `var promise = feed.push(item)`

Push a new feed item into hyperfeed. Check [https://github.com/jpmonette/feed](https://github.com/jpmonette/feed) for item detail.

#### `var promise = feed.list(opts)`

Returns all items in the hyperfeed, include history.

#### `var promise = feed.xml(count)`

Returns a RSS-2.0 Feed in XML format containing latest `count` items.

## License

The MIT License
