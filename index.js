const FeedParser = require('feedparser')
const FeedGen = require('feed')
const toStream = require('string-to-stream')
const async = require('async')
const request = require('request')
const uuid = require('uuid')
const pump = require('pump')
const collect = require('collect-stream')
const moment = require('moment')

const DEFAULT_OPTS = {scrap: true}
const METADATA_FILE = 'metadata.json'
const SCRAP_DIR = 'scrap'

function Feed (archive, opts) {
  if (!(this instanceof Feed)) return new Feed(archive, opts)

  opts = Object.assign({}, DEFAULT_OPTS, opts)

  this.scrap = opts.scrap

  this.archive = archive
}

Feed.prototype.update = function (feed, cb) {
  if (!this.archive.metadata.writable) return cb(new Error("can't update archive you don't own"))

  var self = this
  var feedparser = new FeedParser()

  toStream(feed).pipe(feedparser)

  var tasks = []
  feedparser.on('error', e => cb(e))
  feedparser.on('meta', meta => {
    this.meta = meta

    tasks.push((cb) => {
      var ws = self.archive.createWriteStream(METADATA_FILE)
      toStream(JSON.stringify(meta)).pipe(ws).on('finish', cb)
    })
  })
  feedparser.on('readable', function () {
    var readable = this
    var item

    while ((item = readable.read())) {
      tasks.push(_save(item))
    }
  })
  feedparser.on('end', function () {
    async.series(tasks, (err) => {
      if (err) return cb(err)
      cb(null, self)
    })
  })

  function _save (item) {
    return (cb) => {
      self.save(item, cb)
    }
  }
}

Feed.prototype.setMeta = function (meta, cb) {
  var self = this
  self.meta = meta

  var ws = self.archive.createWriteStream(METADATA_FILE)
  pump(toStream(JSON.stringify(meta)), ws, cb)
}

Feed.prototype.list = function (cb) {
  this.archive.readdir('/', function (err, list) {
    if (err) return cb(err)
    var results = []

    list.forEach(name => {
      if (name !== METADATA_FILE && name !== SCRAP_DIR) results.push(name)
    })

    cb(null, results)
  })
}

Feed.prototype.xml = function (count, cb) {
  var self = this
  this.list((err, files) => {
    if (err) return cb(err)
    if (files.length > count) {
      files = files.slice(0, 10)
    }
    var tasks = []
    files.forEach(e => { tasks.push(this._load(e)) })

    async.series(tasks, (err, results) => {
      if (err) return cb(err)
      buildXML(results, cb)
    })
  })

  function buildXML (entries, cb) {
    var meta = self.meta
    var feed = new FeedGen(Object.assign({}, meta, {feed_url: meta.xmlUrl, site_url: meta.link}))

    entries.forEach(e => {
      var x = JSON.parse(e)
      x.date = moment(x.date).toDate()
      feed.addItem(x)
    })
    cb(null, feed.render('rss-2.0'))
  }
}

Feed.prototype.save = function (item, scrappedData, cb) {
  if (cb === undefined && typeof scrappedData === 'function') {
    cb = scrappedData
    scrappedData = undefined
  }

  if (!item.guid) item.guid = uuid.v1()
  if (!item.date) item.date = new Date()

  var self = this
  self.list((err, files) => {
    if (err) return cb(err)
    if (files.find(name => name === item.guid)) return cb() // ignore duplicated entry

    var to = self.archive.createWriteStream(item.guid)
    toStream(JSON.stringify(item)).pipe(to).on('finish', done)
  })

  function done () {
    if (scrappedData) return _saveScrapped(item, scrappedData, cb)
    if (self.scrap) return _scrap(item, cb)

    return cb()
  }

  function _scrap (item, cb) {
    var url = item.url || item.link
    request(url, (err, resp, body) => {
      if (err) return cb(err)
      if (resp.statusCode !== 200) { return cb(new Error('invalid status code')) }

      _saveScrapped(item, body, cb)
    })
  }

  function _saveScrapped (item, data, cb) {
    pump(toStream(data), self.archive.createWriteStream(`${SCRAP_DIR}/${item.guid}`), cb)
  }
}

Feed.prototype.get = function (id, cb) {
  this._load(id)((err, item) => {
    if (err) return cb(err)

    cb(null, item)
  })
}

Feed.prototype.getScrapped = function (id) {

}

Feed.prototype._load = function (entry, opts) {
  return (cb) => {
    collect(this.archive.createReadStream(entry), cb)
  }
}

module.exports = Feed
