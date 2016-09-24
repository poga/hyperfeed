const hyperdrive = require('hyperdrive')
const FeedParser = require('feedparser')
const memdb = require('memdb')
const toStream = require('string-to-stream')
const async = require('async')
const RSS = require('rss')
const toString = require('stream-to-string')
const swarm = require('hyperdrive-archive-swarm')
const request = require('request')

function Torrent (key, opts) {
  if (!(this instanceof Torrent)) return new Torrent(opts)

  if (typeof key === 'object' && !Buffer.isBuffer(key) && key) {
    opts = key
    key = null
  }
  if (!opts) opts = {}
  if (!opts.storage) opts.storage = memdb()
  this.scrap = opts.scrap
  this._drive = hyperdrive(opts.storage)
  if (key) {
    this._archive = this._drive.createArchive(key)
    this.own = false
  } else {
    this._archive = this._drive.createArchive()
    this.own = true
  }
}

Torrent.prototype.key = function () {
  return this._archive.key
}

Torrent.prototype.swarm = function () {
  return swarm(this._archive)
}

Torrent.prototype.update = function (feed) {
  var torrent = this
  return new Promise((resolve, reject) => {
    if (!this.own) return reject(new Error("can't update archive you don't own"))
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

      while (entry = readable.read()) {
        tasks.push(save(entry))
        if (torrent.scrap) tasks.push(scrap(entry))
      }
    })
    feedparser.on('end', function () {
      async.series(tasks, (err, results) => {
        if (err) return reject(new Error('archive failed'))
        resolve(torrent)
      })
    })
  })

  function save (entry) {
    return (cb) => {
      torrent.list((err, entries) => {
        if (err) return cb(err)
        if (entries.find(x => x.name === entry.guid)) return cb() // ignore duplicated entry
        if (!entry.guid) return cb(new Error('GUID not found'))

        toStream(JSON.stringify(entry)).pipe(createWriteStream(entry)).on('finish', cb)
      })
    }
  }

  function scrap (entry) {
    return (cb) => {
      request(entry.url, (err, resp, body) => {
        if (err) return cb(err)
        if (resp.statusCode !== 200) return cb(new Error('invalid status code'))

        toStream(body).pipe(createWriteStream(entry)).on('finish', cb)
      })
    }
  }

  function createWriteStream (entry) {
    return torrent._archive.createFileWriteStream({
      name: entry.guid,
      ctime: entry.date ? entry.date.getTime() : 0
    })
  }
}

Torrent.prototype.list = function (opts, cb) {
  if (this.own) {
    this._archive.finalize(() => {
      this._archive.list(opts, cb)
    })
  } else {
    this._archive.list(opts, cb)
  }
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

module.exports = Torrent

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
