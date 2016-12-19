const tape = require('tape')
const hyperfeed = require('..')
const hyperdrive = require('hyperdrive')
const RSS = require('rss')
const memdb = require('memdb')
const swarm = require('hyperdrive-archive-swarm')

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
  var f1 = hyperfeed().createFeed()
  var write = swarm(f1)
  f1.update(feed.xml()).then(f1 => {
    var peer = hyperfeed().createFeed(f1.key, {own: false})
    var read = swarm(peer)
    peer.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 10)
      write.close()
      read.close()
      t.end()
    })
  })
})
