const hyperdrive = require('hyperdrive')
const HyperfeedParser = require('feedparser')
const memdb = require('memdb')
const toStream = require('string-to-stream')
const async = require('async')
const Feed = require('feed')
const toString = require('stream-to-string')
const swarm = require('hyperdrive-archive-swarm')
const request = require('request')
const moment = require('moment')
const uuid = require('uuid')

function Hyperfeed (key, opts) {
  if (!(this instanceof Hyperfeed)) return new Hyperfeed(opts)

  if (typeof key === 'object' && !Buffer.isBuffer(key) && key) {
    opts = key
    key = null
  }
  if (!opts) opts = {}
  if (!opts.storage) opts.storage = memdb()
  this.scrap = opts.scrap
  this._drive = hyperdrive(opts.storage)

  var archiveOpts
  if (opts.file) archiveOpts = {file: opts.file}
  if (key) {
    this._archive = this._drive.createArchive(key, archiveOpts)
    this.own = false
  } else {
    this._archive = this._drive.createArchive(archiveOpts)
    this.own = true
  }
}

Hyperfeed.prototype.key = function () {
  return this._archive.key
}

Hyperfeed.prototype.swarm = function (opts) {
  return swarm(this._archive, opts)
}

Hyperfeed.prototype.update = function (feed) {
  var self = this
  return new Promise((resolve, reject) => {
    if (!this.own) return reject(new Error("can't update archive you don't own"))
    var feedparser = new HyperfeedParser()
    toStream(feed).pipe(feedparser)

    var tasks = []
    feedparser.on('error', e => reject(e))
    feedparser.on('meta', meta => {
      this.meta = meta

      tasks.push((cb) => {
        var ws = self._archive.createFileWriteStream('_meta')
        toStream(JSON.stringify(meta)).pipe(ws).on('finish', cb)
      })
    })
    feedparser.on('readable', function () {
      var readable = this
      var entry

      while ((entry = readable.read())) {
        tasks.push(self._save(entry))
      }
    })
    feedparser.on('end', function () {
      async.series(tasks, (err, results) => {
        if (err) return reject(err)
        resolve(self)
      })
    })
  })
}

Hyperfeed.prototype.setMeta = function (meta) {
  var self = this
  self.meta = meta

  return new Promise((resolve, reject) => {
    var ws = self._archive.createFileWriteStream('_meta')
    toStream(JSON.stringify(meta)).pipe(ws).on('finish', () => { resolve(self) })
  })
}

Hyperfeed.prototype.push = function (entry) {
  if (!entry.guid) entry.guid = uuid.v1()
  if (!entry.date) entry.date = new Date()

  return new Promise((resolve, reject) => {
    var tasks = []

    tasks.push(this._save(entry))

    async.series(tasks, (err, results) => {
      if (err) return reject(new Error('archive failed'))
      resolve(this)
    })
  })
}

Hyperfeed.prototype.list = function (opts) {
  if (!opts) opts = {}
  if (!opts.limit) opts.limit = 20
  if (!opts.offset) opts.offset = 0
  var self = this
  return new Promise((resolve, reject) => {
    if (this.own) {
      this._archive.finalize(() => {
        this._archive.list(opts, done)
      })
    } else {
      this._archive.list(opts, done)
    }

    function done (err, results) {
      if (err) return reject(err)

      var tasks = []
      results
        .filter(x => { return x.name !== '_meta' })
        .sort(byCTimeDESC)
        .slice(opts.offset, opts.offset + opts.limit)
        .forEach(x => {
          tasks.push(load(self._archive, x))
        })

      async.parallel(tasks, (err, results) => {
        if (err) return reject(err)
        resolve(results)
      })
    }
  })
}

Hyperfeed.prototype.xml = function (count) {
  return new Promise((resolve, reject) => {
    this.list().then(entries => {
      if (entries.length > count) {
        entries = entries.sort(byCTimeDESC).slice(0, 10)
      }

      buildXML(this._archive, this.meta, entries).then(xml => resolve(xml))
    })
  })
}

Hyperfeed.prototype._save = function (entry) {
  var feed = this
  return (cb) => {
    this.list().then(entries => {
      if (entries.find(x => x.guid === entry.guid)) return cb() // ignore duplicated entry
      if (!entry.guid) return cb(new Error('GUID not found'))

      toStream(JSON.stringify(entry)).pipe(this._createWriteStream(entry)).on('finish', done)
    })

    function done () {
      if (feed.scrap) return feed._scrap(entry)(cb)
      return cb()
    }
  }
}

Hyperfeed.prototype._scrap = function (entry) {
  return (cb) => {
    var url = entry.url || entry.link
    request(url, (err, resp, body) => {
      if (err) return cb(err)
      if (resp.statusCode !== 200) return cb(new Error('invalid status code'))

      toStream(body).pipe(this._createWriteStream(entry)).on('finish', cb)
    })
  }
}

Hyperfeed.prototype._createWriteStream = function (entry) {
  return this._archive.createFileWriteStream({
    name: entry.guid,
    ctime: entry.date ? entry.date.getTime() : 0
  })
}

module.exports = Hyperfeed

function buildXML (archive, meta, entries) {
  return new Promise((resolve, reject) => {
    var feed = new Feed(Object.assign(meta, {feed_url: meta.xmlUrl, site_url: meta.link}))

    entries.forEach(e => {
      feed.addItem(e)
    })
    resolve(feed.render('rss-2.0'))
  })
}

function byCTimeDESC (x, y) {
  return y.ctime - x.ctime
}

function load (archive, entry) {
  return (cb) => {
    var rs = archive.createFileReadStream(entry)
    toString(rs, (err, str) => {
      if (err) return cb(err)

      var item = JSON.parse(str)
      item.date = moment(item.date).toDate()
      cb(null, item)
    })
  }
}
