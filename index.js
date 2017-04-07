const FeedParser = require('feedparser')
const FeedGen = require('feed')
const toStream = require('string-to-stream')
const async = require('async')
const request = require('request')
const uuid = require('uuid')
const events = require('events')
const inherits = require('inherits')
const pump = require('pump')
const collect = require('collect-stream')
const moment = require('moment')

const DEFAULT_OPTS = {scrap: true}
const METADATA_FILE = 'metadata.json'
const SCRAP_DIR = 'scrap'

function Feed (archive, opts) {
  if (!(this instanceof Feed)) return new Feed(archive, opts)
  events.EventEmitter.call(this)

  opts = Object.assign({}, DEFAULT_OPTS, opts)

  this.scrap = opts.scrap

  this.archive = archive
}

inherits(Feed, events.EventEmitter)

Feed.prototype.update = function (feed) {
  var self = this
  return new Promise((resolve, reject) => {
    if (!this.archive.metadata.writable) return reject(new Error("can't update archive you don't own"))
    var feedparser = new FeedParser()
    toStream(feed).pipe(feedparser)

    var tasks = []
    feedparser.on('error', e => reject(e))
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
        if (err) return reject(err)
        resolve(self)
      })
    })
  })

  function _save (item) {
    return (cb) => {
      self.save(item).then(() => { cb() }).catch(err => { cb(err) })
    }
  }
}

Feed.prototype.setMeta = function (meta) {
  var self = this
  self.meta = meta

  return new Promise((resolve, reject) => {
    var ws = self.archive.createWriteStream(METADATA_FILE)
    toStream(JSON.stringify(meta)).pipe(ws).on('finish', () => { resolve(self) })
  })
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

Feed.prototype.xml = function (count) {
  var self = this
  return new Promise((resolve, reject) => {
    this.list((err, files) => {
      if (err) return reject(err)
      if (files.length > count) {
        files = files.slice(0, 10)
      }
      var tasks = []
      files.forEach(e => { tasks.push(this._load(e)) })

      async.series(tasks, (err, results) => {
        if (err) return reject(err)
        buildXML(results).then(xml => resolve(xml))
      })
    })
  })
  function buildXML (entries) {
    var meta = self.meta
    return new Promise((resolve, reject) => {
      var feed = new FeedGen(Object.assign({}, meta, {feed_url: meta.xmlUrl, site_url: meta.link}))

      entries.forEach(e => {
        var x = JSON.parse(e)
        x.date = moment(x.date).toDate()
        feed.addItem(x)
      })
      resolve(feed.render('rss-2.0'))
    })
  }
}

Feed.prototype.save = function (item, scrappedData) {
  if (!item.guid) item.guid = uuid.v1()
  if (!item.date) item.date = new Date()

  var self = this
  return new Promise((resolve, reject) => {
    self.list((err, files) => {
      if (err) return reject(err)
      if (files.find(name => name === item.guid)) return resolve() // ignore duplicated entry

      var to = self.archive.createWriteStream(item.guid)
      toStream(JSON.stringify(item)).pipe(to).on('finish', done)
    })

    function done () {
      if (scrappedData) return _saveScrapped(item, scrappedData, resolve)
      if (self.scrap) return _scrap(item, resolve)

      return resolve()
    }
  })

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

Feed.prototype.get = function (id) {
  return new Promise((resolve, reject) => {
    this._load(id)((err, item) => {
      if (err) return reject(err)

      resolve(item)
    })
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
