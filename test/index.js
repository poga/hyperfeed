const tape = require('tape')
const peerRSS = require('..')
const RSS = require('rss')
const request = require('request')
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

tape('create archive from rss', function (t) {
  var torrent = new peerRSS.Torrent()
  torrent.update(feed.xml()).then(torrent => {
    torrent.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 10 + 1) // 10 feed item and 1 meta file
      t.end()
    })
  })
})

tape('create xml', function (t) {
  var torrent = new peerRSS.Torrent()
  torrent.update(feed.xml()).then(torrent => {
    torrent.xml(10).then(xml => {
      var parser = new FeedParser()
      toStream(xml).pipe(parser)

      var entries = []
      parser.on('error', e => t.error(e))
      parser.on('meta', meta => {
        t.same(meta.title, 'test feed')
        t.same(meta.xmlUrl, 'foo')
        t.same(meta.link, 'bar')
      })
      parser.on('data', entry => {
        entries.push(entry)
      })
      parser.on('end', () => {
        t.same(entries.sort((x, y) => { return x.ctime - y.ctime }).map(x => x.title), testEntries.map(x => x.title))
        t.end()
      })
    })
  })
})

tape('dedup', function (t) {
  var feed = new RSS({
    title: 'test feed',
    feed_url: 'foo',
    site_url: 'bar'
  })
  var testEntries = []
  for (var i = 0; i < 3; i++) {
    var x = {
      title: `entry${i}`,
      description: `desc${i}`,
      url: 'example.com',
      guid: 1, // all with same guid
      date: Date.now()
    }
    testEntries.push(x)
    feed.item(x)
  }

  var torrent = new peerRSS.Torrent()
  torrent.update(feed.xml()).then(torrent => {
    torrent.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 1 + 1) // 1 feed item and 1 meta file
      t.end()
    })
  })
})
