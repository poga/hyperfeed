const tape = require('tape')
const hyperfeed = require('..')

tape('reopen and list', function (t) {
  var hf = hyperfeed()
  var f1 = hf.createFeed()
  var f2 = hf.createFeed(f1.key(), {own: true})
  f1.save({title: 'foo'}).then(() => {
    f2.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 1)
      t.end()
    })
  })
})

tape('owner', function (t) {
  var torrent = hyperfeed().createFeed()
  t.same(torrent.own, true)
  var t2 = hyperfeed().createFeed(torrent.key(), {own: true})
  t.same(t2.own, true)
  t.end()
})

tape('not owner', function (t) {
  var key = '8a2b34a78d9f940c6379f5a6cabd673bf722ea45025a6db5e8e7a94bd3517dc9' // random key
  var f = hyperfeed().createFeed(key, {own: false})
  t.same(f.own, false)
  t.end()
})
