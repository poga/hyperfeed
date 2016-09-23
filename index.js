const hyperdrive = require('hyperdrive')
const FeedParser = require('feedparser')
const memdb = require('memdb')
const toStream = require('string-to-stream')
const async = require('async')
const RSS = require('rss')
const toString = require('stream-to-string')

function Torrent (opts) {
  if (!(this instanceof Torrent)) return new Torrent(opts)

  if (!opts) opts = {}
  if (!opts.storage) opts.storage = memdb()
  this._drive = hyperdrive(opts.storage)
  this._archive = this._drive.createArchive()
}

Torrent.prototype.update = function (feed) {
  var torrent = this
  return new Promise((resolve, reject) => {
    var feedparser = new FeedParser()
    toStream(feed).pipe(feedparser)

    var tasks = []
    feedparser.on('error', e => reject(e))
    feedparser.on('meta', meta => {
      this.meta = meta

      tasks.push((cb) => {
        var ws = torrent._archive.createFileWriteStream('_meta')
        toStream(JSON.stringify(meta)).pipe(ws).on('finish', cb)
      })
    })
    feedparser.on('readable', function () {
      var readable = this
      var entry

      while (entry = readable.read()) { tasks.push(save(entry)) }
    })
    feedparser.on('end', function () {
      async.parallel(tasks, (err, results) => {
        if (err) return reject(new Error('archive failed'))
        resolve(torrent)
      })
    })
  })

  function save (entry) {
    return (cb) => {
      if (!entry.guid) return cb(new Error('GUID not found'))

      var ws = torrent._archive.createFileWriteStream({
        name: entry.guid,
        ctime: entry.date ? entry.date.getTime() : 0
      })
      toStream(JSON.stringify(entry)).pipe(ws).on('finish', cb)
    }
  }
}

Torrent.prototype.list = function (opts, cb) {
  this._archive.finalize(() => {
    this._archive.list(opts, cb)
  })
}

Torrent.prototype.xml = function (count) {
  return new Promise((resolve, reject) => {
    this.list((err, entries) => {
      if (err) return reject(err)
      if (entries.length > count) {
        entries = entries.filter(e => e.name !== '_meta').sort(byCTimeDESC).slice(0, 10)
      }

      buildXML(this._archive, this.meta, entries).then(xml => resolve(xml))
    })
  })
}

exports.Torrent = Torrent

function buildXML (archive, meta, entries) {
  return new Promise((resolve, reject) => {
    var feed = new RSS(Object.assign(meta, {feed_url: meta.xmlUrl, site_url: meta.link}))
    var tasks = []
    entries.forEach(e => {
      tasks.push(load(archive, e))
    })

    async.parallel(tasks, (err, results) => {
      if (err) return reject(err)
      results.forEach(r => feed.item(JSON.parse(r)))
      resolve(feed.xml())
    })
  })
}

function byCTimeDESC (x, y) {
  return y.ctime - x.ctime
}

function load (archive, entry) {
  return (cb) => {
    var rs = archive.createFileReadStream(entry)
    toString(rs, cb)
  }
}
