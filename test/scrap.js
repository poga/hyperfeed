const tape = require('tape')
const hyperfeed = require('..')

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
  hyperfeed().createFeed({scrap: true}).update(rss).then(f => {
    f.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 1)
      t.end()
    })
  })
})

tape('scrap with list stream', function (t) {
  hyperfeed().createFeed({scrap: true}).update(rss).then(f => {
    var list = f.list()
    var entries = []
    list.on('data', x => { entries.push(x) })
    list.on('end', () => {
      t.same(entries.length, 1)
      t.end()
    })
  })
})

tape('scraped data', function (t) {
  hyperfeed().createFeed({scrap: true}).update(rss).then(f => {
    f.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 1)

      f.load(`scrap/${entries[0].name}`, {raw: true}).then(data => {
        t.ok(data.match(/The MIT License/))
        t.end()
      })
    })
  })
})
