const ram = require('random-access-memory')
const hyperdrive = require('hyperdrive')
const Feed = require('feed')
const hyperfeed = require('..')

function createArchive (key, opts) {
  return hyperdrive(ram, key, opts)
}

function createFeed () {
  return new Promise((resolve, reject) => {
    var archive = createArchive()
    archive.ready(() => {
      resolve(hyperfeed(archive, {scrap: false}))
    })
  })
}

function createFeedWithFixture () {
  return new Promise((resolve, reject) => {
    var archive = createArchive()
    archive.ready(() => {
      var feed = hyperfeed(archive, {scrap: false})
      feed.update(fixture()).then(() => resolve(feed))
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
