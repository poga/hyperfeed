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
const through2 = require('through2')
const pump = require('pump')

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

Hyperfeed.prototype.list = function (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  if (!opts) opts = {}
  if (!opts.live) opts.live = false

  var done
  if (cb) {
    done = (err, results) => {
      if (err) return cb(err)

      cb(null, results.filter(x => { return x.name !== '_meta' }))
    }
  }
  var rs = through2.obj(function (obj, enc, next) {
    if (obj.name !== '_meta') this.push(obj)
    next()
  })
  if (this.own) {
    this._archive.finalize(() => {
      pump(this._archive.list(opts, done), rs)
    })
  } else {
    pump(this._archive.list(opts, done), rs)
  }

  return rs
}

Hyperfeed.prototype.xml = function (count) {
  return new Promise((resolve, reject) => {
    this.list((err, entries) => {
      if (err) return reject(err)
      if (entries.length > count) {
        entries = entries.sort(byCTimeDESC).slice(0, 10)
      }
      var tasks = []
      entries.forEach(e => { tasks.push(this._load(e)) })

      async.series(tasks, (err, results) => {
        if (err) return reject(err)
        buildXML(this._archive, this.meta, results).then(xml => resolve(xml))
      })
    })
  })
}

Hyperfeed.prototype._save = function (entry) {
  var feed = this
  return (cb) => {
    this.list((err, entries) => {
      if (err) return cb(err)
      if (entries.find(x => x.name === entry.guid)) return cb() // ignore duplicated entry
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

Hyperfeed.prototype.load = function (entry) {
  return new Promise((resolve, reject) => {
    this._load(entry)((err, item) => {
      if (err) return reject(err)

      resolve(item)
    })
  })
}

Hyperfeed.prototype._load = function (entry) {
  return (cb) => {
    var rs = this._archive.createFileReadStream(entry)
    toString(rs, (err, str) => {
      if (err) return cb(err)

      var item = JSON.parse(str)
      item.date = moment(item.date).toDate()
      cb(null, item)
    })
  }
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

