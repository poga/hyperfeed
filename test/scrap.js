const tape = require('tape')
const hyperfeed = require('..')
const {createArchive} = require('./helpers')

const Feed = require('feed')

var feed = new Feed({
  title: 'test feed',
  description: 'http://example.com',
  link: 'http://example.com'
})

feed.addItem({
  title: 'title',
  description: 'desc',
  link: 'https://raw.githubusercontent.com/poga/hyperfeed/master/LICENSE',
  guid: 'foo',
  date: new Date()
})
var rss = feed.render('rss-2.0')

tape('scrap', function (t) {
  testFeed((err, f) => {
    t.error(err)

    f.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 1)
      t.same(entries[0], feed.items[0].guid)
      t.end()
    })
  })
})

tape('scrap with list', function (t) {
  testFeed((err, f) => {
    t.error(err)
    f.list(function (err, entries) {
      t.error(err)
      t.same(entries, ['foo'])
      t.end()
    })
  })
})

tape('scraped data', function (t) {
  testFeed((err, f) => {
    t.error(err)
    f.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 1)

      f.get(`scrap/${entries[0]}`, (err, data) => {
        t.error(err)
        t.ok(data.toString().match(/The MIT License/))
        t.end()
      })
    })
  })
})

function testFeed (cb) {
  var archive = createArchive()
  archive.ready(() => {
    var feed = hyperfeed(archive, {scrap: true})
    feed.update(rss, cb)
  })
}
