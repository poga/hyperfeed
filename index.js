const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const Feed = require('./feed')

function Hyperfeed (drive) {
  if (!(this instanceof Hyperfeed)) return new Hyperfeed(drive)

  if (!drive) drive = hyperdrive(memdb())
  this._drive = drive
}

Hyperfeed.prototype.createFeed = function (key, opts) {
  return new Feed(this._drive, key, opts)
}

module.exports = Hyperfeed
