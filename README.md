# Hyperfeed

[![NPM Version](https://img.shields.io/npm/v/hyperfeed.svg)](https://www.npmjs.com/package/hyperfeed) [![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Hyperfeed is a self-archiving P2P live feed. You can convert any RSS/ATOM/RDF feed to a P2P live update publishing network.

* **Self-archiving**: All published items will be archived. If the feed is updated and doesn't contain old items, Hyperfeed still preserve them.
* **P2P**: Feed items are distributed in a P2P manner. Save bandwidth and support offline mode.
* **Live**: No need to constantly scrap a RSS feed, Updates will be pushed to you.

```
npm install hyperfeed
```

## Synopsis

Create a hyperfeed from a RSS feed:

```js
const request = require('request')
const hyperfeed = require('hyperfeed')
const swarm = require('hyperdiscovery')

request('https://medium.com/feed/google-developers', (err, resp, body) => {
  hyperfeed().createFeed.update(body).then(feed => {
    swarm(feed) // share it through a p2p network
    console.log(feed.key.toString('hex')) // this will be the key for discovering
  })
})
```

Now you can replicate the hyperfeed through a p2p network:

```js
const Hyperfeed = require('hyperfeed')
const swarm = require('hyperdiscovery')

var feed = hyperfeed().createFeed(<KEY FROM ABOVE>, {own: false})
swarm(feed) // load the feed from the p2p network
feed.list((err, entries) => {
  console.log(entries) // all entries in the feed (include history entries)
})

// open a read stream, listening feed updates
var rs = feed.list({live: true})
rs.on('data', entry => {
  // whenever a new entry is available, you will automatically receive it without any polling

  // you can load the feed item with feed.load
  feed.load(entry).then(item => {
    // the actual feed item.
  })
})
```

## API

#### `var hf = hyperfeed([drive])`

Create a new Hyperfeed instance. If you want to reuse an existing hyperdrive, pass it as argument.

#### `var feed = hf.createFeed([key], [opts])`

Create a new Hyperfeed instance. If you want to download from an existing feed, pass the feed's key as the first argument. Options include

```js
{
  own: boolean, // REQUIRED if `key` is not null. Set to true if this is a hyperfeed you created (in the same storage) before.
  file: function (name) { return raf(name) }, // set to a raf if you want to save items to filesystem
  scrap: false      // if set to true, hyperfeed will also save the page each feed item pointed to.
}
```

where raf is

```js
const raf = require('random-access-file')
```

#### `feed.key`

The 32-bit public key of the feed.

#### `var promise = feed.update(rssXML)`

Parse and save new items from a Feed XML. We support RSS, ATOM, and RDF feeds.

#### `feed.meta`

Returns the metadata of the feed.

#### `var promise = feed.setMeta(obj)`

Explicitly set the metadata

#### `var stream = feed.list([opts], [cb])`

Returns a readable stream of all entries in the archive, include history

```js
{
  offset: 0 // start streaming from this offset (default: 0)
  live: false // keep the stream open as new updates arrive (default: false)
  withScrapped: false // also return scrapped data (default: false)
}
```

You can collect the results of the stream with cb(err, entries).

**Entries are metadata of feed items. If you want to get the feed item itself, call `feed.load(entry)`**

#### `var promise = feed.load(entry, [opts])`

Returns a Feed item from given entry.

if you want to load scrapped data and it's not a JSON. set `opts` to `{raw: true}`

`entry` is an object returned by `#list()`

#### `var promise = feed.save(item, [targetEntry], [scrappedData])`

Save a new feed item into hyperfeed. Check [https://github.com/jpmonette/feed](https://github.com/jpmonette/feed) for item detail.

If you want to specify entry metadata (e.g. `ctime`, `name`...), pass a `targetEntry`.

If you already have scrapped data from item.link, you can pass it to `scrappedData` to avoid redundant requests.

#### `var promise = feed.xml(count)`

Returns a RSS-2.0 Feed in XML format containing latest `count` items.

## Related Modules

* [hyperfeed-server](https://github.com/poga/hyperfeed-server): host a hyperfeed from cli
* [hyperfeed-merge](https://github.com/poga/hyperfeed-merge): merge multiple hyperfeed into one

## License

The MIT License
