const tape = require('tape')
const hyperfeed = require('..')
const toStream = require('string-to-stream')
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

tape('scrapped data', function (t) {
  testFeed((err, f) => {
    t.error(err)
    f.list((err, entries) => {
      t.error(err)
      t.same(entries, ['foo'])

      f.get(`scrapped/${entries[0]}`, (err, data) => {
        t.error(err)
        t.ok(data.toString().match(/The MIT License/))
        t.end()
      })
    })
  })
})

tape('getScrapped', function (t) {
  testFeed((err, f) => {
    t.error(err)
    f.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 1)

      f.getScrapped(entries[0], (err, data) => {
        t.error(err)
        t.ok(data.toString().match(/The MIT License/))
        t.end()
      })
    })
  })
})

function testFeed (cb) {
  var archive = createArchive()
  var feed = hyperfeed(archive, {scrapLink: true})
  feed.ready(() => {
    feed.update(toStream(rss), cb)
  })
}
