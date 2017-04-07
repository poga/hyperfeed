const tape = require('tape')
const hyperfeed = require('..')
const Feed = require('feed')
const FeedParser = require('feedparser')
const toStream = require('string-to-stream')
const {createFeed, createFeedWithFixture} = require('./helpers')

tape('update & list', function (t) {
  createFeedWithFixture().then(f => {
    f.list((err, entries) => {
      t.error(err)
      t.same(entries.length, 10)
      t.end()
    })
  })
})

tape('multiple update', function (t) {
  var feed2 = new Feed({
    title: 'test feed',
    description: 'http://example.com',
    link: 'http://example.com'
  })
  for (var i = 0; i < 10; i++) {
    var x = {
      title: `entry${i}`,
      description: `desc${i}`,
      url: 'example.com',
      guid: `id-${i}`,
      date: new Date()
    }
    feed2.addItem(x)
  }
  createFeedWithFixture().then(f => {
    // update with same xml
    f.update(feed2.render('rss-2.0')).then(f => {
      f.list((err, entries) => {
        t.error(err)
        t.same(entries.length, 10)

        // update with xml + 1 new item
        var x = {
          title: `entry${10}`,
          description: `desc${10}`,
          url: 'example.com',
          guid: `id-${10}`,
          date: new Date()
        }
        feed2.addItem(x)
        f.update(feed2.render('rss-2.0')).then(f => {
          f.list((err, entries) => {
            t.error(err)
            t.same(entries.length, 11)
            t.end()
          })
        })
      })
    })
  })
})

tape('save', function (t) {
  var feed = new Feed({
    title: 'test feed',
    description: 'http://example.com',
    link: 'http://example.com'
  })
  var rss = feed.render('rss-2.0')
  createFeed().then(f => {
    f.update(rss).then(f => {
      f.save({title: 'moo'}).then(() => {
        f.list((err, entries) => {
          t.error(err)
          f.get(entries[0]).then(item => {
            t.error(err)

            t.ok(item) // should have default name(guid)
            t.end()
          })
        })
      })
    })
  })
})

tape('get not found', function (t) {
  createFeed().then(f => {
    f.get('non-exists').catch(err => {
      t.ok(err)
      t.end()
    })
  })
})

tape('save with pre-scrapped data', function (t) {
  createFeed().then(f => {
    f.save({title: 'foo'}, 'abc').then(() => {
      f.list((err, files) => {
        t.error(err)
        t.ok(files[0])
        t.same(files.length, 1)
        f.get(files[0]).then(item => {
          t.same(JSON.parse(item.toString()).title, 'foo')
          f.get(`scrap/${files[0]}`).then(data => {
            t.same(data.toString(), 'abc')
            t.end()
          })
        })
      })
    })
  })
})

tape('create xml', function (t) {
  createFeedWithFixture().then(f => {
    f.xml(10).then(xml => {
      var parser = new FeedParser()
      toStream(xml).pipe(parser)

      var entries = []
      parser.on('error', e => t.error(e))
      parser.on('meta', meta => {
        t.same(meta.title, 'test feed')
        t.same(meta.link, 'http://example.com')
      })
      parser.on('data', entry => {
        entries.push(entry)
      })
      parser.on('end', () => {
        t.same(entries.map(x => x.title).sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `entry${i}`))
        t.end()
      })
    })
  })
})

tape('dedup', function (t) {
  var feed = new Feed({
    title: 'test feed',
    description: 'http://example.com',
    link: 'http://example.com'
  })
  var testEntries = []
  for (var i = 0; i < 3; i++) {
    var x = {
      title: `entry${i}`,
      description: `desc${i}`,
      url: 'example.com',
      guid: 1, // all with same guid
      date: new Date()
    }
    testEntries.push(x)
    feed.addItem(x)
  }
  var rss = feed.render('rss-2.0')
  createFeed().then(f => {
    f.update(rss).then(f => {
      f.list((err, entries) => {
        t.error(err)
        t.same(entries.length, 1)
        t.end()
      })
    })
  })
})

tape('set meta', function (t) {
  createFeed().then(f => {
    f.setMeta({
      title: 'foo',
      description: 'http://example2.com',
      link: 'http://example2.com'
    }).then(f => {
      f.xml(10).then(xml => {
        var parser = new FeedParser()
        toStream(xml).pipe(parser)

        parser.on('error', e => t.error(e))
        parser.on('meta', meta => {
          t.same(meta.title, 'foo')
          t.same(meta.link, 'http://example2.com')
          t.same(meta.description, 'http://example2.com')
        })
        parser.on('data', entry => {
          // ignore entry, we still need this handler to consume the feed and trigger end event
        })
        parser.on('end', () => {
          t.end()
        })
      })
    })
  })
})
