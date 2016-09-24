const tape = require('tape')
const hyperfeed = require('..')
const RSS = require('rss')
const FeedParser = require('feedparser')
const toStream = require('string-to-stream')

var feed = new RSS({
  title: 'test feed',
  feed_url: 'foo',
  site_url: 'bar'
})
var testEntries = []
for (var i = 0; i < 10; i++) {
  var x = {
    title: `entry${i}`,
    description: `desc${i}`,
    url: 'example.com',
    guid: i,
    date: Date.now()
  }
  testEntries.push(x)
  feed.item(x)
}

tape('replicate', function (t) {
  var torrent = new hyperfeed.Torrent()
  var write = torrent.swarm()
  torrent.update(feed.xml()).then(torrent => {
    var peer = new hyperfeed.Torrent(torrent.key())
    var read = peer.swarm()
    peer.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 10 + 1) // 10 feed item and 1 meta file
      write.close()
      read.close()
      t.end()
    })
  })
})
