const ram = require('random-access-memory')
const hyperdrive = require('hyperdrive')
const Feed = require('feed')
const hyperfeed = require('..')

function createArchive (key, opts) {
  return hyperdrive(ram, key, opts)
}

function createFeed (cb) {
  var archive = createArchive()
  archive.ready(() => {
    cb(null, hyperfeed(archive, {scrap: false}))
  })
}

function createFeedWithFixture (cb) {
  var archive = createArchive()
  archive.ready(() => {
    var feed = hyperfeed(archive, {scrap: false})
    feed.update(fixture(), function (err) {
      if (err) return cb(err)

      cb(null, feed)
    })
  })
}

function fixture () {
  var feed = new Feed({
    title: 'test feed',
    description: 'http://example.com',
    link: 'http://example.com'
  })
  var testEntries = []
  for (var i = 0; i < 10; i++) {
    var x = {
      title: `entry${i}`,
      description: `desc${i}`,
      link: 'example.com',
      guid: `id-${i}`,
      date: new Date()
    }
    testEntries.push(x)
    feed.addItem(x)
  }
  return feed.render('rss-2.0')
}

module.exports = {createArchive, createFeed, fixture, createFeedWithFixture}
