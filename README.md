# Hyperfeed

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

## License

The MIT License
